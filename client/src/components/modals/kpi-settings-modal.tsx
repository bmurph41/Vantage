import { useState, useEffect, type ComponentType } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MMModal, MMInput, MMSelect } from "@/components/mm-ui";
import { Building, Users, TrendingUp, Calendar, Globe, Briefcase, Home, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { KpiConfigItem } from "@shared/schema";

interface KpiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageKey: string;
  currentConfig: KpiConfigItem[];
  availableMetrics: { value: string; label: string; icon: string; color: string }[];
}

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
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

  const colorOptions = [
    { value: 'blue', label: 'Blue' },
    { value: 'purple', label: 'Purple' },
    { value: 'green', label: 'Green' },
    { value: 'orange', label: 'Orange' },
    { value: 'teal', label: 'Teal' },
    { value: 'indigo', label: 'Indigo' },
  ];

  const iconOptions = [
    { value: 'building', label: 'Building' },
    { value: 'users', label: 'Users' },
    { value: 'trendingUp', label: 'Trending Up' },
    { value: 'briefcase', label: 'Briefcase' },
    { value: 'calendar', label: 'Calendar' },
    { value: 'globe', label: 'Globe' },
    { value: 'home', label: 'Home' },
  ];

  return (
    <MMModal
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="KPI Settings"
      subtitle="Customize your dashboard KPI cards"
      icon={<BarChart3 className="h-5 w-5" />}
      maxWidth="lg"
      footerLeft={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
      footerRight={
        <Button 
          onClick={handleSave}
          disabled={savePreferencesMutation.isPending}
        >
          {savePreferencesMutation.isPending ? "Saving..." : "Save"}
        </Button>
      }
    >
      <div className="space-y-6">
        {config.map((kpi, index) => (
          <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
            {getIconPreview(kpi.icon, kpi.color)}
            
            <div className="flex-1 space-y-3">
              <MMInput
                label="Card Title"
                value={kpi.title}
                onChange={(e) => updateKpi(index, 'title', e.target.value)}
                placeholder="Enter title..."
                data-testid={`input-kpi-title-${index}`}
              />
              
              <MMSelect
                label="Metric Type"
                value={kpi.metricType}
                onChange={(value) => updateKpi(index, 'metricType', value)}
                options={availableMetrics.map(m => ({ value: m.value, label: m.label }))}
                placeholder="Select metric"
                data-testid={`select-kpi-metric-${index}`}
              />

              <div className="grid grid-cols-2 gap-3">
                <MMSelect
                  label="Color"
                  value={kpi.color || 'blue'}
                  onChange={(value) => updateKpi(index, 'color', value)}
                  options={colorOptions}
                  data-testid={`select-kpi-color-${index}`}
                />
                <MMSelect
                  label="Icon"
                  value={kpi.icon || 'building'}
                  onChange={(value) => updateKpi(index, 'icon', value)}
                  options={iconOptions}
                  data-testid={`select-kpi-icon-${index}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </MMModal>
  );
}
