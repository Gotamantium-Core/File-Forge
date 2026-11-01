import { useCallback, useState, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, DefaultEdgeOptions, Edge, NodeTypes } from '@xyflow/react';
import { MousePointer2, Workflow } from 'lucide-react';
import { isConnectionAllowed } from '../lib/connections';
import { CATEGORY_META, getNodeDef } from '../nodes/catalog';
import { ForgeNodeView } from '../nodes/ForgeNodeView';
import { useGraphStore } from '../store/useGraphStore';
import type { ForgeNodeData } from '../types';

const nodeTypes: NodeTypes = { forge: ForgeNodeView };

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#b45309', strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#b45309', width: 14, height: 14 },
};

const fitViewOptions = { padding: 0.3 };

function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="max-w-sm rounded-2xl border border-dashed border-white/10 bg-forge-900/60 px-8 py-7 text-center backdrop-blur-sm">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-white/[0.06] bg-forge-850 text-amber-300/80">
          <Workflow size={20} strokeWidth={1.8} />
        </div>
        <h2 className="mt-3 text-[13px] font-medium text-zinc-200">Build your first pipeline</h2>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          Drag an input from the node library, then connect it to a converter and an output.
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-zinc-600">
          <MousePointer2 size={11} />
          Drag onto the canvas or click to add
        </div>
      </div>
    </div>
  );
}

export function Canvas() {
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const onNodesChange = useGraphStore((state) => state.onNodesChange);
  const onEdgesChange = useGraphStore((state) => state.onEdgesChange);
  const onConnect = useGraphStore((state) => state.onConnect);
  const addNode = useGraphStore((state) => state.addNode);
  const clearSelection = useGraphStore((state) => state.clearSelection);
  const { screenToFlowPosition } = useReactFlow();
  const [fitOnMount] = useState(() => useGraphStore.getState().nodes.length > 0);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const state = useGraphStore.getState();
    return isConnectionAllowed(connection, state.nodes, state.edges);
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const defType = event.dataTransfer.getData('application/forge-node');
      if (!defType) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(defType, { x: position.x - 116, y: position.y - 28 });
    },
    [addNode, screenToFlowPosition],
  );

  return (
    <div className="relative h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={clearSelection}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView={fitOnMount}
        fitViewOptions={fitViewOptions}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.25}
        maxZoom={1.75}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionLineStyle={{ stroke: '#fbbf24', strokeWidth: 1.5 }}
        className="forge-flow"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="#232331"
        />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={0}
          nodeColor={(node) => {
            const def = getNodeDef((node.data as ForgeNodeData).defType);
            return def ? CATEGORY_META[def.category].hex : '#3f3f46';
          }}
          maskColor="rgba(8, 8, 12, 0.72)"
          bgColor="#0d0d13"
          className="forge-minimap"
        />
      </ReactFlow>
      {nodes.length === 0 && <EmptyState />}
    </div>
  );
}
