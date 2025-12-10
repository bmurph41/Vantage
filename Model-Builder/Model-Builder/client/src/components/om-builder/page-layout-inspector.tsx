import React from 'react';
import { OmPage, OmPageLayoutConfig, OmPageLayoutType } from "@/lib/types"; // Import new types
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Layout, Columns, Image as ImageIcon, CreditCard, Grid3X3 } from "lucide-react";

interface PageLayoutInspectorProps {
  page: OmPage;
  onUpdate: (layoutConfig: OmPageLayoutConfig) => void;
}

export function PageLayoutInspector({ page, onUpdate }: PageLayoutInspectorProps) {
  const layout = page.layout || { layoutType: 'single-column' };

  const handleUpdate = (updates: Partial<OmPageLayoutConfig>) => {
    onUpdate({ ...layout, ...updates });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
           <Layout className="w-4 h-4 text-muted-foreground" />
           <Label>Layout Type</Label>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <LayoutTypeCard 
                active={layout.layoutType === 'single-column'} 
                type="single-column" 
                label="Single Column"
                icon={CreditCard}
                onClick={() => handleUpdate({ layoutType: 'single-column' })} 
            />
            <LayoutTypeCard 
                active={layout.layoutType === 'two-column'} 
                type="two-column" 
                label="Two Columns"
                icon={Columns}
                onClick={() => handleUpdate({ layoutType: 'two-column' })} 
            />
            <LayoutTypeCard 
                active={layout.layoutType === 'freeform'} 
                type="freeform" 
                label="Freeform Grid"
                icon={Grid3X3}
                onClick={() => handleUpdate({ layoutType: 'freeform' })} 
            />
            <LayoutTypeCard 
                active={layout.layoutType === 'cover'} 
                type="cover" 
                label="Cover Page"
                icon={ImageIcon}
                onClick={() => handleUpdate({ layoutType: 'cover' })} 
            />
            <LayoutTypeCard 
                active={layout.layoutType === 'hero-with-body'} 
                type="hero-with-body" 
                label="Hero Header"
                icon={Layout}
                onClick={() => handleUpdate({ layoutType: 'hero-with-body' })} 
            />
        </div>
      </div>

      <Separator />

      {layout.layoutType === 'two-column' && (
          <div className="space-y-4">
              <div className="flex items-center justify-between">
                  <Label>Column Split</Label>
                  <span className="text-xs text-muted-foreground">
                      {layout.columns?.leftWidthPercent || 50}% / {layout.columns?.rightWidthPercent || 50}%
                  </span>
              </div>
              <Slider 
                  defaultValue={[layout.columns?.leftWidthPercent || 50]} 
                  max={80} 
                  min={20} 
                  step={5}
                  onValueChange={(val) => handleUpdate({ 
                      columns: { leftWidthPercent: val[0], rightWidthPercent: 100 - val[0] } 
                  })}
              />
          </div>
      )}

      {(layout.layoutType === 'cover' || layout.layoutType === 'hero-with-body') && (
          <div className="space-y-4">
              <div className="space-y-2">
                  <Label>Hero Image URL</Label>
                  <Input 
                      value={layout.heroImageUrl || ''} 
                      placeholder="https://..." 
                      onChange={(e) => handleUpdate({ heroImageUrl: e.target.value })}
                  />
              </div>
              <div className="flex items-center justify-between">
                  <Label>Dark Overlay</Label>
                  <Switch 
                      checked={layout.heroOverlay} 
                      onCheckedChange={(checked) => handleUpdate({ heroOverlay: checked })} 
                  />
              </div>
          </div>
      )}

      <Separator />

      <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page Elements</Label>
          
          <div className="flex items-center justify-between">
              <Label className="font-normal">Show Header</Label>
              <Switch 
                  checked={layout.showHeader !== false} 
                  onCheckedChange={(checked) => handleUpdate({ showHeader: checked })} 
              />
          </div>
          <div className="flex items-center justify-between">
              <Label className="font-normal">Show Footer</Label>
              <Switch 
                  checked={layout.showFooter !== false} 
                  onCheckedChange={(checked) => handleUpdate({ showFooter: checked })} 
              />
          </div>
          <div className="flex items-center justify-between">
              <Label className="font-normal">Show Page Number</Label>
              <Switch 
                  checked={layout.showPageNumber !== false} 
                  onCheckedChange={(checked) => handleUpdate({ showPageNumber: checked })} 
              />
          </div>
          <div className="flex items-center justify-between">
              <Label className="font-normal">Include in TOC</Label>
              <Switch 
                  checked={layout.showTocEntry} 
                  onCheckedChange={(checked) => handleUpdate({ showTocEntry: checked })} 
              />
          </div>
      </div>
    </div>
  );
}

function LayoutTypeCard({ active, type, label, icon: Icon, onClick }: any) {
    return (
        <div 
            onClick={onClick}
            className={`
                border rounded-md p-3 cursor-pointer transition-all flex flex-col items-center gap-2 text-center
                ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}
            `}
        >
            <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-xs font-medium">{label}</span>
        </div>
    )
}
