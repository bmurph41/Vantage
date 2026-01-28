/**
 * Document Builder - Main Wizard Component
 * Step-by-step guided workflow for creating documents
 */

import React, { useEffect } from 'react';
import {
  useDocumentBuilderStore,
  useDocument,
  useCurrentStep,
  useIsBuilderMode,
  useIsLoading,
  useError,
} from '@/stores/document-builder-store';
import { DocumentTypeSelector } from './DocumentTypeSelector';
import { DocumentConfigurator } from './DocumentConfigurator';
import { SectionSelector } from './SectionSelector';
import { DataBindingPanel } from './DataBindingPanel';
import { MediaUploadPanel } from './MediaUploadPanel';
import { AIGenerationPanel } from './AIGenerationPanel';
import { DocumentReview } from './DocumentReview';
import { CompletionIndicator } from './CompletionIndicator';
import { BuilderStep } from '@shared/document-builder/types';
import {
  FileText,
  Settings,
  Layers,
  Database,
  Image,
  Sparkles,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// =============================================================================
// Step Configuration
// =============================================================================

interface StepConfig {
  key: BuilderStep;
  title: string;
  description: string;
  icon: React.ElementType;
  optional?: boolean;
}

const STEPS: StepConfig[] = [
  {
    key: 'select_type',
    title: 'Document Type',
    description: 'Choose the type of document to create',
    icon: FileText,
  },
  {
    key: 'configure',
    title: 'Configure',
    description: 'Set document title, audience, and theme',
    icon: Settings,
  },
  {
    key: 'choose_sections',
    title: 'Sections',
    description: 'Select and arrange document sections',
    icon: Layers,
  },
  {
    key: 'bind_data',
    title: 'Data Binding',
    description: 'Connect data sources to sections',
    icon: Database,
  },
  {
    key: 'add_media',
    title: 'Media',
    description: 'Add images, maps, and charts',
    icon: Image,
    optional: true,
  },
  {
    key: 'generate_content',
    title: 'AI Content',
    description: 'Generate text with AI assistance',
    icon: Sparkles,
    optional: true,
  },
  {
    key: 'review',
    title: 'Review',
    description: 'Review and export your document',
    icon: CheckCircle,
  },
];

// =============================================================================
// Step Progress Bar
// =============================================================================

interface StepProgressProps {
  currentStep: BuilderStep;
  onStepClick: (step: BuilderStep) => void;
  completedSteps: Set<BuilderStep>;
}

const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  onStepClick,
  completedSteps,
}) => {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.key === currentStep;
        const isCompleted = completedSteps.has(step.key);
        const isClickable = index <= currentIndex || isCompleted;

        return (
          <React.Fragment key={step.key}>
            <button
              onClick={() => isClickable && onStepClick(step.key)}
              disabled={!isClickable}
              className={cn(
                'flex flex-col items-center gap-1.5 transition-all',
                isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                    : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted && !isActive ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.title}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  index < currentIndex || completedSteps.has(STEPS[index + 1]?.key)
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// =============================================================================
// Step Content Renderer
// =============================================================================

interface StepContentProps {
  step: BuilderStep;
  dealId: string;
}

const StepContent: React.FC<StepContentProps> = ({ step, dealId }) => {
  switch (step) {
    case 'select_type':
      return <DocumentTypeSelector dealId={dealId} />;
    case 'configure':
      return <DocumentConfigurator />;
    case 'choose_sections':
      return <SectionSelector />;
    case 'bind_data':
      return <DataBindingPanel />;
    case 'add_media':
      return <MediaUploadPanel />;
    case 'generate_content':
      return <AIGenerationPanel />;
    case 'review':
      return <DocumentReview />;
    default:
      return null;
  }
};

// =============================================================================
// Main Document Builder Component
// =============================================================================

interface DocumentBuilderProps {
  dealId: string;
  documentId?: string;
  onClose?: () => void;
  onOpenEditor?: (documentId: string) => void;
}

export const DocumentBuilder: React.FC<DocumentBuilderProps> = ({
  dealId,
  documentId,
  onClose,
  onOpenEditor,
}) => {
  const store = useDocumentBuilderStore();
  const document = useDocument();
  const currentStep = useCurrentStep();
  const isBuilderMode = useIsBuilderMode();
  const isLoading = useIsLoading();
  const error = useError();

  const [completedSteps, setCompletedSteps] = React.useState<Set<BuilderStep>>(new Set());

  // Load document if editing existing
  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
    } else {
      store.reset();
      store.setCurrentStep('select_type');
    }
    loadLibraries();
  }, [documentId]);

  // Track completed steps
  useEffect(() => {
    if (document) {
      const completed = new Set<BuilderStep>();
      
      // select_type is complete if we have a document
      completed.add('select_type');
      
      // configure is complete if we have a title
      if (document.title) {
        completed.add('configure');
      }
      
      // choose_sections is complete if we have enabled sections
      if (document.sections?.some((s) => s.enabled)) {
        completed.add('choose_sections');
      }
      
      // bind_data is complete if required bindings are filled
      const hasRequiredBindings = document.sections?.every((section) => {
        if (!section.enabled) return true;
        const missing = section.completionStatus?.missingRequiredBindings || [];
        return missing.length === 0;
      });
      if (hasRequiredBindings) {
        completed.add('bind_data');
      }
      
      setCompletedSteps(completed);
    }
  }, [document]);

  const loadDocument = async (id: string) => {
    store.setLoading(true);
    try {
      const response = await fetch(`/api/document-builder/documents/${id}`);
      const result = await response.json();
      if (result.success) {
        store.setDocument(result.data);
        store.setCurrentStep('choose_sections'); // Start at sections for existing docs
      } else {
        store.setError(result.error);
      }
    } catch (err) {
      store.setError('Failed to load document');
    } finally {
      store.setLoading(false);
    }
  };

  const loadLibraries = async () => {
    try {
      // Load section library
      const libResponse = await fetch('/api/document-builder/section-library');
      const libResult = await libResponse.json();
      if (libResult.success) {
        store.setSectionLibrary(libResult.data);
      }

      // Load document type configs
      const configResponse = await fetch('/api/document-builder/document-types');
      const configResult = await configResponse.json();
      if (configResult.success) {
        store.setDocumentTypeConfigs(configResult.data);
      }

      // Load bindings catalog
      const bindingsResponse = await fetch('/api/document-builder/bindings/catalog');
      const bindingsResult = await bindingsResponse.json();
      if (bindingsResult.success) {
        store.setBindingsCatalog(bindingsResult.data);
      }
    } catch (err) {
      console.error('Failed to load libraries:', err);
    }
  };

  const handleStepClick = (step: BuilderStep) => {
    store.setCurrentStep(step);
  };

  const handleNext = () => {
    store.nextStep();
  };

  const handlePrev = () => {
    store.prevStep();
  };

  const handleOpenInEditor = () => {
    if (document && onOpenEditor) {
      onOpenEditor(String(document.id));
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const currentStepConfig = STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  // Can proceed to next step?
  const canProceed = () => {
    if (!document && currentStep !== 'select_type') return false;
    
    switch (currentStep) {
      case 'select_type':
        return !!document;
      case 'configure':
        return !!document?.title;
      case 'choose_sections':
        return document?.sections?.some((s) => s.enabled);
      default:
        return true;
    }
  };

  if (!isBuilderMode) {
    return null; // Or render editor mode
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Document Builder</h1>
            {document && (
              <p className="text-sm text-muted-foreground">{document.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {document && (
            <>
              <CompletionIndicator
                percentage={document.completionStatus?.percentage || 0}
                compact
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInEditor}
              >
                Open in Editor
              </Button>
            </>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Step Progress */}
      <StepProgress
        currentStep={currentStep}
        onStepClick={handleStepClick}
        completedSteps={completedSteps}
      />

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => store.setError(null)}>
              Dismiss
            </Button>
          </div>
        ) : (
          <div className="p-6">
            {/* Step Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold">{currentStepConfig?.title}</h2>
              <p className="text-muted-foreground">{currentStepConfig?.description}</p>
            </div>

            {/* Step Component */}
            <StepContent step={currentStep} dealId={dealId} />
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={isFirstStep}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Step {currentStepIndex + 1} of {STEPS.length}
          {currentStepConfig?.optional && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">Optional</span>
          )}
        </div>

        {isLastStep ? (
          <Button onClick={handleOpenInEditor} disabled={!document}>
            Open in Editor
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default DocumentBuilder;
