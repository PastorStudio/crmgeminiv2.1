import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { PageContainer } from "@/components/ui/page-container";
import DashboardStats from "@/components/dashboard/DashboardStats";
import AdminMetrics from "@/components/dashboard/AdminMetrics";
import UpcomingActivities from "@/components/dashboard/UpcomingActivities";
import RecentConversations from "@/components/dashboard/RecentConversations";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/authContext";
import { Loader2, Sun, Moon, Coffee, Star } from "lucide-react";
import { getRealNow, formatNYTime } from "@/lib/timeSync";
import { PageTranslationSelector, usePageTranslation } from "@/components/translation/PageTranslator";
import { SystemRefreshButton } from "@/components/dashboard/SystemRefreshButton";

export default function Dashboard() {
  // Estados para el proceso de importación
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | {
    success: boolean;
    message: string;
    createdLeads: any[];
    updatedLeads: any[];
  }>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Obtener el idioma actual del sistema de traducción
  const { currentLanguage } = usePageTranslation();

  // Update time every second usando fecha sincronizada
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getRealNow());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time and date for display usando zona horaria Nueva York
  const formatDateTime = () => {
    // Mapear códigos de idioma a locales apropiados
    const localeMap: { [key: string]: string } = {
      'es': 'es-ES',
      'en': 'en-US',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'ru': 'ru-RU',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'ar': 'ar-SA',
      'hi': 'hi-IN',
      'nl': 'nl-NL',
      'sv': 'sv-SE',
      'no': 'no-NO',
      'da': 'da-DK',
      'fi': 'fi-FI',
      'pl': 'pl-PL',
      'cs': 'cs-CZ',
      'hu': 'hu-HU',
      'ro': 'ro-RO',
      'bg': 'bg-BG'
    };
    
    const locale = localeMap[currentLanguage] || 'es-ES';
    
    return getRealNow().toLocaleDateString(locale, {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Traducciones estáticas para saludos
  const greetingTranslations = {
    goodMorning: {
      es: "¡Buenos días",
      en: "Good morning",
      fr: "Bonjour",
      de: "Guten Morgen",
      it: "Buongiorno",
      pt: "Bom dia",
      ru: "Доброе утро",
      zh: "早上好",
      ja: "おはようございます",
      ko: "좋은 아침"
    },
    goodAfternoon: {
      es: "¡Buenas tardes",
      en: "Good afternoon",
      fr: "Bon après-midi",
      de: "Guten Tag",
      it: "Buon pomeriggio",
      pt: "Boa tarde",
      ru: "Добрый день",
      zh: "下午好",
      ja: "こんにちは",
      ko: "좋은 오후"
    },
    goodEvening: {
      es: "¡Buenas noches",
      en: "Good evening",
      fr: "Bonsoir",
      de: "Guten Abend",
      it: "Buonasera",
      pt: "Boa noite",
      ru: "Добрый вечер",
      zh: "晚上好",
      ja: "こんばんは",
      ko: "좋은 저녁"
    },
    goodNight: {
      es: "¡Buenas madrugadas",
      en: "Good night",
      fr: "Bonne nuit",
      de: "Gute Nacht",
      it: "Buonanotte",
      pt: "Boa madrugada",
      ru: "Доброй ночи",
      zh: "深夜好",
      ja: "おやすみなさい",
      ko: "좋은 새벽"
    },
    welcomeBack: {
      es: "Bienvenido de vuelta al sistema de gestión WhatsApp",
      en: "Welcome back to the WhatsApp management system",
      fr: "Bienvenue dans le système de gestion WhatsApp",
      de: "Willkommen zurück im WhatsApp-Verwaltungssystem",
      it: "Bentornato nel sistema di gestione WhatsApp",
      pt: "Bem-vindo de volta ao sistema de gestão WhatsApp",
      ru: "Добро пожаловать обратно в систему управления WhatsApp",
      zh: "欢迎回到WhatsApp管理系统",
      ja: "WhatsApp管理システムへようこそ",
      ko: "WhatsApp 관리 시스템에 다시 오신 것을 환영합니다"
    }
  };

  // Función para obtener el saludo según la hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      return {
        text: greetingTranslations.goodMorning[currentLanguage as keyof typeof greetingTranslations.goodMorning] || greetingTranslations.goodMorning.es,
        icon: <Sun className="h-5 w-5 text-yellow-500" />,
        gradient: "from-yellow-400 to-orange-500"
      };
    } else if (hour >= 12 && hour < 18) {
      return {
        text: greetingTranslations.goodAfternoon[currentLanguage as keyof typeof greetingTranslations.goodAfternoon] || greetingTranslations.goodAfternoon.es,
        icon: <Coffee className="h-5 w-5 text-amber-600" />,
        gradient: "from-amber-400 to-orange-600"
      };
    } else if (hour >= 18 && hour < 22) {
      return {
        text: greetingTranslations.goodEvening[currentLanguage as keyof typeof greetingTranslations.goodEvening] || greetingTranslations.goodEvening.es,
        icon: <Star className="h-5 w-5 text-purple-500" />,
        gradient: "from-purple-400 to-pink-500"
      };
    } else {
      return {
        text: greetingTranslations.goodNight[currentLanguage as keyof typeof greetingTranslations.goodNight] || greetingTranslations.goodNight.es,
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

        {/* Saludo personalizado con reloj del sistema */}
        <div className="mb-8">
          <div className="bg-gray-900 p-4 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {greeting.icon}
                <p className="text-sm" data-no-translate="true">
                  {greeting.text}, {user?.fullName || user?.username || 'Usuario'}! - {greetingTranslations.welcomeBack[currentLanguage as keyof typeof greetingTranslations.welcomeBack] || greetingTranslations.welcomeBack.es}
                </p>
              </div>
              
              {/* Controles del sistema */}
              <div className="flex items-center space-x-3">
                {/* Selector de traducción global */}
                <div className="bg-white/10 px-3 py-2 rounded-lg border border-white/20">
                  <PageTranslationSelector />
                </div>
                
                {/* Reloj del sistema */}
                <div className="flex items-center space-x-2 bg-white/10 px-3 py-2 rounded-lg border border-white/20">
                  <span className="text-yellow-400 text-lg">🕐</span>
                  <div className="text-sm font-semibold">{formatDateTime()}</div>
                </div>
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
        
        {/* Administrative Metrics */}
        <AdminMetrics />
        
        {/* Upcoming Activities and Recent Conversations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <UpcomingActivities />
          <RecentConversations />
        </div>
        
        {/* Modern Floating System Refresh Button */}
        <SystemRefreshButton />
      </PageContainer>
    </>
  );
}
