import {
  CheckCircle2,
  GitBranch,
  Hammer,
  Loader2,
  Minus,
  Play,
  Spline,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { formatDuration } from '../lib/format';
import { useGraphStore } from '../store/useGraphStore';
import type { AccentColor, EdgeStyle } from '../store/useGraphStore';
import { useRunStore } from '../store/useRunStore';

const EDGE_STYLES: { value: EdgeStyle; label: string; icon: typeof Spline }[] = [
  { value: 'smoothstep', label: 'Smooth', icon: Spline },
  { value: 'bezier', label: 'Curved', icon: GitBranch },
  { value: 'step', label: 'Step', icon: Minus },
  { value: 'straight', label: 'Straight', icon: Minus },
];

const ACCENTS: { value: AccentColor; label: string; color: string }[] = [
  { value: 'amber', label: 'Yellow', color: '#fbbf24' },
  { value: 'red', label: 'Red', color: '#f87171' },
  { value: 'blue', label: 'Blue', color: '#60a5fa' },
  { value: 'green', label: 'Green', color: '#4ade80' },
  { value: 'purple', label: 'Purple', color: '#a855f7' },
];

export function TopBar() {
  const nodeCount = useGraphStore((state) => state.nodes.length);
  const clearGraph = useGraphStore((state) => state.clearGraph);
  const edgeStyle = useGraphStore((state) => state.edgeStyle);
  const setEdgeStyle = useGraphStore((state) => state.setEdgeStyle);
  const accentColor = useGraphStore((state) => state.accentColor);
  const setAccentColor = useGraphStore((state) => state.setAccentColor);
  const runStatus = useRunStore((state) => state.status);
  const outputs = useRunStore((state) => state.outputs);
  const runError = useRunStore((state) => state.error);
  const durationMs = useRunStore((state) => state.durationMs);
  const run = useRunStore((state) => state.run);
  const resetRun = useRunStore((state) => state.reset);

  const isRunning = runStatus === 'running';

  const handleClear = () => {
    if (nodeCount === 0) return;
    if (window.confirm('Clear the canvas? This removes every node and connection.')) {
      clearGraph();
      resetRun();
    }
  };

  const handleRun = () => {
    const { nodes, edges } = useGraphStore.getState();
    void run(nodes, edges);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-forge-900/80 px-3.5 backdrop-blur sm:gap-4">
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-forge-950 shadow-lg shadow-amber-500/20">
          <Hammer size={16} strokeWidth={2.4} />
        </div>
        <div className="leading-none">
          <div className="text-[18px] font-semibold tracking-tight text-zinc-100">File Forge</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
            Node converter
          </div>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
        <div className="hidden items-center gap-1.5 text-[16px] sm:flex">
          {runStatus === 'idle' && (
            <>
              <CheckCircle2 size={12} className="text-emerald-400/80" />
              <span className="text-zinc-500">Saved locally</span>
            </>
          )}
          {isRunning && (
            <>
              <Loader2 size={12} className="animate-spin text-[rgb(var(--accent))]" />
              <span className="text-[rgb(var(--accent))]/90">Converting…</span>
            </>
          )}
          {runStatus === 'success' && (
            <>
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span
                className="text-emerald-300/90"
                title={`Finished in ${formatDuration(durationMs ?? 0)}`}
              >
                {outputs.length > 0
                  ? `${outputs.length} file${outputs.length === 1 ? '' : 's'} ready`
                  : 'Run complete'}
              </span>
            </>
          )}
          {runStatus === 'error' && (
            <>
              <TriangleAlert size={12} className="text-rose-400" />
              <span className="max-w-[180px] truncate text-rose-300/90" title={runError}>
                {runError ?? 'Run failed'}
              </span>
            </>
          )}
        </div>

        <div className="hidden h-6 w-px bg-white/[0.06] sm:block" />

        <div className="hidden items-center rounded-lg border border-white/[0.08] bg-forge-850/60 p-0.5 md:flex">
          {ACCENTS.map((accent) => (
            <button
              key={accent.value}
              type="button"
              onClick={() => setAccentColor(accent.value)}
              title={accent.label}
              className="grid h-6 w-6 place-items-center rounded-md"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ring-1 ring-inset ${
                  accentColor === accent.value
                    ? 'ring-white/60'
                    : 'ring-white/20'
                }`}
                style={{ backgroundColor: accent.color }}
              />
            </button>
          ))}
        </div>

        <div className="hidden items-center rounded-lg border border-white/[0.08] bg-forge-850/60 p-0.5 md:flex">
          {EDGE_STYLES.map((style) => {
            const Icon = style.icon;
            const active = edgeStyle === style.value;
            return (
              <button
                key={style.value}
                type="button"
                onClick={() => setEdgeStyle(style.value)}
                title={style.label}
                className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
                  active
                    ? 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                }`}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleClear}
          disabled={nodeCount === 0}
          className="flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-[16.5px] text-zinc-400 transition-colors hover:border-white/[0.08] hover:bg-white/[0.03] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Trash2 size={12} />
          <span className="hidden md:inline">Clear</span>
        </button>

        <button
          type="button"
          onClick={handleRun}
          disabled={nodeCount === 0 || isRunning}
          title={
            nodeCount === 0
              ? 'Add nodes to build a pipeline first.'
              : isRunning
                ? 'The pipeline is already running.'
                : 'Run the pipeline'
          }
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[16.5px] font-medium ring-1 ring-inset transition-colors ${
            nodeCount === 0 || isRunning
              ? 'cursor-not-allowed bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent)/0.45)] ring-[rgb(var(--accent)/0.12)]'
              : 'bg-[rgb(var(--accent)/0.16)] text-[rgb(var(--accent))] ring-[rgb(var(--accent)/0.28)] hover:bg-[rgb(var(--accent)/0.26)]'
          }`}
        >
          {isRunning ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Play size={12} fill="currentColor" />
          )}
          <span className="hidden sm:inline">{isRunning ? 'Running…' : 'Run pipeline'}</span>
        </button>
      </div>
    </header>
  );
}
