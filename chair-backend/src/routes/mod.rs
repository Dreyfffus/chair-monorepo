use axum::{
    routing::{get, post, put},
    Router,
};

use crate::state::AppState;

mod machine;
mod preset;
mod session;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .route("/machines/provision", post(machine::provision))
        .route("/presets", get(preset::list_presets))
        .route("/presets", post(preset::create_preset))
        .route("/presets/:name", get(preset::get_preset))
        .route("/presets/:name", put(preset::update_preset))
        .route("/presets/:name/load", post(preset::load_preset))
        .route("/sessions", post(session::record_session))
}
