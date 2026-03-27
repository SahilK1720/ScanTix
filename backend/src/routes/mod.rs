use axum::{
    middleware,
    routing::{delete, get, patch, post, put},
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
        .route("/api/events/:id/seats", get(handlers::seats::get_event_seats))
        // Scanner endpoints (public — no auth middleware)
        .route(
            "/api/organizer/events/:eventId/staff/scanner/:accessToken",
            get(handlers::staff::scanner_info),
        )
        .route(
            "/api/organizer/events/:eventId/staff/scanner/:accessToken/scan",
            post(handlers::staff::scanner_scan),
        )
        // Public scanner lookup by token only (no eventId in path)
        .route(
            "/api/scanner/:accessToken",
            get(handlers::staff::public_scanner_info),
        );

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/api/auth/me", get(handlers::auth::me))
        .route("/api/events", post(handlers::events::create_event))
        .route("/api/events/my", get(handlers::events::my_events))
        .route("/api/events/:id/stats", get(handlers::events::get_event_stats))
        .route("/api/events/:id", put(handlers::events::update_event))
        .route("/api/events/:id", delete(handlers::events::delete_event))
        .route("/api/events/:id/cancel", post(handlers::events::cancel_event))
        .route("/api/events/:id/hold", post(handlers::tickets::hold_tickets))
        .route("/api/events/:id/hold/:hold_id", delete(handlers::tickets::release_hold))
        .route("/api/events/:id/images", post(handlers::events::upload_event_images))
        // Seat map management (organizer)
        .route("/api/events/:id/seats/generate", post(handlers::seats::generate_event_seats))
        .route("/api/events/:event_id/seats/:seat_id/lock", post(handlers::seats::lock_seat))
        .route("/api/events/:event_id/seats/:seat_id/lock", delete(handlers::seats::unlock_seat))
        .route("/api/events/:id/seats/lock-batch", post(handlers::seats::lock_seats_batch))
        .route("/api/events/:id/seats/unlock-batch", post(handlers::seats::unlock_seats_batch))
        // Tickets
        .route("/api/validate", post(handlers::validation::validate_ticket))
        // Venues
        .route("/api/venues", post(handlers::venues::create_venue))
        // Tickets
        .route("/api/tickets/my", get(handlers::tickets::my_tickets))
        .route("/api/tickets/:id/qr", get(handlers::tickets::get_ticket_qr))
        .route("/api/tickets/:id/cancellation-preview", get(handlers::tickets::preview_ticket_cancellation))
        .route("/api/tickets/:id/cancel", post(handlers::tickets::cancel_ticket))
            .route("/api/tickets/:id/refund-status", get(handlers::tickets::sync_refund_status))
        .route("/api/analytics/sales/:event_id", get(handlers::analytics::sales_stream))
        // Staff management (organizer, JWT-protected)
        .route(
            "/api/organizer/events/:eventId/staff",
            get(handlers::staff::list_staff).post(handlers::staff::add_staff),
        )
        .route(
            "/api/organizer/events/:eventId/staff/:staffId/scans",
            get(handlers::staff::list_scanned_attendees),
        )
        .route(
            "/api/organizer/events/:eventId/staff/:staffId",
            delete(handlers::staff::delete_staff),
        )
        .route(
            "/api/organizer/events/:eventId/staff/:staffId/revoke",
            patch(handlers::staff::revoke_staff),
        )
        .route(
            "/api/organizer/events/:eventId/staff/:staffId/restore",
            patch(handlers::staff::restore_staff),
        )
        // Razorpay Payment
        .route("/api/payment/create-order", post(handlers::payment::create_razorpay_order))
        .route("/api/payment/verify", post(handlers::payment::verify_and_book))
        // Bank details
        .route("/api/organizer/bank-details",
            get(handlers::bank_details::get_bank_details)
            .post(handlers::bank_details::create_bank_details)
            .put(handlers::bank_details::update_bank_details)
        )
        // Event cancellation queries
        .route("/api/organizer/events/:id/cancellation", get(handlers::events::get_event_cancellation))
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
