use axum::{extract::State, Extension, Json};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::ticket::Ticket;
use crate::models::seat::EventSeat;
use crate::utils::jwt::Claims;
use crate::utils::qr;
use crate::models::order::Order;
use crate::AppState;

// ─── Create Razorpay Order ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateOrderRequest {
    pub amount_paise: u64,      // amount in paise (1 INR = 100 paise)
    pub event_id: Uuid,
    pub seat_ids: Option<Vec<Uuid>>,
    pub quantity: Option<i32>,
}

#[derive(Serialize)]
pub struct CreateOrderResponse {
    pub order_id: String,
    pub amount: u64,
    pub currency: String,
    pub key_id: String,
    pub event_id: Uuid,
}

#[derive(Deserialize)]
struct RazorpayOrderResponse {
    id: String,
    amount: u64,
    currency: String,
}

pub async fn create_razorpay_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateOrderRequest>,
) -> Result<Json<CreateOrderResponse>, AppError> {
    if claims.role != "attendee" {
        return Err(AppError::Forbidden("Only attendees can purchase tickets".to_string()));
    }

    let client = reqwest::Client::new();
    let receipt = format!("receipt_{}", Uuid::new_v4().to_string().replace("-", "")[..16].to_string());

    let body = serde_json::json!({
        "amount": input.amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": {
            "event_id": input.event_id.to_string(),
            "user_id": claims.sub.to_string()
        }
    });

    let response = client
        .post("https://api.razorpay.com/v1/orders")
        .basic_auth(&state.config.razorpay_key_id, Some(&state.config.razorpay_key_secret))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to reach Razorpay: {}", e)))?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("Razorpay order creation failed: {}", err_text)));
    }

    let rzp_order: RazorpayOrderResponse = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse Razorpay response: {}", e)))?;

    Ok(Json(CreateOrderResponse {
        order_id: rzp_order.id,
        amount: rzp_order.amount,
        currency: rzp_order.currency,
        key_id: state.config.razorpay_key_id.clone(),
        event_id: input.event_id,
    }))
}

// ─── Verify Payment & Create Tickets ─────────────────────────────────────────

#[derive(Deserialize)]
pub struct VerifyPaymentRequest {
    pub razorpay_order_id: String,
    pub razorpay_payment_id: String,
    pub razorpay_signature: String,
    pub event_id: Uuid,
    pub seat_ids: Option<Vec<Uuid>>,
    pub quantity: Option<i32>,
    pub ticket_type: Option<String>,
}

