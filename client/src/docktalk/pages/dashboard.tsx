import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import DockTalkHeader from "../components/DockTalkHeader";
import DockTalkTabs from "../components/DockTalkTabs";
import { useQuery } from "@tanstack/react-query";
import { fetchSystemStats } from "../lib/api";
import { useAuth } from "@/hooks/useAuth";
import NotificationsPage from "./notifications";
import SourcesPage from "./sources";
import { Loader2 } from "lucide-react";

interface SourcesPageWrapperProps {
  systemStats: { newArticlesToday?: number } | undefined;
  handleArticlesClick: () => void;
  handleNotificationClick: () => void;
  handleSettingsClick: () => void;
  handleArticleManagementClick: () => void;
}

function SourcesPageWrapper({
  systemStats,
  handleArticlesClick,
  handleNotificationClick,
  handleSettingsClick,
  handleArticleManagementClick
}: SourcesPageWrapperProps) {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission('manage:docktalk')) {
    return <Redirect to="/docktalk" />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <DockTalkHeader
        newArticlesCount={systemStats?.newArticlesToday || 0}
        onArticlesClick={handleArticlesClick}
        onNotificationClick={handleNotificationClick}
        onSettingsClick={handleSettingsClick}
        onArticleManagementClick={handleArticleManagementClick}
        showArticlesButton={true}
      />
      <div className="flex-1 overflow-auto p-6">
        <SourcesPage />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (location === "/docktalk/market-intelligence") return "market-intelligence";
    if (location === "/docktalk/m&a-spotlight") return "m&a-spotlight";
    if (location === "/docktalk/saved") return "saved";
    if (location === "/docktalk/watchlist") return "watchlist";
    if (location === "/docktalk/saved-searches") return "saved-searches";
    return "all-articles"; // default
  };

  // Fetch system stats for notification count
  const { data: systemStats } = useQuery({
    queryKey: ['/api/docktalk/analytics/stats'],
    queryFn: fetchSystemStats,
    refetchInterval: 60 * 1000,
  });

  const handleArticlesClick = () => {
    setLocation('/docktalk');
  };

  const handleNotificationClick = () => {
    setLocation('/docktalk/notifications');
  };

  const handleSettingsClick = () => {
    setLocation('/docktalk/sources');
  };

  const handleArticleManagementClick = () => {
    setLocation('/docktalk/article-management');
  };

  // Check if we're on a settings/notification page (show Articles button)
  const isSettingsPage = location === "/docktalk/notifications" || location === "/docktalk/sources";

  // Show notifications page for email setup
  if (location === "/docktalk/notifications") {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
        <DockTalkHeader
          newArticlesCount={systemStats?.newArticlesToday || 0}
          onArticlesClick={handleArticlesClick}
          onNotificationClick={handleNotificationClick}
          onSettingsClick={handleSettingsClick}
          onArticleManagementClick={handleArticleManagementClick}
          showArticlesButton={true}
        />
        <div className="flex-1 overflow-auto p-6">
          <NotificationsPage />
        </div>
      </div>
    );
  }

  // Show sources page for RSS/URL management (Admin Only)
  if (location === "/docktalk/sources") {
    return <SourcesPageWrapper 
      systemStats={systemStats}
      handleArticlesClick={handleArticlesClick}
      handleNotificationClick={handleNotificationClick}
      handleSettingsClick={handleSettingsClick}
      handleArticleManagementClick={handleArticleManagementClick}
    />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header with notification bell and settings */}
      <DockTalkHeader
        newArticlesCount={systemStats?.newArticlesToday || 0}
        onArticlesClick={handleArticlesClick}
        onNotificationClick={handleNotificationClick}
        onSettingsClick={handleSettingsClick}
        onArticleManagementClick={handleArticleManagementClick}
        showArticlesButton={false}
      />

      {/* Tabbed Navigation */}
      <div className="flex-1 overflow-auto">
        <DockTalkTabs activeTab={getActiveTab()} />
      </div>
    </div>
  );
}
