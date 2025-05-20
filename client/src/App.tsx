import React from 'react';
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from '@/components/ui/toaster';
import { Spinner } from '@/components/ui/spinner';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Messages from './pages/Messages';
import Calendar from './pages/Calendar';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Tasks from './pages/Tasks';
import MediaGallery from './pages/MediaGallery';
import MessageTemplates from './pages/MessageTemplates';
import MassSender from './pages/MassSender';
import NotFound from './pages/not-found';
import Integrations from './pages/Integrations';
import AutoResponseSettings from './pages/AutoResponseSettings';
import Connection from './pages/Connection';
import QRCode from './pages/QRCode';
import QrViewer from './pages/QrViewer';
import QrTextViewer from './pages/QrTextViewer';
import RawQrViewer from './pages/RawQrViewer';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import WhatsAppAccounts from './pages/WhatsAppAccounts';
import ChatAssignments from './pages/ChatAssignments';
import Profile from './pages/Profile';
import WhatsAppManager from './pages/WhatsAppManager';
import SimpleWhatsApp from './pages/SimpleWhatsApp';
import UltraSimpleChat from './pages/UltraSimpleChat';
import SimpleWhatsAppDemo from './pages/SimpleWhatsAppDemo';
import CombinedWhatsApp from './pages/CombinedWhatsApp';
import DirectAccess from './pages/DirectAccess';
import AllAccounts from './pages/AllAccounts';
import { useQuery } from '@tanstack/react-query';
import { ModelNotificationProvider } from './lib/modelNotification';
import { PageTransition } from '@/components/ui/page-transition';
import { AuthProvider, useAuth } from './lib/authContext';
import { Loader2 } from 'lucide-react';

// Componente PrivateRoute para protección de rutas
const PrivateRoute: React.FC<{ component: React.ComponentType<any>, path: string }> = ({ component: Component, path }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  
  // Rutas públicas que no requieren autenticación
  const publicRoutes = ['/login'];
  
  // Si estamos en una ruta pública, permitir acceso
  if (publicRoutes.includes(path)) {
    return <Component />;
  }
  
  // Mostrar cargando mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Verificando sesión...</span>
      </div>
    );
  }
  
  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }
  
  // Si está autenticado, renderizar el componente
  return <Component />;
};

