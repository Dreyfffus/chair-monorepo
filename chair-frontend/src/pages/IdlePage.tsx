import { useEffect, useState } from 'react';
import { getOrbColor } from '../utils/colors';
import { ThemeToggle } from '../components/ThemeToggle';
import { Theme } from '../hooks/useTheme';

interface IdlePageProps {
    theme: Theme;
    onToggleTheme: () => void;
    onStart: () => void;
}


export function IdlePage({ theme, onToggleTheme, onStart }: IdlePageProps) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const hh = time.getHours().toString().padStart(2, '0');
    const mm = time.getMinutes().toString().padStart(2, '0');
    const orbColor = getOrbColor(time);

    return (
        <div className="page idle-page">
            <div className="idle-topbar">
                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            </div>
            <div className="idle-orb" style={{ background: `radial-gradient(circle, ${orbColor} 0%, transparent 70%)` }} />
            <div className="idle-content">
                <div className="idle-time">{hh}<span className="idle-colon">:</span>{mm}</div>
                <h1 className="idle-heading">Ready for your session</h1>
                <p className="idle-sub">Select a preset or configure your own</p>
                <button className="btn btn-primary idle-cta" onClick={onStart}>Begin Session</button>
            </div>
        </div>
    );
}
