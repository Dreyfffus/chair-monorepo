# Massage Chair Dashboard

A session configuration dashboard for a massage chair. Each physical machine has a persistent identity stored locally. Presets are named configurations scoped to that machine and saved to a Neon Postgres database.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Rust + Axum |
| Database | Neon (serverless Postgres) |
| Frontend | React + Vite (TypeScript) |
| Auth | Machine API key (SHA-256 hashed, stored in Neon) |

---

## Project Structure

```
/
├── chair-backend/
│   ├── src/
│   │   ├── main.rs           — server startup
│   │   ├── auth.rs           — machine API key extractor
│   │   ├── db.rs             — connection pool
│   │   ├── state.rs          — shared app state
│   │   ├── models/
│   │   │   ├── machine.rs    — machine type
│   │   │   └── preset.rs     — preset type + validation
│   │   └── routes/
│   │       ├── machine.rs    — POST /api/machines/provision
│   │       └── preset.rs     — GET/POST/PUT /api/presets
│   ├── migrations/
│   │   └── 20240101000000_initial.sql
│   └── Cargo.toml
│
└── chair-frontend/
    ├── src/
    │   ├── main.tsx          — React entry point
    │   ├── App.tsx           — provisioning gate
    │   ├── Dashboard.tsx     — your canvas
    │   ├── api.ts            — all backend communication
    │   └── types.ts          — shared TypeScript types
    └── package.json
```

---

## Prerequisites

- [Rust](https://rustup.rs)
- [Node.js](https://nodejs.org) (v18 or later)
- A [Neon](https://neon.tech) account with a project created

---

## First-Time Setup

### 1. Database

In your Neon project, get the **direct** connection string (not the pooled one) from Connection Details. It looks like:

```
postgresql://user:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Install the sqlx CLI:

```bash
cargo install sqlx-cli --no-default-features --features rustls,postgres
```

Run migrations:

```bash
cd chair-backend
cp .env.example .env
# paste your connection string as DATABASE_URL in .env
sqlx migrate run
```

### 2. Backend

```bash
cd chair-backend
cargo run
```

First run compiles all dependencies — takes a few minutes. Subsequent runs are fast.

### 3. Frontend

```bash
cd chair-frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

On first load the browser automatically provisions itself as a machine — no login required. The machine credentials are stored in localStorage and persist across sessions.

---

## API Reference

All routes prefixed with `/api`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/machines/provision` | None | Register a new machine. Returns `machine_id` and `api_key`. Called automatically by the frontend on first load. |
| `GET` | `/presets` | API key | List all presets for this machine. |
| `GET` | `/presets/:name` | API key | Get one preset by name. |
| `POST` | `/presets` | API key | Create a new preset. Returns `409` if the name already exists. |
| `PUT` | `/presets/:name` | API key | Update an existing preset. Returns `404` if not found. |

Authenticated routes expect:
```
Authorization: Bearer <api_key>
```

---

## Preset Model

```typescript
{
  id: string              // UUID, server-generated
  machine_id: string      // UUID of the owning machine
  name: string            // secondary key, unique per machine
  intensity: number       // 1–10
  duration_minutes: number // 1–60, default 15
  zones: Zone[]           // [{ id: string, enabled: boolean }]
  pattern: string         // e.g. "standard", "deep", "wave"
  created_at: string
  updated_at: string
}
```

---

## How Machine Identity Works

1. On first load, the frontend checks localStorage for `chair_machine_id` and `chair_api_key`
2. If missing, it calls `POST /api/machines/provision` — no credentials needed
3. The backend generates a random API key, stores its SHA-256 hash in Postgres, and returns the raw key once
4. The frontend stores both values in localStorage permanently
5. Every subsequent API call sends the raw key as a Bearer token
6. The backend hashes it and matches it against the stored hash

If localStorage is cleared, the machine provisions itself again as a new machine on next load.

---

## Development Notes

- The Vite dev server proxies `/api/*` to `http://127.0.0.1:3001` — no CORS configuration needed in development
- Both servers must be running simultaneously during development
- CORS is currently open (`Any`) — lock it to `http://localhost:5173` before any deployment
- The provisioning endpoint has no auth — fine for a local network, would need a shared secret if the backend were internet-facing

---

## Resetting the Database

If you need to wipe and re-run migrations (e.g. after modifying a migration file):

```sql
-- Run in Neon SQL Editor
DROP TABLE IF EXISTS presets;
DROP TABLE IF EXISTS machines;
DELETE FROM _sqlx_migrations WHERE version = 20240101000000;
```

Then:

```bash
sqlx migrate run
```
