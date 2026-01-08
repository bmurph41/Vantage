import { Bell, Settings, Newspaper, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

interface DockTalkHeaderProps {
  newArticlesCount: number;
  onArticlesClick: () => void;
  onNotificationClick: () => void;
  onSettingsClick: () => void;
  onArticleManagementClick?: () => void;
  notificationContent?: React.ReactNode;
  showArticlesButton?: boolean;
}

export default function DockTalkHeader({ 
  newArticlesCount, 
  onArticlesClick,
  onNotificationClick, 
  onSettingsClick,
  onArticleManagementClick,
  notificationContent,
  showArticlesButton = false
}: DockTalkHeaderProps) {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('manage:docktalk');

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">DockTalk</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Marina M&A Intelligence Platform</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Articles Button - shown when on notifications or sources pages */}
          {showArticlesButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onArticlesClick}
                  data-testid="button-articles"
                >
                  <Newspaper className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to Articles</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Notification Bell - Email Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent>
              <p>Email Notifications</p>
            </TooltipContent>
          </Tooltip>

          {/* AI Training - Article Management (Admin Only) */}
          {isAdmin && onArticleManagementClick && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onArticleManagementClick}
                  data-testid="button-article-management"
                >
                  <Brain className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>AI Training</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Settings Wheel - Sources Management (Admin Only) */}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSettingsClick}
                  data-testid="button-settings"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Manage Sources</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
