import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAiGenerate, useAiImprove, type PropertyContext, type MarketContext, type GenerateRequest } from "@/lib/api";
import { Wand2, Loader2, Copy, Check, Sparkles, Building2, TrendingUp, FileText, List, MapPin, RefreshCw, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface AiPanelProps {
  onInsertContent: (content: string) => void;
  selectedBlockId?: string;
  selectedBlockContent?: string;
}

type GenerationType = 'executive_summary' | 'investment_highlights' | 'market_commentary' | 'financial_analysis' | 'property_description' | 'custom';

const GENERATION_TYPES = [
  { id: 'executive_summary' as const, label: 'Executive Summary', icon: FileText, description: 'Professional overview paragraph' },
  { id: 'investment_highlights' as const, label: 'Investment Highlights', icon: List, description: 'Bullet point highlights' },
  { id: 'market_commentary' as const, label: 'Market Commentary', icon: TrendingUp, description: 'Market analysis section' },
  { id: 'financial_analysis' as const, label: 'Financial Analysis', icon: Building2, description: 'Financial narrative' },
  { id: 'property_description' as const, label: 'Property Description', icon: MapPin, description: 'Physical description' },
  { id: 'custom' as const, label: 'Custom Prompt', icon: MessageSquare, description: 'Write your own instructions' },
];

const IMPROVEMENT_SUGGESTIONS = [
  "Make it more concise",
  "Add more compelling language",
  "Make it more professional",
  "Add more specific details",
  "Improve the flow and readability",
  "Make it more investor-focused",
];

export function AiPanel({ onInsertContent, selectedBlockId, selectedBlockContent }: AiPanelProps) {
  const [activeTab, setActiveTab] = useState<'generate' | 'improve'>('generate');
  const [selectedType, setSelectedType] = useState<GenerationType>('executive_summary');
  const [tone, setTone] = useState<'professional' | 'compelling' | 'conservative'>('professional');
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [improveInstruction, setImproveInstruction] = useState('');

  const [propertyContext, setPropertyContext] = useState<PropertyContext>({
    propertyName: '',
    propertyType: '',
    location: '',
    size: '',
    yearBuilt: '',
    occupancy: '',
    askingPrice: '',
    noi: '',
    capRate: '',
    additionalNotes: '',
  });

  const [marketContext, setMarketContext] = useState<MarketContext>({
    location: '',
    medianRent: undefined,
    vacancyRate: undefined,
    population: undefined,
    employmentGrowth: undefined,
    medianIncome: undefined,
    marketTrends: '',
  });

  const generateMutation = useAiGenerate();
  const improveMutation = useAiImprove();

  const handleImprove = async () => {
    if (!selectedBlockContent && !generatedContent) {
      toast({
        title: "No Content to Improve",
        description: "Select a text block or generate content first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const contentToImprove = selectedBlockContent || generatedContent;
      const result = await improveMutation.mutateAsync({
        content: contentToImprove,
        instruction: improveInstruction || "Improve this content for a professional offering memorandum",
      });
      setGeneratedContent(result.content);
      toast({
        title: "Content Improved",
        description: "AI has refined your content. Review and insert it into your document.",
      });
    } catch (error) {
      console.error('Improvement failed:', error);
      toast({
        title: "Improvement Failed",
        description: "There was an issue improving content. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    const request: GenerateRequest = {
      type: selectedType,
      tone,
      propertyContext: selectedType !== 'market_commentary' ? propertyContext : undefined,
      marketContext: selectedType === 'market_commentary' ? marketContext : undefined,
      customPrompt: selectedType === 'custom' ? customPrompt : undefined,
    };

    try {
      const result = await generateMutation.mutateAsync(request);
      setGeneratedContent(result.content);
      toast({
        title: "Content Generated",
        description: "AI has created your content. Review and insert it into your document.",
      });
    } catch (error) {
      console.error('Generation failed:', error);
      toast({
        title: "Generation Failed",
        description: "There was an issue generating content. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onInsertContent(generatedContent);
    setGeneratedContent('');
  };

  const updatePropertyContext = (key: keyof PropertyContext, value: string) => {
    setPropertyContext(prev => ({ ...prev, [key]: value }));
  };

  const updateMarketContext = (key: keyof MarketContext, value: string | number | undefined) => {
    setMarketContext(prev => ({ ...prev, [key]: value }));
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="font-semibold text-sm">AI Content Assistant</h3>
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveTab('generate')}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === 'generate' 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-generate"
          >
            <Wand2 className="w-3 h-3 inline mr-1" />
            Generate
          </button>
          <button
            onClick={() => setActiveTab('improve')}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === 'improve' 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-improve"
          >
            <RefreshCw className="w-3 h-3 inline mr-1" />
            Improve
          </button>
        </div>

        {activeTab === 'improve' && (
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground mb-2">
                {selectedBlockContent ? "Selected block content:" : "No text block selected. Generate content first or select a text block."}
              </p>
              {selectedBlockContent && (
                <p className="text-xs text-foreground line-clamp-3">{selectedBlockContent}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Improvement Instruction</Label>
              <Textarea
                placeholder="e.g., Make it more concise, add more compelling language..."
                value={improveInstruction}
                onChange={(e) => setImproveInstruction(e.target.value)}
                className="min-h-[60px] text-xs"
                data-testid="input-improve-instruction"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {IMPROVEMENT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setImproveInstruction(suggestion)}
                  className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
                  data-testid={`suggestion-${suggestion.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <Button 
              onClick={handleImprove}
              disabled={improveMutation.isPending || (!selectedBlockContent && !generatedContent)}
              className="w-full gap-2"
              data-testid="button-improve-ai"
            >
              {improveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Improving...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Improve Content
                </>
              )}
            </Button>
          </div>
        )}

        {activeTab === 'generate' && (
        <>
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Content Type</Label>
          <div className="grid grid-cols-1 gap-2">
            {GENERATION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md border text-left transition-colors",
                    selectedType === type.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  data-testid={`ai-type-${type.id}`}
                >
                  <Icon className={cn("w-4 h-4 mt-0.5", selectedType === type.id ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <div className={cn("text-sm font-medium", selectedType === type.id ? "text-primary" : "")}>
                      {type.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedType === 'custom' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Custom Prompt</Label>
            <Textarea
              placeholder="Describe what you want the AI to write..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="min-h-[80px] text-xs"
              data-testid="input-custom-prompt"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Tone</Label>
          <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
            <SelectTrigger data-testid="select-tone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="compelling">Compelling</SelectItem>
              <SelectItem value="conservative">Conservative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedType !== 'market_commentary' && (
          <Accordion type="single" collapsible defaultValue="property">
            <AccordionItem value="property" className="border-b-0">
              <AccordionTrigger className="text-xs py-2">Property Details (Optional)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Property Name</Label>
                      <Input 
                        placeholder="e.g., Marina Bay Center"
                        value={propertyContext.propertyName}
                        onChange={(e) => updatePropertyContext('propertyName', e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-property-name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Property Type</Label>
                      <Input 
                        placeholder="e.g., Retail, Marina"
                        value={propertyContext.propertyType}
                        onChange={(e) => updatePropertyContext('propertyType', e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-property-type"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Location</Label>
                    <Input 
                      placeholder="e.g., San Diego, CA"
                      value={propertyContext.location}
                      onChange={(e) => updatePropertyContext('location', e.target.value)}
                      className="h-8 text-xs"
                      data-testid="input-location"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Size</Label>
                      <Input 
                        placeholder="e.g., 50,000 SF"
                        value={propertyContext.size}
                        onChange={(e) => updatePropertyContext('size', e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-size"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Year Built</Label>
                      <Input 
                        placeholder="e.g., 2015"
                        value={propertyContext.yearBuilt}
                        onChange={(e) => updatePropertyContext('yearBuilt', e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-year-built"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Occupancy</Label>
                      <Input 
                        placeholder="e.g., 95%"
                        value={propertyContext.occupancy}
                        onChange={(e) => updatePropertyContext('occupancy', e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-occupancy"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">NOI</Label>
                      <Input 
                        placeholder="e.g., $500K"
                        value={propertyContext.noi}
                        onChange={(e) => updatePropertyContext('noi', e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-noi"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cap Rate</Label>
                      <Input 
                        placeholder="e.g., 6.5%"
                        value={propertyContext.capRate}
                        onChange={(e) => updatePropertyContext('capRate', e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-cap-rate"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Asking Price</Label>
                    <Input 
                      placeholder="e.g., $7,500,000"
                      value={propertyContext.askingPrice}
                      onChange={(e) => updatePropertyContext('askingPrice', e.target.value)}
                      className="h-8 text-xs"
                      data-testid="input-asking-price"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Additional Notes</Label>
                    <Textarea 
                      placeholder="Any other details..."
                      value={propertyContext.additionalNotes}
                      onChange={(e) => updatePropertyContext('additionalNotes', e.target.value)}
                      className="text-xs min-h-[60px]"
                      data-testid="input-additional-notes"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {selectedType === 'market_commentary' && (
          <Accordion type="single" collapsible defaultValue="market">
            <AccordionItem value="market" className="border-b-0">
              <AccordionTrigger className="text-xs py-2">Market Data (Optional)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs">Location/Market</Label>
                    <Input 
                      placeholder="e.g., Downtown San Diego"
                      value={marketContext.location}
                      onChange={(e) => updateMarketContext('location', e.target.value)}
                      className="h-8 text-xs"
                      data-testid="input-market-location"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Median Rent</Label>
                      <Input 
                        type="number"
                        placeholder="e.g., 2500"
                        value={marketContext.medianRent || ''}
                        onChange={(e) => updateMarketContext('medianRent', e.target.value ? Number(e.target.value) : undefined)}
                        className="h-8 text-xs"
                        data-testid="input-median-rent"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Vacancy Rate (%)</Label>
                      <Input 
                        type="number"
                        step="0.1"
                        placeholder="e.g., 4.5"
                        value={marketContext.vacancyRate || ''}
                        onChange={(e) => updateMarketContext('vacancyRate', e.target.value ? Number(e.target.value) : undefined)}
                        className="h-8 text-xs"
                        data-testid="input-vacancy-rate"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Population</Label>
                      <Input 
                        type="number"
                        placeholder="e.g., 850000"
                        value={marketContext.population || ''}
                        onChange={(e) => updateMarketContext('population', e.target.value ? Number(e.target.value) : undefined)}
                        className="h-8 text-xs"
                        data-testid="input-population"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Employment Growth (%)</Label>
                      <Input 
                        type="number"
                        step="0.1"
                        placeholder="e.g., 3.2"
                        value={marketContext.employmentGrowth || ''}
                        onChange={(e) => updateMarketContext('employmentGrowth', e.target.value ? Number(e.target.value) : undefined)}
                        className="h-8 text-xs"
                        data-testid="input-employment-growth"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Market Trends</Label>
                    <Textarea 
                      placeholder="Describe recent market trends..."
                      value={marketContext.marketTrends}
                      onChange={(e) => updateMarketContext('marketTrends', e.target.value)}
                      className="text-xs min-h-[60px]"
                      data-testid="input-market-trends"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        <Button 
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="w-full gap-2"
          data-testid="button-generate-ai"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Content
            </>
          )}
        </Button>
        </>
        )}

        {generatedContent && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Generated Content</Label>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCopy}
                  className="h-7 px-2"
                  data-testid="button-copy-content"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            <div className="p-3 rounded-md bg-muted/50 border text-sm max-h-[200px] overflow-y-auto whitespace-pre-wrap" data-testid="text-generated-content">
              {generatedContent}
            </div>
            <Button 
              onClick={handleInsert}
              variant="secondary"
              className="w-full gap-2"
              data-testid="button-insert-content"
            >
              Insert into Document
            </Button>
          </div>
        )}

        {generateMutation.isError && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            Failed to generate content. Please try again.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
