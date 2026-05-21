use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::state::AppState;

pub async fn provision(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    // Generate a random raw API key from a UUID (128 bits of randomness)
    let raw_key = Uuid::new_v4().to_string().replace('-', "");

    let key_hash = {
        let mut hasher = Sha256::new();
        hasher.update(raw_key.as_bytes());
        hex::encode(hasher.finalize())
    };

    let machine_id = sqlx::query_scalar!(
        "INSERT INTO machines (api_key_hash) VALUES ($1) RETURNING id",
        key_hash
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error provisioning machine: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Provisioned new machine {machine_id}");

    // The raw key is returned exactly once here and never stored in plaintext.
    Ok(Json(json!({
        "machine_id": machine_id,
        "api_key": raw_key,
    })))
}
