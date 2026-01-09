import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check, FileText, BarChart3, Building2, Layers } from "lucide-react";
import { PROFESSIONAL_TEMPLATES, generatePagesFromTemplate, type TemplateDefinition } from "../utils/template-generator";
import type { OmPage } from "../types";

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (pages: OmPage[]) => void;
}

const CATEGORY_ICONS = {
  executive: FileText,
  financial: BarChart3,
  marina: Building2,
  complete: Layers,
};

const CATEGORY_LABELS = {
  executive: 'Executive',
  financial: 'Financial',
  marina: 'Marina',
  complete: 'Complete OM',
};

const CATEGORY_COLORS = {
  executive: 'bg-blue-100 text-blue-800',
  financial: 'bg-green-100 text-green-800',
  marina: 'bg-teal-100 text-teal-800',
  complete: 'bg-purple-100 text-purple-800',
};

export function TemplateSelector({ open, onClose, onSelectTemplate }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredTemplates = activeCategory === 'all' 
    ? PROFESSIONAL_TEMPLATES 
    : PROFESSIONAL_TEMPLATES.filter(t => t.category === activeCategory);

  const handleConfirm = () => {
    if (selectedTemplate) {
      const pages = generatePagesFromTemplate(selectedTemplate);
      onSelectTemplate(pages);
      onClose();
      setSelectedTemplate(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Professional Templates
          </DialogTitle>
          <DialogDescription>
            Select a template to create pre-configured pages with data binding. Data will automatically populate from your connected modeling project.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="executive">Executive</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="marina">Marina</TabsTrigger>
            <TabsTrigger value="complete">Complete</TabsTrigger>
          </TabsList>

          <TabsContent value={activeCategory} className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-2 gap-4">
                {filteredTemplates.map((template) => {
                  const Icon = CATEGORY_ICONS[template.category];
                  const isSelected = selectedTemplate?.id === template.id;
                  
                  return (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedTemplate(template)}
                      data-testid={`template-${template.id}`}
                    >
                      <CardContent className="p-4 relative">
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center z-10">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${CATEGORY_COLORS[template.category]}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{template.name}</div>
                            <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {template.pages.length} {template.pages.length === 1 ? 'page' : 'pages'}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {CATEGORY_LABELS[template.category]}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground">Includes:</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.pages.map((page) => (
                              <span 
                                key={page.title} 
                                className="text-xs bg-muted px-2 py-0.5 rounded"
                              >
                                {page.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="bg-muted/50 rounded-lg p-3 mt-2">
          <div className="flex items-start gap-2">
            <div className="p-1 bg-primary/10 rounded">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Data Binding Ready</div>
              <p className="text-xs text-muted-foreground">
                Templates are pre-configured with data bindings. Connect a modeling project in Document Settings to automatically populate financial data.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedTemplate}
            data-testid="button-use-template"
          >
            {selectedTemplate ? `Use "${selectedTemplate.name}"` : 'Select a Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
