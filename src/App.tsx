import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { Palette } from './components/Palette';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { useGraphStore } from './store/useGraphStore';
import type { AccentColor } from './store/useGraphStore';

const ACCENTS: Record<AccentColor, { accent: string; strong: string }> = {
  amber: { accent: '251 191 36', strong: '245 158 11' },
  red: { accent: '248 113 113', strong: '239 68 68' },
  blue: { accent: '96 165 250', strong: '59 130 246' },
  green: { accent: '74 222 128', strong: '34 197 94' },
  purple: { accent: '168 85 247', strong: '147 51 234' },
};

export default function App() {
  const accentColor = useGraphStore((state) => state.accentColor);
  const snapAllNodes = useGraphStore((state) => state.snapAllNodes);

  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENTS[accentColor];
    root.style.setProperty('--accent', accent.accent);
    root.style.setProperty('--accent-strong', accent.strong);
  }, [accentColor]);

  useEffect(() => {
    snapAllNodes();
  }, [snapAllNodes]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-forge-950 text-zinc-200">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Palette />
          <main className="relative min-w-0 flex-1">
            <Canvas />
          </main>
          <Inspector />
        </div>
        <StatusBar />
      </div>
    </ReactFlowProvider>
  );
}
