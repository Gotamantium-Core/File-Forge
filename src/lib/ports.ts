import { resolveInputPorts, resolveOutputPorts } from '../types';
import type { ForgeEdge, ForgeNode, NodeDef, PortDef } from '../types';

export function getInputPorts(
  def: NodeDef,
  node: Pick<ForgeNode, 'id' | 'data'>,
  edges: ForgeEdge[],
): PortDef[] {
  const handles = edges
    .filter((edge) => edge.target === node.id && edge.targetHandle)
    .map((edge) => edge.targetHandle as string);
  return resolveInputPorts(def, handles);
}

export function getOutputPorts(
  def: NodeDef,
  node: Pick<ForgeNode, 'id' | 'data'>,
  edges: ForgeEdge[],
): PortDef[] {
  void edges;
  return resolveOutputPorts(def, node.data.artifacts);
}
