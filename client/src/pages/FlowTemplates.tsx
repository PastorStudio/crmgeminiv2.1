import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Zap, MessageSquare, Target, Users, ShoppingCart, Phone, Mail, Calendar, TrendingUp } from 'lucide-react';
import { useLocation } from 'wouter';

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

export default function FlowTemplates() {
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Todos');

  const filteredTemplates = flowTemplates.filter(template => {
    const categoryMatch = selectedCategory === 'Todos' || template.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === 'Todos' || template.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

  const createFlowFromTemplate = (templateId: string) => {
    // Navegar al diseñador con el template seleccionado
    navigate(`/sales-flow-designer?template=${templateId}`);
  };

  const createBlankFlow = () => {
    // Navegar al diseñador sin template
    navigate('/sales-flow-designer');
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
                  <div className="bg-gray-50 rounded-lg p-3 h-24 relative overflow-hidden">
                    <div className="text-xs text-gray-500 mb-2">Vista previa:</div>
                    <div className="flex items-center space-x-2">
                      {template.preview.nodes.slice(0, 3).map((node, index) => (
                        <div key={index} className="flex items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          {index < 2 && <div className="w-3 h-px bg-gray-300 mx-1"></div>}
                        </div>
                      ))}
                      {template.preview.nodes.length > 3 && (
                        <span className="text-xs text-gray-400">+{template.preview.nodes.length - 3}</span>
                      )}
                    </div>
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