import React, { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import dagre from 'dagre';

// Scoped CSS import is handled safely by Vite on the server
import '@xyflow/react/dist/style.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 260;
const NODE_HEIGHT = 60;

// ---------------------------------------------------------------------------
// Node & Edge Definitions
// ---------------------------------------------------------------------------

// Initial positions are set to { x: 0, y: 0 } intentionally —
// dagre recalculates all positions in getLayoutedElements() below.
const initialNodes: Node[] = [
  {
    id: 'docs',
    type: 'input',
    data: { label: '📄 MDX/Markdown Content' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(59, 130, 246, 0.1)',
      color: '#3b82f6',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '8px',
      padding: '10px',
      fontWeight: 'bold',
    },
  },
  {
    id: 'openapi',
    type: 'input',
    data: { label: '⚙️ openapi.yaml Spec' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(168, 85, 247, 0.1)',
      color: '#a855f7',
      border: '1px solid rgba(168, 85, 247, 0.3)',
      borderRadius: '8px',
      padding: '10px',
      fontWeight: 'bold',
    },
  },
  {
    id: 'engine',
    type: 'default',
    data: { label: '🚀 Astro Starlight Core' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(234, 179, 8, 0.1)',
      color: '#eab308',
      border: '1px solid rgba(234, 179, 8, 0.3)',
      borderRadius: '12px',
      padding: '12px',
      fontWeight: 'bold',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  },
  {
    id: 'plugin-openapi',
    type: 'default',
    data: { label: '🔌 starlight-openapi' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(244, 63, 94, 0.1)',
      color: '#f43f5e',
      border: '1px solid rgba(244, 63, 94, 0.3)',
      borderRadius: '6px',
      padding: '8px',
    },
  },
  {
    id: 'plugin-llms',
    type: 'default',
    data: { label: '🔌 starlight-llms-txt' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(16, 185, 129, 0.1)',
      color: '#10b981',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '6px',
      padding: '8px',
    },
  },
  {
    id: 'chat-api',
    type: 'default',
    data: { label: '🤖 GLM-5.2 API Route (/api/chat)' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(14, 165, 233, 0.1)',
      color: '#0ea5e9',
      border: '1px solid rgba(14, 165, 233, 0.3)',
      borderRadius: '8px',
      padding: '10px',
      fontWeight: 'bold',
    },
  },
  {
    id: 'assistant-ui',
    type: 'output',
    data: { label: '💬 Chat Interface (assistant-ui)' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(99, 102, 241, 0.1)',
      color: '#6366f1',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '8px',
      padding: '10px',
      fontWeight: 'bold',
    },
  },
  {
    id: 'dist',
    type: 'output',
    data: { label: '🌐 Published Site / Static Output' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(248, 250, 252, 0.05)',
      color: '#cbd5e1',
      border: '1px solid rgba(248, 250, 252, 0.2)',
      borderRadius: '8px',
      padding: '12px',
      fontWeight: 'bold',
    },
  },
];

const defaultMarker = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
  color: '#3b82f6',
};

const initialEdges: Edge[] = [
  { id: 'e1', source: 'docs', target: 'engine', type: 'smoothstep', animated: true, markerEnd: defaultMarker, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e2', source: 'openapi', target: 'engine', type: 'smoothstep', animated: true, markerEnd: defaultMarker, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e3', source: 'engine', target: 'plugin-openapi', type: 'smoothstep', markerEnd: defaultMarker, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e4', source: 'engine', target: 'plugin-llms', type: 'smoothstep', markerEnd: defaultMarker, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e5', source: 'plugin-openapi', target: 'dist', type: 'smoothstep', markerEnd: defaultMarker, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e6', source: 'plugin-llms', target: 'dist', type: 'smoothstep', markerEnd: defaultMarker, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e7', source: 'docs', target: 'chat-api', type: 'smoothstep', label: 'Context Injection', style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5,5' }, markerEnd: defaultMarker },
  { id: 'e8', source: 'chat-api', target: 'assistant-ui', type: 'smoothstep', animated: true, label: 'SSE Stream', markerEnd: defaultMarker, style: { stroke: '#3b82f6', strokeWidth: 2 } },
];

// ---------------------------------------------------------------------------
// Dagre Layout
// ---------------------------------------------------------------------------

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DiagramIsland() {
  // Compute layout inside the component to avoid SSR shared-state issues.
  // useMemo ensures the dagre computation runs only once per mount.
  const initialLayout = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    []
  );

  const [nodes, setNodes] = useState<Node[]>(initialLayout.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialLayout.edges);

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

  return (
    <div style={{ width: '100%', height: '450px' }} className="react-flow-island">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 2, stroke: '#3b82f6' },
        }}
      >
        <Background color="#334155" gap={16} size={1} />
        <Controls />
        <MiniMap nodeColor={() => '#3b82f6'} maskColor="rgba(15, 23, 42, 0.7)" />
      </ReactFlow>
    </div>
  );
}
