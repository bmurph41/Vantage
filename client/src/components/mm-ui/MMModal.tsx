/**
 * MMModal - Base Modal Component
 * 
 * A reusable modal wrapper that enforces the Vantage Modal Standard:
 * - Header with icon, title, subtitle
 * - Thick blue brand divider
 * - Optional progress dots for wizards
 * - Pinned footer with Back/Next actions
 * - Focus trap, ESC close, overlay click handling
 * - Responsive sizing
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MMModalBaseProps, cn } from './types';
import { X } from 'lucide-react';

// Size mappings
const sizeClasses = {
  sm: 'max-w-[480px]',
  md: 'max-w-[640px]',
  lg: 'max-w-[860px]',
  xl: 'max-w-[960px]',
};

export function MMModal({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  steps,
  activeStep = 0,
  showClose = true,
  dismissOnOverlayClick = true,
  size = 'lg',
  children,
  footerLeft,
  footerRight,
  className,
}: MMModalBaseProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle ESC key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onOpenChange(false);
      }
    },
    [open, onOpenChange]
  );

  // Focus trap
  const handleTabKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    []
  );

  // Setup event listeners and focus management
  useEffect(() => {
    if (open) {
      // Store currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      // Add event listeners
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleTabKey);

      // Focus first focusable element
      setTimeout(() => {
        const firstInput = modalRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
        } else {
          modalRef.current?.focus();
        }
      }, 50);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keydown', handleTabKey);
        
        // Restore focus
        previousActiveElement.current?.focus();
      };
    }
  }, [open, handleKeyDown, handleTabKey]);

  // Handle overlay click
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (dismissOnOverlayClick && event.target === event.currentTarget) {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--mm-overlay)' }}
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="mm-modal-title"
      aria-describedby={subtitle ? 'mm-modal-subtitle' : undefined}
    >
      {/* Modal Container */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative flex flex-col w-[95vw] max-h-[90vh]',
          'bg-white rounded-xl shadow-2xl',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          sizeClasses[size],
          className
        )}
        style={{
          backgroundColor: 'var(--mm-surface)',
          borderRadius: 'var(--mm-radius-xl)',
          boxShadow: 'var(--mm-shadow-modal)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            {/* Left: Icon + Title */}
            <div className="flex items-start gap-3">
              {icon && (
                <div
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--mm-primary)',
                  }}
                >
                  {icon}
                </div>
              )}
              <div>
                <h2
                  id="mm-modal-title"
                  className="text-xl font-semibold"
                  style={{ color: 'var(--mm-text)' }}
                >
                  {title}
                </h2>
                {subtitle && (
                  <p
                    id="mm-modal-subtitle"
                    className="mt-1 text-sm"
                    style={{ color: 'var(--mm-text-secondary)' }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Progress Dots + Close */}
            <div className="flex items-center gap-4">
              {/* Progress Dots */}
              {steps && steps.length > 1 && (
                <div className="flex items-center gap-2" role="navigation" aria-label="Wizard progress">
                  {steps.map((step, index) => (
                    <div
                      key={index}
                      className={cn(
                        'mm-progress-dot',
                        index === activeStep && 'mm-progress-dot-active',
                        index < activeStep && 'mm-progress-dot-completed'
                      )}
                      aria-label={`Step ${index + 1}: ${step.label}${
                        index === activeStep ? ' (current)' : index < activeStep ? ' (completed)' : ''
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Close Button */}
              {showClose && (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                  style={{ color: 'var(--mm-text-muted)' }}
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Brand Divider */}
          <div
            className="mt-4 w-full"
            style={{
              height: 'var(--mm-divider-height)',
              backgroundColor: 'var(--mm-divider-color)',
              borderRadius: '2px',
            }}
          />
        </div>

        {/* Body - Scrollable */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4 mm-scrollbar"
          style={{ minHeight: 0 }}
        >
          {children}
        </div>

        {/* Footer - Pinned */}
        {(footerLeft || footerRight) && (
          <div
            className="flex-shrink-0 flex items-center justify-between px-6 py-4"
            style={{
              borderTop: '1px solid var(--mm-border)',
              backgroundColor: 'var(--mm-surface-muted)',
              borderRadius: '0 0 var(--mm-radius-xl) var(--mm-radius-xl)',
            }}
          >
            <div>{footerLeft}</div>
            <div>{footerRight}</div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// ============================================
// Modal Sub-components
// ============================================

interface MMModalStepHeaderProps {
  title: string;
  subtitle?: string;
}

export function MMModalStepHeader({ title, subtitle }: MMModalStepHeaderProps) {
  return (
    <div className="text-center mb-6">
      <h3
        className="text-lg font-semibold"
        style={{ color: 'var(--mm-text)' }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--mm-text-secondary)' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface MMModalSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function MMModalSection({ title, children, className }: MMModalSectionProps) {
  return (
    <div className={cn('mb-6', className)}>
      {title && (
        <h4
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--mm-text-secondary)' }}
        >
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}

export default MMModal;
