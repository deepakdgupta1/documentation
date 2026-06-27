import React, { useState, useEffect } from 'react';

// Scoped CSS import is handled safely by Vite on the server
import '@xyflow/react/dist/style.css';

const initialNodes = [
  {
    id: 'docs',
    type: 'input',
    data: { label: '📄 MDX/Markdown Content' },
    position: { x: 50, y: 50 },
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
    position: { x: 250, y: 50 },
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
    position: { x: 150, y: 150 },
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
    position: { x: 50, y: 250 },
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
    position: { x: 250, y: 250 },
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
    position: { x: 450, y: 150 },
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
    position: { x: 450, y: 270 },
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
    position: { x: 150, y: 350 },
    style: {
      background: 'rgba(248, 250, 252, 0.05)',
      border: '1px solid rgba(248, 250, 252, 0.2)',
      borderRadius: '8px',
      padding: '12px',
      fontWeight: 'bold',
    },
  },
];

const initialEdges = [
  { id: 'e1', source: 'docs', target: 'engine', animated: true },
  { id: 'e2', source: 'openapi', target: 'engine', animated: true },
  { id: 'e3', source: 'engine', target: 'plugin-openapi' },
  { id: 'e4', source: 'engine', target: 'plugin-llms' },
  { id: 'e5', source: 'plugin-openapi', target: 'dist' },
  { id: 'e6', source: 'plugin-llms', target: 'dist' },
  { id: 'e7', source: 'docs', target: 'chat-api', label: 'Context Injection', style: { strokeDasharray: '5,5' } },
  { id: 'e8', source: 'chat-api', target: 'assistant-ui', animated: true, label: 'SSE Stream' },
];

export default function DiagramIsland() {
  const [Flow, setFlow] = useState<any>(null);
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  useEffect(() => {
    // Dynamic import forces client-only resolution
    import('@xyflow/react').then((mod) => {
      setFlow(mod);
    });
  }, []);

  if (!Flow) {
    return (
      <div 
        style={{ width: '100%', height: '400px' }} 
        className="react-flow-island bg-slate-900/50 flex items-center justify-center text-slate-400 text-sm border border-slate-800 rounded-xl"
      >
        Loading architecture diagram...
      </div>
    );
  }

  const { ReactFlow, Background, Controls, MiniMap } = Flow;

  const onNodesChange = (changes: any) => {
    setNodes((nds) => {
      if (Flow.applyNodeChanges) {
        return Flow.applyNodeChanges(changes, nds);
      }
      return nds;
    });
  };

  const onEdgesChange = (changes: any) => {
    setEdges((eds) => {
      if (Flow.applyEdgeChanges) {
        return Flow.applyEdgeChanges(changes, eds);
      }
      return eds;
    });
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
