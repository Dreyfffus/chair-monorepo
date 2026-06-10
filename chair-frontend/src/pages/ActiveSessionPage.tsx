import { useRef, useState, useCallback } from 'react';
import { adjustSerial, cancelSession, recordSession } from '../api';
import { getCircadianLightColor } from '../utils/colors';
import { THEME_BG } from '../hooks/useTheme';
import { useWebGLSession } from '../hooks/useWebGLSession';
import { MidSessionPanel } from '../components/MidSessionPanel';
import type { Theme } from '../hooks/useTheme';
import type { Preset, SessionSettings } from '../types';

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

  // Active settings — start from preset, may be adjusted mid-session
  const [settings, setSettings] = useState<SessionSettings>({
    chair_angle_degrees: preset.chair_angle_degrees,
    lumbar_heat: preset.lumbar_heat,
    upper_back_heat: preset.upper_back_heat,
    leg_heat: preset.leg_heat,
    light_mode: preset.light_mode,
    light_color: preset.light_color,
  });



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
    setSettings(s);
    await adjustSerial(s);
  }


  return (
    <div className="page active-session-page">
      <canvas ref={canvasRef} className="session-canvas" />

      <div className="session-label">
        <p className="session-preset-name">{preset.name}</p>
        <p className="session-mode-label">Session in progress</p>
      </div>

      <div className="session-actions">
        <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
        <button className="btn btn-ghost" onClick={() => setShowPanel(true)}>Adjust</button>
        <button className="btn btn-primary" onClick={handleEndSession}>End Session</button>
      </div>

      {showPanel && (
        <MidSessionPanel
          current={settings}
          onApply={handleApplySettings}
          onClose={() => setShowPanel(false)}
        />
      )}
    </div>
  );
}
