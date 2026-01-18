import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, Users, TrendingUp, Calendar, Globe, Briefcase, Home, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { KpiConfigItem } from "@shared/schema";

interface KpiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageKey: string;
  currentConfig: KpiConfigItem[];
  availableMetrics: { value: string; label: string; icon: string; color: string }[];
}

const iconMap: Record<string, any> = {
  building: Building,
  users: Users,
  trendingUp: TrendingUp,
  calendar: Calendar,
  globe: Globe,
  briefcase: Briefcase,
  home: Home,
};

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-100", text: "text-blue-600" },
  purple: { bg: "bg-purple-100", text: "text-purple-600" },
  green: { bg: "bg-green-100", text: "text-green-600" },
  orange: { bg: "bg-orange-100", text: "text-orange-600" },
  red: { bg: "bg-red-100", text: "text-red-600" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-600" },
  teal: { bg: "bg-teal-100", text: "text-teal-600" },
};

export default function KpiSettingsModal({
  isOpen,
  onClose,
  pageKey,
  currentConfig,
  availableMetrics,
}: KpiSettingsModalProps) {
  const [config, setConfig] = useState<KpiConfigItem[]>(currentConfig);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setConfig(currentConfig);
  }, [currentConfig, isOpen]);

  const savePreferencesMutation = useMutation({
    mutationFn: async (kpiConfig: KpiConfigItem[]) => {
      return await apiRequest('PUT', `/api/user-preferences/kpis/${pageKey}`, { kpiConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-preferences/kpis', pageKey] });
      toast({
        title: "Settings saved",
        description: "Your KPI preferences have been updated.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save KPI preferences",
        variant: "destructive",
      });
    },
  });

  const updateKpi = (index: number, field: keyof KpiConfigItem, value: string) => {
    const newConfig = [...config];
    if (field === 'metricType') {
      const metric = availableMetrics.find(m => m.value === value);
      newConfig[index] = {
        ...newConfig[index],
        metricType: value as KpiConfigItem['metricType'],
        icon: metric?.icon || newConfig[index].icon,
        color: metric?.color || newConfig[index].color,
      };
    } else {
      newConfig[index] = { ...newConfig[index], [field]: value };
    }
    setConfig(newConfig);
  };

  const handleSave = () => {
    savePreferencesMutation.mutate(config);
  };

  const getIconPreview = (iconName: string | undefined, colorName: string | undefined) => {
    const IconComponent = iconMap[iconName || 'building'] || Building;
    const colors = colorMap[colorName || 'blue'] || colorMap.blue;
    return (
      <div className={`w-10 h-10 ${colors.bg} rounded-full flex items-center justify-center`}>
        <IconComponent className={`w-5 h-5 ${colors.text}`} />
      </div>
    );
  };

  return (
    <StandardDialogShell
      open={isOpen}
      onOpenChange={onClose}
      title="KPI Settings"
      description="Customize your dashboard KPI cards"
      icon={BarChart3}
      size="lg"
      primaryAction={{
        label: "Save Changes",
        onClick: handleSave,
        disabled: savePreferencesMutation.isPending,
        loading: savePreferencesMutation.isPending,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
      }}
    >
      <div className="space-y-6">
        {config.map((kpi, index) => (
          <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
            {getIconPreview(kpi.icon, kpi.color)}
            
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label htmlFor={`title-${index}`} className="text-sm text-gray-600">
                  Card Title
                </Label>
                <Input
                  id={`title-${index}`}
                  value={kpi.title}
                  onChange={(e) => updateKpi(index, 'title', e.target.value)}
                  placeholder="Enter title..."
                  className="h-9"
                  data-testid={`input-kpi-title-${index}`}
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor={`metric-${index}`} className="text-sm text-gray-600">
                  Metric Type
                </Label>
                <Select
                  value={kpi.metricType}
                  onValueChange={(value) => updateKpi(index, 'metricType', value)}
                >
                  <SelectTrigger className="h-9" data-testid={`select-kpi-metric-${index}`}>
                    <SelectValue placeholder="Select metric" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMetrics.map((metric) => (
                      <SelectItem key={metric.value} value={metric.value}>
                        {metric.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-sm text-gray-600">Color</Label>
                  <Select
                    value={kpi.color || 'blue'}
                    onValueChange={(value) => updateKpi(index, 'color', value)}
                  >
                    <SelectTrigger className="h-9" data-testid={`select-kpi-color-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                      <SelectItem value="teal">Teal</SelectItem>
                      <SelectItem value="indigo">Indigo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm text-gray-600">Icon</Label>
                  <Select
                    value={kpi.icon || 'building'}
                    onValueChange={(value) => updateKpi(index, 'icon', value)}
                  >
                    <SelectTrigger className="h-9" data-testid={`select-kpi-icon-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="building">Building</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="trendingUp">Trending Up</SelectItem>
                      <SelectItem value="briefcase">Briefcase</SelectItem>
                      <SelectItem value="calendar">Calendar</SelectItem>
                      <SelectItem value="globe">Globe</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </StandardDialogShell>
  );
}
