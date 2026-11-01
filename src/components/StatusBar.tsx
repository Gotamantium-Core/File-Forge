import { MousePointer2 } from 'lucide-react';
import { useGraphStore } from '../store/useGraphStore';

export function StatusBar() {
  const nodeCount = useGraphStore((state) => state.nodes.length);
  const edgeCount = useGraphStore((state) => state.edges.length);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-white/[0.06] bg-forge-900 px-3.5 text-[10px] text-zinc-600">
      <div className="flex items-center gap-3">
        <span>
          <span className="font-mono text-zinc-400">{nodeCount}</span> nodes
        </span>
        <span>
          <span className="font-mono text-zinc-400">{edgeCount}</span> connections
        </span>
      </div>

      <div className="hidden items-center gap-1.5 sm:flex">
        <MousePointer2 size={10} />
        Drag a right port into a left port to connect
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <span>
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 font-mono text-[9px] text-zinc-500">
            Del
          </kbd>{' '}
          remove
        </span>
        <span>
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 font-mono text-[9px] text-zinc-500">
            Shift
          </kbd>{' '}
          + drag to select
        </span>
      </div>
    </footer>
  );
}
