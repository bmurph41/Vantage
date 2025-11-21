import { useState } from "react";
import { useLocation } from "wouter";
import DockTalkHeader from "../components/DockTalkHeader";
import DockTalkTabs from "../components/DockTalkTabs";
import { useQuery } from "@tanstack/react-query";
import { fetchSystemStats } from "../lib/api";
import { useAuth } from "@/hooks/useAuth";
import PreferencesPage from "./preferences";

export default function Dashboard() {
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (location === "/docktalk/market-intelligence") return "market-intelligence";
    if (location === "/docktalk/m&a-spotlight") return "m&a-spotlight";
    if (location === "/docktalk/saved") return "saved";
    if (location === "/docktalk/portfolio") return "portfolio";
    if (location === "/docktalk/saved-searches") return "saved-searches";
    if (location === "/docktalk/watchlists") return "watchlists";
    if (location === "/docktalk/preferences") return "preferences";
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
    setLocation('/docktalk/preferences');
  };

  // Show preferences page if on /docktalk/preferences route
  if (location === "/docktalk/preferences") {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
        <DockTalkHeader
          newArticlesCount={systemStats?.newArticlesToday || 0}
          onNotificationClick={handleNotificationClick}
          onSettingsClick={handleSettingsClick}
        />
        <div className="flex-1 overflow-auto p-6">
          <PreferencesPage />
        </div>
      </div>
    );
  }

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
