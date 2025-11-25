import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArticleFilters, SourceDistribution } from "../types/article";
import { formatDistanceToNow } from "date-fns";
import { Filter, Building2, ChevronDown, Check, Save, Globe } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "../lib/queryClient";

interface CategoryDistribution {
  category: string;
  count: number;
}

interface MultiSelectDropdownProps {
  label: string;
  icon: React.ReactNode;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  testId?: string;
}

function MultiSelectDropdown({ 
  label, 
  icon, 
  options, 
  selectedValues, 
  onSelectionChange,
  testId 
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);

  // Helper function to properly pluralize labels
  const pluralize = (word: string): string => {
    if (word === 'Category') return 'Categories';
    if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
    return word + 's';
  };

  const handleSelect = (value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    onSelectionChange(options);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const labelPlural = pluralize(label);
  const labelPluralLower = labelPlural.toLowerCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="w-fit justify-between text-left font-normal min-w-[180px]"
          data-testid={testId}
        >
          <span className="flex items-center">
            {icon}
            <span className="ml-2">
              {selectedValues.length > 0 
                ? `${selectedValues.length} ${selectedValues.length === 1 ? label : labelPlural}` 
                : `All ${labelPlural}`}
            </span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${labelPluralLower}...`} />
          <CommandList>
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandGroup>
              <div className="p-2 border-b flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {selectedValues.length} of {options.length} selected
                </span>
                <div className="space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSelectAll}
                    className="h-7 text-xs"
                    data-testid={`button-select-all-${labelPluralLower}`}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearAll}
                    className="h-7 text-xs"
                    data-testid={`button-clear-${labelPluralLower}`}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option);
                const optionId = option.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                    className="cursor-pointer"
                    data-testid={`option-${label.toLowerCase()}-${optionId}`}
                    aria-label={`${isSelected ? 'Deselect' : 'Select'} ${option}`}
                    aria-selected={isSelected}
                    role="option"
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <Checkbox
                        checked={isSelected}
                        data-testid={`checkbox-filter-${label.toLowerCase()}-${optionId}`}
                      />
                      <span>{option}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 ml-auto" />}
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

interface FilterBarProps {
  filters: ArticleFilters;
  onFilterChange: (filters: Partial<ArticleFilters>) => void;
  onClearFilters: () => void;
  lastUpdate?: string | null;
}

export default function FilterBar({ 
  filters, 
  onFilterChange, 
  onClearFilters,
  lastUpdate 
}: FilterBarProps) {
  const { toast } = useToast();
  
  // Fetch available categories from backend
  const { data: categoryDistribution = [] } = useQuery<CategoryDistribution[]>({
    queryKey: ['/api/docktalk/analytics/categories'],
  });

  // Fetch available sources from backend (active RSS sources)
  const { data: sourceDistribution = [] } = useQuery<SourceDistribution[]>({
    queryKey: ['/api/docktalk/analytics/sources'],
  });

  // Check auth status
  const { data: authResponse } = useQuery<{ user: { id: string; username: string } } | null>({
    queryKey: ['/api/auth/me'],
  });
  
  const currentUser = authResponse?.user;

  // Save filter preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        categories: filters.categories,
        sources: filters.sources,
        regions: filters.regions,
        fromDate: filters.fromDate,
        minRelevance: filters.minRelevance,
        sortBy: filters.sortBy,
      };
      return await apiRequest('/api/user/filter-preferences', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({
        title: "Favorite Saved",
        description: "Your favorite filter settings have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Favorite",
        description: error.message || "An error occurred while saving your favorite settings.",
        variant: "destructive",
      });
    },
  });

  const hasActiveFilters = !!(
    filters.search || 
    filters.category || 
    (filters.categories && filters.categories.length > 0) ||
    filters.source ||
    (filters.sources && filters.sources.length > 0) ||
    (filters.regions && filters.regions.length > 0) ||
    filters.fromDate || 
    filters.toDate || 
    filters.minRelevance
  );

  const selectedCategories = filters.categories || [];
  const selectedSources = filters.sources || [];
  const selectedRegions = filters.regions || [];
  const availableCategories = categoryDistribution.map(c => c.category).sort();
  const availableSources = sourceDistribution.map(s => s.source).sort();
  const availableRegions = ["US/Domestic", "International"];

  return (
    <div className="mb-6 bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Latest Marina Industry News</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Last updated:</span>
          <span className="text-sm font-medium text-foreground">
            {lastUpdate 
              ? formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })
              : "Never"
            }
          </span>
          <i className="fas fa-sync-alt text-green-500 text-sm"></i>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3 items-center">
        {/* Multi-Category Dropdown */}
        <MultiSelectDropdown
          label="Category"
          icon={<Filter className="h-4 w-4" />}
          options={availableCategories}
          selectedValues={selectedCategories}
          onSelectionChange={(categories) => 
            onFilterChange({ categories: categories.length > 0 ? categories : undefined })
          }
          testId="button-category-filter"
        />

        {/* Multi-Source Dropdown */}
        <MultiSelectDropdown
          label="Source"
          icon={<Building2 className="h-4 w-4" />}
          options={availableSources}
          selectedValues={selectedSources}
          onSelectionChange={(sources) => 
            onFilterChange({ sources: sources.length > 0 ? sources : undefined })
          }
          testId="button-source-filter"
        />

        {/* Multi-Region Dropdown */}
        <MultiSelectDropdown
          label="Region"
          icon={<Globe className="h-4 w-4" />}
          options={availableRegions}
          selectedValues={selectedRegions}
          onSelectionChange={(regions) => 
            onFilterChange({ regions: regions.length > 0 ? regions : undefined })
          }
          testId="button-region-filter"
        />
        
        <Select 
          value={filters.fromDate || "all"} 
          onValueChange={(value) => onFilterChange({ fromDate: value === "all" ? undefined : value })}
        >
          <SelectTrigger className="w-48" data-testid="select-time-range">
            <SelectValue placeholder="All Time Ranges" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time Ranges</SelectItem>
            <SelectItem value={new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}>
              Last 24 hours
            </SelectItem>
            <SelectItem value={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}>
              Last 7 days
            </SelectItem>
            <SelectItem value={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}>
              Last 30 days
            </SelectItem>
          </SelectContent>
        </Select>
        
        <Select 
          value={filters.minRelevance?.toString() || "all"} 
          onValueChange={(value) => onFilterChange({ minRelevance: value === "all" ? undefined : parseInt(value) })}
        >
          <SelectTrigger className="w-56" data-testid="select-relevance">
            <SelectValue placeholder="All Relevance Scores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Relevance Scores</SelectItem>
            <SelectItem value="80">High Relevance (80%+)</SelectItem>
            <SelectItem value="60">Medium Relevance (60-79%)</SelectItem>
            <SelectItem value="40">Low Relevance (40-59%)</SelectItem>
          </SelectContent>
        </Select>
        
        <Select 
          value={filters.sortBy || "newest"} 
          onValueChange={(value: "newest" | "relevance") => onFilterChange({ sortBy: value })}
        >
          <SelectTrigger className="w-48" data-testid="select-sort">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="relevance">Highest Relevance</SelectItem>
          </SelectContent>
        </Select>
        
        <Button 
          variant="default"
          onClick={() => {
            // This would typically apply filters, but they're applied automatically
          }}
          data-testid="button-apply-filters"
        >
          <i className="fas fa-filter mr-2"></i>
          Apply Filters
        </Button>
        
        {hasActiveFilters && (
          <Button 
            variant="outline"
            onClick={onClearFilters}
            data-testid="button-clear-filters"
          >
            <i className="fas fa-times mr-2"></i>
            Clear All
          </Button>
        )}
        
        {currentUser && (
          <Button 
            variant="secondary"
            onClick={() => savePreferencesMutation.mutate()}
            disabled={savePreferencesMutation.isPending}
            data-testid="button-save-preferences"
          >
            <Save className="h-4 w-4 mr-2" />
            {savePreferencesMutation.isPending ? "Saving..." : "Save as Favorite"}
          </Button>
        )}
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-3">
          {filters.search && (
            <Badge variant="secondary" data-testid="filter-badge-search">
              Search: {filters.search}
              <button 
                onClick={() => onFilterChange({ search: undefined })}
                className="ml-2 hover:text-destructive"
                data-testid="button-remove-filter-search"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.categories && filters.categories.length > 0 && (
            <>
              {filters.categories.map((cat) => (
                <Badge key={cat} variant="secondary" data-testid={`filter-badge-category-${cat.toLowerCase().replace(/ /g, '-')}`}>
                  {cat}
                  <button 
                    onClick={() => {
                      const newCategories = selectedCategories.filter(c => c !== cat);
                      onFilterChange({ 
                        categories: newCategories.length > 0 ? newCategories : undefined 
                      });
                    }}
                    className="ml-2 hover:text-destructive"
                    data-testid={`button-remove-category-${cat.toLowerCase().replace(/ /g, '-')}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </>
          )}
          {filters.sources && filters.sources.length > 0 && (
            <>
              {filters.sources.map((source) => (
                <Badge key={source} variant="secondary" data-testid={`filter-badge-source-${source.toLowerCase().replace(/ /g, '-')}`}>
                  {source}
                  <button 
                    onClick={() => {
                      const newSources = selectedSources.filter(s => s !== source);
                      onFilterChange({ 
                        sources: newSources.length > 0 ? newSources : undefined 
                      });
                    }}
                    className="ml-2 hover:text-destructive"
                    data-testid={`button-remove-source-${source.toLowerCase().replace(/ /g, '-')}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </>
          )}
          {filters.minRelevance && (
            <Badge variant="secondary" data-testid="filter-badge-relevance">
              Min Relevance: {filters.minRelevance}%
              <button 
                onClick={() => onFilterChange({ minRelevance: undefined })}
                className="ml-2 hover:text-destructive"
                data-testid="button-remove-filter-relevance"
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
