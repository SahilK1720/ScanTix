use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventStaff {
    pub id: Uuid,
    pub event_id: Uuid,
    pub organizer_id: Uuid,
    pub name: String,
    pub email: String,
    pub phone_number: String,
    pub access_token: Uuid,
    pub is_active: bool,
    pub is_revoked: bool,
    pub tickets_scanned: i32,
    pub last_active_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScannedTicket {
    pub id: Uuid,
    pub staff_id: Uuid,
    pub ticket_id: Uuid,
    pub event_id: Uuid,
    pub scanned_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScannedAttendee {
    pub ticket_id: Uuid,
    pub attendee_name: String,
    pub attendee_email: String,
    pub ticket_type: String,
    pub scanned_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ScannedAttendeesResponse {
    pub staff_name: String,
    pub attendees: Vec<ScannedAttendee>,
}

#[derive(Debug, Deserialize)]
pub struct AddStaffRequest {
    pub name: String,
    pub email: String,
    pub phone_number: String,
}

#[derive(Debug, Serialize)]
pub struct ScannerInfoResponse {
    pub event_id: Uuid,
    pub event_name: String,
    pub event_date: DateTime<Utc>,
    pub gate_open_time: Option<DateTime<Utc>>,
    pub event_end_time: Option<DateTime<Utc>>,
    pub daily_scan_count: i64,
    pub staff_name: String,
}

#[derive(Debug, Deserialize)]
pub struct ScanRequest {
    pub qr_data: String,
}

#[derive(Debug, Serialize)]
pub struct ScanResponse {
    pub status: String,   // VALID_TICKET | TICKET_ALREADY_SCANNED | INVALID_TICKET
    pub message: String,
    pub attendee_name: Option<String>,
}
