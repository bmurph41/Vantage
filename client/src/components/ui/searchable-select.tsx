import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  testId?: string;
  maxDisplayItems?: number; // Limit initial display for performance
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  emptyText = "No results found",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
  testId,
  maxDisplayItems = 100, // Show max 100 items before search
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((option) => option.value === value);

  // Filter and limit options for performance
  const displayedOptions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    // If there's a search query, filter and limit results
    if (query) {
      const filtered = options.filter((option) =>
        option.label.toLowerCase().includes(query)
      );
      // Limit search results to prevent rendering too many items
      return filtered.slice(0, Math.max(maxDisplayItems, 200));
    }
    
    // Without search, show selected option plus limited set
    const selectedIdx = options.findIndex((opt) => opt.value === value);
    if (selectedIdx !== -1 && selectedIdx >= maxDisplayItems) {
      // If selected is beyond limit, include it
      return [
        options[selectedIdx],
        ...options.filter((_, idx) => idx < maxDisplayItems && idx !== selectedIdx)
      ];
    }
    
    // Otherwise just show first N items
    return options.slice(0, maxDisplayItems);
  }, [options, searchQuery, value, maxDisplayItems]);

  // Track if search results were limited
  const searchResultsLimited = useMemo(() => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase().trim();
    const totalMatches = options.filter((option) =>
      option.label.toLowerCase().includes(query)
    ).length;
    return totalMatches > Math.max(maxDisplayItems, 200);
  }, [options, searchQuery, maxDisplayItems]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchQuery("");
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
          data-testid={testId}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            className="h-9"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {displayedOptions.length > 0 && !searchQuery && options.length > maxDisplayItems && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Showing {displayedOptions.length} of {options.length}. Type to search all.
                </div>
              )}
              {searchResultsLimited && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground bg-yellow-50 border-b">
                  Too many results. Showing first {displayedOptions.length}. Refine your search.
                </div>
              )}
              {displayedOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  data-testid={`option-${option.value}`}
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
