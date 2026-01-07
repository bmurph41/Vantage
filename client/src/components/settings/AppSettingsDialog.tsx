import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Settings, BarChart3, TrendingUp, User, Bell, Palette, Shield, ExternalLink, Wrench, Calendar, Tag, Package, FileText, Bot, Webhook, GitMerge, Target, Upload, History } from "lucide-react";
import { Link } from "wouter";
import { ColumnCustomizer, type ColumnConfig } from "./ColumnCustomizer";
import { useColumnSettings } from "@/hooks/useColumnSettings";
import { useToast } from "@/hooks/use-toast";

interface AppSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
  moduleContext?: 'salesComps' | 'rateComps' | 'general';
}

export function AppSettingsDialog({ 
  open, 
  onOpenChange, 
  initialTab = 'general',
  moduleContext = 'general'
}: AppSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { toast } = useToast();
  
  const {
    salesCompsColumns,
    rateCompsColumns,
    updateSalesCompsColumns,
    updateRateCompsColumns,
    resetToDefaults,
  } = useColumnSettings();

  useEffect(() => {
    if (open && moduleContext !== 'general') {
      setActiveTab(moduleContext);
    } else if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab, moduleContext]);

  const handleSaveColumns = (module: 'salesComps' | 'rateComps', columns: ColumnConfig[]) => {
    if (module === 'salesComps') {
      updateSalesCompsColumns(columns);
    } else {
      updateRateCompsColumns(columns);
    }
    toast({
      title: "Columns saved",
      description: `Your ${module === 'salesComps' ? 'Sales Comps' : 'Rate Comps'} column preferences have been saved.`,
    });
  };

  const handleResetColumns = (module: 'salesComps' | 'rateComps') => {
    resetToDefaults(module);
    toast({
      title: "Columns reset",
      description: `${module === 'salesComps' ? 'Sales Comps' : 'Rate Comps'} columns have been reset to defaults.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            App Settings
          </DialogTitle>
          <DialogDescription>
            Configure your preferences and customize your experience
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 min-h-0">
          <div className="w-48 border-r bg-muted/30 p-2 flex-shrink-0">
            <TabsList className="flex flex-col h-auto bg-transparent space-y-1 w-full">
              <TabsTrigger 
                value="general" 
                className="w-full justify-start gap-2 data-[state=active]:bg-background"
                data-testid="settings-tab-general"
              >
                <User className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger 
                value="salesComps" 
                className="w-full justify-start gap-2 data-[state=active]:bg-background"
                data-testid="settings-tab-sales-comps"
              >
                <BarChart3 className="h-4 w-4" />
                Sales Comps
              </TabsTrigger>
              <TabsTrigger 
                value="rateComps" 
                className="w-full justify-start gap-2 data-[state=active]:bg-background"
                data-testid="settings-tab-rate-comps"
              >
                <TrendingUp className="h-4 w-4" />
                Rate Comps
              </TabsTrigger>
              <Separator className="my-2" />
              <TabsTrigger 
                value="notifications" 
                className="w-full justify-start gap-2 data-[state=active]:bg-background"
                data-testid="settings-tab-notifications"
              >
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="display" 
                className="w-full justify-start gap-2 data-[state=active]:bg-background"
                data-testid="settings-tab-display"
              >
                <Palette className="h-4 w-4" />
                Display
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="w-full justify-start gap-2 data-[state=active]:bg-background"
                data-testid="settings-tab-security"
              >
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
              <Separator className="my-2" />
              <TabsTrigger 
                value="tools" 
                className="w-full justify-start gap-2 data-[state=active]:bg-background"
                data-testid="settings-tab-tools"
              >
                <Wrench className="h-4 w-4" />
                Tools & Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            <TabsContent value="general" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">General Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-save changes</Label>
                      <p className="text-sm text-muted-foreground">Automatically save changes as you work</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-autosave" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show confirmation dialogs</Label>
                      <p className="text-sm text-muted-foreground">Ask for confirmation before deleting items</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-confirm-delete" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="salesComps" className="mt-0 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Sales Comps Columns</h3>
                    <p className="text-sm text-muted-foreground">Customize which columns appear and their order</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleResetColumns('salesComps')}
                    data-testid="button-reset-sales-columns"
                  >
                    Reset to Defaults
                  </Button>
                </div>
                <ColumnCustomizer
                  columns={salesCompsColumns}
                  onColumnsChange={(cols) => handleSaveColumns('salesComps', cols)}
                  moduleType="salesComps"
                />
              </div>
            </TabsContent>

            <TabsContent value="rateComps" className="mt-0 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Rate Comps Columns</h3>
                    <p className="text-sm text-muted-foreground">Customize which columns appear and their order</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleResetColumns('rateComps')}
                    data-testid="button-reset-rate-columns"
                  >
                    Reset to Defaults
                  </Button>
                </div>
                <ColumnCustomizer
                  columns={rateCompsColumns}
                  onColumnsChange={(cols) => handleSaveColumns('rateComps', cols)}
                  moduleType="rateComps"
                />
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive email alerts for important updates</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-email-notifications" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>In-app notifications</Label>
                      <p className="text-sm text-muted-foreground">Show notifications within the app</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-in-app-notifications" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="display" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Display Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Compact mode</Label>
                      <p className="text-sm text-muted-foreground">Use smaller row heights in tables</p>
                    </div>
                    <Switch data-testid="switch-compact-mode" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show grid lines</Label>
                      <p className="text-sm text-muted-foreground">Display grid lines in data tables</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-grid-lines" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Account Security</h3>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Manage your two-factor authentication, active sessions, and security preferences.
                  </p>
                  <Link 
                    href="/security"
                    onClick={() => onOpenChange(false)}
                    className="inline-flex"
                  >
                    <Button variant="outline" className="gap-2" data-testid="button-open-security-settings">
                      <Shield className="h-4 w-4" />
                      Open Security Settings
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tools" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Tools & Settings</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Access CRM tools for managing workflows, imports, and system configurations.
                </p>
                <div className="grid gap-3">
                  <Link 
                    href="/calendar-settings"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-calendar-sync"
                  >
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Calendar Sync</div>
                      <div className="text-sm text-muted-foreground">Connect and sync your calendars</div>
                    </div>
                  </Link>
                  <Link 
                    href="/crm/labels"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-labels"
                  >
                    <Tag className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Labels</div>
                      <div className="text-sm text-muted-foreground">Manage custom labels and tags</div>
                    </div>
                  </Link>
                  <Link 
                    href="/crm/products"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-products"
                  >
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Products</div>
                      <div className="text-sm text-muted-foreground">Manage product catalog</div>
                    </div>
                  </Link>
                  <Link 
                    href="/crm/forms"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-forms"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Forms</div>
                      <div className="text-sm text-muted-foreground">Create and manage web forms</div>
                    </div>
                  </Link>
                  <Link 
                    href="/crm/workflows"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-workflows"
                  >
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Workflows</div>
                      <div className="text-sm text-muted-foreground">Automate tasks and processes</div>
                    </div>
                  </Link>
                  <Link 
                    href="/crm/webhooks"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-webhooks"
                  >
                    <Webhook className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Webhooks</div>
                      <div className="text-sm text-muted-foreground">Configure webhook integrations</div>
                    </div>
                  </Link>
                  <Link 
                    href="/crm/dedupe"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-dedupe"
                  >
                    <GitMerge className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Dedupe & Merge</div>
                      <div className="text-sm text-muted-foreground">Find and merge duplicate records</div>
                    </div>
                  </Link>
                  <Link 
                    href="/crm/scoring"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-scoring"
                  >
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Scoring</div>
                      <div className="text-sm text-muted-foreground">Configure lead and deal scoring</div>
                    </div>
                  </Link>
                  <Separator className="my-2" />
                  <Link 
                    href="/import-contacts"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-import-contacts"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Import Contacts</div>
                      <div className="text-sm text-muted-foreground">Import contacts from CSV or other sources</div>
                    </div>
                  </Link>
                  <Link 
                    href="/import-history"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid="link-import-history"
                  >
                    <History className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Import History</div>
                      <div className="text-sm text-muted-foreground">View past import operations</div>
                    </div>
                  </Link>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
