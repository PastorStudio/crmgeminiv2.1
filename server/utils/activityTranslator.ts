/**
 * Sistema de traducción de actividades técnicas a descripciones legibles
 * Convierte códigos internos en mensajes claros para usuarios
 */

interface ActivityDescription {
  action: string;
  icon: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
}

export class ActivityTranslator {
  
  private static pageNames: Record<string, string> = {
    '/': 'Panel Principal',
    '/dashboard': 'Panel de Control',
    '/whatsapp': 'WhatsApp Business',
    '/leads': 'Gestión de Leads',
    '/users': 'Gestión de Usuarios',
    '/calendar': 'Calendario',
    '/agents': 'Agentes Externos',
    '/security': 'Centro de Seguridad',
    '/settings': 'Configuración',
    '/external-agents': 'Configuración de Agentes',
    '/agent-security': 'Monitoreo de Seguridad'
  };

  private static whatsappAccounts: Record<number, string> = {
    1: 'Cuenta Principal',
    2: 'Cuenta de Ventas',
    3: 'Cuenta de Soporte'
  };

  /**
   * Traduce una actividad técnica a descripción legible
   */
  static translateActivity(
    action: string,
    target?: string,
    page?: string,
    details?: any
  ): ActivityDescription {
    
    const pageName = this.pageNames[page || '/'] || page || 'Página desconocida';
    
    // Actividades de navegación
    if (action === 'page_visit' || action === 'session_start') {
      return {
        action: `Visitó ${pageName}`,
        icon: '🌐',
        category: 'Navegación',
        priority: 'low'
      };
    }

    if (action === 'link_click') {
      const linkText = target || 'enlace';
      return {
        action: `Hizo clic en "${linkText}" en ${pageName}`,
        icon: '🔗',
        category: 'Navegación',
        priority: 'low'
      };
    }

    // Actividades de interacción
    if (action === 'button_click') {
      const buttonText = this.translateButtonText(target);
      return {
        action: `Presionó el botón "${buttonText}" en ${pageName}`,
        icon: '👆',
        category: 'Interacción',
        priority: 'medium'
      };
    }

    if (action === 'form_submit') {
      const formType = this.identifyFormType(target, page);
      return {
        action: `Envió formulario: ${formType} en ${pageName}`,
        icon: '📝',
        category: 'Formularios',
        priority: 'high'
      };
    }

    // Actividades específicas de WhatsApp
    if (action === 'whatsapp_connect') {
      const accountName = this.whatsappAccounts[details?.accountId] || `Cuenta ${details?.accountId}`;
      return {
        action: `Conectó ${accountName} de WhatsApp`,
        icon: '📱',
        category: 'WhatsApp',
        priority: 'high'
      };
    }

    if (action === 'whatsapp_disconnect') {
      const accountName = this.whatsappAccounts[details?.accountId] || `Cuenta ${details?.accountId}`;
      return {
        action: `Desconectó ${accountName} de WhatsApp`,
        icon: '📱',
        category: 'WhatsApp',
        priority: 'medium'
      };
    }

    if (action === 'message_sent') {
      return {
        action: `Envió mensaje por WhatsApp a ${details?.contact || 'contacto'}`,
        icon: '💬',
        category: 'Mensajería',
        priority: 'medium'
      };
    }

    // Actividades de gestión de datos
    if (action === 'lead_created') {
      return {
        action: `Creó nuevo lead: ${details?.leadName || 'Sin nombre'}`,
        icon: '👤',
        category: 'Gestión de Leads',
        priority: 'high'
      };
    }

    if (action === 'lead_updated') {
      return {
        action: `Actualizó lead: ${details?.leadName || 'Lead'} - ${details?.field || 'información'}`,
        icon: '✏️',
        category: 'Gestión de Leads',
        priority: 'medium'
      };
    }

    if (action === 'lead_deleted') {
      return {
        action: `Eliminó lead: ${details?.leadName || 'Lead'}`,
        icon: '🗑️',
        category: 'Gestión de Leads',
        priority: 'high'
      };
    }

    // Actividades de configuración
    if (action === 'settings_changed') {
      return {
        action: `Modificó configuración: ${details?.setting || 'ajuste del sistema'}`,
        icon: '⚙️',
        category: 'Configuración',
        priority: 'medium'
      };
    }

    if (action === 'agent_config') {
      return {
        action: `Configuró agente externo: ${details?.agentName || 'agente'}`,
        icon: '🤖',
        category: 'Agentes',
        priority: 'medium'
      };
    }

    // Actividades de seguridad
    if (action === 'login') {
      return {
        action: `Inició sesión en el sistema`,
        icon: '🔐',
        category: 'Seguridad',
        priority: 'high'
      };
    }

    if (action === 'logout') {
      return {
        action: `Cerró sesión`,
        icon: '🚪',
        category: 'Seguridad',
        priority: 'medium'
      };
    }

    // Actividades de calendario
    if (action === 'event_created') {
      return {
        action: `Creó evento: ${details?.eventTitle || 'evento'} para ${details?.date || 'fecha'}`,
        icon: '📅',
        category: 'Calendario',
        priority: 'medium'
      };
    }

    // Actividades de scroll y tiempo
    if (action === 'page_scroll') {
      return {
        action: `Navegó por ${pageName} (${target || ''}% de la página)`,
        icon: '📄',
        category: 'Navegación',
        priority: 'low'
      };
    }

    if (action === 'page_duration') {
      const duration = details?.duration || target;
      return {
        action: `Permaneció ${duration} en ${pageName}`,
        icon: '⏱️',
        category: 'Tiempo',
        priority: 'low'
      };
    }

    // Actividad genérica como fallback
    return {
      action: `Realizó acción: ${action} en ${pageName}${target ? ` - ${target}` : ''}`,
      icon: '📋',
      category: 'General',
      priority: 'low'
    };
  }

