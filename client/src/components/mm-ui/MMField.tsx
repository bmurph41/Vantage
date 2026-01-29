/**
 * MMField - Form Field Wrapper Component
 * 
 * Provides consistent layout for form fields:
 * - Label with optional required indicator
 * - Slot for input component
 * - Helper text
 * - Error message display
 */

import React, { ReactNode, createContext, useContext, useMemo } from 'react';
import { MMFieldBaseProps, generateId, cn } from './types';

// Context for field state
interface MMFieldContextValue {
  id: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

const MMFieldContext = createContext<MMFieldContextValue | null>(null);

export function useMMField() {
  const context = useContext(MMFieldContext);
  if (!context) {
    throw new Error('useMMField must be used within an MMField');
  }
  return context;
}

interface MMFieldProps extends MMFieldBaseProps {
  children: ReactNode;
  className?: string;
}

export function MMField({
  label,
  required,
  error,
  helperText,
  disabled,
  id: providedId,
  children,
  className,
}: MMFieldProps) {
  const id = useMemo(() => providedId || generateId('mm-field'), [providedId]);
  
  const contextValue = useMemo(
    () => ({ id, error, disabled, required }),
    [id, error, disabled, required]
  );

  return (
    <MMFieldContext.Provider value={contextValue}>
      <div className={cn('mm-field', className)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={id}
            className="block mb-1.5 text-sm font-medium"
            style={{ color: 'var(--mm-text)' }}
          >
            {label}
            {required && (
              <span
                className="ml-0.5"
                style={{ color: 'var(--mm-error)' }}
                aria-hidden="true"
              >
                *
              </span>
            )}
          </label>
        )}

        {/* Input Slot */}
        {children}

        {/* Helper Text or Error */}
        {(error || helperText) && (
          <p
            className="mt-1.5 text-xs"
            style={{
              color: error ? 'var(--mm-error)' : 'var(--mm-text-muted)',
            }}
            role={error ? 'alert' : undefined}
          >
            {error || helperText}
          </p>
        )}
      </div>
    </MMFieldContext.Provider>
  );
}

// ============================================
// Standalone Label Component
// ============================================

interface MMLabelProps {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function MMLabel({ htmlFor, required, children, className }: MMLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block mb-1.5 text-sm font-medium', className)}
      style={{ color: 'var(--mm-text)' }}
    >
      {children}
      {required && (
        <span
          className="ml-0.5"
          style={{ color: 'var(--mm-error)' }}
          aria-hidden="true"
        >
          *
        </span>
      )}
    </label>
  );
}

// ============================================
// Error Text Component
// ============================================

interface MMErrorTextProps {
  children: ReactNode;
  className?: string;
}

export function MMErrorText({ children, className }: MMErrorTextProps) {
  if (!children) return null;
  
  return (
    <p
      className={cn('mt-1.5 text-xs', className)}
      style={{ color: 'var(--mm-error)' }}
      role="alert"
    >
      {children}
    </p>
  );
}

// ============================================
// Helper Text Component
// ============================================

interface MMHelperTextProps {
  children: ReactNode;
  className?: string;
}

export function MMHelperText({ children, className }: MMHelperTextProps) {
  if (!children) return null;
  
  return (
    <p
      className={cn('mt-1.5 text-xs', className)}
      style={{ color: 'var(--mm-text-muted)' }}
    >
      {children}
    </p>
  );
}

export default MMField;
