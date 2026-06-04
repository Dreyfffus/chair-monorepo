import { useEffect, useState } from 'react';
import { listPresets, loadPreset } from '../api';
import { PresetCard } from '../components/PresetCard';
import { ThemeToggle } from '../components/ThemeToggle';
import type { Preset } from '../types';
import { Theme } from '../hooks/useTheme';

const MAX_PRESETS = 25;

interface PresetListPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
  onNew: () => void;
  onEdit: (preset: Preset) => void;
  onLoad: (preset: Preset) => void;
  onStats: () => void;
}

export function PresetListPage({ theme, onToggleTheme, onBack, onNew, onEdit, onLoad, onStats }: PresetListPageProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPresets()
      .then(setPresets)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleLoad = async (preset: Preset) => {
    try {
      if (preset.id.startsWith('test-')) {
        const updated = await loadPreset(preset.name);
        setPresets(prev =>
          prev.map(p => p.name === updated.name ? updated : p)
            .sort((a, b) => b.times_loaded - a.times_loaded)
        );
        onLoad(updated);
      } else {
        onLoad(preset);
      }
    } catch (e) { console.error(e); }
  };

  const maxLoaded = Math.max(...presets.map(p => p.times_loaded), 0);
  const atLimit = presets.length >= MAX_PRESETS;

  return (
    <div className="page list-page">
      <div className="list-header">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <h2 className="list-title">Presets</h2>
        <div className="list-header-right">
          {atLimit && <span className="limit-badge">Limit reached</span>}
          <button className="btn btn-ghost" onClick={onStats}>Stats</button>
          <button className="btn btn-primary" onClick={onNew} disabled={atLimit}>+ New</button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      <div className="list-body">
        {loading && <p className="list-empty">Loading…</p>}
        {error && <p className="list-empty" style={{ color: 'var(--negative)' }}>{error}</p>}
        {!loading && !error && presets.length === 0 && (
          <div className="list-empty-state">
            <p className="list-empty">No presets yet.</p>
            <button className="btn btn-primary" onClick={onNew}>Create your first preset</button>
          </div>
        )}
        {!loading && presets.map((preset, i) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            rank={i}
            maxLoaded={maxLoaded}
            onLoad={() => handleLoad(preset)}
            onEdit={() => onEdit(preset)}
          />
        ))}
      </div>
    </div>
  );
}
