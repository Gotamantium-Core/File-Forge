import {
  CheckCircle2,
  Hammer,
  Loader2,
  Play,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { formatDuration } from '../lib/format';
import { useGraphStore } from '../store/useGraphStore';
import { useRunStore } from '../store/useRunStore';

export function TopBar() {
  const projectName = useGraphStore((state) => state.projectName);
  const setProjectName = useGraphStore((state) => state.setProjectName);
  const nodeCount = useGraphStore((state) => state.nodes.length);
  const clearGraph = useGraphStore((state) => state.clearGraph);
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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-forge-900/80 px-3.5 backdrop-blur sm:gap-4">
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-forge-950 shadow-lg shadow-amber-500/20">
          <Hammer size={16} strokeWidth={2.4} />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-semibold tracking-tight text-zinc-100">File Forge</div>
          <div className="mt-1 text-[8px] font-medium uppercase tracking-[0.22em] text-zinc-500">
            Node converter
          </div>
        </div>
      </div>

      <div className="h-6 w-px shrink-0 bg-white/[0.06]" />

      <label className="flex min-w-0 items-center gap-2">
        <span className="hidden text-[9px] uppercase tracking-[0.14em] text-zinc-600 md:inline">
          Project
        </span>
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          maxLength={64}
          spellCheck={false}
          aria-label="Project name"
          className="w-32 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-[12px] text-zinc-200 transition-colors hover:border-white/10 focus:border-amber-400/40 focus:bg-forge-850 focus:outline-none sm:w-52"
        />
      </label>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
        <div className="hidden items-center gap-1.5 text-[10.5px] sm:flex">
          {runStatus === 'idle' && (
            <>
              <CheckCircle2 size={12} className="text-emerald-400/80" />
              <span className="text-zinc-500">Saved locally</span>
            </>
          )}
          {isRunning && (
            <>
              <Loader2 size={12} className="animate-spin text-amber-300" />
              <span className="text-amber-300/90">Converting…</span>
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

        <button
          type="button"
          onClick={handleClear}
          disabled={nodeCount === 0}
          className="flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-white/[0.08] hover:bg-white/[0.03] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
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
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ring-1 ring-inset transition-colors ${
            nodeCount === 0 || isRunning
              ? 'cursor-not-allowed bg-amber-400/10 text-amber-200/50 ring-amber-300/10'
              : 'bg-amber-400/15 text-amber-200 ring-amber-300/25 hover:bg-amber-400/25 hover:text-amber-100'
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
