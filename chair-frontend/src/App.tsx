// src/App.tsx
// Provisioning gate — checks if this machine has credentials in localStorage.
// If not, it calls the backend once to register, then stores the result.
// After that it renders the Dashboard on every subsequent load.

import { useState, useEffect } from 'react';
import { isProvisioned, provisionMachine } from './api';
import { Dashboard } from './Dashboard';

type Status = 'checking' | 'provisioning' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isProvisioned()) {
      setStatus('ready');
      return;
    }

    setStatus('provisioning');
    provisionMachine()
      .then(() => setStatus('ready'))
      .catch((err: Error) => {
        setError(err.message);
        setStatus('error');
      });
  }, []);

  if (status === 'checking' || status === 'provisioning') return null;

  if (status === 'error') {
    return <p>Failed to connect to backend: {error}</p>;
  }

  return <Dashboard />;
}
