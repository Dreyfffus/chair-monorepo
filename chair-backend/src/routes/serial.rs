// GET  /api/serial/status         — current chair state (busy flag, angle, …)
// POST /api/serial/adjust          — mid-session setting adjustment, no DB write
// POST /api/serial/session/start   — sends SESSION_START (+ GET_STATE) to Arduino
// POST /api/serial/session/end     — sends SESSION_END to Arduino (used by cancel)

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{
    models::machine::Machine,
    serial::command::{Command, Desired},
    state::{AppState, ApplyError},
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

/// Current chair state, so the frontend can gate its controls while the servo
/// is still travelling to a requested angle.
pub async fn status(_machine: Machine, State(state): State<AppState>) -> impl IntoResponse {
    Json(state.chair_status())
}

/// Send updated settings mid-session without touching the database.
///
/// Only the commands that differ from the chair's current state are sent
/// (redundant ones — same angle, same colour — are dropped). If the servo is
/// still moving, the request is rejected with 409 so the UI can show a cooldown.
pub async fn adjust(
    _machine: Machine,
    State(state): State<AppState>,
    Json(payload): Json<AdjustPayload>,
) -> impl IntoResponse {
    let desired = Desired::from_request(
        payload.chair_angle_degrees,
        payload.lumbar_heat,
        payload.upper_back_heat,
        payload.leg_heat,
        &payload.light_mode,
        payload.light_color.as_deref(),
    );

    match state.apply_settings(desired).await {
        Ok(sent) => {
            let moving = sent.iter().any(|c| c.starts_with("SET_ANGLE"));
            (
                StatusCode::OK,
                Json(json!({ "sent": sent, "moving": moving })),
            )
                .into_response()
        }
        Err(ApplyError::Busy { target_angle }) => (
            StatusCode::CONFLICT,
            Json(json!({
                "error": "chair_busy",
                "message": "Chair is still moving to the requested position.",
                "target_angle": target_angle,
            })),
        )
            .into_response(),
    }
}

/// Tell the Arduino a session is starting, then ask it for its current state so
/// the backend's mirror is in sync with the hardware.
pub async fn session_start(_machine: Machine, State(state): State<AppState>) -> impl IntoResponse {
    state.set_session_active(true);
    state
        .send_commands(vec![Command::SessionStart, Command::GetState])
        .await;
    StatusCode::NO_CONTENT
}

/// Tell the Arduino a session has ended (used by cancel — no DB write here).
pub async fn session_end(_machine: Machine, State(state): State<AppState>) -> impl IntoResponse {
    state.set_session_active(false);
    state.send_commands(vec![Command::SessionEnd]).await;
    state.reset_to_neutral();
    StatusCode::NO_CONTENT
}
