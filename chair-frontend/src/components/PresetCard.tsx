import type { Preset } from '../types';

const MODE_LABELS = {
    recharge: 'Recharge · 5 min',
    relax: 'Relax · 15 min',
};

interface PresetCardProps {
    preset: Preset;
    rank: number;
    maxLoaded: number;
    onLoad: () => void;
    onEdit: () => void;
}

export function PresetCard({ preset, rank, maxLoaded, onLoad, onEdit }: PresetCardProps) {
    const glowOpacity = maxLoaded > 0 ? (preset.times_loaded / maxLoaded) * 0.5 : 0;

    const lightSwatch = preset.light_mode === 'manual' && preset.light_color
        ? preset.light_color
        : null;

    return (
        <div className="preset-card" style={{ boxShadow: glowOpacity > 0 ? `0 0 24px rgba(196, 152, 90, ${glowOpacity}), inset 0 1px 0 rgba(196, 152, 90, ${glowOpacity * 0.5})` : undefined }}>
            <div className="preset-card-header">
                <div className="preset-rank">#{rank + 1}</div>
                <div className="preset-meta">
                    <span className="preset-name">{preset.name}</span>
                    <span className="preset-loads">
                        {preset.times_loaded === 0 ? 'Never used' : `${preset.times_loaded} session${preset.times_loaded === 1 ? '' : 's'}`}
                    </span>
                </div>
            </div>

            <div className="preset-stats">
                <div className="preset-stat">
                    <span className="stat-label">Mode</span>
                    <span className="stat-value">{MODE_LABELS[preset.mode]}</span>
                </div>
                <div className="preset-stat">
                    <span className="stat-label">Angle</span>
                    <span className="stat-value">{preset.chair_angle_degrees}°</span>
                </div>
                <div className="preset-stat">
                    <span className="stat-label">Light</span>
                    {lightSwatch
                        ? <span className="stat-swatch" style={{ background: lightSwatch }} />
                        : <span className="stat-value">Circadian</span>
                    }
                </div>
            </div>

            <div className="preset-card-actions">
                <button className="btn btn-ghost" onClick={onEdit}>Configure</button>
                <button className="btn btn-primary" onClick={onLoad}>Load</button>
            </div>
        </div>
    );
}
