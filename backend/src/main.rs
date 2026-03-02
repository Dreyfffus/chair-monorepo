use dotenvy::dotenv;
use serde::{ Deserialize, Serialize };
use sqlx::postgres::PgPoolOptions;
use sqlx::{ Postgres, Pool };
use axum::{ Extension, Router, http::StatusCode, routing::{get, post, put, delete}, Json, extract::Path};
use tracing::{ info, Level };   
use tracing_subscriber;

#[derive(Serialize, Deserialize)]
struct Post {
    id: i32,
    user_id: Option<i32>,
    title: String,
    body: String
}

#[derive(Serialize, Deserialize)]
struct CreatePost{
    title: String,
    body: String,
    user_id: Option<i32>
}

#[derive(Serialize, Deserialize)]
struct UpdatePost {
    title: String,
    body: String,
    user_id: Option<i32>
}

#[derive(Serialize, Deserialize)]
struct CreateUser {
    username: String,
    display_name: Option<String>,
    password: String
}

#[derive(Serialize, Deserialize)]
struct User {
    id: i32,
    username: String,
    display_name: Option<String>,
}

async fn create_user(
    Extension(pool) : Extension<Pool<Postgres>>,
    Json(new_user) : Json<CreateUser>
) -> Result<Json<User>, StatusCode> {
    let user = sqlx::query_as!(
        User,
        "INSERT INTO users (username, display_name, password_hash) VALUES($1, $2, $3) RETURNING id, username, display_name",
        new_user.username,
        new_user.display_name,
        new_user.password
    ).fetch_one(&pool)
    .await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(user))
}

async fn delete_post(
    Extension(pool) : Extension<Pool<Postgres>>,
    Path(id) : Path<i32>
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result = sqlx::query!("DELETE FROM posts WHERE id = $1", id)
        .execute(&pool)
        .await;

    match result{
        Ok(_) => Ok(Json(serde_json::json!({"messege" : "Post deleted successfully"}))),
        Err(_) => Err(StatusCode::NOT_FOUND)
    }
}

async fn update_post(
    Extension(pool) : Extension<Pool<Postgres>>, 
    Path(id) : Path<i32>,
    Json(updated_post) : Json<UpdatePost>
) -> Result<Json<Post>, StatusCode> {
    let post = sqlx::query_as!(
        Post,
        "UPDATE posts SET title = $1, body = $2, user_id = $3 WHERE id = $4 RETURNING id, user_id, title, body",
        updated_post.title,
        updated_post.body,
        updated_post.user_id,
        id    
    ).fetch_one(&pool)
    .await;

    match post {
        Ok(post) => Ok(Json(post)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn create_post(Extension(
    pool) : Extension<Pool<Postgres>>, 
    Json(new_post) : Json<CreatePost>
) -> Result<Json<Post>,StatusCode> {
    let post = sqlx::query_as!(
        Post, "INSERT into posts (user_id, title, body) VALUES ($1, $2, $3) RETURNING id, title, body, user_id",
        new_post.user_id,
        new_post.title,
        new_post.body
    ).fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(post))
}

async fn get_posts(Extension(pool) : Extension<Pool<Postgres>>) 
-> Result<Json<Vec<Post>>, StatusCode> {
    let posts = sqlx::query_as!(Post, "SELECT id, user_id, title, body FROM posts")
        .fetch_all(&pool)
        .await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(posts))
}

async fn get_post(Extension(pool) : Extension<Pool<Postgres>>, Path(id) : Path<i32>)
-> Result<Json<Post>, StatusCode> {
    let post = sqlx::query_as!(Post, "SELECT id, user_id, title, body FROM posts WHERE id = $1", id)
        .fetch_one(&pool)
        .await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(post))
}

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {

    dotenv().ok();
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in the .env");
    let pool = PgPoolOptions::new().connect(&url).await?;
    println!("Connection established to database ...{}" , url);

    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    let app = Router::new()
        .route("/users", post(create_user))
        .route("/posts", get(get_posts).post(create_post))
        .route("/posts/{id}", get(get_post).put(update_post).delete(delete_post))
        .layer(Extension(pool));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:5000").await.unwrap();
    info!("Server is running on port 0.0.0.0:5000");
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
