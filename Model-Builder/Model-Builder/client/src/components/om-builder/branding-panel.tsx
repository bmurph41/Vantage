import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OmTheme } from "@/lib/types";
import { UploadCloud, Check, Loader2, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface BrandingPanelProps {
  currentTheme?: OmTheme;
  onThemeSelect: (theme: OmTheme) => void;
}

const defaultThemes: OmTheme[] = [
  {
    id: 'theme_default',
    name: 'Sunset Default',
    colors: {
      primary: '#1e293b', // Slate 800
      secondary: '#f1f5f9', // Slate 100
      accent: '#3b82f6', // Blue 500
      background: '#ffffff',
      text: '#0f172a'
    },
    typography: { headingFont: 'font-serif', bodyFont: 'font-sans' },
    spacing: { blockGap: '24px', pagePadding: '60px' }
  },
  {
    id: 'theme_modern',
    name: 'Modern Clean',
    colors: {
      primary: '#000000',
      secondary: '#f4f4f5',
      accent: '#10b981', // Emerald
      background: '#ffffff',
      text: '#18181b'
    },
    typography: { headingFont: 'font-sans', bodyFont: 'font-sans' },
    spacing: { blockGap: '32px', pagePadding: '48px' }
  },
  {
    id: 'theme_classic',
    name: 'Classic Navy',
    colors: {
      primary: '#172554', // Blue 950
      secondary: '#eff6ff', // Blue 50
      accent: '#c2410c', // Orange 700
      background: '#ffffff',
      text: '#1e3a8a'
    },
    typography: { headingFont: 'font-serif', bodyFont: 'font-serif' },
    spacing: { blockGap: '20px', pagePadding: '72px' }
  }
];

export function BrandingPanel({ currentTheme, onThemeSelect }: BrandingPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [customThemes, setCustomThemes] = useState<OmTheme[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    // Simulate AI Processing
    setTimeout(() => {
      setIsUploading(false);
      
      const newTheme: OmTheme = {
        id: `theme_extracted_${Date.now()}`,
        name: `Extracted from ${file.name.substring(0, 10)}...`,
        colors: {
          primary: '#4338ca', // Indigo
          secondary: '#e0e7ff',
          accent: '#f59e0b', // Amber
          background: '#ffffff',
          text: '#312e81'
        },
        typography: { headingFont: 'font-serif', bodyFont: 'font-sans' },
        spacing: { blockGap: '28px', pagePadding: '50px' }
      };

      setCustomThemes([...customThemes, newTheme]);
      onThemeSelect(newTheme);
      
      toast({
        title: "Style Extracted Successfully",
        description: `We've analyzed "${file.name}" and created a matching theme.`,
      });
    }, 2500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border bg-sidebar-accent/5">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-sidebar-border rounded-lg cursor-pointer hover:bg-sidebar-accent/10 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            {isUploading ? (
              <>
                 <Loader2 className="w-8 h-8 mb-2 text-primary animate-spin" />
                 <p className="text-sm text-muted-foreground">Analyzing styles...</p>
              </>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Upload Past OM</p>
                <p className="text-xs text-muted-foreground mt-1">PDF or DOCX</p>
              </>
            )}
          </div>
          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileUpload} disabled={isUploading} />
        </label>
        <p className="text-[10px] text-muted-foreground mt-2 text-center px-2">
          AI will extract fonts, colors, and layout density from your documents.
        </p>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
          
          {customThemes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wider">Extracted Themes</h3>
              <div className="space-y-2">
                {customThemes.map(theme => (
                  <ThemeCard 
                    key={theme.id} 
                    theme={theme} 
                    isActive={currentTheme?.id === theme.id} 
                    onClick={() => onThemeSelect(theme)} 
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wider">System Themes</h3>
            <div className="space-y-2">
              {defaultThemes.map(theme => (
                <ThemeCard 
                  key={theme.id} 
                  theme={theme} 
                  isActive={currentTheme?.id === theme.id} 
                  onClick={() => onThemeSelect(theme)} 
                />
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}

function ThemeCard({ theme, isActive, onClick }: { theme: OmTheme, isActive: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
        isActive 
          ? "border-primary bg-primary/5 ring-1 ring-primary" 
          : "border-border hover:border-primary/50 hover:bg-accent/50"
      )}
    >
      <div className="w-8 h-8 rounded-full border shadow-sm shrink-0 grid grid-cols-2 overflow-hidden">
        <div style={{ backgroundColor: theme.colors.primary }} />
        <div style={{ backgroundColor: theme.colors.secondary }} />
        <div style={{ backgroundColor: theme.colors.accent }} />
        <div style={{ backgroundColor: theme.colors.background }} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate">{theme.name}</h4>
        <p className="text-xs text-muted-foreground truncate">{theme.typography.headingFont === 'font-serif' ? 'Serif' : 'Sans'} + {theme.typography.bodyFont === 'font-sans' ? 'Sans' : 'Serif'}</p>
      </div>
      {isActive && <Check className="w-4 h-4 text-primary" />}
    </div>
  );
}
