import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSettingsContext } from '@/context/SettingsContext';
import { useTheme } from '@/contexts/ThemeProvider';
import { SettingsCenterModal } from '@/components/settings';
import {
  User,
  Settings,
  LogOut,
  Shield,
  HelpCircle,
  Keyboard,
  Moon,
  Sun,
  ChevronDown,
  Loader2,
} from 'lucide-react';

interface UserMenuProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const { toast } = useToast();
  const { settings, updateSettings, openSettingsModal, isSettingsModalOpen, closeSettingsModal } =
    useSettingsContext();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Sign out failed');
      }

      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      toast({
        title: 'Sign out failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
      setIsSigningOut(false);
    }
  };

  const toggleTheme = () => {
    const currentTheme = settings.theme;
    const newTheme =
      currentTheme === 'light' ? 'dark' : currentTheme === 'dark' ? 'system' : 'light';
    updateSettings({ theme: newTheme });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" forceMount>
          {/* User Info */}
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Quick Actions */}
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={openSettingsModal}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
              <span className="ml-auto text-xs text-muted-foreground">⌘,</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {resolvedTheme === 'dark' ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              {theme === 'light'
                ? 'Dark Mode'
                : theme === 'dark'
                ? 'System Theme'
                : 'Light Mode'}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          {/* Help Section */}
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <a href="/docs" target="_blank" rel="noopener noreferrer">
                <HelpCircle className="mr-2 h-4 w-4" />
                Help & Documentation
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              // Trigger keyboard shortcuts modal
              document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
            }}>
              <Keyboard className="mr-2 h-4 w-4" />
              Keyboard Shortcuts
              <span className="ml-auto text-xs text-muted-foreground">?</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          {/* Sign Out */}
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-red-600 focus:text-red-600"
          >
            {isSigningOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings Modal */}
      <SettingsCenterModal open={isSettingsModalOpen} onOpenChange={closeSettingsModal} />
    </>
  );
}