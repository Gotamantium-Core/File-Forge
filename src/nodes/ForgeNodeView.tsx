import { Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';
import type { NodeProps } from '@xyflow/react';
import { artifactThumbUrl } from '../lib/api';
import { formatDuration } from '../lib/format';
import { getInputPorts, getOutputPorts } from '../lib/ports';
import { useGraphStore } from '../store/useGraphStore';
import { useRunStore } from '../store/useRunStore';
import { PORT_COLORS } from '../types';
import type { ForgeNode, PortDef } from '../types';
import { CATEGORY_META, getNodeDef } from './catalog';

function PortRow({ port, side }: { port: PortDef; side: 'input' | 'output' }) {
  const color = PORT_COLORS[port.type];
  const isOutput = side === 'output';
  const isDynamic = port.artifactId !== undefined || port.index !== undefined;

  return (
    <div
      className={`relative flex h-5 items-center ${isOutput ? 'justify-end text-right' : ''}`}
    >
      {!isOutput && (
        <Handle
          type="target"
          position={Position.Left}
          id={port.id}
          className="forge-handle"
          style={{ left: -12, background: color, borderColor: '#111118' }}
        />
      )}
      <span className="max-w-full truncate text-[9.5px] text-zinc-400">
        {port.label}
        {port.many && !isDynamic && (
          <span className="ml-1 tracking-tighter text-zinc-600">•••</span>
        )}
      </span>
      {isOutput && (
        <Handle
          type="source"
          position={Position.Right}
          id={port.id}
          className="forge-handle"
          style={{ right: -12, background: color, borderColor: '#111118' }}
        />
      )}
    </div>
  );
}

export function ForgeNodeView({ id, data, selected }: NodeProps<ForgeNode>) {
  const def = getNodeDef(data.defType);
  const runStatus = useRunStore((state) => state.status);
  const result = useRunStore((state) => state.results[id]);
  const edges = useGraphStore((state) => state.edges);

  if (!def) {
    return (
      <div className="w-[232px] rounded-xl border border-dashed border-rose-400/40 bg-forge-850 px-3 py-2.5 text-[11px] text-rose-300">
        Unknown node type: {data.defType}
      </div>
    );
  }

  const meta = CATEGORY_META[def.category];
  const Icon = def.icon;
  const status = runStatus === 'running' ? 'running' : result?.status;
  const statusMeta =
    status === 'running'
      ? { dot: 'bg-amber-400 animate-pulse', label: 'Running…' }
      : status === 'success'
        ? {
            dot: 'bg-emerald-400',
            label: `Success${result ? ` · ${formatDuration(result.durationMs)}` : ''}`,
          }
        : status === 'error'
          ? { dot: 'bg-rose-400', label: 'Failed' }
          : status === 'skipped'
            ? { dot: 'bg-zinc-500', label: 'Skipped' }
            : { dot: 'bg-zinc-600', label: 'Ready' };
  const previews = def.type === 'image-input' ? data.artifacts ?? [] : [];
  const pdfs = def.type === 'pdf-input' ? data.artifacts ?? [] : [];
  const inputs = getInputPorts(def, { id, data }, edges);
  const outputs = getOutputPorts(def, { id, data }, edges);

  return (
    <div
      className={`group relative w-[232px] rounded-xl border bg-forge-850 shadow-[0_18px_45px_-24px_rgba(0,0,0,0.95)] transition-colors ${
        selected
          ? 'border-[rgb(var(--accent)/0.6)] ring-1 ring-[rgb(var(--accent)/0.25)]'
          : 'border-white/[0.07] hover:border-white/[0.15]'
      }`}
    >

      <div className="flex items-start gap-2.5 px-3 pb-2 pt-3.5">
        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.tint} ${meta.text}`}
        >
          <Icon size={15} strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium leading-tight text-zinc-100">
            {def.label}
          </div>
          <div
            className={`mt-1 text-[8.5px] font-semibold uppercase tracking-[0.16em] ${meta.text} opacity-80`}
          >
            {meta.label}
          </div>
        </div>
        <span
          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${statusMeta.dot}`}
          title={statusMeta.label}
        />
      </div>

      {result?.status === 'error' && result.error ? (
        <p className="line-clamp-2 px-3 pb-3 text-[10px] leading-[1.5] text-rose-300/90">
          {result.error}
        </p>
      ) : (
        <p className="line-clamp-2 px-3 pb-3 text-[10.5px] leading-[1.5] text-zinc-500">
          {def.description}
        </p>
      )}

      {previews.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-white/[0.06] px-3 py-2">
          {previews.slice(0, 3).map((artifact) => (
            <img
              key={artifact.id}
              src={artifactThumbUrl(artifact.id)}
              alt=""
              loading="lazy"
              className="h-8 w-8 rounded-md border border-white/10 bg-black/30 object-cover"
            />
          ))}
          <span className="ml-auto font-mono text-[8.5px] text-zinc-600">
            {previews.length} image{previews.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {pdfs.length > 0 && (
        <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2">
          <FileText size={14} className="shrink-0 text-rose-300" />
          <span className="min-w-0 flex-1 truncate text-[9.5px] text-zinc-400">
            {pdfs[0].name}
          </span>
          <span className="shrink-0 font-mono text-[8.5px] text-zinc-600">
            {pdfs.reduce((sum, pdf) => sum + (pdf.pages ?? 0), 0)} pg
            {pdfs.length > 1 ? ` · ${pdfs.length} files` : ''}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-2 border-t border-white/[0.06] px-3 py-2">
        <div className="space-y-0.5">
          {inputs.length > 0 ? (
            inputs.map((port) => <PortRow key={port.id} port={port} side="input" />)
          ) : (
            <div className="h-5" />
          )}
        </div>
        <div className="space-y-0.5">
          {outputs.length > 0 ? (
            outputs.map((port) => <PortRow key={port.id} port={port} side="output" />)
          ) : (
            <div className="h-5" />
          )}
        </div>
      </div>
    </div>
  );
}
