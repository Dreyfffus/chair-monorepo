// src/types.ts

export interface Preset {
  id: string;
  machine_id: string;
  name: string;
  intensity: number;        // 1–10
  duration_minutes: number; // 1–60
  zones: Zone[];
  pattern: string;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  id: string;
  enabled: boolean;
}

// Body for POST /api/presets
export interface CreatePreset {
  name: string;
  intensity: number;
  duration_minutes: number;
  zones: Zone[];
  pattern: string;
}

// Body for PUT /api/presets/:name
export type UpdatePreset = Omit<CreatePreset, 'name'>;
