import { Switch, Route } from 'wouter';

// Componente principal de la aplicación
export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Barra lateral */}
        <aside className="hidden md:flex md:w-64 md:flex-col">
          <div className="flex flex-col flex-grow pt-5 bg-white border-r border-gray-200">
            <div className="flex items-center flex-shrink-0 px-4">
              <h1 className="text-xl font-semibold">CRM WhatsApp AI</h1>
            </div>
            <div className="flex flex-col flex-grow mt-5">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                <a href="/" className="flex items-center px-2 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100">
                  Dashboard
                </a>
                <a href="/leads" className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                  Leads
                </a>
                <a href="/messages" className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                  Mensajes
                </a>
                <a href="/settings" className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100">
                  Configuración
                </a>
              </nav>
            </div>
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 overflow-auto">
          <div className="py-6">
            <div className="px-4 mx-auto max-w-7xl sm:px-6 md:px-8">
              <Switch>
                <Route path="/" exact>
                  <div className="p-4">
                    <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
                    <p className="mt-4">Bienvenido al CRM con WhatsApp e IA integrada.</p>
                  </div>
                </Route>
                <Route path="/leads">
                  <div className="p-4">
                    <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
                    <p className="mt-4">Gestión de clientes potenciales.</p>
                  </div>
                </Route>
                <Route path="/messages">
                  <div className="p-4">
                    <h1 className="text-2xl font-semibold text-gray-900">Mensajes</h1>
                    <p className="mt-4">Centro de mensajería WhatsApp.</p>
                  </div>
                </Route>
                <Route path="/settings">
                  <div className="p-4">
                    <h1 className="text-2xl font-semibold text-gray-900">Configuración</h1>
                    <p className="mt-4">Configuración del sistema y API keys.</p>
                  </div>
                </Route>
                <Route>
                  <div className="p-4">
                    <h1 className="text-2xl font-semibold text-gray-900">Página no encontrada</h1>
                    <p className="mt-4">La página que buscas no existe.</p>
                  </div>
                </Route>
              </Switch>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}