import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useState } from "react";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import Messages from "@/pages/Messages";
import Calendar from "@/pages/Calendar";
import Tasks from "@/pages/Tasks";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import Integrations from "@/pages/Integrations";
import Database from "@/pages/Database";
import GeminiDemo from "@/pages/GeminiDemo";
import MassSender from "@/pages/MassSender";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-800">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header onMenuButtonClick={() => setSidebarOpen(true)} />
          
          <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/leads" component={Leads} />
                  <Route path="/messages" component={Messages} />
                  <Route path="/calendar" component={Calendar} />
                  <Route path="/tasks" component={Tasks} />
                  <Route path="/analytics" component={Analytics} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/integrations" component={Integrations} />
                  <Route path="/database" component={Database} />
                  <Route path="/gemini-demo" component={GeminiDemo} />
                  <Route component={NotFound} />
                </Switch>
              </div>
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
