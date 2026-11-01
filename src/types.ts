import type { Edge, Node } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import type { ArtifactRef } from '../shared/artifacts';
import type { NodeSpec } from '../shared/nodes';

export type { ArtifactKind, ArtifactRef } from '../shared/artifacts';
export type { NodeCategory, NodeSpec, PortDef, PortType } from '../shared/nodes';
export { PORT_COLORS, portTypeLabel, portsCompatible } from '../shared/nodes';

export interface NodeDef extends NodeSpec {
  icon: LucideIcon;
}

export interface ForgeNodeData extends Record<string, unknown> {
  defType: string;
  params: Record<string, unknown>;
  artifacts?: ArtifactRef[];
}

export type ForgeNode = Node<ForgeNodeData>;
export type ForgeEdge = Edge;
