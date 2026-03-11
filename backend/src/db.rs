use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub async fn init_pool(database_url: &str) -> PgPool {
    PgPoolOptions::new()
        .max_connections(20)
        .connect(database_url)
        .await
        .expect("Failed to create database pool")
}

pub async fn run_migrations(pool: &PgPool) {
    let migrations = vec![
        include_str!("../migrations/001_create_users.sql"),
        include_str!("../migrations/002_create_venues.sql"),
        include_str!("../migrations/003_create_seats.sql"),
        include_str!("../migrations/004_create_events.sql"),
        include_str!("../migrations/005_create_orders.sql"),
        include_str!("../migrations/006_create_tickets.sql"),
        include_str!("../migrations/007_add_location_to_events.sql"),
        include_str!("../migrations/008_add_seat_layout_to_events.sql"),
        include_str!("../migrations/009_create_event_seats.sql"),
        include_str!("../migrations/010_alter_tickets_fk.sql"),
        include_str!("../migrations/011_create_event_staff.sql"),
        include_str!("../migrations/012_add_image_url_to_events.sql"),
        include_str!("../migrations/013_add_image_urls_array.sql"),
        include_str!("../migrations/014_add_seat_layout.sql"),
        include_str!("../migrations/015_add_ticket_type.sql"),
    ];

    for (i, migration) in migrations.iter().enumerate() {
        match sqlx::Executor::execute(pool, *migration).await {
            Ok(_) => tracing::info!("Migration {} applied successfully", i + 1),
            Err(e) => tracing::warn!("Migration {} (may already exist): {}", i + 1, e),
        }
    }
}
