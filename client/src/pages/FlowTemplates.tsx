import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Zap, MessageSquare, Target, Users, ShoppingCart, Phone, Mail, Calendar, TrendingUp } from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';

// Componente para vista previa del flujo
const FlowPreview = ({ templateId }: { templateId: string }) => {
  const getPreviewData = (id: string) => {
    const previews = {
      'lead-qualification': {
        nodes: [
          { x: 10, y: 15, type: 'trigger', color: '#10B981' },
          { x: 40, y: 15, type: 'ai', color: '#8B5CF6' },
          { x: 70, y: 15, type: 'condition', color: '#F59E0B' },
          { x: 55, y: 45, type: 'action', color: '#3B82F6' },
          { x: 85, y: 45, type: 'action', color: '#3B82F6' }
        ],
        connections: [
          { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 }
        ]
      },
      'customer-support': {
        nodes: [
          { x: 10, y: 15, type: 'trigger', color: '#10B981' },
          { x: 35, y: 15, type: 'ai', color: '#8B5CF6' },
          { x: 60, y: 15, type: 'condition', color: '#F59E0B' },
          { x: 45, y: 45, type: 'action', color: '#3B82F6' },
          { x: 75, y: 45, type: 'action', color: '#EF4444' }
        ],
        connections: [
          { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 2, to: 4 }
        ]
      },
      'ecommerce-sales': {
        nodes: [
          { x: 10, y: 10, type: 'trigger', color: '#10B981' },
          { x: 30, y: 10, type: 'delay', color: '#6B7280' },
          { x: 50, y: 10, type: 'condition', color: '#F59E0B' },
          { x: 40, y: 35, type: 'action', color: '#3B82F6' },
          { x: 60, y: 35, type: 'action', color: '#3B82F6' },
          { x: 50, y: 60, type: 'delay', color: '#6B7280' },
          { x: 70, y: 60, type: 'condition', color: '#F59E0B' }
        ],
        connections: [
          { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 2, to: 4 }, 
          { from: 3, to: 5 }, { from: 4, to: 5 }, { from: 5, to: 6 }
        ]
      },
      'appointment-booking': {
        nodes: [
          { x: 10, y: 20, type: 'trigger', color: '#10B981' },
          { x: 30, y: 20, type: 'ai', color: '#8B5CF6' },
          { x: 50, y: 20, type: 'action', color: '#3B82F6' },
          { x: 70, y: 20, type: 'condition', color: '#F59E0B' },
          { x: 60, y: 50, type: 'action', color: '#3B82F6' },
          { x: 80, y: 50, type: 'action', color: '#EF4444' }
        ],
        connections: [
          { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 3, to: 5 }
        ]
      },
      'lead-nurturing': {
        nodes: [
          { x: 10, y: 15, type: 'trigger', color: '#10B981' },
          { x: 25, y: 15, type: 'action', color: '#3B82F6' },
          { x: 40, y: 15, type: 'delay', color: '#6B7280' },
          { x: 55, y: 15, type: 'action', color: '#3B82F6' },
          { x: 70, y: 15, type: 'delay', color: '#6B7280' },
          { x: 50, y: 40, type: 'condition', color: '#F59E0B' },
          { x: 35, y: 65, type: 'action', color: '#10B981' },
          { x: 65, y: 65, type: 'action', color: '#EF4444' }
        ],
        connections: [
          { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 }, 
          { from: 4, to: 5 }, { from: 5, to: 6 }, { from: 5, to: 7 }
        ]
      },
      'call-center': {
        nodes: [
          { x: 10, y: 20, type: 'trigger', color: '#10B981' },
          { x: 30, y: 20, type: 'condition', color: '#F59E0B' },
          { x: 50, y: 20, type: 'condition', color: '#F59E0B' },
          { x: 40, y: 50, type: 'action', color: '#3B82F6' },
          { x: 60, y: 50, type: 'action', color: '#EF4444' },
          { x: 20, y: 50, type: 'action', color: '#6B7280' }
        ],
        connections: [
          { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 1, to: 5 }, { from: 2, to: 3 }, { from: 2, to: 4 }
        ]
      }
    };
    return previews[id] || { nodes: [], connections: [] };
  };

  const previewData = getPreviewData(templateId);

  return (
    <div className="relative w-full h-20">
      <svg width="100%" height="100%" viewBox="0 0 100 80" className="overflow-visible">
        {/* Renderizar conexiones */}
        {previewData.connections.map((conn, index) => {
          const fromNode = previewData.nodes[conn.from];
          const toNode = previewData.nodes[conn.to];
          if (!fromNode || !toNode) return null;
          
          return (
            <line
              key={index}
              x1={fromNode.x + 2}
              y1={fromNode.y + 2}
              x2={toNode.x + 2}
              y2={toNode.y + 2}
              stroke="#2563EB"
              strokeWidth="1"
              opacity="0.6"
            />
          );
        })}
        
        {/* Renderizar nodos */}
        {previewData.nodes.map((node, index) => (
          <g key={index}>
            <circle
              cx={node.x + 2}
              cy={node.y + 2}
              r="3"
              fill={node.color}
              opacity="0.8"
            />
            {/* Flecha indicadora para el primer nodo */}
            {index === 0 && (
              <polygon
                points={`${node.x - 1},${node.y + 2} ${node.x + 1},${node.y} ${node.x + 1},${node.y + 4}`}
                fill="#10B981"
                opacity="0.9"
              />
            )}
          </g>
        ))}
      </svg>
      
      {/* Etiquetas de tipos de nodos */}
      <div className="absolute bottom-0 left-0 text-xs text-gray-400 flex space-x-2">
        <span className="flex items-center"><div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>Trigger</span>
        <span className="flex items-center"><div className="w-2 h-2 bg-purple-500 rounded-full mr-1"></div>IA</span>
        <span className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>Acción</span>
      </div>
    </div>
  );
};

