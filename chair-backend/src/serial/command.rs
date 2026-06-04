#[derive(Debug, Clone)]
pub enum Command {
    SetAngle(u8),      // 90–175 degrees
    SetLumbarHeat(u8), // 0=off, 1=low, 2=med, 3=high
    SetUpperBackHeat(u8),
    SetLegHeat(u8),
    SetLightManual { r: u8, g: u8, b: u8 },
    SetLightCircadian,
    SessionStart,
    SessionEnd,
}

impl Command {
    pub fn to_serial_string(&self) -> String {
        match self {
            Command::SetAngle(v) => format!("SET_ANGLE:{v}\n"),
            Command::SetLumbarHeat(v) => format!("SET_LUMBAR_HEAT:{v}\n"),
            Command::SetUpperBackHeat(v) => format!("SET_UPPER_BACK_HEAT:{v}\n"),
            Command::SetLegHeat(v) => format!("SET_LEG_HEAT:{v}\n"),
            Command::SetLightManual { r, g, b } => format!("SET_LIGHT_R:{r} G:{g} B:{b}\n"),
            Command::SetLightCircadian => "SET_LIGHT_CIRCADIAN\n".to_string(),
            Command::SessionStart => "SESSION_START\n".to_string(),
            Command::SessionEnd => "SESSION_END\n".to_string(),
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

pub fn commands_for_settings(
    angle: i32,
    lumbar: i32,
    upper_back: i32,
    legs: i32,
    light_mode: &str,
    light_color: Option<&str>,
) -> Vec<Command> {
    let light_cmd = if light_mode == "manual" {
        if let Some(hex) = light_color {
            let (r, g, b) = hex_to_rgb(hex);
            Command::SetLightManual { r, g, b }
        } else {
            Command::SetLightCircadian
        }
    } else {
        Command::SetLightCircadian
    };

    vec![
        Command::SetAngle(angle.clamp(90, 175) as u8),
        Command::SetLumbarHeat(lumbar.clamp(0, 3) as u8),
        Command::SetUpperBackHeat(upper_back.clamp(0, 3) as u8),
        Command::SetLegHeat(legs.clamp(0, 3) as u8),
        light_cmd,
    ]
}
