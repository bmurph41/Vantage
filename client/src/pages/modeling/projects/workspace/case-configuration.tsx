import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCaseLabels, type CaseType, type CaseLabels, DEFAULT_CASE_LABELS } from '@/hooks/useCaseLabels';
import type { ModelingProject } from '@shared/schema';
import {
  Save,
  RotateCcw,
  Settings2,
  Tag,
  TrendingUp,
  Percent,
  DollarSign,
  Target,
  Loader2,
  Check,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CaseConfigurationProps {
  projectId: string;
}

interface CaseSettings {
  label: string;
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  exitCapRate: number;
  occupancyRate: number;
  isEnabled: boolean;
}

type CaseSettingsMap = Record<CaseType, CaseSettings>;

const CASE_TYPES: CaseType[] = ['base', 'aggressive', 'conservative', 'custom'];

const DEFAULT_CASE_SETTINGS: CaseSettingsMap = {
  base: {
    label: 'Base Case',
    revenueGrowthRate: 3.0,
    expenseGrowthRate: 2.5,
    exitCapRate: 7.0,
    occupancyRate: 90,
    isEnabled: true,
  },
  aggressive: {
    label: 'Aggressive Case',
    revenueGrowthRate: 5.0,
    expenseGrowthRate: 2.0,
    exitCapRate: 6.5,
    occupancyRate: 95,
    isEnabled: true,
  },
  conservative: {
    label: 'Conservative Case',
    revenueGrowthRate: 1.5,
    expenseGrowthRate: 3.0,
    exitCapRate: 7.5,
    occupancyRate: 85,
    isEnabled: true,
  },
  custom: {
    label: 'Custom Case',
    revenueGrowthRate: 3.0,
    expenseGrowthRate: 2.5,
    exitCapRate: 7.0,
    occupancyRate: 90,
    isEnabled: false,
  },
};

export default function CaseConfiguration({ projectId }: CaseConfigurationProps) {
  const { toast } = useToast();
  const [activeCase, setActiveCase] = useState<CaseType>('base');
  const [caseSettings, setCaseSettings] = useState<CaseSettingsMap>(DEFAULT_CASE_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const { labels, getCaseColor, getCaseBorderColor, getCaseTextColor, getCaseBgColor } = useCaseLabels(project);

  useEffect(() => {
    if (project?.caseLabels) {
      const projectLabels = project.caseLabels as CaseLabels;
      setCaseSettings(prev => {
        const updated = { ...prev };
        CASE_TYPES.forEach(caseType => {
          if (projectLabels[caseType]) {
            updated[caseType] = {
              ...updated[caseType],
              label: projectLabels[caseType],
            };
          }
        });
        return updated;
      });
    }
  }, [project?.caseLabels]);

  const updateMutation = useMutation({
    mutationFn: async (data: { caseLabels: CaseLabels }) => {
      const response = await apiRequest('PATCH', `/api/modeling/projects/${projectId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      setHasChanges(false);
      toast({
        title: 'Configuration Saved',
        description: 'Case labels and settings have been updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save configuration.',
        variant: 'destructive',
      });
    },
  });

  const handleLabelChange = (caseType: CaseType, value: string) => {
    setCaseSettings(prev => ({
      ...prev,
      [caseType]: {
        ...prev[caseType],
        label: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSettingChange = (caseType: CaseType, field: keyof CaseSettings, value: number | boolean) => {
    setCaseSettings(prev => ({
      ...prev,
      [caseType]: {
        ...prev[caseType],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const caseLabels: CaseLabels = {
      base: caseSettings.base.label,
      aggressive: caseSettings.aggressive.label,
      conservative: caseSettings.conservative.label,
      custom: caseSettings.custom.label,
    };
    updateMutation.mutate({ caseLabels });
  };

  const handleReset = () => {
    setCaseSettings(prev => {
      const updated = { ...prev };
      CASE_TYPES.forEach(caseType => {
        updated[caseType] = {
          ...updated[caseType],
          label: DEFAULT_CASE_LABELS[caseType],
        };
      });
      return updated;
    });
    setHasChanges(true);
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentSettings = caseSettings[activeCase];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Case Configuration
          </h2>
          <p className="text-muted-foreground">
            Customize case names and default assumptions for your modeling scenarios.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={updateMutation.isPending}
            data-testid="button-reset-labels"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            data-testid="button-save-configuration"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            You have unsaved changes. Click "Save Changes" to apply them.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Case Types
            </CardTitle>
            <CardDescription>
              Select a case to configure
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1 p-2">
              {CASE_TYPES.map((caseType) => {
                const settings = caseSettings[caseType];
                const isActive = activeCase === caseType;
                
                return (
                  <button
                    key={caseType}
                    onClick={() => setActiveCase(caseType)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isActive 
                        ? `${getCaseBgColor(caseType)} ${getCaseBorderColor(caseType)} border-2` 
                        : 'hover:bg-muted'
                    }`}
                    data-testid={`button-select-case-${caseType}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getCaseColor(caseType)}`} />
                      <div className="text-left">
                        <div className="font-medium">{settings.label}</div>
                        <div className="text-xs text-muted-foreground capitalize">{caseType}</div>
                      </div>
                    </div>
                    {!settings.isEnabled && caseType === 'custom' && (
                      <Badge variant="outline" className="text-xs">Disabled</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className={`${getCaseBgColor(activeCase)} rounded-t-lg`}>
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${getCaseColor(activeCase)}`} />
              <div>
                <CardTitle className={getCaseTextColor(activeCase)}>
                  {currentSettings.label}
                </CardTitle>
                <CardDescription>
                  Configure the display name and default assumptions for this case
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="naming" className="space-y-6">
              <TabsList data-testid="tabs-case-settings">
                <TabsTrigger value="naming" className="gap-2" data-testid="tab-naming">
                  <Tag className="h-4 w-4" />
                  Naming
                </TabsTrigger>
                <TabsTrigger value="growth" className="gap-2" data-testid="tab-growth">
                  <TrendingUp className="h-4 w-4" />
                  Growth Rates
                </TabsTrigger>
                <TabsTrigger value="exit" className="gap-2" data-testid="tab-exit">
                  <Target className="h-4 w-4" />
                  Exit Assumptions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="naming" className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="case-label">Display Name</Label>
                    <Input
                      id="case-label"
                      value={currentSettings.label}
                      onChange={(e) => handleLabelChange(activeCase, e.target.value)}
                      placeholder={`Enter name for ${activeCase} case`}
                      data-testid={`input-case-label-${activeCase}`}
                    />
                    <p className="text-sm text-muted-foreground">
                      This name will be displayed throughout the modeling workspace.
                    </p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">System Identifier</Label>
                      <div className="p-3 bg-muted rounded-lg">
                        <code className="text-sm">{activeCase}</code>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Default Name</Label>
                      <div className="p-3 bg-muted rounded-lg">
                        <span className="text-sm">{DEFAULT_CASE_LABELS[activeCase]}</span>
                      </div>
                    </div>
                  </div>

                  {activeCase === 'custom' && (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="enable-custom">Enable Custom Case</Label>
                        <p className="text-sm text-muted-foreground">
                          Show this case in scenario comparisons and exports
                        </p>
                      </div>
                      <Switch
                        id="enable-custom"
                        checked={currentSettings.isEnabled}
                        onCheckedChange={(checked) => handleSettingChange(activeCase, 'isEnabled', checked)}
                        data-testid="switch-enable-custom"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="growth" className="space-y-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Revenue Growth Rate</Label>
                        <p className="text-sm text-muted-foreground">Annual revenue growth assumption</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={currentSettings.revenueGrowthRate}
                          onChange={(e) => handleSettingChange(activeCase, 'revenueGrowthRate', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right"
                          step="0.1"
                          data-testid={`input-revenue-growth-${activeCase}`}
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <Slider
                      value={[currentSettings.revenueGrowthRate]}
                      onValueChange={([value]) => handleSettingChange(activeCase, 'revenueGrowthRate', value)}
                      min={-5}
                      max={15}
                      step={0.1}
                      className="w-full"
                      data-testid={`slider-revenue-growth-${activeCase}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>-5%</span>
                      <span>0%</span>
                      <span>5%</span>
                      <span>10%</span>
                      <span>15%</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Expense Growth Rate</Label>
                        <p className="text-sm text-muted-foreground">Annual expense growth assumption</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={currentSettings.expenseGrowthRate}
                          onChange={(e) => handleSettingChange(activeCase, 'expenseGrowthRate', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right"
                          step="0.1"
                          data-testid={`input-expense-growth-${activeCase}`}
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <Slider
                      value={[currentSettings.expenseGrowthRate]}
                      onValueChange={([value]) => handleSettingChange(activeCase, 'expenseGrowthRate', value)}
                      min={0}
                      max={10}
                      step={0.1}
                      className="w-full"
                      data-testid={`slider-expense-growth-${activeCase}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>2.5%</span>
                      <span>5%</span>
                      <span>7.5%</span>
                      <span>10%</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Occupancy Rate</Label>
                        <p className="text-sm text-muted-foreground">Target occupancy assumption</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={currentSettings.occupancyRate}
                          onChange={(e) => handleSettingChange(activeCase, 'occupancyRate', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right"
                          step="1"
                          data-testid={`input-occupancy-${activeCase}`}
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <Slider
                      value={[currentSettings.occupancyRate]}
                      onValueChange={([value]) => handleSettingChange(activeCase, 'occupancyRate', value)}
                      min={50}
                      max={100}
                      step={1}
                      className="w-full"
                      data-testid={`slider-occupancy-${activeCase}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>50%</span>
                      <span>65%</span>
                      <span>80%</span>
                      <span>90%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="exit" className="space-y-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Exit Cap Rate</Label>
                        <p className="text-sm text-muted-foreground">Assumed cap rate at disposition</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={currentSettings.exitCapRate}
                          onChange={(e) => handleSettingChange(activeCase, 'exitCapRate', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right"
                          step="0.1"
                          data-testid={`input-exit-cap-${activeCase}`}
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <Slider
                      value={[currentSettings.exitCapRate]}
                      onValueChange={([value]) => handleSettingChange(activeCase, 'exitCapRate', value)}
                      min={4}
                      max={12}
                      step={0.1}
                      className="w-full"
                      data-testid={`slider-exit-cap-${activeCase}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>4%</span>
                      <span>6%</span>
                      <span>8%</span>
                      <span>10%</span>
                      <span>12%</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Cap Rate Guidelines
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Premium Markets</span>
                        <p className="font-medium">5.5% - 6.5%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Core Markets</span>
                        <p className="font-medium">6.5% - 7.5%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Secondary Markets</span>
                        <p className="font-medium">7.5% - 9.0%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Summary</CardTitle>
          <CardDescription>
            Quick overview of all case configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CASE_TYPES.map((caseType) => {
              const settings = caseSettings[caseType];
              if (caseType === 'custom' && !settings.isEnabled) return null;
              
              return (
                <div 
                  key={caseType}
                  className={`p-4 rounded-lg border-2 ${getCaseBorderColor(caseType)} ${getCaseBgColor(caseType)}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${getCaseColor(caseType)}`} />
                    <span className="font-medium">{settings.label}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue Growth</span>
                      <span className="font-medium">{settings.revenueGrowthRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expense Growth</span>
                      <span className="font-medium">{settings.expenseGrowthRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exit Cap Rate</span>
                      <span className="font-medium">{settings.exitCapRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Occupancy</span>
                      <span className="font-medium">{settings.occupancyRate.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
