import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStats as IDashboardStats } from "@shared/schema";

export default function DashboardStats() {
  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<IDashboardStats>({
    queryKey: ["/api/dashboard-stats"]
  });

  // Format conversion rate from stored integer (2450) to percentage (24.5%)
  const formatConversionRate = (rate?: number) => {
    if (!rate) return "0%";
    return (rate / 100).toFixed(1) + "%";
  };

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
                  Total Leads
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
                  Conversion Rate
                </dt>
                <dd className="flex items-baseline">
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-semibold text-gray-900">
                      {formatConversionRate(stats?.conversionRate)}
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
                  Active Conversations
                </dt>
                <dd className="flex items-baseline">
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats?.activeConversations || "0"}
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
                  Today's Meetings
                </dt>
                <dd className="flex items-baseline">
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats?.todayMeetings || "0"}
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
