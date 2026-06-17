// src/types.ts\

// Chair recline limits, in degrees. The servo's 18T pinion drives a 45T gear on
// the backrest (2.5:1), and the firmware applies that ratio — the UI/API speak
// in these chair degrees. Must match CHAIR_ANGLE_MIN/MAX in the Rust backend.
export const CHAIR_ANGLE_MIN = 100;
export const CHAIR_ANGLE_MAX = 145;

export interface Preset {
  id: string;
  machine_id: string;
  name: string;
  chair_angle_degrees: number;
  lumbar_heat: number; // 0–3: off / low / medium / high
  upper_back_heat: number;
  leg_heat: number;
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

export type CreatePreset = Omit<
  Preset,
  "id" | "machine_id" | "times_loaded" | "created_at" | "updated_at"
>;

export type UpdatePreset = Omit<CreatePreset, "name">;

export interface SessionSettings {
  chair_angle_degrees: number;
  lumbar_heat: number;
  upper_back_heat: number;
  leg_heat: number;
  light_mode: "manual" | "circadian";
  light_color: string | null;
}

// Live chair state from GET /api/serial/status. `moving` gates the UI while the
// servo travels to a requested angle.
export interface SerialStatus {
  ready: boolean;
  moving: boolean;
  angle: number | null;
  target_angle: number | null;
  lumbar_heat: number | null;
  upper_back_heat: number | null;
  leg_heat: number | null;
  light_color: string | null;
  light_mode: string | null;
  hardware_connected: boolean;
}

export interface HeatDistribution {
  off: number;
  low: number;
  medium: number;
  high: number;
}

export interface Stats {
  total_sessions: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  avg_chair_angle: number;
  heating: {
    lumbar: HeatDistribution;
    upper_back: HeatDistribution;
    legs: HeatDistribution;
  };
  lighting: {
    circadian: number;
    manual: number;
  };
}
