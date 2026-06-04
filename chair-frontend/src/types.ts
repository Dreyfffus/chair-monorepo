// src/types.ts

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
