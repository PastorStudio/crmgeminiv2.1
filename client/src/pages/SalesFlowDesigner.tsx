import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactFlow, { 
  Node, 
  Edge, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  addEdge,
  Connection,
  EdgeChange,
  NodeChange,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '../lib/queryClient';

import { 
  MessageSquare, 
  GitBranch, 
  Zap, 
  MessageCircle, 
  Plus, 
  Save, 
  Play, 
  Settings,
  BarChart3,
  Users,
  Target,
  Clock,
  Link,
  CheckCircle,
  Send,
  Calendar,
  X,
  Circle
} from 'lucide-react';

import { Handle, Position } from 'reactflow';

// Basic node component with deletion button
const BasicNode = ({ data, bgColor, borderColor, textColor, icon: Icon, onDelete }: any) => (
  <div className={`relative px-4 py-2 shadow-md rounded-md ${bgColor} border-2 ${borderColor}`}>
    {/* Delete button */}
    <button
      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 z-10"
      onClick={(e) => {
        e.stopPropagation();
        onDelete(data.nodeId);
      }}
    >
      <X className="w-3 h-3" />
    </button>

    {/* Node content */}
    <div className="flex items-center">
      <Icon className={`w-4 h-4 mr-2 ${textColor}`} />
      <div>
        <div className={`text-sm font-bold ${textColor.replace('600', '800')}`}>{data.label}</div>
        <div className={`text-xs ${textColor}`}>{data.description}</div>
      </div>
    </div>

    {/* React Flow handles */}
    <Handle type="target" position={Position.Top} style={{ top: -8, backgroundColor: '#6366F1' }} />
    <Handle type="source" position={Position.Bottom} style={{ bottom: -8, backgroundColor: '#6366F1' }} />
  </div>
);

// Custom node types with enhanced functionality
const nodeTypes = {
  trigger: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-blue-100 border-2 border-blue-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#3B82F6' }}
      />
      <div className="flex items-center">
        <GitBranch className="w-4 h-4 mr-2 text-blue-600" />
        <div>
          <div className="text-sm font-bold text-blue-800">{data.label}</div>
          <div className="text-xs text-blue-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ bottom: -8, left: '25%', backgroundColor: '#10B981' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ bottom: -8, right: '25%', backgroundColor: '#EF4444' }}
      />
    </div>
  ),
  action: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-orange-100 border-2 border-orange-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#F59E0B' }}
      />
      <div className="flex items-center">
        <Target className="w-4 h-4 mr-2 text-orange-600" />
        <div>
          <div className="text-sm font-bold text-orange-800">{data.label}</div>
          <div className="text-xs text-orange-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#F59E0B' }}
      />
    </div>
  ),
  response: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-purple-100 border-2 border-purple-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#8B5CF6' }}
      />
      <div className="flex items-center">
        <MessageCircle className="w-4 h-4 mr-2 text-purple-600" />
        <div>
          <div className="text-sm font-bold text-purple-800">{data.label}</div>
          <div className="text-xs text-purple-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#8B5CF6' }}
      />
    </div>
  ),
  automation: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-cyan-100 border-2 border-cyan-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#06B6D4' }}
      />
      <div className="flex items-center">
        <Settings className="w-4 h-4 mr-2 text-cyan-600" />
        <div>
          <div className="text-sm font-bold text-cyan-800">{data.label}</div>
          <div className="text-xs text-cyan-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#06B6D4' }}
      />
    </div>
  ),
  handoff: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-rose-100 border-2 border-rose-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#F43F5E' }}
      />
      <div className="flex items-center">
        <Users className="w-4 h-4 mr-2 text-rose-600" />
        <div>
          <div className="text-sm font-bold text-rose-800">{data.label}</div>
          <div className="text-xs text-rose-600">{data.description}</div>
        </div>
      </div>
    </div>
  ),
  delay: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-orange-100 border-2 border-orange-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#F97316' }}
      />
      <div className="flex items-center">
        <MessageSquare className="w-4 h-4 mr-2 text-orange-600" />
        <div>
          <div className="text-sm font-bold text-orange-800">{data.label}</div>
          <div className="text-xs text-orange-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#F97316' }}
      />
    </div>
  ),
  webhook: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-indigo-100 border-2 border-indigo-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#6366F1' }}
      />
      <div className="flex items-center">
        <MessageSquare className="w-4 h-4 mr-2 text-indigo-600" />
        <div>
          <div className="text-sm font-bold text-indigo-800">{data.label}</div>
          <div className="text-xs text-indigo-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#6366F1' }}
      />
    </div>
  ),
  validation: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-emerald-100 border-2 border-emerald-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#10B981' }}
      />
      <div className="flex items-center">
        <MessageSquare className="w-4 h-4 mr-2 text-emerald-600" />
        <div>
          <div className="text-sm font-bold text-emerald-800">{data.label}</div>
          <div className="text-xs text-emerald-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#10B981' }}
      />
    </div>
  ),
  broadcast: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-pink-100 border-2 border-pink-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#EC4899' }}
      />
      <div className="flex items-center">
        <MessageSquare className="w-4 h-4 mr-2 text-pink-600" />
        <div>
          <div className="text-sm font-bold text-pink-800">{data.label}</div>
          <div className="text-xs text-pink-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#EC4899' }}
      />
    </div>
  ),
  schedule: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-teal-100 border-2 border-teal-500">
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: -8, backgroundColor: '#14B8A6' }}
      />
      <div className="flex items-center">
        <MessageSquare className="w-4 h-4 mr-2 text-teal-600" />
        <div>
          <div className="text-sm font-bold text-teal-800">{data.label}</div>
          <div className="text-xs text-teal-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#14B8A6' }}
      />
    </div>
  )
};

