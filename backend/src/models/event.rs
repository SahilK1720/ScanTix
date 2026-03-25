use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub venue_id: Option<Uuid>,
    pub organizer_id: Uuid,
    pub event_date: DateTime<Utc>,
    pub gate_open_time: Option<DateTime<Utc>>,
    pub event_end_time: Option<DateTime<Utc>>,
    pub ticket_price: Decimal,
    pub vip_price: Option<Decimal>,
    pub max_tickets: i32,
    pub tickets_sold: i32,
    pub status: String,
    pub seat_map_enabled: bool,
    pub seat_rows: Option<i32>,
    pub seat_columns: Option<i32>,
    pub seat_layout: String,
    pub image_urls: Vec<String>,
    pub google_maps_url: Option<String>,
    pub refund_policy: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEvent {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub venue_id: Option<Uuid>,
    pub event_date: DateTime<Utc>,
    pub gate_open_time: Option<DateTime<Utc>>,
    pub event_end_time: Option<DateTime<Utc>>,
    pub ticket_price: Decimal,
    pub vip_price: Option<Decimal>,
    pub max_tickets: i32,
    pub seat_map_enabled: Option<bool>,
    pub seat_rows: Option<i32>,
    pub seat_columns: Option<i32>,
    pub seat_layout: Option<String>,
    pub image_urls: Option<Vec<String>>,
    pub google_maps_url: Option<String>,
    pub refund_policy: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEvent {
    pub title: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub event_date: Option<DateTime<Utc>>,
    pub gate_open_time: Option<DateTime<Utc>>,
    pub event_end_time: Option<DateTime<Utc>>,
    pub ticket_price: Option<Decimal>,
    pub vip_price: Option<Decimal>,
    pub max_tickets: Option<i32>,
    pub status: Option<String>,
    pub seat_map_enabled: Option<bool>,
    pub seat_rows: Option<i32>,
    pub seat_columns: Option<i32>,
    pub seat_layout: Option<String>,
    pub image_urls: Option<Vec<String>>,
    pub google_maps_url: Option<String>,
    pub refund_policy: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EventStats {
    pub event_id: Uuid,
    pub title: String,
    pub tickets_sold: i32,
    pub max_tickets: i32,
    pub remaining: i32,
    pub revenue: Decimal,
    pub occupancy_pct: f64,
    pub gross_sales: Decimal,
    pub platform_commission: Decimal,
    pub gateway_charges: Decimal,
    pub net_earnings: Decimal,
    pub avg_per_ticket: Decimal,
    pub potential_revenue: Decimal,
    pub vip_revenue: Decimal,
    pub regular_revenue: Decimal,
    pub vip_sold: i32,
    pub vip_remaining: i32,
    pub regular_sold: i32,
    pub regular_remaining: i32,
}
