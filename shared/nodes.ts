import type { ArtifactRef } from './artifacts';

export type PortType = 'image' | 'pdf' | 'audio' | 'any';

export type NodeCategory = 'input' | 'convert' | 'audio' | 'pdf' | 'output';

export interface PortDef {
  id: string;
  label: string;
  type: PortType;
  many?: boolean;
  optional?: boolean;
  artifactId?: string;
  index?: number;
}

export interface NodeSpec {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  inputs: PortDef[];
  outputs: PortDef[];
}

export const PORT_COLORS: Record<PortType, string> = {
  image: '#34d399',
  pdf: '#fb7185',
  audio: '#c084fc',
  any: '#fbbf24',
};

export function portTypeLabel(type: PortType): string {
  const labels: Record<PortType, string> = {
    image: 'Image',
    pdf: 'PDF',
    audio: 'Audio',
    any: 'Any',
  };
  return labels[type];
}

export function portsCompatible(source: PortType, target: PortType): boolean {
  return source === 'any' || target === 'any' || source === target;
}

export function describePorts(spec: NodeSpec): string {
  const inputs = spec.inputs.length
    ? spec.inputs.map((port) => port.label.toLowerCase()).join(', ')
    : '—';
  const outputs = spec.outputs.length
    ? spec.outputs.map((port) => port.label.toLowerCase()).join(', ')
    : '—';
  return `${inputs} → ${outputs}`;
}

export const NODE_SPECS: NodeSpec[] = [
  {
    type: 'image-input',
    label: 'Image Input',
    category: 'input',
    description: 'Load JPEG, PNG, WebP, TIFF or BMP images into the pipeline.',
    inputs: [],
    outputs: [{ id: 'images', label: 'Images', type: 'image', many: true }],
  },
  {
    type: 'pdf-input',
    label: 'PDF Input',
    category: 'input',
    description: 'Bring one or more PDF documents onto the canvas.',
    inputs: [],
    outputs: [{ id: 'pdfs', label: 'PDFs', type: 'pdf', many: true }],
  },
  {
    type: 'audio-input',
    label: 'Audio Input',
    category: 'input',
    description: 'Load MP3, FLAC, WAV, OGG or other audio files into the pipeline.',
    inputs: [],
    outputs: [{ id: 'audio', label: 'Audio', type: 'audio', many: true }],
  },
  {
    type: 'audio-metadata',
    label: 'Audio Metadata',
    category: 'audio',
    description: 'Change title, artist, album and other tags, with optional cover art.',
    inputs: [
      { id: 'audio', label: 'Audio', type: 'audio', many: true },
      { id: 'artwork', label: 'Artwork', type: 'image', optional: true },
    ],
    outputs: [{ id: 'audio', label: 'Audio', type: 'audio', many: true }],
  },
  {
    type: 'batch-audio-metadata',
    label: 'Batch Metadata',
    category: 'audio',
    description: 'Tag tracks in connection order and bundle them as one ZIP.',
    inputs: [
      { id: 'audio', label: 'Audio', type: 'audio', many: true },
      { id: 'artwork', label: 'Artwork', type: 'image', optional: true },
    ],
    outputs: [{ id: 'zip', label: 'ZIP', type: 'any' }],
  },
  {
    type: 'convert-audio',
    label: 'Convert Audio',
    category: 'audio',
    description: 'Re-encode audio between MP3, FLAC, WAV, OGG and M4A.',
    inputs: [{ id: 'audio', label: 'Audio', type: 'audio', many: true }],
    outputs: [{ id: 'audio', label: 'Audio', type: 'audio', many: true }],
  },
  {
    type: 'image-to-pdf',
    label: 'Image to PDF',
    category: 'convert',
    description: 'Lay images onto PDF pages with size and fit options.',
    inputs: [{ id: 'images', label: 'Images', type: 'image', many: true }],
    outputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
  },
  {
    type: 'convert-image',
    label: 'Convert Image',
    category: 'convert',
    description: 'Re-encode images between PNG, JPEG and WebP.',
    inputs: [{ id: 'images', label: 'Images', type: 'image', many: true }],
    outputs: [{ id: 'images', label: 'Images', type: 'image', many: true }],
  },
  {
    type: 'rename',
    label: 'Rename',
    category: 'convert',
    description: 'Give files a new name before continuing down the pipeline.',
    inputs: [{ id: 'files', label: 'Files', type: 'any', many: true }],
    outputs: [{ id: 'files', label: 'Files', type: 'any', many: true }],
  },
  {
    type: 'merge-pdfs',
    label: 'Merge PDFs',
    category: 'pdf',
    description: 'Combine several PDFs into a single document.',
    inputs: [{ id: 'pdfs', label: 'PDFs', type: 'pdf', many: true }],
    outputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
  },
  {
    type: 'split-pdf',
    label: 'Split PDF',
    category: 'pdf',
    description: 'Break a PDF into ranges or fixed-size page groups.',
    inputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
    outputs: [{ id: 'pdfs', label: 'PDFs', type: 'pdf', many: true }],
  },
  {
    type: 'rotate-pdf',
    label: 'Rotate PDF',
    category: 'pdf',
    description: 'Rotate whole documents or selected pages by 90/180/270°.',
    inputs: [{ id: 'pdfs', label: 'PDFs', type: 'pdf', many: true }],
    outputs: [{ id: 'pdfs', label: 'PDFs', type: 'pdf', many: true }],
  },
  {
    type: 'extract-pages',
    label: 'Extract Pages',
    category: 'pdf',
    description: 'Keep a chosen set of pages and drop the rest.',
    inputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
    outputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
  },
  {
    type: 'delete-pages',
    label: 'Delete Pages',
    category: 'pdf',
    description: 'Remove unwanted pages using a page range expression.',
    inputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
    outputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
  },
  {
    type: 'reorder-pages',
    label: 'Reorder Pages',
    category: 'pdf',
    description: 'Rearrange a document by supplying a custom page order.',
    inputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
    outputs: [{ id: 'pdf', label: 'PDF', type: 'pdf' }],
  },
  {
    type: 'output',
    label: 'Output',
    category: 'output',
    description: 'Collect finished files and expose them for download.',
    inputs: [{ id: 'files', label: 'Files', type: 'any', many: true }],
    outputs: [],
  },
];

