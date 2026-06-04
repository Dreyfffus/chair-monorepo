use axum::{extract::State, http::StatusCode, Json};

use crate::{
    models::{
        machine::Machine,
        stats::{HeatDistribution, HeatingStats, LightingStats, Stats},
    },
    state::AppState,
};

pub async fn get_stats(
    machine: Machine,
    State(state): State<AppState>,
) -> Result<Json<Stats>, StatusCode> {
    let row = sqlx::query!(
        r#"
        SELECT
            COUNT(*)::bigint                                              AS "total_sessions!",
            COALESCE(SUM(duration_seconds), 0)::bigint                   AS "total_duration!",
            COALESCE(AVG(duration_seconds::float8), 0.0)::float8         AS "avg_duration!",
            COALESCE(AVG(chair_angle_degrees::float8), 0.0)::float8      AS "avg_angle!",

            COUNT(*) FILTER (WHERE lumbar_heat = 0)::bigint              AS "lumbar_off!",
            COUNT(*) FILTER (WHERE lumbar_heat = 1)::bigint              AS "lumbar_low!",
            COUNT(*) FILTER (WHERE lumbar_heat = 2)::bigint              AS "lumbar_med!",
            COUNT(*) FILTER (WHERE lumbar_heat = 3)::bigint              AS "lumbar_high!",

            COUNT(*) FILTER (WHERE upper_back_heat = 0)::bigint          AS "upper_back_off!",
            COUNT(*) FILTER (WHERE upper_back_heat = 1)::bigint          AS "upper_back_low!",
            COUNT(*) FILTER (WHERE upper_back_heat = 2)::bigint          AS "upper_back_med!",
            COUNT(*) FILTER (WHERE upper_back_heat = 3)::bigint          AS "upper_back_high!",

            COUNT(*) FILTER (WHERE leg_heat = 0)::bigint                 AS "leg_off!",
            COUNT(*) FILTER (WHERE leg_heat = 1)::bigint                 AS "leg_low!",
            COUNT(*) FILTER (WHERE leg_heat = 2)::bigint                 AS "leg_med!",
            COUNT(*) FILTER (WHERE leg_heat = 3)::bigint                 AS "leg_high!",

            COUNT(*) FILTER (WHERE light_mode = 'circadian')::bigint     AS "circadian!",
            COUNT(*) FILTER (WHERE light_mode = 'manual')::bigint        AS "manual!"
        FROM sessions
        WHERE machine_id = $1
        "#,
        machine.id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching stats: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(Stats {
        total_sessions: row.total_sessions,
        total_duration_seconds: row.total_duration,
        avg_duration_seconds: row.avg_duration,
        avg_chair_angle: row.avg_angle,
        heating: HeatingStats {
            lumbar: HeatDistribution {
                off: row.lumbar_off,
                low: row.lumbar_low,
                medium: row.lumbar_med,
                high: row.lumbar_high,
            },
            upper_back: HeatDistribution {
                off: row.upper_back_off,
                low: row.upper_back_low,
                medium: row.upper_back_med,
                high: row.upper_back_high,
            },
            legs: HeatDistribution {
                off: row.leg_off,
                low: row.leg_low,
                medium: row.leg_med,
                high: row.leg_high,
            },
        },
        lighting: LightingStats {
            circadian: row.circadian,
            manual: row.manual,
        },
    }))
}
