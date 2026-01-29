/**
 * MMTextarea - Textarea Component
 * 
 * Styled textarea that matches the MarinaMatch Modal Standard:
 * - Light gray background
 * - Subtle border with rounded corners
 * - Blue focus ring
 * - Error state with red border/ring
 * - Optional auto-resize
 */

import React, { forwardRef, TextareaHTMLAttributes, useEffect, useRef, useCallback } from 'react';
import { cn, generateId } from './types';

type MMSize = 'sm' | 'md' | 'lg';

interface MMTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** Textarea size variant */
  size?: MMSize;
  /** Minimum height in rows */
  rows?: number;
  /** Enable auto-resize */
  autoResize?: boolean;
  /** Maximum height when auto-resizing */
  maxHeight?: number;
  /** Error state */
  error?: boolean;
  /** Full field with label, error, helper */
  label?: string;
  /** Required indicator */
  required?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Character count limit */
  maxLength?: number;
  /** Show character count */
  showCharCount?: boolean;
}

const sizeClasses = {
  sm: 'text-sm p-3',
  md: 'text-base p-4',
  lg: 'text-base p-4',
};

export const MMTextarea = forwardRef<HTMLTextAreaElement, MMTextareaProps>(
  (
    {
      size = 'md',
      rows = 4,
      autoResize = false,
      maxHeight = 300,
      error,
      label,
      required,
      errorMessage,
      helperText,
      maxLength,
      showCharCount = false,
      className,
      disabled,
      value,
      onChange,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const id = providedId || generateId('mm-textarea');
    const hasError = error || !!errorMessage;
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    // Auto-resize logic
    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea || !autoResize) return;

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Set the height to scrollHeight, capped at maxHeight
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }, [autoResize, maxHeight, textareaRef]);

    // Adjust height on value change
    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Handle change with auto-resize
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      if (autoResize) {
        adjustHeight();
      }
    };

    const charCount = typeof value === 'string' ? value.length : 0;

    const textareaElement = (
      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          rows={rows}
          disabled={disabled}
          value={value}
          onChange={handleChange}
          maxLength={maxLength}
          aria-invalid={hasError}
          aria-describedby={
            errorMessage ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={cn(
            'mm-input-base w-full rounded-lg resize-none transition-all duration-200',
            sizeClasses[size],
            hasError && 'mm-input-error',
            autoResize && 'overflow-hidden',
            className
          )}
          style={{
            backgroundColor: 'var(--mm-bg-input)',
            borderColor: hasError ? 'var(--mm-error-border)' : 'var(--mm-border-input)',
            color: 'var(--mm-text)',
            minHeight: `${rows * 1.5}em`,
          }}
          {...props}
        />
      </div>
    );

    // If no label, return just the textarea
    if (!label && !showCharCount) {
      return textareaElement;
    }

    // Return full field with label
    return (
      <div className="mm-field">
        {label && (
          <label
            htmlFor={id}
            className="block mb-1.5 text-sm font-medium"
            style={{ color: 'var(--mm-text)' }}
          >
            {label}
            {required && (
              <span style={{ color: 'var(--mm-error)' }} className="ml-0.5">
                *
              </span>
            )}
          </label>
        )}
        
        {textareaElement}

        <div className="flex items-center justify-between mt-1.5">
          <div>
            {(errorMessage || helperText) && (
              <p
                id={errorMessage ? `${id}-error` : `${id}-helper`}
                className="text-xs"
                style={{ color: errorMessage ? 'var(--mm-error)' : 'var(--mm-text-muted)' }}
                role={errorMessage ? 'alert' : undefined}
              >
                {errorMessage || helperText}
              </p>
            )}
          </div>
          
          {showCharCount && maxLength && (
            <p
              className="text-xs"
              style={{
                color: charCount >= maxLength ? 'var(--mm-error)' : 'var(--mm-text-muted)',
              }}
            >
              {charCount}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

MMTextarea.displayName = 'MMTextarea';

export default MMTextarea;
