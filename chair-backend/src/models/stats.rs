use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct HeatDistribution {
    pub off: i64,
    pub low: i64,
    pub medium: i64,
    pub high: i64,
}

#[derive(Debug, Serialize)]
pub struct HeatingStats {
    pub lumbar: HeatDistribution,
    pub upper_back: HeatDistribution,
    pub legs: HeatDistribution,
}

#[derive(Debug, Serialize)]
pub struct LightingStats {
    pub circadian: i64,
    pub manual: i64,
}

#[derive(Debug, Serialize)]
pub struct Stats {
    pub total_sessions: i64,
    pub total_duration_seconds: i64,
    pub avg_duration_seconds: f64,
    pub avg_chair_angle: f64,
    pub heating: HeatingStats,
    pub lighting: LightingStats,
}