// Initial demo flow
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'trigger',
    position: { x: 250, y: 25 },
    data: { 
      label: 'Primer Contacto',
      description: 'Cliente envía primer mensaje',
      config: {
        triggers: ['hola', 'info', 'precio'],
        responses: ['¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte?']
      }
    },
  },
  {
    id: '2',
    type: 'condition',
    position: { x: 250, y: 125 },
    data: { 
      label: '¿Interés en producto?',
      description: 'Detectar intención de compra',
      config: {
        conditions: [
          { type: 'intent', value: 'interested', nextNodeId: 3, response: 'Perfecto, te ayudo con eso.' },
          { type: 'intent', value: 'price', nextNodeId: 4, response: 'Te explico sobre precios.' }
        ]
      }
    },
  },
  {
    id: '3',
    type: 'action',
    position: { x: 100, y: 225 },
    data: { 
      label: 'Calificar Lead',
      description: 'Recopilar información del cliente',
      config: {
        actions: [
          { type: 'collect_name', response: '¿Cuál es tu nombre?' },
          { type: 'update_lead_score', value: 10 }
        ]
      }
    },
  },
  {
    id: '4',
    type: 'response',
    position: { x: 400, y: 225 },
    data: { 
      label: 'Enviar Información',
      description: 'Proporcionar detalles y precios',
      config: {
        responses: ['Hola {customerName}, aquí tienes la información que solicitaste...'],
        aiPrompt: 'Genera una respuesta personalizada con información de productos y precios'
      }
    },
  }
];

const initialEdges: Edge[] = [
  { 
    id: 'e1-2', 
    source: '1', 
    target: '2', 
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#10B981', strokeWidth: 2 }
  },
  { 
    id: 'e2-3', 
    source: '2', 
    sourceHandle: 'yes',
    target: '3', 
    label: 'Interesado', 
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#10B981', strokeWidth: 2 }
  },
  { 
    id: 'e2-4', 
    source: '2', 
    sourceHandle: 'no',
    target: '4', 
    label: 'Precio', 
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#EF4444', strokeWidth: 2 }
  }
];

