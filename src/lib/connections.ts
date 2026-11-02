import { getNodeDef } from '../nodes/catalog';
import { findInputPort, findOutputPort, isPortHandle, portsCompatible } from '../types';
import type { ForgeEdge, ForgeNode } from '../types';

export interface ConnectionCandidate {
  source: string | null;
  target: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export function isConnectionAllowed(
  connection: ConnectionCandidate,
  nodes: ForgeNode[],
  edges: ForgeEdge[],
): boolean {
  const { source: sourceId, target: targetId, sourceHandle, targetHandle } = connection;

  if (!sourceId || !targetId || sourceId === targetId) return false;

  const source = nodes.find((node) => node.id === sourceId);
  const target = nodes.find((node) => node.id === targetId);
  if (!source || !target) return false;

  const sourceDef = getNodeDef(source.data.defType);
  const targetDef = getNodeDef(target.data.defType);
  if (!sourceDef || !targetDef) return false;

  const sourcePort = findOutputPort(sourceDef, sourceHandle);
  const targetPort = findInputPort(targetDef, targetHandle);
  if (!sourcePort || !targetPort) return false;

  if (!portsCompatible(sourcePort.type, targetPort.type)) return false;

  if (targetPort.many) {
    if (
      targetHandle &&
      isPortHandle(targetPort.id, targetHandle) &&
      targetHandle !== targetPort.id &&
      edges.some((edge) => edge.target === targetId && edge.targetHandle === targetHandle)
    ) {
      return false;
    }
  } else if (
    edges.some((edge) => edge.target === targetId && edge.targetHandle === targetPort.id)
  ) {
    return false;
  }

  const stack = [targetId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === sourceId) return false;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of edges) {
      if (edge.source === current) stack.push(edge.target);
    }
  }

  return true;
}
