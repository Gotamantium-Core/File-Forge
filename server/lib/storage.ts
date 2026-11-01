import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ArtifactKind, ArtifactRef } from '../../shared/artifacts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ARTIFACT_DIR = path.join(DATA_DIR, 'artifacts');
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoredArtifact extends ArtifactRef {
  dir: string;
  filePath: string;
}

export class ArtifactError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ArtifactError';
    this.status = status;
  }
}

export function sanitizeFilename(name: string): string {
  const trimmed = path
    .basename(name)
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .trim();
  const limited = trimmed.slice(0, 120);
  return limited.length > 0 ? limited : 'file';
}

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
}

export async function saveArtifact(input: {
  buffer: Buffer;
  name: string;
  mime: string;
  kind: ArtifactKind;
  width?: number;
  height?: number;
  pages?: number;
}): Promise<ArtifactRef> {
  const id = randomUUID();
  const dir = path.join(ARTIFACT_DIR, id);
  await fs.mkdir(dir, { recursive: true });

  const ref: ArtifactRef = {
    id,
    name: sanitizeFilename(input.name),
    mime: input.mime,
    kind: input.kind,
    size: input.buffer.length,
  };
  if (input.width !== undefined) ref.width = input.width;
  if (input.height !== undefined) ref.height = input.height;
  if (input.pages !== undefined) ref.pages = input.pages;

  await fs.writeFile(path.join(dir, 'blob'), input.buffer);
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(ref, null, 2));
  return ref;
}

export async function loadArtifact(id: string): Promise<StoredArtifact> {
  if (!ID_PATTERN.test(id)) {
    throw new ArtifactError('Invalid artifact id', 400);
  }

  const dir = path.join(ARTIFACT_DIR, id);
  const filePath = path.join(dir, 'blob');

  try {
    const raw = await fs.readFile(path.join(dir, 'meta.json'), 'utf8');
    const ref = JSON.parse(raw) as ArtifactRef;
    await fs.access(filePath);
    return { ...ref, dir, filePath };
  } catch {
    throw new ArtifactError('Artifact not found', 404);
  }
}

export function artifactDir(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new ArtifactError('Invalid artifact id', 400);
  }
  return path.join(ARTIFACT_DIR, id);
}

export function isArtifactId(id: string): boolean {
  return ID_PATTERN.test(id);
}