  /**
   * Traduce texto de botones a nombres más amigables
   */
  private static translateButtonText(buttonText?: string): string {
    if (!buttonText) return 'botón';

    const translations: Record<string, string> = {
      'Actualizando...': 'Actualizar Sistema',
      'Ver Todas las Actividades': 'Ver Historial Completo',
      'Cerrar': 'Cerrar Ventana',
      'Guardar': 'Guardar Cambios',
      'Enviar': 'Enviar Información',
      'Conectar': 'Conectar Cuenta',
      'Desconectar': 'Desconectar Cuenta',
      'Eliminar': 'Eliminar Elemento',
      'Editar': 'Editar Información',
      'Crear': 'Crear Nuevo',
      'Refresh': 'Actualizar',
      'Send': 'Enviar'
    };

    return translations[buttonText] || buttonText;
  }

  /**
   * Identifica el tipo de formulario basado en la página y target
   */
  private static identifyFormType(target?: string, page?: string): string {
    if (page?.includes('leads')) return 'Información de Lead';
    if (page?.includes('whatsapp')) return 'Configuración de WhatsApp';
    if (page?.includes('agents')) return 'Configuración de Agente';
    if (page?.includes('settings')) return 'Configuración del Sistema';
    if (page?.includes('users')) return 'Información de Usuario';
    if (page?.includes('calendar')) return 'Evento de Calendario';
    
    return target || 'formulario';
  }

  /**
   * Determina el nivel de importancia de una actividad
   */
  static getActivityImportance(action: string, details?: any): 'low' | 'medium' | 'high' {
    const highImportanceActions = ['login', 'logout', 'form_submit', 'lead_created', 'whatsapp_connect', 'lead_deleted'];
    const mediumImportanceActions = ['button_click', 'message_sent', 'lead_updated', 'settings_changed'];
    
    if (highImportanceActions.includes(action)) return 'high';
    if (mediumImportanceActions.includes(action)) return 'medium';
    return 'low';
  }

  /**
   * Genera resumen de actividades por período
   */
  static generateActivitySummary(activities: any[]): string {
    const actionCounts = activities.reduce((acc, activity) => {
      const translated = this.translateActivity(activity.action, activity.target, activity.page);
      acc[translated.category] = (acc[translated.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summary = Object.entries(actionCounts)
      .map(([category, count]) => `${count} actividades de ${category}`)
      .join(', ');

    return summary || 'Sin actividades registradas';
  }
}