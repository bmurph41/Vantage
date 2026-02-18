/**
 * AI Generation Panel
 * Step 6: Generate content using AI for document sections
 */

import React, { useState, useMemo } from 'react';
import {
  useDocumentBuilderStore,
  useDocument,
  useSectionLibrary,
  useSections,
} from '@/stores/document-builder-store';
import { SectionDefinition, AIPromptTemplate } from '@shared/document-builder/types';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Loader2,
  Edit3,
  Wand2,
  FileText,
  Settings2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// =============================================================================
// AI Generation Card
// =============================================================================

interface AIGenerationCardProps {
  section: {
    id: number;
    sectionKey: string;
    customTitle: string | null;
    content: Record<string, any>;
    dataBindings: Record<string, any>;
    aiGenerated: boolean;
  };
  definition: SectionDefinition | null;
  onGenerate: (
    sectionId: number,
    promptKey: string,
    content: string
  ) => void;
  onContentEdit: (sectionId: number, fieldKey: string, value: string) => void;
}

const AIGenerationCard: React.FC<AIGenerationCardProps> = ({
  section,
  definition,
  onGenerate,
  onContentEdit,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [temperature, setTemperature] = useState(0.7);
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('anthropic');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const promptTemplates = definition?.aiPromptTemplates || [];
  const hasTemplates = promptTemplates.length > 0;

  // Build context from bindings
  const buildContext = () => {
    const context: Record<string, any> = {};
    Object.entries(section.dataBindings).forEach(([key, binding]: [string, any]) => {
      if (binding?.resolvedValue !== undefined) {
        context[key] = binding.resolvedValue;
      }
    });
    return context;
  };

  const handleGenerate = async () => {
    if (!selectedPrompt) return;

    setIsGenerating(true);
    try {
      const context = buildContext();
      
      const response = await fetch('/api/document-builder/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionKey: section.sectionKey,
          promptKey: selectedPrompt,
          context,
          provider,
          temperature,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setGeneratedContent(result.data.content);
        setEditedContent(result.data.content);
      } else {
        console.error('Generation failed:', result.error);
      }
    } catch (err) {
      console.error('Failed to generate content:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    onGenerate(section.id, selectedPrompt, editedContent);
    setGeneratedContent('');
    setEditedContent('');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!definition || !hasTemplates) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="font-medium flex-1 text-left">
              {section.customTitle || definition.name}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {promptTemplates.length} prompts
              </Badge>
              {section.aiGenerated && (
                <Badge className="bg-purple-100 text-purple-700 text-xs">
                  AI Generated
                </Badge>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4 border-t">
            {/* Prompt Selection */}
            <div className="space-y-2">
              <Label>Generation Template</Label>
              <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a generation template" />
                </SelectTrigger>
                <SelectContent>
                  {promptTemplates.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="w-4 h-4" />
              Advanced Settings
              {showSettings ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>

            {/* Advanced Settings */}
            {showSettings && (
              <div className="p-3 bg-muted/30 rounded-md space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>AI Provider</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                        <SelectItem value="openai">GPT-4 (OpenAI)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Creativity (Temperature)</Label>
                    <span className="text-sm text-muted-foreground">
                      {temperature.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[temperature]}
                    onValueChange={([v]) => setTemperature(v)}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!selectedPrompt || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>

            {/* Generated Content */}
            {generatedContent && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Generated Content</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      <RefreshCw className={cn(
                        'w-4 h-4',
                        isGenerating && 'animate-spin'
                      )} />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={handleAccept} className="flex-1">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept & Apply
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGeneratedContent('');
                      setEditedContent('');
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            )}

            {/* Existing Content Preview */}
            {!generatedContent && section.content && Object.keys(section.content).length > 0 && (
              <div className="p-3 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">Current Content</span>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-3">
                  {typeof section.content === 'object'
                    ? JSON.stringify(section.content, null, 2).substring(0, 200)
                    : String(section.content).substring(0, 200)}
                  ...
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// =============================================================================
// AI Generation Panel
// =============================================================================

export const AIGenerationPanel: React.FC = () => {
  const store = useDocumentBuilderStore();
  const document = useDocument();
  const sectionLibrary = useSectionLibrary();
  const sections = useSections();
  const { toast } = useToast();
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Filter enabled sections with AI templates
  const sectionsWithAI = useMemo(() => {
    return sections
      .filter((s) => s.enabled)
      .filter((s) => {
        const def = sectionLibrary[s.sectionKey];
        return def?.aiPromptTemplates?.length > 0;
      });
  }, [sections, sectionLibrary]);

  // Calculate AI generation stats
  const aiStats = useMemo(() => {
    const withAI = sectionsWithAI.filter((s) => s.aiGenerated).length;
    return {
      total: sectionsWithAI.length,
      generated: withAI,
      percentage: sectionsWithAI.length > 0
        ? Math.round((withAI / sectionsWithAI.length) * 100)
        : 0,
    };
  }, [sectionsWithAI]);

  const handleGenerate = async (
    sectionId: number,
    promptKey: string,
    content: string
  ) => {
    if (!document) return;

    // Update local state
    store.updateSectionContent(sectionId, {
      generatedText: content,
      aiPromptKey: promptKey,
    });

    // Mark as AI generated
    store.setDocument({
      ...document,
      sections: document.sections.map((s) =>
        s.id === sectionId ? { ...s, aiGenerated: true } : s
      ),
    });

    // Persist to server
    try {
      await fetch(
        `/api/document-builder/documents/${document.id}/sections/${sectionId}/content`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: {
              generatedText: content,
              aiPromptKey: promptKey,
            },
          }),
        }
      );
    } catch (err) {
      console.error('Failed to save generated content:', err);
    }
  };

  const handleContentEdit = async (
    sectionId: number,
    fieldKey: string,
    value: string
  ) => {
    store.updateSectionContent(sectionId, { [fieldKey]: value });
  };

  const handleGenerateAll = async () => {
    if (sectionsWithAI.length === 0) return;

    setIsGeneratingAll(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (let i = 0; i < sectionsWithAI.length; i++) {
        const section = sectionsWithAI[i];
        const sectionDef = sectionLibrary[section.sectionKey];
        
        // Get the first available prompt template
        const promptTemplates = sectionDef?.aiPromptTemplates;
        if (!promptTemplates || promptTemplates.length === 0) {
          failureCount++;
          continue;
        }

        const promptKey = promptTemplates[0].key;

        try {
          // Build context from bindings
          const context: Record<string, any> = {};
          Object.entries(section.dataBindings).forEach(([key, binding]: [string, any]) => {
            if (binding?.resolvedValue !== undefined) {
              context[key] = binding.resolvedValue;
            }
          });

          // Call the generation endpoint
          const response = await fetch('/api/document-builder/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sectionKey: section.sectionKey,
              promptKey,
              context,
              provider: 'anthropic',
              temperature: 0.7,
            }),
          });

          const result = await response.json();
          if (result.success) {
            // Call the existing handleGenerate to persist and update state
            await handleGenerate(section.id, promptKey, result.data.content);
            successCount++;
          } else {
            failureCount++;
          }
        } catch (err) {
          console.error(`Failed to generate content for section ${section.sectionKey}:`, err);
          failureCount++;
        }

        // Small delay between requests to avoid rate limiting
        if (i < sectionsWithAI.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Show completion toast
      if (successCount > 0) {
        toast({
          title: 'Generation Complete',
          description: `Successfully generated ${successCount} section${successCount !== 1 ? 's' : ''}${failureCount > 0 ? `. Failed: ${failureCount}` : ''}`,
        });
      } else if (failureCount > 0) {
        toast({
          title: 'Generation Failed',
          description: `Failed to generate ${failureCount} section${failureCount !== 1 ? 's' : ''}`,
          variant: 'destructive',
        });
      }
    } finally {
      setIsGeneratingAll(false);
    }
  };

  if (!document) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please create a document first
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <div>
            <h3 className="font-medium">AI Content Generation</h3>
            <p className="text-sm text-muted-foreground">
              Generate professional content with AI assistance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all"
                style={{ width: `${aiStats.percentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {aiStats.generated} / {aiStats.total} generated
            </span>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-purple-900 dark:text-purple-100">
              How AI Generation Works
            </h4>
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
              AI uses your bound data to generate professional, context-aware content.
              Each section has specialized prompts designed for marina investment documents.
              You can edit the generated content before accepting it.
            </p>
          </div>
        </div>
      </div>

      {/* Section AI Cards */}
      <div className="space-y-3">
        {sectionsWithAI.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            No sections support AI generation. Add sections with AI capabilities.
          </div>
        ) : (
          sectionsWithAI.map((section) => (
            <AIGenerationCard
              key={section.id}
              section={section}
              definition={sectionLibrary[section.sectionKey] || null}
              onGenerate={handleGenerate}
              onContentEdit={handleContentEdit}
            />
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
        <Button
          onClick={handleGenerateAll}
          disabled={isGeneratingAll || sectionsWithAI.length === 0}
          variant={isGeneratingAll ? 'default' : 'outline'}
        >
          {isGeneratingAll ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Generate All
            </>
          )}
        </Button>
        <span className="text-sm text-muted-foreground">
          {sectionsWithAI.length === 0
            ? 'No sections available for generation'
            : `Generate content for ${sectionsWithAI.length} section${sectionsWithAI.length !== 1 ? 's' : ''}`}
        </span>
      </div>
    </div>
  );
};

export default AIGenerationPanel;
