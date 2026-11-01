import type { ArtifactRef, ForgeEdge, ForgeNode } from '../types';

interface ApiErrorBody {
  error?: string;
  details?: string[];
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error) {
      return body.details?.length
        ? `${body.error} ${body.details.join(' ')}`
        : body.error;
    }
  } catch {
    // Fall through to a generic message.
  }
  return `Request failed (${response.status}).`;
}

export type UploadKind = 'image' | 'pdf' | 'auto';

export async function uploadFiles(
  files: File[],
  kind: UploadKind = 'auto',
): Promise<ArtifactRef[]> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }

  const response = await fetch(`/api/uploads?kind=${kind}`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const body = (await response.json()) as { artifacts: ArtifactRef[] };
  return body.artifacts;
}

export function uploadImages(files: File[]): Promise<ArtifactRef[]> {
  return uploadFiles(files, 'image');
}

export interface NodeRunResult {
  status: 'success' | 'error' | 'skipped';
  durationMs: number;
  artifacts: ArtifactRef[];
  error?: string;
}

export interface RunResponse {
  runId: string;
  durationMs: number;
  results: Record<string, NodeRunResult>;
  outputs: ArtifactRef[];
}

export async function runPipeline(
  nodes: ForgeNode[],
  edges: ForgeEdge[],
): Promise<RunResponse> {
  const payload = {
    nodes: nodes.map((node) => ({
      id: node.id,
      data: {
        defType: node.data.defType,
        params: node.data.params,
        artifacts: node.data.artifacts,
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
  };

  const response = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as RunResponse;
}

export function artifactThumbUrl(id: string): string {
  return `/api/artifacts/${id}/thumb`;
}

export function artifactDownloadUrl(id: string): string {
  return `/api/artifacts/${id}/download`;
}
