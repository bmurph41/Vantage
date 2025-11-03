import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number | string;
  onValueChange?: (value: number | undefined) => void;
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, onBlur, onFocus, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState<string>('');
    const [isFocused, setIsFocused] = useState(false);

    // Format number with commas
    const formatCurrency = (val: number): string => {
      return val.toLocaleString('en-US');
    };

    // Parse formatted string to number
    const parseCurrency = (val: string): number | undefined => {
      const cleaned = val.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    };

    // Update display value when prop value changes
    useEffect(() => {
      if (!isFocused) {
        const numValue = typeof value === 'string' ? parseCurrency(value) : value;
        if (numValue !== undefined && !isNaN(numValue)) {
          setDisplayValue(formatCurrency(numValue));
        } else {
          setDisplayValue('');
        }
      }
    }, [value, isFocused]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Show raw number without formatting when focused
      const numValue = typeof value === 'string' ? parseCurrency(value) : value;
      if (numValue !== undefined && !isNaN(numValue)) {
        setDisplayValue(numValue.toString());
      }
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // Format with commas when blurred
      const parsed = parseCurrency(displayValue);
      if (parsed !== undefined) {
        setDisplayValue(formatCurrency(parsed));
      }
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setDisplayValue(inputValue);
      
      const parsed = parseCurrency(inputValue);
      onValueChange?.(parsed);
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
          $
        </span>
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn("pl-7", className)}
          placeholder="0"
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
