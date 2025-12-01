import { Card, CardContent } from "@/components/ui/card";
import { Ship, Warehouse, DollarSign, PieChart } from "lucide-react";
import type { DashboardStats } from "@/types/marina";

interface StatsGridProps {
  stats: DashboardStats;
  isLoading: boolean;
}

export default function StatsGrid({ stats, isLoading }: StatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsItems = [
    {
      title: "Today's Launches",
      value: stats.todaysLaunches,
      change: "+12% from yesterday",
      icon: Ship,
      bgColor: "bg-chart-1",
      testId: "stat-launches",
    },
    {
      title: "Available Slips",
      value: stats.availableSlips,
      change: `of ${stats.totalSlips} total`,
      icon: Warehouse,
      bgColor: "bg-chart-2",
      testId: "stat-slips",
    },
    {
      title: "Monthly Revenue",
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      change: "+8% from last month",
      icon: DollarSign,
      bgColor: "bg-chart-3",
      testId: "stat-revenue",
    },
    {
      title: "Occupancy Rate",
      value: `${stats.occupancyRate}%`,
      change: `${stats.occupiedSlips} boats stored`,
      icon: PieChart,
      bgColor: "bg-chart-4",
      testId: "stat-occupancy",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} data-testid={item.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.title}</p>
                  <p className="text-3xl font-bold text-foreground">{item.value}</p>
                  <p className="text-sm text-accent">{item.change}</p>
                </div>
                <div className={`w-12 h-12 ${item.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className="text-white" size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
