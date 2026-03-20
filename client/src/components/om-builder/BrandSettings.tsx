import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Palette,
  Upload,
  Save,
  Building2,
  Type,
  Eye,
} from 'lucide-react';

interface BrandSettingsData {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl: string | null;
  companyName: string;
}

const FONT_OPTIONS = [
  { value: 'serif', label: 'Serif (Georgia)', preview: 'Georgia, serif' },
  { value: 'sans-serif', label: 'Sans-Serif (Helvetica)', preview: 'Helvetica, Arial, sans-serif' },
  { value: 'modern', label: 'Modern (Inter)', preview: '"Inter", system-ui, sans-serif' },
  { value: 'classic', label: 'Classic (Garamond)', preview: 'Garamond, "Times New Roman", serif' },
] as const;

const DEFAULT_SETTINGS: BrandSettingsData = {
  primaryColor: '#1e3a5f',
  secondaryColor: '#c9a96e',
  fontFamily: 'sans-serif',
  logoUrl: null,
  companyName: '',
};

export default function BrandSettings() {
  const { toast } = useToast();

  const { data: savedSettings, isLoading } = useQuery<BrandSettingsData>({
    queryKey: ['/api/om-builder/brand-settings'],
  });

  const [settings, setSettings] = useState<BrandSettingsData>(
    savedSettings || DEFAULT_SETTINGS
  );

  // Sync from fetched data
  useState(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: BrandSettingsData) => {
      return apiRequest('PUT', '/api/om-builder/brand-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om-builder/brand-settings'] });
      toast({
        title: 'Brand Settings Saved',
        description: 'Your brand settings have been updated and will apply to all OMs.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save brand settings.',
        variant: 'destructive',
      });
    },
  });

  const updateSettings = (updates: Partial<BrandSettingsData>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const fontOption = FONT_OPTIONS.find((f) => f.value === settings.fontFamily) || FONT_OPTIONS[1];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Settings
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure your brand identity for all generated OMs
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Settings Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Name
                </Label>
                <Input
                  value={settings.companyName}
                  onChange={(e) => updateSettings({ companyName: e.target.value })}
                  placeholder="Your Company Name"
                />
              </div>

              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => {
                    const url = prompt('Enter logo URL (placeholder for upload):');
                    if (url) updateSettings({ logoUrl: url });
                  }}
                >
                  {settings.logoUrl ? (
                    <div className="space-y-2">
                      <img
                        src={settings.logoUrl}
                        alt="Logo preview"
                        className="h-12 mx-auto object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <Badge variant="secondary">Logo uploaded</Badge>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSettings({ logoUrl: null });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload logo</p>
                      <p className="text-xs text-muted-foreground">PNG, SVG, or JPG. Max 2MB.</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Colors & Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => updateSettings({ primaryColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) => updateSettings({ primaryColor: e.target.value })}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => updateSettings({ secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) => updateSettings({ secondaryColor: e.target.value })}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Font Family
                </Label>
                <Select
                  value={settings.fontFamily}
                  onValueChange={(v) => updateSettings({ fontFamily: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: f.preview }}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            Brand Preview
          </div>
          <Card className="overflow-hidden">
            <div
              className="p-8 min-h-[400px]"
              style={{ fontFamily: fontOption.preview }}
            >
              {/* Preview Header */}
              <div
                className="p-4 rounded-lg mb-6 flex items-center justify-between"
                style={{ backgroundColor: settings.primaryColor }}
              >
                <div className="text-white">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="h-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="font-bold text-lg">
                      {settings.companyName || 'Company Name'}
                    </span>
                  )}
                </div>
                <div
                  className="px-3 py-1 rounded text-xs font-semibold"
                  style={{ backgroundColor: settings.secondaryColor, color: settings.primaryColor }}
                >
                  CONFIDENTIAL
                </div>
              </div>

              {/* Preview Content */}
              <div className="space-y-4">
                <h2
                  className="text-2xl font-bold"
                  style={{ color: settings.primaryColor }}
                >
                  Offering Memorandum
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  This is a preview of how your documents will look with the selected
                  brand settings. The font, colors, and logo will be applied
                  consistently across all generated materials.
                </p>
                <div
                  className="h-1 w-24 rounded"
                  style={{ backgroundColor: settings.secondaryColor }}
                />
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div
                    className="p-4 rounded-lg border"
                    style={{ borderColor: settings.primaryColor + '30' }}
                  >
                    <div
                      className="text-xs uppercase font-semibold mb-1"
                      style={{ color: settings.secondaryColor }}
                    >
                      Purchase Price
                    </div>
                    <div className="text-xl font-bold" style={{ color: settings.primaryColor }}>
                      $12,500,000
                    </div>
                  </div>
                  <div
                    className="p-4 rounded-lg border"
                    style={{ borderColor: settings.primaryColor + '30' }}
                  >
                    <div
                      className="text-xs uppercase font-semibold mb-1"
                      style={{ color: settings.secondaryColor }}
                    >
                      Cap Rate
                    </div>
                    <div className="text-xl font-bold" style={{ color: settings.primaryColor }}>
                      7.25%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
