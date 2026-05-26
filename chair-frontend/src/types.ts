// src/types.ts

export interface Preset {
  id: string;
  machine_id: string;
  name: string;
  mode: "recharge" | "relax" | "test";
  chair_angle_degrees: number;
  light_mode: "manual" | "circadian";
  light_color: string | null;
  times_loaded: number;
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
  mode: "recharge" | "relax" | "test";
  chair_angle_degrees: number;
  light_mode: "manual" | "circadian";
  light_color: string | null;
}

// Body for PUT /api/presets/:name
export type UpdatePreset = Omit<CreatePreset, "name">;
