import { useState } from 'react';
import { IdlePage } from './pages/IdlePage';
import { PresetListPage } from './pages/PresetListPage';
import { PresetFormPage } from './pages/PresetFormPage';
import { ActiveSessionPage } from './pages/ActiveSessionPage';
import type { Theme } from './hooks/useTheme'
import type { Preset } from './types';


type View =
    | { name: 'idle' }
    | { name: 'list' }
    | { name: 'form'; editing?: Preset }
    | { name: 'active'; preset: Preset };

interface DashboardProps {
    theme: Theme;
    onToggleTheme: () => void;
}

export function Dashboard({ theme, onToggleTheme }: DashboardProps) {
    const [view, setView] = useState<View>({ name: 'idle' });

    if (view.name === 'idle')
        return <IdlePage theme={theme} onToggleTheme={onToggleTheme} onStart={() => setView({ name: 'list' })} />;

    if (view.name === 'list')
        return (
            <PresetListPage
                theme={theme}
                onToggleTheme={onToggleTheme}
                onBack={() => setView({ name: 'idle' })}
                onNew={() => setView({ name: 'form' })}
                onEdit={preset => setView({ name: 'form', editing: preset })}
                onLoad={preset => setView({ name: 'active', preset })}
            />
        );

    if (view.name === 'form')
        return (
            <PresetFormPage
                theme={theme}
                onToggleTheme={onToggleTheme}
                editing={view.editing}
                onBack={() => setView({ name: 'list' })}
                onSaved={() => setView({ name: 'list' })}
            />
        );

    if (view.name === 'active')
        return (
            <ActiveSessionPage
                preset={view.preset}
                onFinish={() => setView({ name: 'idle' })}
                onCancel={() => setView({ name: 'list' })}
            />
        );

    return null;
}
