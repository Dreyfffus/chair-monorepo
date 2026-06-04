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
        r#"
        INSERT INTO sessions
            (machine_id, preset_name, duration_seconds,
             chair_angle_degrees, lumbar_heat, upper_back_heat, leg_heat,
             light_mode, light_color)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        machine.id,
        payload.preset_name,
        payload.duration_seconds,
        payload.chair_angle_degrees,
        payload.lumbar_heat,
        payload.upper_back_heat,
        payload.leg_heat,
        payload.light_mode,
        payload.light_color,
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

    // Tell the Arduino the session is done
    state
        .send_commands(vec![crate::serial::Command::SessionEnd])
        .await;

    Ok(StatusCode::CREATED)
}
