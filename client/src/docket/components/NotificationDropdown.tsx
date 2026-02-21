import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
  id: number;
  title: string;
  source: string;
  category: string;
  publishedAt?: string;
  url?: string;
  timestamp: Date;
}

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  onClear: () => void;
  onViewArticle: (notification: NotificationItem) => void;
}

export default function NotificationDropdown({ 
  notifications, 
  onClear, 
  onViewArticle 
}: NotificationDropdownProps) {
  if (notifications.length === 0) {
    return (
      <div className="p-4 text-center">
        <Bell className="h-8 w-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">No new articles</p>
        <p className="text-xs text-gray-500 mt-1">You're all caught up!</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">New Articles ({notifications.length})</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClear}
          data-testid="button-clear-notifications"
        >
          Clear All
        </Button>
      </div>
      
      <ScrollArea className="h-[400px]">
        <div className="divide-y">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onViewArticle(notification)}
              data-testid={`notification-${notification.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 line-clamp-2">
                    {notification.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {notification.category}
                    </Badge>
                    <span className="text-xs text-gray-600">
                      {notification.source}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
