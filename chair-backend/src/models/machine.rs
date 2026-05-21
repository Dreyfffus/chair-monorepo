use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Machine {
    pub id: Uuid,
    pub name: Option<String>,
    pub created_at: DateTime<Utc>,
}
