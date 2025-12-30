import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Wand2, Copy, Check, Loader2, FileText, Building2, TrendingUp, MapPin, DollarSign, AlertTriangle, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AIContentGeneratorProps {
  open: boolean;
  onClose: () => void;
  onInsert: (content: string) => void;
  initialContext?: PropertyContext;
}

interface PropertyContext {
  propertyName?: string;
  propertyType?: string;
  location?: string;
  size?: string;
  yearBuilt?: string;
  occupancy?: string;
  askingPrice?: string;
  noi?: string;
  capRate?: string;
  tenants?: string[];
  amenities?: string[];
  additionalNotes?: string;
}

interface ContentType {
  id: string;
  name: string;
  description: string;
  icon: typeof FileText;
}

const CONTENT_TYPES: ContentType[] = [
  { id: 'executive_summary', name: 'Executive Summary', description: 'Compelling investment overview', icon: FileText },
  { id: 'investment_highlights', name: 'Investment Highlights', description: 'Key value driver bullet points', icon: TrendingUp },
  { id: 'market_commentary', name: 'Market Overview', description: 'Regional market analysis', icon: MapPin },
  { id: 'property_description', name: 'Property Description', description: 'Facilities and amenities', icon: Building2 },
  { id: 'financial_analysis', name: 'Financial Summary', description: 'Revenue and profitability', icon: DollarSign },
  { id: 'marina_overview', name: 'Marina Overview', description: 'Marina-specific description', icon: Building2 },
];

export function AIContentGenerator({ open, onClose, onInsert, initialContext }: AIContentGeneratorProps) {
  const [selectedType, setSelectedType] = useState<string>('executive_summary');
  const [propertyContext, setPropertyContext] = useState<PropertyContext>(initialContext || {});
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async (data: { type: string; propertyContext: PropertyContext }) => {
      const response = await apiRequest('/api/om/ai/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data: any) => {
      setGeneratedContent(data.content || '');
    },
    onError: (error: any) => {
      toast({ 
        title: "Generation Failed", 
        description: error.message || "Failed to generate content. Please try again.", 
        variant: "destructive" 
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      type: selectedType,
      propertyContext,
    });
  };

  const handleInsert = () => {
    if (generatedContent) {
      onInsert(generatedContent);
      onClose();
      setGeneratedContent('');
      toast({ title: "Content inserted into document" });
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const updateContext = (key: keyof PropertyContext, value: string) => {
    setPropertyContext(prev => ({ ...prev, [key]: value }));
  };

  const selectedTypeInfo = CONTENT_TYPES.find(t => t.id === selectedType);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Content Generator
          </DialogTitle>
          <DialogDescription>
            Generate professional content for your Offering Memorandum using AI.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 h-[500px]">
          <div className="w-64 shrink-0 border-r pr-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Content Type</Label>
            <div className="space-y-1">
              {CONTENT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-start gap-2 ${
                      selectedType === type.id 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-muted'
                    }`}
                    data-testid={`button-content-type-${type.id}`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{type.name}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <Tabs defaultValue="context" className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="context">Property Context</TabsTrigger>
                <TabsTrigger value="result">Generated Content</TabsTrigger>
              </TabsList>

              <TabsContent value="context" className="flex-1 mt-4 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="propertyName">Property Name</Label>
                        <Input
                          id="propertyName"
                          value={propertyContext.propertyName || ''}
                          onChange={(e) => updateContext('propertyName', e.target.value)}
                          placeholder="e.g., Sunset Marina"
                          data-testid="input-property-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={propertyContext.location || ''}
                          onChange={(e) => updateContext('location', e.target.value)}
                          placeholder="e.g., Miami, FL"
                          data-testid="input-location"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="size">Size / Slips</Label>
                        <Input
                          id="size"
                          value={propertyContext.size || ''}
                          onChange={(e) => updateContext('size', e.target.value)}
                          placeholder="e.g., 150 wet slips, 200 dry storage"
                          data-testid="input-size"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="occupancy">Occupancy</Label>
                        <Input
                          id="occupancy"
                          value={propertyContext.occupancy || ''}
                          onChange={(e) => updateContext('occupancy', e.target.value)}
                          placeholder="e.g., 95%"
                          data-testid="input-occupancy"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="askingPrice">Asking Price</Label>
                        <Input
                          id="askingPrice"
                          value={propertyContext.askingPrice || ''}
                          onChange={(e) => updateContext('askingPrice', e.target.value)}
                          placeholder="e.g., $15,000,000"
                          data-testid="input-asking-price"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="noi">NOI</Label>
                        <Input
                          id="noi"
                          value={propertyContext.noi || ''}
                          onChange={(e) => updateContext('noi', e.target.value)}
                          placeholder="e.g., $1,200,000"
                          data-testid="input-noi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="capRate">Cap Rate</Label>
                        <Input
                          id="capRate"
                          value={propertyContext.capRate || ''}
                          onChange={(e) => updateContext('capRate', e.target.value)}
                          placeholder="e.g., 8.0%"
                          data-testid="input-cap-rate"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="additionalNotes">Additional Context</Label>
                      <Textarea
                        id="additionalNotes"
                        value={propertyContext.additionalNotes || ''}
                        onChange={(e) => updateContext('additionalNotes', e.target.value)}
                        placeholder="Add any additional information about the property, recent improvements, unique features, or specific points to emphasize..."
                        rows={4}
                        data-testid="input-additional-notes"
                      />
                    </div>

                    <Button 
                      onClick={handleGenerate}
                      disabled={generateMutation.isPending}
                      className="w-full"
                      data-testid="button-generate-content"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Generate {selectedTypeInfo?.name}
                        </>
                      )}
                    </Button>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="result" className="flex-1 mt-4 overflow-hidden flex flex-col">
                {generatedContent ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm">{selectedTypeInfo?.name}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        data-testid="button-copy-content"
                      >
                        {copied ? (
                          <><Check className="w-4 h-4 mr-1" /> Copied</>
                        ) : (
                          <><Copy className="w-4 h-4 mr-1" /> Copy</>
                        )}
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 border rounded-lg p-4 bg-muted/30">
                      <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                        {generatedContent}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">No content generated yet</p>
                      <p className="text-xs mt-1">Fill in the property context and click Generate</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleInsert}
            disabled={!generatedContent}
            data-testid="button-insert-content"
          >
            Insert into Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
