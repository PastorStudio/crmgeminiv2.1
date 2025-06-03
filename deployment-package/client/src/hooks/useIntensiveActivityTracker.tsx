import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/authContext';

interface ActivityData {
  action: string;
  target?: string;
  page?: string;
  category: string;
  details?: any;
}

export function useIntensiveActivityTracker() {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const pageStartTimeRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const sessionStartTimeRef = useRef<number>(Date.now());
  const currentPageRef = useRef<string>(window.location.pathname);

  // Función para enviar heartbeat periódico
  const sendHeartbeat = async () => {
    if (user?.id) {
      try {
        console.log(`💚 Heartbeat global enviado para agente ${user.id}`);
        await fetch('/api/agent-heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: user.id })
        });
      } catch (error) {
        console.error('Error enviando heartbeat:', error);
      }
    }
  };

  // Función principal para registrar actividades
  const trackActivity = async (data: ActivityData) => {
    if (!user?.id) return;

    try {
      const activityPayload = {
        agentId: user.id,
        action: data.action,
        target: data.target || '',
        page: data.page || window.location.pathname,
        category: data.category,
        details: data.details || {},
        timestamp: new Date().toISOString()
      };

      console.log(`🎯 Actividad intensiva: ${data.action} - ${data.target || 'N/A'} - Categoría: ${data.category}`);

      const response = await fetch('/api/agent-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityPayload)
      });

      if (!response.ok) {
        console.error('Error registrando actividad:', response.statusText);
      }

      lastActivityRef.current = Date.now();
      resetInactivityTimer();
    } catch (error) {
      console.error('Error al rastrear actividad:', error);
    }
  };

  // Registrar página visitada
  const trackPageVisit = (path: string) => {
    const pageName = getPageName(path);
    console.log(`📄 Nueva página registrada: ${path} para agente ${user?.id}`);
    
    trackActivity({
      action: 'page_visit',
      target: pageName,
      page: path,
      category: 'general'
    });

    // Registrar duración en la página anterior si cambió
    if (currentPageRef.current !== path) {
      const duration = Math.round((Date.now() - pageStartTimeRef.current) / 1000);
      if (duration > 1) { // Solo registrar si estuvo más de 1 segundo
        trackActivity({
          action: 'page_duration',
          target: getPageName(currentPageRef.current),
          page: currentPageRef.current,
          category: 'time',
          details: { durationSeconds: duration }
        });
      }
      
      pageStartTimeRef.current = Date.now();
      currentPageRef.current = path;
    }
  };

  // Helper para obtener nombre legible de la página
  const getPageName = (path: string): string => {
    const pageNames: Record<string, string> = {
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
    return pageNames[path] || path;
  };

  // Timer de inactividad
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      trackActivity({
        action: 'user_inactive',
        target: '5_minutes',
        category: 'behavior',
        details: { inactiveMinutes: 5 }
      });
    }, 5 * 60 * 1000); // 5 minutos
  };

  // Inicializar tracking
  const startTracking = () => {
    if (!user?.id || isTracking) return;

    setIsTracking(true);
    sessionStartTimeRef.current = Date.now();
    
    // Registrar inicio de sesión
    trackActivity({
      action: 'session_start',
      target: 'application',
      category: 'security'
    });

    // Registrar página actual
    trackPageVisit(window.location.pathname);

    // Configurar heartbeat cada 15 segundos
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);

    // Event listeners para interacciones
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.tagName === 'BUTTON') {
        const buttonText = target.textContent?.trim() || target.getAttribute('aria-label') || 'Botón sin texto';
        trackActivity({
          action: 'button_click',
          target: buttonText,
          category: 'interaction'
        });
      } else if (target.tagName === 'A') {
        const linkText = target.textContent?.trim() || target.getAttribute('href') || 'Enlace';
        trackActivity({
          action: 'link_click',
          target: linkText,
          category: 'navigation'
        });
      }
      
      resetInactivityTimer();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Solo registrar teclas especiales importantes
      const specialKeys = ['Enter', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5'];
      if (specialKeys.includes(e.key)) {
        trackActivity({
          action: 'key_press',
          target: e.key,
          category: 'keyboard'
        });
      }
      resetInactivityTimer();
    };

    const handleScroll = () => {
      const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (scrollPercent > 0 && scrollPercent % 25 === 0) { // Cada 25% de scroll
        trackActivity({
          action: 'page_scroll',
          target: `${scrollPercent}%`,
          category: 'interaction'
        });
      }
      resetInactivityTimer();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        trackActivity({
          action: 'window_blur',
          target: 'focus_lost',
          category: 'behavior'
        });
      } else {
        trackActivity({
          action: 'window_focus',
          target: 'focus_gained',
          category: 'behavior'
        });
      }
    };

    const handleFormSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      const formName = form.getAttribute('name') || form.className || 'formulario';
      trackActivity({
        action: 'form_submit',
        target: formName,
        category: 'forms'
      });
    };

    const handlePopState = () => {
      trackActivity({
        action: 'page_navigation',
        target: window.location.pathname,
        category: 'navigation'
      });
      trackPageVisit(window.location.pathname);
    };

    // Agregar event listeners
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('submit', handleFormSubmit);
    window.addEventListener('popstate', handlePopState);

    // Iniciar timer de inactividad
    resetInactivityTimer();

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('submit', handleFormSubmit);
      window.removeEventListener('popstate', handlePopState);
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  };

  // Detener tracking y registrar fin de sesión
  const stopTracking = () => {
    if (!isTracking) return;

    const sessionDuration = Math.round((Date.now() - sessionStartTimeRef.current) / 60000); // en minutos
    
    trackActivity({
      action: 'session_end',
      target: 'application',
      category: 'security',
      details: { sessionDurationMinutes: sessionDuration }
    });

    setIsTracking(false);
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
  };

  // Effect para gestionar el ciclo de vida del tracking
  useEffect(() => {
    if (user?.id) {
      const cleanup = startTracking();
      
      // Registrar fin de sesión cuando se cierre la ventana
      const handleBeforeUnload = () => {
        stopTracking();
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        if (cleanup) cleanup();
        window.removeEventListener('beforeunload', handleBeforeUnload);
        stopTracking();
      };
    }
  }, [user?.id]);

  // Effect para tracking de cambios de ruta
  useEffect(() => {
    console.log(`📄 Página registrada: ${window.location.pathname} para agente ${user?.id}`);
    if (isTracking) {
      trackPageVisit(window.location.pathname);
    }
  }, [window.location.pathname, isTracking]);

  return {
    isTracking,
    trackActivity,
    startTracking,
    stopTracking
  };
}