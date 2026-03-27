use axum::{
    extract::{Path, State, Multipart},
    Extension, Json,
};
use chrono::Utc;
use reqwest::Client;
use rust_decimal::prelude::ToPrimitive;
use uuid::Uuid;
use std::fs;

use crate::error::AppError;
use crate::models::event::{CreateEvent, Event, EventStats, UpdateEvent};
use crate::utils::jwt::Claims;
use crate::AppState;

/// GET /api/events — list all non-cancelled events
pub async fn list_events(
    State(state): State<AppState>,
) -> Result<Json<Vec<Event>>, AppError> {
    let events = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE status = 'published' AND event_date > CURRENT_TIMESTAMP ORDER BY event_date ASC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(events))
}

/// GET /api/events/:id — get single event
pub async fn get_event(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Event>, AppError> {
    let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    Ok(Json(event))
}

/// GET /api/events/my — list events created by the authenticated organizer
pub async fn my_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Event>>, AppError> {
    let events = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE organizer_id = $1 ORDER BY created_at DESC"
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(events))
}

/// GET /api/events/:id/stats — event analytics (organizer only)
pub async fn get_event_stats(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<EventStats>, AppError> {
    let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    let remaining = event.max_tickets - event.tickets_sold;
    let occupancy_pct = if event.max_tickets > 0 {
        (event.tickets_sold as f64 / event.max_tickets as f64) * 100.0
    } else {
        0.0
    };

    // Calculate revenue from paid/confirmed orders
    let gross_sales: Option<rust_decimal::Decimal> = sqlx::query_scalar(
        "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE event_id = $1 AND (status = 'paid' OR status = 'confirmed')"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;
    let gross_sales = gross_sales.unwrap_or(rust_decimal::Decimal::ZERO);

    // Platform commission is 2% added on top for ScanTix.
    let platform_commission = gross_sales * rust_decimal::Decimal::from_str_exact("0.02").unwrap();
    let gateway_charges = rust_decimal::Decimal::ZERO;
    
    // Net earnings is gross minus platform commission.
    let net_earnings = gross_sales - platform_commission;

    let avg_per_ticket = if event.tickets_sold > 0 {
        gross_sales / rust_decimal::Decimal::from(event.tickets_sold)
    } else {
        rust_decimal::Decimal::ZERO
    };

    let potential_revenue = event.ticket_price * rust_decimal::Decimal::from(event.max_tickets);

    // Calculate VIP vs Regular from tickets table instead of orders to handle "mixed" orders
    #[derive(sqlx::FromRow)]
    struct TicketCountRow {
        ticket_type: String,
        count: i64,
    }

    let ticket_counts = sqlx::query_as::<_, TicketCountRow>(
        "SELECT ticket_type, COUNT(*) as count FROM tickets WHERE event_id = $1 AND status != 'cancelled' GROUP BY ticket_type"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let mut vip_sold = 0;
    let mut regular_sold = 0;

    for tc in ticket_counts {
        let t_type = tc.ticket_type.to_lowercase();
        let count = tc.count;
        if t_type == "vip" {
            vip_sold += count;
        } else if t_type == "standard" || t_type == "regular" {
            regular_sold += count;
        }
    }

    let vip_revenue = event.vip_price.unwrap_or(rust_decimal::Decimal::ZERO) * rust_decimal::Decimal::from(vip_sold);
    let regular_revenue = event.ticket_price * rust_decimal::Decimal::from(regular_sold);

    let mut vip_remaining;
    let mut regular_remaining;

    if event.seat_map_enabled {
        #[derive(sqlx::FromRow)]
        struct AvailableSeatRow {
            row_label: String,
            count: i64,
        }

        let available_seats = sqlx::query_as::<_, AvailableSeatRow>(
            "SELECT row_label, COUNT(*) as count FROM event_seats WHERE event_id = $1 AND status = 'available' GROUP BY row_label"
        )
        .bind(id)
        .fetch_all(&state.db)
        .await?;

        vip_remaining = 0;
        regular_remaining = 0;

        for stat in available_seats {
            let count = stat.count as i32;
            if stat.row_label == "A" || stat.row_label == "B" {
                vip_remaining += count;
            } else {
                regular_remaining += count;
            }
        }
    } else {
        // For general admission events, VIP and Regular pool is technically shared from `remaining`.
        vip_remaining = remaining;
        regular_remaining = remaining;
    }

    Ok(Json(EventStats {
        event_id: event.id,
        title: event.title,
        seat_map_enabled: event.seat_map_enabled,
        tickets_sold: event.tickets_sold,
        max_tickets: event.max_tickets,
        remaining,
        revenue: gross_sales,
        occupancy_pct,
        gross_sales,
        platform_commission,
        gateway_charges: rust_decimal::Decimal::ZERO,
        net_earnings: gross_sales - platform_commission,
        avg_per_ticket,
        potential_revenue,
        vip_revenue,
        regular_revenue,
        vip_sold: vip_sold as i32,
        vip_remaining,
        regular_sold: regular_sold as i32,
        regular_remaining,
    }))
}

/// POST /api/events — create new event (organizer)
pub async fn create_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateEvent>,
) -> Result<Json<Event>, AppError> {
    if input.title.is_empty() {
        return Err(AppError::BadRequest("Title is required".to_string()));
    }
    if input.max_tickets <= 0 {
        return Err(AppError::BadRequest("max_tickets must be positive".to_string()));
    }
    if input.refund_policy != "REFUNDABLE" && input.refund_policy != "NON_REFUNDABLE" {
        return Err(AppError::BadRequest("refund_policy must be REFUNDABLE or NON_REFUNDABLE".to_string()));
    }

    // Validate Google Maps URL if provided
    if let Some(ref url) = input.google_maps_url {
        if !url.is_empty() && !url.starts_with("http") {
            return Err(AppError::BadRequest("google_maps_url must be a valid URL".to_string()));
        }
    }

    // Validate timings
    if let Some(gate_time) = input.gate_open_time {
        if gate_time > input.event_date {
            return Err(AppError::BadRequest("Gate open time must be before or equal to event start time".to_string()));
        }
    }
    if let Some(end_time) = input.event_end_time {
        if end_time <= input.event_date {
            return Err(AppError::BadRequest("Event end time must be after event start time".to_string()));
        }
    }

    let seat_map_enabled = input.seat_map_enabled.unwrap_or(false);
    if seat_map_enabled {
        let rows = input.seat_rows.unwrap_or(0);
        let cols = input.seat_columns.unwrap_or(0);
        if rows <= 0 || rows > 500 {
            return Err(AppError::BadRequest("seat_rows must be between 1 and 500".to_string()));
        }
        if cols <= 0 || cols > 100 {
            return Err(AppError::BadRequest("seat_columns must be between 1 and 100".to_string()));
        }
    }

    let event = sqlx::query_as::<_, Event>(
        r#"INSERT INTO events (title, description, location, venue_id, organizer_id, event_date,
                               gate_open_time, event_end_time,
                               ticket_price, vip_price, max_tickets, status,
                       seat_map_enabled, seat_rows, seat_columns, seat_layout, image_urls,
                       google_maps_url, refund_policy)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
           RETURNING *"#,
    )
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.location)
    .bind(input.venue_id)
    .bind(claims.sub)
    .bind(input.event_date)
    .bind(input.gate_open_time)
    .bind(input.event_end_time)
    .bind(input.ticket_price)
    .bind(input.vip_price)
    .bind(input.max_tickets)
    .bind(input.status.clone().unwrap_or_else(|| "published".to_string()))
    .bind(seat_map_enabled)
    .bind(input.seat_rows)
    .bind(input.seat_columns)
    .bind(input.seat_layout.unwrap_or_else(|| "grid".to_string()))
    .bind(input.image_urls.unwrap_or_default())
    .bind(&input.google_maps_url)
    .bind(&input.refund_policy)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(event))
}

