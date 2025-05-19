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
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  // Estados para los procesos
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingLeads, setIsDeletingLeads] = useState(false);
  const [importResult, setImportResult] = useState<null | {
    success: boolean;
    message: string;
    createdLeads: any[];
    updatedLeads: any[];
  }>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
  
  // Función para importar solo contactos individuales de WhatsApp con chats activos
  const importWhatsAppContacts = async () => {
    try {
      setIsImporting(true);
      setImportResult(null);
      
      const response = await apiRequest('POST', '/api/direct/whatsapp/create-leads-from-contacts', {
        onlyWithActiveChats: true,
        excludeGroups: true,
        useRealNames: true // Usar nombres reales de WhatsApp y no nombres de chat
      });
      
      if (response.ok) {
        const data = await response.json();
        // Actualizar el resultado de la importación
        setImportResult(data);
        
        // Mostrar notificación de éxito
        toast({
          title: '¡Contactos importados!',
          description: data.message,
        });
        
        // Invalidar las consultas de leads para que se actualice el pipeline
        queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      } else {
        const errorData = await response.json();
        // Mostrar notificación de error
        toast({
          title: 'Error en la importación',
          description: errorData.message || 'No se pudieron importar los contactos de WhatsApp',
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
  
  // Función para eliminar todos los leads
  const deleteAllLeads = async () => {
    if (window.confirm('¿Estás seguro que deseas eliminar TODOS los leads? Esta acción no se puede deshacer.')) {
      try {
        setIsDeletingLeads(true);
        
        const response = await apiRequest('DELETE', '/api/leads/delete-all');
        
        if (response.ok) {
          toast({
            title: 'Leads eliminados',
            description: 'Todos los leads han sido eliminados correctamente.',
          });
          
          // Invalidar las consultas de leads para que se actualice el pipeline
          queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
        } else {
          const errorData = await response.json();
          toast({
            title: 'Error',
            description: errorData.message || 'Ocurrió un error al eliminar los leads.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error eliminando leads:', error);
        toast({
          title: 'Error',
          description: 'Ocurrió un error al eliminar los leads.',
          variant: 'destructive',
        });
      } finally {
        setIsDeletingLeads(false);
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Dashboard | WhatsApp CRM</title>
        <meta name="description" content="Overview of your CRM metrics, sales pipeline, upcoming activities, and recent conversations." />
      </Helmet>
      
      <PageContainer>
        {/* Acciones del dashboard */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">CRM con Gemini</h2>
          <div className="flex gap-2">
            <Button 
              onClick={deleteAllLeads} 
              variant="destructive"
              className="gap-2"
            >
              {isDeletingLeads && <Loader2 className="h-4 w-4 animate-spin" />}
              Borrar todos los leads
            </Button>
            <Button 
              onClick={importWhatsAppContacts} 
              disabled={isImporting}
              className="gap-2"
            >
              {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar chats individuales
            </Button>
          </div>
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
