import { useState, useEffect } from 'react';
import { Check, Loader2, Shield, Zap, Database, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProvisioningStep {
  label: string;
  icon: typeof Loader2;
  duration: number; // ms
}

const PROVISIONING_STEPS: ProvisioningStep[] = [
  { label: 'Verifying payment', icon: Shield, duration: 1200 },
  { label: 'Activating your modules', icon: Zap, duration: 1500 },
  { label: 'Syncing account data', icon: Database, duration: 1800 },
  { label: 'Preparing your workspace', icon: Layout, duration: 1000 },
];

interface ProvisioningAnimationProps {
  packName: string;
  onComplete: () => void;
}

export function ProvisioningAnimation({ packName, onComplete }: ProvisioningAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function advanceStep(step: number) {
      if (step >= PROVISIONING_STEPS.length) {
        setIsComplete(true);
        timeout = setTimeout(onComplete, 800);
        return;
      }
      setCurrentStep(step);
      timeout = setTimeout(() => advanceStep(step + 1), PROVISIONING_STEPS[step].duration);
    }

    advanceStep(0);
    return () => clearTimeout(timeout);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center py-8 px-6">
      {/* Animated ring */}
      <div className="relative mb-8">
        <div className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
          isComplete
            ? "bg-green-500/20 ring-2 ring-green-500"
            : "bg-primary/10 ring-2 ring-primary"
        )}>
          {isComplete ? (
            <Check className="h-10 w-10 text-green-500 animate-in zoom-in duration-300" />
          ) : (
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          )}
        </div>
        {/* Pulse ring */}
        {!isComplete && (
          <div className="absolute inset-0 rounded-full ring-2 ring-primary/30 animate-ping" />
        )}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold mb-2">
        {isComplete ? 'You\'re all set!' : `Setting up ${packName}`}
      </h3>
      <p className="text-sm text-muted-foreground mb-8">
        {isComplete
          ? 'Your new features are ready to use.'
          : 'This will only take a moment...'}
      </p>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-3">
        {PROVISIONING_STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isDone = idx < currentStep || isComplete;
          const isActive = idx === currentStep && !isComplete;

          return (
            <div
              key={step.label}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300",
                isDone && "bg-green-500/10",
                isActive && "bg-primary/10",
                !isDone && !isActive && "opacity-40"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
                isDone && "bg-green-500 text-white",
                isActive && "bg-primary text-primary-foreground",
                !isDone && !isActive && "bg-muted text-muted-foreground"
              )}>
                {isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" />
                )}
              </div>
              <span className={cn(
                "text-sm transition-colors duration-300",
                isDone && "text-green-700 dark:text-green-400 font-medium",
                isActive && "text-foreground font-medium",
                !isDone && !isActive && "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs mt-6 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            isComplete ? "bg-green-500" : "bg-primary"
          )}
          style={{
            width: isComplete
              ? '100%'
              : `${((currentStep) / PROVISIONING_STEPS.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
