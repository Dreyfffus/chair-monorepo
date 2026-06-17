import { useRef, useState, useCallback, useEffect } from 'react';
import { adjustSerial, cancelSession, getSerialStatus, recordSession } from '../api';
import { getCircadianLightColor } from '../utils/colors';
import { THEME_BG } from '../hooks/useTheme';
import { useWebGLSession } from '../hooks/useWebGLSession';
import { MidSessionPanel } from '../components/MidSessionPanel';
import type { Theme } from '../hooks/useTheme';
import type { Preset, SessionSettings } from '../types';

const STATUS_POLL_MS = 800;

interface ActiveSessionPageProps {
  preset: Preset;
  onFinish: () => void;
  onCancel: () => void;
}

export function ActiveSessionPage({ preset, onFinish, onCancel }: ActiveSessionPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const calledRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const [showPanel, setShowPanel] = useState(false);

  // True while the servo is still travelling to the requested angle. Starts
  // true because loading the preset just commanded the chair into position.
  const [busy, setBusy] = useState(true);
  const [cooldownMsg, setCooldownMsg] = useState<string | null>(null);

  // Active settings — start from preset, may be adjusted mid-session
  const [settings, setSettings] = useState<SessionSettings>({
    chair_angle_degrees: preset.chair_angle_degrees,
    lumbar_heat: preset.lumbar_heat,
    upper_back_heat: preset.upper_back_heat,
    leg_heat: preset.leg_heat,
    light_mode: preset.light_mode,
    light_color: preset.light_color,
  });

  // Poll the backend for the chair's motion state so the controls stay locked
  // until the servo finishes moving.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const st = await getSerialStatus();
        if (!alive) return;
        // Only gate on real hardware; in no-hardware/test mode never block.
        setBusy(st.hardware_connected ? st.moving : false);
        if (st.hardware_connected && !st.moving) setCooldownMsg(null);
      } catch {
        if (alive) setBusy(false);
      }
    };
    tick();
    const id = setInterval(tick, STATUS_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const currentTheme = (document.documentElement.getAttribute('data-theme') ?? 'dark') as Theme;
  const bgColor = THEME_BG[currentTheme];
  const lightColor = settings.light_mode === 'manual' && settings.light_color
    ? settings.light_color
    : getCircadianLightColor(new Date());

  const handleFinishInternal = useCallback(async (elapsed: number) => {
    if (calledRef.current) return;
    calledRef.current = true;

    try {
      if (!preset.name.startsWith('test-')) {
        await recordSession(preset.name, Math.max(1, elapsed), settings);
      }
    } catch (e) { console.error('Failed to record session:', e); }

    onFinish();
  }, [preset, settings, onFinish]);

  useWebGLSession(canvasRef, lightColor, bgColor);

  const handleEndSession = () => {
    const elapsed = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    handleFinishInternal(elapsed);
  };

  const handleCancel = async () => {
    await cancelSession();
    onCancel();
  }

  const handleApplySettings = async (s: SessionSettings) => {
    if (busy) {
      setCooldownMsg('Chair is still moving — please wait.');
      return;
    }
    const angleChanged = s.chair_angle_degrees !== settings.chair_angle_degrees;
    const result = await adjustSerial(s);
    if (result.busy) {
      setCooldownMsg('Chair is still moving — please wait.');
      return;
    }
    setSettings(s);
    // A new angle command starts a servo move — lock until the poll clears it.
    if (result.moving || angleChanged) {
      setBusy(true);
      setCooldownMsg('Chair is adjusting to the new position…');
    }
  }

  const openPanel = () => {
    if (busy) {
      setCooldownMsg('Chair is still moving — adjustments are paused.');
      return;
    }
    setShowPanel(true);
  };

  return (
    <div className="page active-session-page">
      <canvas ref={canvasRef} className="session-canvas" />

      <div className="session-label">
        <p className="session-preset-name">{preset.name}</p>
        <p className="session-mode-label">
          {busy ? 'Adjusting position…' : 'Session in progress'}
        </p>
      </div>

      {busy && cooldownMsg && (
        <div className="session-cooldown" role="status">{cooldownMsg}</div>
      )}

      <div className="session-actions">
        <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
        <button className="btn btn-ghost" onClick={openPanel} disabled={busy}>
          {busy ? 'Adjust (locked)' : 'Adjust'}
        </button>
        <button className="btn btn-primary" onClick={handleEndSession}>End Session</button>
      </div>

      {showPanel && (
        <MidSessionPanel
          current={settings}
          locked={busy}
          onApply={handleApplySettings}
          onClose={() => setShowPanel(false)}
        />
      )}
    </div>
  );
}

