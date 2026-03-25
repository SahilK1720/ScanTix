use axum::{extract::State, Json};
use chrono::Utc;

use crate::error::AppError;
use crate::models::ticket::{Ticket, ValidateRequest, ValidateResponse};
use crate::utils::qr;
use crate::AppState;

/// POST /api/validate — scan QR code and validate ticket
pub async fn validate_ticket(
    State(state): State<AppState>,
    Json(input): Json<ValidateRequest>,
) -> Result<Json<ValidateResponse>, AppError> {
    // Verify QR signature
    let parsed = qr::verify_qr_payload(&input.qr_data, &state.config.jwt_secret);

    let (ticket_id, _event_id, _user_id) = match parsed {
        Some(ids) => ids,
        None => {
            return Ok(Json(ValidateResponse {
                valid: false,
                message: "Invalid or tampered QR code".to_string(),
                ticket_id: None,
                event_title: None,
                attendee_name: None,
            }));
        }
    };

    // Look up ticket in database and compute dynamic expiration status
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        SELECT 
            t.id, t.order_id, t.event_id, t.seat_id, t.user_id, t.qr_code_data, t.ticket_type,
            CASE WHEN t.status IN ('active', 'valid') AND e.event_end_time < NOW() THEN 'expired' ELSE t.status END as status,
            t.refund_status, t.scanned_at, t.created_at
        FROM tickets t
        LEFT JOIN events e ON t.event_id = e.id
        WHERE t.id = $1
        "#
    )
    .bind(ticket_id)
    .fetch_optional(&state.db)
    .await?;

    let ticket = match ticket {
        Some(t) => t,
        None => {
            return Ok(Json(ValidateResponse {
                valid: false,
                message: "Ticket not found in system".to_string(),
                ticket_id: None,
                event_title: None,
                attendee_name: None,
            }));
        }
    };

    // Check ticket status
    match ticket.status.as_str() {
        "used" => {
            return Ok(Json(ValidateResponse {
                valid: false,
                message: format!("Ticket already used at {:?}", ticket.scanned_at),
                ticket_id: Some(ticket.id),
                event_title: None,
                attendee_name: None,
            }));
        }
        "cancelled" | "revoked" => {
            return Ok(Json(ValidateResponse {
                valid: false,
                message: format!("Ticket has been {}", ticket.status),
                ticket_id: Some(ticket.id),
                event_title: None,
                attendee_name: None,
            }));
        }
        "expired" => {
            return Ok(Json(ValidateResponse {
                valid: false,
                message: "Ticket is expired (event has ended)".to_string(),
                ticket_id: Some(ticket.id),
                event_title: None,
                attendee_name: None,
            }));
        }
        "active" | "valid" => {} // continue
        _ => {
            return Ok(Json(ValidateResponse {
                valid: false,
                message: "Unknown ticket status".to_string(),
                ticket_id: Some(ticket.id),
                event_title: None,
                attendee_name: None,
            }));
        }
    }

    // Mark ticket as used
    sqlx::query("UPDATE tickets SET status = 'used', scanned_at = $1 WHERE id = $2")
        .bind(Utc::now())
        .bind(ticket.id)
        .execute(&state.db)
        .await?;

    // Fetch event title and attendee name for display
    let event_title = sqlx::query_scalar::<_, String>("SELECT title FROM events WHERE id = $1")
        .bind(ticket.event_id)
        .fetch_optional(&state.db)
        .await?;

    let attendee_name = sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
        .bind(ticket.user_id)
        .fetch_optional(&state.db)
        .await?;

    Ok(Json(ValidateResponse {
        valid: true,
        message: "Ticket validated successfully — entry granted!".to_string(),
        ticket_id: Some(ticket.id),
        event_title,
        attendee_name,
    }))
}
