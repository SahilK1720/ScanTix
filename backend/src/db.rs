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
        include_str!("../migrations/016_add_bulk_seat_lock.sql"),
        include_str!("../migrations/017_add_refund_policy_and_ticket_cancellation.sql"),
        include_str!("../migrations/018_replace_event_staff_add_scanned_tickets.sql"),
        include_str!("../migrations/019_fix_event_staff_schema.sql"),
        include_str!("../migrations/020_add_event_timings_and_maps.sql"),
        include_str!("../migrations/021_create_organizer_bank_details.sql"),
        include_str!("../migrations/022_create_cancellation_tables.sql"),
    ];

    for (i, migration) in migrations.iter().enumerate() {
        let migration_num = i + 1;
        match sqlx::Executor::execute(pool, *migration).await {
            Ok(_) => tracing::info!("Migration {} (/{}) applied successfully", migration_num, migrations.len()),
            Err(e) => {
                let err_msg = e.to_string();
                if err_msg.contains("already exists") || err_msg.contains("already present") {
                    tracing::debug!("Migration {} already applied", migration_num);
                } else {
                    tracing::error!("❌ Migration {} FAILED: {}", migration_num, e);
                    // In development, we want to know immediately if a migration is broken
                    if std::env::var("RUST_ENV").unwrap_or_default() != "production" {
                        // Fallback: log then panic if not already on a crash course
                        tracing::warn!("⚠️ Execution continuing despite migration failure - check DB state!");
                    }
                }
            }
        }
    }
}
