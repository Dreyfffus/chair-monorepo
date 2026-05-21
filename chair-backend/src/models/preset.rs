use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct Preset {
    pub id: Uuid,
    pub machine_id: Uuid,
    pub name: String,
    pub intensity: i32,
    pub duration_minutes: i32,
    pub zones: serde_json::Value,
    pub pattern: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePreset {
    pub name: String,
    pub intensity: i32,
    pub duration_minutes: i32,
    pub zones: serde_json::Value,
    pub pattern: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePreset {
    pub intensity: i32,
    pub duration_minutes: i32,
    pub zones: serde_json::Value,
    pub pattern: String,
}

impl CreatePreset {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.name.trim().is_empty() {
            return Err("name must not be empty");
        }
        validate_settings(self.intensity, self.duration_minutes)
    }
}

impl UpdatePreset {
    pub fn validate(&self) -> Result<(), &'static str> {
        validate_settings(self.intensity, self.duration_minutes)
    }
}

fn validate_settings(intensity: i32, duration_minutes: i32) -> Result<(), &'static str> {
    if !(1..=10).contains(&intensity) {
        return Err("intensity must be between 1 and 10");
    }
    if !(1..=60).contains(&duration_minutes) {
        return Err("duration_minutes must be between 1 and 60");
    }
    Ok(())
}
