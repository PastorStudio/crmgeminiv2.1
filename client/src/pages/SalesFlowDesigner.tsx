import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Handle,
  Position,
  MarkerType,
  NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import {
  Zap, GitBranch, Target, MessageCircle, Settings, Users, Clock,
  Webhook, CheckCircle, Radio, Calendar, Save, BarChart3,
  X, Link, Unlink, MousePointer, Plus
} from "lucide-react";

// Enhanced Node Component
interface EnhancedNodeProps extends NodeProps {
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: any;
  onDelete?: (id: string) => void;
  onStartConnection?: (id: string) => void;
  onCompleteConnection?: (id: string) => void;
  connectionMode?: boolean;
  isConnectionSource?: boolean;
}

const EnhancedNode = ({ 
  data, 
  bgColor, 
  borderColor, 
  textColor, 
  icon: Icon,
  onDelete,
  onStartConnection,
  onCompleteConnection,
  connectionMode = false,
  isConnectionSource = false
}: EnhancedNodeProps) => (
  <div 
    className={`relative px-4 py-2 shadow-md rounded-md ${bgColor} border-2 ${borderColor} group ${
      connectionMode ? 'cursor-pointer' : ''
    } ${isConnectionSource ? 'ring-2 ring-blue-400' : ''}`}
    onClick={() => connectionMode && onCompleteConnection && onCompleteConnection(data.nodeId)}
  >
    {/* Red circle delete button */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete && onDelete(data.nodeId);
      }}
      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
      title="Eliminar nodo"
    >
      <X className="w-3 h-3" />
    </button>
    
    {/* Blue circle connection button */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onStartConnection && onStartConnection(data.nodeId);
      }}
      className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600 z-10"
      title="Conectar nodo"
    >
      <Link className="w-3 h-3" />
    </button>

    <Handle type="target" position={Position.Top} style={{ top: -8, backgroundColor: '#6366F1' }} />
    
    <div className="flex items-center">
      <Icon className={`w-4 h-4 mr-2 ${textColor}`} />
      <div>
        <div className={`font-bold ${textColor.replace('text-', 'text-').replace('-600', '-800')}`} style={{ fontSize: '10px' }}>
          {data.label}
        </div>
        <div className={`${textColor}`} style={{ fontSize: '10px' }}>{data.description}</div>
      </div>
    </div>
    
    <Handle type="source" position={Position.Bottom} style={{ bottom: -8, backgroundColor: '#6366F1' }} />
  </div>
);

// Initial sample data
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: { 
      label: 'Mensaje de Bienvenida', 
      description: 'Cliente inicia conversación',
      nodeId: '1'
    }
  },
  {
    id: '2',
    type: 'condition',
    position: { x: 250, y: 200 },
    data: { 
      label: '¿Es cliente nuevo?', 
      description: 'Verificar historial del cliente',
      nodeId: '2'
    }
  }
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#6B7280', strokeWidth: 2 },
    animated: true
  }
];

