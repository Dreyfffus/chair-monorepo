import type { CreatePreset, Preset, UpdatePreset } from "./types";

const MACHINE_ID_KEY = "chair_machine_id";
const API_KEY_KEY = "chair_api_key";
const IS_TEST_KEY = "chair_is_test";
const TEST_PRESETS_KEY = "chair_test_presets";

export function isTestMachine(): boolean {
  return localStorage.getItem(IS_TEST_KEY) === "true";
}

export function getMachineId(): string | null {
  return localStorage.getItem(MACHINE_ID_KEY);
}

export function isProvisioned(): boolean {
  return getMachineId() !== null && localStorage.getItem(API_KEY_KEY) !== null;
}

function getTestPresets(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(TEST_PRESETS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTestPresets(presets: Preset[]): void {
  localStorage.setItem(TEST_PRESETS_KEY, JSON.stringify(presets));
}

export async function provisionMachine(): Promise<void> {
  const isTest = new URLSearchParams(window.location.search).has("test");
  const res = await fetch("/api/machines/provision", { method: "POST" });
  if (!res.ok) throw new Error(`Provisioning failed: ${res.status}`);
  const { machine_id, api_key } = await res.json();
  localStorage.setItem(MACHINE_ID_KEY, machine_id);
  localStorage.setItem(API_KEY_KEY, api_key);
  if (isTest) localStorage.setItem(IS_TEST_KEY, "true");
}

function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = localStorage.getItem(API_KEY_KEY);
  if (!apiKey) throw new Error("Machine not provisioned");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}

export async function listPresets(): Promise<Preset[]> {
  const res = await apiFetch("/api/presets");
  if (!res.ok) throw new Error(`Failed to list presets: ${res.status}`);
  const real: Preset[] = await res.json();
  // Merge test presets at the end — they never appear on non-test machines
  // because getTestPresets() returns [] if the key doesn't exist
  return isTestMachine() ? [...real, ...getTestPresets()] : real;
}

export async function createPreset(preset: CreatePreset): Promise<Preset> {
  if (preset.mode === "test") {
    // Fabricate a local-only preset that never touches the database
    const fabricated: Preset = {
      id: "test-" + Date.now(),
      machine_id: getMachineId() ?? "test",
      name: preset.name,
      mode: "test",
      chair_angle_degrees: preset.chair_angle_degrees,
      light_mode: preset.light_mode,
      light_color: preset.light_color,
      times_loaded: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveTestPresets([...getTestPresets(), fabricated]);
    return fabricated;
  }

  const res = await apiFetch("/api/presets", {
    method: "POST",
    body: JSON.stringify(preset),
  });
  if (res.status === 409)
    throw new Error(`A preset named "${preset.name}" already exists`);
  if (res.status === 429) throw new Error(await res.text());
  if (!res.ok) throw new Error(`Failed to create preset: ${await res.text()}`);
  return res.json();
}

export async function updatePreset(
  name: string,
  preset: UpdatePreset,
): Promise<Preset> {
  if (preset.mode === "test") {
    const existing = getTestPresets();
    const updated: Preset = {
      id: "test-" + Date.now(),
      machine_id: getMachineId() ?? "test",
      name,
      mode: "test",
      chair_angle_degrees: preset.chair_angle_degrees,
      light_mode: preset.light_mode,
      light_color: preset.light_color,
      times_loaded: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveTestPresets(existing.map((p) => (p.name === name ? updated : p)));
    return updated;
  }

  const res = await apiFetch(`/api/presets/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(preset),
  });
  if (res.status === 404) throw new Error(`No preset named "${name}"`);
  if (!res.ok) throw new Error(`Failed to update preset: ${await res.text()}`);
  return res.json();
}
export async function loadPreset(name: string): Promise<Preset> {
  const res = await apiFetch(`/api/presets/${encodeURIComponent(name)}/load`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to load preset: ${res.status}`);
  return res.json();
}

export async function recordSession(
  presetName: string,
  durationSeconds: number,
): Promise<void> {
  const res = await apiFetch("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      preset_name: presetName,
      duration_seconds: durationSeconds,
    }),
  });
  if (!res.ok) throw new Error("Failed to record session: ${res.status}");
}
