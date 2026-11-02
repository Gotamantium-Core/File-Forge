import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { z } from 'zod';
import type { ArtifactRef } from '../../shared/artifacts';
import {
  convertAudio,
  writeAudioMetadata,
} from '../lib/audio';
import type {
  ArtworkInput,
  AudioFormat,
  AudioMetadata,
} from '../lib/audio';
import { convertImage } from '../lib/images';
import { buildPdfFromImages } from '../lib/pdf';
import {
  deletePdfPages,
  extractPdfPages,
  mergePdfDocuments,
  reorderPdfPages,
  rotatePdfDocument,
  splitPdfDocument,
} from '../lib/pdfs';
import type { PdfInput } from '../lib/pdfs';
import { loadArtifact, saveArtifact } from '../lib/storage';
import type { StoredArtifact } from '../lib/storage';
import { NodeExecutionError } from './types';
import type { NodeHandler } from './types';

const imageToPdfSchema = z.object({
  pageSize: z.enum(['fit', 'a4', 'letter']).default('fit'),
  orientation: z.enum(['auto', 'portrait', 'landscape']).default('auto'),
  fit: z.enum(['contain', 'cover', 'stretch']).default('contain'),
  marginMm: z.coerce.number().min(0).max(100).default(0),
  background: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, 'Background must be a hex colour such as #ffffff.')
    .default('#ffffff'),
});

const convertImageSchema = z.object({
  format: z.enum(['png', 'jpeg', 'webp']).default('png'),
  quality: z.coerce.number().int().min(1).max(100).default(90),
});

const renameSchema = z.object({
  name: z.string().max(200).default(''),
});

const splitPdfSchema = z.object({
  mode: z.enum(['chunks', 'ranges']).default('chunks'),
  chunkSize: z.coerce.number().int().min(1).max(5000).default(1),
  ranges: z.string().max(5000).default(''),
  splitParts: z.array(z.string().max(5000)).max(200).optional(),
});

const rotatePdfSchema = z.object({
  angle: z.coerce
    .number()
    .int()
    .refine((value) => [90, 180, 270].includes(value), {
      message: 'Rotation must be 90, 180 or 270 degrees.',
    })
    .default(90),
  scope: z.enum(['all', 'custom']).default('all'),
  pages: z.string().max(5000).default(''),
});

const pageSelectionSchema = z.object({
  pages: z.string().max(5000),
});

const pageOrderSchema = z.object({
  order: z.string().max(5000),
});

const convertAudioSchema = z.object({
  format: z.enum(['mp3', 'flac', 'wav', 'ogg', 'm4a']).default('mp3'),
  bitrate: z.enum(['128k', '192k', '256k', '320k']).default('192k'),
});

const batchAudioMetadataSchema = z.object({
  album: z.string().max(300).default(''),
  artist: z.string().max(300).default(''),
  albumArtist: z.string().max(300).default(''),
  year: z.string().max(20).default(''),
  genre: z.string().max(100).default(''),
  comment: z.string().max(1000).default(''),
});

const audioMetadataSchema = z.object({
  title: z.string().max(300).default(''),
  artist: z.string().max(300).default(''),
  album: z.string().max(300).default(''),
  albumArtist: z.string().max(300).default(''),
  year: z.string().max(20).default(''),
  genre: z.string().max(100).default(''),
  track: z.string().max(20).default(''),
  comment: z.string().max(1000).default(''),
});

function toRef(artifact: StoredArtifact): ArtifactRef {
  const ref: ArtifactRef = {
    id: artifact.id,
    name: artifact.name,
    mime: artifact.mime,
    kind: artifact.kind,
    size: artifact.size,
  };
  if (artifact.width !== undefined) ref.width = artifact.width;
  if (artifact.height !== undefined) ref.height = artifact.height;
  if (artifact.pages !== undefined) ref.pages = artifact.pages;
  if (artifact.duration !== undefined) ref.duration = artifact.duration;
  return ref;
}

async function loadImages(refs: ArtifactRef[]): Promise<StoredArtifact[]> {
  const artifacts = await Promise.all(refs.map((ref) => loadArtifact(ref.id)));
  for (const artifact of artifacts) {
    if (artifact.kind !== 'image') {
      throw new NodeExecutionError(`"${artifact.name}" is not an image.`);
    }
  }
  return artifacts;
}

