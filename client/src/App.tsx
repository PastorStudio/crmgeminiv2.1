import React, { useState } from 'react';
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from '@/components/ui/toaster';
import { Spinner } from '@/components/ui/spinner';
import PageTransition from '@/components/ui/page-transition';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { PersistentMenu, useMenuLoading } from '@/components/ui/persistent-menu';
import { CollapsibleSidebar } from '@/components/ui/CollapsibleSidebar';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Messages from './pages/Messages';
import Calendar from './pages/Calendar';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AISettings from './pages/AISettings';
import Tasks from './pages/Tasks';
import MediaGallery from './pages/MediaGallery';
import MessageTemplates from './pages/MessageTemplates';
import MassSender from './pages/MassSender';
import NotFound from './pages/not-found';
import Integrations from './pages/Integrations';
import AutoResponseSettings from './pages/AutoResponseSettings';
import AutoResponseSettingsFixed from './pages/AutoResponseSettingsFixed';
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
import WhatsAppConnection from './pages/WhatsAppConnection';
import AgentMonitoring from './pages/AgentMonitoring';
import TicketsSimple from './pages/TicketsSimple';
import ExternalAgents from './pages/ExternalAgents';
import InternalAgents from './pages/InternalAgents';
import GeminiAI from './pages/GeminiAI';
import AgentAnalysis from './pages/AgentAnalysis';
import DeepSeekSettings from './pages/DeepSeekSettings';
import ModernMessaging from './pages/ModernMessaging';
import SalesPipeline from './pages/SalesPipeline';
import AgentSecurity from './pages/AgentSecurity';
import SalesFlowDesigner from './pages/SalesFlowDesigner';
import FlowTemplates from './pages/FlowTemplates';
import SystemStatus from './pages/SystemStatus';
import { FunctionDocumentation } from './pages/FunctionDocumentation';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { PageTranslationProvider } from '@/components/translation/PageTranslationProvider';