const FILE_INPUT_TYPES: Record<string, { portId: string; type: PortType }> = {
  'image-input': { portId: 'images', type: 'image' },
  'pdf-input': { portId: 'pdfs', type: 'pdf' },
  'audio-input': { portId: 'audio', type: 'audio' },
};

export function isPortHandle(portId: string, handle?: string | null): boolean {
  return !!handle && (handle === portId || handle.startsWith(`${portId}:`));
}

export function resolveOutputPorts(
  spec: NodeSpec,
  artifacts?: ArtifactRef[],
  params?: Record<string, unknown>,
): PortDef[] {
  const fileInput = FILE_INPUT_TYPES[spec.type];
  if (fileInput) {
    return (artifacts ?? []).map((artifact, index) => ({
      id: `${fileInput.portId}:out:${artifact.id}`,
      label: artifact.name,
      type: fileInput.type,
      artifactId: artifact.id,
      index,
    }));
  }

  if (spec.type === 'split-pdf') {
    const splitParts = Array.isArray(params?.splitParts)
      ? (params.splitParts as string[])
      : typeof params?.ranges === 'string' && params.ranges
        ? [params.ranges]
        : [];
    const parts = splitParts.filter((part) => String(part).trim());
    if (parts.length === 0) {
      return artifacts?.length
        ? (artifacts ?? []).map((artifact, index) => ({
            id: `${spec.outputs[0].id}:out:${index}`,
            label: artifact.name,
            type: spec.outputs[0].type,
            index,
          }))
        : [];
    }
    return parts.map((part, index) => ({
      id: `${spec.outputs[0].id}:out:${index}`,
      label: part.trim(),
      type: spec.outputs[0].type,
      index,
    }));
  }

  const base = spec.outputs[0];
  if (!base) return [];

  const items = artifacts ?? [];
  if (items.length === 0) return spec.outputs;

  return items.map((artifact, index) => ({
    id: `${base.id}:out:${index}`,
    label: artifact.name,
    type: base.type,
    index,
  }));
}

export function resolveInputPorts(
  spec: NodeSpec,
  incomingHandles: string[] = [],
): PortDef[] {
  return spec.inputs.flatMap((port) => {
    if (!port.many) return [port];

    const used = incomingHandles.filter((handle) => isPortHandle(port.id, handle));
    const indices = new Set<number>();
    for (const handle of used) {
      const suffix =
        handle === port.id
          ? '0'
          : handle.startsWith(`${port.id}:in:`)
            ? handle.slice(port.id.length + 4)
            : handle.slice(port.id.length + 1);
      const index = Number(suffix);
      if (Number.isInteger(index) && index >= 0) indices.add(index);
    }

    let freeIndex = 0;
    while (indices.has(freeIndex)) freeIndex += 1;
    indices.add(freeIndex);

    return Array.from(indices)
      .sort((a, b) => a - b)
      .map((index) => ({
        ...port,
        id: `${port.id}:in:${index}`,
        label: used.length === 0 ? port.label : `${port.label} ${index + 1}`,
        index,
      }));
  });
}

export function findInputPort(
  spec: NodeSpec,
  handle?: string | null,
): PortDef | undefined {
  if (!handle) return undefined;
  return spec.inputs.find((port) =>
    port.many ? isPortHandle(port.id, handle) : port.id === handle,
  );
}

export function findOutputPort(
  spec: NodeSpec,
  handle?: string | null,
): PortDef | undefined {
  if (!handle) return undefined;
  return spec.outputs.find((port) => isPortHandle(port.id, handle));
}

const SPEC_MAP = new Map(NODE_SPECS.map((spec) => [spec.type, spec]));

export function getNodeSpec(type: string): NodeSpec | undefined {
  return SPEC_MAP.get(type);
}

export const DEFAULT_PARAMS: Record<string, Record<string, unknown>> = {
  'audio-metadata': {
    title: '',
    artist: '',
    album: '',
    albumArtist: '',
    year: '',
    genre: '',
    track: '',
    comment: '',
  },
  'batch-audio-metadata': {
    album: '',
    artist: '',
    albumArtist: '',
    year: '',
    genre: '',
    comment: '',
  },
  'convert-audio': {
    format: 'mp3',
    bitrate: '192k',
  },
  'image-to-pdf': {
    pageSize: 'fit',
    orientation: 'auto',
    fit: 'contain',
    marginMm: 0,
    background: '#ffffff',
  },
  'convert-image': {
    format: 'png',
    quality: 90,
  },
  rename: {
    name: '',
  },
  'split-pdf': {
    mode: 'ranges',
    chunkSize: 1,
    ranges: '',
    splitParts: [''],
  },
  'rotate-pdf': {
    angle: 90,
    scope: 'all',
    pages: '',
  },
  'extract-pages': {
    pages: '1',
  },
  'delete-pages': {
    pages: '1',
  },
  'reorder-pages': {
    order: '',
  },
};
