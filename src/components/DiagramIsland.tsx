import React, { useState, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, type Node, type Edge } from '@xyflow/react';
import dagre from 'dagre';

// Scoped CSS import is handled safely by Vite on the server
import '@xyflow/react/dist/style.css';

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
    data: { label: '🚀 Astro Starlight Core' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(234, 179, 8, 0.1)',
      color: '#eab308',
      border: '1px solid rgba(234, 179, 8, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      fontWeight: 'bold',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  },
  {
    id: 'plugin-openapi',
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
    data: { label: '🤖 GLM-5.2 API Route (/api/chat)' },
    position: { x: 0, y: 0 },
    style: {
      background: 'rgba(14, 165, 233, 0.1)',
      color: '#0ea5e9',
      border: '1px solid rgba(0, 165, 233, 0.3)',
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
      border: '1px solid rgba(248, 250, 252, 0.2)',
      borderRadius: '8px',
      padding: '12px',
      fontWeight: 'bold',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'docs', target: 'engine', animated: true },
  { id: 'e2', source: 'openapi', target: 'engine', animated: true },
  { id: 'e3', source: 'engine', target: 'plugin-openapi' },
  { id: 'e4', source: 'engine', target: 'plugin-llms' },
  { id: 'e5', source: 'plugin-openapi', target: 'dist' },
  { id: 'e6', source: 'plugin-llms', target: 'dist' },
  { id: 'e7', source: 'docs', target: 'chat-api', label: 'Context Injection', style: { strokeDasharray: '5,5' } },
  { id: 'e8', source: 'chat-api', target: 'assistant-ui', animated: true, label: 'SSE Stream' },
];

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 50 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 250 / 2,
        y: nodeWithPosition.y - 50 / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

export default function DiagramIsland() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, []);

  const onNodesChange = (changes: any) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onEdgesChange = (changes: any) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

  return (
    <div style={{ width: '100%', height: '400px' }} className="react-flow-island">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background color="#cbd5e1" gap={16} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
