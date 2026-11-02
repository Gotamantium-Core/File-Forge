import { randomUUID } from 'node:crypto';
import {
  findInputPort,
  findOutputPort,
  getNodeSpec,
  portsCompatible,
  resolveOutputPorts,
} from '../../shared/nodes';
import type { ArtifactRef } from '../../shared/artifacts';
import { NODE_HANDLERS } from './nodes';
import { GraphValidationError } from './types';
import type { NodeRunResult, RunEdgeInput, RunNodeInput, RunResult } from './types';

export async function executeGraph(
  nodes: RunNodeInput[],
  edges: RunEdgeInput[],
): Promise<RunResult> {
  const startedAt = performance.now();

  const nodeMap = new Map<string, RunNodeInput>();
  for (const node of nodes) {
    if (nodeMap.has(node.id)) {
      throw new GraphValidationError(`Duplicate node id "${node.id}".`);
    }
    if (!getNodeSpec(node.data.defType)) {
      throw new GraphValidationError(`Unknown node type "${node.data.defType}".`);
    }
    nodeMap.set(node.id, node);
  }

  const incoming = new Map<string, RunEdgeInput[]>();
  const outgoing = new Map<string, RunEdgeInput[]>();
  for (const node of nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }

  const inputCounts = new Map<string, number>();

  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) {
      throw new GraphValidationError('An edge points to a missing node.');
    }

    const sourceSpec = getNodeSpec(source.data.defType) as NonNullable<
      ReturnType<typeof getNodeSpec>
    >;
    const targetSpec = getNodeSpec(target.data.defType) as NonNullable<
      ReturnType<typeof getNodeSpec>
    >;
    const sourcePort =
      resolveOutputPorts(sourceSpec, source.data.artifacts).find(
        (port) => port.id === edge.sourceHandle,
      ) ?? findOutputPort(sourceSpec, edge.sourceHandle);
    const targetPort = findInputPort(targetSpec, edge.targetHandle);

    if (!sourcePort || !targetPort) {
      throw new GraphValidationError(
        `An edge references a missing port on "${targetSpec.label}".`,
      );
    }
    if (!portsCompatible(sourcePort.type, targetPort.type)) {
      throw new GraphValidationError(
        `Cannot connect ${sourcePort.type} output to ${targetPort.type} input on "${targetSpec.label}".`,
      );
    }

    const key = `${edge.target}::${targetPort.id}`;
    const count = (inputCounts.get(key) ?? 0) + 1;
    if (!targetPort.many && count > 1) {
      throw new GraphValidationError(
        `"${targetSpec.label}" accepts only one connection on "${targetPort.label}".`,
      );
    }
    inputCounts.set(key, count);

    incoming.get(edge.target)?.push(edge);
    outgoing.get(edge.source)?.push(edge);
  }

  const indegree = new Map<string, number>();
  for (const node of nodes) {
    indegree.set(node.id, incoming.get(node.id)?.length ?? 0);
  }

  const queue = nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const next = edge.target;
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }

  if (order.length !== nodes.length) {
    throw new GraphValidationError('The pipeline contains a cycle.');
  }

  const results: Record<string, NodeRunResult> = {};

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId) as RunNodeInput;
    const spec = getNodeSpec(node.data.defType) as NonNullable<
      ReturnType<typeof getNodeSpec>
    >;
    const nodeStartedAt = performance.now();

    const inputs: Record<string, ArtifactRef[]> = {};
    let blocked = false;

    for (const edge of incoming.get(nodeId) ?? []) {
      const upstream = results[edge.source];
      if (!upstream || upstream.status !== 'success') {
        blocked = true;
        break;
      }

      const source = nodeMap.get(edge.source);
      const sourceSpec = source ? getNodeSpec(source.data.defType) : undefined;
      const sourcePort = sourceSpec
        ? resolveOutputPorts(sourceSpec, upstream.artifacts).find(
            (port) => port.id === edge.sourceHandle,
          )
        : undefined;

      let artifacts = upstream.artifacts;
      if (sourcePort?.artifactId) {
        artifacts = upstream.artifacts.filter(
          (artifact) => artifact.id === sourcePort.artifactId,
        );
      } else if (sourcePort?.index !== undefined) {
        const picked = upstream.artifacts[sourcePort.index];
        artifacts = picked ? [picked] : [];
      }

      const targetPort = findInputPort(spec, edge.targetHandle);
      const portId = targetPort?.id ?? (edge.targetHandle as string);
      inputs[portId] = [...(inputs[portId] ?? []), ...artifacts];
    }

    if (blocked) {
      results[nodeId] = {
        status: 'skipped',
        durationMs: 0,
        artifacts: [],
        error: 'Skipped because an upstream node did not complete.',
      };
      continue;
    }

    const missing = spec.inputs.filter(
      (port) => !port.optional && !(inputs[port.id]?.length),
    );
    if (missing.length > 0) {
      results[nodeId] = {
        status: 'error',
        durationMs: Math.round(performance.now() - nodeStartedAt),
        artifacts: [],
        error: `Missing input: ${missing.map((port) => port.label).join(', ')}.`,
      };
      continue;
    }

    const handler = NODE_HANDLERS[node.data.defType];
    if (!handler) {
      results[nodeId] = {
        status: 'error',
        durationMs: 0,
        artifacts: [],
        error: `${spec.label} is not implemented yet.`,
      };
      continue;
    }

    try {
      const artifacts = await handler({
        node,
        inputs,
        params: node.data.params ?? {},
      });
      results[nodeId] = {
        status: 'success',
        durationMs: Math.round(performance.now() - nodeStartedAt),
        artifacts,
      };
    } catch (error) {
      results[nodeId] = {
        status: 'error',
        durationMs: Math.round(performance.now() - nodeStartedAt),
        artifacts: [],
        error: error instanceof Error ? error.message : 'Unexpected conversion error.',
      };
    }
  }

  const outputNodes = nodes.filter(
    (node) => node.data.defType === 'output' && results[node.id]?.status === 'success',
  );

  let outputs: ArtifactRef[] = [];

  if (outputNodes.length > 0) {
    outputs = outputNodes.flatMap((node) => results[node.id].artifacts);
  } else {
    const hasOutgoing = new Set(edges.map((edge) => edge.source));
    outputs = nodes
      .filter((node) => !hasOutgoing.has(node.id) && results[node.id]?.status === 'success')
      .flatMap((node) => results[node.id].artifacts);
  }

  return {
    runId: randomUUID(),
    durationMs: Math.round(performance.now() - startedAt),
    results,
    outputs,
  };
}
