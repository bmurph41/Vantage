/**
 * MMComboBox - Autocomplete/Combobox Component
 * 
 * Styled combobox that matches the Vantage Modal Standard:
 * - Light gray background
 * - Subtle border with rounded corners
 * - Blue focus ring
 * - Dropdown with filtered options
 * - Keyboard navigation support
 */

import React, {
  forwardRef,
  useState,
  useRef,
  useCallback,
  useEffect,
  KeyboardEvent,
} from 'react';
import { cn, generateId } from './types';
import { ChevronDown, Check, Loader2, X } from 'lucide-react';

interface MMComboBoxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface MMComboBoxProps {
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
  /** Loading state for async options */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
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
  /** Disabled state */
  disabled?: boolean;
  /** Input ID */
  id?: string;
  /** ClassName */
  className?: string;
  /** Clearable */
  clearable?: boolean;
}

export const MMComboBox = forwardRef<HTMLInputElement, MMComboBoxProps>(
  (
    {
      options,
      value = '',
      onChange,
      placeholder = 'Search...',
      allowCustomValue = false,
      isLoading = false,
      emptyMessage = 'No results found',
      error,
      label,
      required,
      errorMessage,
      helperText,
      disabled,
      id: providedId,
      className,
      clearable = true,
    },
    ref
  ) => {
    const id = providedId || generateId('mm-combobox');
    const hasError = error || !!errorMessage;
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Get the display value for the current selection
    const selectedOption = options.find((opt) => opt.value === value);

    // Filter options based on input
    const filteredOptions = options.filter((option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );

    // Sync input value with selected option
    useEffect(() => {
      if (!isOpen && selectedOption) {
        setInputValue(selectedOption.label);
      } else if (!isOpen && !selectedOption && !allowCustomValue) {
        setInputValue('');
      }
    }, [isOpen, selectedOption, allowCustomValue]);

    // Handle click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle option selection
    const selectOption = useCallback(
      (option: MMComboBoxOption) => {
        onChange?.(option.value);
        setInputValue(option.label);
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.focus();
      },
      [onChange]
    );

    // Handle keyboard navigation
    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev < filteredOptions.length - 1 ? prev + 1 : prev
            );
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case 'Enter':
          event.preventDefault();
          if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            selectOption(filteredOptions[highlightedIndex]);
          } else if (allowCustomValue && inputValue) {
            onChange?.(inputValue);
            setIsOpen(false);
          }
          break;

        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;

        case 'Tab':
          setIsOpen(false);
          break;
      }
    };

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setHighlightedIndex(-1);
      
      if (!isOpen) {
        setIsOpen(true);
      }

      if (allowCustomValue) {
        onChange?.(newValue);
      }
    };

    // Handle clear
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setInputValue('');
      onChange?.('');
      inputRef.current?.focus();
    };

    // Scroll highlighted option into view
    useEffect(() => {
      if (highlightedIndex >= 0 && listRef.current) {
        const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
        if (highlightedEl) {
          highlightedEl.scrollIntoView({ block: 'nearest' });
        }
      }
    }, [highlightedIndex]);

    const comboboxElement = (
      <div ref={containerRef} className={cn('relative', className)}>
        {/* Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            id={id}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={`${id}-listbox`}
            aria-invalid={hasError}
            aria-autocomplete="list"
            autoComplete="off"
            className={cn(
              'mm-input-base w-full h-11 px-4 pr-20 rounded-lg transition-all duration-200',
              hasError && 'mm-input-error'
            )}
            style={{
              backgroundColor: 'var(--mm-bg-input)',
              borderColor: hasError ? 'var(--mm-error-border)' : 'var(--mm-border-input)',
              color: 'var(--mm-text)',
            }}
          />

          {/* Right Icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading && (
              <Loader2 className="w-4 h-4 mm-spinner" style={{ color: 'var(--mm-text-muted)' }} />
            )}
            
            {clearable && inputValue && !isLoading && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                style={{ color: 'var(--mm-text-muted)' }}
                tabIndex={-1}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              style={{ color: 'var(--mm-text-muted)' }}
              tabIndex={-1}
            >
              <ChevronDown
                className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
              />
            </button>
          </div>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <ul
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            className="absolute z-50 w-full mt-1 py-1 rounded-lg shadow-lg overflow-auto mm-scrollbar"
            style={{
              backgroundColor: 'var(--mm-surface)',
              border: '1px solid var(--mm-border)',
              maxHeight: '240px',
            }}
          >
            {filteredOptions.length === 0 ? (
              <li
                className="px-4 py-3 text-sm"
                style={{ color: 'var(--mm-text-muted)' }}
              >
                {isLoading ? 'Loading...' : emptyMessage}
              </li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled}
                  onClick={() => !option.disabled && selectOption(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                    index === highlightedIndex && 'bg-gray-100',
                    option.value === value && 'bg-blue-50'
                  )}
                  style={{
                    color: 'var(--mm-text)',
                  }}
                >
                  <div>
                    <div className="text-sm font-medium">{option.label}</div>
                    {option.description && (
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--mm-text-muted)' }}
                      >
                        {option.description}
                      </div>
                    )}
                  </div>
                  {option.value === value && (
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--mm-primary)' }} />
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );

    // If no label, return just the combobox
    if (!label) {
      return comboboxElement;
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
        
        {comboboxElement}

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

MMComboBox.displayName = 'MMComboBox';

export default MMComboBox;