// Plantillas predefinidas de flujos de ventas
const flowTemplates = [
  {
    id: 'lead-qualification',
    name: 'Calificación de Leads',
    description: 'Flujo completo para calificar nuevos leads desde WhatsApp hasta cierre de venta',
    category: 'Ventas',
    difficulty: 'Principiante',
    nodes: 8,
    estimatedTime: '15 min',
    icon: Target,
    color: 'bg-blue-500',
    tags: ['WhatsApp', 'Calificación', 'CRM'],
    preview: {
      nodes: [
        { type: 'trigger', label: 'Mensaje WhatsApp', position: { x: 100, y: 100 } },
        { type: 'condition', label: '¿Es lead válido?', position: { x: 300, y: 100 } },
        { type: 'action', label: 'Crear lead en CRM', position: { x: 500, y: 50 } },
        { type: 'action', label: 'Enviar mensaje automático', position: { x: 500, y: 150 } }
      ]
    }
  },
  {
    id: 'customer-support',
    name: 'Soporte al Cliente',
    description: 'Sistema automatizado de tickets y respuestas para soporte técnico',
    category: 'Soporte',
    difficulty: 'Intermedio',
    nodes: 12,
    estimatedTime: '25 min',
    icon: MessageSquare,
    color: 'bg-green-500',
    tags: ['Tickets', 'Automatización', 'IA'],
    preview: {
      nodes: [
        { type: 'trigger', label: 'Consulta cliente', position: { x: 100, y: 100 } },
        { type: 'ai', label: 'Análisis IA', position: { x: 300, y: 100 } },
        { type: 'condition', label: '¿Problema común?', position: { x: 500, y: 100 } },
        { type: 'action', label: 'Respuesta automática', position: { x: 700, y: 50 } }
      ]
    }
  },
  {
    id: 'ecommerce-sales',
    name: 'Ventas E-commerce',
    description: 'Flujo optimizado para tiendas online con carritos abandonados y seguimiento',
    category: 'E-commerce',
    difficulty: 'Avanzado',
    nodes: 15,
    estimatedTime: '40 min',
    icon: ShoppingCart,
    color: 'bg-purple-500',
    tags: ['E-commerce', 'Carritos', 'Conversión'],
    preview: {
      nodes: [
        { type: 'trigger', label: 'Carrito abandonado', position: { x: 100, y: 100 } },
        { type: 'delay', label: 'Esperar 1 hora', position: { x: 300, y: 100 } },
        { type: 'action', label: 'Enviar descuento', position: { x: 500, y: 100 } },
        { type: 'condition', label: '¿Compró?', position: { x: 700, y: 100 } }
      ]
    }
  },
  {
    id: 'appointment-booking',
    name: 'Reserva de Citas',
    description: 'Sistema completo de agendamiento con recordatorios y confirmaciones',
    category: 'Citas',
    difficulty: 'Intermedio',
    nodes: 10,
    estimatedTime: '20 min',
    icon: Calendar,
    color: 'bg-orange-500',
    tags: ['Calendario', 'Recordatorios', 'Confirmaciones'],
    preview: {
      nodes: [
        { type: 'trigger', label: 'Solicitud cita', position: { x: 100, y: 100 } },
        { type: 'action', label: 'Verificar disponibilidad', position: { x: 300, y: 100 } },
        { type: 'action', label: 'Confirmar cita', position: { x: 500, y: 100 } },
        { type: 'delay', label: 'Recordatorio 24h', position: { x: 700, y: 100 } }
      ]
    }
  },
  {
    id: 'lead-nurturing',
    name: 'Nutrición de Leads',
    description: 'Secuencia automatizada para educar y convertir leads fríos en clientes',
    category: 'Marketing',
    difficulty: 'Avanzado',
    nodes: 18,
    estimatedTime: '45 min',
    icon: TrendingUp,
    color: 'bg-indigo-500',
    tags: ['Email Marketing', 'Secuencias', 'Conversión'],
    preview: {
      nodes: [
        { type: 'trigger', label: 'Lead registrado', position: { x: 100, y: 100 } },
        { type: 'action', label: 'Email bienvenida', position: { x: 300, y: 100 } },
        { type: 'delay', label: 'Esperar 3 días', position: { x: 500, y: 100 } },
        { type: 'action', label: 'Contenido educativo', position: { x: 700, y: 100 } }
      ]
    }
  },
  {
    id: 'call-center',
    name: 'Centro de Llamadas',
    description: 'Gestión de llamadas entrantes con distribución automática y seguimiento',
    category: 'Ventas',
    difficulty: 'Avanzado',
    nodes: 14,
    estimatedTime: '35 min',
    icon: Phone,
    color: 'bg-red-500',
    tags: ['Llamadas', 'Distribución', 'Métricas'],
    preview: {
      nodes: [
        { type: 'trigger', label: 'Llamada entrante', position: { x: 100, y: 100 } },
        { type: 'condition', label: '¿Agente disponible?', position: { x: 300, y: 100 } },
        { type: 'action', label: 'Asignar agente', position: { x: 500, y: 50 } },
        { type: 'action', label: 'Cola de espera', position: { x: 500, y: 150 } }
      ]
    }
  }
];

