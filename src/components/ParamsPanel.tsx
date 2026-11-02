import { useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleSlash,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  Music,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { artifactDownloadUrl, artifactThumbUrl, uploadFiles } from '../lib/api';
import type { UploadKind } from '../lib/api';
import { formatAudioDuration, formatBytes, formatDuration } from '../lib/format';
import { getNodeDef } from '../nodes/catalog';
import { useGraphStore } from '../store/useGraphStore';
import { useRunStore } from '../store/useRunStore';
import type { ArtifactRef, ForgeNode } from '../types';

const inputClass =
  'w-full rounded-lg border border-white/[0.08] bg-forge-950/60 px-2 py-1.5 text-[16.5px] text-zinc-300 outline-none transition-colors focus:border-amber-400/40';
const labelClass =
  'text-[13px] font-semibold uppercase tracking-[0.14em] text-zinc-500';

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-2.5 rounded-xl border border-white/[0.06] bg-forge-850 p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={labelClass}>{label}</span>
        {hint && <span className="text-[12px] text-zinc-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Select({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-lg border border-white/[0.06] bg-forge-950/60 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-1 py-1 text-[15px] font-medium transition-colors ${
            value === option.value
              ? 'bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/25'
              : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}



function ArtifactRow({
  artifact,
  onRemove,
}: {
  artifact: ArtifactRef;
  onRemove?: () => void;
}) {
  const isImage = artifact.kind === 'image';
  const isAudio = artifact.kind === 'audio';
  const dimensions =
    artifact.width && artifact.height
      ? ` · ${artifact.width}×${artifact.height}`
      : '';
  const pages = artifact.pages ? ` · ${artifact.pages} pages` : '';
  const duration =
    artifact.duration !== undefined
      ? ` · ${formatAudioDuration(artifact.duration)}`
      : '';

  return (
    <li className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-forge-900/60 p-1.5">
      {isImage ? (
        <img
          src={artifactThumbUrl(artifact.id)}
          alt=""
          loading="lazy"
          className="h-8 w-8 shrink-0 rounded-md border border-white/[0.06] bg-black/30 object-cover"
        />
      ) : isAudio ? (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-purple-400/15 bg-purple-400/10 text-purple-300">
          <Music size={14} />
        </div>
      ) : (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-rose-400/15 bg-rose-400/10 text-rose-300">
          <FileText size={14} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] text-zinc-300" title={artifact.name}>
          {artifact.name}
        </div>
        <div className="font-mono text-[12px] text-zinc-600">
          {formatBytes(artifact.size)}
          {dimensions}
          {pages}
          {duration}
        </div>
      </div>
      <a
        href={artifactDownloadUrl(artifact.id)}
        download
        title="Download"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-amber-300"
      >
        <Download size={12} />
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-600 transition-colors hover:bg-rose-400/10 hover:text-rose-300"
        >
          <X size={12} />
        </button>
      )}
    </li>
  );
}

