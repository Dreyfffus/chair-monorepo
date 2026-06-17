import type {
  CreatePreset,
  Preset,
  SerialStatus,
  SessionSettings,
  Stats,
  UpdatePreset,
} from "./types";

const MACHINE_ID_KEY = "chair_machine_id";
const API_KEY_KEY = "chair_api_key";
const IS_TEST_KEY = "chair_is_test";
const TEST_PRESETS_KEY = "chair_test_presets";

export function getMachineId(): string | null {
  return localStorage.getItem(MACHINE_ID_KEY);
}

export function isProvisioned(): boolean {
  return getMachineId() !== null && localStorage.getItem(API_KEY_KEY) !== null;
}

export function isTestMachine(): boolean {
  return localStorage.getItem(IS_TEST_KEY) === "true";
}

// Result of an adjust request. `busy` is true when the backend rejected it
// because the servo is still moving (HTTP 409); `moving` is true when this
// request itself started a new servo move.
export interface AdjustResult {
  busy: boolean;
  moving: boolean;
}

export async function adjustSerial(
  settings: SessionSettings,
): Promise<AdjustResult> {
  const res = await apiFetch("/api/serial/adjust", {
    method: "POST",
    body: JSON.stringify(settings),
  });
  if (res.status === 409) return { busy: true, moving: false };
  if (!res.ok) {
    console.error("Serial adjust failed:", res.status);
    return { busy: false, moving: false };
  }
  const body = await res.json().catch(() => ({ moving: false }));
  return { busy: false, moving: Boolean(body.moving) };
}

export async function getSerialStatus(): Promise<SerialStatus> {
  const res = await apiFetch("/api/serial/status");
  if (!res.ok) throw new Error(`Failed to fetch serial status: ${res.status}`);
  return res.json();
}

export async function cancelSession(): Promise<void> {
  const res = await apiFetch("/api/serial/session/end", { method: "POST" });
  if (!res.ok) console.error("Serial session end failed:", res.status);
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

export async function listPresets(): Promise<Preset[]> {
  const res = await apiFetch("/api/presets");
  if (!res.ok) throw new Error(`Failed to list presets: ${res.status}`);
  const real: Preset[] = await res.json();
  return isTestMachine() ? [...real, ...getTestPresets()] : real;
}

export async function createPreset(preset: CreatePreset): Promise<Preset> {
  // Test presets never touch the backend
  if (
    (preset as any).mode === "test" ||
    getTestPresets().find((p) => p.name === preset.name)
  ) {
    const fabricated: Preset = {
      id: "test-" + Date.now(),
      machine_id: getMachineId() ?? "test",
      times_loaded: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...preset,
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
  const testPresets = getTestPresets();
  const existing = testPresets.find((p) => p.name === name);
  if (existing) {
    const updated = {
      ...existing,
      ...preset,
      updated_at: new Date().toISOString(),
    };
    saveTestPresets(testPresets.map((p) => (p.name === name ? updated : p)));
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
  console.log("called loadPreset");

  const testPreset = getTestPresets().find((p) => p.name === name);
  if (testPreset) return testPreset;

  const res = await apiFetch(`/api/presets/${encodeURIComponent(name)}/load`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to load preset: ${res.status}`);
  const preset: Preset = await res.json();

  await adjustSerial({
    chair_angle_degrees: preset.chair_angle_degrees,
    lumbar_heat: preset.lumbar_heat,
    upper_back_heat: preset.upper_back_heat,
    leg_heat: preset.leg_heat,
    light_mode: preset.light_mode,
    light_color: preset.light_color,
  });

  await apiFetch("/api/serial/session/start", { method: "POST" });

  return preset;
}

export async function recordSession(
  presetName: string,
  durationSeconds: number,
  settings: SessionSettings,
): Promise<void> {
  const res = await apiFetch("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      preset_name: presetName,
      duration_seconds: durationSeconds,
      chair_angle_degrees: settings.chair_angle_degrees,
      lumbar_heat: settings.lumbar_heat,
      upper_back_heat: settings.upper_back_heat,
      leg_heat: settings.leg_heat,
      light_mode: settings.light_mode,
      light_color: settings.light_color,
    }),
  });
  if (!res.ok) throw new Error(`Failed to record session: ${res.status}`);
}

export async function getStats(): Promise<Stats> {
  const res = await apiFetch("/api/stats");
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json();
}
