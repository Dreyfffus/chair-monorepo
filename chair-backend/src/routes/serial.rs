// POST /api/serial/adjust   — mid-session setting adjustment, no DB write
// POST /api/serial/session/start — sends SESSION_START to Arduino
// POST /api/serial/session/end   — sends SESSION_END to Arduino (used by cancel)

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;

use crate::{
    models::machine::Machine,
    serial::command::{commands_for_settings, Command},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct AdjustPayload {
    pub chair_angle_degrees: i32,
    pub lumbar_heat: i32,
    pub upper_back_heat: i32,
    pub leg_heat: i32,
    pub light_mode: String,
    pub light_color: Option<String>,
}

/// Send updated settings mid-session without touching the database.
pub async fn adjust(
    _machine: Machine,
    State(state): State<AppState>,
    Json(payload): Json<AdjustPayload>,
) -> impl IntoResponse {
    let cmds = commands_for_settings(
        payload.chair_angle_degrees,
        payload.lumbar_heat,
        payload.upper_back_heat,
        payload.leg_heat,
        &payload.light_mode,
        payload.light_color.as_deref(),
    );
    state.send_commands(cmds).await;
    StatusCode::NO_CONTENT
}

/// Tell the Arduino a session is starting.
pub async fn session_start(_machine: Machine, State(state): State<AppState>) -> impl IntoResponse {
    state.send_commands(vec![Command::SessionStart]).await;
    StatusCode::NO_CONTENT
}

/// Tell the Arduino a session has ended (used by cancel — no DB write here).
pub async fn session_end(_machine: Machine, State(state): State<AppState>) -> impl IntoResponse {
    state.send_commands(vec![Command::SessionEnd]).await;
    StatusCode::NO_CONTENT
}