/// PUT /api/events/:id — update event
pub async fn update_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEvent>,
) -> Result<Json<Event>, AppError> {
    let existing = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    if existing.organizer_id != claims.sub && claims.role != "admin" {
        return Err(AppError::Forbidden("Not authorized to update this event".to_string()));
    }

    // Restrict sensitive fields once tickets have been sold
    if existing.tickets_sold > 0 {
        let restricted = [
            (input.event_date.is_some(), "event_date"),
            (input.gate_open_time.is_some(), "gate_open_time"),
            (input.event_end_time.is_some(), "event_end_time"),
            (input.location.is_some(), "location"),
            (input.ticket_price.is_some(), "ticket_price"),
            (input.vip_price.is_some(), "vip_price"),
        ];
        for (is_set, field_name) in restricted {
            if is_set {
                return Err(AppError::BadRequest(
                    format!("{} cannot be changed after tickets have been sold", field_name)
                ));
            }
        }
        if let Some(new_max) = input.max_tickets {
            if new_max < existing.tickets_sold {
                return Err(AppError::BadRequest(
                    format!("max_tickets cannot be reduced below tickets already sold ({})", existing.tickets_sold)
                ));
            }
        }
    }

    if let Some(policy) = input.refund_policy.as_deref() {
        if policy != "REFUNDABLE" && policy != "NON_REFUNDABLE" {
            return Err(AppError::BadRequest("refund_policy must be REFUNDABLE or NON_REFUNDABLE".to_string()));
        }
    }

    let event = sqlx::query_as::<_, Event>(
        r#"UPDATE events SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            location = COALESCE($3, location),
            event_date = COALESCE($4, event_date),
            gate_open_time = COALESCE($5, gate_open_time),
            event_end_time = COALESCE($6, event_end_time),
            ticket_price = COALESCE($7, ticket_price),
            vip_price = COALESCE($8, vip_price),
            max_tickets = COALESCE($9, max_tickets),
            status = COALESCE($10, status),
            seat_map_enabled = COALESCE($12, seat_map_enabled),
            seat_rows = COALESCE($13, seat_rows),
            seat_columns = COALESCE($14, seat_columns),
            seat_layout = COALESCE($15, seat_layout),
            image_urls = COALESCE($16, image_urls),
            google_maps_url = COALESCE($17, google_maps_url),
            refund_policy = COALESCE($18, refund_policy),
            updated_at = NOW()
           WHERE id = $11 RETURNING *"#
    )
    .bind(input.title)
    .bind(input.description)
    .bind(input.location)
    .bind(input.event_date)
    .bind(input.gate_open_time)
    .bind(input.event_end_time)
    .bind(input.ticket_price)
    .bind(input.vip_price)
    .bind(input.max_tickets)
    .bind(input.status)
    .bind(id)
    .bind(input.seat_map_enabled)
    .bind(input.seat_rows)
    .bind(input.seat_columns)
    .bind(input.seat_layout)
    .bind(input.image_urls)
    .bind(input.google_maps_url)
    .bind(input.refund_policy)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(event))
}

