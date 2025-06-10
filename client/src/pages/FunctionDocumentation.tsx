import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, MessageSquare, Bot, Globe, Users, Settings, Bell, Shield, BarChart3, FileText, Zap, Smartphone, Database, Cloud, Lock, Headphones, Languages, UserPlus, Tag, AlertCircle, CheckCircle2, Mic, Image, Video, File } from 'lucide-react';
import { Link } from 'wouter';

export function FunctionDocumentation() {
  const mainFeatures = [
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Gestión de Conversaciones WhatsApp",
      description: "Sistema completo de administración de chats con WhatsApp Business",
      features: [
        "Conexión directa con WhatsApp Web mediante QR",
        "Vista en tiempo real de conversaciones activas",
        "Sincronización automática de mensajes",
        "Soporte para mensajes de texto, imágenes, videos y archivos",
        "Grabación y envío de notas de voz",
        "Visualización de estados de mensaje (enviado, entregado, leído)",
        "Gestión de múltiples cuentas WhatsApp"
      ]
    },
    {
      icon: <Bot className="w-8 h-8" />,
      title: "Respuestas Automáticas con IA",
      description: "Sistema inteligente de respuestas automáticas powered by AI",
      features: [
        "Integración con múltiples proveedores de IA (OpenAI, Gemini, Qwen)",
        "Respuestas contextuales basadas en conversaciones previas",
        "Personalización de prompts y temperatura de respuesta",
        "Control de respuestas en grupos (deshabilitado por defecto)",
        "Traducción automática de respuestas según preferencia de idioma",
        "Sistema de respaldo entre proveedores de IA",
        "Configuración de tiempos de espera personalizables"
      ]
    },
    {
      icon: <Languages className="w-8 h-8" />,
      title: "Sistema de Traducción Multiidioma",
      description: "Traducción automática de mensajes en más de 60 idiomas",
      features: [
        "Traducción en tiempo real de mensajes entrantes",
        "Soporte para 60+ idiomas (desde principales hasta dialectos regionales)",
        "Detección automática de idioma fuente",
        "Traducción de respuestas automáticas según preferencia",
        "Configuración por defecto en español cuando traducción deshabilitada",
        "Cache de traducciones para optimización",
        "Integración con Google Translate API y OpenAI"
      ]
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Gestión de Leads y Contactos",
      description: "CRM completo para administración de clientes potenciales",
      features: [
        "Creación automática de leads desde conversaciones",
        "Clasificación por estado (nuevo, en progreso, convertido, perdido)",
        "Asignación de leads a agentes específicos",
        "Sistema de etiquetas y categorización",
        "Seguimiento de valor potencial y presupuesto",
        "Historial completo de interacciones",
        "Métricas de conversión y análisis de rendimiento"
      ]
    },
    {
      icon: <UserPlus className="w-8 h-8" />,
      title: "Asignación Inteligente de Chats",
      description: "Sistema automatizado de asignación de conversaciones a agentes",
      features: [
        "Asignación automática basada en carga de trabajo",
        "Distribución equilibrada entre agentes disponibles",
        "Reasignación manual de conversaciones",
        "Estados de disponibilidad de agentes",
        "Historial de asignaciones",
        "Métricas de productividad por agente",
        "Notificaciones en tiempo real de nuevas asignaciones"
      ]
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Dashboard y Analíticas",
      description: "Panel de control con métricas en tiempo real",
      features: [
        "Estadísticas de leads y conversiones",
        "Métricas de respuesta automática",
        "Análisis de actividad por agente",
        "Gráficos de rendimiento temporal",
        "KPIs de atención al cliente",
        "Reportes de uso del sistema",
        "Monitoreo de conexiones WhatsApp"
      ]
    }
  ];

  const technicalFeatures = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Seguridad y Autenticación",
      features: [
        "Autenticación segura con JWT",
        "Encriptación de datos sensibles",
        "Control de acceso basado en roles",
        "Logs de actividad del sistema",
        "Protección CSRF y XSS",
        "Gestión segura de API keys"
      ]
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: "Base de Datos",
      features: [
        "PostgreSQL con Drizzle ORM",
        "Migraciones automáticas",
        "Respaldos automáticos",
        "Optimización de consultas",
        "Índices para rendimiento",
        "Integridad referencial"
      ]
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: "Arquitectura Cloud",
      features: [
        "Infraestructura escalable",
        "WebSockets para tiempo real",
        "API RESTful completa",
        "Microservicios modulares",
        "Load balancing automático",
        "Monitoreo de salud del sistema"
      ]
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Rendimiento",
      features: [
        "Cache inteligente de datos",
        "Optimización de consultas",
        "Compresión de imágenes",
        "Lazy loading de componentes",
        "Minimización de bundle size",
        "CDN para assets estáticos"
      ]
    }
  ];

  const integrationFeatures = [
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "WhatsApp Business API",
      description: "Integración nativa con WhatsApp"
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: "OpenAI GPT-4o",
      description: "IA conversacional avanzada"
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Google Gemini",
      description: "Modelo de IA multimodal"
    },
    {
      icon: <Languages className="w-6 h-6" />,
      title: "Google Translate",
      description: "Traducción automática"
    },
    {
      icon: <Headphones className="w-6 h-6" />,
      title: "Web Speech API",
      description: "Reconocimiento de voz"
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Push Notifications",
      description: "Notificaciones en tiempo real"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-red-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-red-900/30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-red-900/20 hover:text-red-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-red-900/30" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-red-300 bg-clip-text text-transparent">
                Documentación de Funciones
              </h1>
            </div>
            <Badge variant="secondary" className="bg-red-900/30 text-red-200 border-red-700">
              Sistema CRM WhatsApp AI
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-12">
        {/* Introduction */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-800 shadow-2xl shadow-red-900/50 mb-6">
            <FileText className="w-10 h-10 text-white" style={{
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
              transform: 'perspective(100px) rotateX(10deg)'
            }} />
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-red-200 to-red-400 bg-clip-text text-transparent">
            Sistema Completo de CRM WhatsApp con IA
          </h2>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto">
            Plataforma avanzada de comunicación empresarial que integra WhatsApp Business con inteligencia artificial,
            traducción automática y gestión completa de leads para optimizar la atención al cliente.
          </p>
        </div>

        <Separator className="bg-red-900/30" />

        {/* Main Features */}
        <section>
          <h3 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-red-400 to-white bg-clip-text text-transparent">
            Funciones Principales
          </h3>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {mainFeatures.map((feature, index) => (
              <Card key={index} className="bg-gradient-to-br from-gray-900/80 to-black/80 border-red-900/30 hover:border-red-700/50 transition-all duration-300 hover:shadow-2xl hover:shadow-red-900/20">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-red-600 to-red-800 shadow-lg" style={{
                      filter: 'drop-shadow(0 8px 16px rgba(239,68,68,0.3))',
                      transform: 'perspective(200px) rotateX(15deg)'
                    }}>
                      {feature.icon}
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-gray-300 mt-2">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-sm text-gray-300">
                        <CheckCircle2 className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="bg-red-900/30" />

        {/* Technical Features */}
        <section>
          <h3 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-red-400 to-white bg-clip-text text-transparent">
            Características Técnicas
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {technicalFeatures.map((feature, index) => (
              <Card key={index} className="bg-gradient-to-br from-gray-900/60 to-black/60 border-red-900/20 hover:border-red-700/40 transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-gradient-to-br from-red-600/80 to-red-800/80" style={{
                      filter: 'drop-shadow(0 4px 8px rgba(239,68,68,0.2))',
                      transform: 'perspective(150px) rotateX(10deg)'
                    }}>
                      {feature.icon}
                    </div>
                    <CardTitle className="text-white text-base">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-xs text-gray-400">
                        <div className="w-1 h-1 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="bg-red-900/30" />

        {/* Integrations */}
        <section>
          <h3 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-red-400 to-white bg-clip-text text-transparent">
            Integraciones y APIs
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integrationFeatures.map((integration, index) => (
              <Card key={index} className="bg-gradient-to-br from-gray-900/40 to-black/40 border-red-900/20 hover:border-red-600/40 transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-gradient-to-br from-red-600/60 to-red-800/60" style={{
                      filter: 'drop-shadow(0 2px 4px rgba(239,68,68,0.2))',
                      transform: 'perspective(100px) rotateX(5deg)'
                    }}>
                      {integration.icon}
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{integration.title}</h4>
                      <p className="text-xs text-gray-400">{integration.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="bg-red-900/30" />

        {/* Usage Guide */}
        <section>
          <h3 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-red-400 to-white bg-clip-text text-transparent">
            Guía de Uso Rápido
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <div className="p-2 rounded-md bg-gradient-to-br from-red-600 to-red-800" style={{
                    filter: 'drop-shadow(0 4px 8px rgba(239,68,68,0.3))',
                    transform: 'perspective(150px) rotateX(10deg)'
                  }}>
                    <Settings className="w-5 h-5" />
                  </div>
                  <span>Configuración Inicial</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm text-gray-300"><strong>1.</strong> Escanea el código QR para conectar WhatsApp</p>
                  <p className="text-sm text-gray-300"><strong>2.</strong> Configura las credenciales de IA en Configuración</p>
                  <p className="text-sm text-gray-300"><strong>3.</strong> Establece tu idioma preferido para traducciones</p>
                  <p className="text-sm text-gray-300"><strong>4.</strong> Activa las respuestas automáticas si es necesario</p>
                  <p className="text-sm text-gray-300"><strong>5.</strong> Crea y asigna agentes para gestión de chats</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <div className="p-2 rounded-md bg-gradient-to-br from-red-600 to-red-800" style={{
                    filter: 'drop-shadow(0 4px 8px rgba(239,68,68,0.3))',
                    transform: 'perspective(150px) rotateX(10deg)'
                  }}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <span>Funciones Avanzadas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm text-gray-300"><strong>•</strong> Usa el traductor automático en tiempo real</p>
                  <p className="text-sm text-gray-300"><strong>•</strong> Personaliza prompts de IA según tu negocio</p>
                  <p className="text-sm text-gray-300"><strong>•</strong> Graba notas de voz directamente en la interfaz</p>
                  <p className="text-sm text-gray-300"><strong>•</strong> Monitorea métricas en el dashboard</p>
                  <p className="text-sm text-gray-300"><strong>•</strong> Gestiona leads con el sistema CRM integrado</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 border-t border-red-900/30">
          <p className="text-gray-400 mb-4">
            Sistema CRM WhatsApp AI - Documentación completa de funcionalidades
          </p>
          <div className="flex justify-center space-x-4">
            <Badge variant="outline" className="border-red-800 text-red-300">
              Versión 2.0
            </Badge>
            <Badge variant="outline" className="border-red-800 text-red-300">
              Multi-idioma
            </Badge>
            <Badge variant="outline" className="border-red-800 text-red-300">
              IA Integrada
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FunctionDocumentation;