use axum::Router;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod db;
mod models;
mod routes;
mod serial;
mod state;

use state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "chair_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let pool = db::create_pool().await;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");
    tracing::info!("Migrations applied");

    // Shared mirror of the chair's physical state, updated by the serial read
    // thread and read by the HTTP handlers.
    let chair = serial::state::new_shared();

    let serial = match std::env::var("SERIAL_PORT") {
        Ok(port_name) => match serial::bridge::open(&port_name, chair.clone()) {
            Ok(handle) => {
                tracing::info!("Serial port {port_name} ready");
                // Sync our mirror with the hardware as soon as it is up.
                let probe = handle.clone();
                tokio::spawn(async move {
                    let _ = probe.send(serial::Command::GetState).await;
                });
                Some(handle)
            }
            Err(e) => {
                tracing::warn!(
                    "Could not open serial port {port_name}: {e}\n\
                         Running without hardware — all serial commands are no-ops"
                );
                None
            }
        },
        Err(_) => {
            tracing::info!("SERIAL_PORT not set — running without hardware");
            None
        }
    };

    let state = AppState {
        pool,
        serial,
        chair,
    };

    // Periodically re-resolve the circadian colour and push it to the chair so
    // the strip tracks the time of day during a session (no-op without hardware
    // or outside a circadian session).
    if state.serial.is_some() {
        let bg = state.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(std::time::Duration::from_secs(
                serial::circadian::CIRCADIAN_RESEND_SECS,
            ));
            loop {
                ticker.tick().await;
                bg.tick_circadian().await;
            }
        });
        tracing::info!(
            "Circadian re-send loop started ({}s interval)",
            serial::circadian::CIRCADIAN_RESEND_SECS
        );
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let serve_frontend =
        ServeDir::new("static").not_found_service(ServeFile::new("static/index.html"));

    let app = Router::new()
        .nest("/api", routes::api_router())
        .nest_service("/", serve_frontend)
        .layer(cors)
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".into())
        .parse()
        .expect("PORT must be a valid number");

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("Serving on http://{addr}");

    axum::serve(
        tokio::net::TcpListener::bind(addr)
            .await
            .expect("Failed to bind"),
        app,
    )
    .await
    .expect("Server crashed");
}
