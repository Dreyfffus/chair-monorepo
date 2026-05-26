CREATE TABLE IF NOT EXISTS machines (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_hash TEXT        NOT NULL UNIQUE,
    name         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presets (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id          UUID        NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL,
    mode                TEXT        NOT NULL DEFAULT 'relax' CHECK (mode IN ('recharge', 'relax')),
    chair_angle_degrees INTEGER     NOT NULL DEFAULT 120 CHECK (chair_angle_degrees BETWEEN 90 AND 175),
    light_mode          TEXT        NOT NULL DEFAULT 'circadian' CHECK (light_mode IN ('manual', 'circadian')),
    light_color         TEXT,
    times_loaded        INTEGER     NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (machine_id, name)
);

CREATE INDEX IF NOT EXISTS presets_machine_id_idx ON presets (machine_id);

CREATE TABLE sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id       UUID        NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  preset_name      TEXT        NOT NULL,
  duration_seconds INTEGER     NOT NULL CHECK (duration_seconds > 0),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


