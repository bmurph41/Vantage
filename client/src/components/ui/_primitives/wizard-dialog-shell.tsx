import { type ReactNode, type LucideIcon } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: number;
  title: string;
  icon?: LucideIcon;
}

interface WizardDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  steps: WizardStep[];
  currentStep: number;
  children: ReactNode;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
  finishLabel?: string;
  isFinishing?: boolean;
  canGoNext?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "sm:max-w-[425px]",
  md: "sm:max-w-[550px]",
  lg: "sm:max-w-[700px]",
  xl: "sm:max-w-[900px]",
};

export function WizardDialogShell({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  steps,
  currentStep,
  children,
  onNext,
  onBack,
  onFinish,
  finishLabel = "Finish",
  isFinishing = false,
  canGoNext = true,
  size = "md",
  className,
}: WizardDialogShellProps) {
  const progress = (currentStep / steps.length) * 100;
  const isLastStep = currentStep === steps.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(sizeClasses[size], className)}>
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="flex items-center gap-2">
              {Icon && (
                <div className="p-1.5 rounded-lg bg-[#1E4FAB]/10">
                  <Icon className="h-5 w-5 text-[#1E4FAB]" />
                </div>
              )}
              {title}
            </DialogTitle>
            <div className="flex items-center gap-1">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    currentStep >= step.id ? "bg-[#1E4FAB]" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
          <Progress value={progress} className="h-1" />
          {description && (
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">{children}</div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {!isLastStep ? (
            <Button
              onClick={onNext}
              disabled={!canGoNext}
              className="bg-[#1E4FAB] hover:bg-[#1a4294]"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={onFinish}
              disabled={isFinishing || !canGoNext}
              className="bg-[#1E4FAB] hover:bg-[#1a4294]"
            >
              {isFinishing ? "Saving..." : finishLabel}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
