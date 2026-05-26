import { useState, useEffect, useRef } from 'react';
import { isProvisioned, provisionMachine } from './api';
import { useTheme } from './hooks/useTheme';
import { Dashboard } from './Dashboard';

type Status = 'checking' | 'provisioning' | 'ready' | 'error';

export default function App() {
    const [status, setStatus] = useState<Status>('checking');
    const [error, setError] = useState<string | null>(null);
    const provisioningRef = useRef(false);
    const { theme, toggle } = useTheme();

    useEffect(() => {
        if (isProvisioned()) { setStatus('ready'); return; }
        if (provisioningRef.current) return;
        provisioningRef.current = true;
        setStatus('provisioning');
        provisionMachine()
            .then(() => setStatus('ready'))
            .catch((err: Error) => { setError(err.message); setStatus('error'); });
    }, []);

    if (status === 'checking' || status === 'provisioning') return null;
    if (status === 'error') return <p style={{ color: 'var(--negative)', padding: 32 }}>Failed to connect: {error}</p>;

    return (
        <>
            <Dashboard theme={theme} onToggleTheme={toggle} />
        </>
    );
}
