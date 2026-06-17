// Every message sent from Arduino → Rust.
// The read thread receives raw lines and calls Response::parse on each.

/// Parsed `STATE:` report from the Arduino. Any field the line omits stays
/// `None` so a partial report only updates what it actually carried.
#[derive(Debug, Clone, Default)]
pub struct StateReport {
    pub angle: Option<u8>,
    pub lumbar: Option<u8>,
    pub upper_back: Option<u8>,
    pub leg: Option<u8>,
    pub light: Option<(u8, u8, u8)>,
    pub moving: Option<bool>,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum Response {
    Ack {
        command: String,
    },
    Error {
        command: String,
        reason: String,
    },
    /// A movement finished, e.g. `DONE:SET_ANGLE:120`. `command` is the part
    /// after `DONE:` (e.g. `SET_ANGLE:120`).
    Done {
        command: String,
    },
    /// A full state report (response to `GET_STATE`).
    State(StateReport),
    Ready,
    Unknown(String),
}

impl Response {
    /// Protocol (Arduino → Rust):
    ///   READY
    ///   ACK:<original_command>
    ///   ERR:<command>:<reason>
    ///   DONE:<command>                         (a move completed)
    ///   STATE:ANGLE:<a> LUMBAR:<l> UPPER:<u> LEG:<g> R:<r> G:<g> B:<b> BUSY:<0|1>
    pub fn parse(line: &str) -> Self {
        let line = line.trim();

        if line == "READY" {
            return Response::Ready;
        }

        if let Some(rest) = line.strip_prefix("ACK:") {
            return Response::Ack {
                command: rest.to_string(),
            };
        }

        if let Some(rest) = line.strip_prefix("DONE:") {
            return Response::Done {
                command: rest.to_string(),
            };
        }

        if let Some(rest) = line.strip_prefix("STATE:") {
            return Response::State(parse_state(rest));
        }

        if let Some(rest) = line.strip_prefix("ERR:") {
            return match rest.split_once(':') {
                Some((cmd, reason)) => Response::Error {
                    command: cmd.to_string(),
                    reason: reason.to_string(),
                },
                None => Response::Error {
                    command: rest.to_string(),
                    reason: "unknown".to_string(),
                },
            };
        }

        Response::Unknown(line.to_string())
    }

    #[allow(dead_code)]
    pub fn is_ack_for(&self, prefix: &str) -> bool {
        matches!(self, Response::Ack { command } if command.starts_with(prefix))
    }
}

/// Parse the body of a `STATE:` line: space-separated `KEY:VALUE` tokens.
fn parse_state(body: &str) -> StateReport {
    let mut report = StateReport::default();
    let (mut r, mut g, mut b) = (None, None, None);

    for token in body.split_whitespace() {
        let Some((key, value)) = token.split_once(':') else {
            continue;
        };
        match key {
            "ANGLE" => report.angle = value.parse().ok(),
            "LUMBAR" => report.lumbar = value.parse().ok(),
            "UPPER" => report.upper_back = value.parse().ok(),
            "LEG" => report.leg = value.parse().ok(),
            "R" => r = value.parse().ok(),
            "G" => g = value.parse().ok(),
            "B" => b = value.parse().ok(),
            "BUSY" => report.moving = value.parse::<u8>().ok().map(|v| v != 0),
            _ => {}
        }
    }

    if let (Some(r), Some(g), Some(b)) = (r, g, b) {
        report.light = Some((r, g, b));
    }

    report
}
