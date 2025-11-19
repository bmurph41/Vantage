import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DockTalkHeaderProps {
  newArticlesCount: number;
  onNotificationClick: () => void;
  onSettingsClick: () => void;
  notificationContent?: React.ReactNode;
}

export default function DockTalkHeader({ 
  newArticlesCount, 
  onNotificationClick, 
  onSettingsClick,
  notificationContent 
}: DockTalkHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">DockTalk</h1>
        <p className="text-sm text-gray-600 mt-1">Marina M&A Intelligence Platform</p>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        {notificationContent ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="button-notifications"
              >
                <Bell className="h-5 w-5" />
                {newArticlesCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {newArticlesCount > 9 ? '9+' : newArticlesCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              {notificationContent}
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={onNotificationClick}
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            {newArticlesCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {newArticlesCount > 9 ? '9+' : newArticlesCount}
              </Badge>
            )}
          </Button>
        )}

        {/* Settings Wheel */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          data-testid="button-settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