async function loadPdfs(refs: ArtifactRef[]): Promise<StoredArtifact[]> {
  const artifacts = await Promise.all(refs.map((ref) => loadArtifact(ref.id)));
  for (const artifact of artifacts) {
    if (artifact.kind !== 'pdf') {
      throw new NodeExecutionError(`"${artifact.name}" is not a PDF.`);
    }
  }
  return artifacts;
}

async function loadAudio(refs: ArtifactRef[]): Promise<StoredArtifact[]> {
  const artifacts = await Promise.all(refs.map((ref) => loadArtifact(ref.id)));
  for (const artifact of artifacts) {
    if (artifact.kind !== 'audio') {
      throw new NodeExecutionError(`"${artifact.name}" is not an audio file.`);
    }
  }
  return artifacts;
}

async function loadArtwork(refs: ArtifactRef[]): Promise<ArtworkInput | undefined> {
  const ref = refs[0];
  if (!ref) return undefined;

  const artifact = await loadArtifact(ref.id);
  if (artifact.kind !== 'image') {
    throw new NodeExecutionError('Cover art must be an image file.');
  }

  return {
    buffer: await fs.readFile(artifact.filePath),
    mime: artifact.mime,
  };
}

async function readPdfInput(artifact: StoredArtifact): Promise<PdfInput> {
  return {
    buffer: await fs.readFile(artifact.filePath),
    name: artifact.name,
  };
}

function baseName(name: string): string {
  return path.parse(name).name || 'file';
}

function uniqueName(base: string, extension: string, used: Set<string>): string {
  const suffix = extension ? `.${extension}` : '';
  let candidate = `${base}${suffix}`;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${index}${suffix}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

const imageInput: NodeHandler = async ({ node }) => {
  const refs = node.data.artifacts ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('No images selected. Open the inspector and add images.');
  }

  const artifacts = await loadImages(refs);
  return artifacts.map(toRef);
};

const audioInput: NodeHandler = async ({ node }) => {
  const refs = node.data.artifacts ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('No audio selected. Open the inspector and add audio files.');
  }

  const artifacts = await loadAudio(refs);
  return artifacts.map(toRef);
};

const convertAudioNode: NodeHandler = async ({ inputs, params }) => {
  const parsed = convertAudioSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.audio ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect at least one audio file to convert.');
  }

  const artifacts = await loadAudio(refs);
  const used = new Set<string>();
  const output: ArtifactRef[] = [];

  for (const artifact of artifacts) {
    const converted = await convertAudio(
      await fs.readFile(artifact.filePath),
      parsed.data.format as AudioFormat,
      parsed.data.bitrate,
      artifact.name,
      artifact.mime,
    );
    const name = uniqueName(baseName(artifact.name), converted.extension, used);

    output.push(
      await saveArtifact({
        buffer: converted.buffer,
        name,
        mime: converted.mime,
        kind: 'audio',
        duration: converted.duration,
      }),
    );
  }

  return output;
};

const audioMetadataNode: NodeHandler = async ({ inputs, params }) => {
  const parsed = audioMetadataSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.audio ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect at least one audio file to edit.');
  }

  const artifacts = await loadAudio(refs);
  const artwork = await loadArtwork(inputs.artwork ?? []);

  const metadata: AudioMetadata = {
    title: parsed.data.title,
    artist: parsed.data.artist,
    album: parsed.data.album,
    albumArtist: parsed.data.albumArtist,
    year: parsed.data.year,
    genre: parsed.data.genre,
    track: parsed.data.track,
    comment: parsed.data.comment,
  };

  const used = new Set<string>();
  const output: ArtifactRef[] = [];

  for (const artifact of artifacts) {
    const updated = await writeAudioMetadata(
      await fs.readFile(artifact.filePath),
      artifact.name,
      metadata,
      artwork,
      artifact.mime,
    );
    const name = uniqueName(baseName(artifact.name), updated.extension, used);

    output.push(
      await saveArtifact({
        buffer: updated.buffer,
        name,
        mime: updated.mime,
        kind: 'audio',
        duration: updated.duration,
      }),
    );
  }

  return output;
};

