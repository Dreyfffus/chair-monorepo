import { useRef } from 'react';
import { recordSession } from '../api';
import { getCircadianLightColor } from '../utils/colors';
import { THEME_BG } from '../hooks/useTheme';
import { useWebGLSession } from '../hooks/useWebGLSession';
import type { Theme } from '../hooks/useTheme';
import type { Preset } from '../types';

const MODE_DURATION: Record<string, number> = {
    recharge: 300,
    relax: 900,
    test: 10,
};

interface ActiveSessionPageProps {
    preset: Preset;
    onFinish: () => void;
    onCancel: () => void;
}

export function ActiveSessionPage({ preset, onFinish, onCancel }: ActiveSessionPageProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const finishedRef = useRef(false);
    const startTimeRef = useRef(Date.now());

    const total = MODE_DURATION[preset.mode] ?? 900;
    const currentTheme = (document.documentElement.getAttribute('data-theme') ?? 'dark') as Theme;
    const bgColor = THEME_BG[currentTheme];
    const lightColor = preset.light_mode === 'manual' && preset.light_color
        ? preset.light_color
        : getCircadianLightColor(new Date());

    const handleFinishInternal = async (elapsed: number) => {
        try {
            if (preset.mode !== 'test') {
                await recordSession(preset.name, Math.max(1, elapsed));
            }
        } catch (e) { console.error('Failed to record session:', e); }
        setTimeout(onFinish, 1500);
    };

    useWebGLSession(canvasRef, lightColor, bgColor, total, (elapsed) => {
        if (!finishedRef.current) {
            finishedRef.current = true;
            handleFinishInternal(elapsed);
        }
    });

    const handleFinish = async () => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        const elapsed = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
        await handleFinishInternal(elapsed);
    };

    return (
        <div className="page active-session-page">
            <canvas ref={canvasRef} className="session-canvas" />

            <div className="session-label">
                <p className="session-preset-name">{preset.name}</p>
                <p className="session-mode-label">
                    {preset.mode === 'recharge' ? 'Recharge · 5 min'
                        : preset.mode === 'test' ? 'Test · 10 sec'
                            : 'Relax · 15 min'}
                </p>
            </div>

            <div className="session-actions">
                <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button className="btn btn-primary" onClick={handleFinish}>Finish Session</button>
            </div>
        </div>
    );
}
