import { Copy, Info, Trash2 } from 'lucide-react';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  getNodeDef,
} from '../nodes/catalog';
import { useGraphStore } from '../store/useGraphStore';
import { ParamsPanel } from './ParamsPanel';
import { getInputPorts, getOutputPorts } from '../lib/ports';
import { PORT_COLORS, portTypeLabel } from '../types';
import type { ForgeEdge, ForgeNode, PortDef } from '../types';

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-forge-900/60 px-2.5 py-2">
      <div className="font-mono text-[21px] leading-none text-zinc-200">{value}</div>
      <div className="mt-1 text-[12px] uppercase tracking-[0.12em] text-zinc-600">{label}</div>
    </div>
  );
}

function PortRow({
  port,
  connected,
}: {
  port: PortDef;
  connected: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-forge-900/60 px-2 py-1.5">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: PORT_COLORS[port.type] }}
      />
      <span className="truncate text-[16px] text-zinc-300">{port.label}</span>
      <span className="ml-auto shrink-0 font-mono text-[12px] uppercase tracking-wide text-zinc-600">
        {portTypeLabel(port.type)}
        {port.many && port.artifactId === undefined && port.index === undefined ? ' · many' : ''}
      </span>
      {connected && (
        <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-400" title="Connected" />
      )}
    </div>
  );
}

