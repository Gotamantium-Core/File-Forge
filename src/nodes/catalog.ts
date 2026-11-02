import {
  AudioLines,
  AudioWaveform,
  Download,
  FileImage,
  FileMinus,
  FilePenLine,
  FileQuestion,
  FileSearch,
  FileText,
  GitMerge,
  Image as ImageIcon,
  ListMusic,
  ListOrdered,
  RefreshCw,
  RotateCw,
  Scissors,
  Tags,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { describePorts, getNodeSpec, NODE_SPECS } from '../../shared/nodes';
import type { NodeCategory, NodeDef } from '../types';

export { describePorts };

export interface CategoryMeta {
  label: string;
  hex: string;
  dot: string;
  tint: string;
  text: string;
  bar: string;
}

export const CATEGORY_ORDER: NodeCategory[] = ['input', 'convert', 'audio', 'pdf', 'output'];

export const CATEGORY_META: Record<NodeCategory, CategoryMeta> = {
  input: {
    label: 'Inputs',
    hex: '#34d399',
    dot: 'bg-emerald-400',
    tint: 'bg-emerald-400/10',
    text: 'text-emerald-300',
    bar: 'bg-emerald-400/70',
  },
  convert: {
    label: 'Convert',
    hex: '#fbbf24',
    dot: 'bg-amber-400',
    tint: 'bg-amber-400/10',
    text: 'text-amber-300',
    bar: 'bg-amber-400/70',
  },
  audio: {
    label: 'Audio tools',
    hex: '#c084fc',
    dot: 'bg-purple-400',
    tint: 'bg-purple-400/10',
    text: 'text-purple-300',
    bar: 'bg-purple-400/70',
  },
  pdf: {
    label: 'PDF tools',
    hex: '#fb7185',
    dot: 'bg-rose-400',
    tint: 'bg-rose-400/10',
    text: 'text-rose-300',
    bar: 'bg-rose-400/70',
  },
  output: {
    label: 'Output',
    hex: '#38bdf8',
    dot: 'bg-sky-400',
    tint: 'bg-sky-400/10',
    text: 'text-sky-300',
    bar: 'bg-sky-400/70',
  },
};

const ICONS: Record<string, LucideIcon> = {
  'image-input': ImageIcon,
  'pdf-input': FileText,
  'audio-input': AudioLines,
  'audio-metadata': Tags,
  'batch-audio-metadata': ListMusic,
  'convert-audio': AudioWaveform,
  'image-to-pdf': FileImage,
  'convert-image': RefreshCw,
  rename: FilePenLine,
  'merge-pdfs': GitMerge,
  'split-pdf': Scissors,
  'rotate-pdf': RotateCw,
  'extract-pages': FileSearch,
  'delete-pages': FileMinus,
  'reorder-pages': ListOrdered,
  output: Download,
};

export const NODE_DEFS: NodeDef[] = NODE_SPECS.map((spec) => ({
  ...spec,
  icon: ICONS[spec.type] ?? FileQuestion,
}));

const NODE_DEF_MAP = new Map(NODE_DEFS.map((def) => [def.type, def]));

export function getNodeDef(type: string): NodeDef | undefined {
  return NODE_DEF_MAP.get(type);
}

export { getNodeSpec };
