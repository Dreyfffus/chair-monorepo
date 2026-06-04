use crate::serial::SerialHandle;
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub serial: Option<SerialHandle>,
}

impl AppState {
    pub async fn send_commands(&self, cmds: Vec<crate::serial::Command>) {
        if let Some(ref handle) = self.serial {
            if let Err(e) = handle.send_all(cmds).await {
                tracing::error!("Failed to send serial commands: {e}");
            }
        }
    }
}
