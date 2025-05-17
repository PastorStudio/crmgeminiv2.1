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
import { useQuery } from '@tanstack/react-query';
import { ModelNotificationProvider } from './lib/modelNotification';

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <img
                  className="h-8 w-auto"
                  src="https://tailwindui.com/img/logos/workflow-mark-blue-600.svg"
                  alt="GeminiCRM"
                />
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <a href="/" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Dashboard
                  </a>
                  <a href="/leads" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/leads' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Leads
                  </a>
                  <a href="/messages" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/messages' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Mensajes
                  </a>
                  <a href="/calendar" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/calendar' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Calendario
                  </a>
                  <a href="/tasks" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/tasks' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Tareas
                  </a>
                  <a href="/analytics" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/analytics' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Análisis
                  </a>
                  <a href="/media-gallery" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/media-gallery' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Galería
                  </a>
                  <a href="/message-templates" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/message-templates' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Plantillas
                  </a>
                  <a href="/mass-sender" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/mass-sender' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Envío Masivo
                  </a>
                  <a href="/auto-response-settings" className={`px-3 py-2 rounded-md text-sm font-medium ${location === '/auto-response-settings' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700 hover:text-blue-600'}`}>
                    Respuestas Auto
                  </a>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <a href="/settings" className="p-1 rounded-full text-gray-600 hover:text-blue-600">
                  <span className="sr-only">Settings</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden pt-16">
        <div className="w-full h-full mx-auto">
          <div className="h-full">
            {isLoadingGeminiKey ? (
              <div className="flex justify-center items-center h-12">
                <Spinner className="h-6 w-6 text-blue-600" />
                <span className="ml-2 text-gray-600">Cargando configuración de la API...</span>
              </div>
            ) : (
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
                <Route component={NotFound} />
              </Switch>
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