export default function SalesFlowDesigner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Manual connection state
  const [connectionMode, setConnectionMode] = useState(false);
  const [selectedSourceNode, setSelectedSourceNode] = useState<string | null>(null);
  
  // Floating panel state
  const [isFloatingPanelOpen, setIsFloatingPanelOpen] = useState(false);

  // Delete node function
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nodes) => nodes.filter((node) => node.id !== nodeId));
    setEdges((edges) => edges.filter((edge) => 
      edge.source !== nodeId && edge.target !== nodeId
    ));
    toast({
      title: "Nodo eliminado",
      description: "El nodo se eliminó correctamente del flujo.",
    });
  }, [setNodes, setEdges, toast]);

  // Manual connection functionality
  const startConnection = useCallback((nodeId: string) => {
    setSelectedSourceNode(nodeId);
    setConnectionMode(true);
    toast({
      title: "Modo conexión activado",
      description: "Haz clic en otro nodo para crear la conexión.",
    });
  }, [toast]);

  const completeConnection = useCallback((targetNodeId: string) => {
    if (selectedSourceNode && selectedSourceNode !== targetNodeId) {
      const newEdge: Edge = {
        id: `${selectedSourceNode}-${targetNodeId}`,
        source: selectedSourceNode,
        target: targetNodeId,
        markerEnd: { 
          type: MarkerType.ArrowClosed,
          color: '#2563EB',
          width: 20,
          height: 20
        },
        style: { 
          stroke: '#2563EB', 
          strokeWidth: 4,
          strokeDasharray: '0',
        },
        animated: true,
        type: 'smoothstep'
      };
      setEdges((eds) => addEdge(newEdge, eds));
      toast({
        title: "Conexión creada",
        description: "Los nodos se conectaron correctamente.",
      });
    }
    setConnectionMode(false);
    setSelectedSourceNode(null);
  }, [selectedSourceNode, setEdges, toast]);

  const cancelConnection = useCallback(() => {
    setConnectionMode(false);
    setSelectedSourceNode(null);
    toast({
      title: "Modo conexión cancelado",
      description: "Se canceló la creación de conexión.",
    });
  }, [toast]);

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

  // Load template data when available
  useEffect(() => {
    if (flowData) {
      console.log('📊 Cargando datos del flujo:', flowData);
      
      if (flowData.nodes && flowData.nodes.length > 0) {
        console.log(`🔥 Aplicando ${flowData.nodes.length} nodos reales del template`);
        setNodes(flowData.nodes);
      } else {
        console.log('📋 Usando nodos iniciales por defecto');
        setNodes(initialNodes);
      }
      
      if (flowData.edges && flowData.edges.length > 0) {
        console.log(`🔗 Aplicando ${flowData.edges.length} conexiones reales del template`);
        setEdges(flowData.edges);
      } else {
        console.log('🔗 Usando conexiones iniciales por defecto');
        setEdges(initialEdges);
      }
    } else {
      // Si no hay datos del flow, usar los iniciales
      console.log('⚡ No hay datos de flujo, usando valores iniciales');
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [flowData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `${params.source}-${params.target}`,
        markerEnd: { 
          type: MarkerType.ArrowClosed,
          color: '#2563EB',
          width: 20,
          height: 20
        },
        style: { 
          stroke: '#2563EB', 
          strokeWidth: 4,
          strokeDasharray: '0',
        },
        animated: true,
        type: 'smoothstep'
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (!connectionMode) {
      setSelectedNode(node);
      setIsConfigOpen(true);
    }
  }, [connectionMode]);

  // Node deletion with keyboard
  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    const nodeIdsToDelete = nodesToDelete.map(node => node.id);
    
    setNodes(nodes => nodes.filter(node => !nodeIdsToDelete.includes(node.id)));
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

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Node context menu
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setSelectedNode(node);
    setIsConfigOpen(true);
  }, []);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setSelectedNode(node);
    setIsConfigOpen(true);
  }, []);

  // Edge click handler
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setEdges(edges => edges.filter(e => e.id !== edge.id));
  }, [setEdges]);

  // Custom node types with enhanced functionality
  const nodeTypes = {
    trigger: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-green-100" 
        borderColor="border-green-500" 
        textColor="text-green-600" 
        icon={Zap}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    condition: (props: NodeProps) => (
      <div className={`relative px-4 py-2 shadow-md rounded-md bg-blue-100 border-2 border-blue-500 group ${
        connectionMode ? 'cursor-pointer' : ''
      } ${selectedSourceNode === props.data.nodeId ? 'ring-2 ring-blue-400' : ''}`}
           onClick={() => connectionMode && completeConnection(props.data.nodeId)}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(props.data.nodeId);
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
        >
          <X className="w-3 h-3" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            startConnection(props.data.nodeId);
          }}
          className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600 z-10"
        >
          <Link className="w-3 h-3" />
        </button>

        <Handle
          type="target"
          position={Position.Top}
          style={{ top: -8, backgroundColor: '#3B82F6' }}
        />
        <div className="flex items-center">
          <GitBranch className="w-4 h-4 mr-2 text-blue-600" />
          <div>
            <div className="font-bold text-blue-800" style={{ fontSize: '10px' }}>{props.data.label}</div>
            <div className="text-blue-600" style={{ fontSize: '10px' }}>{props.data.description}</div>
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
    action: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-orange-100" 
        borderColor="border-orange-500" 
        textColor="text-orange-600" 
        icon={Target}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    response: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-purple-100" 
        borderColor="border-purple-500" 
        textColor="text-purple-600" 
        icon={MessageCircle}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    automation: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-yellow-100" 
        borderColor="border-yellow-500" 
        textColor="text-yellow-600" 
        icon={Settings}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    handoff: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-red-100" 
        borderColor="border-red-500" 
        textColor="text-red-600" 
        icon={Users}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    delay: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-gray-100" 
        borderColor="border-gray-500" 
        textColor="text-gray-600" 
        icon={Clock}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    webhook: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-indigo-100" 
        borderColor="border-indigo-500" 
        textColor="text-indigo-600" 
        icon={Webhook}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    validation: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-teal-100" 
        borderColor="border-teal-500" 
        textColor="text-teal-600" 
        icon={CheckCircle}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    broadcast: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-pink-100" 
        borderColor="border-pink-500" 
        textColor="text-pink-600" 
        icon={Radio}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    ),
    schedule: (props: NodeProps) => (
      <EnhancedNode 
        {...props}
        bgColor="bg-cyan-100" 
        borderColor="border-cyan-500" 
        textColor="text-cyan-600" 
        icon={Calendar}
        onDelete={deleteNode}
        onStartConnection={startConnection}
        onCompleteConnection={completeConnection}
        connectionMode={connectionMode}
        isConnectionSource={selectedSourceNode === props.data.nodeId}
      />
    )
  };

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
      id: `${Date.now()}`,
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: `Nuevo ${nodeLabels[type as keyof typeof nodeLabels]}`,
        description: 'Haz clic para configurar',
        config: {},
        nodeId: `${Date.now()}`
      }
    };

    setNodes((nds) => nds.concat(newNode));
  };

  const saveFlow = () => {
    saveFlowMutation.mutate({ nodes, edges });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando diseñador de flujos...</div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Diseñador de Flujos de Ventas</h1>
            <p className="text-gray-600">Crea y gestiona flujos automatizados de conversación</p>
          </div>
          
          <div className="flex items-center gap-3">
            {connectionMode && (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                <MousePointer className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">Modo conexión activo</span>
                <Button variant="outline" size="sm" onClick={cancelConnection}>
                  <Unlink className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            )}
            
            <Button
              variant="outline"
              onClick={() => setIsAnalyticsOpen(true)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            
            <Button
              onClick={saveFlow}
              disabled={saveFlowMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {saveFlowMutation.isPending ? 'Guardando...' : 'Guardar Flujo'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50 h-full w-full"
            connectionLineStyle={{
              stroke: '#10B981',
              strokeWidth: 4,
              strokeDasharray: '5,5'
            }}
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>

        {/* Floating Add Button */}
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsFloatingPanelOpen(!isFloatingPanelOpen);
          }}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-50"
          size="icon"
        >
          <Plus className="h-6 w-6 text-white" />
        </Button>

        {/* Floating Panel */}
        {isFloatingPanelOpen && (
          <div 
            className="fixed bottom-24 right-6 w-64 bg-white rounded-lg shadow-2xl border p-4 z-40 max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900" style={{ fontSize: '12px' }}>Agregar Nodos</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsFloatingPanelOpen(false);
                }}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-1">
              {[
                { type: 'trigger', label: 'Disparador', icon: Zap, color: 'bg-green-100 text-green-800' },
                { type: 'condition', label: 'Condición', icon: GitBranch, color: 'bg-blue-100 text-blue-800' },
                { type: 'action', label: 'Acción', icon: Target, color: 'bg-orange-100 text-orange-800' },
                { type: 'response', label: 'Respuesta', icon: MessageCircle, color: 'bg-purple-100 text-purple-800' },
                { type: 'automation', label: 'Automatización', icon: Settings, color: 'bg-yellow-100 text-yellow-800' },
                { type: 'handoff', label: 'Transferir Agente', icon: Users, color: 'bg-red-100 text-red-800' },
                { type: 'delay', label: 'Esperar/Delay', icon: Clock, color: 'bg-gray-100 text-gray-800' },
                { type: 'webhook', label: 'Webhook/API', icon: Webhook, color: 'bg-indigo-100 text-indigo-800' },
                { type: 'validation', label: 'Validación', icon: CheckCircle, color: 'bg-teal-100 text-teal-800' },
                { type: 'broadcast', label: 'Difusión', icon: Radio, color: 'bg-pink-100 text-pink-800' },
                { type: 'schedule', label: 'Programar', icon: Calendar, color: 'bg-cyan-100 text-cyan-800' }
              ].map((nodeType) => (
                <Button
                  key={nodeType.type}
                  variant="ghost"
                  className="w-full h-10 justify-start p-2"
                  onClick={() => {
                    addNewNode(nodeType.type);
                    setIsFloatingPanelOpen(false);
                  }}
                >
                  <div className={`p-1 rounded-md ${nodeType.color} mr-2`}>
                    <nodeType.icon className="w-3 h-3" />
                  </div>
                  <span style={{ fontSize: '10px' }}>
                    {nodeType.label}
                  </span>
                </Button>
              ))}
            </div>

            <Separator className="my-3" />
            
            <div className="space-y-1">
              <h4 className="font-medium text-gray-900" style={{ fontSize: '10px' }}>Controles</h4>
              <p style={{ fontSize: '10px' }} className="text-gray-600 leading-tight">
                • Doble clic en nodo para configurar<br/>
                • Clic derecho para configurar<br/>
                • Clic en X rojo para eliminar nodo<br/>
                • Clic en ícono azul para conectar<br/>
                • Delete/Backspace para eliminar seleccionados
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedNode && isConfigOpen && (
        <NodeConfigForm 
          node={selectedNode} 
          onSave={(updatedNode) => {
            setNodes(nodes => nodes.map(n => n.id === updatedNode.id ? updatedNode : n));
            setIsConfigOpen(false);
            setSelectedNode(null);
          }}
          onCancel={() => {
            setIsConfigOpen(false);
            setSelectedNode(null);
          }}
        />
      )}

      <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Analytics del Flujo de Ventas</DialogTitle>
          </DialogHeader>
          <FlowAnalytics analytics={analytics} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NodeConfigForm({ node, onSave, onCancel }: { 
  node: Node; 
  onSave: (node: Node) => void; 
  onCancel: () => void; 
}) {
  const form = useForm({
    defaultValues: {
      label: node.data.label || '',
      description: node.data.description || '',
      message: node.data.message || '',
      condition: node.data.condition || '',
      action: node.data.action || '',
      webhook_url: node.data.webhook_url || '',
      delay_time: node.data.delay_time || '',
      schedule_time: node.data.schedule_time || '',
      config: node.data.config || {}
    }
  });

  const handleSave = (values: any) => {
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        ...values,
        label: values.label || node.data.label
      }
    };
    onSave(updatedNode);
  };

  const getNodeTypeFields = () => {
    const nodeType = node.type;
    
    switch (nodeType) {
      case 'response':
        return (
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mensaje de Respuesta</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Escribe el mensaje que se enviará..." />
                </FormControl>
              </FormItem>
            )}
          />
        );
      
      case 'condition':
        return (
          <FormField
            control={form.control}
            name="condition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Condición</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ej: usuario.edad > 18" />
                </FormControl>
              </FormItem>
            )}
          />
        );
      
      case 'action':
        return (
          <FormField
            control={form.control}
            name="action"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Acción a Realizar</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ej: crear_lead, enviar_email" />
                </FormControl>
              </FormItem>
            )}
          />
        );
      
      case 'webhook':
        return (
          <FormField
            control={form.control}
            name="webhook_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL del Webhook</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://mi-api.com/webhook" />
                </FormControl>
              </FormItem>
            )}
          />
        );
      
      case 'delay':
        return (
          <FormField
            control={form.control}
            name="delay_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tiempo de Espera</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ej: 5 minutos, 1 hora" />
                </FormControl>
              </FormItem>
            )}
          />
        );
      
      case 'schedule':
        return (
          <FormField
            control={form.control}
            name="schedule_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Programar Para</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ej: 2024-12-25 09:00" />
                </FormControl>
              </FormItem>
            )}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontSize: '14px' }}>
            Configurar: {node.data.label}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ fontSize: '12px' }}>Nombre del Nodo</FormLabel>
                  <FormControl>
                    <Input {...field} style={{ fontSize: '12px' }} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ fontSize: '12px' }}>Descripción</FormLabel>
                  <FormControl>
                    <Textarea {...field} style={{ fontSize: '12px' }} className="min-h-[60px]" />
                  </FormControl>
                </FormItem>
              )}
            />
            
            {getNodeTypeFields()}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel} style={{ fontSize: '12px' }}>
                Cancelar
              </Button>
              <Button type="submit" style={{ fontSize: '12px' }}>
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function FlowAnalytics({ analytics }: { analytics: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Conversiones Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics?.totalConversions || 0}</div>
          <p className="text-xs text-gray-500">+12% vs mes anterior</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tasa de Conversión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics?.conversionRate || 0}%</div>
          <p className="text-xs text-gray-500">+2.5% vs mes anterior</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tiempo Promedio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics?.avgTime || 0}min</div>
          <p className="text-xs text-gray-500">-15s vs mes anterior</p>
        </CardContent>
      </Card>
    </div>
  );
}