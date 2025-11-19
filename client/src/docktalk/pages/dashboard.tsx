import { useState } from "react";
import DockTalkHeader from "../components/DockTalkHeader";
import DockTalkTabs from "../components/DockTalkTabs";
import NotificationDropdown from "../components/NotificationDropdown";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function Dashboard() {
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleNotificationClick = () => {
    // Clear notifications
    setNewArticlesCount(0);
  };

  const handleSettingsClick = () => {
    setSettingsOpen(true);
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    setNewArticlesCount(0);
  };

  const handleViewArticle = (notification: any) => {
    // TODO: Navigate to article or open in new tab
    console.log("View article:", notification);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* DockTalk Header */}
      <DockTalkHeader
        newArticlesCount={newArticlesCount}
        onNotificationClick={handleNotificationClick}
        onSettingsClick={handleSettingsClick}
        notificationContent={
          <NotificationDropdown
            notifications={notifications}
            onClear={handleClearNotifications}
            onViewArticle={handleViewArticle}
          />
        }
      />

      {/* Tabbed Content */}
      <div className="flex-1 overflow-auto">
        <DockTalkTabs />
      </div>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">DockTalk Settings</h2>
            <p className="text-gray-600">Admin settings will be integrated here...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
