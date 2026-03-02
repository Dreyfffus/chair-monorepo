-- Add migration script here
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users,
    session_token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);