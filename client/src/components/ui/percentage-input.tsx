import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PercentageInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number | string;
  onValueChange?: (value: number | undefined) => void;
}

const PercentageInput = forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ className, value, onValueChange, onBlur, onFocus, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState<string>('');
    const [isFocused, setIsFocused] = useState(false);

    // Format number as percentage (0.00%)
    const formatPercentage = (val: number): string => {
      return val.toFixed(2);
    };

    // Parse formatted string to number
    const parsePercentage = (val: string): number | undefined => {
      const cleaned = val.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    };

    // Update display value when prop value changes
    useEffect(() => {
      if (!isFocused) {
        const numValue = typeof value === 'string' ? parsePercentage(value) : value;
        if (numValue !== undefined && !isNaN(numValue)) {
          setDisplayValue(formatPercentage(numValue));
        } else {
          setDisplayValue('');
        }
      }
    }, [value, isFocused]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Show raw number without formatting when focused
      const numValue = typeof value === 'string' ? parsePercentage(value) : value;
      if (numValue !== undefined && !isNaN(numValue)) {
        setDisplayValue(numValue.toString());
      }
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // Format with one decimal when blurred
      const parsed = parsePercentage(displayValue);
      if (parsed !== undefined) {
        setDisplayValue(formatPercentage(parsed));
      }
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setDisplayValue(inputValue);
      
      const parsed = parsePercentage(inputValue);
      onValueChange?.(parsed);
    };

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn("pr-7", className)}
          placeholder="0.00"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
          %
        </span>
      </div>
    );
  }
);

PercentageInput.displayName = "PercentageInput";

export { PercentageInput };
