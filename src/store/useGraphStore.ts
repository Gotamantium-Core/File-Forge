import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { Connection, EdgeChange, NodeChange } from '@xyflow/react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PARAMS, findInputPort, resolveOutputPorts } from '../../shared/nodes';
import { isConnectionAllowed } from '../lib/connections';
import { getNodeDef } from '../nodes/catalog';
import type { ForgeEdge, ForgeNode, ForgeNodeData } from '../types';

export type EdgeStyle = 'smoothstep' | 'straight' | 'bezier' | 'step';
export type AccentColor = 'amber' | 'red' | 'blue' | 'green' | 'purple';

interface GraphStore {
  projectName: string;
  nodes: ForgeNode[];
  edges: ForgeEdge[];
  edgeStyle: EdgeStyle;
  accentColor: AccentColor;
  setProjectName: (name: string) => void;
  setEdgeStyle: (style: EdgeStyle) => void;
  setAccentColor: (color: AccentColor) => void;
  onNodesChange: (changes: NodeChange<ForgeNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ForgeEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (defType: string, position?: { x: number; y: number }) => void;
  updateNodeParams: (id: string, patch: Record<string, unknown>) => void;
  setNodeArtifacts: (id: string, artifacts: ForgeNodeData['artifacts']) => void;
  duplicateNode: (id: string) => void;
  deleteNodes: (ids: string[]) => void;
  clearSelection: () => void;
  clearGraph: () => void;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cascadePosition(count: number): { x: number; y: number } {
  return {
    x: 140 + (count % 6) * 36,
    y: 110 + (count % 6) * 36,
  };
}

export const useGraphStore = create<GraphStore>()(
  persist(
    (set, get) => ({
      projectName: 'Untitled pipeline',
      nodes: [],
      edges: [],
      edgeStyle: 'smoothstep' as EdgeStyle,
      accentColor: 'amber' as AccentColor,

      setProjectName: (name) => set({ projectName: name }),
      setEdgeStyle: (style) => set({ edgeStyle: style }),
      setAccentColor: (color) => set({ accentColor: color }),

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
      },

      onConnect: (connection) => {
        const state = get();
        if (!isConnectionAllowed(connection, state.nodes, state.edges)) return;
        set({ edges: addEdge(connection, state.edges) });
      },

      addNode: (defType, position) => {
        const def = getNodeDef(defType);
        if (!def) return;

        const state = get();
        const node: ForgeNode = {
          id: createId(),
          type: 'forge',
          position: position ?? cascadePosition(state.nodes.length),
          data: { defType, params: { ...(DEFAULT_PARAMS[defType] ?? {}) } },
          selected: true,
        };

        set({
          nodes: [
            ...state.nodes.map((existing) =>
              existing.selected ? { ...existing, selected: false } : existing,
            ),
            node,
          ],
        });
      },

      updateNodeParams: (id, patch) => {
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    params: { ...node.data.params, ...patch },
                  },
                }
              : node,
          ),
        }));
      },

      setNodeArtifacts: (id, artifacts) => {
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, artifacts } }
              : node,
          ),
        }));
      },

      duplicateNode: (id) => {
        const state = get();
        const node = state.nodes.find((candidate) => candidate.id === id);
        if (!node) return;

        const clone: ForgeNode = {
          ...node,
          id: createId(),
          position: { x: node.position.x + 36, y: node.position.y + 36 },
          selected: true,
          data: {
            ...node.data,
            params: { ...node.data.params },
            artifacts: node.data.artifacts ? [...node.data.artifacts] : undefined,
          },
        };

        set({
          nodes: [
            ...state.nodes.map((existing) => ({ ...existing, selected: false })),
            clone,
          ],
        });
      },

      deleteNodes: (ids) => {
        const doomed = new Set(ids);
        const state = get();
        set({
          nodes: state.nodes.filter((node) => !doomed.has(node.id)),
          edges: state.edges.filter(
            (edge) => !doomed.has(edge.source) && !doomed.has(edge.target),
          ),
        });
      },

      clearSelection: () => {
        const state = get();
        set({
          nodes: state.nodes.map((node) =>
            node.selected ? { ...node, selected: false } : node,
          ),
          edges: state.edges.map((edge) =>
            edge.selected ? { ...edge, selected: false } : edge,
          ),
        });
      },

      clearGraph: () => set({ nodes: [], edges: [] }),
    }),
    {
      name: 'file-forge-graph',
      version: 3,
      migrate: (persisted, version) => {
        if (version >= 3) return persisted as GraphStore;

        const state = persisted as
          | (Partial<GraphStore> & Pick<GraphStore, 'nodes' | 'edges'>)
          | undefined;
        if (!state?.nodes || !state.edges) return persisted as GraphStore;

        let edges = state.edges;

        if (version < 2) {
          const validHandles = new Map<string, Set<string>>();
          for (const node of state.nodes) {
            const def = getNodeDef(node.data.defType);
            if (def) {
              validHandles.set(
                node.id,
                new Set(
                  resolveOutputPorts(def, node.data.artifacts).map((port) => port.id),
                ),
              );
            }
          }

          edges = edges.filter((edge) => {
            const handles = validHandles.get(edge.source);
            return !handles || !edge.sourceHandle || handles.has(edge.sourceHandle);
          });
        }

        const nodeMap = new Map(state.nodes.map((node) => [node.id, node]));
        const counters = new Map<string, number>();
        const fileInputPorts = new Map<string, string>();
        for (const node of state.nodes) {
          const def = getNodeDef(node.data.defType);
          if (def && (def.type === 'image-input' || def.type === 'pdf-input')) {
            fileInputPorts.set(node.id, def.outputs[0]?.id ?? '');
          }
        }

        edges = edges.map((edge) => {
          let next = edge;
          const sourcePortId = fileInputPorts.get(edge.source);
          if (
            sourcePortId &&
            edge.sourceHandle?.startsWith(`${sourcePortId}:`) &&
            !edge.sourceHandle.startsWith(`${sourcePortId}:out:`)
          ) {
            const suffix = edge.sourceHandle.slice(sourcePortId.length + 1);
            next = { ...next, sourceHandle: `${sourcePortId}:out:${suffix}` };
          }

          const target = nodeMap.get(edge.target);
          const def = target ? getNodeDef(target.data.defType) : undefined;
          const port = def ? findInputPort(def, edge.targetHandle) : undefined;
          if (!port?.many) return next;

          const key = `${edge.target}::${port.id}`;
          const index = counters.get(key) ?? 0;
          counters.set(key, index + 1);
          return { ...next, targetHandle: `${port.id}:in:${index}` };
        });

        return { ...state, edges } as GraphStore;
      },
      partialize: (state) => ({
        projectName: state.projectName,
        nodes: state.nodes,
        edges: state.edges,
        edgeStyle: state.edgeStyle,
        accentColor: state.accentColor,
      }),
    },
  ),
);
