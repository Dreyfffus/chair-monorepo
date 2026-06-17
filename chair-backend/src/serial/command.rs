use super::circadian::circadian_rgb_now;
use super::state::ChairState;

/// Chair recline limits, in degrees, exposed to the user.
///
/// The servo drives an 18-tooth pinion meshed with a 45-tooth gear on the
/// backrest (a 2.5:1 reduction), so the *firmware* converts these chair
/// degrees into servo degrees — the protocol always speaks in chair degrees.
pub const CHAIR_ANGLE_MIN: i32 = 100;
pub const CHAIR_ANGLE_MAX: i32 = 145;

#[derive(Debug, Clone)]
pub enum Command {
    SetAngle(u8),      // 100–145 chair degrees (firmware applies the gear ratio)
    SetLumbarHeat(u8), // 0=off, 1=low, 2=med, 3=high
    SetUpperBackHeat(u8),
    SetLegHeat(u8),
    SetLightManual {
        r: u8,
        g: u8,
        b: u8,
    },
    SessionStart,
    SessionEnd,
    /// Ask the Arduino to report its current state (STATE:… line back).
    GetState,
}

impl Command {
    pub fn to_serial_string(&self) -> String {
        match self {
            Command::SetAngle(v) => format!("SET_ANGLE:{v}\n"),
            Command::SetLumbarHeat(v) => format!("SET_LUMBAR_HEAT:{v}\n"),
            Command::SetUpperBackHeat(v) => format!("SET_UPPER_BACK_HEAT:{v}\n"),
            Command::SetLegHeat(v) => format!("SET_LEG_HEAT:{v}\n"),
            Command::SetLightManual { r, g, b } => format!("SET_LIGHT_R:{r} G:{g} B:{b}\n"),
            Command::SessionStart => "SESSION_START\n".to_string(),
            Command::SessionEnd => "SESSION_END\n".to_string(),
            Command::GetState => "GET_STATE\n".to_string(),
        }
    }
}

pub fn hex_to_rgb(hex: &str) -> (u8, u8, u8) {
    let hex = hex.trim_start_matches('#');
    if hex.len() < 6 {
        return (255, 255, 255);
    }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(255);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(255);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(255);
    (r, g, b)
}

/// A fully-resolved target state, with all values clamped to valid ranges and
/// the light already reduced to a concrete RGB (circadian resolved here).
#[derive(Debug, Clone)]
pub struct Desired {
    pub angle: u8,
    pub lumbar: u8,
    pub upper_back: u8,
    pub leg: u8,
    pub light: (u8, u8, u8),
    pub light_mode: String,
}

impl Desired {
    /// Build a `Desired` from raw request fields, clamping everything and
    /// resolving circadian mode to the current concrete colour.
    pub fn from_request(
        angle: i32,
        lumbar: i32,
        upper_back: i32,
        legs: i32,
        light_mode: &str,
        light_color: Option<&str>,
    ) -> Self {
        let light = if light_mode == "manual" {
            light_color.map(hex_to_rgb).unwrap_or((255, 255, 255))
        } else {
            circadian_rgb_now()
        };
        Desired {
            angle: angle.clamp(CHAIR_ANGLE_MIN, CHAIR_ANGLE_MAX) as u8,
            lumbar: lumbar.clamp(0, 3) as u8,
            upper_back: upper_back.clamp(0, 3) as u8,
            leg: legs.clamp(0, 3) as u8,
            light,
            light_mode: light_mode.to_string(),
        }
    }
}

/// Commands needed to reach `desired` from the chair's current `state`,
/// omitting anything already satisfied. An angle command is suppressed both
/// when the chair is already there and when it is already on its way there.
pub fn diff_commands(state: &ChairState, desired: &Desired) -> Vec<Command> {
    let mut cmds = Vec::new();

    let angle_satisfied =
        state.angle == Some(desired.angle) || state.target_angle == Some(desired.angle);
    if !angle_satisfied {
        cmds.push(Command::SetAngle(desired.angle));
    }
    if state.lumbar_heat != Some(desired.lumbar) {
        cmds.push(Command::SetLumbarHeat(desired.lumbar));
    }
    if state.upper_back_heat != Some(desired.upper_back) {
        cmds.push(Command::SetUpperBackHeat(desired.upper_back));
    }
    if state.leg_heat != Some(desired.leg) {
        cmds.push(Command::SetLegHeat(desired.leg));
    }
    if state.light != Some(desired.light) {
        let (r, g, b) = desired.light;
        cmds.push(Command::SetLightManual { r, g, b });
    }

    cmds
}
