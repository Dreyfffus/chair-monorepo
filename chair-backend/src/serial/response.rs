// Every message sent from Arduino → Rust.
// The read thread receives raw lines and calls Response::parse on each.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum Response {
    Ack { command: String },
    Error { command: String, reason: String },
    Ready,
    Unknown(String),
}

impl Response {
    /// Protocol:
    ///   READY
    ///   ACK:<original_command>
    ///   ERR:<command>:<reason>
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
