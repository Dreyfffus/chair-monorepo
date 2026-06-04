use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct Preset {
    pub id: Uuid,
    pub machine_id: Uuid,
    pub name: String,
    pub chair_angle_degrees: i32,
    pub lumbar_heat: i32,
    pub upper_back_heat: i32,
    pub leg_heat: i32,
    pub light_mode: String,
    pub light_color: Option<String>,
    pub times_loaded: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePreset {
    pub name: String,
    pub chair_angle_degrees: i32,
    pub lumbar_heat: i32,
    pub upper_back_heat: i32,
    pub leg_heat: i32,
    pub light_mode: String,
    pub light_color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePreset {
    pub chair_angle_degrees: i32,
    pub lumbar_heat: i32,
    pub upper_back_heat: i32,
    pub leg_heat: i32,
    pub light_mode: String,
    pub light_color: Option<String>,
}

impl CreatePreset {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.name.trim().is_empty() {
            return Err("name must not be empty");
        }
        validate_fields(
            self.chair_angle_degrees,
            self.lumbar_heat,
            self.upper_back_heat,
            self.leg_heat,
            &self.light_mode,
            &self.light_color,
        )
    }
}

impl UpdatePreset {
    pub fn validate(&self) -> Result<(), &'static str> {
        validate_fields(
            self.chair_angle_degrees,
            self.lumbar_heat,
            self.upper_back_heat,
            self.leg_heat,
            &self.light_mode,
            &self.light_color,
        )
    }
}

fn validate_fields(
    chair_angle_degrees: i32,
    lumbar_heat: i32,
    upper_back_heat: i32,
    leg_heat: i32,
    light_mode: &str,
    light_color: &Option<String>,
) -> Result<(), &'static str> {
    if !(90..=175).contains(&chair_angle_degrees) {
        return Err("chair_angle_degrees must be between 90 and 175");
    }
    for heat in [lumbar_heat, upper_back_heat, leg_heat] {
        if !(0..=3).contains(&heat) {
            return Err("heat values must be between 0 and 3");
        }
    }
    if !["manual", "circadian"].contains(&light_mode) {
        return Err("light_mode must be 'manual' or 'circadian'");
    }
    if light_mode == "manual" && light_color.is_none() {
        return Err("light_color is required when light_mode is 'manual'");
    }
    Ok(())
}
