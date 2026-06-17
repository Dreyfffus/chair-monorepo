// Shared, in-memory mirror of the chair's physical state.
//
// Two parties touch this:
//   * HTTP handlers (via `AppState`) set the *desired* state when they send
//     commands, and read it to decide which commands are redundant.
//   * The serial read thread updates it from ACK / DONE / STATE lines coming
//     back from the Arduino, which is the source of truth for "is the servo
//     still moving" and the actually-confirmed angle.

use std::sync::{Arc, Mutex};
use std::time::Instant;

/// How long the backend will report the chair as "moving" without hearing a
/// `DONE` from the Arduino before it assumes the move finished (or the
/// firmware is old / disconnected). Prevents the UI from locking forever.
pub const MOVE_TIMEOUT_SECS: u64 = 12;

#[derive(Debug, Default)]
pub struct ChairState {
    /// Last *confirmed* chair recline angle in degrees (100–145).
    pub angle: Option<u8>,
    /// Angle the servo is currently travelling toward, if a move is in flight.
    pub target_angle: Option<u8>,
    pub lumbar_heat: Option<u8>,
    pub upper_back_heat: Option<u8>,
    pub leg_heat: Option<u8>,
    /// Last RGB sent to / reported by the strip.
    pub light: Option<(u8, u8, u8)>,
    /// "manual" or "circadian" — what the user asked for (the wire always
    /// carries a concrete RGB).
    pub light_mode: Option<String>,
    /// True between SESSION_START and SESSION_END — gates the circadian
    /// re-send loop so we only push colours during an active session.
    pub session_active: bool,
    /// True while the servo is still travelling to `target_angle`.
    pub moving: bool,
    /// When the current move started — used to time out a stuck/never-acked move.
    pub moving_since: Option<Instant>,
    /// True once the Arduino has announced READY at least once.
    pub ready: bool,
}

impl ChairState {
    /// Clear a `moving` flag that has outlived `MOVE_TIMEOUT_SECS`. Called
    /// before any read of the moving state so the UI never locks permanently.
    pub fn settle_if_stale(&mut self) {
        if self.moving {
            let stale = self
                .moving_since
                .map(|t| t.elapsed().as_secs() >= MOVE_TIMEOUT_SECS)
                .unwrap_or(true);
            if stale {
                tracing::warn!("Chair move timed out without DONE — clearing moving flag");
                self.moving = false;
                self.moving_since = None;
                if let Some(t) = self.target_angle.take() {
                    self.angle = Some(t);
                }
            }
        }
    }
}

pub type SharedChairState = Arc<Mutex<ChairState>>;

pub fn new_shared() -> SharedChairState {
    Arc::new(Mutex::new(ChairState::default()))
}
