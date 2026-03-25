use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{Duration, Utc};
use reqwest::Client;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::event::Event;
use crate::models::order::Order;
use crate::models::seat::EventSeat;
use crate::models::ticket::{CancellationPreview, CancellationResult, PurchaseRequest, Ticket, TicketWithQr};
use crate::utils::jwt::Claims;
use crate::utils::qr;
use crate::AppState;

/// POST /api/tickets/purchase — buy tickets for an event
pub async fn purchase_tickets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<PurchaseRequest>,
) -> Result<Json<Vec<Ticket>>, AppError> {
    // Restriction: Only attendees can purchase tickets
    if claims.role != "attendee" {
        return Err(AppError::Forbidden("Only attendee accounts can purchase tickets".to_string()));
    }

    // Fetch event
    let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(input.event_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    if event.status != "published" {
        return Err(AppError::BadRequest("Event is not available for purchase".to_string()));
    }

    // ── Seat-map path ──────────────────────────────────────────────────────────
    if event.seat_map_enabled {
        let seat_ids = input
            .seat_ids
            .as_ref()
            .filter(|v| !v.is_empty())
            .ok_or_else(|| AppError::BadRequest("seat_ids are required for seat-map events".to_string()))?;

        let quantity = seat_ids.len() as i32;

        if quantity <= 0 || quantity > 10 {
            return Err(AppError::BadRequest("You can purchase between 1 and 10 seats at once".to_string()));
        }

        // Fraud: max 10 seats per user per event
        let existing_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM tickets WHERE event_id = $1 AND user_id = $2 AND status = 'active'"
        )
        .bind(input.event_id)
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await?;

        if existing_count + quantity as i64 > 10 {
            return Err(AppError::BadRequest(
                format!("Maximum 10 tickets per user. You already have {}", existing_count)
            ));
        }

        let mut total = rust_decimal::Decimal::from(0);
        let mut ticket_types = Vec::new();

        // Fetch seat details to determine pricing per seat
        let seats = sqlx::query_as::<_, EventSeat>(
            "SELECT * FROM event_seats WHERE id = ANY($1) AND event_id = $2"
        )
        .bind(seat_ids)
        .bind(input.event_id)
        .fetch_all(&state.db)
        .await?;

        if seats.len() != seat_ids.len() {
            return Err(AppError::BadRequest("Some selected seats were not found".to_string()));
        }

        for seat in &seats {
            let is_vip = seat.row_label == "A" || seat.row_label == "B";
            let price = if is_vip {
                event.vip_price.ok_or_else(|| AppError::BadRequest("VIP seats detected but no VIP price set for this event".to_string()))?
            } else {
                event.ticket_price
            };
            total += price;
            ticket_types.push(if is_vip { "vip" } else { "standard" });
        }

        // Use a transaction for atomicity
        let mut tx = state.db.begin().await?;

        // Create order
        let order = sqlx::query_as::<_, Order>(
            "INSERT INTO orders (user_id, event_id, total_amount, quantity, ticket_type) VALUES ($1, $2, $3, $4, $5) RETURNING *"
        )
        .bind(claims.sub)
        .bind(input.event_id)
        .bind(total)
        .bind(quantity)
        .bind("mixed") // Type is now determined per seat
        .fetch_one(&mut *tx)
        .await?;

        let mut tickets = Vec::new();

        for seat_id in seat_ids {
            // Verify each seat is still locked by this user (atomic claim)
            let seat = sqlx::query_as::<_, EventSeat>(
                r#"UPDATE event_seats
                   SET status = 'booked',
                       locked_by = NULL,
                       locked_until = NULL
                   WHERE id = $1
                     AND event_id = $2
                     AND status = 'locked'
                     AND locked_by = $3
                   RETURNING *"#
            )
            .bind(*seat_id)
            .bind(input.event_id)
            .bind(claims.sub)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::Conflict(
                format!("Seat {} is no longer locked by you. Please re-select.", seat_id)
            ))?;

            let ticket_id = Uuid::new_v4();
            let qr_data = qr::generate_qr_payload(ticket_id, input.event_id, claims.sub, &state.config.jwt_secret);

            let is_vip = seat.row_label == "A" || seat.row_label == "B";
            let current_ticket_type = if is_vip { "vip" } else { "standard" };

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
            .bind(current_ticket_type)
            .fetch_one(&mut *tx)
            .await?;

            tickets.push(ticket);
        }

        // Update tickets_sold
        sqlx::query("UPDATE events SET tickets_sold = tickets_sold + $1 WHERE id = $2")
            .bind(quantity)
            .bind(input.event_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        return Ok(Json(tickets));
    }

    // ── Standard (no seat-map) path ────────────────────────────────────────────
    let quantity = input.quantity;
    if quantity <= 0 || quantity > 10 {
        return Err(AppError::BadRequest("Quantity must be between 1 and 10".to_string()));
    }

    // Check availability
    let remaining = event.max_tickets - event.tickets_sold;
    if quantity > remaining {
        return Err(AppError::BadRequest(format!("Only {} tickets remaining", remaining)));
    }

    // Fraud check
    let existing_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM tickets WHERE event_id = $1 AND user_id = $2 AND status = 'active'"
    )
    .bind(input.event_id)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    if existing_count + quantity as i64 > 10 {
        return Err(AppError::BadRequest(
            format!("Maximum 10 tickets per user. You already have {}", existing_count)
        ));
    }

    let ticket_type = input.ticket_type.as_deref().unwrap_or("standard");
    let unit_price = if ticket_type == "vip" {
        event.vip_price.ok_or_else(|| AppError::BadRequest("VIP tickets are not available for this event".to_string()))?
    } else {
        event.ticket_price
    };

    let total = unit_price * rust_decimal::Decimal::from(quantity);
    let mut tx = state.db.begin().await?;

    let order = sqlx::query_as::<_, Order>(
        "INSERT INTO orders (user_id, event_id, total_amount, quantity, ticket_type) VALUES ($1, $2, $3, $4, $5) RETURNING *"
    )
    .bind(claims.sub)
    .bind(input.event_id)
    .bind(total)
    .bind(quantity)
    .bind(ticket_type)
    .fetch_one(&mut *tx)
    .await?;

    let mut tickets = Vec::new();
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

    tx.commit().await?;

    Ok(Json(tickets))
}

