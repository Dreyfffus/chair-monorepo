use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

use crate::{
    models::{
        machine::Machine,
        preset::{CreatePreset, Preset, UpdatePreset},
    },
    state::AppState,
};

const MAX_PRESETS: i64 = 25;

pub async fn list_presets(
    machine: Machine,
    State(state): State<AppState>,
) -> Result<Json<Vec<Preset>>, StatusCode> {
    let presets = sqlx::query_as!(
        Preset,
        r#"
        SELECT id, machine_id, name, mode, chair_angle_degrees, light_mode, light_color, times_loaded, created_at, updated_at
        FROM presets
        WHERE machine_id = $1
        ORDER BY times_loaded DESC, created_at ASC
        "#,
        machine.id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error listing presets: {e}"); StatusCode::INTERNAL_SERVER_ERROR })?;

    Ok(Json(presets))
}

pub async fn get_preset(
    machine: Machine,
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<Preset>, StatusCode> {
    let preset = sqlx::query_as!(
        Preset,
        r#"
        SELECT id, machine_id, name, mode, chair_angle_degrees, light_mode, light_color, times_loaded, created_at, updated_at
        FROM presets
        WHERE machine_id = $1 AND name = $2
        "#,
        machine.id,
        name
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error fetching preset: {e}"); StatusCode::INTERNAL_SERVER_ERROR })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(preset))
}

pub async fn create_preset(
    machine: Machine,
    State(state): State<AppState>,
    Json(payload): Json<CreatePreset>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    payload
        .validate()
        .map_err(|msg| (StatusCode::UNPROCESSABLE_ENTITY, msg.to_string()))?;

    let count = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM presets WHERE machine_id = $1",
        machine.id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("{e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to count presets".to_string(),
        )
    })?
    .unwrap_or(0);

    if count >= MAX_PRESETS {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            format!("Preset limit of {MAX_PRESETS} reached."),
        ));
    }

    let preset = sqlx::query_as!(
        Preset,
        r#"
        INSERT INTO presets (machine_id, name, mode, chair_angle_degrees, light_mode, light_color, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, machine_id, name, mode, chair_angle_degrees, light_mode, light_color, times_loaded, created_at, updated_at
        "#,
        machine.id,
        payload.name.trim(),
        payload.mode,
        payload.chair_angle_degrees,
        payload.light_mode,
        payload.light_color,
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.code().as_deref() == Some("23505") {
                return (StatusCode::CONFLICT, format!("A preset named '{}' already exists", payload.name.trim()));
            }
        }
        tracing::error!("DB error creating preset: {e}");
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create preset".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(preset)))
}

pub async fn update_preset(
    machine: Machine,
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(payload): Json<UpdatePreset>,
) -> Result<Json<Preset>, (StatusCode, String)> {
    payload
        .validate()
        .map_err(|msg| (StatusCode::UNPROCESSABLE_ENTITY, msg.to_string()))?;

    let preset = sqlx::query_as!(
        Preset,
        r#"
        UPDATE presets
        SET mode = $3, chair_angle_degrees = $4, light_mode = $5, light_color = $6, updated_at = NOW()
        WHERE machine_id = $1 AND name = $2
        RETURNING id, machine_id, name, mode, chair_angle_degrees, light_mode, light_color, times_loaded, created_at, updated_at
        "#,
        machine.id,
        name,
        payload.mode,
        payload.chair_angle_degrees,
        payload.light_mode,
        payload.light_color,
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| { tracing::error!("{e}"); (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update preset".to_string()) })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, format!("No preset named '{name}'")))?;

    Ok(Json(preset))
}

pub async fn load_preset(
    machine: Machine,
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<Preset>, StatusCode> {
    let preset = sqlx::query_as!(
        Preset,
        r#"
        UPDATE presets
        SET times_loaded = times_loaded + 1
        WHERE machine_id = $1 AND name = $2
        RETURNING id, machine_id, name, mode, chair_angle_degrees, light_mode, light_color, times_loaded, created_at, updated_at
        "#,
        machine.id,
        name
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| { tracing::error!("{e}"); StatusCode::INTERNAL_SERVER_ERROR })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(preset))
}