const batchAudioMetadataNode: NodeHandler = async ({ inputs, params }) => {
  const parsed = batchAudioMetadataSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.audio ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect at least one audio file to tag.');
  }

  const artifacts = await loadAudio(refs);
  const artwork = await loadArtwork(inputs.artwork ?? []);
  const used = new Set<string>();
  const zip = new JSZip();

  for (const [index, artifact] of artifacts.entries()) {
    const updated = await writeAudioMetadata(
      await fs.readFile(artifact.filePath),
      artifact.name,
      {
        album: parsed.data.album,
        artist: parsed.data.artist,
        albumArtist: parsed.data.albumArtist,
        year: parsed.data.year,
        genre: parsed.data.genre,
        comment: parsed.data.comment,
        track: String(index + 1),
      },
      artwork,
      artifact.mime,
    );
    const name = uniqueName(baseName(artifact.name), updated.extension, used);
    zip.file(name, updated.buffer);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  const album = parsed.data.album.trim();

  return [
    await saveArtifact({
      buffer,
      name: album ? `${album}.zip` : 'tracks.zip',
      mime: 'application/zip',
      kind: 'file',
    }),
  ];
};

const imageToPdf: NodeHandler = async ({ inputs, params }) => {
  const parsed = imageToPdfSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.images ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect at least one image to this node.');
  }

  const artifacts = await loadImages(refs);
  const pdf = await buildPdfFromImages(
    await Promise.all(
      artifacts.map(async (artifact) => ({
        buffer: await fs.readFile(artifact.filePath),
      })),
    ),
    parsed.data,
  );

  const first = artifacts[0];
  const name =
    artifacts.length === 1
      ? `${baseName(first.name)}.pdf`
      : `${baseName(first.name)}-images.pdf`;

  return [
    await saveArtifact({
      buffer: Buffer.from(pdf),
      name,
      mime: 'application/pdf',
      kind: 'pdf',
      pages: artifacts.length,
    }),
  ];
};

const convertImages: NodeHandler = async ({ inputs, params }) => {
  const parsed = convertImageSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.images ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect at least one image to this node.');
  }

  const artifacts = await loadImages(refs);
  const used = new Set<string>();
  const output: ArtifactRef[] = [];

  for (const artifact of artifacts) {
    const buffer = await fs.readFile(artifact.filePath);
    const converted = await convertImage(buffer, parsed.data.format, parsed.data.quality);
    const name = uniqueName(baseName(artifact.name), converted.extension, used);

    output.push(
      await saveArtifact({
        buffer: converted.buffer,
        name,
        mime: converted.mime,
        kind: 'image',
        width: converted.width,
        height: converted.height,
      }),
    );
  }

  return output;
};

const renameFiles: NodeHandler = async ({ inputs, params }) => {
  const parsed = renameSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.files ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect at least one file to rename.');
  }

  const requested = parsed.data.name.trim();
  const used = new Set<string>();
  const output: ArtifactRef[] = [];

  for (const ref of refs) {
    const artifact = await loadArtifact(ref.id);
    const originalExtension = path.extname(artifact.name).replace(/^\./, '');
    const requestedExtension = requested ? path.extname(requested).replace(/^\./, '') : '';
    const extension = requestedExtension || originalExtension;
    const base = requested
      ? requestedExtension
        ? path.parse(requested).name
        : requested
      : path.parse(artifact.name).name;
    const name = uniqueName(base || 'file', extension, used);

    output.push(
      await saveArtifact({
        buffer: await fs.readFile(artifact.filePath),
        name,
        mime: artifact.mime,
        kind: artifact.kind,
        width: artifact.width,
        height: artifact.height,
        pages: artifact.pages,
        duration: artifact.duration,
      }),
    );
  }

  return output;
};

const pdfInput: NodeHandler = async ({ node }) => {
  const refs = node.data.artifacts ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('No PDFs selected. Open the inspector and add PDFs.');
  }

  const artifacts = await loadPdfs(refs);
  return artifacts.map(toRef);
};

const mergePdfs: NodeHandler = async ({ inputs }) => {
  const refs = inputs.pdfs ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect at least one PDF to merge.');
  }

  const artifacts = await loadPdfs(refs);
  const documents = await Promise.all(artifacts.map(readPdfInput));
  const merged = await mergePdfDocuments(documents);
  const name = `${baseName(artifacts[0].name)}-merged.pdf`;

  return [
    await saveArtifact({
      buffer: merged.bytes,
      name,
      mime: 'application/pdf',
      kind: 'pdf',
      pages: merged.pages,
    }),
  ];
};