pub async fn verify_and_book(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<VerifyPaymentRequest>,
) -> Result<Json<Vec<Ticket>>, AppError> {
    let is_free_request = input.razorpay_order_id == "FREE";

    if !is_free_request {
        // ── 1. Verify Razorpay signature ─────────────────────────────────────────
        let signature_payload = format!("{}|{}", input.razorpay_order_id, input.razorpay_payment_id);
        
        tracing::debug!("Verifying payment: order_id={}, payment_id={}", input.razorpay_order_id, input.razorpay_payment_id);
        
        type HmacSha256 = Hmac<Sha256>;
        let mut mac = HmacSha256::new_from_slice(state.config.razorpay_key_secret.as_bytes())
            .map_err(|_| AppError::Internal("HMAC key error".to_string()))?;
        mac.update(signature_payload.as_bytes());
        let computed = hex::encode(mac.finalize().into_bytes());

        if computed != input.razorpay_signature {
            tracing::error!("Signature mismatch! Computed: {}, Received: {}", computed, input.razorpay_signature);
            return Err(AppError::Forbidden("Payment signature verification failed".to_string()));
        }

        tracing::info!("Payment signature verified for order: {}", input.razorpay_order_id);
    } else {
        tracing::info!("Processing free ticket request for event: {}", input.event_id);
    }

    // ── 2. Fetch event ────────────────────────────────────────────────────────
    let event = sqlx::query_as::<_, crate::models::event::Event>("SELECT * FROM events WHERE id = $1")
        .bind(input.event_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    let mut tickets: Vec<Ticket> = Vec::new();

    // ── 3. Create tickets ─────────────────────────────────────────────────────
    if let Some(seat_ids) = &input.seat_ids {
        // Seat-map flow: purchase+confirm seat-mapped tickets
        let mut tx = state.db.begin().await?;

        // Create one order record
        let total_amount = sqlx::query_scalar::<_, rust_decimal::Decimal>(
            "SELECT COALESCE(SUM(CASE WHEN row_label IN ('A','B') AND $2::numeric IS NOT NULL 
             THEN $2 ELSE $3 END), 0) 
             FROM event_seats WHERE id = ANY($1)"
        )
        .bind(seat_ids)
        .bind(event.vip_price)
        .bind(event.ticket_price)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(event.ticket_price * rust_decimal::Decimal::from(seat_ids.len() as i64));

        if is_free_request && total_amount > rust_decimal::Decimal::ZERO {
            return Err(AppError::BadRequest("Payment is required for this event. It is not free.".to_string()));
        }

        let order = sqlx::query_as::<_, Order>(
              "INSERT INTO orders (user_id, event_id, total_amount, quantity, ticket_type, order_status, razorpay_order_id, razorpay_payment_id) 
               VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7) RETURNING *"
        )
        .bind(claims.sub)
        .bind(input.event_id)
        .bind(total_amount)
        .bind(seat_ids.len() as i32)
        .bind("mixed")
           .bind(&input.razorpay_order_id)
           .bind(&input.razorpay_payment_id)
        .fetch_one(&mut *tx)
        .await?;

        for seat_id in seat_ids {
            // Mark seat as booked (was locked by this user for payment)
            let seat = sqlx::query_as::<_, EventSeat>(
                r#"UPDATE event_seats
                   SET status = 'booked', locked_by = NULL, locked_until = NULL
                   WHERE id = $1 AND event_id = $2 AND locked_by = $3 AND status = 'locked'
                   RETURNING *"#
            )
            .bind(*seat_id)
            .bind(input.event_id)
            .bind(claims.sub)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::Conflict(
                format!("Seat {} lock expired or was already used", seat_id)
            ))?;

            let ticket_id = Uuid::new_v4();
            let qr_data = qr::generate_qr_payload(ticket_id, input.event_id, claims.sub, &state.config.jwt_secret);
            let is_vip = seat.row_label == "A" || seat.row_label == "B";
            let ticket_type = if is_vip { "vip" } else { "standard" };

            let ticket = sqlx::query_as::<_, Ticket>(
                r#"INSERT INTO tickets (id, order_id, event_id, seat_id, user_id, qr_code_data, ticket_type)
                   VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *"#
            )
            .bind(ticket_id)
            .bind(order.id)
            .bind(input.event_id)
            .bind(seat.id)
            .bind(claims.sub)
            .bind(&qr_data)
            .bind(ticket_type)
            .fetch_one(&mut *tx)
            .await?;

            tickets.push(ticket);
        }

        sqlx::query("UPDATE events SET tickets_sold = tickets_sold + $1 WHERE id = $2")
            .bind(seat_ids.len() as i32)
            .bind(input.event_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

    } else {
        // Standard (no seat-map) flow
        let quantity = input.quantity.unwrap_or(1);
        let ticket_type = input.ticket_type.as_deref().unwrap_or("standard");
        let unit_price = if ticket_type == "vip" {
            event.vip_price.ok_or_else(|| AppError::BadRequest("VIP not available".to_string()))?
        } else {
            event.ticket_price
        };
        let total = unit_price * rust_decimal::Decimal::from(quantity);

        if is_free_request && total > rust_decimal::Decimal::ZERO {
            return Err(AppError::BadRequest("Payment is required for this event. It is not free.".to_string()));
        }

        let mut tx = state.db.begin().await?;

        // 1. Check/Consume hold or check availability
        let hold_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM ticket_holds WHERE event_id = $1 AND user_id = $2 AND expires_at > NOW())"
        )
        .bind(input.event_id)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;

        if !hold_exists {
            // Safety check if no hold (though frontend should have created one)
            let held_by_others: i64 = sqlx::query_scalar(
                "SELECT COALESCE(SUM(quantity), 0) FROM ticket_holds WHERE event_id = $1 AND expires_at > NOW() AND user_id != $2"
            )
            .bind(input.event_id)
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;

            let available = event.max_tickets - event.tickets_sold - held_by_others as i32;
            if quantity > available {
                return Err(AppError::Conflict("Tickets are no longer available (held by others)".to_string()));
            }
        }

        let order = sqlx::query_as::<_, Order>(
              "INSERT INTO orders (user_id, event_id, total_amount, quantity, ticket_type, order_status, razorpay_order_id, razorpay_payment_id) 
               VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7) RETURNING *"
        )
        .bind(claims.sub)
        .bind(input.event_id)
        .bind(total)
        .bind(quantity)
        .bind(ticket_type)
        .bind(&input.razorpay_order_id)
        .bind(&input.razorpay_payment_id)
        .fetch_one(&mut *tx)
        .await?;

        for _ in 0..quantity {
            let ticket_id = Uuid::new_v4();
            let qr_data = qr::generate_qr_payload(ticket_id, input.event_id, claims.sub, &state.config.jwt_secret);

            let ticket = sqlx::query_as::<_, Ticket>(
                r#"INSERT INTO tickets (id, order_id, event_id, user_id, qr_code_data, ticket_type)
                   VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"#
            )
            .bind(ticket_id)
            .bind(order.id)
            .bind(input.event_id)
            .bind(claims.sub)
            .bind(&qr_data)
            .bind(ticket_type)
            .fetch_one(&mut *tx)
            .await?;

            tickets.push(ticket);
        }

        sqlx::query("UPDATE events SET tickets_sold = tickets_sold + $1 WHERE id = $2")
            .bind(quantity)
            .bind(input.event_id)
            .execute(&mut *tx)
            .await?;

        // 2. Consume my hold if any
        sqlx::query("DELETE FROM ticket_holds WHERE event_id = $1 AND user_id = $2")
            .bind(input.event_id)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
    }

    Ok(Json(tickets))
}
