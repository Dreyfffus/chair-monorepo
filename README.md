# Massage Chair Workstation Dashboard

A workstation session dashboard for a massage chair. Each physical machine has a persistent identity stored locally. Presets are named configurations scoped to that machine, saved to a Neon Postgres database, and applied to the chair hardware through a USB-connected Arduino.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Rust + Axum |
| Database | Neon (serverless Postgres) |
| Frontend | React + Vite (TypeScript) + WebGL |
| Auth | Machine API key (SHA-256 hashed) |
| Hardware | Arduino Uno via USB serial |

---

## Project Structure

```
/
├── chair-backend/
│   ├── src/
│   │   ├── main.rs
│   │   ├── auth.rs           — machine API key extractor
│   │   ├── db.rs             — connection pool
│   │   ├── state.rs          — shared app state (pool + serial handle)
│   │   ├── models/
│   │   │   ├── machine.rs
│   │   │   ├── preset.rs
│   │   │   ├── session.rs
│   │   │   └── stats.rs
│   │   ├── routes/
│   │   │   ├── machine.rs
│   │   │   ├── preset.rs
│   │   │   ├── session.rs
│   │   │   ├── serial.rs
│   │   │   └── stats.rs
│   │   └── serial/
│   │       ├── mod.rs
│   │       ├── bridge.rs     — serial port read/write threads
│   │       ├── command.rs    — Command enum + serializer
│   │       └── response.rs   — Response enum + parser
│   ├── migrations/
│   ├── static/               — compiled React app (generated)
│   ├── arduino/
│   │   └── chair_firmware/
│   │       └── chair_firmware.ino
│   └── Cargo.toml
│
└── chair-frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx           — provisioning gate + theme
    │   ├── Dashboard.tsx     — view state machine
    │   ├── api.ts            — all backend communication
    │   ├── types.ts
    │   ├── components/
    │   │   ├── FormField.tsx      — extensible form primitive
    │   │   ├── MidSessionPanel.tsx
    │   │   ├── PresetCard.tsx
    │   │   └── ThemeToggle.tsx
    │   ├── hooks/
    │   │   ├── useTheme.ts
    │   │   ├── useTimeColor.ts
    │   │   └── useWebGLSession.ts
    │   ├── pages/
    │   │   ├── IdlePage.tsx
    │   │   ├── PresetListPage.tsx
    │   │   ├── PresetFormPage.tsx
    │   │   ├── ActiveSessionPage.tsx
    │   │   └── StatsPage.tsx
    │   ├── shaders/
    │   │   ├── session.vert
    │   │   └── session.frag
    │   └── utils/
    │       └── color.ts
    └── package.json
```

---

## Prerequisites

- [Rust](https://rustup.rs)
- [Node.js](https://nodejs.org) v18 or later
- A [Neon](https://neon.tech) account with a project created
- Linux: `sudo apt install pkg-config libudev-dev` (required by the serialport crate)

---

## First-Time Setup

### 1. Environment

```bash
cd chair-backend
cp .env.example .env
# Fill in DATABASE_URL and optionally SERIAL_PORT
```

### 2. Database

Install the sqlx CLI (once):

```bash
cargo install sqlx-cli --no-default-features --features rustls,postgres
```

Run all migrations:

```bash
cd chair-backend
sqlx migrate run
```

After any schema changes, regenerate the offline query cache:

```bash
cargo sqlx prepare
```

### 3. Backend

```bash
cd chair-backend
cargo run
```

### 4. Frontend (development)

```bash
cd chair-frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api/*` to the Rust backend.

### 5. Prototype / single-process mode

Builds the React app into the Rust static folder and serves everything from one process on one port:

```bash
cd chair-frontend && npm run build
cd ../chair-backend && cargo run
```

Open [http://localhost:3001](http://localhost:3001). Press `F11` for fullscreen kiosk mode.

---

## API Reference

All routes prefixed with `/api`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/machines/provision` | None | Register machine, return `api_key` once |
| `GET` | `/presets` | API key | List presets sorted by popularity |
| `GET` | `/presets/:name` | API key | Fetch one preset by name |
| `POST` | `/presets` | API key | Create preset (409 duplicate, 429 at limit of 25) |
| `PUT` | `/presets/:name` | API key | Update preset |
| `POST` | `/presets/:name/load` | API key | Increment load counter, apply settings to hardware |
| `POST` | `/sessions` | API key | Record completed session with actual settings used |
| `GET` | `/stats` | API key | Aggregate usage statistics |
| `POST` | `/serial/adjust` | API key | Send updated settings to hardware mid-session |
| `POST` | `/serial/session/start` | API key | Send SESSION_START to Arduino |
| `POST` | `/serial/session/end` | API key | Send SESSION_END to Arduino (cancel, no DB write) |

---

## Preset Model

```typescript
{
  id: string
  machine_id: string
  name: string                  // secondary key — unique per machine
  chair_angle_degrees: number   // 90–175
  lumbar_heat: number           // 0–3: off / low / medium / high
  upper_back_heat: number       // 0–3
  leg_heat: number              // 0–3
  light_mode: 'circadian' | 'manual'
  light_color: string | null    // hex, only when light_mode = 'manual'
  times_loaded: number
  created_at: string
  updated_at: string
}
```

---

## Serial Protocol

Commands are newline-terminated ASCII strings sent from Rust to the Arduino.
Responses are newline-terminated ASCII strings sent back.

| Command | Response |
|---|---|
| `SET_ANGLE:<90-175>` | `ACK:SET_ANGLE:<n>` or `ERR:SET_ANGLE:LIMIT` |
| `SET_LUMBAR_HEAT:<0-3>` | `ACK:SET_LUMBAR_HEAT:<n>` |
| `SET_UPPER_BACK_HEAT:<0-3>` | `ACK:SET_UPPER_BACK_HEAT:<n>` |
| `SET_LEG_HEAT:<0-3>` | `ACK:SET_LEG_HEAT:<n>` |
| `SET_LIGHT_R:<r> G:<g> B:<b>` | `ACK:SET_LIGHT_R:...` |
| `SET_LIGHT_CIRCADIAN` | `ACK:SET_LIGHT_CIRCADIAN` |
| `SESSION_START` | `ACK:SESSION_START` |
| `SESSION_END` | `ACK:SESSION_END` |
| `CALIB_READ` | `CALIB:<adc_value>` |

On boot the Arduino sends `READY` before accepting commands.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Direct Neon connection string with `?sslmode=require` |
| `SQLX_OFFLINE` | Yes | Set to `true` after running `cargo sqlx prepare` |
| `RUST_LOG` | No | Log level, e.g. `chair_backend=debug` |
| `PORT` | No | Server port, default `3001` |
| `SERIAL_PORT` | No | e.g. `/dev/ttyACM0`. Omit to run without hardware |

---

## Test Mode

Visit `http://localhost:3001?test` with no existing credentials to provision as a test machine. Test presets are stored in localStorage and never touch the backend or hardware.

```js
// Enable on existing machine
localStorage.setItem('chair_is_test', 'true')

// Disable
localStorage.removeItem('chair_is_test')

// Clear test presets
localStorage.removeItem('chair_test_presets')
```

---

## Resetting the Database

```sql
-- Run in Neon SQL Editor
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS presets;
DROP TABLE IF EXISTS machines;
DELETE FROM _sqlx_migrations;
```

Then:

```bash
sqlx migrate run
```
