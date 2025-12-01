import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import StatsGrid from "@/components/dashboard/stats-grid";
import LaunchSchedule from "@/components/dashboard/launch-schedule";
import IntegrationStatus from "@/components/dashboard/integration-status";
import CustomerActivity from "@/components/dashboard/customer-activity";
import InventoryOverview from "@/components/dashboard/inventory-overview";
import FinancialOverview from "@/components/dashboard/financial-overview";
import LaunchModal from "@/components/modals/launch-modal";
import type { DashboardStats } from "@/types/marina";

export default function Dashboard() {
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <StatsGrid 
            stats={stats || {
              todaysLaunches: 0,
              availableSlips: 0,
              totalSlips: 0,
              monthlyRevenue: 0,
              occupancyRate: 0,
              occupiedSlips: 0,
              overduePayments: 0,
            }} 
            isLoading={statsLoading} 
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <LaunchSchedule onScheduleClick={() => setIsLaunchModalOpen(true)} />
            <IntegrationStatus />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CustomerActivity />
            <InventoryOverview />
          </div>

          <FinancialOverview />
        </div>
      </main>

      <LaunchModal 
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
      />
    </div>
  );
}
