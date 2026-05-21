use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    RequestPartsExt,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use sha2::{Digest, Sha256};

use crate::{models::machine::Machine, state::AppState};

#[async_trait]
impl FromRequestParts<AppState> for Machine {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| StatusCode::UNAUTHORIZED)?;

        // Hash the raw key exactly as it was hashed on provisioning
        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(bearer.token().as_bytes());
            hex::encode(hasher.finalize())
        };

        let machine = sqlx::query_as!(
            Machine,
            "SELECT id, name, created_at FROM machines WHERE api_key_hash = $1",
            hash
        )
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error during machine auth: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::UNAUTHORIZED)?;

        Ok(machine)
    }
}
