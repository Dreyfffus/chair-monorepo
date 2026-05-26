import type { Zone } from '../types';
import { useState } from 'react';
import { hexToHsl, hslToHex } from '../utils/colors';

export type SliderField = { key: string; label: string; type: 'slider'; min: number; max: number; step?: number; unit?: string; };
export type SelectField = { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; };
export type ZonesField = { key: 'zones'; label: string; type: 'zones'; available: { id: string; label: string }[]; };
export type TextInputField = { key: string; label: string; type: 'text'; placeholder?: string; disabled?: boolean; };
export type ColorField = { key: string; label: string; type: 'color'; };
export type FieldConfig = SliderField | SelectField | ZonesField | TextInputField | ColorField;
export type FieldValue = string | number | Zone[];

interface FormFieldProps {
    config: FieldConfig;
    value: FieldValue;
    onChange: (key: string, value: FieldValue) => void;
}

function HslColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
    const initial = hexToHsl(value || '#c47c5a');
    const [h, setH] = useState(Math.round(initial.h));
    const [s, setS] = useState(Math.round(initial.s));
    const [l, setL] = useState(Math.round(initial.l));

    const preview = `hsl(${h}, ${s}%, ${l}%)`;

    const emit = (nh: number, ns: number, nl: number) => {
        onChange(hslToHex({ h: nh, s: ns, l: nl }));
    };

    return (
        <div className="hsl-picker">
            <div className="hsl-preview" style={{ background: preview }} />
            <div className="hsl-sliders">
                <div className="field">
                    <div className="slider-row">
                        <span className="field-label" style={{ minWidth: 80 }}>Hue</span>
                        <input
                            className="slider hue-slider"
                            type="range" min={0} max={360} value={h}
                            onChange={e => { const v = +e.target.value; setH(v); emit(v, s, l); }}
                        />
                        <span className="slider-value">{h}°</span>
                    </div>
                </div>
                <div className="field">
                    <div className="slider-row">
                        <span className="field-label" style={{ minWidth: 80 }}>Saturation</span>
                        <input
                            className="slider"
                            type="range" min={0} max={100} value={s}
                            onChange={e => { const v = +e.target.value; setS(v); emit(h, v, l); }}
                        />
                        <span className="slider-value">{s}%</span>
                    </div>
                </div>
                <div className="field">
                    <div className="slider-row">
                        <span className="field-label" style={{ minWidth: 80 }}>Lightness</span>
                        <input
                            className="slider"
                            type="range" min={0} max={100} value={l}
                            onChange={e => { const v = +e.target.value; setL(v); emit(h, s, v); }}
                        />
                        <span className="slider-value">{l}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FormField({ config, value, onChange }: FormFieldProps) {
    return (
        <div className="field">
            <span className="field-label">{config.label}</span>

            {config.type === 'text' && (
                <input className="field-input" type="text" value={value as string}
                    placeholder={config.placeholder} disabled={config.disabled}
                    onChange={e => onChange(config.key, e.target.value)} />
            )}

            {config.type === 'slider' && (
                <div className="slider-wrapper">
                    <div className="slider-row">
                        <input className="slider" type="range" min={config.min} max={config.max}
                            step={config.step ?? 1} value={value as number}
                            onChange={e => onChange(config.key, Number(e.target.value))} />
                        <span className="slider-value">{value as number}{config.unit ?? ''}</span>
                    </div>
                </div>
            )}

            {config.type === 'select' && (
                <select className="field-select" value={value as string}
                    onChange={e => onChange(config.key, e.target.value)}>
                    {config.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            )}

            {config.type === 'color' &&
                <HslColorPicker
                    value={value as string}
                    onChange={v => onChange(config.key, v)}
                />
            }

            {config.type === 'zones' && (
                <div className="zone-grid">
                    {config.available.map(zone => {
                        const zones = value as Zone[];
                        const enabled = zones.find(z => z.id === zone.id)?.enabled ?? false;
                        return (
                            <button key={zone.id} type="button"
                                className={`zone-btn${enabled ? ' active' : ''}`}
                                onClick={() => {
                                    const exists = zones.find(z => z.id === zone.id);
                                    const next = exists
                                        ? zones.map(z => z.id === zone.id ? { ...z, enabled: !z.enabled } : z)
                                        : [...zones, { id: zone.id, enabled: true }];
                                    onChange(config.key, next);
                                }}>
                                {zone.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
