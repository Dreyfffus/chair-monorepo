use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};

use crate::{
    models::{machine::Machine, session::RecordSession},
    state::AppState,
};

pub async fn record_session(
    machine: Machine,
    State(state): State<AppState>,
    Json(payload): Json<RecordSession>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if payload.duration_seconds <= 0 {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            "duration_seconds must be positive".to_string(),
        ));
    }

    sqlx::query!(
        "INSERT INTO sessions (machine_id, preset_name, duration_seconds) VALUES ($1, $2, $3)",
        machine.id,
        payload.preset_name,
        payload.duration_seconds,
    )
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error recording session: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to record session".to_string(),
        )
    })?;

    Ok(StatusCode::CREATED)
}
