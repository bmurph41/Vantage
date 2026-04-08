/**
 * Vantage UI Design System
 * Type Definitions & Shared Utilities
 */

import { ReactNode, ComponentPropsWithoutRef } from 'react';

// ============================================
// Design Tokens as TypeScript Types
// ============================================

export type MMSize = 'sm' | 'md' | 'lg';
export type MMVariant = 'default' | 'error' | 'success';

// ============================================
// Modal Types
// ============================================

export interface MMModalStep {
  label: string;
  title?: string;
  subtitle?: string;
}

export interface MMModalBaseProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title: string;
  /** Modal subtitle */
  subtitle?: string;
  /** Icon component to display in header */
  icon?: ReactNode;
  /** Steps for wizard progress dots */
  steps?: MMModalStep[];
  /** Current active step (0-indexed) */
  activeStep?: number;
  /** Whether to show close button */
  showClose?: boolean;
  /** Whether clicking overlay dismisses modal */
  dismissOnOverlayClick?: boolean;
  /** Modal size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Modal content */
  children: ReactNode;
  /** Left footer content */
  footerLeft?: ReactNode;
  /** Right footer content */
  footerRight?: ReactNode;
  /** Class name for modal content */
  className?: string;
}

export interface MMModalWizardProps extends Omit<MMModalBaseProps, 'activeStep' | 'footerLeft' | 'footerRight'> {
  /** Steps configuration */
  steps: MMModalStep[];
  /** Callback when step changes */
  onStepChange?: (step: number) => void;
  /** Callback when Back is clicked */
  onBack?: () => void;
  /** Callback when Next/Submit is clicked */
  onNext?: () => void;
  /** Whether current step is valid for proceeding */
  isStepValid?: boolean;
  /** Whether the wizard is in a loading/submitting state */
  isLoading?: boolean;
  /** Custom back button label */
  backLabel?: string;
  /** Custom next button label */
  nextLabel?: string;
  /** Custom submit (last step) button label */
  submitLabel?: string;
  /** Hide back button on first step */
  hideBackOnFirstStep?: boolean;
  /** Render props for step content */
  renderStep?: (step: number) => ReactNode;
}

// ============================================
// Field Types
// ============================================

export interface MMFieldBaseProps {
  /** Field label */
  label?: string;
  /** Whether field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text to display below input */
  helperText?: string;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Field ID (auto-generated if not provided) */
  id?: string;
}

export interface MMInputProps extends MMFieldBaseProps, Omit<ComponentPropsWithoutRef<'input'>, 'size'> {
  /** Input size variant */
  size?: MMSize;
  /** Left icon/addon */
  leftIcon?: ReactNode;
  /** Right icon/addon */
  rightIcon?: ReactNode;
}

export interface MMSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MMSelectProps extends MMFieldBaseProps, Omit<ComponentPropsWithoutRef<'select'>, 'size'> {
  /** Select options */
  options: MMSelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Select size variant */
  size?: MMSize;
}

export interface MMTextareaProps extends MMFieldBaseProps, Omit<ComponentPropsWithoutRef<'textarea'>, 'size'> {
  /** Textarea size variant */
  size?: MMSize;
  /** Minimum height in rows */
  rows?: number;
  /** Enable auto-resize */
  autoResize?: boolean;
}

export interface MMComboBoxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface MMComboBoxProps extends MMFieldBaseProps {
  /** Available options */
  options: MMComboBoxOption[];
  /** Current value */
  value?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Allow custom values not in options */
  allowCustomValue?: boolean;
  /** Input size variant */
  size?: MMSize;
  /** Loading state for async options */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

export interface MMRadioCardOption {
  value: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface MMRadioCardGroupProps extends MMFieldBaseProps {
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
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique ID for form fields
 */
let idCounter = 0;
export function generateId(prefix: string = 'mm'): string {
  return `${prefix}-${++idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Merge class names, filtering out falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format phone number as user types
 */
export function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number | string, currency: string = 'USD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Keyboard event helpers
 */
export function isEnterKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter';
}

export function isEscapeKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Escape';
}

export function isTabKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Tab';
}

export function isArrowDown(event: React.KeyboardEvent): boolean {
  return event.key === 'ArrowDown';
}

export function isArrowUp(event: React.KeyboardEvent): boolean {
  return event.key === 'ArrowUp';
}
