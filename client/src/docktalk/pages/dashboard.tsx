import { useState } from "react";
import DockTalkHeader from "../components/DockTalkHeader";
import DockTalkTabs from "../components/DockTalkTabs";
import { useQuery } from "@tanstack/react-query";
import { fetchSystemStats } from "../lib/api";
import { useAuth } from "../hooks/use-auth";

export default function Dashboard() {
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const { user } = useAuth();

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
        <DockTalkTabs />
      </div>
    </div>
  );
}
