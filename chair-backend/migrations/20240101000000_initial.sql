-- Each physical chair is a machine with its own identity and API key.
-- The raw API key is never stored — only its SHA-256 hash.
CREATE TABLE IF NOT EXISTS machines (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_hash TEXT        NOT NULL UNIQUE,
    name         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Named presets scoped to a machine.
-- `name` is the secondary key: unique per machine, not globally.
-- Two machines can both have a preset called "Deep Tissue" — that is fine.
CREATE TABLE IF NOT EXISTS presets (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id       UUID        NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    intensity        INTEGER     NOT NULL CHECK (intensity BETWEEN 1 AND 10),
    duration_minutes INTEGER     NOT NULL DEFAULT 15 CHECK (duration_minutes BETWEEN 1 AND 60),
    zones            JSONB       NOT NULL DEFAULT '[]',
    pattern          TEXT        NOT NULL DEFAULT 'standard',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- This is the constraint that enforces name as a secondary key
    UNIQUE (machine_id, name)
);

CREATE INDEX IF NOT EXISTS presets_machine_id_idx ON presets (machine_id);
