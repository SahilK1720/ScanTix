use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::event::Event;
use crate::models::seat::{EventSeat, LockSeatResponse};
use crate::utils::jwt::Claims;
use crate::AppState;

// ── helpers ─────────────────────────────────────────────────────────────────

fn row_label(index: i32) -> String {
    // 0 → "A", 1 → "B", …, 25 → "Z", 26 → "AA", …
    let mut n = index;
    let mut label = String::new();
    loop {
        let c = (b'A' + (n % 26) as u8) as char;
        label.insert(0, c);
        n = n / 26 - 1;
        if n < 0 {
            break;
        }
    }
    label
}

// ── handlers ─────────────────────────────────────────────────────────────────

/// GET /api/events/:id/seats — public: return all seats with status
pub async fn get_event_seats(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<EventSeat>>, AppError> {
    // verify event exists
    let _event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(event_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    let seats = sqlx::query_as::<_, EventSeat>(
        "SELECT * FROM event_seats WHERE event_id = $1
         ORDER BY row_label ASC, seat_number ASC",
    )
    .bind(event_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(seats))
}

/// POST /api/events/:id/seats/generate — organizer: create seats for this event
pub async fn generate_event_seats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<EventSeat>>, AppError> {
    let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
        .bind(event_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".to_string()))?;

    if event.organizer_id != claims.sub && claims.role != "admin" {
        return Err(AppError::Forbidden(
            "Only the event organizer can generate seats".to_string(),
        ));
    }

    if !event.seat_map_enabled {
        return Err(AppError::BadRequest(
            "Seat map is not enabled for this event".to_string(),
        ));
    }

    let rows = event
        .seat_rows
        .ok_or_else(|| AppError::BadRequest("seat_rows not configured".to_string()))?;
    let cols = event
        .seat_columns
        .ok_or_else(|| AppError::BadRequest("seat_columns not configured".to_string()))?;

    if rows <= 0 || rows > 500 {
        return Err(AppError::BadRequest(
            "seat_rows must be between 1 and 500".to_string(),
        ));
    }
    if cols <= 0 || cols > 100 {
        return Err(AppError::BadRequest(
            "seat_columns must be between 1 and 100".to_string(),
        ));
    }

    // Idempotent: delete existing available seats and regenerate
    let existing = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM event_seats WHERE event_id = $1",
    )
    .bind(event_id)
    .fetch_one(&state.db)
    .await?;

    if existing > 0 {
        return Err(AppError::BadRequest(
            "Seats have already been generated for this event".to_string(),
        ));
    }

    let mut seats = Vec::new();
    for r in 0..rows {
        let row = row_label(r);
        for col in 1..=cols {
            let seat = sqlx::query_as::<_, EventSeat>(
                r#"INSERT INTO event_seats (event_id, row_label, seat_number)
                   VALUES ($1, $2, $3) RETURNING *"#,
            )
            .bind(event_id)
            .bind(&row)
            .bind(col)
            .fetch_one(&state.db)
            .await?;
            seats.push(seat);
        }
    }

    Ok(Json(seats))
}

/// POST /api/events/:id/seats/:seat_id/lock — lock a specific seat for 10 minutes
pub async fn lock_seat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((event_id, seat_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<LockSeatResponse>, AppError> {
    let lock_duration = chrono::Duration::minutes(10);
    let locked_until = Utc::now() + lock_duration;

    // Atomic: only update if currently 'available'
    // Uses optimistic locking — single UPDATE; 0 rows = already taken
    let updated = sqlx::query_as::<_, EventSeat>(
        r#"UPDATE event_seats
           SET status = 'locked',
               locked_by = $1,
               locked_until = $2
           WHERE id = $3
             AND event_id = $4
             AND status = 'available'
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(locked_until)
    .bind(seat_id)
    .bind(event_id)
    .fetch_optional(&state.db)
    .await?;

    match updated {
        Some(seat) => Ok(Json(LockSeatResponse {
            locked_until: seat.locked_until.unwrap_or(locked_until),
            seat,
        })),
        None => {
            // Check if seat exists at all
            let exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM event_seats WHERE id = $1 AND event_id = $2)",
            )
            .bind(seat_id)
            .bind(event_id)
            .fetch_one(&state.db)
            .await?;

            if exists {
                Err(AppError::Conflict(
                    "Seat is already locked or booked".to_string(),
                ))
            } else {
                Err(AppError::NotFound("Seat not found".to_string()))
            }
        }
    }
}

/// DELETE /api/events/:id/seats/:seat_id/lock — release a seat the caller holds
pub async fn unlock_seat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((event_id, seat_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<EventSeat>, AppError> {
    let updated = sqlx::query_as::<_, EventSeat>(
        r#"UPDATE event_seats
           SET status = 'available',
               locked_by = NULL,
               locked_until = NULL
           WHERE id = $1
             AND event_id = $2
             AND locked_by = $3
             AND status = 'locked'
           RETURNING *"#,
    )
    .bind(seat_id)
    .bind(event_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?;

    updated.map(Json).ok_or_else(|| {
        AppError::BadRequest("Seat not found or not locked by you".to_string())
    })
}
