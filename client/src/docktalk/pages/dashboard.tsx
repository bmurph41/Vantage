import { useState } from "react";
import { useLocation } from "wouter";
import DockTalkHeader from "../components/DockTalkHeader";
import DockTalkTabs from "../components/DockTalkTabs";
import { useQuery } from "@tanstack/react-query";
import { fetchSystemStats } from "../lib/api";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const { user } = useAuth();
  const [location] = useLocation();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (location === "/docktalk/market-intelligence") return "market-intelligence";
    if (location === "/docktalk/m&a-spotlight") return "m&a-spotlight";
    if (location === "/docktalk/saved") return "saved";
    if (location === "/docktalk/portfolio") return "portfolio";
    return "all-articles"; // default
  };

  // Fetch system stats for notification count
  const { data: systemStats } = useQuery({
    queryKey: ['/api/docktalk/analytics/stats'],
    queryFn: fetchSystemStats,
    refetchInterval: 60 * 1000,
  });

  const handleNotificationClick = () => {
    // Notification functionality - can be expanded later
    console.log('Notifications clicked');
  };

  const handleSettingsClick = () => {
    // Settings functionality - can be expanded later
    console.log('Settings clicked');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header with notification bell and settings */}
      <DockTalkHeader
        newArticlesCount={systemStats?.newArticlesToday || 0}
        onNotificationClick={handleNotificationClick}
        onSettingsClick={handleSettingsClick}
      />

      {/* Tabbed Navigation */}
      <div className="flex-1 overflow-hidden">
        <DockTalkTabs activeTab={getActiveTab()} />
      </div>
    </div>
  );
}
