import { useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "./user-menu";
import NotificationPreferences from "./notification-preferences";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

interface NavigationProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Navigation({ searchQuery, onSearchChange }: NavigationProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleBellClick = () => {
    setNotificationsOpen(true);
  };

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Link href="/docktalk" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <i className="fas fa-anchor text-primary text-2xl"></i>
              <h1 className="text-xl font-bold text-foreground">The Docket</h1>
            </Link>
            <Badge variant="secondary" className="text-xs">
              Marina Industry News
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input
                type="search"
                placeholder="Search articles, summaries, tags..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-96 pl-10"
                data-testid="input-search"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
            </div>
            
            <Link href="/docktalk/admin">
              <Button 
                variant="ghost" 
                size="icon"
                data-testid="link-admin"
                title="Admin Dashboard"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleBellClick}
              data-testid="button-notifications"
              title="Email Notifications"
            >
              <i className="fas fa-bell"></i>
            </Button>
            
            <UserMenu />
          </div>
        </div>
      </div>

      <NotificationPreferences 
        open={notificationsOpen} 
        onOpenChange={setNotificationsOpen} 
      />
    </nav>
  );
}
