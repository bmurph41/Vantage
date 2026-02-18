import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WORKFLOW_STEPS = [
  { id: 'overview', label: 'Overview' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'historical', label: 'Historical' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'proforma', label: 'Pro Forma' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'summary', label: 'Summary' },
  { id: 'analytics', label: 'Analytics' },
];

interface WorkflowNavigationProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export function WorkflowNavigation({ currentTab, onNavigate }: WorkflowNavigationProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex(step => step.id === currentTab);
  
  if (currentIndex === -1) return null;
  
  const previousStep = currentIndex > 0 ? WORKFLOW_STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex < WORKFLOW_STEPS.length - 1 ? WORKFLOW_STEPS[currentIndex + 1] : null;
  const stepNumber = currentIndex + 1;
  const totalSteps = WORKFLOW_STEPS.length;

  return (
    <div className="sticky top-[52px] z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-3 -mx-6 px-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          {previousStep ? (
            <Button
              variant="outline"
              onClick={() => onNavigate(previousStep.id)}
              className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous: {previousStep.label}
            </Button>
          ) : (
            <div />
          )}
        </div>
        
        <div className="text-sm text-muted-foreground">
          Step {stepNumber} of {totalSteps}
        </div>
        
        <div>
          {nextStep ? (
            <Button
              onClick={() => onNavigate(nextStep.id)}
              className="gap-2"
            >
              Next: {nextStep.label}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}

export { WORKFLOW_STEPS };
