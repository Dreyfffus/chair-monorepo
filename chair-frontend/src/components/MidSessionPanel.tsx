import { useState } from 'react';
import { FormField } from './FormField';
import type { FieldConfig, FieldValue } from './FormField';
import type { SessionSettings } from '../types';
import { CHAIR_ANGLE_MIN, CHAIR_ANGLE_MAX } from '../types';

const HEAT_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Low' },
  { value: 2, label: 'Med' },
  { value: 3, label: 'High' },
];

const PANEL_FIELDS: FieldConfig[] = [
  { key: 'chair_angle_degrees', label: 'Chair Angle', type: 'slider', min: CHAIR_ANGLE_MIN, max: CHAIR_ANGLE_MAX, unit: '°' },
  { key: 'lumbar_heat', label: 'Lumbar Heat', type: 'segment', options: HEAT_OPTIONS },
  { key: 'upper_back_heat', label: 'Upper Back Heat', type: 'segment', options: HEAT_OPTIONS },
  { key: 'leg_heat', label: 'Leg Heat', type: 'segment', options: HEAT_OPTIONS },
  {
    key: 'light_mode', label: 'Lighting', type: 'select',
    options: [
      { value: 'circadian', label: 'Circadian' },
      { value: 'manual', label: 'Manual colour' },
    ],
  },
];

const clampAngle = (a: number) => Math.min(CHAIR_ANGLE_MAX, Math.max(CHAIR_ANGLE_MIN, a));

interface MidSessionPanelProps {
  current: SessionSettings;
  /** True while the chair is still moving — Apply is blocked with a cooldown. */
  locked?: boolean;
  onApply: (settings: SessionSettings) => void;
  onClose: () => void;
}

function settingsFromValues(values: Record<string, FieldValue>): SessionSettings {
  const mode = values.light_mode as 'manual' | 'circadian';
  return {
    chair_angle_degrees: clampAngle(values.chair_angle_degrees as number),
    lumbar_heat: values.lumbar_heat as number,
    upper_back_heat: values.upper_back_heat as number,
    leg_heat: values.leg_heat as number,
    light_mode: mode,
    light_color: mode === 'manual' ? (values.light_color as string) : null,
  };
}

function sameSettings(a: SessionSettings, b: SessionSettings): boolean {
  return (
    a.chair_angle_degrees === b.chair_angle_degrees &&
    a.lumbar_heat === b.lumbar_heat &&
    a.upper_back_heat === b.upper_back_heat &&
    a.leg_heat === b.leg_heat &&
    a.light_mode === b.light_mode &&
    (a.light_color ?? null) === (b.light_color ?? null)
  );
}

export function MidSessionPanel({ current, locked = false, onApply, onClose }: MidSessionPanelProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>({
    chair_angle_degrees: clampAngle(current.chair_angle_degrees),
    lumbar_heat: current.lumbar_heat,
    upper_back_heat: current.upper_back_heat,
    leg_heat: current.leg_heat,
    light_mode: current.light_mode,
    light_color: current.light_color ?? '#ffd6a5',
  });

  const handleChange = (key: string, value: FieldValue) =>
    setValues(prev => ({ ...prev, [key]: value }));

  const next = settingsFromValues(values);
  // Block requests that wouldn't change anything already on the chair.
  const unchanged = sameSettings(next, current);

  const handleApply = () => {
    if (locked || unchanged) return;
    onApply(next);
    onClose();
  };

  return (
    <div className="mid-session-overlay" onClick={onClose}>
      <div className="mid-session-panel" onClick={e => e.stopPropagation()}>
        <div className="mid-session-header">
          <div>
            <p className="mid-session-title">Adjust session</p>
            <p className="mid-session-sub">These changes apply to this session only</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="mid-session-body">
          {PANEL_FIELDS.map(field => (
            <FormField key={field.key} config={field}
              value={values[field.key]}
              onChange={handleChange} />
          ))}
          {values.light_mode === 'manual' && (
            <FormField
              config={{ key: 'light_color', label: 'Light Colour', type: 'color' }}
              value={values.light_color}
              onChange={handleChange} />
          )}
        </div>

        {locked && (
          <p className="mid-session-cooldown">
            Chair is still moving into position — adjustments are paused until it settles.
          </p>
        )}

        <div className="mid-session-footer">
          <button className="btn btn-ghost" onClick={onClose}>Discard</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={locked || unchanged}>
            {locked ? 'Please wait…' : unchanged ? 'No changes' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