function FileInputParams({
  node,
  kind,
}: {
  node: ForgeNode;
  kind: UploadKind;
}) {
  const setNodeArtifacts = useGraphStore((state) => state.setNodeArtifacts);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const artifacts = node.data.artifacts ?? [];
  const copy =
    kind === 'pdf'
      ? {
          title: 'PDFs',
          accept: 'application/pdf,.pdf',
          empty: 'Choose one or more PDF files.',
          drop: 'Drop PDFs or click to browse',
          hint: 'PDF files · up to 50 MB each',
        }
      : kind === 'audio'
        ? {
            title: 'Audio',
            accept: 'audio/*,.mp3,.flac,.wav,.ogg,.oga,.opus,.m4a,.aac,.aiff,.wma',
            empty: 'Choose one or more audio files.',
            drop: 'Drop audio or click to browse',
            hint: 'MP3, FLAC, WAV, OGG, M4A · up to 50 MB each',
          }
        : {
            title: 'Images',
            accept: 'image/*',
            empty: 'Choose one or more image files.',
            drop: 'Drop images or click to browse',
            hint: 'PNG, JPEG, WebP, GIF, TIFF · up to 50 MB each',
          };
  const isAudio = kind === 'audio';

  const handleFiles = async (files: File[]) => {
    if (uploading) return;

    const accepted = files.filter((file) =>
      kind === 'pdf'
        ? file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
        : kind === 'audio'
          ? file.type.startsWith('audio/') ||
            /\.(mp3|flac|wav|wave|ogg|oga|opus|m4a|aac|aiff?|wma)$/i.test(file.name)
          : file.type.startsWith('image/') ||
            /\.(png|jpe?g|webp|gif|tiff?|bmp|avif|heic|heif)$/i.test(file.name),
    );

    if (accepted.length === 0) {
      setError(copy.empty);
      return;
    }

    setUploading(true);
    setError(undefined);

    try {
      const uploaded = await uploadFiles(accepted, kind);
      const current =
        useGraphStore.getState().nodes.find((item) => item.id === node.id)?.data
          .artifacts ?? [];
      setNodeArtifacts(node.id, [...current, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  };

  const removeArtifact = (id: string) => {
    setNodeArtifacts(
      node.id,
      artifacts.filter((artifact) => artifact.id !== id),
    );
  };

  return (
    <Section
      title={copy.title}
      badge={
        artifacts.length > 0 ? (
          <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[12px] text-emerald-300">
            {artifacts.length}
          </span>
        ) : undefined
      }
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${
          dragOver
            ? isAudio
              ? 'border-purple-400/50 bg-purple-400/[0.06]'
              : 'border-amber-400/50 bg-amber-400/[0.06]'
            : isAudio
              ? 'border-white/[0.1] hover:border-purple-400/30 hover:bg-white/[0.02]'
              : 'border-white/[0.1] hover:border-amber-400/30 hover:bg-white/[0.02]'
        }`}
      >
        {uploading ? (
          <Loader2
            size={17}
            className={`animate-spin ${isAudio ? 'text-purple-300' : 'text-amber-300'}`}
          />
        ) : kind === 'pdf' ? (
          <FileText size={17} className="text-zinc-500" />
        ) : isAudio ? (
          <Music size={17} className="text-zinc-500" />
        ) : (
          <ImagePlus size={17} className="text-zinc-500" />
        )}
        <span className="mt-0.5 text-[16px] font-medium text-zinc-300">
          {uploading ? 'Uploading…' : copy.drop}
        </span>
        <span className="text-[12px] text-zinc-600">{copy.hint}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={copy.accept}
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void handleFiles(files);
        }}
      />

      {error && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-400/15 bg-rose-400/5 px-2 py-1.5 text-[13.5px] leading-relaxed text-rose-300">
          <AlertCircle size={11} className="mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {artifacts.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {artifacts.map((artifact) => (
            <ArtifactRow
              key={artifact.id}
              artifact={artifact}
              onRemove={() => removeArtifact(artifact.id)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ImageToPdfParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const update = (patch: Record<string, unknown>) =>
    updateNodeParams(node.id, patch);

  const pageSize =
    typeof params.pageSize === 'string' ? params.pageSize : 'fit';
  const orientation =
    typeof params.orientation === 'string' ? params.orientation : 'auto';
  const fit = typeof params.fit === 'string' ? params.fit : 'contain';
  const marginMm = typeof params.marginMm === 'number' ? params.marginMm : 0;
  const background =
    typeof params.background === 'string' ? params.background : '#ffffff';

  const fitHint =
    fit === 'contain'
      ? 'Full image, padded to page'
      : fit === 'cover'
        ? 'Fill page, crop overflow'
        : 'Fill page, may distort';

  return (
    <Section title="Page layout">
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Field label="Page size">
          <Select
            value={pageSize}
            onChange={(value) => update({ pageSize: value })}
            options={[
              { value: 'fit', label: 'Fit to image' },
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
            ]}
          />
        </Field>
        <Field label="Orientation">
          <Select
            value={orientation}
            disabled={pageSize === 'fit'}
            onChange={(value) => update({ orientation: value })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
          />
        </Field>
      </div>

      <div className="mt-2.5">
        <Field label="Image fit" hint={fitHint}>
          <Select
            value={fit}
            onChange={(value) => update({ fit: value })}
            options={[
              { value: 'contain', label: 'Contain' },
              { value: 'cover', label: 'Cover' },
              { value: 'stretch', label: 'Stretch' },
            ]}
          />
        </Field>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Field label="Margin" hint="mm">
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={marginMm}
            onChange={(event) => {
              const next = Number(event.target.value);
              update({
                marginMm: Number.isFinite(next)
                  ? Math.min(50, Math.max(0, Math.round(next)))
                  : 0,
              });
            }}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field label="Background">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-forge-950/60 px-2 py-1">
            <input
              type="color"
              value={background}
              onChange={(event) => update({ background: event.target.value })}
              className="h-5 w-7 cursor-pointer rounded border border-white/10 bg-transparent p-0"
              aria-label="Page background colour"
            />
            <span className="font-mono text-[13.5px] uppercase text-zinc-500">
              {background}
            </span>
          </div>
        </Field>
      </div>

      {pageSize === 'fit' && (
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
          Pages match each image’s aspect ratio. Orientation is applied when a fixed page size
          is used.
        </p>
      )}
    </Section>
  );
}

const FORMATS = ['png', 'jpeg', 'webp'] as const;

function ConvertImageParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const targetFormat =
    typeof params.format === 'string' ? params.format : 'png';
  const quality = typeof params.quality === 'number' ? params.quality : 90;

  return (
    <Section title="Encoding">
      <div className="mt-2.5">
        <Field label="Output format">
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.06] bg-forge-950/60 p-1">
            {FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => updateNodeParams(node.id, { format })}
                className={`rounded-md px-1 py-1 text-[15px] font-medium uppercase tracking-wide transition-colors ${
                  targetFormat === format
                    ? 'bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/25'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                }`}
              >
                {format === 'jpeg' ? 'JPG' : format.toUpperCase()}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-2.5">
        <Field
          label="Quality"
          hint={targetFormat === 'png' ? 'Lossless' : '1–100'}
        >
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              disabled={targetFormat === 'png'}
              onChange={(event) =>
                updateNodeParams(node.id, { quality: Number(event.target.value) })
              }
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            />
            <span className="w-8 text-right font-mono text-[15px] text-zinc-400">
              {quality}
            </span>
          </div>
        </Field>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
        {targetFormat === 'png'
          ? 'PNG keeps transparency and uses lossless compression.'
          : targetFormat === 'jpeg'
            ? 'JPEG is smallest for photos. Transparency is flattened to white.'
            : 'WebP balances quality and file size, with transparency support.'}
      </p>
    </Section>
  );
}

function RenameParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const name = typeof params.name === 'string' ? params.name : '';

  return (
    <Section title="File name">
      <div className="mt-2.5">
        <Field label="New name" hint="Extension is kept unless you add one">
          <input
            type="text"
            value={name}
            placeholder="Keep original name"
            onChange={(event) => updateNodeParams(node.id, { name: event.target.value })}
            className={`${inputClass} placeholder:text-zinc-700`}
          />
        </Field>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
        When several files are connected, each gets this name with a numbered suffix. Leave
        it blank to pass names through unchanged.
      </p>
    </Section>
  );
}

function AudioMetadataParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const update = (patch: Record<string, unknown>) =>
    updateNodeParams(node.id, patch);
  const valueOf = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : '';

  const tags: Array<[string, string, string]> = [
    ['title', 'Title', 'Song title'],
    ['artist', 'Artist', 'Track artist'],
    ['album', 'Album', 'Album name'],
    ['albumArtist', 'Album artist', 'Album artist'],
    ['year', 'Year', 'e.g. 2026'],
    ['genre', 'Genre', 'e.g. Ambient'],
    ['track', 'Track', 'e.g. 3/12'],
  ];

  return (
    <>
      <Section title="Tags">
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {tags.map(([key, label, placeholder]) => (
            <Field key={key} label={label}>
              <input
                type="text"
                value={valueOf(key)}
                placeholder={placeholder}
                onChange={(event) => update({ [key]: event.target.value })}
                className={`${inputClass} placeholder:text-zinc-700`}
              />
            </Field>
          ))}
        </div>
        <div className="mt-2.5">
          <Field label="Comment">
            <input
              type="text"
              value={valueOf('comment')}
              placeholder="Optional note"
              onChange={(event) => update({ comment: event.target.value })}
              className={`${inputClass} placeholder:text-zinc-700`}
            />
          </Field>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
          Blank fields keep the existing tags.
        </p>
      </Section>

      <Section title="Cover art">
        <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-500">
          Connect an image to the Artwork input to embed album art. With nothing connected,
          existing covers are kept.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
          Artwork is embedded for MP3, FLAC and M4A. Other formats keep tags only.
        </p>
      </Section>
    </>
  );
}

function BatchAudioMetadataParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const valueOf = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : '';

  const fields: Array<[string, string, string]> = [
    ['album', 'Album', 'Album name'],
    ['artist', 'Artist', 'Track artist'],
    ['albumArtist', 'Album artist', 'Album artist'],
    ['year', 'Year', 'e.g. 2026'],
    ['genre', 'Genre', 'e.g. Ambient'],
  ];

  return (
    <Section title="Album tags">
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {fields.map(([key, label, placeholder]) => (
          <Field key={key} label={label}>
            <input
              type="text"
              value={valueOf(key)}
              placeholder={placeholder}
              onChange={(event) => updateNodeParams(node.id, { [key]: event.target.value })}
              className={`${inputClass} placeholder:text-zinc-700`}
            />
          </Field>
        ))}
      </div>
      <div className="mt-2.5">
        <Field label="Comment">
          <input
            type="text"
            value={valueOf('comment')}
            placeholder="Optional note"
            onChange={(event) => updateNodeParams(node.id, { comment: event.target.value })}
            className={`${inputClass} placeholder:text-zinc-700`}
          />
        </Field>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
        Track numbers follow connection order: the first input becomes track 1, the next
        track 2, and so on. Blank fields keep existing tags. Connect an image to the
        Artwork input to embed the same cover on every track (MP3, FLAC and M4A). All
        updated tracks are bundled into a single ZIP.
      </p>
    </Section>
  );
}

function ConvertAudioParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const format = typeof params.format === 'string' ? params.format : 'mp3';
  const bitrate = typeof params.bitrate === 'string' ? params.bitrate : '192k';
  const lossless = format === 'flac' || format === 'wav';

  return (
    <Section title="Encoding">
      <div className="mt-2.5">
        <Field label="Output format">
          <Select
            value={format}
            onChange={(value) => updateNodeParams(node.id, { format: value })}
            options={[
              { value: 'mp3', label: 'MP3' },
              { value: 'flac', label: 'FLAC' },
              { value: 'wav', label: 'WAV' },
              { value: 'ogg', label: 'OGG (Vorbis)' },
              { value: 'm4a', label: 'M4A (AAC)' },
            ]}
          />
        </Field>
      </div>

      <div className="mt-2.5">
        <Field label="Bitrate" hint={lossless ? 'Not used for lossless' : 'Lossy quality'}>
          <Select
            value={bitrate}
            disabled={lossless}
            onChange={(value) => updateNodeParams(node.id, { bitrate: value })}
            options={[
              { value: '128k', label: '128 kbps' },
              { value: '192k', label: '192 kbps' },
              { value: '256k', label: '256 kbps' },
              { value: '320k', label: '320 kbps' },
            ]}
          />
        </Field>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
        {lossless
          ? 'FLAC and WAV are lossless, so the bitrate setting is ignored.'
          : 'Higher bitrates keep more detail but create larger files.'}{' '}
        Tags are carried over; cover art is not.
      </p>
    </Section>
  );
}

function MergePdfsParams() {
  return (
    <Section title="Merge order">
      <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-500">
        PDFs are combined in the order their connections reach this node. To change the
        order, reconnect the inputs in the sequence you want.
      </p>
    </Section>
  );
}

function splitRangeToPair(range: string): [string, string] {
  const trimmed = range.trim();
  if (!trimmed) return ['', ''];
  if (trimmed.includes('-')) {
    const [start, end] = trimmed.split('-');
    return [(start ?? '').trim(), (end ?? '').trim()];
  }
  return [trimmed, trimmed];
}

function pairToSplitRange(start: string, end: string): string {
  const s = start.trim();
  const e = end.trim();
  if (!s) return '';
  if (!e || e === s) return s;
  return `${s}-${e}`;
}

function SplitPdfParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const ranges = typeof params.ranges === 'string' ? params.ranges : '';
  const splitParts = Array.isArray(params.splitParts)
    ? (params.splitParts as string[])
    : [];

  const parts = splitParts.length > 0 ? splitParts : ranges ? [ranges] : [''];
  const pairs = parts.map(splitRangeToPair);
  const setPairs = (next: [string, string][]) => {
    const nextParts = next.map(([s, e]) => pairToSplitRange(s, e));
    updateNodeParams(node.id, {
      mode: 'ranges',
      splitParts: nextParts,
      ranges: nextParts.join(','),
    });
  };

  return (
    <Section title="Custom parts">
      <div className="mt-2.5 space-y-2">
        {pairs.map((pair, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <div className="flex-1">
              <input
                type="number"
                min={1}
                value={pair[0]}
                placeholder="Start"
                onChange={(event) => {
                  const next = [...pairs];
                  next[index] = [event.target.value, pair[1]];
                  setPairs(next);
                }}
                className={`${inputClass} font-mono placeholder:text-zinc-700`}
              />
            </div>
            <span className="text-[15px] text-zinc-600">–</span>
            <div className="flex-1">
              <input
                type="number"
                min={1}
                value={pair[1]}
                placeholder="End"
                onChange={(event) => {
                  const next = [...pairs];
                  next[index] = [pair[0], event.target.value];
                  setPairs(next);
                }}
                className={`${inputClass} font-mono placeholder:text-zinc-700`}
              />
            </div>
            {pairs.length > 1 && (
              <button
                type="button"
                onClick={() => setPairs(pairs.filter((_, i) => i !== index))}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-600 transition-colors hover:bg-rose-400/10 hover:text-rose-300"
                title="Remove part"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPairs([...pairs, ['', '']])}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[15px] text-zinc-400 transition-colors hover:border-white/[0.14] hover:text-zinc-300"
        >
          Add interval
        </button>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
        Each part becomes its own output PDF. Pages cannot appear in more than one part.
      </p>
    </Section>
  );
}

function PagesInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder="1, 3-5"
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} font-mono placeholder:text-zinc-700`}
    />
  );
}

function RotatePdfParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const angle = typeof params.angle === 'number' ? String(params.angle) : '90';
  const scope = typeof params.scope === 'string' ? params.scope : 'all';
  const pages = typeof params.pages === 'string' ? params.pages : '';

  return (
    <Section title="Rotation">
      <div className="mt-2.5">
        <Field label="Angle">
          <Segmented
            value={angle}
            onChange={(value) =>
              updateNodeParams(node.id, { angle: Number(value) })
            }
            options={[
              { value: '90', label: '90°' },
              { value: '180', label: '180°' },
              { value: '270', label: '270°' },
            ]}
          />
        </Field>
      </div>

      <div className="mt-2.5">
        <Field label="Apply to">
          <Segmented
            value={scope}
            onChange={(value) => updateNodeParams(node.id, { scope: value })}
            options={[
              { value: 'all', label: 'All pages' },
              { value: 'custom', label: 'Selected' },
            ]}
          />
        </Field>
      </div>

      {scope === 'custom' && (
        <div className="mt-2.5">
          <Field label="Pages" hint="1-based, e.g. 1, 3-5">
            <PagesInput value={pages} onChange={(value) => updateNodeParams(node.id, { pages: value })} />
          </Field>
        </div>
      )}
    </Section>
  );
}

function PageSelectionParams({
  node,
  mode,
}: {
  node: ForgeNode;
  mode: 'extract' | 'delete';
}) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const pages = typeof params.pages === 'string' ? params.pages : '1';

  if (mode === 'delete') {
    return (
      <Section title="Pages to remove">
        <div className="mt-2.5">
          <Field label="Pages" hint="1-based, e.g. 1, 3-5">
            <input
              type="text"
              value={pages}
              placeholder="1, 3-5"
              onChange={(event) => updateNodeParams(node.id, { pages: event.target.value })}
              className={`${inputClass} font-mono placeholder:text-zinc-700`}
            />
          </Field>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
          Remaining pages keep their original order. At least one page must stay.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Pages to keep">
      <div className="mt-2.5">
        <Field label="Pages" hint="1-based, e.g. 1, 3-5">
          <PagesInput value={pages} onChange={(value) => updateNodeParams(node.id, { pages: value })} />
        </Field>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
        Extracted pages keep the order you enter, with duplicates removed.
      </p>
    </Section>
  );
}

function ReorderPdfParams({ node }: { node: ForgeNode }) {
  const updateNodeParams = useGraphStore((state) => state.updateNodeParams);
  const params = node.data.params;
  const order = typeof params.order === 'string' ? params.order : '';

  return (
    <Section title="Page order">
      <div className="mt-2.5">
        <Field label="New order" hint="every page once">
          <input
            type="text"
            value={order}
            placeholder="3, 1, 2"
            onChange={(event) => updateNodeParams(node.id, { order: event.target.value })}
            className={`${inputClass} font-mono placeholder:text-zinc-700`}
          />
        </Field>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
        List every page exactly once in its new position. Ranges expand in place, so
        “2-3, 1” becomes pages 2, 3, 1.
      </p>
    </Section>
  );
}

function OutputParams({ node }: { node: ForgeNode }) {
  const result = useRunStore((state) => state.results[node.id]);
  const globalStatus = useRunStore((state) => state.status);
  const artifacts = result?.artifacts ?? [];

  return (
    <Section
      title="Output files"
      badge={
        artifacts.length > 0 ? (
          <span className="rounded bg-sky-400/10 px-1.5 py-0.5 font-mono text-[12px] text-sky-300">
            {artifacts.length}
          </span>
        ) : undefined
      }
    >
      {globalStatus === 'running' && (
        <div className="mt-2 flex items-center gap-2 text-[15px] text-amber-300/90">
          <Loader2 size={12} className="animate-spin" />
          Waiting for the pipeline…
        </div>
      )}

      {result?.status === 'error' && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-400/15 bg-rose-400/5 px-2 py-1.5 text-[13.5px] leading-relaxed text-rose-300">
          <AlertCircle size={11} className="mt-px shrink-0" />
          <span>{result.error ?? 'This node failed.'}</span>
        </div>
      )}

      {artifacts.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {artifacts.map((artifact) => (
            <ArtifactRow key={artifact.id} artifact={artifact} />
          ))}
        </ul>
      ) : (
        globalStatus !== 'running' &&
        result?.status !== 'error' && (
          <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-500">
            Run the pipeline to collect finished files here. Each output keeps its
            original filename and can be downloaded individually.
          </p>
        )
      )}
    </Section>
  );
}

