import React, { useEffect, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { ModelNotificationProvider } from './lib/modelNotification';
import { PageTransition } from '@/components/ui/page-transition';

const App: React.FC = () => {
  // Obtener la ruta actual para la navegación activa
  const [location] = useLocation();
  
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
    }
  });

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar con menú vertical */}
      <aside className="fixed h-full w-56 bg-gradient-to-b from-purple-400 via-pink-300 to-green-300 shadow-lg z-50">
        <div className="p-3">
          <div className="flex items-center justify-center mb-6">
            <span className="text-white text-xl font-bold">WhatsApp CRM</span>
          </div>
          
          <nav className="mt-5 flex flex-col space-y-1.5">
            <a href="/" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </a>
            
            <a href="/leads" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/leads' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Leads
            </a>
            
            <a href="/messages" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/messages' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Mensajes
            </a>
            
            <a href="/calendar" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/calendar' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendario
            </a>
            
            <a href="/tasks" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/tasks' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Tareas
            </a>
            
            <a href="/analytics" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/analytics' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Análisis
            </a>
            
            <a href="/media-gallery" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/media-gallery' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Galería
            </a>
            
            <a href="/message-templates" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/message-templates' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v10m2 2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2z" />
              </svg>
              Plantillas
            </a>
            
            <a href="/mass-sender" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/mass-sender' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Envío Masivo
            </a>
            
            <a href="/auto-response-settings" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/auto-response-settings' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Respuestas Auto
            </a>
            
            <a href="/connection" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/connection' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Conexión
            </a>
            
            <a href="/qrcode" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/qrcode' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Código QR
            </a>
            
            <a href="/integrations" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/integrations' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
              Integraciones
            </a>
            
            <a href="/settings" className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${location === '/settings' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'} transition-all duration-200`}>
              <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configuración
            </a>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 overflow-hidden">
        <div className="w-full h-full mx-auto">
          <div className="h-full">
            {isLoadingGeminiKey ? (
              <div className="flex justify-center items-center h-12">
                <Spinner className="h-6 w-6 text-blue-600" />
                <span className="ml-2 text-gray-600">Cargando configuración de la API...</span>
              </div>
            ) : (
              <PageTransition>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/leads" component={Leads} />
                  <Route path="/messages" component={Messages} />
                  <Route path="/calendar" component={Calendar} />
                  <Route path="/tasks" component={Tasks} />
                  <Route path="/analytics" component={Analytics} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/media-gallery" component={MediaGallery} />
                  <Route path="/message-templates" component={MessageTemplates} />
                  <Route path="/mass-sender" component={MassSender} />
                  <Route path="/integrations" component={Integrations} />
                  <Route path="/auto-response-settings" component={AutoResponseSettings} />
                  <Route path="/connection" component={Connection} />
                  <Route path="/qrcode" component={QRCode} />
                  <Route path="/qr-viewer" component={QrViewer} />
                  <Route path="/qr-text" component={QrTextViewer} />
                  <Route path="/raw-qr" component={RawQrViewer} />
                  <Route component={NotFound} />
                </Switch>
              </PageTransition>
            )}
          </div>
        </div>
      </main>
      
      <ModelNotificationProvider>
        <Toaster />
      </ModelNotificationProvider>
    </div>
  );
};

export default App;