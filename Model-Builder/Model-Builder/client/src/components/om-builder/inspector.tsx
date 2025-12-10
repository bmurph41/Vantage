import React from 'react';
import { OmBlock, OmPage } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings2, Wand2, Trash2, Layout, Columns } from "lucide-react";
import { DataBindingPanel } from "./data-binding-panel";
import { PageLayoutInspector } from "./page-layout-inspector"; // Import new component

interface InspectorProps {
  block?: OmBlock;
  page?: OmPage;
  onUpdateBlock: (updates: Partial<OmBlock>) => void;
  onUpdatePage: (updates: Partial<OmPage>) => void;
  onDeleteBlock?: () => void;
  onAiRefine?: (content: string) => void;
}

export function Inspector({ block, page, onUpdateBlock, onUpdatePage, onDeleteBlock, onAiRefine }: InspectorProps) {
  if (!page) return <div className="p-6 text-center text-muted-foreground text-sm">No selection</div>;

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Settings2 className="w-4 h-4 text-muted-foreground" />
           <span className="font-medium text-sm">
             {block ? `${capitalize(block.type)} Block` : "Page Settings"}
           </span>
        </div>
        {block && onDeleteBlock && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDeleteBlock}
              data-testid="button-delete-block"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-6">
        {block ? (
          <BlockInspector block={block} onUpdate={onUpdateBlock} onAiRefine={onAiRefine} />
        ) : (
          <PageInspector page={page} onUpdate={onUpdatePage} />
        )}
      </ScrollArea>
    </div>
  );
}

function PageInspector({ page, onUpdate }: { page: OmPage, onUpdate: (u: Partial<OmPage>) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Page Title</Label>
        <Input 
          value={page.title} 
          onChange={(e) => onUpdate({ title: e.target.value })} 
        />
      </div>
      
      <Separator />
      
      {/* New Layout Inspector */}
      <PageLayoutInspector 
        page={page} 
        onUpdate={(layoutConfig) => onUpdate({ layout: layoutConfig })} 
      />

      <Separator />

      <div className="space-y-3">
         <Label className="text-sm font-medium">Margins</Label>
         <div className="grid grid-cols-2 gap-3">
             <div className="flex items-center gap-2">
                 <span className="text-xs text-muted-foreground w-4">X</span>
                 <Input defaultValue="60px" />
             </div>
             <div className="flex items-center gap-2">
                 <span className="text-xs text-muted-foreground w-4">Y</span>
                 <Input defaultValue="60px" />
             </div>
         </div>
      </div>
    </div>
  );
}

function BlockInspector({ block, onUpdate, onAiRefine }: { block: OmBlock, onUpdate: (u: Partial<OmBlock>) => void, onAiRefine?: (content: string) => void }) {
  return (
    <div className="space-y-6">
      
      {/* Layout / Column Control - New for Phase 3 */}
      <div className="space-y-3">
         <div className="flex items-center gap-2">
            <Columns className="w-4 h-4 text-muted-foreground" />
            <Label>Position</Label>
         </div>
         <Select 
            value={block.style?.column || 'auto'} 
            onValueChange={(val) => onUpdate({ style: { ...block.style, column: val as any } })}
         >
            <SelectTrigger>
                <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="auto">Auto Flow</SelectItem>
                <SelectItem value="full">Full Width</SelectItem>
                <SelectItem value="left">Left Column</SelectItem>
                <SelectItem value="right">Right Column</SelectItem>
            </SelectContent>
         </Select>
      </div>

      <Separator />

      {/* Content Editor based on Type */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Content</Label>
            {block.type === 'text' && onAiRefine && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-1"
                  onClick={() => onAiRefine(block.content.markdown || '')}
                  data-testid="button-ai-refine"
                >
                    <Wand2 className="w-3 h-3" /> AI Refine
                </Button>
            )}
        </div>

        {block.type === 'text' && (
          <Textarea 
            className="min-h-[200px] font-mono text-sm leading-relaxed" 
            value={block.content.markdown}
            onChange={(e) => onUpdate({ content: { ...block.content, markdown: e.target.value } })} 
          />
        )}
        
        {/* ... (Existing KPI/Chart editors remain same) ... */}
         {block.type === 'kpi' && (
          <div className="space-y-4">
             {block.content.items?.map((item: any, idx: number) => (
                 <div key={idx} className="p-4 border border-border rounded-xl space-y-3 bg-muted/30">
                     <Input 
                        placeholder="Label" 
                        value={item.label} 
                        onChange={(e) => {
                            const newItems = [...block.content.items];
                            newItems[idx].label = e.target.value;
                            onUpdate({ content: { ...block.content, items: newItems } });
                        }}
                     />
                     <Input 
                        placeholder="Value" 
                        value={item.value} 
                        className="font-mono tabular-nums"
                        onChange={(e) => {
                            const newItems = [...block.content.items];
                            newItems[idx].value = e.target.value;
                            onUpdate({ content: { ...block.content, items: newItems } });
                        }}
                        disabled={block.dataBinding?.sourceType && block.dataBinding.sourceType !== 'manual'}
                     />
                 </div>
             ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Data Binding Section */}
      <DataBindingPanel 
        block={block} 
        projectId="proj_1" 
        onUpdateBinding={(binding) => onUpdate({ dataBinding: binding })} 
      />

    </div>
  );
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