function ComingSoonParams() {
  return (
    <Section
      title="Parameters"
      badge={
        <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-600">
          Soon
        </span>
      }
    >
      <div className="mt-1.5 flex gap-2">
        <SlidersHorizontal size={13} className="mt-0.5 shrink-0 text-zinc-600" />
        <p className="text-[15px] leading-relaxed text-zinc-500">
          This node’s options arrive with the next engine milestone. Image, PDF and
          document-output tools are ready now.
        </p>
      </div>
    </Section>
  );
}

function RunResultSection({ node }: { node: ForgeNode }) {
  const result = useRunStore((state) => state.results[node.id]);
  const globalStatus = useRunStore((state) => state.status);
  const def = getNodeDef(node.data.defType);

  if (!result && globalStatus !== 'running') return null;

  if (!result) {
    return (
      <Section title="Last run">
        <div className="mt-2 flex items-center gap-2 text-[15px] text-amber-300/90">
          <Loader2 size={12} className="animate-spin" />
          Running…
        </div>
      </Section>
    );
  }

  const meta =
    result.status === 'success'
      ? {
          label: 'Success',
          className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
          Icon: CheckCircle2,
        }
      : result.status === 'error'
        ? {
            label: 'Failed',
            className: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
            Icon: AlertCircle,
          }
        : {
            label: 'Skipped',
            className: 'border-white/10 bg-white/[0.04] text-zinc-400',
            Icon: CircleSlash,
          };

  const showArtifacts =
    result.status === 'success' &&
    result.artifacts.length > 0 &&
    def?.type !== 'image-input' &&
    def?.type !== 'pdf-input' &&
    def?.type !== 'output';

  return (
    <Section title="Last run">
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-medium ${meta.className}`}
        >
          <meta.Icon size={10} />
          {meta.label}
        </span>
        <span className="font-mono text-[13px] text-zinc-600">
          {formatDuration(result.durationMs)}
        </span>
      </div>

      {result.error && (
        <p className="mt-2 rounded-lg border border-rose-400/10 bg-rose-400/[0.04] px-2 py-1.5 text-[13.5px] leading-relaxed text-rose-300/90">
          {result.error}
        </p>
      )}

      {showArtifacts && (
        <ul className="mt-2 space-y-1.5">
          {result.artifacts.map((artifact) => (
            <ArtifactRow key={artifact.id} artifact={artifact} />
          ))}
        </ul>
      )}
    </Section>
  );
}

export function ParamsPanel({ node }: { node: ForgeNode }) {
  const def = getNodeDef(node.data.defType);

  return (
    <>
      {def?.type === 'image-input' ? (
        <FileInputParams node={node} kind="image" />
      ) : def?.type === 'pdf-input' ? (
        <FileInputParams node={node} kind="pdf" />
      ) : def?.type === 'audio-input' ? (
        <FileInputParams node={node} kind="audio" />
      ) : def?.type === 'audio-metadata' ? (
        <AudioMetadataParams node={node} />
      ) : def?.type === 'batch-audio-metadata' ? (
        <BatchAudioMetadataParams node={node} />
      ) : def?.type === 'convert-audio' ? (
        <ConvertAudioParams node={node} />
      ) : def?.type === 'image-to-pdf' ? (
        <ImageToPdfParams node={node} />
      ) : def?.type === 'convert-image' ? (
        <ConvertImageParams node={node} />
      ) : def?.type === 'rename' ? (
        <RenameParams node={node} />
      ) : def?.type === 'merge-pdfs' ? (
        <MergePdfsParams />
      ) : def?.type === 'split-pdf' ? (
        <SplitPdfParams node={node} />
      ) : def?.type === 'rotate-pdf' ? (
        <RotatePdfParams node={node} />
      ) : def?.type === 'extract-pages' ? (
        <PageSelectionParams node={node} mode="extract" />
      ) : def?.type === 'delete-pages' ? (
        <PageSelectionParams node={node} mode="delete" />
      ) : def?.type === 'reorder-pages' ? (
        <ReorderPdfParams node={node} />
      ) : def?.type === 'output' ? (
        <OutputParams node={node} />
      ) : (
        <ComingSoonParams />
      )}
      <RunResultSection node={node} />
    </>
  );
}
