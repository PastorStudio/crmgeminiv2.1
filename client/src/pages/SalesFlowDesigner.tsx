import { useState, useCallback, useEffect } from 'react';
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
  Target
} from 'lucide-react';

import { Handle, Position } from 'reactflow';

// Custom node types with connection handles
const nodeTypes = {
  trigger: ({ data }: any) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-green-100 border-2 border-green-500">
      <div className="flex items-center">
        <Zap className="w-4 h-4 mr-2 text-green-600" />
        <div>
          <div className="text-sm font-bold text-green-800">{data.label}</div>
          <div className="text-xs text-green-600">{data.description}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -8, backgroundColor: '#10B981' }}
      />
    </div>
  ),
  condition: ({ data }: any) => (
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

  const addNewNode = (type: string) => {
    const nodeLabels = {
      trigger: 'Disparador',
      condition: 'Condición',
      action: 'Acción',
      response: 'Respuesta'
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
            nodeTypes={nodeTypes}
            connectionMode="loose"
            snapToGrid={true}
            snapGrid={[15, 15]}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            fitView
            attributionPosition="bottom-left"
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