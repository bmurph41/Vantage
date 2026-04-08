import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, ChevronLeft, Save, Sparkles } from 'lucide-react';
import { VisualizationTypeSelector } from './VisualizationTypeSelector';
import { DataConfigurationPanel } from './DataConfigurationPanel';
import { StylingOptionsPanel } from './StylingOptionsPanel';
import { PreviewPanel } from './PreviewPanel';
import { CHART_TEMPLATES, getTemplatesByCategory } from './chart-templates';
import type { VisualizationType, ChartConfig } from '@shared/schema';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, name: 'Type', description: 'Choose visualization' },
  { id: 2, name: 'Data', description: 'Configure data' },
  { id: 3, name: 'Style', description: 'Customize appearance' },
  { id: 4, name: 'Preview', description: 'Review & save' },
];

interface EnhancedModuleBuilderProps {
  onSave: (data: {
    title: string;
    moduleType: string;
    visualizationType: VisualizationType;
    filters: Record<string, any>;
    chartConfig: ChartConfig;
  }) => void;
  onCancel: () => void;
}

export function EnhancedModuleBuilder({ onSave, onCancel }: EnhancedModuleBuilderProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [useTemplate, setUseTemplate] = useState(true);
  
  const [title, setTitle] = useState('');
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('kpi_card');
  const [moduleType, setModuleType] = useState('crm');
  const [config, setConfig] = useState<Partial<ChartConfig>>({
    metrics: [],
    showGrid: true,
    showLegend: false,
  });

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return visualizationType !== undefined;
      case 2:
        return moduleType && config.metrics && config.metrics.length > 0;
      case 3:
        return true;
      case 4:
        return title.trim().length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = CHART_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setVisualizationType(template.visualizationType);
      setModuleType(template.moduleType);
      setConfig(template.config as Partial<ChartConfig>);
      setTitle(template.name);
      setUseTemplate(false);
      setCurrentStep(2);
    }
  };

  const handleSave = () => {
    if (!title.trim() || !moduleType || !config.metrics || config.metrics.length === 0) {
      return;
    }

    onSave({
      title,
      moduleType,
      visualizationType,
      filters: {},
      chartConfig: config as ChartConfig,
    });
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Create Custom Analytics Module</h2>
        <p className="text-gray-600">
          Build powerful visualizations with your data in 4 simple steps
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {STEPS.map((step) => (
              <Badge
                key={step.id}
                variant={currentStep === step.id ? 'default' : currentStep > step.id ? 'secondary' : 'outline'}
                className={cn(
                  'px-3 py-1 cursor-pointer transition-all',
                  currentStep === step.id && 'ring-2 ring-blue-500 ring-offset-2'
                )}
                onClick={() => {
                  if (step.id < currentStep || (step.id === currentStep)) {
                    setCurrentStep(step.id);
                  }
                }}
                data-testid={`step-badge-${step.id}`}
              >
                <span className="font-semibold">{step.id}.</span> {step.name}
              </Badge>
            ))}
          </div>
          <span className="text-sm text-gray-600">
            Step {currentStep} of {STEPS.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="min-h-[500px]">
        <CardContent className="p-6">
          {currentStep === 1 && (
            <Tabs value={useTemplate ? 'templates' : 'custom'} onValueChange={(v) => setUseTemplate(v === 'templates')}>
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-6">
                <TabsTrigger value="templates" data-testid="tab-templates">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="custom" data-testid="tab-custom">
                  Custom
                </TabsTrigger>
              </TabsList>

              <TabsContent value="templates" className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Choose a Template</h3>
                  <p className="text-sm text-gray-600">
                    Start with a pre-configured visualization
                  </p>
                </div>

                <div className="space-y-6">
                  {(['financial', 'operations', 'analytics'] as const).map((category) => {
                    const templates = getTemplatesByCategory(category);
                    if (templates.length === 0) return null;

                    return (
                      <div key={category}>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 capitalize">
                          {category}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {templates.map((template) => {
                            const Icon = template.icon;
                            return (
                              <Card
                                key={template.id}
                                className="cursor-pointer hover:shadow-md transition-all hover:border-blue-500"
                                onClick={() => handleTemplateSelect(template.id)}
                                data-testid={`template-${template.id}`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                      <Icon className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h5 className="font-semibold text-sm mb-1">{template.name}</h5>
                                      <p className="text-xs text-gray-600 line-clamp-2">
                                        {template.description}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="custom">
                <VisualizationTypeSelector
                  selectedType={visualizationType}
                  onSelect={setVisualizationType}
                />
              </TabsContent>
            </Tabs>
          )}

          {currentStep === 2 && (
            <DataConfigurationPanel
              visualizationType={visualizationType}
              moduleType={moduleType}
              config={config}
              onModuleTypeChange={setModuleType}
              onConfigChange={setConfig}
            />
          )}

          {currentStep === 3 && (
            <StylingOptionsPanel
              visualizationType={visualizationType}
              config={config}
              onConfigChange={setConfig}
            />
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="module-title">Module Title *</Label>
                <Input
                  id="module-title"
                  placeholder="e.g., Q4 Revenue Trend, Pipeline Health"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-module-title"
                />
              </div>

              <PreviewPanel
                title={title}
                visualizationType={visualizationType}
                moduleType={moduleType}
                config={config}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 1 ? onCancel : handleBack}
          data-testid="button-back"
        >
          {currentStep === 1 ? (
            'Cancel'
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </>
          )}
        </Button>

        <div className="flex gap-2">
          {currentStep < 4 && (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              data-testid="button-next"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {currentStep === 4 && (
            <Button
              onClick={handleSave}
              disabled={!title.trim()}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-save-module"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Module
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