// Component definition for AppRoutes
const AppRoutes: React.FC = () => {
  const location = useLocation()[0];
  const { isAuthenticated } = useAuth();
  const [showSidebar, setShowSidebar] = useState(true);
  const { isLoading } = useMenuLoading();

  // Define the menu sections for the collapsible sidebar
  const menuSections = [
    {
      title: "Principal",
      items: [
        { href: "/", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" fill="#3B82F6"/><rect x="14" y="3" width="7" height="7" rx="1" fill="#10B981"/><rect x="3" y="14" width="7" height="7" rx="1" fill="#F59E0B"/><rect x="14" y="14" width="7" height="7" rx="1" fill="#EF4444"/></svg>, label: "Dashboard", isActive: location === "/" },
        { href: "/leads", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" fill="#8B5CF6"/><circle cx="8" cy="14" r="2" fill="#06B6D4"/><circle cx="16" cy="14" r="2" fill="#F59E0B"/><path d="M12 14v6M8 18h8" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/></svg>, label: "Leads", isActive: location === "/leads" },
        { href: "/sales-pipeline", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="4" height="16" rx="1" fill="#3B82F6"/><rect x="7" y="6" width="4" height="14" rx="1" fill="#8B5CF6"/><rect x="12" y="8" width="4" height="12" rx="1" fill="#F59E0B"/><rect x="17" y="10" width="4" height="10" rx="1" fill="#10B981"/></svg>, label: "Pipeline Ventas", isActive: location === "/sales-pipeline" },
        { href: "/flow-templates", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="5" rx="1" fill="#8B5CF6"/><rect x="14" y="3" width="7" height="5" rx="1" fill="#06B6D4"/><rect x="3" y="10" width="7" height="5" rx="1" fill="#10B981"/><rect x="14" y="10" width="7" height="5" rx="1" fill="#F59E0B"/><rect x="8" y="16" width="8" height="5" rx="1" fill="#EF4444"/></svg>, label: "Plantillas de Flujos", isActive: location === "/flow-templates" },
        { href: "/system-status", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#10B981" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="4" fill="#10B981"/></svg>, label: "Estado del Sistema", isActive: location === "/system-status" },
        { href: "/sales-flow-designer", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M6 3v12M18 9v12M12 3v6M12 15v6" stroke="#6366F1" strokeWidth="2" strokeLinecap="round"/><circle cx="6" cy="9" r="2" fill="#6366F1"/></svg>, label: "Flujos de Ventas", isActive: location === "/sales-flow-designer" }
      ]
    },
    {
      title: "Comunicación",
      items: [
        { href: "/messages", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="14" rx="3" fill="#25D366"/><circle cx="7" cy="11" r="1" fill="white"/><circle cx="12" cy="11" r="1" fill="white"/><circle cx="17" cy="11" r="1" fill="white"/></svg>, label: "Mensajes", isActive: location === "/messages" },
        { href: "/message-templates", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" fill="#6366F1"/><rect x="6" y="6" width="12" height="2" rx="1" fill="white"/></svg>, label: "Plantillas", isActive: location === "/message-templates" },
        { href: "/mass-sender", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" fill="#F59E0B"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>, label: "Envío Masivo", isActive: location === "/mass-sender" }
      ]
    },
    {
      title: "Planificación",
      items: [
        { href: "/calendar", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" fill="#EF4444"/><rect x="3" y="4" width="18" height="6" rx="2" fill="#DC2626"/></svg>, label: "Calendario", isActive: location === "/calendar" },
        { href: "/tasks", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" fill="#10B981"/><path d="M8 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, label: "Tareas", isActive: location === "/tasks" },
        { href: "/tickets", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="3" fill="#8B5CF6"/><circle cx="18" cy="8" r="2" fill="#EF4444"/></svg>, label: "Tickets", isActive: location === "/tickets" }
      ]
    },
    {
      title: "Análisis y Recursos",
      items: [
        { href: "/analytics", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="12" width="4" height="8" rx="1" fill="#3B82F6"/><rect x="8" y="8" width="4" height="12" rx="1" fill="#10B981"/></svg>, label: "Análisis", isActive: location === "/analytics" },
        { href: "/gemini-ai", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" fill="#9333EA"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>, label: "Gemini AI", isActive: location === "/gemini-ai" },
        { href: "/media-gallery", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" fill="#8B5CF6"/><circle cx="8.5" cy="8.5" r="1" fill="white"/></svg>, label: "Galería", isActive: location === "/media-gallery" }
      ]
    },
    {
      title: "Conexiones",
      items: [
        { href: "/whatsapp-accounts", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" fill="#25D366"/><circle cx="8" cy="10" r="2" fill="white"/></svg>, label: "Cuentas WhatsApp", isActive: location === "/whatsapp-accounts" },
        { href: "/whatsapp-auth", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#25D366"/><rect x="7" y="7" width="10" height="10" rx="2" fill="white"/></svg>, label: "QR Autenticación", isActive: location === "/whatsapp-auth" },
        { href: "/agent-monitoring", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="2" fill="#1F2937"/><circle cx="8" cy="8" r="2" fill="#10B981"/></svg>, label: "Monitoreo Agentes", isActive: location === "/agent-monitoring" }
      ]
    },
    {
      title: "Administración",
      items: [
        { href: "/users", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#3B82F6"/><circle cx="8" cy="15" r="2" fill="#10B981"/></svg>, label: "Agentes", isActive: location === "/users" },
        { href: "/ai-settings", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" fill="#9333EA"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>, label: "AI Integration", isActive: location === "/ai-settings" },
        { href: "/function-documentation", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#DC2626"/><rect x="6" y="7" width="12" height="2" rx="1" fill="white"/></svg>, label: "Documentación", isActive: location === "/function-documentation" },
        { href: "/agent-security", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="10" rx="2" fill="#DC2626"/><circle cx="12" cy="15" r="2" fill="white"/></svg>, label: "Control y Seguridad", isActive: location === "/agent-security" },
        { href: "/settings", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" fill="#374151"/><circle cx="12" cy="12" r="3" fill="#F59E0B"/></svg>, label: "Configuración", isActive: location === "/settings" }
      ]
    }
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Collapsible Sidebar - shows only icons, expands on hover */}
      {showSidebar && <CollapsibleSidebar sections={menuSections} />}
      
      {/* Main content area with dynamic margin based on sidebar visibility */}
      <main className={`flex-1 transition-all duration-300 ${showSidebar ? 'ml-16' : 'ml-0'}`}>
        <div className="w-full h-full">
          {isLoading && isAuthenticated ? (
            <div className="flex justify-center items-center h-12">
              <Spinner className="h-6 w-6 text-blue-600" />
              <span className="ml-2 text-gray-600">Cargando configuración de la API...</span>
            </div>
          ) : (
            <PageTransition>
              <ErrorBoundary>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/leads" component={Leads} />
                  <Route path="/sales-pipeline" component={SalesPipeline} />
                  <Route path="/flow-templates" component={FlowTemplates} />
                  <Route path="/system-status" component={SystemStatus} />
                  <Route path="/sales-flow-designer" component={SalesFlowDesigner} />
                  <Route path="/messages" component={Messages} />
                  <Route path="/message-templates" component={MessageTemplates} />
                  <Route path="/mass-sender" component={MassSender} />
                  <Route path="/calendar" component={Calendar} />
                  <Route path="/tasks" component={Tasks} />
                  <Route path="/tickets" component={TicketsSimple} />
                  <Route path="/analytics" component={Analytics} />
                  <Route path="/gemini-ai" component={GeminiAI} />
                  <Route path="/media-gallery" component={MediaGallery} />
                  <Route path="/whatsapp-accounts" component={WhatsAppAccounts} />
                  <Route path="/whatsapp-auth" component={WhatsAppConnection} />
                  <Route path="/agent-monitoring" component={AgentMonitoring} />
                  <Route path="/users" component={UserManagement} />
                  <Route path="/ai-settings" component={AISettings} />
                  <Route path="/function-documentation" component={FunctionDocumentation} />
                  <Route path="/agent-security" component={AgentSecurity} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/profile" component={Profile} />
                  <Route path="/login" component={Login} />
                  <Route component={NotFound} />
                </Switch>
              </ErrorBoundary>
            </PageTransition>
          )}
        </div>
      </main>
      
      {/* Persistent menu component */}
      <PersistentMenu />
      
      {/* Toast notifications */}
      <Toaster />
    </div>
  );
};

// Main App component that wraps everything with authentication context
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;