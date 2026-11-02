import { useMemo, useState, type DragEvent } from 'react';
import { GripVertical, Search } from 'lucide-react';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  describePorts,
  NODE_DEFS,
} from '../nodes/catalog';
import { useGraphStore } from '../store/useGraphStore';
import type { NodeDef } from '../types';

function PaletteItem({ def }: { def: NodeDef }) {
  const meta = CATEGORY_META[def.category];
  const addNode = useGraphStore((state) => state.addNode);
  const Icon = def.icon;

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData('application/forge-node', def.type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={() => addNode(def.type)}
      title={def.description}
      className="group flex w-full cursor-grab items-center gap-2 rounded-lg border border-transparent px-1.5 py-1.5 text-left transition-colors hover:border-white/[0.07] hover:bg-forge-850 active:cursor-grabbing"
    >
      <span
        className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md ${meta.tint} ${meta.text}`}
      >
        <Icon size={13} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] text-zinc-300 group-hover:text-zinc-100">
          {def.label}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[12px] text-zinc-600">
          {describePorts(def)}
        </span>
      </span>
      <GripVertical
        size={12}
        className="shrink-0 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}

export function Palette() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return NODE_DEFS;
    return NODE_DEFS.filter((def) => {
      const category = CATEGORY_META[def.category].label.toLowerCase();
      return (
        def.label.toLowerCase().includes(needle) ||
        def.description.toLowerCase().includes(needle) ||
        def.type.toLowerCase().includes(needle) ||
        category.includes(needle)
      );
    });
  }, [query]);

  return (
    <aside className="flex w-[288px] shrink-0 flex-col border-r border-white/[0.06] bg-forge-900">
      <div className="px-3 pb-2 pt-3.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-[15px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Node library
          </h2>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[13px] text-zinc-500">
            {NODE_DEFS.length}
          </span>
        </div>
        <div className="relative mt-2.5">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nodes…"
            spellCheck={false}
            className="w-full rounded-lg border border-white/[0.07] bg-forge-950/60 py-1.5 pl-8 pr-2.5 text-[16.5px] text-zinc-300 placeholder:text-zinc-600 focus:border-amber-400/40 focus:outline-none focus:ring-1 focus:ring-amber-400/10"
          />
        </div>
      </div>

      <div className="forge-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {CATEGORY_ORDER.map((category) => {
          const defs = filtered.filter((def) => def.category === category);
          if (defs.length === 0) return null;
          const meta = CATEGORY_META[category];

          return (
            <section key={category} className="mt-3 first:mt-1">
              <div className="flex items-center gap-1.5 px-1.5 pb-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {meta.label}
                </h3>
                <span className="ml-auto font-mono text-[13px] text-zinc-600">{defs.length}</span>
              </div>
              <div className="space-y-0.5">
                {defs.map((def) => (
                  <PaletteItem key={def.type} def={def} />
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div className="mt-8 px-4 text-center text-[16.5px] leading-relaxed text-zinc-600">
            No nodes match “{query}”.
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-zinc-600">
        Drag a node onto the canvas, or click to add it.
      </div>
    </aside>
  );
}
