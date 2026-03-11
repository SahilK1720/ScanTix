use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Ticket {
    pub id: Uuid,
    pub order_id: Uuid,
    pub event_id: Uuid,
    pub seat_id: Option<Uuid>,
    pub user_id: Uuid,
    pub qr_code_data: String,
    pub ticket_type: String,
    pub status: String,
    pub scanned_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct PurchaseRequest {
    pub event_id: Uuid,
    pub quantity: i32,
    pub ticket_type: Option<String>,
    pub seat_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct ValidateRequest {
    pub qr_data: String,
}

#[derive(Debug, Serialize)]
pub struct ValidateResponse {
    pub valid: bool,
    pub message: String,
    pub ticket_id: Option<Uuid>,
    pub event_title: Option<String>,
    pub attendee_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TicketWithQr {
    pub ticket: Ticket,
    pub qr_image_base64: String,
    pub event_title: String,
    pub event_image: Option<String>,
    pub event_date: DateTime<Utc>,
    pub seat_label: Option<String>,
}
