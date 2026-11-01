import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { Palette } from './components/Palette';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';

export default function App() {
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
