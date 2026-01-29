/**
 * MMRadioCardGroup - Radio Card Selection Component
 * 
 * Styled radio cards that match the MarinaMatch Modal Standard:
 * - Clean card layout with icon, title, description
 * - Blue border/highlight when selected
 * - Keyboard navigation support
 * - Responsive grid layouts
 */

import React, { ReactNode, useId, useCallback, KeyboardEvent } from 'react';
import { cn, generateId } from './types';
import { Check } from 'lucide-react';

interface MMRadioCardOption {
  value: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface MMRadioCardGroupProps {
  /** Available options */
  options: MMRadioCardOption[];
  /** Current value */
  value?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Number of columns (for grid layout) */
  columns?: 1 | 2 | 3;
  /** Full field with label, error, helper */
  label?: string;
  /** Required indicator */
  required?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Field ID */
  id?: string;
  /** ClassName */
  className?: string;
  /** Card size variant */
  size?: 'sm' | 'md' | 'lg';
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

const sizeClasses = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function MMRadioCardGroup({
  options,
  value,
  onChange,
  direction = 'vertical',
  columns = 1,
  label,
  required,
  errorMessage,
  helperText,
  disabled,
  id: providedId,
  className,
  size = 'md',
}: MMRadioCardGroupProps) {
  const groupId = providedId || generateId('mm-radio-group');
  const reactId = useId();

  // Handle selection
  const handleSelect = useCallback(
    (optionValue: string) => {
      if (disabled) return;
      onChange?.(optionValue);
    },
    [disabled, onChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, optionValue: string, index: number) => {
      const enabledOptions = options.filter((o) => !o.disabled);
      const currentEnabledIndex = enabledOptions.findIndex((o) => o.value === optionValue);

      let nextOption: MMRadioCardOption | undefined;

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          nextOption = enabledOptions[(currentEnabledIndex + 1) % enabledOptions.length];
          break;

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          nextOption = enabledOptions[(currentEnabledIndex - 1 + enabledOptions.length) % enabledOptions.length];
          break;

        case ' ':
        case 'Enter':
          event.preventDefault();
          handleSelect(optionValue);
          return;
      }

      if (nextOption) {
        handleSelect(nextOption.value);
        // Focus the next card
        const nextElement = document.querySelector(
          `[data-radio-value="${nextOption.value}"]`
        ) as HTMLElement;
        nextElement?.focus();
      }
    },
    [options, handleSelect]
  );

  const radioGroup = (
    <div
      role="radiogroup"
      aria-labelledby={label ? `${groupId}-label` : undefined}
      className={cn(
        'grid gap-3',
        direction === 'horizontal' ? columnClasses[columns] : 'grid-cols-1',
        className
      )}
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isDisabled = disabled || option.disabled;
        const optionId = `${groupId}-${option.value}`;

        return (
          <div
            key={option.value}
            data-radio-value={option.value}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : isSelected || (!value && index === 0) ? 0 : -1}
            onClick={() => !isDisabled && handleSelect(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option.value, index)}
            className={cn(
              'mm-radio-card relative cursor-pointer rounded-xl transition-all duration-200',
              sizeClasses[size],
              isSelected && 'mm-radio-card-selected',
              isDisabled && 'opacity-50 cursor-not-allowed',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            )}
            style={{
              backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.04)' : 'var(--mm-surface)',
              borderColor: isSelected ? 'var(--mm-primary)' : 'var(--mm-border)',
              borderWidth: '2px',
              borderStyle: 'solid',
              boxShadow: isSelected ? '0 0 0 1px var(--mm-primary)' : undefined,
            }}
          >
            {/* Hidden radio input for form submission */}
            <input
              type="radio"
              id={optionId}
              name={groupId}
              value={option.value}
              checked={isSelected}
              disabled={isDisabled}
              onChange={() => handleSelect(option.value)}
              className="sr-only"
            />

            <div className="flex items-start gap-3">
              {/* Icon */}
              {option.icon && (
                <div
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: isSelected
                      ? 'rgba(37, 99, 235, 0.1)'
                      : 'var(--mm-bg)',
                    color: isSelected ? 'var(--mm-primary)' : 'var(--mm-text-secondary)',
                  }}
                >
                  {option.icon}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div
                  className="font-medium"
                  style={{ color: 'var(--mm-text)' }}
                >
                  {option.title}
                </div>
                {option.description && (
                  <div
                    className="text-sm mt-0.5"
                    style={{ color: 'var(--mm-text-secondary)' }}
                  >
                    {option.description}
                  </div>
                )}
              </div>

              {/* Check indicator */}
              {isSelected && (
                <div
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--mm-primary)' }}
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // If no label, return just the radio group
  if (!label) {
    return radioGroup;
  }

  // Return full field with label
  return (
    <div className="mm-field">
      <label
        id={`${groupId}-label`}
        className="block mb-3 text-sm font-medium"
        style={{ color: 'var(--mm-text)' }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--mm-error)' }} className="ml-0.5">
            *
          </span>
        )}
      </label>
      
      {radioGroup}

      {(errorMessage || helperText) && (
        <p
          className="mt-2 text-xs"
          style={{ color: errorMessage ? 'var(--mm-error)' : 'var(--mm-text-muted)' }}
          role={errorMessage ? 'alert' : undefined}
        >
          {errorMessage || helperText}
        </p>
      )}
    </div>
  );
}

// ============================================
// Simplified Single Radio Card
// ============================================

interface MMRadioCardProps {
  /** Card value */
  value: string;
  /** Card title */
  title: string;
  /** Card description */
  description?: string;
  /** Card icon */
  icon?: ReactNode;
  /** Whether this card is selected */
  selected?: boolean;
  /** Callback when selected */
  onSelect?: (value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** ClassName */
  className?: string;
}

export function MMRadioCard({
  value,
  title,
  description,
  icon,
  selected,
  onSelect,
  disabled,
  size = 'md',
  className,
}: MMRadioCardProps) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect?.(value)}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
          e.preventDefault();
          onSelect?.(value);
        }
      }}
      className={cn(
        'mm-radio-card relative cursor-pointer rounded-xl transition-all duration-200',
        sizeClasses[size],
        selected && 'mm-radio-card-selected',
        disabled && 'opacity-50 cursor-not-allowed',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className
      )}
      style={{
        backgroundColor: selected ? 'rgba(37, 99, 235, 0.04)' : 'var(--mm-surface)',
        borderColor: selected ? 'var(--mm-primary)' : 'var(--mm-border)',
        borderWidth: '2px',
        borderStyle: 'solid',
        boxShadow: selected ? '0 0 0 1px var(--mm-primary)' : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg"
            style={{
              backgroundColor: selected ? 'rgba(37, 99, 235, 0.1)' : 'var(--mm-bg)',
              color: selected ? 'var(--mm-primary)' : 'var(--mm-text-secondary)',
            }}
          >
            {icon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="font-medium" style={{ color: 'var(--mm-text)' }}>
            {title}
          </div>
          {description && (
            <div className="text-sm mt-0.5" style={{ color: 'var(--mm-text-secondary)' }}>
              {description}
            </div>
          )}
        </div>

        {selected && (
          <div
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--mm-primary)' }}
          >
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>
    </div>
  );
}

export default MMRadioCardGroup;
