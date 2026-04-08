import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption<TValue = string> {
  label: string;
  value: TValue;
  disabled?: boolean;
}

interface MultiSelectDropdownProps<TValue = string> {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption<TValue>[];
  value: TValue[];
  onChange: (next: TValue[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  showSelectAll?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  maxHeight?: number;
  icon?: React.ReactNode;
  testId?: string;
  renderTriggerLabel?: (selectedOptions: MultiSelectOption<TValue>[]) => string;
}

export function MultiSelectDropdown<TValue = string>({
  label,
  placeholder = "Select...",
  options,
  value,
  onChange,
  searchable = true,
  searchPlaceholder = "Search...",
  showSelectAll = true,
  disabled = false,
  className,
  triggerClassName,
  maxHeight = 300,
  icon,
  testId,
  renderTriggerLabel,
}: MultiSelectDropdownProps<TValue>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const pluralize = useCallback((word: string): string => {
    if (word === 'Category') return 'Categories';
    if (word.endsWith('y') && !['Key', 'Day', 'Way'].includes(word)) return word.slice(0, -1) + 'ies';
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) return word + 'es';
    return word + 's';
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        String(opt.value).toLowerCase().includes(query)
    );
  }, [options, search]);

  const selectedOptions = useMemo(() => {
    return options.filter((opt) => value.includes(opt.value));
  }, [options, value]);

  const handleSelect = useCallback(
    (optValue: TValue) => {
      const option = options.find((o) => o.value === optValue);
      if (option?.disabled) return;

      const isSelected = value.includes(optValue);
      const newValue = isSelected
        ? value.filter((v) => v !== optValue)
        : [...value, optValue];
      onChange(newValue);
    },
    [options, value, onChange]
  );

  const handleSelectAll = useCallback(() => {
    const enabledOptions = options.filter((o) => !o.disabled);
    onChange(enabledOptions.map((o) => o.value));
  }, [options, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const getTriggerLabel = (): string => {
    if (renderTriggerLabel) {
      return renderTriggerLabel(selectedOptions);
    }

    if (selectedOptions.length === 0) {
      if (placeholder) return placeholder;
      return label ? `All ${pluralize(label)}` : "Select...";
    }

    if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    }

    if (selectedOptions.length === 2) {
      return selectedOptions.map((o) => o.label).join(", ");
    }

    const labelText = label || "items";
    return `${selectedOptions.length} ${pluralize(labelText).toLowerCase()}`;
  };

  const labelPlural = label ? pluralize(label) : "items";
  const labelPluralLower = labelPlural.toLowerCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal min-w-[180px]",
            !selectedOptions.length && "text-muted-foreground",
            triggerClassName
          )}
          data-testid={testId}
        >
          <span className="flex items-center gap-2 truncate">
            {icon}
            <span className="truncate">{getTriggerLabel()}</span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("w-full max-w-[300px] p-0", className)} 
        align="start"
        style={{ maxHeight: maxHeight + 100 }}
      >
        <Command shouldFilter={false}>
          {searchable && (
            <CommandInput
              placeholder={searchPlaceholder || `Search ${labelPluralLower}...`}
              value={search}
              onValueChange={setSearch}
              data-testid={testId ? `${testId}-search` : undefined}
            />
          )}
          <CommandList style={{ maxHeight }}>
            <CommandEmpty>No {label?.toLowerCase() || "options"} found.</CommandEmpty>
            <CommandGroup>
              {showSelectAll && (
                <div className="p-2 border-b flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {selectedOptions.length} of {options.length} selected
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectAll();
                      }}
                      className="h-7 text-xs"
                      data-testid={testId ? `${testId}-select-all` : `button-select-all-${labelPluralLower}`}
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClearAll();
                      }}
                      className="h-7 text-xs"
                      data-testid={testId ? `${testId}-clear-all` : `button-clear-${labelPluralLower}`}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              {filteredOptions.map((option) => {
                const isSelected = value.includes(option.value);
                const optionId = String(option.value)
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "");
                return (
                  <CommandItem
                    key={String(option.value)}
                    value={String(option.value)}
                    onSelect={() => handleSelect(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      "cursor-pointer",
                      option.disabled && "opacity-50 cursor-not-allowed"
                    )}
                    data-testid={testId ? `${testId}-option-${optionId}` : `option-${label?.toLowerCase() || "item"}-${optionId}`}
                    aria-label={`${isSelected ? "Deselect" : "Select"} ${option.label}`}
                    aria-selected={isSelected}
                    role="option"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        checked={isSelected}
                        disabled={option.disabled}
                        className="pointer-events-none"
                        data-testid={testId ? `${testId}-checkbox-${optionId}` : `checkbox-filter-${label?.toLowerCase() || "item"}-${optionId}`}
                      />
                      <span className="truncate">{option.label}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 ml-auto shrink-0" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function toMultiSelectOptions<T extends string>(
  values: T[],
  labelFn?: (value: T) => string
): MultiSelectOption<T>[] {
  return values.map((value) => ({
    label: labelFn ? labelFn(value) : value,
    value,
  }));
}

export default MultiSelectDropdown;
