use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};

use crate::handlers;
use crate::middleware::{auth::auth_middleware, rate_limit::rate_limit_middleware};
use crate::AppState;

pub fn create_router(state: AppState) -> Router {
    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/events", get(handlers::events::list_events))
        .route("/api/events/:id", get(handlers::events::get_event))
        .route("/api/venues", get(handlers::venues::list_venues))
        .route("/api/venues/:id/seats", get(handlers::venues::get_venue_seats))
        .route("/api/events/:id/seats", get(handlers::seats::get_event_seats));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/api/auth/me", get(handlers::auth::me))
        .route("/api/events", post(handlers::events::create_event))
        .route("/api/events/my", get(handlers::events::my_events))
        .route("/api/events/:id/stats", get(handlers::events::get_event_stats))
        .route("/api/events/:id", put(handlers::events::update_event))
        .route("/api/events/:id", delete(handlers::events::delete_event))
        .route("/api/events/:id/images", post(handlers::events::upload_event_images))
        // Seat map management (organizer)
        .route("/api/events/:id/seats/generate", post(handlers::seats::generate_event_seats))
        .route("/api/events/:event_id/seats/:seat_id/lock", post(handlers::seats::lock_seat))
        .route("/api/events/:event_id/seats/:seat_id/lock", delete(handlers::seats::unlock_seat))
        // Venues
        .route("/api/venues", post(handlers::venues::create_venue))
        // Tickets
        .route("/api/tickets/my", get(handlers::tickets::my_tickets))
        .route("/api/tickets/:id/qr", get(handlers::tickets::get_ticket_qr))
        .route("/api/analytics/sales/:event_id", get(handlers::analytics::sales_stream))
        // Staff
        .route("/api/events/:id/staff/assign", post(handlers::staff::assign_staff))
        .route("/api/staff/events", get(handlers::staff::get_assigned_events))
        .route("/api/staff/validate", post(handlers::staff::validate_ticket))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    // Purchase route (auth + rate limiting)
    let purchase_routes = Router::new()
        .route("/api/tickets/purchase", post(handlers::tickets::purchase_tickets))
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit_middleware))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    // Health check
    let health_route = Router::new()
        .route("/api/health", get(|| async {
            axum::Json(serde_json::json!({
                "status": "healthy",
                "service": "ScanTix API",
                "version": "0.1.0"
            }))
        }));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(purchase_routes)
        .merge(health_route)
        .with_state(state)
}
