import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStats as IDashboardStats } from "@shared/schema";
import { usePageTranslation } from "@/components/translation/PageTranslator";
import { useEffect, useState } from "react";

export default function DashboardStats() {
  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<IDashboardStats>({
    queryKey: ["/api/dashboard-stats"]
  });

  // Obtener el contexto de traducción
  const { currentLanguage, translatePage } = usePageTranslation();

  // Format conversion rate from performance metrics
  const formatConversionRate = (performanceMetrics?: any) => {
    if (!performanceMetrics?.conversionRate) return "0%";
    return performanceMetrics.conversionRate + "%";
  };

  // Get active conversations from active leads
  const getActiveConversations = () => {
    return stats?.activeLeads || 0;
  };

  // Get today's meetings from pending activities
  const getTodayMeetings = () => {
    return stats?.pendingActivities || 0;
  };

  // Traducir texto usando Google Translate directo
  const translateText = async (text: string, targetLang: string): Promise<string> => {
    if (!text || text.trim() === '' || targetLang === 'es') return text;
    
    try {
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(googleUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data[0] && data[0][0] && data[0][0][0]) {
          return data[0][0][0];
        }
      }
    } catch (error) {
      console.warn('Error translating:', error);
    }
    
    return text;
  };

  // Get translated widget titles
  const getTranslatedTitles = async () => {
    if (currentLanguage === 'es') {
      return {
        totalLeads: 'Total Leads',
        conversionRate: 'Conversion Rate',
        activeConversations: 'Active Conversations',
        todayMeetings: "Today's Meetings"
      };
    }
    
    return {
      totalLeads: await translateText('Total Leads', currentLanguage),
      conversionRate: await translateText('Conversion Rate', currentLanguage),
      activeConversations: await translateText('Active Conversations', currentLanguage),
      todayMeetings: await translateText("Today's Meetings", currentLanguage)
    };
  };

  // State for translated titles
  const [translatedTitles, setTranslatedTitles] = useState({
    totalLeads: 'Total Leads',
    conversionRate: 'Conversion Rate',
    activeConversations: 'Active Conversations',
    todayMeetings: "Today's Meetings"
  });

  // Update translated titles when language changes
  useEffect(() => {
    const updateTitles = async () => {
      const titles = await getTranslatedTitles();
      setTranslatedTitles(titles);
    };
    
    updateTitles();
  }, [currentLanguage]);

  return (
    <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Leads */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-primary-100 rounded-md p-3">
                <span className="material-icons text-primary-600">people</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  {translatedTitles.totalLeads}
                </dt>
                <dd className="flex items-baseline">
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-semibold text-gray-900">
                      {(stats?.totalLeads || 0).toLocaleString()}
                    </div>
                  )}
                  <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                    <span className="material-icons text-sm">arrow_upward</span>
                    <span className="sr-only">Increased by</span>
                    8.2%
                  </div>
                </dd>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rate */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <span className="material-icons text-green-600">trending_up</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  {translatedTitles.conversionRate}
                </dt>
                <dd className="flex items-baseline">
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-semibold text-gray-900">
                      {formatConversionRate(stats?.performanceMetrics)}
                    </div>
                  )}
                  <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                    <span className="material-icons text-sm">arrow_upward</span>
                    <span className="sr-only">Increased by</span>
                    3.2%
                  </div>
                </dd>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Conversations */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <span className="material-icons text-blue-600">forum</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  {translatedTitles.activeConversations}
                </dt>
                <dd className="flex items-baseline">
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-semibold text-gray-900">
                      {getActiveConversations()}
                    </div>
                  )}
                  <div className="ml-2 flex items-baseline text-sm font-semibold text-yellow-600">
                    <span className="material-icons text-sm">remove</span>
                    <span className="sr-only">No change</span>
                    0%
                  </div>
                </dd>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Meetings */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                <span className="material-icons text-purple-600">calendar_today</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  {translatedTitles.todayMeetings}
                </dt>
                <dd className="flex items-baseline">
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-semibold text-gray-900">
                      {getTodayMeetings()}
                    </div>
                  )}
                  <div className="ml-2 flex items-baseline text-sm font-semibold text-red-600">
                    <span className="material-icons text-sm">arrow_downward</span>
                    <span className="sr-only">Decreased by</span>
                    1.5%
                  </div>
                </dd>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
