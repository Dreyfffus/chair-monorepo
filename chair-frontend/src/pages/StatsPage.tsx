import { useEffect, useState } from 'react';
import { getStats } from '../api';
import { ThemeToggle } from '../components/ThemeToggle';
import type { Stats } from '../types';
import type { Theme } from '../hooks/useTheme';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function HeatBar({ label, dist }: { label: string; dist: Stats['heating']['lumbar'] }) {
  const total = dist.off + dist.low + dist.medium + dist.high;
  if (total === 0) return null;
  const pct = (n: number) => ((n / total) * 100).toFixed(0) + '%';
  return (
    <div className="heat-bar-row">
      <span className="heat-bar-label">{label}</span>
      <div className="heat-bar-track">
        {dist.low > 0 && <div className="heat-bar-seg heat-low" style={{ width: pct(dist.low) }} title={`Low: ${dist.low}`} />}
        {dist.medium > 0 && <div className="heat-bar-seg heat-medium" style={{ width: pct(dist.medium) }} title={`Med: ${dist.medium}`} />}
        {dist.high > 0 && <div className="heat-bar-seg heat-high" style={{ width: pct(dist.high) }} title={`High: ${dist.high}`} />}
        {dist.off > 0 && <div className="heat-bar-seg heat-off" style={{ width: pct(dist.off) }} title={`Off: ${dist.off}`} />}
      </div>
      <span className="heat-bar-pct">
        {total > 0 ? Math.round(((dist.low + dist.medium + dist.high) / total) * 100) : 0}% active
      </span>
    </div>
  );
}

interface StatsPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
}

export function StatsPage({ theme, onToggleTheme, onBack }: StatsPageProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page stats-page">
      <div className="list-header">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <h2 className="list-title">Statistics</h2>
        <div className="list-header-right">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      <div className="stats-body">
        {loading && <p className="list-empty">Loading…</p>}
        {error && <p className="list-empty" style={{ color: 'var(--negative)' }}>{error}</p>}

        {stats && (
          <>
            <div className="stats-overview">
              <div className="stat-card">
                <span className="stat-card-value">{stats.total_sessions}</span>
                <span className="stat-card-label">Total sessions</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{formatDuration(stats.total_duration_seconds)}</span>
                <span className="stat-card-label">Total time</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{formatDuration(Math.round(stats.avg_duration_seconds))}</span>
                <span className="stat-card-label">Avg session</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{Math.round(stats.avg_chair_angle)}°</span>
                <span className="stat-card-label">Avg angle</span>
              </div>
            </div>

            <div className="stats-section">
              <p className="stats-section-title">Heating zones</p>
              <HeatBar label="Lumbar" dist={stats.heating.lumbar} />
              <HeatBar label="Upper back" dist={stats.heating.upper_back} />
              <HeatBar label="Legs" dist={stats.heating.legs} />
            </div>

            <div className="stats-section">
              <p className="stats-section-title">Lighting</p>
              {(() => {
                const total = stats.lighting.circadian + stats.lighting.manual;
                if (total === 0) return <p className="list-empty">No data yet</p>;
                const circPct = Math.round((stats.lighting.circadian / total) * 100);
                return (
                  <div className="light-bar-row">
                    <div className="light-bar-track">
                      <div className="light-bar-circadian" style={{ width: `${circPct}%` }} />
                    </div>
                    <div className="light-bar-legend">
                      <span className="light-legend-dot circadian-dot" />
                      <span className="ts">Circadian {circPct}%</span>
                      <span className="light-legend-dot manual-dot" />
                      <span className="ts">Manual {100 - circPct}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