/// DELETE /api/events/:id — simple cancel (legacy, kept for compatibility)
pub async fn delete_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let existing = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    if existing.organizer_id != claims.sub && claims.role != "admin" {
        return Err(AppError::Forbidden("Not authorized to delete this event".to_string()));
    }

    sqlx::query("UPDATE events SET status = 'cancelled' WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Event cancelled successfully" })))
}

/// POST /api/events/:id/cancel — cancel event with full refund + penalty logic
pub async fn cancel_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let existing = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    if existing.organizer_id != claims.sub && claims.role != "admin" {
        return Err(AppError::Forbidden("Not authorized to cancel this event".to_string()));
    }
    if existing.status == "cancelled" {
        return Err(AppError::BadRequest("Event is already cancelled".to_string()));
    }

    let reason = body.get("reason").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // ── Case A: No tickets sold ──────────────────────────────────────────────
    if existing.tickets_sold == 0 {
        sqlx::query(
            "UPDATE events SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2 WHERE id = $1"
        )
        .bind(id)
        .bind(&reason)
        .execute(&state.db)
        .await?;

        return Ok(Json(serde_json::json!({
            "message": "Event cancelled successfully",
            "tickets_refunded": 0,
            "cancellation_fee": 0,
        })));
    }

    // ── Case B: Tickets sold — full refund + 15% penalty ─────────────────────
    // Calculate total revenue from paid/confirmed orders
    let total_revenue: Option<rust_decimal::Decimal> = sqlx::query_scalar(
        "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE event_id = $1 AND (status = 'paid' OR status = 'confirmed')"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;
    let total_revenue = total_revenue.unwrap_or(rust_decimal::Decimal::ZERO);
    let cancellation_fee = total_revenue * rust_decimal::Decimal::from_str_exact("0.15").unwrap();

    let mut tx = state.db.begin().await?;

    // Mark event cancelled
    sqlx::query(
        "UPDATE events SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2 WHERE id = $1"
    )
    .bind(id)
    .bind(&reason)
    .execute(&mut *tx)
    .await?;

    // Record cancellation with fee
    sqlx::query(
        r#"INSERT INTO event_cancellations
           (event_id, organizer_id, tickets_sold, total_revenue, cancellation_fee, reason)
           VALUES ($1, $2, $3, $4, $5, $6)"#
    )
    .bind(id)
    .bind(existing.organizer_id)
    .bind(existing.tickets_sold)
    .bind(total_revenue)
    .bind(cancellation_fee)
    .bind(&reason)
    .execute(&mut *tx)
    .await?;

    // Fetch all active/valid tickets with their payment_id
    #[derive(sqlx::FromRow)]
    struct TicketRefundInfo {
        ticket_id: Uuid,
        user_id: Uuid,
        refund_amount: rust_decimal::Decimal,
        razorpay_payment_id: Option<String>,
    }

    let tickets_to_refund = sqlx::query_as::<_, TicketRefundInfo>(
        r#"SELECT 
               t.id as ticket_id, t.user_id, o.razorpay_payment_id,
               CASE 
                   WHEN t.ticket_type = 'vip' THEN COALESCE(e.vip_price, e.ticket_price)
                   ELSE e.ticket_price 
               END as refund_amount
           FROM tickets t
           JOIN orders o ON o.id = t.order_id
           JOIN events e ON e.id = t.event_id
           WHERE t.event_id = $1 AND t.status IN ('active', 'valid')"#
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    let refund_count = tickets_to_refund.len();

    // Create ticket_refunds records and mark tickets cancelled
    for t in &tickets_to_refund {
        sqlx::query(
            r#"INSERT INTO ticket_refunds
               (ticket_id, attendee_id, event_id, payment_id, refund_amount, refund_status)
               VALUES ($1, $2, $3, $4, $5, 'pending')"#
        )
        .bind(t.ticket_id)
        .bind(t.user_id)
        .bind(id)
        .bind(&t.razorpay_payment_id)
        .bind(t.refund_amount)
        .execute(&mut *tx)
        .await?;

        sqlx::query("UPDATE tickets SET status = 'cancelled', refund_status = 'pending', cancellation_type = 'organizer' WHERE id = $1")
            .bind(t.ticket_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    // ── Fire Razorpay refunds asynchronously ─────────────────────────────────
    let db_clone = state.db.clone();
    let razorpay_key_id = state.config.razorpay_key_id.clone();
    let razorpay_key_secret = state.config.razorpay_key_secret.clone();

    tokio::spawn(async move {
        let client = Client::new();
        #[derive(sqlx::FromRow)]
        struct RefundRow {
            id: Uuid,
            payment_id: Option<String>,
            refund_amount: rust_decimal::Decimal,
        }
        let refund_rows = sqlx::query_as::<_, RefundRow>(
            "SELECT id, payment_id, refund_amount FROM ticket_refunds WHERE event_id = $1 AND refund_status = 'pending'"
        )
        .bind(id)
        .fetch_all(&db_clone)
        .await
        .unwrap_or_default();

        for row in refund_rows {
            if let Some(ref payment_id) = row.payment_id {
                let amount_paise = (row.refund_amount * rust_decimal::Decimal::from(100_i32))
                    .round().to_u64().unwrap_or(0);
                let res = client
                    .post(format!("https://api.razorpay.com/v1/payments/{}/refund", payment_id))
                    .basic_auth(&razorpay_key_id, Some(&razorpay_key_secret))
                    .json(&serde_json::json!({ "amount": amount_paise }))
                    .send()
                    .await;

                let new_status = match res {
                    Ok(r) if r.status().is_success() => "completed",
                    _ => "failed",
                };
                let _ = sqlx::query(
                    "UPDATE ticket_refunds SET refund_status = $1, completed_at = NOW() WHERE id = $2"
                )
                .bind(new_status)
                .bind(row.id)
                .execute(&db_clone)
                .await;
            }
        }
    });

    Ok(Json(serde_json::json!({
        "message": "Event cancelled. Refunds are being processed.",
        "tickets_refunded": refund_count,
        "total_revenue": total_revenue.to_string(),
        "cancellation_fee": cancellation_fee.to_string(),
    })))
}

/// POST /api/events/:id/images — upload images for an event
pub async fn upload_event_images(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<Event>, AppError> {
    
    // Check event ownership
    let existing = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    if existing.organizer_id != claims.sub && claims.role != "admin" {
        return Err(AppError::Forbidden("Not authorized to modify this event".to_string()));
    }

    let mut new_urls = Vec::new();
    let mut current_urls = existing.image_urls.clone();

    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::BadRequest(e.to_string()))? {
        if current_urls.len() + new_urls.len() >= 5 {
            break; // Stop accepting files if max 5 is reached
        }
        
        let file_name = if let Some(name) = field.file_name() {
            name.to_string()
        } else {
            continue;
        };

        if !file_name.is_empty() {
             let ext = std::path::Path::new(&file_name).extension().and_then(|e| e.to_str()).unwrap_or("png");
             let final_name = format!("{}.{}", Uuid::new_v4(), ext);
             let full_path = format!("uploads/{}", final_name);
             
             let data = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?;
             
             fs::write(&full_path, data).map_err(|e| AppError::InternalError(e.to_string()))?;
             
             // Construct URL
             new_urls.push(format!("/uploads/{}", final_name));
        }
    }

    current_urls.extend(new_urls);

    let event = sqlx::query_as::<_, Event>(
        "UPDATE events SET image_urls = $1, updated_at = NOW() WHERE id = $2 RETURNING *"
    )
    .bind(current_urls)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(event))
}

/// GET /api/organizer/events/:id/cancellation — get cancellation record
pub async fn get_event_cancellation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    #[derive(sqlx::FromRow, serde::Serialize)]
    struct CancellationRecord {
        id: Uuid,
        event_id: Uuid,
        organizer_id: Uuid,
        tickets_sold: i32,
        total_revenue: rust_decimal::Decimal,
        cancellation_fee: rust_decimal::Decimal,
        fee_status: String,
        reason: Option<String>,
        created_at: chrono::DateTime<Utc>,
    }

    let record = sqlx::query_as::<_, CancellationRecord>(
        "SELECT * FROM event_cancellations WHERE event_id = $1 AND organizer_id = $2"
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?;

    match record {
        Some(r) => Ok(Json(serde_json::to_value(r).unwrap())),
        None => Ok(Json(serde_json::json!(null))),
    }
}