export default function SalesFlowDesigner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Get sales flow data
  const { data: flowData, isLoading } = useQuery({
    queryKey: ['/api/sales-flow'],
    queryFn: async () => {
      return await apiRequest('/api/sales-flow');
    }
  });

  // Save flow mutation
  const saveFlowMutation = useMutation({
    mutationFn: async (flowData: { nodes: Node[], edges: Edge[] }) => {
      return await apiRequest('/api/sales-flow', {
        method: 'POST',
        body: flowData
      });
    },
    onSuccess: () => {
      toast({
        title: "Flujo guardado",
        description: "El flujo de ventas se ha guardado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar el flujo de ventas.",
        variant: "destructive",
      });
    }
  });

  // Get flow analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/sales-flow/analytics'],
    queryFn: async () => {
      return await apiRequest('/api/sales-flow/analytics');
    }
  });

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `${params.source}-${params.target}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#6B7280', strokeWidth: 2 },
        animated: true
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setIsConfigOpen(true);
  }, []);

  // Node deletion functionality
  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    const nodeIdsToDelete = nodesToDelete.map(node => node.id);
    
    // Remove nodes
    setNodes(nodes => nodes.filter(node => !nodeIdsToDelete.includes(node.id)));
    
    // Remove edges connected to deleted nodes
    setEdges(edges => edges.filter(edge => 
      !nodeIdsToDelete.includes(edge.source) && 
      !nodeIdsToDelete.includes(edge.target)
    ));
  }, [setNodes, setEdges]);

  // Handle key press for deletion
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selectedNodes = nodes.filter(node => node.selected);
      if (selectedNodes.length > 0) {
        onNodesDelete(selectedNodes);
      }
    }
  }, [nodes, onNodesDelete]);

  // Add event listener for key presses
  React.useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  // Context menu for right-click options
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setSelectedNode(node);
    // You can add a context menu here for delete/edit options
  }, []);

  // Edge deletion functionality
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    // Allow clicking on edges to select and delete them
    setEdges((edges) => edges.filter((e) => e.id !== edge.id));
  }, [setEdges]);

  // Manual connection state
  const [connectionMode, setConnectionMode] = useState(false);
  const [selectedSourceNode, setSelectedSourceNode] = useState<string | null>(null);

  // Manual connection functionality
  const startConnection = useCallback((nodeId: string) => {
    setSelectedSourceNode(nodeId);
    setConnectionMode(true);
  }, []);

  const completeConnection = useCallback((targetNodeId: string) => {
    if (selectedSourceNode && selectedSourceNode !== targetNodeId) {
      const newEdge: Edge = {
        id: `${selectedSourceNode}-${targetNodeId}`,
        source: selectedSourceNode,
        target: targetNodeId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#6B7280', strokeWidth: 2 },
        animated: true
      };
      setEdges((eds) => addEdge(newEdge, eds));
    }
    setConnectionMode(false);
    setSelectedSourceNode(null);
  }, [selectedSourceNode, setEdges]);

  const cancelConnection = useCallback(() => {
    setConnectionMode(false);
    setSelectedSourceNode(null);
  }, []);

  const addNewNode = (type: string) => {
    const nodeLabels = {
      trigger: 'Disparador',
      condition: 'Condición',
      action: 'Acción',
      response: 'Respuesta',
      automation: 'Automatización',
      handoff: 'Transferir Agente',
      delay: 'Esperar/Delay',
      webhook: 'Webhook/API',
      validation: 'Validación',
      broadcast: 'Difusión',
      schedule: 'Programar'
    };

    const newNode: Node = {
      id: `${Date.now()}`, // Use timestamp for unique IDs
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: `Nuevo ${nodeLabels[type as keyof typeof nodeLabels]}`,
        description: 'Haz clic para configurar',
        config: {}
      }
    };

    setNodes((nds) => nds.concat(newNode));
  };

  const saveFlow = () => {
    saveFlowMutation.mutate({ nodes, edges });
  };

  const updateNodeConfig = (nodeId: string, newConfig: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newConfig } }
          : node
      )
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Diseñador de Flujo de Ventas</h1>
          <p className="text-muted-foreground">Crea y gestiona el flujo de conversación de WhatsApp</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAnalyticsOpen(true)}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Analíticas
          </Button>
          <Button onClick={saveFlow} disabled={saveFlowMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveFlowMutation.isPending ? 'Guardando...' : 'Guardar Flujo'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-64 bg-gray-50 border-r p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Agregar Nodos</h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('trigger')}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Trigger
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('condition')}
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  Condición
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('action')}
                >
                  <Target className="w-4 h-4 mr-2" />
                  Acción
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('response')}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Respuesta
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('automation')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Automatización
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('handoff')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Transferir Agente
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('delay')}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Esperar/Delay
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('webhook')}
                >
                  <Link className="w-4 h-4 mr-2" />
                  Webhook/API
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('validation')}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validación
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('broadcast')}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Difusión
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => addNewNode('schedule')}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Programar
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Etapas de Venta</h3>
              <div className="space-y-1">
                <Badge variant="outline" className="text-green-600">Prospección</Badge>
                <Badge variant="outline" className="text-blue-600">Calificación</Badge>
                <Badge variant="outline" className="text-orange-600">Propuesta</Badge>
                <Badge variant="outline" className="text-purple-600">Negociación</Badge>
                <Badge variant="outline" className="text-red-600">Cierre</Badge>
              </div>
            </div>

            {analytics && (
              <div>
                <h3 className="font-semibold mb-2">Estadísticas</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Conversaciones activas:</span>
                    <span className="font-medium">{analytics.activeConversations || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tasa de conversión:</span>
                    <span className="font-medium">{analytics.conversionRate || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tiempo promedio:</span>
                    <span className="font-medium">{analytics.avgTime || 0}min</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Flow Editor */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeClick={onEdgeClick}
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes}
            connectionMode={'loose' as any}
            snapToGrid={true}
            snapGrid={[15, 15]}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            fitView
            attributionPosition="bottom-left"
            selectNodesOnDrag={true}
            multiSelectionKeyCode="Shift"
            deleteKeyCode="Delete"
          >
            <Controls />
            <Background color="#aaa" gap={16} />
          </ReactFlow>
        </div>
      </div>

      {/* Node Configuration Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Nodo: {selectedNode?.data.label}</DialogTitle>
          </DialogHeader>
          
          {selectedNode && (
            <NodeConfigForm 
              node={selectedNode}
              onSave={(config) => {
                updateNodeConfig(selectedNode.id, config);
                setIsConfigOpen(false);
              }}
              onCancel={() => setIsConfigOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Analíticas del Flujo de Ventas</DialogTitle>
          </DialogHeader>
          
          <FlowAnalytics analytics={analytics} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Node Configuration Form Component
function NodeConfigForm({ node, onSave, onCancel }: { 
  node: Node; 
  onSave: (config: any) => void; 
  onCancel: () => void; 
}) {
  const [config, setConfig] = useState(node.data);

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Nombre del Nodo</Label>
        <Input 
          value={config.label} 
          onChange={(e) => setConfig({ ...config, label: e.target.value })}
        />
      </div>
      
      <div>
        <Label>Descripción</Label>
        <Input 
          value={config.description} 
          onChange={(e) => setConfig({ ...config, description: e.target.value })}
        />
      </div>

      {node.type === 'trigger' && (
        <div>
          <Label>Palabras Clave (separadas por coma)</Label>
          <Input 
            value={config.config?.triggers?.join(', ') || ''} 
            onChange={(e) => setConfig({ 
              ...config, 
              config: { 
                ...config.config, 
                triggers: e.target.value.split(',').map((t: string) => t.trim()) 
              }
            })}
            placeholder="hola, info, precio"
          />
        </div>
      )}

      {node.type === 'response' && (
        <div>
          <Label>Respuesta Automática</Label>
          <Textarea 
            value={config.config?.responses?.[0] || ''} 
            onChange={(e) => setConfig({ 
              ...config, 
              config: { 
                ...config.config, 
                responses: [e.target.value] 
              }
            })}
            placeholder="Respuesta que se enviará al cliente..."
          />
        </div>
      )}

      {node.type === 'automation' && (
        <div className="space-y-4">
          <div>
            <Label>Tipo de Automatización</Label>
            <Select 
              value={config.config?.automationType || ''} 
              onValueChange={(value) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  automationType: value 
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar automatización" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enable_auto_response">Activar Respuestas Automáticas</SelectItem>
                <SelectItem value="disable_auto_response">Desactivar Respuestas Automáticas</SelectItem>
                <SelectItem value="change_agent">Cambiar Agente de IA</SelectItem>
                <SelectItem value="create_ticket">Crear Ticket</SelectItem>
                <SelectItem value="update_lead_score">Actualizar Puntuación de Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {config.config?.automationType === 'change_agent' && (
            <div>
              <Label>Nuevo Agente de IA</Label>
              <Select 
                value={config.config?.newAgentId || ''} 
                onValueChange={(value) => setConfig({ 
                  ...config, 
                  config: { 
                    ...config.config, 
                    newAgentId: value 
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar agente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Smart Assistant">Smart Assistant</SelectItem>
                  <SelectItem value="Smartplanner IA">Smartplanner IA</SelectItem>
                  <SelectItem value="Agente de Ventas">Agente de Ventas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {config.config?.automationType === 'update_lead_score' && (
            <div>
              <Label>Puntuación a Añadir</Label>
              <Input 
                type="number"
                value={config.config?.scoreValue || 0} 
                onChange={(e) => setConfig({ 
                  ...config, 
                  config: { 
                    ...config.config, 
                    scoreValue: parseInt(e.target.value) 
                  }
                })}
                placeholder="10"
              />
            </div>
          )}
        </div>
      )}

      {node.type === 'handoff' && (
        <div className="space-y-4">
          <div>
            <Label>Tipo de Transferencia</Label>
            <Select 
              value={config.config?.handoffType || ''} 
              onValueChange={(value) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  handoffType: value 
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de transferencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assign_to_agent">Asignar a Agente Específico</SelectItem>
                <SelectItem value="assign_by_department">Asignar por Departamento</SelectItem>
                <SelectItem value="assign_next_available">Siguiente Agente Disponible</SelectItem>
                <SelectItem value="create_ticket_assign">Crear Ticket y Asignar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.config?.handoffType === 'assign_to_agent' && (
            <div>
              <Label>Agente Específico</Label>
              <Select 
                value={config.config?.assignedAgentId || ''} 
                onValueChange={(value) => setConfig({ 
                  ...config, 
                  config: { 
                    ...config.config, 
                    assignedAgentId: value 
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar agente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maria.ventas">María González (Ventas)</SelectItem>
                  <SelectItem value="carlos.soporte">Carlos Rodríguez (Soporte)</SelectItem>
                  <SelectItem value="ana.supervisor">Ana Martínez (Supervisor)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {config.config?.handoffType === 'assign_by_department' && (
            <div>
              <Label>Departamento</Label>
              <Select 
                value={config.config?.department || ''} 
                onValueChange={(value) => setConfig({ 
                  ...config, 
                  config: { 
                    ...config.config, 
                    department: value 
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ventas">Ventas</SelectItem>
                  <SelectItem value="soporte">Soporte Técnico</SelectItem>
                  <SelectItem value="administracion">Administración</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Mensaje de Transferencia</Label>
            <Textarea 
              value={config.config?.handoffMessage || ''} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  handoffMessage: e.target.value 
                }
              })}
              placeholder="Perfecto, te voy a conectar con uno de nuestros especialistas que podrá ayudarte mejor..."
            />
          </div>
        </div>
      )}

      {node.type === 'delay' && (
        <div className="space-y-4">
          <div>
            <Label>Tiempo de Espera</Label>
            <Input 
              type="number"
              value={config.config?.delayMinutes || 5} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  delayMinutes: parseInt(e.target.value) 
                }
              })}
              placeholder="5"
            />
            <p className="text-xs text-gray-500 mt-1">Tiempo en minutos antes de continuar al siguiente nodo</p>
          </div>
          
          <div>
            <Label>Mensaje Durante la Espera (Opcional)</Label>
            <Textarea 
              value={config.config?.waitMessage || ''} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  waitMessage: e.target.value 
                }
              })}
              placeholder="Te contacto en unos minutos..."
            />
          </div>
        </div>
      )}

      {node.type === 'webhook' && (
        <div className="space-y-4">
          <div>
            <Label>URL del Webhook</Label>
            <Input 
              value={config.config?.webhookUrl || ''} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  webhookUrl: e.target.value 
                }
              })}
              placeholder="https://api.ejemplo.com/webhook"
            />
          </div>
          
          <div>
            <Label>Método HTTP</Label>
            <Select 
              value={config.config?.httpMethod || 'POST'} 
              onValueChange={(value) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  httpMethod: value 
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Headers (JSON)</Label>
            <Textarea 
              value={config.config?.headers || '{"Content-Type": "application/json"}'} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  headers: e.target.value 
                }
              })}
              placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
            />
          </div>

          <div>
            <Label>Datos a Enviar</Label>
            <Textarea 
              value={config.config?.requestBody || ''} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  requestBody: e.target.value 
                }
              })}
              placeholder='{"customer_name": "{{customerName}}", "phone": "{{customerPhone}}"}'
            />
            <p className="text-xs text-gray-500 mt-1">Usa variables como {{customerName}}, {{customerPhone}}, etc.</p>
          </div>
        </div>
      )}

      {node.type === 'validation' && (
        <div className="space-y-4">
          <div>
            <Label>Tipo de Validación</Label>
            <Select 
              value={config.config?.validationType || ''} 
              onValueChange={(value) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  validationType: value 
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar validación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Validar Email</SelectItem>
                <SelectItem value="phone">Validar Teléfono</SelectItem>
                <SelectItem value="text_length">Validar Longitud de Texto</SelectItem>
                <SelectItem value="contains_keyword">Contiene Palabra Clave</SelectItem>
                <SelectItem value="regex">Expresión Regular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.config?.validationType === 'text_length' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mínimo</Label>
                <Input 
                  type="number"
                  value={config.config?.minLength || 1} 
                  onChange={(e) => setConfig({ 
                    ...config, 
                    config: { 
                      ...config.config, 
                      minLength: parseInt(e.target.value) 
                    }
                  })}
                />
              </div>
              <div>
                <Label>Máximo</Label>
                <Input 
                  type="number"
                  value={config.config?.maxLength || 100} 
                  onChange={(e) => setConfig({ 
                    ...config, 
                    config: { 
                      ...config.config, 
                      maxLength: parseInt(e.target.value) 
                    }
                  })}
                />
              </div>
            </div>
          )}

          {(config.config?.validationType === 'contains_keyword' || config.config?.validationType === 'regex') && (
            <div>
              <Label>{config.config?.validationType === 'regex' ? 'Expresión Regular' : 'Palabra Clave'}</Label>
              <Input 
                value={config.config?.pattern || ''} 
                onChange={(e) => setConfig({ 
                  ...config, 
                  config: { 
                    ...config.config, 
                    pattern: e.target.value 
                  }
                })}
                placeholder={config.config?.validationType === 'regex' ? '^[a-zA-Z0-9]+$' : 'palabra clave'}
              />
            </div>
          )}

          <div>
            <Label>Mensaje de Error</Label>
            <Textarea 
              value={config.config?.errorMessage || ''} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  errorMessage: e.target.value 
                }
              })}
              placeholder="Por favor, proporciona un formato válido..."
            />
          </div>
        </div>
      )}

      {node.type === 'broadcast' && (
        <div className="space-y-4">
          <div>
            <Label>Mensaje de Difusión</Label>
            <Textarea 
              value={config.config?.broadcastMessage || ''} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  broadcastMessage: e.target.value 
                }
              })}
              placeholder="¡Oferta especial! Solo por hoy..."
            />
          </div>

          <div>
            <Label>Audiencia Objetivo</Label>
            <Select 
              value={config.config?.targetAudience || ''} 
              onValueChange={(value) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  targetAudience: value 
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar audiencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_contacts">Todos los Contactos</SelectItem>
                <SelectItem value="active_leads">Leads Activos</SelectItem>
                <SelectItem value="recent_contacts">Contactos Recientes (30 días)</SelectItem>
                <SelectItem value="high_value_leads">Leads de Alto Valor</SelectItem>
                <SelectItem value="custom_segment">Segmento Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.config?.targetAudience === 'custom_segment' && (
            <div>
              <Label>Criterios del Segmento</Label>
              <Textarea 
                value={config.config?.segmentCriteria || ''} 
                onChange={(e) => setConfig({ 
                  ...config, 
                  config: { 
                    ...config.config, 
                    segmentCriteria: e.target.value 
                  }
                })}
                placeholder="Ejemplo: leads con etiqueta 'interesado' y última actividad < 7 días"
              />
            </div>
          )}
        </div>
      )}

      {node.type === 'schedule' && (
        <div className="space-y-4">
          <div>
            <Label>Tipo de Programación</Label>
            <Select 
              value={config.config?.scheduleType || ''} 
              onValueChange={(value) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  scheduleType: value 
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="follow_up">Seguimiento Automático</SelectItem>
                <SelectItem value="reminder">Recordatorio</SelectItem>
                <SelectItem value="appointment">Cita/Reunión</SelectItem>
                <SelectItem value="callback">Llamada de Retorno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Días a Futuro</Label>
              <Input 
                type="number"
                value={config.config?.daysAhead || 1} 
                onChange={(e) => setConfig({ 
                  ...config, 
                  config: { 
                    ...config.config, 
                    daysAhead: parseInt(e.target.value) 
                  }
                })}
                placeholder="1"
              />
            </div>
            <div>
              <Label>Hora (24h)</Label>
              <Input 
                type="time"
                value={config.config?.timeOfDay || '09:00'} 
                onChange={(e) => setConfig({ 
                  ...config, 
                  config: { 
                    ...config.config, 
                    timeOfDay: e.target.value 
                  }
                })}
              />
            </div>
          </div>

          <div>
            <Label>Mensaje Programado</Label>
            <Textarea 
              value={config.config?.scheduledMessage || ''} 
              onChange={(e) => setConfig({ 
                ...config, 
                config: { 
                  ...config.config, 
                  scheduledMessage: e.target.value 
                }
              })}
              placeholder="Hola {{customerName}}, quería hacer seguimiento a nuestra conversación..."
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Guardar</Button>
      </div>
    </div>
  );
}

// Flow Analytics Component
function FlowAnalytics({ analytics }: { analytics: any }) {
  if (!analytics) {
    return <div>Cargando analíticas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversaciones Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalConversations || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.conversionRate || 0}%</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgTime || 0}min</div>
          </CardContent>
        </Card>
      </div>

      {analytics.stagePerformance && (
        <Card>
          <CardHeader>
            <CardTitle>Rendimiento por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.stagePerformance.map((stage: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{stage.stageName}</span>
                  <div className="flex gap-4">
                    <span className="text-sm text-gray-600">{stage.totalSessions} conversaciones</span>
                    <span className="text-sm text-gray-600">{Math.round(stage.avgTime / 60)}min promedio</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}