use crate::serial::circadian::circadian_rgb_now;
use crate::serial::command::{diff_commands, Desired};
use crate::serial::{Command, SharedChairState};
use serde::Serialize;
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub serial: Option<SerialHandle>,
    /// Live mirror of the chair's physical state, shared with the serial read
    /// thread.
    pub chair: SharedChairState,
}

use crate::serial::SerialHandle;

/// Why an adjust request could not be applied right now.
#[derive(Debug)]
pub enum ApplyError {
    /// The servo is mid-move; the caller should back off and retry.
    Busy { target_angle: Option<u8> },
}

/// Snapshot of the chair state for the frontend (`GET /api/serial/status`).
#[derive(Debug, Serialize)]
pub struct ChairStatus {
    pub ready: bool,
    pub moving: bool,
    pub angle: Option<u8>,
    pub target_angle: Option<u8>,
    pub lumbar_heat: Option<u8>,
    pub upper_back_heat: Option<u8>,
    pub leg_heat: Option<u8>,
    pub light_color: Option<String>,
    pub light_mode: Option<String>,
    /// False when the backend is running without a serial port — the frontend
    /// then knows never to gate on `moving`.
    pub hardware_connected: bool,
}

impl AppState {
    pub async fn send_commands(&self, cmds: Vec<Command>) {
        if let Some(ref handle) = self.serial {
            if let Err(e) = handle.send_all(cmds).await {
                tracing::error!("Failed to send serial commands: {e}");
            }
        }
    }

    /// Apply a desired state to the chair, sending only the commands that are
    /// not already satisfied. Rejects with `Busy` while the servo is mid-move.
    ///
    /// Returns the wire strings actually sent (empty if everything was already
    /// in the requested state).
    pub async fn apply_settings(&self, desired: Desired) -> Result<Vec<String>, ApplyError> {
        let has_hardware = self.serial.is_some();

        // Compute the diff and optimistically update state under the lock, then
        // drop the guard before awaiting the (async) send.
        let cmds = {
            let mut chair = self.chair.lock().unwrap_or_else(|p| p.into_inner());
            chair.settle_if_stale();

            if chair.moving {
                return Err(ApplyError::Busy {
                    target_angle: chair.target_angle,
                });
            }

            let cmds = diff_commands(&chair, &desired);
            let angle_changing = cmds.iter().any(|c| matches!(c, Command::SetAngle(_)));

            // Heat and light take effect effectively instantly — record them now.
            chair.lumbar_heat = Some(desired.lumbar);
            chair.upper_back_heat = Some(desired.upper_back);
            chair.leg_heat = Some(desired.leg);
            chair.light = Some(desired.light);
            chair.light_mode = Some(desired.light_mode.clone());

            if angle_changing {
                chair.target_angle = Some(desired.angle);
                // Only consider the chair "moving" when real hardware will send
                // back a DONE; without it, treat the move as instantaneous.
                if has_hardware {
                    chair.moving = true;
                    chair.moving_since = Some(std::time::Instant::now());
                } else {
                    chair.angle = Some(desired.angle);
                }
            } else if chair.angle.is_none() {
                chair.angle = Some(desired.angle);
            }

            cmds
        };

        let sent = cmds
            .iter()
            .map(|c| c.to_serial_string().trim().to_string())
            .collect();

        self.send_commands(cmds).await;
        Ok(sent)
    }

    /// Snapshot the chair state for the status endpoint.
    pub fn chair_status(&self) -> ChairStatus {
        let mut chair = self.chair.lock().unwrap_or_else(|p| p.into_inner());
        chair.settle_if_stale();

        ChairStatus {
            ready: chair.ready,
            moving: chair.moving,
            angle: chair.angle,
            target_angle: chair.target_angle,
            lumbar_heat: chair.lumbar_heat,
            upper_back_heat: chair.upper_back_heat,
            leg_heat: chair.leg_heat,
            light_color: chair
                .light
                .map(|(r, g, b)| format!("#{r:02x}{g:02x}{b:02x}")),
            light_mode: chair.light_mode.clone(),
            hardware_connected: self.serial.is_some(),
        }
    }

    /// Clear any in-flight move bookkeeping — used when a session ends/cancels.
    pub fn reset_to_neutral(&self) {
        let mut chair = self.chair.lock().unwrap_or_else(|p| p.into_inner());
        chair.light = Some((0, 0, 0));
        chair.light_mode = None;
        chair.lumbar_heat = Some(0);
        chair.upper_back_heat = Some(0);
        chair.leg_heat = Some(0);
        chair.moving = false;
        chair.moving_since = None;
        chair.target_angle = None;
    }

    /// Mark a session as started/ended so the circadian re-send loop knows
    /// whether to keep pushing colours.
    pub fn set_session_active(&self, active: bool) {
        let mut chair = self.chair.lock().unwrap_or_else(|p| p.into_inner());
        chair.session_active = active;
    }

    /// Re-resolve the circadian colour and push it to the chair if it changed.
    /// No-op unless a circadian session is active on real hardware. Called on a
    /// timer by the background loop in `main`.
    pub async fn tick_circadian(&self) {
        if self.serial.is_none() {
            return;
        }
        let cmd = {
            let mut chair = self.chair.lock().unwrap_or_else(|p| p.into_inner());
            if !chair.session_active || chair.light_mode.as_deref() != Some("circadian") {
                return;
            }
            let rgb = circadian_rgb_now();
            if chair.light == Some(rgb) {
                return; // unchanged — nothing to send (dedup)
            }
            chair.light = Some(rgb);
            let (r, g, b) = rgb;
            Command::SetLightManual { r, g, b }
        };
        tracing::debug!("Circadian re-send: {cmd:?}");
        self.send_commands(vec![cmd]).await;
    }
}
