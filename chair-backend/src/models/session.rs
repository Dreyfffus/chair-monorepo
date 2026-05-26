use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct RecordSession {
    pub preset_name: String,
    pub duration_seconds: i32,
}
