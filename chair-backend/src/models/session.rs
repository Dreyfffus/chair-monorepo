use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct RecordSession {
    pub preset_name: String,
    pub duration_seconds: i32,
    pub chair_angle_degrees: Option<i32>,
    pub lumbar_heat: Option<i32>,
    pub upper_back_heat: Option<i32>,
    pub leg_heat: Option<i32>,
    pub light_mode: Option<String>,
    pub light_color: Option<String>,
}
