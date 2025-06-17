import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronDown,
  MessageSquare,
  Users,
  BarChart3,
  Database,
  Settings,
  Smartphone,
  Bot,
  Target,
  Calendar,
  Mail,
  FileSpreadsheet,
  PieChart,
  Zap,
  Shield,
  Layers,
  Play,
  CheckCircle,
  AlertCircle,
  Star
} from 'lucide-react';

const UserGuide = () => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [expandedSections, setExpandedSections] = useState<string[]>(['getting-started']);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const guideData = {
    'getting-started': {
      title: 'Primeros Pasos',
      icon: Play,
      level: 'Novato',
      color: 'bg-green-500',
      description: 'Aprende lo básico para comenzar a usar el sistema',
      sections: [
        {
          title: '1. Introducción al Sistema',
          content: `
            Bienvenido al Sistema CRM WhatsApp AI, una plataforma integral para gestionar comunicaciones, leads y análisis empresariales.
            
            **¿Qué es este sistema?**
            - Plataforma de gestión de relaciones con clientes (CRM)
            - Integración completa con WhatsApp Business
            - Inteligencia artificial para respuestas automáticas
            - Análisis avanzado y reportes en tiempo real
            
            **Características principales:**
            - Gestión de contactos y leads
            - Automatización de respuestas con IA
            - Pipeline de ventas visual
            - Base de datos de contactos con importación Excel
            - Análisis y métricas detalladas
            - Sistema de tickets y tareas
            - Calendario integrado
            - Mensajería masiva
          `
        },
        {
          title: '2. Configuración Inicial',
          content: `
            **Paso 1: Acceso al Sistema**
            1. Abrir el navegador web
            2. Ingresar la URL del sistema
            3. El sistema carga automáticamente sin necesidad de login
            
            **Paso 2: Familiarizarse con la Interfaz**
            - Menú lateral: Navegación principal
            - Panel central: Contenido de la página activa
            - Notificaciones: Alertas en tiempo real
            
            **Paso 3: Verificar Conexión WhatsApp**
            1. Ir a "Configuración WhatsApp"
            2. Verificar estado de las cuentas
            3. Escanear código QR si es necesario
          `
        },
        {
          title: '3. Navegación Básica',
          content: `
            **Menú Principal:**
            - 📊 Dashboard: Vista general del sistema
            - 💬 Mensajes: Gestión de conversaciones
            - 👥 Leads: Gestión de prospectos
            - 📈 Pipeline: Seguimiento de ventas
            - 📇 Contactos: Base de datos
            - ⚙️ Configuración: Ajustes del sistema
            
            **Consejos de Navegación:**
            - Usa el menú lateral para cambiar entre secciones
            - Los íconos te ayudan a identificar cada función
            - Las notificaciones aparecen en tiempo real
            - Cada página tiene su propia barra de herramientas
          `
        }
      ]
    },
    'whatsapp-management': {
      title: 'Gestión de WhatsApp',
      icon: Smartphone,
      level: 'Intermedio',
      color: 'bg-blue-500',
      description: 'Configura y gestiona tus cuentas de WhatsApp Business',
      sections: [
        {
          title: '1. Configuración de Cuentas',
          content: `
            **Agregar Nueva Cuenta WhatsApp:**
            1. Ir a "Configuración WhatsApp"
            2. Hacer clic en "Agregar Cuenta"
            3. Ingresar nombre descriptivo
            4. Seleccionar tipo de cuenta (Business/Personal)
            5. Guardar configuración
            
            **Conectar WhatsApp:**
            1. Hacer clic en "Generar QR"
            2. Abrir WhatsApp en el teléfono
            3. Ir a Configuración > Dispositivos vinculados
            4. Escanear el código QR mostrado
            5. Confirmar vinculación
            
            **Estados de Conexión:**
            - 🟢 Verde: Conectado y funcionando
            - 🟡 Amarillo: Conectando o con problemas menores
            - 🔴 Rojo: Desconectado, requiere nueva vinculación
          `
        },
        {
          title: '2. Gestión de Mensajes',
          content: `
            **Ver Conversaciones:**
            1. Ir a la sección "Mensajes"
            2. Lista de conversaciones en el panel izquierdo
            3. Hacer clic en una conversación para ver detalles
            4. Usar filtros para buscar conversaciones específicas
            
            **Enviar Mensajes:**
            1. Seleccionar conversación existente o crear nueva
            2. Escribir mensaje en el campo de texto
            3. Hacer clic en "Enviar" o presionar Enter
            4. Los mensajes se sincronizan automáticamente
            
            **Funciones Avanzadas:**
            - Envío de archivos multimedia
            - Respuestas rápidas predefinidas
            - Programación de mensajes
            - Mensajes masivos a grupos
          `
        },
        {
          title: '3. Automatización con IA',
          content: `
            **Configurar Respuestas Automáticas:**
            1. Ir a "Configuración IA"
            2. Seleccionar cuenta de WhatsApp
            3. Activar "Respuestas Automáticas"
            4. Configurar prompt personalizado
            5. Establecer horarios de funcionamiento
            
            **Personalización de Prompts:**
            - Define el tono de respuesta (formal, amigable, técnico)
            - Incluye información específica de tu negocio
            - Establece límites de lo que la IA puede responder
            - Configura derivación a humanos cuando sea necesario
            
            **Monitoreo de IA:**
            - Revisa regularmente las respuestas generadas
            - Ajusta prompts según el feedback recibido
            - Usa métricas para evaluar efectividad
          `
        }
      ]
    },
    'leads-management': {
      title: 'Gestión de Leads',
      icon: Target,
      level: 'Intermedio',
      color: 'bg-purple-500',
      description: 'Administra y convierte prospectos en clientes',
      sections: [
        {
          title: '1. ¿Qué son los Leads?',
          content: `
            **Definición:**
            Los leads son personas o empresas que han mostrado interés en tus productos o servicios y tienen potencial de convertirse en clientes.
            
            **Tipos de Leads en el Sistema:**
            - 🆕 Nuevo: Recién identificado, sin contacto previo
            - 📞 Contactado: Se ha establecido comunicación inicial
            - 💬 En Conversación: Diálogo activo en curso
            - 🤝 Interesado: Ha expresado interés específico
            - 📋 Propuesta: Se ha enviado propuesta comercial
            - ✅ Cerrado: Convertido en cliente o perdido
            
            **Fuentes de Leads:**
            - Conversaciones de WhatsApp
            - Formularios web
            - Referencias de clientes existentes
            - Importación manual
            - Integración con redes sociales
          `
        },
        {
          title: '2. Crear y Gestionar Leads',
          content: `
            **Crear Nuevo Lead:**
            1. Ir a la sección "Leads"
            2. Hacer clic en "Nuevo Lead"
            3. Completar información básica:
               - Nombre completo
               - Teléfono (preferiblemente WhatsApp)
               - Email
               - Empresa (opcional)
               - Fuente del lead
            4. Asignar estado inicial
            5. Guardar
            
            **Editar Lead Existente:**
            1. Buscar lead en la lista
            2. Hacer clic en el lead para abrir detalles
            3. Usar botón "Editar" para modificar información
            4. Actualizar estado según progreso
            5. Agregar notas de seguimiento
            
            **Información Importante a Registrar:**
            - Necesidades específicas del prospecto
            - Presupuesto estimado
            - Cronograma de decisión
            - Persona de contacto principal
            - Notas de cada interacción
          `
        },
        {
          title: '3. Conversión Automática Chat-to-Lead',
          content: `
            **¿Cómo Funciona?**
            El sistema analiza automáticamente las conversaciones de WhatsApp usando IA para identificar potenciales leads y convertirlos automáticamente.
            
            **Configuración:**
            1. Ir a "Conversión Chat-to-Lead"
            2. Activar el sistema automático
            3. Configurar criterios de conversión:
               - Palabras clave que indican interés
               - Patrones de comportamiento
               - Umbrales de interacción
            4. Establecer reglas de asignación automática
            
            **Proceso Automático:**
            1. IA analiza cada mensaje entrante
            2. Identifica señales de interés comercial
            3. Crea lead automáticamente si cumple criterios
            4. Asigna estado inicial apropiado
            5. Notifica al equipo de ventas
            
            **Revisión y Validación:**
            - Revisa leads generados automáticamente
            - Valida la calidad de la conversión
            - Ajusta criterios según resultados
            - Refina prompts de IA para mejor precisión
          `
        }
      ]
    },
    'sales-pipeline': {
      title: 'Pipeline de Ventas',
      icon: BarChart3,
      level: 'Avanzado',
      color: 'bg-orange-500',
      description: 'Visualiza y gestiona el proceso de ventas completo',
      sections: [
        {
          title: '1. ¿Qué es el Pipeline de Ventas?',
          content: `
            **Concepto:**
            El pipeline de ventas es una representación visual del proceso que siguen los prospectos desde el primer contacto hasta convertirse en clientes.
            
            **Etapas del Pipeline:**
            1. 🎯 **Lead Nuevo**: Prospecto recién identificado
            2. 📞 **Contacto Inicial**: Primera comunicación establecida
            3. 🔍 **Calificación**: Evaluación de potencial y necesidades
            4. 💬 **Presentación**: Demostración de productos/servicios
            5. 📋 **Propuesta**: Envío de cotización formal
            6. 🤝 **Negociación**: Discusión de términos y condiciones
            7. ✅ **Cierre**: Conversión exitosa en cliente
            8. ❌ **Perdido**: Oportunidad no convertida
            
            **Beneficios:**
            - Visibilidad completa del proceso de ventas
            - Identificación de cuellos de botella
            - Pronósticos de ventas más precisos
            - Seguimiento individual de cada oportunidad
          `
        },
        {
          title: '2. Uso del Tablero Kanban',
          content: `
            **Vista Kanban:**
            El pipeline utiliza un tablero tipo Kanban donde cada columna representa una etapa y cada tarjeta es un lead u oportunidad.
            
            **Operaciones Básicas:**
            - **Mover Leads**: Arrastra tarjetas entre columnas para actualizar etapa
            - **Ver Detalles**: Haz clic en una tarjeta para ver información completa
            - **Agregar Notas**: Registra interacciones y observaciones
            - **Establecer Fechas**: Define fechas de seguimiento y cierre estimado
            
            **Información en Cada Tarjeta:**
            - Nombre del prospecto/empresa
            - Valor estimado de la oportunidad
            - Fecha de última actividad
            - Asignado a (miembro del equipo)
            - Indicadores de prioridad
            - Fuente del lead
            
            **Filtros y Búsqueda:**
            - Filtrar por período de tiempo
            - Buscar por nombre o empresa
            - Filtrar por miembro del equipo asignado
            - Filtrar por rango de valor
          `
        },
        {
          title: '3. Gestión Avanzada de Oportunidades',
          content: `
            **Configuración de Valores:**
            1. Asignar valor monetario estimado a cada oportunidad
            2. Establecer probabilidad de cierre (%)
            3. Definir fecha estimada de cierre
            4. Configurar alertas de seguimiento
            
            **Seguimiento de Actividades:**
            - Registrar llamadas telefónicas
            - Documentar reuniones
            - Anotar emails enviados
            - Registrar propuestas entregadas
            - Documentar objeciones y respuestas
            
            **Análisis de Rendimiento:**
            - Tasa de conversión por etapa
            - Tiempo promedio en cada etapa
            - Valor promedio de oportunidades
            - Pronóstico de ventas mensual/trimestral
            - Identificación de mejores fuentes de leads
            
            **Automatización:**
            - Mover automáticamente leads según criterios
            - Notificaciones de seguimiento
            - Recordatorios de actividades pendientes
            - Integración con calendario
          `
        }
      ]
    },
    'contacts-database': {
      title: 'Base de Datos de Contactos',
      icon: Database,
      level: 'Intermedio',
      color: 'bg-cyan-500',
      description: 'Gestiona tu base de datos completa de contactos',
      sections: [
        {
          title: '1. Importación de Contactos',
          content: `
            **Formatos Soportados:**
            - Excel (.xlsx, .xls)
            - CSV (valores separados por comas)
            - Importación directa desde WhatsApp
            
            **Proceso de Importación:**
            1. Ir a "Base de Datos de Contactos"
            2. Hacer clic en "Importar Contactos"
            3. Seleccionar archivo desde tu computadora
            4. El sistema detecta automáticamente las columnas
            5. Verificar vista previa de datos
            6. Confirmar importación
            
            **Estructura de Datos Requerida:**
            - Nombre de Pila
            - Apellido Paterno
            - Apellido Materno
            - Teléfono
            - Género
            - Grupo de Edad
            - Militante
            - Nivel Socioeconómico
            - Lugar de Trabajo
            - Escolaridad
            - Año de Nacimiento
            - Tipo de Contratación
            
            **Consejos para Importación Exitosa:**
            - Usa la primera fila para encabezados
            - Separa datos con comas si están en un solo campo
            - Verifica que los números de teléfono incluyan código de país
            - Elimina filas vacías antes de importar
          `
        },
        {
          title: '2. Vista Excel y Edición',
          content: `
            **Modo Vista Excel:**
            1. Activar con el botón "Vista Excel"
            2. La tabla se convierte en editable
            3. Hacer clic en cualquier celda para editar
            4. Las celdas seleccionadas se resaltan en azul
            
            **Funciones de Edición:**
            - **Edición Directa**: Clic en celda para escribir
            - **Navegación**: Usar teclas de flecha para moverse
            - **Copiar/Pegar**: Ctrl+C / Ctrl+V funciona normalmente
            - **Selección Múltiple**: Mantener Shift para seleccionar rango
            
            **Pegado Inteligente:**
            - Al pegar texto separado por comas, se distribuye automáticamente en columnas
            - Ejemplo: "Juan,Pérez,Gómez,555-1234" se separa en 4 celdas
            - Funciona con datos copiados de Excel u otras fuentes
            
            **Agregar Nuevas Filas:**
            1. En modo edición, usar botón "Agregar Fila"
            2. Se crea una nueva fila al final
            3. Completar información necesaria
            4. Guardar cambios para persistir
            
            **Guardar Cambios:**
            - Los cambios se guardan automáticamente al salir del modo edición
            - Usar botón "Guardar Cambios" para forzar guardado
            - Confirmación visual cuando se guardan exitosamente
          `
        },
        {
          title: '3. Búsqueda y Filtrado',
          content: `
            **Buscador Global:**
            - Campo de búsqueda en la parte superior
            - Busca en todos los campos simultáneamente
            - Búsqueda en tiempo real mientras escribes
            - No distingue entre mayúsculas y minúsculas
            
            **Filtros Avanzados:**
            - Filtrar por género
            - Filtrar por rango de edad
            - Filtrar por nivel socioeconómico
            - Filtrar por ubicación de trabajo
            - Filtrar por nivel educativo
            
            **Ordenamiento:**
            - Hacer clic en encabezados de columna para ordenar
            - Ordenamiento ascendente/descendente
            - Múltiples criterios de ordenamiento
            
            **Exportación:**
            1. Usar botón "Exportar Excel"
            2. Se genera archivo con todos los contactos visibles
            3. Incluye filtros aplicados
            4. Mantiene formato original de datos
            
            **Gestión de Contactos:**
            - Eliminar contactos individuales con ícono de papelera
            - Limpiar toda la base de datos con "Limpiar Todo"
            - Confirmaciones de seguridad para operaciones destructivas
          `
        }
      ]
    },
    'analytics-reports': {
      title: 'Análisis y Reportes',
      icon: PieChart,
      level: 'Avanzado',
      color: 'bg-indigo-500',
      description: 'Analiza métricas y genera reportes detallados',
      sections: [
        {
          title: '1. Dashboard Principal',
          content: `
            **Métricas Clave Mostradas:**
            - Total de conversaciones activas
            - Nuevos leads del día/semana/mes
            - Tasa de conversión del pipeline
            - Mensajes enviados/recibidos
            - Respuestas automáticas vs manuales
            - Tiempo promedio de respuesta
            
            **Gráficos Disponibles:**
            - Tendencia de conversaciones por período
            - Distribución de leads por etapa
            - Análisis de fuentes de leads
            - Rendimiento por agente/operador
            - Horarios de mayor actividad
            - Análisis de sentimientos
            
            **Actualización de Datos:**
            - Datos en tiempo real
            - Actualización automática cada 30 segundos
            - Posibilidad de forzar actualización manual
            - Indicadores de última actualización
            
            **Períodos de Análisis:**
            - Últimas 24 horas
            - Última semana
            - Último mes
            - Últimos 3 meses
            - Año actual
            - Rango personalizado
          `
        },
        {
          title: '2. Reportes Detallados',
          content: `
            **Tipos de Reportes:**
            
            **1. Reporte de Conversaciones:**
            - Lista completa de todas las conversaciones
            - Filtros por fecha, cuenta, estado
            - Exportación a Excel/PDF
            - Análisis de patrones de comunicación
            
            **2. Reporte de Leads:**
            - Performance del pipeline de ventas
            - Tasa de conversión por etapa
            - Fuentes más efectivas de leads
            - Tiempo promedio de cierre
            
            **3. Reporte de Rendimiento IA:**
            - Efectividad de respuestas automáticas
            - Casos donde se requirió intervención humana
            - Satisfacción del cliente con IA
            - Mejoras sugeridas en prompts
            
            **4. Reporte de Actividad de Equipo:**
            - Productividad por agente
            - Tiempo de respuesta promedio
            - Conversaciones gestionadas
            - Metas cumplidas vs objetivos
            
            **Generación de Reportes:**
            1. Seleccionar tipo de reporte
            2. Configurar filtros y período
            3. Elegir formato (PDF, Excel, Vista web)
            4. Generar reporte
            5. Descargar o compartir
          `
        },
        {
          title: '3. Análisis Avanzado',
          content: `
            **Análisis de Sentimientos:**
            - Clasificación automática de mensajes (positivo, neutro, negativo)
            - Identificación de clientes satisfechos vs insatisfechos
            - Alertas para situaciones que requieren atención
            - Tendencias de satisfacción por período
            
            **Análisis Predictivo:**
            - Pronóstico de ventas basado en pipeline actual
            - Identificación de leads con mayor probabilidad de conversión
            - Predicción de demanda por productos/servicios
            - Análisis de patrones estacionales
            
            **Segmentación de Clientes:**
            - Agrupación por características demográficas
            - Segmentación por comportamiento de compra
            - Identificación de clientes de alto valor
            - Análisis de retención y churn
            
            **KPIs y Métricas Avanzadas:**
            - Customer Lifetime Value (CLV)
            - Costo de Adquisición de Cliente (CAC)
            - Net Promoter Score (NPS)
            - Tasa de retención de clientes
            - Valor promedio de transacción
            - Tiempo promedio de resolución
            
            **Alertas Inteligentes:**
            - Notificaciones cuando métricas superan umbrales
            - Alertas de oportunidades perdidas
            - Recordatorios de seguimiento importantes
            - Notificaciones de comportamientos anómalos
          `
        }
      ]
    },
    'automation-ai': {
      title: 'Automatización e IA',
      icon: Bot,
      level: 'Avanzado',
      color: 'bg-red-500',
      description: 'Configura automatizaciones inteligentes y IA',
      sections: [
        {
          title: '1. Configuración de IA',
          content: `
            **Modelos de IA Disponibles:**
            - Gemini Pro: Para respuestas complejas y contextuales
            - GPT-4: Para interacciones naturales y creativas
            - Claude: Para análisis y respuestas técnicas
            - Qwen: Para eficiencia y rapidez
            - DeepSeek: Para análisis profundo
            
            **Configuración por Cuenta:**
            1. Ir a "Configuración IA"
            2. Seleccionar cuenta de WhatsApp
            3. Elegir modelo de IA preferido
            4. Configurar prompt personalizado
            5. Establecer parámetros de respuesta
            
            **Personalización de Prompts:**
            \`\`\`
            Ejemplo de prompt personalizado:
            
            "Eres un asistente de ventas experto para [NOMBRE_EMPRESA]. 
            Características:
            - Tono amigable pero profesional
            - Especializado en [PRODUCTOS/SERVICIOS]
            - Objetivo: calificar leads y agendar citas
            - Si no sabes algo, deriva a un humano
            - Usa emojis con moderación
            - Siempre pregunta por datos de contacto
            
            Información de la empresa:
            - Horarios: Lunes a Viernes 9AM-6PM
            - Ubicación: [DIRECCIÓN]
            - Servicios principales: [LISTA]
            - Precios desde: [RANGO]"
            \`\`\`
            
            **Parámetros Avanzados:**
            - Temperatura: Creatividad vs precisión
            - Longitud máxima de respuesta
            - Frecuencia de intervención humana
            - Palabras clave para escalamiento
            - Horarios de funcionamiento
          `
        },
        {
          title: '2. Automatizaciones de Workflow',
          content: `
            **Automatizaciones Disponibles:**
            
            **1. Respuestas Automáticas:**
            - Respuesta inmediata a mensajes entrantes
            - Clasificación automática de intenciones
            - Derivación inteligente según tipo de consulta
            - Respuestas fuera de horario laboral
            
            **2. Conversión Automática de Leads:**
            - Detección de intención de compra
            - Creación automática de leads calificados
            - Asignación automática a vendedores
            - Notificaciones instantáneas al equipo
            
            **3. Seguimientos Automáticos:**
            - Recordatorios de seguimiento
            - Mensajes programados
            - Escalamiento por tiempo de respuesta
            - Re-engagement de leads fríos
            
            **4. Asignación Inteligente:**
            - Distribución automática de conversaciones
            - Asignación basada en carga de trabajo
            - Especialización por tipo de consulta
            - Balanceador de cargas
            
            **Configuración de Reglas:**
            1. Definir triggers (eventos disparadores)
            2. Establecer condiciones
            3. Configurar acciones automáticas
            4. Definir excepciones
            5. Establecer límites y controles
            
            **Ejemplos de Reglas:**
            - Si mensaje contiene "precio" → Asignar a vendedor
            - Si no hay respuesta en 2 horas → Escalar a supervisor
            - Si cliente menciona competencia → Prioridad alta
            - Si fuera de horario → Respuesta automática + crear ticket
          `
        },
        {
          title: '3. Machine Learning y Optimización',
          content: `
            **Aprendizaje Continuo:**
            El sistema mejora automáticamente basándose en:
            - Feedback de operadores humanos
            - Resultados de conversiones
            - Patrones de comportamiento de clientes
            - Efectividad de respuestas pasadas
            
            **Optimización Automática:**
            - Ajuste automático de prompts según performance
            - Optimización de horarios de envío
            - Mejora de clasificación de intenciones
            - Refinamiento de criterios de lead scoring
            
            **A/B Testing:**
            - Pruebas de diferentes prompts
            - Comparación de modelos de IA
            - Evaluación de estrategias de respuesta
            - Análisis estadístico de resultados
            
            **Métricas de IA:**
            - Precisión en clasificación de intenciones
            - Tasa de satisfacción con respuestas automáticas
            - Tiempo de resolución automatizada
            - Porcentaje de escalamiento a humanos
            - ROI de automatización vs costos manuales
            
            **Feedback Loop:**
            1. Sistema registra todas las interacciones
            2. Analiza patrones de éxito/fracaso
            3. Ajusta automáticamente parámetros
            4. Genera recomendaciones de mejora
            5. Implementa cambios graduales
            6. Mide impacto y continúa optimizando
            
            **Controles de Calidad:**
            - Revisión aleatoria de respuestas de IA
            - Alertas por respuestas problemáticas
            - Límites de confianza para respuestas automáticas
            - Supervisión humana en casos críticos
          `
        }
      ]
    },
    'advanced-features': {
      title: 'Funciones Avanzadas',
      icon: Zap,
      level: 'Experto',
      color: 'bg-yellow-500',
      description: 'Características avanzadas para usuarios expertos',
      sections: [
        {
          title: '1. Sistema de Tickets',
          content: `
            **¿Qué son los Tickets?**
            Los tickets son casos o solicitudes formales que requieren seguimiento estructurado y resolución.
            
            **Tipos de Tickets:**
            - 🐛 Bug/Error: Problemas técnicos
            - 💡 Feature Request: Solicitudes de nuevas funciones  
            - ❓ Consulta: Preguntas o dudas
            - 🔧 Soporte: Asistencia técnica
            - 📞 Llamada: Seguimiento de llamadas telefónicas
            - 📧 Email: Gestión de correos electrónicos
            
            **Crear Tickets:**
            1. Ir a "Sistema de Tickets"
            2. Hacer clic en "Nuevo Ticket"
            3. Completar información:
               - Título descriptivo
               - Tipo de ticket
               - Prioridad (Baja, Media, Alta, Crítica)
               - Descripción detallada
               - Asignar a responsable
            4. Adjuntar archivos si es necesario
            5. Guardar ticket
            
            **Estados de Tickets:**
            - 🆕 Nuevo: Recién creado, sin asignar
            - 🔄 En Progreso: Siendo trabajado
            - ⏸️ Pausado: Temporalmente detenido
            - ✅ Resuelto: Completado exitosamente
            - ❌ Cerrado: Finalizado sin resolución
            - 🔄 Reabierto: Vuelto a abrir después de cerrado
            
            **Gestión de Tickets:**
            - Vista Kanban para gestión visual
            - Filtros por estado, prioridad, asignado
            - Búsqueda por contenido
            - Historial completo de actividades
            - Comentarios y colaboración en equipo
            - Tiempo de resolución y SLAs
          `
        },
        {
          title: '2. Calendario Integrado',
          content: `
            **Funcionalidades del Calendario:**
            - Gestión de citas y reuniones
            - Recordatorios automáticos
            - Integración con leads y oportunidades
            - Programación de seguimientos
            - Vista por día, semana, mes
            
            **Crear Eventos:**
            1. Hacer clic en fecha/hora deseada
            2. Completar detalles del evento:
               - Título
               - Fecha y hora de inicio/fin
               - Descripción
               - Invitados (opcional)
               - Ubicación
               - Tipo de evento
            3. Configurar recordatorios
            4. Guardar evento
            
            **Tipos de Eventos:**
            - 📞 Llamada programada
            - 🤝 Reunión con cliente
            - 📧 Seguimiento por email
            - 💼 Presentación comercial
            - 📋 Revisión de propuesta
            - 🎯 Actividad de marketing
            
            **Recordatorios Automáticos:**
            - 15 minutos antes del evento
            - 1 hora antes del evento
            - 1 día antes del evento
            - Recordatorios personalizados
            - Envío por email y notificación en sistema
            
            **Integración con WhatsApp:**
            - Agendar desde conversaciones
            - Enviar invitaciones por WhatsApp
            - Recordatorios automáticos a clientes
            - Confirmación de asistencia
            
            **Vistas del Calendario:**
            - **Vista Día**: Agenda detallada por horas
            - **Vista Semana**: Planificación semanal
            - **Vista Mes**: Panorama mensual
            - **Vista Agenda**: Lista cronológica de eventos
          `
        },
        {
          title: '3. Mensajería Masiva',
          content: `
            **¿Qué es la Mensajería Masiva?**
            Envío de mensajes a múltiples contactos simultáneamente, respetando políticas de WhatsApp y mejores prácticas.
            
            **Crear Campaña de Mensajería:**
            1. Ir a "Mensajería Masiva"
            2. Hacer clic en "Nueva Campaña"
            3. Configurar campaña:
               - Nombre de la campaña
               - Seleccionar audiencia objetivo
               - Redactar mensaje
               - Programar envío (opcional)
               - Configurar límites de envío
            
            **Selección de Audiencia:**
            - **Todos los Contactos**: Base completa
            - **Segmentación**: Por características específicas
            - **Leads Activos**: Solo prospectos en proceso
            - **Clientes**: Solo contactos convertidos
            - **Lista Personalizada**: Selección manual
            - **Importar Lista**: Desde archivo Excel/CSV
            
            **Tipos de Mensajes:**
            - Mensajes de texto plano
            - Mensajes con formato (negrita, cursiva)
            - Mensajes con imágenes
            - Mensajes con documentos
            - Mensajes con enlaces
            - Plantillas de WhatsApp Business
            
            **Personalización:**
            - Variables dinámicas: {nombre}, {empresa}, {telefono}
            - Contenido condicional basado en datos
            - Personalización por segmento
            - A/B testing de contenido
            
            **Mejores Prácticas:**
            - Respetar horarios (9 AM - 9 PM)
            - Máximo 1 mensaje por día por contacto
            - Incluir opción de opt-out
            - Contenido relevante y valioso
            - Cumplir políticas de WhatsApp Business
            
            **Métricas de Campaña:**
            - Mensajes enviados exitosamente
            - Mensajes entregados
            - Mensajes leídos
            - Respuestas recibidas
            - Conversiones generadas
            - Tasa de opt-out
            
            **Programación Inteligente:**
            - Envío en horarios óptimos por zona horaria
            - Distribución en ventanas de tiempo
            - Evitar días festivos
            - Personalización por preferencias del contacto
          `
        }
      ]
    },
    'troubleshooting': {
      title: 'Solución de Problemas',
      icon: AlertCircle,
      level: 'Soporte',
      color: 'bg-gray-500',
      description: 'Guía para resolver problemas comunes',
      sections: [
        {
          title: '1. Problemas de Conexión WhatsApp',
          content: `
            **Síntoma: WhatsApp desconectado frecuentemente**
            
            **Causas Posibles:**
            - Teléfono sin internet o apagado
            - WhatsApp cerrado en el teléfono
            - Múltiples dispositivos conectados
            - Versión antigua de WhatsApp
            
            **Soluciones:**
            1. Verificar conexión a internet del teléfono
            2. Mantener WhatsApp abierto en segundo plano
            3. Desconectar otros dispositivos vinculados
            4. Actualizar WhatsApp a la última versión
            5. Regenerar código QR si es necesario
            
            **Síntoma: No se envían mensajes**
            
            **Soluciones:**
            1. Verificar estado de conexión en el dashboard
            2. Comprobar que el número destino sea válido
            3. Verificar límites de WhatsApp Business
            4. Revisar que el contacto no haya bloqueado la cuenta
            5. Comprobar configuración de la cuenta
            
            **Síntoma: Mensajes se envían pero no se reciben respuestas**
            
            **Verificaciones:**
            1. Confirmar que los mensajes llegan al destinatario
            2. Revisar si las respuestas están llegando a otra cuenta
            3. Verificar filtros de spam del destinatario
            4. Comprobar configuración de webhook
          `
        },
        {
          title: '2. Problemas con IA y Automatización',
          content: `
            **Síntoma: IA no responde o responde incorrectamente**
            
            **Diagnóstico:**
            1. Verificar que la IA esté activada para la cuenta
            2. Comprobar configuración del prompt
            3. Revisar logs de errores de IA
            4. Verificar conectividad con servicios de IA
            
            **Soluciones:**
            1. Revisar y optimizar el prompt personalizado
            2. Ajustar parámetros de temperatura y longitud
            3. Verificar palabras clave para escalamiento
            4. Probar con diferentes modelos de IA
            5. Configurar fallback a respuestas predefinidas
            
            **Síntoma: Leads no se crean automáticamente**
            
            **Verificaciones:**
            1. Sistema de conversión automática activado
            2. Criterios de conversión configurados correctamente
            3. Palabras clave de interés definidas
            4. Umbral de puntuación apropiado
            
            **Ajustes:**
            1. Revisar y ampliar criterios de detección
            2. Ajustar sensibilidad del sistema
            3. Incluir más palabras clave relevantes
            4. Verificar que no hay filtros bloqueando la conversión
            
            **Síntoma: Respuestas automáticas muy lentas**
            
            **Optimizaciones:**
            1. Reducir longitud del prompt
            2. Simplificar instrucciones
            3. Usar modelo más rápido (Qwen vs GPT-4)
            4. Implementar cache de respuestas frecuentes
            5. Configurar timeouts apropiados
          `
        },
        {
          title: '3. Problemas de Rendimiento y Datos',
          content: `
            **Síntoma: Sistema lento o no responde**
            
            **Verificaciones:**
            1. Conexión a internet estable
            2. Browser actualizado y compatible
            3. Caché del navegador no sobrecargado
            4. No hay otros procesos pesados ejecutándose
            
            **Soluciones:**
            1. Refrescar la página (F5)
            2. Limpiar caché del navegador
            3. Cerrar pestañas innecesarias
            4. Usar navegador recomendado (Chrome, Firefox)
            5. Verificar recursos del sistema
            
            **Síntoma: Datos no se cargan o están desactualizados**
            
            **Diagnóstico:**
            1. Verificar conexión a base de datos
            2. Comprobar sincronización en tiempo real
            3. Revisar logs de errores del servidor
            4. Verificar permisos de acceso
            
            **Acciones:**
            1. Forzar actualización manual
            2. Cerrar y reabrir la aplicación
            3. Verificar configuración de red
            4. Contactar soporte técnico si persiste
            
            **Síntoma: Errores al importar contactos**
            
            **Verificaciones del Archivo:**
            1. Formato correcto (Excel/CSV)
            2. Estructura de columnas apropiada
            3. No hay caracteres especiales problemáticos
            4. Tamaño del archivo dentro de límites
            
            **Preparación de Datos:**
            1. Usar plantilla proporcionada
            2. Eliminar filas vacías
            3. Verificar formato de números de teléfono
            4. Corregir caracteres especiales
            5. Guardar como UTF-8 si es CSV
            
            **Recuperación de Datos:**
            - Backups automáticos diarios
            - Recuperación de versiones anteriores
            - Exportación de datos antes de cambios importantes
            - Sincronización con sistemas externos
          `
        }
      ]
    }
  };

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'Novato': return 'bg-green-100 text-green-800';
      case 'Intermedio': return 'bg-blue-100 text-blue-800';
      case 'Avanzado': return 'bg-orange-100 text-orange-800';
      case 'Experto': return 'bg-red-100 text-red-800';
      case 'Soporte': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-blue-600" />
          Guía Completa del Usuario
        </h1>
        <p className="text-muted-foreground text-lg">
          Aprende a usar el sistema desde nivel básico hasta avanzado con esta guía paso a paso
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navegación */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Contenido</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {Object.entries(guideData).map(([key, section]) => {
                    const Icon = section.icon;
                    const isActive = activeSection === key;
                    return (
                      <Button
                        key={key}
                        variant={isActive ? "default" : "ghost"}
                        className={`w-full justify-start h-auto p-3 ${isActive ? section.color : ''}`}
                        onClick={() => setActiveSection(key)}
                      >
                        <div className="flex items-start gap-3 text-left">
                          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium">{section.title}</div>
                            <Badge variant="secondary" className={`text-xs mt-1 ${getLevelColor(section.level)}`}>
                              {section.level}
                            </Badge>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Contenido */}
        <div className="lg:col-span-3">
          {Object.entries(guideData).map(([key, section]) => {
            if (activeSection !== key) return null;
            
            const Icon = section.icon;
            
            return (
              <div key={key} className="space-y-6">
                <Card>
                  <CardHeader className={`${section.color} text-white`}>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <Icon className="h-8 w-8" />
                      {section.title}
                    </CardTitle>
                    <CardDescription className="text-white/90 text-lg">
                      {section.description}
                    </CardDescription>
                    <Badge variant="secondary" className={`w-fit ${getLevelColor(section.level)}`}>
                      Nivel: {section.level}
                    </Badge>
                  </CardHeader>
                </Card>

                {section.sections.map((subsection, index) => (
                  <Card key={index}>
                    <CardHeader 
                      className="cursor-pointer" 
                      onClick={() => toggleSection(`${key}-${index}`)}
                    >
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          {subsection.title}
                        </span>
                        {expandedSections.includes(`${key}-${index}`) ? 
                          <ChevronDown className="h-5 w-5" /> : 
                          <ChevronRight className="h-5 w-5" />
                        }
                      </CardTitle>
                    </CardHeader>
                    
                    {expandedSections.includes(`${key}-${index}`) && (
                      <CardContent>
                        <div className="prose prose-sm max-w-none">
                          {subsection.content.split('\n').map((line, lineIndex) => {
                            if (line.trim() === '') return <br key={lineIndex} />;
                            
                            if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                              return (
                                <h3 key={lineIndex} className="text-lg font-semibold text-gray-900 mt-4 mb-2">
                                  {line.trim().slice(2, -2)}
                                </h3>
                              );
                            }
                            
                            if (line.trim().startsWith('```')) {
                              return null; // Handle code blocks separately if needed
                            }
                            
                            if (line.trim().startsWith('-')) {
                              return (
                                <li key={lineIndex} className="ml-4 mb-1">
                                  {line.trim().substring(1).trim()}
                                </li>
                              );
                            }
                            
                            if (line.trim().match(/^\d+\./)) {
                              return (
                                <div key={lineIndex} className="ml-4 mb-1 font-medium">
                                  {line.trim()}
                                </div>
                              );
                            }
                            
                            return (
                              <p key={lineIndex} className="mb-2 leading-relaxed">
                                {line.trim()}
                              </p>
                            );
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UserGuide;