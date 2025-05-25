import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { PageContainer } from "@/components/ui/page-container";
import DashboardStats from "@/components/dashboard/DashboardStats";
import SalesPipeline from "@/components/dashboard/SalesPipeline";
import UpcomingActivities from "@/components/dashboard/UpcomingActivities";
import RecentConversations from "@/components/dashboard/RecentConversations";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/authContext";
import { Loader2, Sun, Moon, Coffee, Star } from "lucide-react";

export default function Dashboard() {
  // Estados para el proceso de importación
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | {
    success: boolean;
    message: string;
    createdLeads: any[];
    updatedLeads: any[];
  }>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Función para obtener el saludo según la hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      return {
        text: "¡Buenos días",
        icon: <Sun className="h-5 w-5 text-yellow-500" />,
        gradient: "from-yellow-400 to-orange-500"
      };
    } else if (hour >= 12 && hour < 18) {
      return {
        text: "¡Buenas tardes",
        icon: <Coffee className="h-5 w-5 text-amber-600" />,
        gradient: "from-amber-400 to-orange-600"
      };
    } else if (hour >= 18 && hour < 22) {
      return {
        text: "¡Buenas noches",
        icon: <Star className="h-5 w-5 text-purple-500" />,
        gradient: "from-purple-400 to-pink-500"
      };
    } else {
      return {
        text: "¡Buenas madrugadas",
        icon: <Moon className="h-5 w-5 text-blue-400" />,
        gradient: "from-blue-400 to-indigo-600"
      };
    }
  };

  const greeting = getGreeting();
  
  // Mobile-friendly header
  useEffect(() => {
    const mobileHeader = document.querySelector('.md\\:hidden');
    if (mobileHeader) {
      const headerTitle = document.createElement('h1');
      headerTitle.className = 'text-xl font-semibold text-white ml-2';
      headerTitle.textContent = 'Dashboard';
      mobileHeader.appendChild(headerTitle);
      
      return () => {
        headerTitle.remove();
      };
    }
  }, []);
  
  // Función para importar contactos de WhatsApp como leads
  const importWhatsAppContacts = async () => {
    try {
      setIsImporting(true);
      setImportResult(null);
      
      const response = await apiRequest('/api/direct/whatsapp/create-leads-from-contacts', {
        method: 'POST'
      });
      
      if (response.success) {
        // Actualizar el resultado de la importación
        setImportResult(response);
        
        // Mostrar notificación de éxito
        toast({
          title: '¡Contactos importados!',
          description: response.message,
        });
        
        // Invalidar las consultas de leads para que se actualice el pipeline
        queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      } else {
        // Mostrar notificación de error
        toast({
          title: 'Error en la importación',
          description: response.message || 'No se pudieron importar los contactos de WhatsApp',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Error importando contactos:", error);
      
      // Mostrar notificación de error
      toast({
        title: 'Error en la importación',
        description: 'Se produjo un error al intentar importar los contactos de WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Dashboard | WhatsApp CRM</title>
        <meta name="description" content="Overview of your CRM metrics, sales pipeline, upcoming activities, and recent conversations." />
      </Helmet>
      
      <PageContainer>
        {/* Título del sistema separado */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-800">CRM con Gemini</h1>
        </div>

        {/* Saludo personalizado */}
        <div className="mb-8">
          <div className={`bg-gradient-to-r ${greeting.gradient} p-6 rounded-lg shadow-lg text-white`}>
            <div className="flex items-center space-x-3">
              {greeting.icon}
              <div>
                <h2 className="text-2xl font-bold">
                  {greeting.text}, {user?.fullName || user?.username || 'Usuario'}!
                </h2>
                <p className="text-lg opacity-90 mt-1">
                  Bienvenido de vuelta al sistema de gestión WhatsApp
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Acción para importar contactos */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-700">Panel de Control</h3>
          <Button 
            onClick={importWhatsAppContacts} 
            disabled={isImporting}
            className="gap-2"
          >
            {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
            Importar contactos de WhatsApp como leads
          </Button>
        </div>
        
        {/* Mostrar resultado de la importación si existe */}
        {importResult && (
          <Alert className="mb-6">
            <AlertTitle>
              {importResult.success ? '¡Importación exitosa!' : 'Importación completada con advertencias'}
            </AlertTitle>
            <AlertDescription>
              {importResult.message}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Dashboard Stats */}
        <DashboardStats />
        
        {/* Sales Pipeline */}
        <SalesPipeline />
        
        {/* Upcoming Activities and Recent Conversations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <UpcomingActivities />
          <RecentConversations />
        </div>
      </PageContainer>
    </>
  );
}