// Componente principal de rutas
const AppRoutes: React.FC = () => {
  // Obtener la ruta actual para la navegación activa
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  
  // Rutas públicas que no requieren autenticación
  const publicRoutes = ['/login'];
  
  // No mostrar la barra lateral en la página de login
  const showSidebar = !publicRoutes.includes(location) && isAuthenticated;
  
  // Obtener clave API de Gemini para el cliente
  const { isLoading: isLoadingGeminiKey } = useQuery({
    queryKey: ['gemini-client-key'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/settings/gemini-client-key');
        if (!response.ok) throw new Error('No se pudo obtener la clave API de Gemini');
        const data = await response.json();
        
        if (data.success && data.apiKey) {
          console.log('Clave API de Gemini obtenida correctamente');
          // Establecer la clave en una variable de entorno en tiempo de ejecución
          (window as any).VITE_GEMINI_API_KEY = data.apiKey;
        } else {
          console.warn('No se pudo obtener la clave API de Gemini');
        }
        
        return data;
      } catch (error) {
        console.error('Error obteniendo clave API de Gemini:', error);
        return null;
      }
    },
    enabled: isAuthenticated // Solo cargar si está autenticado
  });

  // Verificar si el usuario tiene rol de administrador o supervisor
  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const canManageUsers = isAdmin || isSupervisor;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar con menú vertical organizado por categorías - solo se muestra si está autenticado */}
      {showSidebar && (
        <aside className="fixed h-full w-44 bg-gradient-to-b from-purple-400 via-pink-300 to-green-300 shadow-lg z-50 overflow-y-auto">
          <div className="p-2">
            <div className="flex items-center justify-center mb-4">
              <span className="text-white text-sm font-bold">WhatsApp CRM</span>
            </div>
            
            <nav className="mt-2 flex flex-col space-y-1">
              {/* Principal */}
              <div className="px-3 py-1">
                <span className="text-xs uppercase font-semibold text-white/70">Principal</span>
              </div>
              
              <a href="/" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </a>
              
              <a href="/leads" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/leads' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Leads
              </a>
              
              {/* Comunicación */}
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs uppercase font-semibold text-white/70">Comunicación</span>
              </div>
              
              <a href="/messages" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/messages' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Mensajes
              </a>
              
              <a href="/message-templates" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/message-templates' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v10m2 2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2z" />
                </svg>
                Plantillas
              </a>
              
              <a href="/mass-sender" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/mass-sender' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Envío Masivo
              </a>
              
              <a href="/auto-response-settings" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/auto-response-settings' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Respuestas Auto
              </a>
              
              {/* Planificación */}
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs uppercase font-semibold text-white/70">Planificación</span>
              </div>
              
              <a href="/calendar" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/calendar' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendario
              </a>
              
              <a href="/tasks" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/tasks' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Tareas
              </a>
              
              {/* Análisis y Recursos */}
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs uppercase font-semibold text-white/70">Análisis y Recursos</span>
              </div>
              
              <a href="/analytics" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/analytics' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Análisis
              </a>
              
              <a href="/media-gallery" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/media-gallery' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Galería
              </a>
              
              {/* Conexiones e Integraciones */}
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs uppercase font-semibold text-white/70">Conexiones</span>
              </div>
              
              <a href="/whatsapp-accounts" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/whatsapp-accounts' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Cuentas WhatsApp
              </a>
              
              <a href="/whatsapp-manager" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/whatsapp-manager' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Gestor WhatsApp
              </a>
              
              <a href="/combined-whatsapp" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/combined-whatsapp' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Todas las Cuentas
              </a>
              
              {/* Menú oculto: Conexión, Código QR e Integraciones - Se mantiene en el código pero no se muestra */}
              {false && (
                <>
                  <a href="/connection" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/connection' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                    <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Conexión
                  </a>
                  
                  <a href="/qrcode" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/qrcode' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                    <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Código QR
                  </a>
                  
                  <a href="/integrations" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/integrations' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                    <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                    </svg>
                    Integraciones
                  </a>
                </>
              )}
              
              {/* Administración - Solo para super_admin, admin y supervisor */}
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs uppercase font-semibold text-white/70">Administración</span>
              </div>
              
              {/* Gestión de agentes - Temporalmente visible para todos */}
              <a href="/users" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/users' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="relative">
                  Agentes
                  <span className="absolute top-0 right-0 -mt-2 -mr-2 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </span>
              </a>
              
              <a href="/chat-assignments" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/chat-assignments' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Asignar Chats
              </a>
              
              <a href="/settings" className={`flex items-center px-3 py-2 text-xs font-medium rounded-md ${location === '/settings' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configuración
              </a>
              
              {/* Perfil de usuario y cierre de sesión */}
              <div className="mt-auto pt-4 border-t border-white/10">
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <a href="/profile" className="flex items-center group">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                        {user ? user.username?.substring(0, 2).toUpperCase() : "US"}
                      </div>
                      <div className="ml-2">
                        <p className="text-xs font-medium text-white group-hover:text-white/90">{user?.username || "Usuario"}</p>
                        <p className="text-xs text-white/60">{user?.role || "Rol no disponible"}</p>
                      </div>
                    </a>
                    <button
                      onClick={() => {
                        if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                          // Usar la función de cierre de sesión del contexto de autenticación
                          window.location.href = '/login';
                          localStorage.removeItem('crm_auth_token');
                          localStorage.removeItem('crm_user_data');
                        }
                      }}
                      className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className={`flex-1 ${showSidebar ? 'ml-44' : ''} overflow-hidden`}>
        <div className="w-full h-full">
          {isLoadingGeminiKey && isAuthenticated ? (
            <div className="flex justify-center items-center h-12">
              <Spinner className="h-6 w-6 text-blue-600" />
              <span className="ml-2 text-gray-600">Cargando configuración de la API...</span>
            </div>
          ) : (
            <PageTransition>
              <Switch>
                {/* Ruta de login pública */}
                <Route path="/login" component={Login} />
                
                {/* Rutas protegidas */}
                <Route path="/" component={() => <PrivateRoute component={Dashboard} path="/" />} />
                <Route path="/leads" component={() => <PrivateRoute component={Leads} path="/leads" />} />
                <Route path="/messages" component={() => <PrivateRoute component={Messages} path="/messages" />} />
                <Route path="/calendar" component={() => <PrivateRoute component={Calendar} path="/calendar" />} />
                <Route path="/tasks" component={() => <PrivateRoute component={Tasks} path="/tasks" />} />
                <Route path="/analytics" component={() => <PrivateRoute component={Analytics} path="/analytics" />} />
                <Route path="/settings" component={() => <PrivateRoute component={Settings} path="/settings" />} />
                <Route path="/media-gallery" component={() => <PrivateRoute component={MediaGallery} path="/media-gallery" />} />
                <Route path="/message-templates" component={() => <PrivateRoute component={MessageTemplates} path="/message-templates" />} />
                <Route path="/mass-sender" component={() => <PrivateRoute component={MassSender} path="/mass-sender" />} />
                <Route path="/integrations" component={() => <PrivateRoute component={Integrations} path="/integrations" />} />
                <Route path="/auto-response-settings" component={() => <PrivateRoute component={AutoResponseSettings} path="/auto-response-settings" />} />
                <Route path="/connection" component={() => <PrivateRoute component={Connection} path="/connection" />} />
                <Route path="/qrcode" component={() => <PrivateRoute component={QRCode} path="/qrcode" />} />
                <Route path="/qr-viewer" component={() => <PrivateRoute component={QrViewer} path="/qr-viewer" />} />
                <Route path="/qr-text" component={() => <PrivateRoute component={QrTextViewer} path="/qr-text" />} />
                <Route path="/whatsapp-manager" component={() => <PrivateRoute component={WhatsAppManager} path="/whatsapp-manager" />} />
                <Route path="/raw-qr" component={() => <PrivateRoute component={RawQrViewer} path="/raw-qr" />} />
                <Route path="/simple-whatsapp" component={() => <PrivateRoute component={SimpleWhatsApp} path="/simple-whatsapp" />} />
                <Route path="/ultra-whatsapp" component={() => <PrivateRoute component={UltraSimpleChat} path="/ultra-whatsapp" />} />
                <Route path="/whatsapp-demo" component={() => <PrivateRoute component={SimpleWhatsAppDemo} path="/whatsapp-demo" />} />
                <Route path="/combined-whatsapp" component={() => <PrivateRoute component={CombinedWhatsApp} path="/combined-whatsapp" />} />
                <Route path="/all-accounts" component={() => <PrivateRoute component={AllAccounts} path="/all-accounts" />} />
                <Route path="/users" component={() => <PrivateRoute component={UserManagement} path="/users" />} />
                <Route path="/whatsapp-accounts" component={() => <PrivateRoute component={WhatsAppAccounts} path="/whatsapp-accounts" />} />
                <Route path="/chat-assignments" component={() => <PrivateRoute component={ChatAssignments} path="/chat-assignments" />} />
                <Route path="/profile" component={() => <PrivateRoute component={Profile} path="/profile" />} />
                <Route path="/direct-access" component={() => <PrivateRoute component={DirectAccess} path="/direct-access" />} />
                <Route component={() => <PrivateRoute component={NotFound} path="*" />} />
              </Switch>
            </PageTransition>
          )}
        </div>
      </main>
      
      <ModelNotificationProvider>
        <Toaster />
      </ModelNotificationProvider>
    </div>
  );
};

// Componente App principal que envuelve todo con el contexto de autenticación
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;