import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useOmEditorStore } from '@/stores/om-editor-store';

interface BindingField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'percent' | 'date';
  example?: string;
}

interface BindingCategory {
  category: string;
  fields: BindingField[];
}

interface OmDataBindingsPanelProps {
  omId: string | null;
}

export function OmDataBindingsPanel({ omId }: OmDataBindingsPanelProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>(['project', 'financials']);
  const { selectedBlockIds, blocks, updateBlock } = useOmEditorStore();

  const { data: bindingsCatalog = [], isLoading } = useQuery<BindingCategory[]>({
    queryKey: ['/api/om-builder/bindings/catalog'],
  });

  const handleCopyBinding = async (key: string) => {
    const bindingExpr = `{{${key}}}`;
    await navigator.clipboard.writeText(bindingExpr);
    setCopiedKey(key);
    toast({ title: 'Copied', description: `Binding expression copied: ${bindingExpr}` });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleApplyBinding = (key: string) => {
    if (selectedBlockIds.length !== 1) {
      toast({ 
        title: 'Select a block', 
        description: 'Select exactly one text block to apply binding', 
        variant: 'destructive' 
      });
      return;
    }

    const blockId = selectedBlockIds[0];
    const block = blocks.find(b => b.id === blockId);
    
    if (!block || block.data.type !== 'text') {
      toast({ 
        title: 'Invalid selection', 
        description: 'Bindings can only be applied to text blocks', 
        variant: 'destructive' 
      });
      return;
    }

    updateBlock(blockId, {
      data: {
        ...block.data,
        binding: key,
        content: `{{${key}}}`,
      },
    });
    toast({ title: 'Binding applied', description: `Block now bound to ${key}` });
  };

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const filteredCatalog = bindingsCatalog.map(cat => ({
    ...cat,
    fields: cat.fields.filter(f => 
      f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.key.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(cat => cat.fields.length > 0);

  const formatExample = (field: BindingField) => {
    if (field.example) return field.example;
    switch (field.type) {
      case 'currency': return '$1,250,000';
      case 'percent': return '7.5%';
      case 'number': return '42';
      case 'date': return '2024-01-15';
      default: return 'Example text';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Data Bindings</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Bind text blocks to project data for dynamic content
        </p>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search fields..."
          className="text-xs h-8"
          data-testid="input-search-bindings"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading bindings...</div>
          ) : filteredCatalog.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              {searchQuery ? 'No matching fields' : 'No bindings available'}
            </div>
          ) : (
            filteredCatalog.map((cat) => (
              <Collapsible
                key={cat.category}
                open={openCategories.includes(cat.category)}
                onOpenChange={() => toggleCategory(cat.category)}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded text-sm font-medium">
                  <ChevronRight 
                    className={`h-4 w-4 transition-transform ${
                      openCategories.includes(cat.category) ? 'rotate-90' : ''
                    }`} 
                  />
                  {cat.category}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {cat.fields.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 space-y-1">
                    {cat.fields.map((field) => (
                      <div
                        key={field.key}
                        className="flex items-center justify-between p-2 border rounded hover:border-primary cursor-pointer group"
                        data-testid={`binding-${field.key}`}
                      >
                        <div className="flex-1 min-w-0" onClick={() => handleApplyBinding(field.key)}>
                          <p className="text-xs font-medium truncate">{field.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {formatExample(field)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyBinding(field.key);
                          }}
                        >
                          {copiedKey === field.key ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-muted/30">
        <p className="text-[10px] text-muted-foreground">
          Click a field to bind to selected text block, or copy the binding expression.
        </p>
      </div>
    </div>
  );
}
