import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColumnFilterProps {
  column: string;
  uniqueValues: string[];
  selectedValues: string[];
  onFilterChange: (column: string, selectedValues: string[]) => void;
  loading?: boolean;
}

export default function ColumnFilter({
  column,
  uniqueValues,
  selectedValues,
  onFilterChange,
  loading = false
}: ColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter unique values based on search term
  const filteredValues = uniqueValues.filter(value =>
    value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  // selectedValues contains the EXCLUDED values (unchecked items)
  const allSelected = selectedValues.length === 0; // No exclusions means all selected
  const someSelected = selectedValues.length > 0 && selectedValues.length < uniqueValues.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all: clear exclusions (empty array means show all)
      onFilterChange(column, []);
    } else {
      // Deselect all: exclude everything
      onFilterChange(column, uniqueValues);
    }
  };

  const handleValueToggle = (value: string, checked: boolean) => {
    if (checked) {
      // Value is being checked: remove from exclusions
      const newExcluded = selectedValues.filter(v => v !== value);
      onFilterChange(column, newExcluded);
    } else {
      // Value is being unchecked: add to exclusions
      const newExcluded = [...selectedValues, value];
      onFilterChange(column, newExcluded);
    }
  };

  const isValueSelected = (value: string) => {
    // Value is selected if NOT in the excluded list
    return !selectedValues.includes(value);
  };

  const hasActiveFilter = selectedValues.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-auto p-0.5 ml-1 ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid={`filter-${column}`}
        >
          <Filter className={`h-3 w-3 ${hasActiveFilter ? 'fill-current' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
              data-testid={`filter-search-${column}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`select-all-${column}`}
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              data-testid={`filter-select-all-${column}`}
              className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
            />
            <Label htmlFor={`select-all-${column}`} className="text-sm font-medium">
              Select All
            </Label>
            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 ml-auto text-xs"
                onClick={() => onFilterChange(column, [])}
                data-testid={`filter-clear-${column}`}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-64">
          <div className="p-2">
            {loading ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Loading values...
              </div>
            ) : filteredValues.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No values found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredValues.map((value) => (
                  <div key={value} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={`value-${column}-${value}`}
                      checked={isValueSelected(value)}
                      onCheckedChange={(checked) => handleValueToggle(value, checked as boolean)}
                      data-testid={`filter-value-${column}-${value}`}
                    />
                    <Label 
                      htmlFor={`value-${column}-${value}`}
                      className="text-sm flex-1 cursor-pointer"
                    >
                      {value || "(Empty)"}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}