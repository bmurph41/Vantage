/**
 * MMInput - Text Input Component
 * 
 * Styled input that matches the MarinaMatch Modal Standard:
 * - Light gray background
 * - Subtle border with rounded corners
 * - Blue focus ring
 * - Error state with red border/ring
 * - Support for icons and addons
 */

import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { cn, generateId } from './types';

type MMSize = 'sm' | 'md' | 'lg';

interface MMInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input size variant */
  size?: MMSize;
  /** Left icon/addon */
  leftIcon?: ReactNode;
  /** Right icon/addon */
  rightIcon?: ReactNode;
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
}

const sizeClasses = {
  sm: 'h-9 text-sm px-3',
  md: 'h-11 text-base px-4',
  lg: 'h-13 text-base px-4',
};

export const MMInput = forwardRef<HTMLInputElement, MMInputProps>(
  (
    {
      size = 'md',
      leftIcon,
      rightIcon,
      error,
      label,
      required,
      errorMessage,
      helperText,
      className,
      disabled,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const id = providedId || generateId('mm-input');
    const hasError = error || !!errorMessage;

    const inputElement = (
      <div className="relative">
        {/* Left Icon */}
        {leftIcon && (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--mm-text-muted)' }}
          >
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            errorMessage ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={cn(
            'mm-input-base w-full rounded-lg transition-all duration-200',
            sizeClasses[size],
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            hasError && 'mm-input-error',
            className
          )}
          style={{
            backgroundColor: 'var(--mm-bg-input)',
            borderColor: hasError ? 'var(--mm-error-border)' : 'var(--mm-border-input)',
            color: 'var(--mm-text)',
          }}
          {...props}
        />

        {/* Right Icon */}
        {rightIcon && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--mm-text-muted)' }}
          >
            {rightIcon}
          </div>
        )}
      </div>
    );

    // If no label, return just the input
    if (!label) {
      return inputElement;
    }

    // Return full field with label
    return (
      <div className="mm-field">
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
        
        {inputElement}

        {(errorMessage || helperText) && (
          <p
            id={errorMessage ? `${id}-error` : `${id}-helper`}
            className="mt-1.5 text-xs"
            style={{ color: errorMessage ? 'var(--mm-error)' : 'var(--mm-text-muted)' }}
            role={errorMessage ? 'alert' : undefined}
          >
            {errorMessage || helperText}
          </p>
        )}
      </div>
    );
  }
);

MMInput.displayName = 'MMInput';

// ============================================
// Specialized Input Variants
// ============================================

interface MMEmailInputProps extends Omit<MMInputProps, 'type'> {}

export const MMEmailInput = forwardRef<HTMLInputElement, MMEmailInputProps>(
  (props, ref) => {
    return (
      <MMInput
        ref={ref}
        type="email"
        autoComplete="email"
        {...props}
      />
    );
  }
);

MMEmailInput.displayName = 'MMEmailInput';

interface MMPhoneInputProps extends Omit<MMInputProps, 'type'> {}

export const MMPhoneInput = forwardRef<HTMLInputElement, MMPhoneInputProps>(
  (props, ref) => {
    return (
      <MMInput
        ref={ref}
        type="tel"
        autoComplete="tel"
        {...props}
      />
    );
  }
);

MMPhoneInput.displayName = 'MMPhoneInput';

interface MMCurrencyInputProps extends Omit<MMInputProps, 'type' | 'onChange'> {
  currency?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const formatCurrency = (value: string): string => {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
};

export const MMCurrencyInput = forwardRef<HTMLInputElement, MMCurrencyInputProps>(
  ({ currency = '$', value, onChange, ...props }, ref) => {
    const displayValue = value ? formatCurrency(String(value)) : '';
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/[^0-9]/g, '');
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: rawValue,
        },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticEvent);
    };

    return (
      <MMInput
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        leftIcon={<span className="text-sm font-medium">{currency}</span>}
        {...props}
      />
    );
  }
);

MMCurrencyInput.displayName = 'MMCurrencyInput';

interface MMSearchInputProps extends Omit<MMInputProps, 'type'> {}

export const MMSearchInput = forwardRef<HTMLInputElement, MMSearchInputProps>(
  (props, ref) => {
    return (
      <MMInput
        ref={ref}
        type="search"
        leftIcon={
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        }
        {...props}
      />
    );
  }
);

MMSearchInput.displayName = 'MMSearchInput';

export default MMInput;