const categories = ['Todos', 'Ventas', 'Soporte', 'E-commerce', 'Citas', 'Marketing'];
const difficulties = ['Todos', 'Principiante', 'Intermedio', 'Avanzado'];

// Función para generar datos reales de plantillas con nodos y conexiones funcionales
const getTemplateData = (templateId: string) => {
  const templates = {
    'lead-qualification': {
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: { 
            label: 'Mensaje WhatsApp Recibido',
            config: {
              triggerType: 'whatsapp_message',
              conditions: ['nuevo_contacto', 'mensaje_inicial']
            }
          }
        },
        {
          id: '2',
          type: 'ai',
          position: { x: 350, y: 100 },
          data: { 
            label: 'Análisis IA del Mensaje',
            config: {
              aiProvider: 'gemini',
              prompt: 'Analiza este mensaje de WhatsApp y determina si es un lead válido para ventas',
              extractData: ['intención', 'producto_interés', 'presupuesto']
            }
          }
        },
        {
          id: '3',
          type: 'condition',
          position: { x: 600, y: 100 },
          data: { 
            label: '¿Es Lead Válido?',
            config: {
              conditions: [
                { field: 'intención', operator: 'contains', value: 'comprar|interés|cotización' },
                { field: 'producto_interés', operator: 'not_empty' }
              ]
            }
          }
        },
        {
          id: '4',
          type: 'action',
          position: { x: 450, y: 250 },
          data: { 
            label: 'Crear Lead en CRM',
            config: {
              action: 'create_lead',
              data: {
                source: 'whatsapp',
                status: 'nuevo',
                stage: 'prospecto'
              }
            }
          }
        },
        {
          id: '5',
          type: 'action',
          position: { x: 750, y: 250 },
          data: { 
            label: 'Enviar Mensaje Automático',
            config: {
              action: 'send_whatsapp_message',
              template: 'Gracias por tu interés. Un ejecutivo se contactará contigo en breve.',
              delay: 0
            }
          }
        },
        {
          id: '6',
          type: 'action',
          position: { x: 850, y: 100 },
          data: { 
            label: 'Archivar Conversación',
            config: {
              action: 'archive_chat',
              reason: 'no_es_lead'
            }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e2-3', source: '2', target: '3', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e3-4', source: '3', target: '4', markerEnd: { type: 'ArrowClosed' }, label: 'Sí' },
        { id: 'e4-5', source: '4', target: '5', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e3-6', source: '3', target: '6', markerEnd: { type: 'ArrowClosed' }, label: 'No' }
      ]
    },
    'customer-support': {
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: { 
            label: 'Consulta de Cliente',
            config: {
              triggerType: 'whatsapp_message',
              conditions: ['contiene_pregunta', 'cliente_existente']
            }
          }
        },
        {
          id: '2',
          type: 'ai',
          position: { x: 350, y: 100 },
          data: { 
            label: 'Clasificación IA',
            config: {
              aiProvider: 'gemini',
              prompt: 'Clasifica esta consulta de soporte: técnica, facturación, general',
              categories: ['tecnica', 'facturacion', 'general', 'reclamo']
            }
          }
        },
        {
          id: '3',
          type: 'condition',
          position: { x: 600, y: 100 },
          data: { 
            label: '¿Problema Común?',
            config: {
              conditions: [
                { field: 'categoria', operator: 'equals', value: 'general' },
                { field: 'frecuencia', operator: 'greater_than', value: 5 }
              ]
            }
          }
        },
        {
          id: '4',
          type: 'action',
          position: { x: 450, y: 250 },
          data: { 
            label: 'Respuesta Automática',
            config: {
              action: 'send_whatsapp_message',
              template: 'FAQ_response',
              useAI: true
            }
          }
        },
        {
          id: '5',
          type: 'action',
          position: { x: 750, y: 250 },
          data: { 
            label: 'Crear Ticket',
            config: {
              action: 'create_ticket',
              priority: 'normal',
              assignTo: 'soporte_tecnico'
            }
          }
        },
        {
          id: '6',
          type: 'action',
          position: { x: 900, y: 250 },
          data: { 
            label: 'Notificar Agente',
            config: {
              action: 'notify_agent',
              channel: 'internal_chat',
              urgency: 'normal'
            }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e2-3', source: '2', target: '3', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e3-4', source: '3', target: '4', markerEnd: { type: 'ArrowClosed' }, label: 'Sí' },
        { id: 'e3-5', source: '3', target: '5', markerEnd: { type: 'ArrowClosed' }, label: 'No' },
        { id: 'e5-6', source: '5', target: '6', markerEnd: { type: 'ArrowClosed' } }
      ]
    },
    'ecommerce-sales': {
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: { 
            label: 'Carrito Abandonado',
            config: {
              triggerType: 'ecommerce_event',
              event: 'cart_abandoned',
              timeThreshold: 30
            }
          }
        },
        {
          id: '2',
          type: 'delay',
          position: { x: 300, y: 100 },
          data: { 
            label: 'Esperar 1 Hora',
            config: {
              delayType: 'time',
              duration: 60,
              unit: 'minutes'
            }
          }
        },
        {
          id: '3',
          type: 'condition',
          position: { x: 500, y: 100 },
          data: { 
            label: '¿Cliente Registrado?',
            config: {
              conditions: [
                { field: 'customer_status', operator: 'equals', value: 'registered' },
                { field: 'email', operator: 'not_empty' }
              ]
            }
          }
        },
        {
          id: '4',
          type: 'action',
          position: { x: 400, y: 250 },
          data: { 
            label: 'Enviar Descuento 10%',
            config: {
              action: 'send_whatsapp_message',
              template: 'Completa tu compra con 10% de descuento. Código: VUELVE10',
              attachCoupon: true
            }
          }
        },
        {
          id: '5',
          type: 'action',
          position: { x: 700, y: 250 },
          data: { 
            label: 'Solicitar Registro',
            config: {
              action: 'send_whatsapp_message',
              template: 'Regístrate y obtén 15% de descuento en tu primera compra'
            }
          }
        },
        {
          id: '6',
          type: 'delay',
          position: { x: 550, y: 400 },
          data: { 
            label: 'Esperar 24 Horas',
            config: {
              delayType: 'time',
              duration: 24,
              unit: 'hours'
            }
          }
        },
        {
          id: '7',
          type: 'condition',
          position: { x: 750, y: 400 },
          data: { 
            label: '¿Completó Compra?',
            config: {
              conditions: [
                { field: 'order_status', operator: 'equals', value: 'completed' }
              ]
            }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e2-3', source: '2', target: '3', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e3-4', source: '3', target: '4', markerEnd: { type: 'ArrowClosed' }, label: 'Sí' },
        { id: 'e3-5', source: '3', target: '5', markerEnd: { type: 'ArrowClosed' }, label: 'No' },
        { id: 'e4-6', source: '4', target: '6', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e5-6', source: '5', target: '6', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e6-7', source: '6', target: '7', markerEnd: { type: 'ArrowClosed' } }
      ]
    },
    'appointment-booking': {
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: { 
            label: 'Solicitud de Cita',
            config: {
              triggerType: 'whatsapp_message',
              keywords: ['cita', 'reunión', 'agendar', 'horario']
            }
          }
        },
        {
          id: '2',
          type: 'ai',
          position: { x: 300, y: 100 },
          data: { 
            label: 'Extraer Información',
            config: {
              aiProvider: 'gemini',
              prompt: 'Extrae fecha, hora preferida y tipo de servicio del mensaje',
              extractFields: ['fecha_preferida', 'hora_preferida', 'servicio']
            }
          }
        },
        {
          id: '3',
          type: 'action',
          position: { x: 500, y: 100 },
          data: { 
            label: 'Verificar Disponibilidad',
            config: {
              action: 'check_calendar_availability',
              calendar: 'default',
              duration: 60
            }
          }
        },
        {
          id: '4',
          type: 'condition',
          position: { x: 700, y: 100 },
          data: { 
            label: '¿Horario Disponible?',
            config: {
              conditions: [
                { field: 'availability', operator: 'equals', value: 'available' }
              ]
            }
          }
        },
        {
          id: '5',
          type: 'action',
          position: { x: 600, y: 250 },
          data: { 
            label: 'Confirmar Cita',
            config: {
              action: 'create_calendar_event',
              sendConfirmation: true,
              reminderMinutes: [1440, 60]
            }
          }
        },
        {
          id: '6',
          type: 'action',
          position: { x: 850, y: 250 },
          data: { 
            label: 'Proponer Alternativas',
            config: {
              action: 'suggest_alternative_times',
              count: 3,
              timeRange: 7
            }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e2-3', source: '2', target: '3', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e3-4', source: '3', target: '4', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e4-5', source: '4', target: '5', markerEnd: { type: 'ArrowClosed' }, label: 'Sí' },
        { id: 'e4-6', source: '4', target: '6', markerEnd: { type: 'ArrowClosed' }, label: 'No' }
      ]
    },
    'lead-nurturing': {
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: { 
            label: 'Lead Registrado',
            config: {
              triggerType: 'lead_created',
              source: 'any',
              status: 'nuevo'
            }
          }
        },
        {
          id: '2',
          type: 'action',
          position: { x: 300, y: 100 },
          data: { 
            label: 'Mensaje de Bienvenida',
            config: {
              action: 'send_whatsapp_message',
              template: 'welcome_sequence_1',
              personalizeWithAI: true
            }
          }
        },
        {
          id: '3',
          type: 'delay',
          position: { x: 500, y: 100 },
          data: { 
            label: 'Esperar 3 Días',
            config: {
              delayType: 'time',
              duration: 3,
              unit: 'days'
            }
          }
        },
        {
          id: '4',
          type: 'action',
          position: { x: 700, y: 100 },
          data: { 
            label: 'Contenido Educativo',
            config: {
              action: 'send_educational_content',
              contentType: 'video',
              topic: 'product_benefits'
            }
          }
        },
        {
          id: '5',
          type: 'delay',
          position: { x: 900, y: 100 },
          data: { 
            label: 'Esperar 7 Días',
            config: {
              delayType: 'time',
              duration: 7,
              unit: 'days'
            }
          }
        },
        {
          id: '6',
          type: 'condition',
          position: { x: 600, y: 250 },
          data: { 
            label: '¿Interactuó con Contenido?',
            config: {
              conditions: [
                { field: 'engagement_score', operator: 'greater_than', value: 3 }
              ]
            }
          }
        },
        {
          id: '7',
          type: 'action',
          position: { x: 450, y: 400 },
          data: { 
            label: 'Agendar Llamada',
            config: {
              action: 'schedule_sales_call',
              priority: 'high'
            }
          }
        },
        {
          id: '8',
          type: 'action',
          position: { x: 750, y: 400 },
          data: { 
            label: 'Continuar Secuencia',
            config: {
              action: 'continue_nurturing',
              nextSequence: 'engagement_low'
            }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e2-3', source: '2', target: '3', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e3-4', source: '3', target: '4', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e4-5', source: '4', target: '5', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e5-6', source: '5', target: '6', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e6-7', source: '6', target: '7', markerEnd: { type: 'ArrowClosed' }, label: 'Sí' },
        { id: 'e6-8', source: '6', target: '8', markerEnd: { type: 'ArrowClosed' }, label: 'No' }
      ]
    },
    'call-center': {
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: { 
            label: 'Llamada Entrante',
            config: {
              triggerType: 'phone_call',
              source: 'external'
            }
          }
        },
        {
          id: '2',
          type: 'condition',
          position: { x: 300, y: 100 },
          data: { 
            label: '¿Horario Laboral?',
            config: {
              conditions: [
                { field: 'current_time', operator: 'between', value: '09:00-18:00' },
                { field: 'current_day', operator: 'in', value: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] }
              ]
            }
          }
        },
        {
          id: '3',
          type: 'condition',
          position: { x: 500, y: 100 },
          data: { 
            label: '¿Agente Disponible?',
            config: {
              conditions: [
                { field: 'available_agents', operator: 'greater_than', value: 0 }
              ]
            }
          }
        },
        {
          id: '4',
          type: 'action',
          position: { x: 400, y: 250 },
          data: { 
            label: 'Asignar Agente',
            config: {
              action: 'assign_to_agent',
              method: 'round_robin',
              skillBased: true
            }
          }
        },
        {
          id: '5',
          type: 'action',
          position: { x: 650, y: 250 },
          data: { 
            label: 'Cola de Espera',
            config: {
              action: 'add_to_queue',
              playMusic: true,
              estimatedWait: true
            }
          }
        },
        {
          id: '6',
          type: 'action',
          position: { x: 200, y: 250 },
          data: { 
            label: 'Buzón de Voz',
            config: {
              action: 'redirect_to_voicemail',
              message: 'Horario de atención: Lunes a Viernes 9:00 a 18:00'
            }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2', markerEnd: { type: 'ArrowClosed' } },
        { id: 'e2-3', source: '2', target: '3', markerEnd: { type: 'ArrowClosed' }, label: 'Sí' },
        { id: 'e2-6', source: '2', target: '6', markerEnd: { type: 'ArrowClosed' }, label: 'No' },
        { id: 'e3-4', source: '3', target: '4', markerEnd: { type: 'ArrowClosed' }, label: 'Sí' },
        { id: 'e3-5', source: '3', target: '5', markerEnd: { type: 'ArrowClosed' }, label: 'No' }
      ]
    }
  };

  return templates[templateId] || { nodes: [], edges: [] };
};

