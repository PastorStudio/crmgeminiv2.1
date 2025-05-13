import { useEffect } from "react";
import { Helmet } from "react-helmet";
import DashboardStats from "@/components/dashboard/DashboardStats";
import SalesPipeline from "@/components/dashboard/SalesPipeline";
import UpcomingActivities from "@/components/dashboard/UpcomingActivities";
import RecentConversations from "@/components/dashboard/RecentConversations";

export default function Dashboard() {
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
        <title>Dashboard | GeminiCRM</title>
        <meta name="description" content="Overview of your CRM metrics, sales pipeline, upcoming activities, and recent conversations." />
      </Helmet>
      
      {/* Dashboard Stats */}
      <DashboardStats />
      
      {/* Sales Pipeline */}
      <SalesPipeline />
      
      {/* Upcoming Activities and Recent Conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingActivities />
        <RecentConversations />
      </div>
    </>
  );
}
