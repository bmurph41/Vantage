/**
 * MMSelect - Select/Dropdown Component
 * 
 * Styled select that matches the MarinaMatch Modal Standard:
 * - Light gray background
 * - Subtle border with rounded corners
 * - Blue focus ring
 * - Error state with red border/ring
 * - Custom chevron indicator
 */

import React, { forwardRef, SelectHTMLAttributes } from 'react';
import { cn, generateId } from './types';
import { ChevronDown } from 'lucide-react';

type MMSize = 'sm' | 'md' | 'lg';

interface MMSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MMSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Select options */
  options: MMSelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Select size variant */
  size?: MMSize;
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
  sm: 'h-9 text-sm px-3 pr-9',
  md: 'h-11 text-base px-4 pr-10',
  lg: 'h-13 text-base px-4 pr-10',
};

export const MMSelect = forwardRef<HTMLSelectElement, MMSelectProps>(
  (
    {
      options,
      placeholder,
      size = 'md',
      error,
      label,
      required,
      errorMessage,
      helperText,
      className,
      disabled,
      value,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const id = providedId || generateId('mm-select');
    const hasError = error || !!errorMessage;
    const hasValue = value !== undefined && value !== '';

    const selectElement = (
      <div className="relative">
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          value={value}
          aria-invalid={hasError}
          aria-describedby={
            errorMessage ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={cn(
            'mm-input-base w-full rounded-lg appearance-none cursor-pointer transition-all duration-200',
            sizeClasses[size],
            hasError && 'mm-input-error',
            !hasValue && placeholder && 'text-gray-400',
            className
          )}
          style={{
            backgroundColor: 'var(--mm-bg-input)',
            borderColor: hasError ? 'var(--mm-error-border)' : 'var(--mm-border-input)',
            color: hasValue ? 'var(--mm-text)' : 'var(--mm-text-placeholder)',
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Chevron Icon */}
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--mm-text-muted)' }}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    );

    // If no label, return just the select
    if (!label) {
      return selectElement;
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
        
        {selectElement}

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

MMSelect.displayName = 'MMSelect';

// ============================================
// Country Select Preset
// ============================================

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  // Add more as needed
];

interface MMCountrySelectProps extends Omit<MMSelectProps, 'options'> {
  options?: MMSelectOption[];
}

export const MMCountrySelect = forwardRef<HTMLSelectElement, MMCountrySelectProps>(
  ({ options = COUNTRIES, placeholder = 'Select country', ...props }, ref) => {
    return <MMSelect ref={ref} options={options} placeholder={placeholder} {...props} />;
  }
);

MMCountrySelect.displayName = 'MMCountrySelect';

// ============================================
// US State Select Preset
// ============================================

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

interface MMStateSelectProps extends Omit<MMSelectProps, 'options'> {
  options?: MMSelectOption[];
}

export const MMStateSelect = forwardRef<HTMLSelectElement, MMStateSelectProps>(
  ({ options = US_STATES, placeholder = 'State', ...props }, ref) => {
    return <MMSelect ref={ref} options={options} placeholder={placeholder} {...props} />;
  }
);

MMStateSelect.displayName = 'MMStateSelect';

export default MMSelect;