export default function FlowTemplates() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Todos');

  const filteredTemplates = flowTemplates.filter(template => {
    const categoryMatch = selectedCategory === 'Todos' || template.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === 'Todos' || template.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

  const createFlowFromTemplate = async (templateId: string) => {
    try {
      console.log(`🚀 Creando flujo desde plantilla: ${templateId}`);
      
      // Crear el flujo desde la plantilla
      const templateData = getTemplateData(templateId);
      
      if (!templateData) {
        console.error('❌ Template no encontrado:', templateId);
        window.location.href = '/sales-flow-designer';
        return;
      }
      
      console.log(`📊 Template encontrado con ${templateData.nodes.length} nodos y ${templateData.edges.length} conexiones`);
      
      // Guardar datos del template en localStorage para bypassar problemas de Vite
      const templateDataForStorage = {
        nodes: templateData.nodes,
        edges: templateData.edges,
        templateId: templateId,
        timestamp: Date.now()
      };
      localStorage.setItem('salesFlowTemplate', JSON.stringify(templateDataForStorage));
      console.log('✅ Template guardado en localStorage con', templateData.nodes.length, 'nodos');
      
      try {
        // Intentar también guardar en el backend
        const response = await apiRequest('/api/sales-flow', {
          method: 'POST',
          body: {
            nodes: templateData.nodes,
            edges: templateData.edges,
            templateId: templateId
          }
        });

        if (response.success) {
          console.log('✅ Flujo también guardado en backend');
          queryClient.invalidateQueries({ queryKey: ['/api/sales-flow'] });
        }
      } catch (backendError) {
        console.log('⚠️ Backend error, usando localStorage como fallback');
      }
      
      // Navegar al diseñador (usará localStorage si backend falla)
      window.location.href = '/sales-flow-designer';
    } catch (error) {
      console.error('Error creando flujo desde plantilla:', error);
      // Aún así intentar navegar, el diseñador manejará el fallback
      window.location.href = '/sales-flow-designer';
    }
  };

  const createBlankFlow = () => {
    // Navegar al diseñador sin template
    setLocation('/sales-flow-designer');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Principiante': return 'bg-green-100 text-green-800';
      case 'Intermedio': return 'bg-yellow-100 text-yellow-800';
      case 'Avanzado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Plantillas de Flujos</h1>
              <p className="text-sm text-gray-600">Selecciona una plantilla o crea un flujo desde cero</p>
            </div>
            <Button onClick={createBlankFlow} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Crear Flujo en Blanco
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <div className="mb-8 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Categoría</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Dificultad</label>
            <div className="flex gap-2 flex-wrap">
              {difficulties.map(difficulty => (
                <Button
                  key={difficulty}
                  variant={selectedDifficulty === difficulty ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDifficulty(difficulty)}
                >
                  {difficulty}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid de Plantillas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => {
            const IconComponent = template.icon;
            return (
              <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className={`${template.color} p-3 rounded-lg`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <Badge className={getDifficultyColor(template.difficulty)}>
                      {template.difficulty}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                    {template.name}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 line-clamp-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Estadísticas */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{template.nodes} nodos</span>
                    <span>{template.estimatedTime}</span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Vista previa del flujo */}
                  <div className="bg-gray-50 rounded-lg p-3 h-32 relative overflow-hidden">
                    <div className="text-xs text-gray-500 mb-2">Vista previa del flujo:</div>
                    <FlowPreview templateId={template.id} />
                  </div>

                  {/* Botón de acción */}
                  <Button 
                    className="w-full"
                    onClick={() => createFlowFromTemplate(template.id)}
                  >
                    Usar Plantilla
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay plantillas disponibles</h3>
            <p className="text-gray-600 mb-4">No se encontraron plantillas con los filtros seleccionados.</p>
            <Button onClick={() => { setSelectedCategory('Todos'); setSelectedDifficulty('Todos'); }}>
              Limpiar Filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}