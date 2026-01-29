import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  User,
  Shield,
  Bell,
  Palette,
  Database,
  Plug,
  HelpCircle,
  Settings2,
  X,
  Loader2,
  Check,
} from 'lucide-react';

import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import type { SettingsSection, UserSettings } from '@/types/settings';

// Section Components
import { AccountSettings } from './sections/AccountSettings';
import { SecuritySettings } from './sections/SecuritySettings';
import { NotificationSettings } from './sections/NotificationSettings';
import { DisplaySettings } from './sections/DisplaySettings';
import { DataPrivacySettings } from './sections/DataPrivacySettings';
import { IntegrationsSettings } from './sections/IntegrationsSettings';
import { HelpAboutSettings } from './sections/HelpAboutSettings';
import { AdminSettings } from './sections/AdminSettings';

interface SettingsCenterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'display', label: 'Display', icon: Palette },
  { id: 'data-privacy', label: 'Data & Privacy', icon: Database },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'help', label: 'Help & About', icon: HelpCircle },
  { id: 'admin', label: 'Admin', icon: Settings2, adminOnly: true },
];

export function SettingsCenterModal({ open, onOpenChange }: SettingsCenterModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [localSettings, setLocalSettings] = useState<Partial<UserSettings>>({});
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  const settings = data?.settings;
  const profile = data?.profile;
  const organization = data?.organization;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';
  const autoSave = settings?.autoSave ?? true;

  // Reset local state when modal opens
  useEffect(() => {
    if (open && settings) {
      setLocalSettings({});
      setIsDirty(false);
    }
  }, [open, settings]);

  // Handle setting changes
          const handleChange = useCallback(
            (updates: Partial<UserSettings>) => {
              // Apply theme immediately if it's being changed
              if (updates.theme) {
                const root = document.documentElement;
                localStorage.setItem('marinamatch-theme', updates.theme);
                let isDark = updates.theme === 'dark' || 
                  (updates.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                root.classList.remove('light', 'dark');
                root.classList.add(isDark ? 'dark' : 'light');
              }

              if (autoSave) {
                // Immediate save with optimistic update
                updateSettings.mutate(updates, {
          onError: (error) => {
            toast({
              title: 'Failed to save',
              description: error.message,
              variant: 'destructive',
            });
          },
        });
      } else {
        // Batch changes locally
        setLocalSettings((prev) => ({ ...prev, ...updates }));
        setIsDirty(true);
      }
    },
    [autoSave, updateSettings, toast]
  );

  // Save all pending changes
  const handleSave = useCallback(() => {
    if (!isDirty || Object.keys(localSettings).length === 0) return;

    updateSettings.mutate(localSettings, {
      onSuccess: () => {
        setLocalSettings({});
        setIsDirty(false);
        toast({
          title: 'Settings saved',
          description: 'Your preferences have been updated.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Failed to save',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  }, [isDirty, localSettings, updateSettings, toast]);

  // Handle close with unsaved changes
  const handleClose = useCallback(() => {
    if (isDirty && !autoSave) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmed) return;
    }
    onOpenChange(false);
  }, [isDirty, autoSave, onOpenChange]);

  // Merge server settings with local changes
  const mergedSettings = settings ? { ...settings, ...localSettings } : undefined;

  // Filter nav items based on role
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const renderSection = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error || !mergedSettings || !profile) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p>Failed to load settings</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      );
    }

    const sectionProps = {
      settings: mergedSettings,
      profile,
      organization,
      onChange: handleChange,
    };

    switch (activeSection) {
      case 'account':
        return <AccountSettings {...sectionProps} />;
      case 'security':
        return <SecuritySettings {...sectionProps} />;
      case 'notifications':
        return <NotificationSettings {...sectionProps} />;
      case 'display':
        return <DisplaySettings {...sectionProps} />;
      case 'data-privacy':
        return <DataPrivacySettings {...sectionProps} />;
      case 'integrations':
        return <IntegrationsSettings {...sectionProps} />;
      case 'help':
        return <HelpAboutSettings {...sectionProps} />;
      case 'admin':
        return isAdmin ? <AdminSettings {...sectionProps} /> : null;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">Settings</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your account preferences and application settings
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Navigation */}
          <nav className="w-56 border-r bg-muted/30 py-4">
            <ScrollArea className="h-full">
              <div className="px-3 space-y-1">
                {visibleNavItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;

                  // Add separator before Admin section
                  const showSeparator = item.id === 'admin' && index > 0;

                  return (
                    <div key={item.id}>
                      {showSeparator && <Separator className="my-3" />}
                      <button
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </nav>

          {/* Right Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-6">{renderSection()}</div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {updateSettings.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </span>
                ) : autoSave ? (
                  <span className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-500" />
                    Auto-save enabled
                  </span>
                ) : isDirty ? (
                  <span className="text-amber-500">Unsaved changes</span>
                ) : (
                  <span>All changes saved</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleClose}>
                  {autoSave ? 'Close' : 'Cancel'}
                </Button>
                {!autoSave && (
                  <Button
                    onClick={handleSave}
                    disabled={!isDirty || updateSettings.isPending}
                  >
                    {updateSettings.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
