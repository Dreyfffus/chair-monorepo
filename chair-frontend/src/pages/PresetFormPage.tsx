import { useState } from 'react';
import { createPreset, updatePreset } from '../api';
import { FormField } from '../components/FormField';
import { ThemeToggle } from '../components/ThemeToggle';
import type { FieldConfig, FieldValue } from '../components/FormField';
import type { Preset } from '../types';
import type { Theme } from '../hooks/useTheme';

const HEAT_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Low' },
  { value: 2, label: 'Med' },
  { value: 3, label: 'High' },
];

const DEFAULT_VALUES: Record<string, FieldValue> = {
  chair_angle_degrees: 120,
  lumbar_heat: 0,
  upper_back_heat: 0,
  leg_heat: 0,
  light_mode: 'circadian',
  light_color: '#ffd6a5',
};

interface PresetFormPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  editing?: Preset;
  onBack: () => void;
  onSaved: (preset: Preset) => void;
}

export function PresetFormPage({ theme, onToggleTheme, editing, onBack, onSaved }: PresetFormPageProps) {
  const isNew = !editing;

  // Evaluated each render so isTestMachine() is always fresh
  const formFields: FieldConfig[] = [
    { key: 'chair_angle_degrees', label: 'Chair Angle', type: 'slider', min: 90, max: 175, unit: '°' },
    { key: 'lumbar_heat', label: 'Lumbar Heat', type: 'segment', options: HEAT_OPTIONS },
    { key: 'upper_back_heat', label: 'Upper Back Heat', type: 'segment', options: HEAT_OPTIONS },
    { key: 'leg_heat', label: 'Leg Heat', type: 'segment', options: HEAT_OPTIONS },
    {
      key: 'light_mode', label: 'Lighting', type: 'select',
      options: [
        { value: 'circadian', label: 'Circadian — adjusts to time of day' },
        { value: 'manual', label: 'Manual — choose a colour' },
      ],
    },
    // ← add new fields here
  ];

  const [name, setName] = useState(editing?.name ?? '');
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    editing ? {
      chair_angle_degrees: editing.chair_angle_degrees,
      lumbar_heat: editing.lumbar_heat,
      upper_back_heat: editing.upper_back_heat,
      leg_heat: editing.leg_heat,
      light_mode: editing.light_mode,
      light_color: editing.light_color ?? '#ffd6a5',
    } : { ...DEFAULT_VALUES }
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: string, value: FieldValue) =>
    setValues(prev => ({ ...prev, [key]: value }));

  const isManualLight = values.light_mode === 'manual';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        chair_angle_degrees: values.chair_angle_degrees as number,
        lumbar_heat: values.lumbar_heat as number,
        upper_back_heat: values.upper_back_heat as number,
        leg_heat: values.leg_heat as number,
        light_mode: values.light_mode as 'manual' | 'circadian',
        light_color: isManualLight ? values.light_color as string : null,
      };
      const saved = isNew
        ? await createPreset({ name: name.trim(), ...payload })
        : await updatePreset(editing!.name, payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page form-page">
      <div className="form-header">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <h2 className="form-title">{isNew ? 'New Preset' : `Edit — ${editing!.name}`}</h2>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <form className="form-body" onSubmit={handleSubmit}>
        {isNew && (
          <div className="field">
            <span className="field-label">Preset Name</span>
            <input className="field-input" type="text" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Focus Mode" required maxLength={60} />
          </div>
        )}
        {formFields.map(field => (
          <FormField key={field.key} config={field}
            value={values[field.key] ?? DEFAULT_VALUES[field.key]}
            onChange={handleChange} />
        ))}
        {isManualLight && (
          <FormField
            config={{ key: 'light_color', label: 'Light Colour', type: 'color' }}
            value={values.light_color ?? '#ffd6a5'}
            onChange={handleChange} />
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isNew ? 'Create Preset' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
