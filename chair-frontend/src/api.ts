// src/api.ts
// All backend communication lives here.
// The machine API key is read from localStorage on every call.

import type { CreatePreset, Preset, UpdatePreset } from './types';

// ── Storage keys ───────────────────────────────────────────────────────────

const MACHINE_ID_KEY = 'chair_machine_id';
const API_KEY_KEY    = 'chair_api_key';

// ── Machine provisioning ───────────────────────────────────────────────────

export function getMachineId(): string | null {
  return localStorage.getItem(MACHINE_ID_KEY);
}

export function isProvisioned(): boolean {
  return getMachineId() !== null && localStorage.getItem(API_KEY_KEY) !== null;
}

/**
 * Called once on first load if no credentials are found in localStorage.
 * Registers this device with the backend and stores the credentials permanently.
 */
export async function provisionMachine(): Promise<void> {
  const res = await fetch('/api/machines/provision', { method: 'POST' });

  if (!res.ok) {
    throw new Error(`Provisioning failed: ${res.status}`);
  }

  const { machine_id, api_key } = await res.json();
  localStorage.setItem(MACHINE_ID_KEY, machine_id);
  localStorage.setItem(API_KEY_KEY, api_key);
}

// ── Internal helper ────────────────────────────────────────────────────────

function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = localStorage.getItem(API_KEY_KEY);

  if (!apiKey) {
    throw new Error('Machine not provisioned — api key missing from localStorage');
  }

  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}

// ── Preset operations ──────────────────────────────────────────────────────

/** Fetch all presets for this machine, sorted by name. */
export async function listPresets(): Promise<Preset[]> {
  const res = await apiFetch('/api/presets');
  if (!res.ok) throw new Error(`Failed to list presets: ${res.status}`);
  return res.json();
}

/** Fetch one preset by name. Returns null if it does not exist. */
export async function getPreset(name: string): Promise<Preset | null> {
  const res = await apiFetch(`/api/presets/${encodeURIComponent(name)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch preset: ${res.status}`);
  return res.json();
}

/** Create a new preset. Throws with a readable message on name conflict. */
export async function createPreset(preset: CreatePreset): Promise<Preset> {
  const res = await apiFetch('/api/presets', {
    method: 'POST',
    body: JSON.stringify(preset),
  });

  if (res.status === 409) {
    throw new Error(`A preset named "${preset.name}" already exists`);
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to create preset: ${msg}`);
  }

  return res.json();
}

/** Update an existing preset by name. */
export async function updatePreset(name: string, preset: UpdatePreset): Promise<Preset> {
  const res = await apiFetch(`/api/presets/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(preset),
  });

  if (res.status === 404) throw new Error(`No preset named "${name}"`);
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to update preset: ${msg}`);
  }

  return res.json();
}
