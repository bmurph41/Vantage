import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const WORKFLOW_STEPS = [
  { id: 'overview', label: 'Overview' },
  { id: 'inputs', label: 'Inputs & Assumptions' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'historical', label: 'Historical' },
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
  const totalSteps = WORKFLOW_STEPS.length;

  return (
    <div className="sticky top-[52px] z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b -mx-6 px-6 py-3 mb-6">
      <div className="flex items-center justify-between gap-4">

        {/* Previous */}
        <div className="flex-none w-48">
          {previousStep ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(previousStep.id)}
              className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-3"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="text-xs">{previousStep.label}</span>
            </Button>
          ) : (
            <div />
          )}
        </div>

        {/* Step dots */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            {WORKFLOW_STEPS.map((step, i) => (
              <button
                key={step.id}
                onClick={() => onNavigate(step.id)}
                title={step.label}
                className={cn(
                  'rounded-full transition-all duration-200 focus:outline-none',
                  i === currentIndex
                    ? 'w-5 h-1.5 bg-primary'
                    : i < currentIndex
                    ? 'w-1.5 h-1.5 bg-primary/40 hover:bg-primary/60'
                    : 'w-1.5 h-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40'
                )}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground/70 font-medium tracking-wide uppercase">
            {WORKFLOW_STEPS[currentIndex].label}
          </span>
        </div>

        {/* Next */}
        <div className="flex-none w-48 flex justify-end">
          {nextStep ? (
            <Button
              size="sm"
              onClick={() => onNavigate(nextStep.id)}
              className="gap-1.5 h-8 px-3 text-xs"
            >
              <span>{nextStep.label}</span>
              <ChevronRight className="h-3.5 w-3.5" />
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
