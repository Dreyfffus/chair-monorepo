import { useState } from 'react';
import { FormField } from './FormField';
import type { FieldConfig, FieldValue } from './FormField';
import type { SessionSettings } from '../types';

const HEAT_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Low' },
  { value: 2, label: 'Med' },
  { value: 3, label: 'High' },
];

const PANEL_FIELDS: FieldConfig[] = [
  { key: 'chair_angle_degrees', label: 'Chair Angle', type: 'slider', min: 90, max: 175, unit: '°' },
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

interface MidSessionPanelProps {
  current: SessionSettings;
  onApply: (settings: SessionSettings) => void;
  onClose: () => void;
}

export function MidSessionPanel({ current, onApply, onClose }: MidSessionPanelProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>({
    chair_angle_degrees: current.chair_angle_degrees,
    lumbar_heat: current.lumbar_heat,
    upper_back_heat: current.upper_back_heat,
    leg_heat: current.leg_heat,
    light_mode: current.light_mode,
    light_color: current.light_color ?? '#ffd6a5',
  });

  const handleChange = (key: string, value: FieldValue) =>
    setValues(prev => ({ ...prev, [key]: value }));

  const handleApply = () => {
    onApply({
      chair_angle_degrees: values.chair_angle_degrees as number,
      lumbar_heat: values.lumbar_heat as number,
      upper_back_heat: values.upper_back_heat as number,
      leg_heat: values.leg_heat as number,
      light_mode: values.light_mode as 'manual' | 'circadian',
      light_color: values.light_mode === 'manual' ? values.light_color as string : null,
    });
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

        <div className="mid-session-footer">
          <button className="btn btn-ghost" onClick={onClose}>Discard</button>
          <button className="btn btn-primary" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
}