/// GET /api/tickets/my — list user's tickets
pub async fn my_tickets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Ticket>>, AppError> {
    let tickets = sqlx::query_as::<_, Ticket>(
        r#"
        SELECT 
            t.id, t.order_id, t.event_id, t.seat_id, t.user_id, t.qr_code_data, t.ticket_type,
            CASE WHEN t.status IN ('active', 'valid') AND e.event_end_time < NOW() THEN 'expired' ELSE t.status END as status,
            t.refund_status, t.scanned_at, t.created_at,
            e.title as event_title,
            e.event_date as event_date,
            e.refund_policy as event_refund_policy,
            e.ticket_price as event_ticket_price,
            e.vip_price as event_vip_price,
            e.status as event_status,
            e.image_urls[1] as event_image,
            e.location as event_location,
            e.google_maps_url
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE t.user_id = $1 
        ORDER BY t.created_at DESC
        "#
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(tickets))
}

/// GET /api/tickets/:id/qr — get ticket with QR code image and event details
pub async fn get_ticket_qr(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TicketWithQr>, AppError> {
    
    // We fetch the ticket alongside joined event and seat data.
    // We use a custom struct to deserialize the joined query result.
    #[derive(sqlx::FromRow)]
    struct TicketWithEventData {
        // Ticket fields
        id: Uuid,
        order_id: Uuid,
        event_id: Uuid,
        seat_id: Option<Uuid>,
        user_id: Uuid,
        qr_code_data: String,
        ticket_type: String,
        status: String,
        refund_status: String,
        scanned_at: Option<chrono::DateTime<chrono::Utc>>,
        created_at: chrono::DateTime<chrono::Utc>,
        // Event fields
        event_title: String,
        event_images: Option<Vec<String>>,
        event_date: chrono::DateTime<chrono::Utc>,
        event_status: String,
        event_location: String,
        google_maps_url: Option<String>,
        // Seat fields
        row_label: Option<String>,
        seat_number: Option<i32>,
    }

    let data = sqlx::query_as::<_, TicketWithEventData>(
        r#"
        SELECT 
            t.id, t.order_id, t.event_id, t.seat_id, t.user_id, t.qr_code_data, t.ticket_type,
            CASE WHEN t.status IN ('active', 'valid') AND e.event_end_time < NOW() THEN 'expired' ELSE t.status END as status,
            t.refund_status, t.scanned_at, t.created_at,
            e.title as event_title,
            e.image_urls as event_images,
            e.event_date as event_date,
            e.status as event_status,
            e.location as event_location,
            e.google_maps_url,
            s.row_label,
            s.seat_number
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        LEFT JOIN event_seats s ON t.seat_id = s.id
        WHERE t.id = $1 AND t.user_id = $2
        "#
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Ticket not found".to_string()))?;

    let qr_image = qr::generate_qr_image_base64(&data.qr_code_data)
        .map_err(|e| AppError::Internal(e))?;

    let first_image = data.event_images.and_then(|mut images| {
        if !images.is_empty() { Some(images.remove(0)) } else { None }
    });

    let seat_label = match (data.row_label, data.seat_number) {
        (Some(r), Some(n)) => Some(format!("Row {} - Seat {}", r, n)),
        _ => None,
    };

    let ticket = Ticket {
        id: data.id,
        order_id: data.order_id,
        event_id: data.event_id,
        seat_id: data.seat_id,
        user_id: data.user_id,
        qr_code_data: data.qr_code_data,
        ticket_type: data.ticket_type,
        status: data.status,
        refund_status: data.refund_status,
        scanned_at: data.scanned_at,
        created_at: data.created_at,
        event_title: Some(data.event_title.clone()),
        event_date: Some(data.event_date),
        event_refund_policy: None,
        event_ticket_price: None,
        event_vip_price: None,
        event_status: Some(data.event_status.clone()),
        event_image: first_image.clone(),
        event_location: Some(data.event_location.clone()),
        google_maps_url: data.google_maps_url.clone(),
    };
    Ok(Json(TicketWithQr {
        ticket,
        qr_image_base64: qr_image,
        event_title: data.event_title,
        event_image: first_image,
        event_date: data.event_date,
        seat_label,
        event_status: Some(data.event_status),
    }))
}

#[derive(sqlx::FromRow)]
struct TicketCancellationContext {
    ticket_status: String,
    ticket_type: String,
    seat_id: Option<Uuid>,
    event_id: Uuid,
    event_date: chrono::DateTime<chrono::Utc>,
    refund_policy: String,
    ticket_price: Decimal,
    vip_price: Option<Decimal>,
    razorpay_payment_id: Option<String>,
}

fn compute_cancellation_decision(ctx: &TicketCancellationContext) -> (bool, Decimal, String, String) {
    let cutoff = ctx.event_date - Duration::hours(24);
    let now = Utc::now();
    let within_window = now >= cutoff;
    let refundable_event = ctx.refund_policy == "REFUNDABLE";

    if !refundable_event {
        return (
            false,
            Decimal::ZERO,
            "none".to_string(),
            "Non-refundable event: ticket can be cancelled, but no refund is issued.".to_string(),
        );
    }

    if within_window {
        return (
            false,
            Decimal::ZERO,
            "none".to_string(),
            "Cancellation happened within 24 hours of event start; no refund is issued.".to_string(),
        );
    }

    let refund_amount = if ctx.ticket_type == "vip" {
        ctx.vip_price.unwrap_or(ctx.ticket_price)
    } else {
        ctx.ticket_price
    };

    (
        true,
        refund_amount,
        "pending".to_string(),
        "Eligible for refund. Ticket price will be refunded; convenience fee is excluded.".to_string(),
    )
}

/// GET /api/tickets/:id/cancellation-preview — calculate cancellation outcome
pub async fn preview_ticket_cancellation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CancellationPreview>, AppError> {
    let ctx = sqlx::query_as::<_, TicketCancellationContext>(
        r#"
        SELECT
            t.status as ticket_status,
            t.ticket_type,
            t.seat_id,
            e.id as event_id,
            e.event_date,
            e.refund_policy,
            e.ticket_price,
            e.vip_price,
            o.razorpay_payment_id
        FROM tickets t
        JOIN events e ON e.id = t.event_id
        JOIN orders o ON o.id = t.order_id
        WHERE t.id = $1 AND t.user_id = $2
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Ticket not found".to_string()))?;

    if ctx.ticket_status != "active" && ctx.ticket_status != "valid" {
        return Ok(Json(CancellationPreview {
            ticket_id: id,
            can_cancel: false,
            refundable: false,
            refund_amount: Decimal::ZERO,
            refund_status_after_cancel: "none".to_string(),
            reason: format!("Ticket is already {}", ctx.ticket_status),
        }));
    }

    let (refundable, refund_amount, refund_status_after_cancel, reason) = compute_cancellation_decision(&ctx);

    Ok(Json(CancellationPreview {
        ticket_id: id,
        can_cancel: true,
        refundable,
        refund_amount,
        refund_status_after_cancel,
        reason,
    }))
}

/// POST /api/tickets/:id/cancel — cancel ticket and trigger refund if eligible
pub async fn cancel_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CancellationResult>, AppError> {
    let mut tx = state.db.begin().await?;

    let ctx = sqlx::query_as::<_, TicketCancellationContext>(
        r#"
        SELECT
            t.status as ticket_status,
            t.ticket_type,
            t.seat_id,
            e.id as event_id,
            e.event_date,
            e.refund_policy,
            e.ticket_price,
            e.vip_price,
            o.razorpay_payment_id
        FROM tickets t
        JOIN events e ON e.id = t.event_id
        JOIN orders o ON o.id = t.order_id
        WHERE t.id = $1 AND t.user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Ticket not found".to_string()))?;

    if ctx.ticket_status != "active" && ctx.ticket_status != "valid" {
        return Err(AppError::BadRequest(format!("Ticket is already {}", ctx.ticket_status)));
    }

    let (refundable, refund_amount, initial_refund_status, reason) = compute_cancellation_decision(&ctx);

    sqlx::query("UPDATE tickets SET status = 'cancelled', refund_status = $1 WHERE id = $2")
        .bind(&initial_refund_status)
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if let Some(seat_id) = ctx.seat_id {
        sqlx::query(
            "UPDATE event_seats SET status = 'available', locked_by = NULL, locked_until = NULL WHERE id = $1"
        )
        .bind(seat_id)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        "UPDATE events SET tickets_sold = GREATEST(tickets_sold - 1, 0), updated_at = NOW() WHERE id = $1"
    )
    .bind(ctx.event_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if refundable && refund_amount > Decimal::ZERO {
        let Some(payment_id) = ctx.razorpay_payment_id else {
            sqlx::query("UPDATE tickets SET refund_status = 'none' WHERE id = $1")
                .bind(id)
                .execute(&state.db)
                .await?;

            return Ok(Json(CancellationResult {
                ticket_id: id,
                status: "cancelled".to_string(),
                refund_status: "none".to_string(),
                refund_amount: Decimal::ZERO,
                message: "Ticket cancelled. Refund could not be initiated because payment reference is missing.".to_string(),
            }));
        };

        let amount_paise = (refund_amount * Decimal::from(100_i32))
            .round()
            .to_u64()
            .ok_or_else(|| AppError::Internal("Failed to compute refund amount in paise".to_string()))?;

        let client = Client::new();
        let response = client
            .post(format!("https://api.razorpay.com/v1/payments/{}/refund", payment_id))
            .basic_auth(&state.config.razorpay_key_id, Some(&state.config.razorpay_key_secret))
            .json(&serde_json::json!({
                "amount": amount_paise,
                "notes": {
                    "ticket_id": id.to_string(),
                    "policy": "ticket_cancellation"
                }
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to reach Razorpay for refund: {}", e)))?;

        if !response.status().is_success() {
            let err_text = response.text().await.unwrap_or_default();

            return Ok(Json(CancellationResult {
                ticket_id: id,
                status: "cancelled".to_string(),
                refund_status: "pending".to_string(),
                refund_amount,
                message: format!("Ticket cancelled. Refund is pending because Razorpay refund failed: {}", err_text),
            }));
        }

        if response
            .json::<serde_json::Value>()
            .await
            .is_err()
        {
            return Ok(Json(CancellationResult {
                ticket_id: id,
                status: "cancelled".to_string(),
                refund_status: "pending".to_string(),
                refund_amount,
                message: "Ticket cancelled. Refund request submitted but confirmation parsing failed; current status is pending.".to_string(),
            }));
        }

        sqlx::query("UPDATE tickets SET refund_status = 'refunded' WHERE id = $1")
            .bind(id)
            .execute(&state.db)
            .await?;

        return Ok(Json(CancellationResult {
            ticket_id: id,
            status: "cancelled".to_string(),
            refund_status: "refunded".to_string(),
            refund_amount,
            message: "Ticket cancelled and refund processed (excluding convenience fee).".to_string(),
        }));
    }

    Ok(Json(CancellationResult {
        ticket_id: id,
        status: "cancelled".to_string(),
        refund_status: initial_refund_status,
        refund_amount,
        message: reason,
    }))
}

/// GET /api/tickets/:id/refund-status — fetch latest refund status from Razorpay
pub async fn sync_refund_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CancellationResult>, AppError> {
    let row = sqlx::query_as::<_, (String, String, Option<String>)>(
        r#"
        SELECT t.status, t.refund_status, o.razorpay_payment_id
        FROM tickets t
        JOIN orders o ON o.id = t.order_id
        WHERE t.id = $1 AND t.user_id = $2
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Ticket not found".to_string()))?;

    let ticket_status = row.0;
    let current_refund_status = row.1;
    let razorpay_payment_id = row.2;

    if ticket_status != "cancelled" {
        return Ok(Json(CancellationResult {
            ticket_id: id,
            status: ticket_status,
            refund_status: current_refund_status,
            refund_amount: Decimal::ZERO,
            message: "Refund status is available only for cancelled tickets.".to_string(),
        }));
    }

    let Some(payment_id) = razorpay_payment_id else {
        return Ok(Json(CancellationResult {
            ticket_id: id,
            status: "cancelled".to_string(),
            refund_status: current_refund_status,
            refund_amount: Decimal::ZERO,
            message: "No payment reference found for this ticket.".to_string(),
        }));
    };

    let client = Client::new();
    let response = client
        .get(format!("https://api.razorpay.com/v1/payments/{}/refunds", payment_id))
        .basic_auth(&state.config.razorpay_key_id, Some(&state.config.razorpay_key_secret))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to reach Razorpay: {}", e)))?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        return Ok(Json(CancellationResult {
            ticket_id: id,
            status: "cancelled".to_string(),
            refund_status: current_refund_status,
            refund_amount: Decimal::ZERO,
            message: format!("Could not fetch refund status from gateway: {}", err_text),
        }));
    }

    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse Razorpay response: {}", e)))?;

    let gateway_status = body
        .get("items")
        .and_then(|v| v.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("status"))
        .and_then(|v| v.as_str());

    let mapped_status = match gateway_status {
        Some("processed") => "refunded",
        Some("pending") => "pending",
        Some(_) => "pending",
        None => current_refund_status.as_str(),
    };

    sqlx::query("UPDATE tickets SET refund_status = $1 WHERE id = $2")
        .bind(mapped_status)
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(CancellationResult {
        ticket_id: id,
        status: "cancelled".to_string(),
        refund_status: mapped_status.to_string(),
        refund_amount: Decimal::ZERO,
        message: format!("Refund status synced: {}", mapped_status),
    }))
}
