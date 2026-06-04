use std::io::{BufRead, BufReader, Write};
use std::time::Duration;

use tokio::runtime::Handle;
use tokio::sync::{broadcast, mpsc};
use tracing;

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

pub fn open(port_name: &str) -> Result<SerialHandle, serialport::Error> {
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
