import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Settings, BarChart3, TrendingUp, Anchor, User, Bell, Palette } from "lucide-react";
import { ColumnCustomizer, type ColumnConfig } from "./ColumnCustomizer";
import { useColumnSettings } from "@/hooks/useColumnSettings";
import { useToast } from "@/hooks/use-toast";

interface AppSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
  moduleContext?: 'salesComps' | 'rateComps' | 'marinaDatabase' | 'general';
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
              <TabsTrigger 
                value="marinaDatabase" 
                className="w-full justify-start gap-2 data-[state=active]:bg-background"
                data-testid="settings-tab-marina-db"
              >
                <Anchor className="h-4 w-4" />
                Marina Database
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

            <TabsContent value="marinaDatabase" className="mt-0 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Marina Database Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-link marinas</Label>
                      <p className="text-sm text-muted-foreground">Automatically suggest marina matches when adding comps</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-auto-link" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show data sources</Label>
                      <p className="text-sm text-muted-foreground">Display source indicators for cross-referenced data</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-show-sources" />
                  </div>
                </div>
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
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
