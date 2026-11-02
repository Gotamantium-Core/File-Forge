import { create } from 'zustand';
import { runPipeline } from '../lib/api';
import type { NodeRunResult, RunResponse } from '../lib/api';
import type { ArtifactRef, ForgeEdge, ForgeNode } from '../types';
import { useGraphStore } from './useGraphStore';
import { getNodeDef } from '../nodes/catalog';

export type RunStatus = 'idle' | 'running' | 'success' | 'error';

interface RunStore {
  status: RunStatus;
  results: Record<string, NodeRunResult>;
  outputs: ArtifactRef[];
  error?: string;
  durationMs?: number;
  runId?: string;
  run: (nodes: ForgeNode[], edges: ForgeEdge[]) => Promise<void>;
  reset: () => void;
}

export const useRunStore = create<RunStore>((set) => ({
  status: 'idle',
  results: {},
  outputs: [],

  run: async (nodes, edges) => {
    if (nodes.length === 0) return;

    set({
      status: 'running',
      error: undefined,
      results: {},
      outputs: [],
      durationMs: undefined,
      runId: undefined,
    });

    try {
      const response: RunResponse = await runPipeline(nodes, edges);
      const hasErrors = Object.values(response.results).some(
        (result) => result.status === 'error',
      );

      const graphState = useGraphStore.getState();
      for (const node of nodes) {
        const result = response.results[node.id];
        if (!result || result.status !== 'success') continue;
        const def = getNodeDef(node.data.defType);
        if (!def) continue;
        if (def.category === 'input') continue;
        graphState.setNodeArtifacts(node.id, result.artifacts);
      }

      set({
        status: hasErrors ? 'error' : 'success',
        results: response.results,
        outputs: response.outputs,
        error: hasErrors ? 'Some nodes failed. Check the highlighted nodes.' : undefined,
        durationMs: response.durationMs,
        runId: response.runId,
      });
    } catch (error) {
      set({
        status: 'error',
        results: {},
        outputs: [],
        error: error instanceof Error ? error.message : 'Run failed.',
      });
    }
  },

  reset: () =>
    set({
      status: 'idle',
      results: {},
      outputs: [],
      error: undefined,
      durationMs: undefined,
      runId: undefined,
    }),
}));
