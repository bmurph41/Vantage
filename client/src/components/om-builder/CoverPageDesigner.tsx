import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Image,
  Upload,
  Eye,
  Palette,
} from 'lucide-react';

interface CoverPageConfig {
  propertyName: string;
  tagline: string;
  backgroundImageUrl: string | null;
  logoPlacement: 'top-left' | 'top-right' | 'center';
  colorTheme: string;
}

interface CoverPageDesignerProps {
  config: CoverPageConfig;
  onConfigChange: (config: CoverPageConfig) => void;
  logoUrl?: string | null;
}

const COLOR_THEMES = [
  { id: 'navy', label: 'Navy Professional', primary: '#1e3a5f', secondary: '#ffffff', accent: '#c9a96e' },
  { id: 'emerald', label: 'Emerald Modern', primary: '#065f46', secondary: '#ffffff', accent: '#34d399' },
  { id: 'slate', label: 'Slate Minimal', primary: '#1e293b', secondary: '#f8fafc', accent: '#3b82f6' },
  { id: 'burgundy', label: 'Burgundy Classic', primary: '#7f1d1d', secondary: '#fef2f2', accent: '#d4a574' },
  { id: 'ocean', label: 'Ocean Blue', primary: '#0c4a6e', secondary: '#f0f9ff', accent: '#38bdf8' },
] as const;

const LOGO_PLACEMENTS = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'center', label: 'Center' },
] as const;

export default function CoverPageDesigner({
  config: initialConfig,
  onConfigChange,
  logoUrl,
}: CoverPageDesignerProps) {
  const [config, setConfig] = useState<CoverPageConfig>(
    initialConfig || {
      propertyName: '',
      tagline: '',
      backgroundImageUrl: null,
      logoPlacement: 'top-left',
      colorTheme: 'navy',
    }
  );

  const updateConfig = (updates: Partial<CoverPageConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const theme = COLOR_THEMES.find((t) => t.id === config.colorTheme) || COLOR_THEMES[0];

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Controls */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cover Page Settings</CardTitle>
            <CardDescription>Configure the cover page for your offering memorandum</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Property Name</Label>
              <Input
                value={config.propertyName}
                onChange={(e) => updateConfig({ propertyName: e.target.value })}
                placeholder="e.g., Sunset Marina & Resort"
                className="text-lg font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label>Tagline / Subtitle</Label>
              <Input
                value={config.tagline}
                onChange={(e) => updateConfig({ tagline: e.target.value })}
                placeholder="e.g., Premier Waterfront Investment Opportunity"
              />
            </div>

            <div className="space-y-2">
              <Label>Background Image</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  const url = prompt('Enter image URL (placeholder for upload):');
                  if (url) updateConfig({ backgroundImageUrl: url });
                }}
              >
                {config.backgroundImageUrl ? (
                  <div className="space-y-2">
                    <Badge variant="secondary">Image set</Badge>
                    <p className="text-xs text-muted-foreground truncate">{config.backgroundImageUrl}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateConfig({ backgroundImageUrl: null });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload background image</p>
                    <p className="text-xs text-muted-foreground mt-1">Recommended: 1920x1080 or larger</p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logo Placement</Label>
              <Select
                value={config.logoPlacement}
                onValueChange={(v: CoverPageConfig['logoPlacement']) =>
                  updateConfig({ logoPlacement: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGO_PLACEMENTS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Color Theme
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {COLOR_THEMES.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      config.colorTheme === t.id
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-muted-foreground/20'
                    }`}
                    onClick={() => updateConfig({ colorTheme: t.id })}
                  >
                    <div className="flex gap-1">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: t.primary }} />
                      <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: t.secondary }} />
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: t.accent }} />
                    </div>
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          Cover Page Preview
        </div>
        <Card className="overflow-hidden">
          <div
            className="aspect-[8.5/11] relative flex flex-col"
            style={{
              backgroundColor: theme.primary,
              backgroundImage: config.backgroundImageUrl
                ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${config.backgroundImageUrl})`
                : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Logo */}
            <div
              className={`p-6 ${
                config.logoPlacement === 'top-left'
                  ? 'text-left'
                  : config.logoPlacement === 'top-right'
                  ? 'text-right'
                  : 'text-center'
              }`}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 inline-block" />
              ) : (
                <div
                  className="inline-block px-4 py-2 rounded text-xs font-semibold"
                  style={{ backgroundColor: theme.accent, color: theme.primary }}
                >
                  COMPANY LOGO
                </div>
              )}
            </div>

            {/* Title Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
              <div
                className="text-xs uppercase tracking-[0.3em] mb-4 font-medium"
                style={{ color: theme.accent }}
              >
                Offering Memorandum
              </div>
              <h1
                className="text-3xl font-bold mb-3 leading-tight"
                style={{ color: theme.secondary }}
              >
                {config.propertyName || 'Property Name'}
              </h1>
              {config.tagline && (
                <p
                  className="text-sm opacity-80 max-w-xs"
                  style={{ color: theme.secondary }}
                >
                  {config.tagline}
                </p>
              )}
              <div
                className="w-16 h-0.5 mt-6"
                style={{ backgroundColor: theme.accent }}
              />
            </div>

            {/* Footer */}
            <div
              className="p-6 text-center text-xs"
              style={{ color: theme.secondary, opacity: 0.6 }}
            >
              Confidential &bull; {new Date().getFullYear()}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
