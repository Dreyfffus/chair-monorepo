use crate::state::AppState;
use axum::routing::{get, post, put};
use axum::Router;

mod machine;
mod preset;
mod serial;
mod session;
mod stats;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .route("/machines/provision", post(machine::provision))
        .route("/presets", get(preset::list_presets))
        .route("/presets", post(preset::create_preset))
        .route("/presets/:name", get(preset::get_preset))
        .route("/presets/:name", put(preset::update_preset))
        .route("/presets/:name/load", post(preset::load_preset))
        .route("/sessions", post(session::record_session))
        .route("/stats", get(stats::get_stats))
        .route("/serial/status", get(serial::status))
        .route("/serial/adjust", post(serial::adjust))
        .route("/serial/session/start", post(serial::session_start))
        .route("/serial/session/end", post(serial::session_end))
}
