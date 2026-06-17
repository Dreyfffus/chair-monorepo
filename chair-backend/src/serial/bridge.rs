use std::io::{BufRead, BufReader, Write};
use std::time::Duration;

use tokio::runtime::Handle;
use tokio::sync::{broadcast, mpsc};
use tracing;

use super::state::SharedChairState;
use super::{Command, Response};

const BAUD_RATE: u32 = 115_200;
const CMD_CHAN_SIZE: usize = 64;
const RESP_CHAN_SIZE: usize = 128;

#[allow(dead_code)]
#[derive(Clone)]
pub struct SerialHandle {
    pub cmd_tx: mpsc::Sender<Command>,
    resp_tx: broadcast::Sender<Response>,
}

impl SerialHandle {
    #[allow(dead_code)]
    pub fn subscribe(&self) -> broadcast::Receiver<Response> {
        self.resp_tx.subscribe()
    }

    pub async fn send(&self, cmd: Command) -> Result<(), String> {
        self.cmd_tx
            .send(cmd)
            .await
            .map_err(|e| format!("Serial send error: {e}"))
    }

    pub async fn send_all(&self, cmds: Vec<Command>) -> Result<(), String> {
        for cmd in cmds {
            self.send(cmd).await?;
        }
        Ok(())
    }
}

pub fn open(port_name: &str, chair: SharedChairState) -> Result<SerialHandle, serialport::Error> {
    let port = serialport::new(port_name, BAUD_RATE)
        .timeout(Duration::from_millis(500))
        .open()?;

    let read_port = port.try_clone()?;
    let write_port = port;

    let (cmd_tx, cmd_rx) = mpsc::channel::<Command>(CMD_CHAN_SIZE);
    let (resp_tx, _) = broadcast::channel::<Response>(RESP_CHAN_SIZE);

    let resp_tx_write = resp_tx.clone();
    let resp_tx_read = resp_tx.clone();

    let handle = Handle::current();

    let mut cmd_rx = cmd_rx;
    let mut port_w = write_port;
    std::thread::spawn(move || {
        tracing::debug!("Serial write thread started");
        loop {
            let cmd = match handle.block_on(cmd_rx.recv()) {
                Some(c) => c,
                None => {
                    tracing::info!("Serial command channel closed — write thread exiting");
                    break;
                }
            };

            let bytes = cmd.to_serial_string();
            tracing::debug!("Serial TX: {}", bytes.trim());

            if let Err(e) = port_w.write_all(bytes.as_bytes()) {
                tracing::error!("Serial write error: {e}");
                let _ = resp_tx_write.send(Response::Error {
                    command: "INTERNAL_WRITE".to_string(),
                    reason: e.to_string(),
                });
            }
        }
        tracing::debug!("Serial write thread exited");
    });

    std::thread::spawn(move || {
        tracing::debug!("Serial read thread started");
        let reader = BufReader::new(read_port);

        for line in reader.lines() {
            match line {
                Ok(l) if l.trim().is_empty() => continue,
                Ok(l) => {
                    tracing::debug!("Serial RX: {}", l.trim());
                    let resp = Response::parse(&l);

                    if let Response::Unknown(ref raw) = resp {
                        tracing::warn!("Serial: unrecognised line: {raw}");
                        continue;
                    }

                    apply_response_to_state(&chair, &resp);

                    let _ = resp_tx_read.send(resp);
                }
                Err(e) => {
                    if e.kind() == std::io::ErrorKind::TimedOut {
                        continue;
                    }
                    tracing::error!("Serial read error: {e}");
                    break;
                }
            }
        }
        tracing::warn!("Serial read thread exited — hardware may have disconnected");
    });

    tracing::info!("Serial port {port_name} opened at {BAUD_RATE} baud");
    Ok(SerialHandle { cmd_tx, resp_tx })
}

/// Fold an incoming Arduino message into the shared chair state. This is the
/// only place the *confirmed* state (and the "servo finished moving" signal)
/// is updated from hardware.
fn apply_response_to_state(chair: &SharedChairState, resp: &Response) {
    let mut state = match chair.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };

    match resp {
        Response::Ready => {
            state.ready = true;
        }
        Response::Done { command } => {
            // e.g. DONE:SET_ANGLE:120 — the servo has reached its target.
            if let Some(rest) = command.strip_prefix("SET_ANGLE:") {
                if let Ok(angle) = rest.trim().parse::<u8>() {
                    state.angle = Some(angle);
                }
            } else if let Some(t) = state.target_angle {
                state.angle = Some(t);
            }
            state.target_angle = None;
            state.moving = false;
            state.moving_since = None;
        }
        Response::State(report) => {
            if let Some(v) = report.angle {
                state.angle = Some(v);
            }
            if let Some(v) = report.lumbar {
                state.lumbar_heat = Some(v);
            }
            if let Some(v) = report.upper_back {
                state.upper_back_heat = Some(v);
            }
            if let Some(v) = report.leg {
                state.leg_heat = Some(v);
            }
            if let Some(v) = report.light {
                state.light = Some(v);
            }
            if let Some(moving) = report.moving {
                state.moving = moving;
                if !moving {
                    state.moving_since = None;
                    if let Some(t) = state.target_angle.take() {
                        state.angle = Some(t);
                    }
                }
            }
        }
        _ => {}
    }
}
