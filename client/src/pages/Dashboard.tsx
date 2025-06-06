import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { PageContainer } from "@/components/ui/page-container";
import DashboardStats from "@/components/dashboard/DashboardStats";
import AdminMetrics from "@/components/dashboard/AdminMetrics";
import UpcomingActivities from "@/components/dashboard/UpcomingActivities";
import RecentConversations from "@/components/dashboard/RecentConversations";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/authContext";
import { Loader2, Sun, Moon, Coffee, Star, MessageCircle, Users, FileText, Phone, Send, Clock, CheckCircle, TrendingUp } from "lucide-react";
import { getRealNow, formatNYTime } from "@/lib/timeSync";
import { PageTranslationSelector, usePageTranslation } from "@/components/translation/PageTranslator";
import { SystemRefreshButton } from "@/components/dashboard/SystemRefreshButton";

export default function Dashboard() {

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

  return (
    <>
      <Helmet>
        <title>Dashboard | WhatsApp CRM</title>
        <meta name="description" content="Overview of your CRM metrics, sales pipeline, upcoming activities, and recent conversations." />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-black via-black to-red-600">
        {/* Hero Section with Animated Business Icons */}
        <div className="relative overflow-hidden bg-gradient-to-r from-black to-red-900 py-20">
          {/* Animated Background Elements */}
          <div className="absolute inset-0">
            {/* Floating WhatsApp Icons */}
            <div className="absolute top-20 left-20 animate-bounce delay-100">
              <MessageCircle className="h-12 w-12 text-green-400 opacity-30" />
            </div>
            <div className="absolute top-40 right-32 animate-pulse delay-300">
              <Users className="h-16 w-16 text-red-400 opacity-40" />
            </div>
            <div className="absolute bottom-40 left-40 animate-bounce delay-500">
              <FileText className="h-10 w-10 text-white opacity-25" />
            </div>
            <div className="absolute top-60 left-1/2 animate-pulse delay-700">
              <Phone className="h-14 w-14 text-green-500 opacity-35" />
            </div>
            <div className="absolute bottom-60 right-20 animate-bounce delay-900">
              <Send className="h-12 w-12 text-red-300 opacity-30" />
            </div>
            
            {/* Business Chat Animation */}
            <div className="absolute top-32 right-1/4 animate-pulse delay-200">
              <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <MessageCircle className="h-6 w-6 text-green-400" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
            
            {/* File Transfer Animation */}
            <div className="absolute bottom-32 left-1/3 animate-pulse delay-400">
              <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <FileText className="h-6 w-6 text-red-400" />
                <TrendingUp className="h-4 w-4 text-white animate-pulse" />
              </div>
            </div>
          </div>

          {/* Main Hero Content */}
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-white mb-6 animate-fade-in">
                WhatsApp Business
                <span className="block text-red-400">CRM Platform</span>
              </h1>
              
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
                Automatiza tu comunicación empresarial con IA avanzada, gestión de clientes y respuestas inteligentes
              </p>

              {/* Animated Business Features Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
                <div className="bg-black/30 p-6 rounded-xl backdrop-blur-sm border border-red-500/20 hover:border-red-500/50 transition-all duration-300 animate-slide-up delay-100">
                  <MessageCircle className="h-12 w-12 text-green-400 mx-auto mb-4 animate-pulse" />
                  <h3 className="text-white font-semibold mb-2">Mensajería</h3>
                  <p className="text-gray-400 text-sm">Chat empresarial automatizado</p>
                </div>
                
                <div className="bg-black/30 p-6 rounded-xl backdrop-blur-sm border border-red-500/20 hover:border-red-500/50 transition-all duration-300 animate-slide-up delay-200">
                  <Users className="h-12 w-12 text-red-400 mx-auto mb-4 animate-bounce" />
                  <h3 className="text-white font-semibold mb-2">Clientes</h3>
                  <p className="text-gray-400 text-sm">Gestión de contactos</p>
                </div>
                
                <div className="bg-black/30 p-6 rounded-xl backdrop-blur-sm border border-red-500/20 hover:border-red-500/50 transition-all duration-300 animate-slide-up delay-300">
                  <FileText className="h-12 w-12 text-white mx-auto mb-4 animate-pulse" />
                  <h3 className="text-white font-semibold mb-2">Archivos</h3>
                  <p className="text-gray-400 text-sm">Documentos y multimedia</p>
                </div>
                
                <div className="bg-black/30 p-6 rounded-xl backdrop-blur-sm border border-red-500/20 hover:border-red-500/50 transition-all duration-300 animate-slide-up delay-400">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4 animate-bounce" />
                  <h3 className="text-white font-semibold mb-2">Automatización</h3>
                  <p className="text-gray-400 text-sm">Respuestas inteligentes</p>
                </div>
              </div>

              {/* Live Business Activity Simulation */}
              <div className="mt-16 bg-black/40 rounded-2xl p-8 backdrop-blur-sm border border-red-500/30">
                <h3 className="text-white text-2xl font-bold mb-6">Actividad Empresarial en Tiempo Real</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Messages Activity */}
                  <div className="bg-green-600/20 p-4 rounded-lg border border-green-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <MessageCircle className="h-8 w-8 text-green-400" />
                      <Clock className="h-5 w-5 text-green-300 animate-spin" />
                    </div>
                    <div className="text-white font-semibold text-lg">1,247</div>
                    <div className="text-green-300 text-sm">Mensajes hoy</div>
                    <div className="mt-2 flex items-center">
                      <TrendingUp className="h-4 w-4 text-green-400 mr-1" />
                      <span className="text-green-400 text-xs">+23% vs ayer</span>
                    </div>
                  </div>

                  {/* Clients Activity */}
                  <div className="bg-red-600/20 p-4 rounded-lg border border-red-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <Users className="h-8 w-8 text-red-400" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                    <div className="text-white font-semibold text-lg">342</div>
                    <div className="text-red-300 text-sm">Clientes activos</div>
                    <div className="mt-2 flex items-center">
                      <TrendingUp className="h-4 w-4 text-red-400 mr-1" />
                      <span className="text-red-400 text-xs">+15 nuevos</span>
                    </div>
                  </div>

                  {/* Files Activity */}
                  <div className="bg-white/20 p-4 rounded-lg border border-white/30">
                    <div className="flex items-center justify-between mb-3">
                      <FileText className="h-8 w-8 text-white" />
                      <Send className="h-5 w-5 text-white animate-pulse" />
                    </div>
                    <div className="text-white font-semibold text-lg">89</div>
                    <div className="text-gray-300 text-sm">Archivos compartidos</div>
                    <div className="mt-2 flex items-center">
                      <TrendingUp className="h-4 w-4 text-white mr-1" />
                      <span className="text-white text-xs">+7 recientes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Time and User Info */}
              <div className="mt-12 flex flex-col md:flex-row items-center justify-between bg-black/40 p-6 rounded-xl backdrop-blur-sm border border-red-500/30">
                <div className="flex items-center space-x-4 mb-4 md:mb-0">
                  {greeting.icon}
                  <span className="text-white text-lg">
                    {greeting.text}, {user?.fullName || user?.username || 'Usuario'}!
                  </span>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="bg-red-600/20 px-4 py-2 rounded-lg border border-red-500/30">
                    <PageTranslationSelector />
                  </div>
                  
                  <div className="flex items-center space-x-2 bg-black/40 px-4 py-2 rounded-lg border border-white/20">
                    <Clock className="h-5 w-5 text-red-400" />
                    <span className="text-white font-semibold">{formatDateTime()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="bg-gray-900 min-h-screen">
          <PageContainer>
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
        </div>
      </div>
    </>
  );
}
