import type { ArtifactRef } from '../../shared/artifacts';

export interface RunNodeInput {
  id: string;
  data: {
    defType: string;
    params?: Record<string, unknown>;
    artifacts?: ArtifactRef[];
  };
}

export interface RunEdgeInput {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export type NodeRunStatus = 'success' | 'error' | 'skipped';

export interface NodeRunResult {
  status: NodeRunStatus;
  durationMs: number;
  artifacts: ArtifactRef[];
  error?: string;
}

export interface RunResult {
  runId: string;
  durationMs: number;
  results: Record<string, NodeRunResult>;
  outputs: ArtifactRef[];
}

export interface NodeContext {
  node: RunNodeInput;
  inputs: Record<string, ArtifactRef[]>;
  params: Record<string, unknown>;
}

export type NodeHandler = (context: NodeContext) => Promise<ArtifactRef[]>;

export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphValidationError';
  }
}

export class NodeExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeExecutionError';
  }
}
