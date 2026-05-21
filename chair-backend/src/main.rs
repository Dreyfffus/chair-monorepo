// src/main.rs
use axum::Router;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod db;
mod models;
mod routes;
mod state;

use state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::new(
                std::env::var("RUST_LOG")
                    .unwrap_or_else(|_| "chair_backend=debug,tower_http=debug".into()),
            ),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let pool = db::create_pool().await;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    tracing::info!("Migrations applied");

    let state = AppState { pool };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api", routes::api_router())
        .layer(cors)
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".into())
        .parse()
        .expect("PORT must be a valid number");

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("Backend listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind port");

    axum::serve(listener, app)
        .await
        .expect("Server crashed unexpectedly");
}
