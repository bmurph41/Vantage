/**
 * MMModalWizard - Multi-Step Modal Wizard
 * 
 * A higher-level wrapper for multi-step flows that:
 * - Manages step navigation state
 * - Renders progress dots automatically
 * - Enforces footer consistency (Back/Next)
 * - Supports scrollable step content with pinned footer
 * - Handles loading/validation states
 */

import React, { useState, useCallback, ReactNode } from 'react';
import { MMModal, MMModalStepHeader } from './MMModal';
import { MMModalWizardProps, cn } from './types';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export function MMModalWizard({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  steps,
  onStepChange,
  onBack,
  onNext,
  isStepValid = true,
  isLoading = false,
  backLabel = 'Back',
  nextLabel = 'Next',
  submitLabel = 'Create',
  hideBackOnFirstStep = true,
  renderStep,
  showClose = true,
  dismissOnOverlayClick = true,
  size = 'lg',
  children,
  className,
}: MMModalWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    
    const newStep = currentStep - 1;
    setCurrentStep(newStep);
    onStepChange?.(newStep);
    onBack?.();
  }, [currentStep, isFirstStep, onStepChange, onBack]);

  // Handle next/submit
  const handleNext = useCallback(() => {
    if (!isStepValid || isLoading) return;

    if (isLastStep) {
      onNext?.();
    } else {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      onStepChange?.(newStep);
      onNext?.();
    }
  }, [currentStep, isLastStep, isStepValid, isLoading, onStepChange, onNext]);

  // Handle modal close - reset step
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset to first step when closing
        setTimeout(() => setCurrentStep(0), 200);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Handle Enter key for form submission
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        const target = event.target as HTMLElement;
        // Don't trigger on textarea or if inside a combobox
        if (target.tagName === 'TEXTAREA' || target.closest('[role="combobox"]')) {
          return;
        }
        event.preventDefault();
        handleNext();
      }
    },
    [handleNext]
  );

  // Get current step info
  const currentStepInfo = steps[currentStep];
  const stepTitle = currentStepInfo?.title || currentStepInfo?.label;
  const stepSubtitle = currentStepInfo?.subtitle;

  // Determine button label
  const primaryButtonLabel = isLastStep ? submitLabel : nextLabel;

  // Footer Left: Back button
  const footerLeft = (
    <>
      {!(isFirstStep && hideBackOnFirstStep) && (
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirstStep || isLoading}
          className="mm-btn mm-btn-ghost"
        >
          <ChevronLeft className="w-4 h-4" />
          {backLabel}
        </button>
      )}
    </>
  );

  // Footer Right: Next/Submit button
  const footerRight = (
    <button
      type="button"
      onClick={handleNext}
      disabled={!isStepValid || isLoading}
      className="mm-btn mm-btn-primary"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mm-spinner" />
          {isLastStep ? 'Saving...' : 'Loading...'}
        </>
      ) : (
        <>
          {primaryButtonLabel}
          <ChevronRight className="w-4 h-4" />
        </>
      )}
    </button>
  );

  return (
    <MMModal
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      subtitle={subtitle}
      icon={icon}
      steps={steps}
      activeStep={currentStep}
      showClose={showClose}
      dismissOnOverlayClick={dismissOnOverlayClick && !isLoading}
      size={size}
      footerLeft={footerLeft}
      footerRight={footerRight}
      className={className}
    >
      <div onKeyDown={handleKeyDown}>
        {/* Step Header */}
        {(stepTitle || stepSubtitle) && (
          <MMModalStepHeader title={stepTitle || ''} subtitle={stepSubtitle} />
        )}

        {/* Step Content */}
        {renderStep ? renderStep(currentStep) : children}
      </div>
    </MMModal>
  );
}

// ============================================
// Wizard Step Component
// ============================================

interface MMWizardStepProps {
  /** Current step index */
  currentStep: number;
  /** This step's index */
  stepIndex: number;
  /** Step content */
  children: ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * Helper component for conditionally rendering step content
 */
export function MMWizardStep({ currentStep, stepIndex, children, className }: MMWizardStepProps) {
  if (currentStep !== stepIndex) return null;
  
  return (
    <div className={cn('animate-in fade-in-50 duration-200', className)}>
      {children}
    </div>
  );
}

// ============================================
// Grid Layout Helpers
// ============================================

interface MMFormGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

/**
 * Responsive form grid layout
 */
export function MMFormGrid({ children, columns = 2, className }: MMFormGridProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <div className={cn('grid gap-4', gridClasses[columns], className)}>
      {children}
    </div>
  );
}

/**
 * Full-width form row
 */
export function MMFormRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('col-span-full', className)}>{children}</div>;
}

export default MMModalWizard;
