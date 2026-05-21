// src/Dashboard.tsx
// Your canvas. The machine is already provisioned when this renders.
//
// Use listPresets() to load on mount.
// Use createPreset() when the user creates a new preset.
// Use updatePreset(name, values) when the user saves changes to an existing one.
// The preset name is the key — treat it as the identifier, not the id.

import { useEffect, useState } from 'react';
import { listPresets, createPreset, updatePreset } from './api';
import type { Preset } from './types';

export function Dashboard() {
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    listPresets()
      .then(setPresets)
      .catch(console.error);
  }, []);

  // Everything below this line is yours to build.
  return (
    <div>
      <pre>{JSON.stringify(presets, null, 2)}</pre>
    </div>
  );
}
