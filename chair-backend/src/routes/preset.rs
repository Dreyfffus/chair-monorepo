// src/routes/preset.rs
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

/// GET /api/presets
/// All presets belonging to this machine, ordered by name.
pub async fn list_presets(
    machine: Machine,
    State(state): State<AppState>,
) -> Result<Json<Vec<Preset>>, StatusCode> {
    let presets = sqlx::query_as!(
        Preset,
        r#"
        SELECT id, machine_id, name, intensity, duration_minutes, zones, pattern, created_at, updated_at
        FROM presets
        WHERE machine_id = $1
        ORDER BY name ASC
        "#,
        machine.id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing presets: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(presets))
}

/// GET /api/presets/:name
/// Fetch one preset by its name for this machine.
pub async fn get_preset(
    machine: Machine,
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<Preset>, StatusCode> {
    let preset = sqlx::query_as!(
        Preset,
        r#"
        SELECT id, machine_id, name, intensity, duration_minutes, zones, pattern, created_at, updated_at
        FROM presets
        WHERE machine_id = $1 AND name = $2
        "#,
        machine.id,
        name
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching preset: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(preset))
}

/// POST /api/presets
/// Create a new preset. Returns 409 if a preset with that name already exists.
pub async fn create_preset(
    machine: Machine,
    State(state): State<AppState>,
    Json(payload): Json<CreatePreset>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    payload.validate().map_err(|msg| {
        (StatusCode::UNPROCESSABLE_ENTITY, msg.to_string())
    })?;

    let preset = sqlx::query_as!(
        Preset,
        r#"
        INSERT INTO presets (machine_id, name, intensity, duration_minutes, zones, pattern, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, machine_id, name, intensity, duration_minutes, zones, pattern, created_at, updated_at
        "#,
        machine.id,
        payload.name.trim(),
        payload.intensity,
        payload.duration_minutes,
        payload.zones,
        payload.pattern
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        // Unique violation: machine already has a preset with this name
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.code().as_deref() == Some("23505") {
                return (
                    StatusCode::CONFLICT,
                    format!("A preset named '{}' already exists", payload.name.trim()),
                );
            }
        }
        tracing::error!("DB error creating preset: {e}");
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create preset".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(preset)))
}

/// PUT /api/presets/:name
/// Update an existing preset by name. Returns 404 if it does not exist.
pub async fn update_preset(
    machine: Machine,
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(payload): Json<UpdatePreset>,
) -> Result<Json<Preset>, (StatusCode, String)> {
    payload.validate().map_err(|msg| {
        (StatusCode::UNPROCESSABLE_ENTITY, msg.to_string())
    })?;

    let preset = sqlx::query_as!(
        Preset,
        r#"
        UPDATE presets
        SET intensity = $3,
            duration_minutes = $4,
            zones = $5,
            pattern = $6,
            updated_at = NOW()
        WHERE machine_id = $1 AND name = $2
        RETURNING id, machine_id, name, intensity, duration_minutes, zones, pattern, created_at, updated_at
        "#,
        machine.id,
        name,
        payload.intensity,
        payload.duration_minutes,
        payload.zones,
        payload.pattern
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error updating preset: {e}");
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update preset".to_string())
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, format!("No preset named '{name}'")))?;

    Ok(Json(preset))
}