const splitPdf: NodeHandler = async ({ inputs, params }) => {
  const parsed = splitPdfSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.pdf ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect a PDF to split.');
  }

  const ranges =
    parsed.data.mode === 'ranges'
      ? Array.isArray(parsed.data.splitParts) && parsed.data.splitParts.length > 0
        ? parsed.data.splitParts.join(',')
        : parsed.data.ranges
      : parsed.data.ranges;

  const [artifact] = await loadPdfs(refs);
  const outputs = await splitPdfDocument(
    await readPdfInput(artifact),
    parsed.data.mode,
    {
      chunkSize: parsed.data.chunkSize,
      ranges,
    },
  );

  const base = baseName(artifact.name);
  const width = Math.max(2, String(outputs.length).length);
  const artifacts: ArtifactRef[] = [];

  for (const [index, output] of outputs.entries()) {
    artifacts.push(
      await saveArtifact({
        buffer: output.bytes,
        name: `${base}-part-${String(index + 1).padStart(width, '0')}.pdf`,
        mime: 'application/pdf',
        kind: 'pdf',
        pages: output.pages,
      }),
    );
  }

  return artifacts;
};

const rotatePdf: NodeHandler = async ({ inputs, params }) => {
  const parsed = rotatePdfSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.pdfs ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect at least one PDF to rotate.');
  }

  const artifacts = await loadPdfs(refs);
  const used = new Set<string>();
  const outputs: ArtifactRef[] = [];

  for (const artifact of artifacts) {
    const rotated = await rotatePdfDocument(
      await readPdfInput(artifact),
      parsed.data.angle,
      parsed.data.scope,
      parsed.data.pages,
    );
    outputs.push(
      await saveArtifact({
        buffer: rotated.bytes,
        name: uniqueName(`${baseName(artifact.name)}-rotated`, 'pdf', used),
        mime: 'application/pdf',
        kind: 'pdf',
        pages: rotated.pages,
      }),
    );
  }

  return outputs;
};

const extractPages: NodeHandler = async ({ inputs, params }) => {
  const parsed = pageSelectionSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.pdf ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect a PDF to extract pages from.');
  }

  const [artifact] = await loadPdfs(refs);
  const extracted = await extractPdfPages(
    await readPdfInput(artifact),
    parsed.data.pages,
  );

  return [
    await saveArtifact({
      buffer: extracted.bytes,
      name: `${baseName(artifact.name)}-extracted.pdf`,
      mime: 'application/pdf',
      kind: 'pdf',
      pages: extracted.pages,
    }),
  ];
};

const deletePages: NodeHandler = async ({ inputs, params }) => {
  const parsed = pageSelectionSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.pdf ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect a PDF to delete pages from.');
  }

  const [artifact] = await loadPdfs(refs);
  const edited = await deletePdfPages(
    await readPdfInput(artifact),
    parsed.data.pages,
  );

  return [
    await saveArtifact({
      buffer: edited.bytes,
      name: `${baseName(artifact.name)}-edited.pdf`,
      mime: 'application/pdf',
      kind: 'pdf',
      pages: edited.pages,
    }),
  ];
};

const reorderPages: NodeHandler = async ({ inputs, params }) => {
  const parsed = pageOrderSchema.safeParse(params);
  if (!parsed.success) {
    throw new NodeExecutionError(
      `Invalid settings: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  const refs = inputs.pdf ?? [];
  if (refs.length === 0) {
    throw new NodeExecutionError('Connect a PDF to reorder.');
  }

  const [artifact] = await loadPdfs(refs);
  const reordered = await reorderPdfPages(
    await readPdfInput(artifact),
    parsed.data.order,
  );

  return [
    await saveArtifact({
      buffer: reordered.bytes,
      name: `${baseName(artifact.name)}-reordered.pdf`,
      mime: 'application/pdf',
      kind: 'pdf',
      pages: reordered.pages,
    }),
  ];
};

const output: NodeHandler = async ({ inputs }) => {
  const files = inputs.files ?? [];
  if (files.length === 0) {
    throw new NodeExecutionError('Connect files to the output node.');
  }
  return files;
};

export const NODE_HANDLERS: Record<string, NodeHandler> = {
  'audio-input': audioInput,
  'audio-metadata': audioMetadataNode,
  'batch-audio-metadata': batchAudioMetadataNode,
  'convert-audio': convertAudioNode,
  'image-input': imageInput,
  'image-to-pdf': imageToPdf,
  'convert-image': convertImages,
  rename: renameFiles,
  'pdf-input': pdfInput,
  'merge-pdfs': mergePdfs,
  'split-pdf': splitPdf,
  'rotate-pdf': rotatePdf,
  'extract-pages': extractPages,
  'delete-pages': deletePages,
  'reorder-pages': reorderPages,
  output,
};

export const IMPLEMENTED_NODE_TYPES = Object.keys(NODE_HANDLERS);