function Overview({
  nodes,
  edges,
}: {
  nodes: ForgeNode[];
  edges: ForgeEdge[];
}) {
  return (
    <>
      <section className="rounded-xl border border-white/[0.06] bg-forge-850 p-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Pipeline overview
        </h3>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Stat label="Nodes" value={nodes.length} />
          <Stat label="Connections" value={edges.length} />
        </div>
        <div className="mt-3 space-y-1.5">
          {CATEGORY_ORDER.map((category) => {
            const meta = CATEGORY_META[category];
            const count = nodes.filter(
              (node) => getNodeDef(node.data.defType)?.category === category,
            ).length;
            return (
              <div key={category} className="flex items-center gap-2 text-[16px]">
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                <span className="text-zinc-400">{meta.label}</span>
                <span className="ml-auto font-mono text-zinc-600">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-2.5 rounded-xl border border-dashed border-white/[0.08] p-3">
        <div className="flex gap-2">
          <Info size={13} className="mt-0.5 shrink-0 text-sky-300/70" />
          <div>
            <div className="text-[16px] font-medium text-zinc-300">
              Image &amp; PDF engines ready
            </div>
            <p className="mt-1 text-[15px] leading-relaxed text-zinc-500">
              Upload images or PDFs, chain conversions and collect downloads. Text and
              document conversion are next.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4">
        <h3 className="px-0.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Shortcuts
        </h3>
        <div className="mt-2 space-y-1.5">
          {[
            ['Del / Backspace', 'Remove selection'],
            ['Shift + drag', 'Box select nodes'],
            ['Scroll', 'Zoom the canvas'],
            ['Drag canvas', 'Pan the view'],
          ].map(([keys, action]) => (
            <div key={keys} className="flex items-center justify-between gap-3 text-[15px]">
              <span className="text-zinc-500">{action}</span>
              <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[13px] text-zinc-500">
                {keys}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function NodeDetails({ node, edges }: { node: ForgeNode; edges: ForgeEdge[] }) {
  const def = getNodeDef(node.data.defType);
  const duplicateNode = useGraphStore((state) => state.duplicateNode);
  const deleteNodes = useGraphStore((state) => state.deleteNodes);

  if (!def) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-[16.5px] text-rose-300">
        Unknown node type “{node.data.defType}”.
      </div>
    );
  }

  const meta = CATEGORY_META[def.category];
  const Icon = def.icon;
  const incoming = new Set(
    edges
      .filter((edge) => edge.target === node.id)
      .map((edge) => edge.targetHandle)
      .filter((handle): handle is string => !!handle),
  );
  const outgoing = new Set(
    edges
      .filter((edge) => edge.source === node.id)
      .map((edge) => edge.sourceHandle)
      .filter((handle): handle is string => !!handle),
  );
  const inputs = getInputPorts(def, node, edges);
  const outputs = getOutputPorts(def, node, edges);

  return (
    <>
      <section className="rounded-xl border border-white/[0.06] bg-forge-850 p-3">
        <div className="flex items-start gap-2.5">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${meta.tint} ${meta.text}`}
          >
            <Icon size={17} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[18px] font-medium text-zinc-100">{def.label}</h3>
            <div
              className={`mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] ${meta.text} opacity-80`}
            >
              {meta.label}
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-[16px] leading-relaxed text-zinc-500">{def.description}</p>
      </section>

      <section className="mt-2.5 rounded-xl border border-white/[0.06] bg-forge-850 p-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Ports
        </h3>

        <div className="mt-2.5">
          <div className="mb-1 text-[13px] uppercase tracking-[0.12em] text-zinc-600">Inputs</div>
          <div className="space-y-1">
            {inputs.length > 0 ? (
              inputs.map((port) => (
                <PortRow
                  key={port.id}
                  port={port}
                  connected={incoming.has(port.id)}
                />
              ))
            ) : (
              <div className="rounded-md border border-dashed border-white/[0.06] px-2 py-1.5 text-[15px] text-zinc-600">
                No inputs
              </div>
            )}
          </div>
        </div>

        <div className="mt-2.5">
          <div className="mb-1 text-[13px] uppercase tracking-[0.12em] text-zinc-600">Outputs</div>
          <div className="space-y-1">
            {outputs.length > 0 ? (
              outputs.map((port) => (
                <PortRow
                  key={port.id}
                  port={port}
                  connected={outgoing.has(port.id)}
                />
              ))
            ) : (
              <div className="rounded-md border border-dashed border-white/[0.06] px-2 py-1.5 text-[15px] text-zinc-600">
                No outputs
              </div>
            )}
          </div>
        </div>
      </section>

      <ParamsPanel node={node} />

      <section className="mt-2.5 rounded-xl border border-white/[0.06] bg-forge-850 p-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Node
        </h3>
        <div className="mt-2 space-y-1.5 text-[15px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Type</span>
            <span className="truncate font-mono text-[13.5px] text-zinc-400">{def.type}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Position</span>
            <span className="font-mono text-[13.5px] text-zinc-400">
              {Math.round(node.position.x)}, {Math.round(node.position.y)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">ID</span>
            <span className="max-w-[150px] truncate font-mono text-[13.5px] text-zinc-500">
              {node.id}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => duplicateNode(node.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[16px] text-zinc-300 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
        >
          <Copy size={12} />
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => deleteNodes([node.id])}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-400/15 bg-rose-400/5 px-2 py-1.5 text-[16px] text-rose-300/90 transition-colors hover:border-rose-400/30 hover:bg-rose-400/10"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </>
  );
}

function MultiSelection({ selected }: { selected: ForgeNode[] }) {
  const deleteNodes = useGraphStore((state) => state.deleteNodes);

  return (
    <section className="rounded-xl border border-white/[0.06] bg-forge-850 p-3">
      <h3 className="text-[18px] font-medium text-zinc-100">
        {selected.length} nodes selected
      </h3>
      <p className="mt-1.5 text-[16px] leading-relaxed text-zinc-500">
        Drag to move them together, or remove the whole selection.
      </p>
      <div className="mt-2.5 space-y-1">
        {selected.slice(0, 6).map((node) => {
          const def = getNodeDef(node.data.defType);
          return (
            <div
              key={node.id}
              className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-forge-900/60 px-2 py-1.5 text-[16px] text-zinc-400"
            >
              <span className="truncate">{def?.label ?? node.data.defType}</span>
            </div>
          );
        })}
        {selected.length > 6 && (
          <div className="px-2 text-[15px] text-zinc-600">+{selected.length - 6} more</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => deleteNodes(selected.map((node) => node.id))}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-400/15 bg-rose-400/5 px-2 py-1.5 text-[16px] text-rose-300/90 transition-colors hover:border-rose-400/30 hover:bg-rose-400/10"
      >
        <Trash2 size={12} />
        Delete selection
      </button>
    </section>
  );
}

export function Inspector() {
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const selected = nodes.filter((node) => node.selected);

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col border-l border-white/[0.06] bg-forge-900 lg:flex">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-3.5">
        <h2 className="text-[15px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Inspector
        </h2>
        {selected.length > 0 && (
          <span className="rounded bg-[rgb(var(--accent)/0.12)] px-1.5 py-0.5 text-[13px] font-medium text-[rgb(var(--accent))]">
            {selected.length} selected
          </span>
        )}
      </div>

      <div className="forge-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {selected.length === 0 && <Overview nodes={nodes} edges={edges} />}
        {selected.length === 1 && <NodeDetails node={selected[0]} edges={edges} />}
        {selected.length > 1 && <MultiSelection selected={selected} />}
      </div>
    </aside>
  );
}
