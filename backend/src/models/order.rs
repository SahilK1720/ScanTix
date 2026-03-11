use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Order {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_id: Uuid,
    pub total_amount: Decimal,
    pub quantity: i32,
    pub ticket_type: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}
