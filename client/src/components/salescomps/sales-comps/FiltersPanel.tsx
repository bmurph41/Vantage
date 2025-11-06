import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, X, ChevronDown, ChevronRight } from "lucide-react";
import type { FilterState } from '@/lib/salescomps/types';
import { STORAGE_TYPES } from "@shared/salescomps-constants";
import debounce from "lodash.debounce";
import throttle from "lodash.throttle";
import SavedSearchesMenu from "./SavedSearchesMenu";
import { useCustomStorageTypes } from "@/hooks/salescomps/useCustomStorageTypes";

interface FiltersPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  activeSavedSearchId?: string | null;
  onActiveSavedSearchChange?: (id: string | null, name: string | null) => void;
}

export default function FiltersPanel({ 
  filters, 
  onFiltersChange,
  activeSavedSearchId = null,
  onActiveSavedSearchChange = () => {},
}: FiltersPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [capRateInputs, setCapRateInputs] = useState<{
    capRateMin: string;
    capRateMax: string;
  }>({
    capRateMin: "",
    capRateMax: ""
  });
  
  // Fetch custom storage types
  const { data: customStorageTypes = [] } = useCustomStorageTypes();
  const allStorageTypes = [...STORAGE_TYPES, ...customStorageTypes.map(t => t.name)];
  
  // Collapsible sections state
  const [openSections, setOpenSections] = useState({
    quick: true,
    location: true,
    saleDetails: true,
    marinaFeatures: false
  });
  
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Count active filters for each section
  const getActiveFilterCount = (section: string) => {
    let count = 0;
    switch (section) {
      case 'quick':
        if (filters.disclosedOnly) count++;
        if (filters.disclosedCapRateOnly) count++;
        if (filters.hasArticle) count++;
        break;
      case 'location':
        if (filters.state && filters.state !== 'none') count++;
        if (filters.region) count++;
        break;
      case 'saleDetails':
        if (filters.saleYearMin) count++;
        if (filters.saleYearMax) count++;
        if (filters.priceMin) count++;
        if (filters.priceMax) count++;
        if (filters.capRateMin) count++;
        if (filters.capRateMax) count++;
        break;
      case 'marinaFeatures':
        if (filters.wetSlipsMin) count++;
        if (filters.wetSlipsMax) count++;
        if (filters.dryRacksMin) count++;
        if (filters.dryRacksMax) count++;
        if (filters.occupancyMin) count++;
        if (filters.occupancyMax) count++;
        if (filters.ioBoth && filters.ioBoth !== 'none') count++;
        break;
    }
    return count;
  };

  // Immediate update for non-performance critical filters (select dropdowns, checkboxes)
  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Debounced update for text inputs (300ms delay after user stops typing)
  const debouncedUpdateFilter = useMemo(
    () => debounce((key: keyof FilterState, value: any) => {
      // Compute the next state locally, then pass complete FilterState object
      const nextFilters = { ...filters, [key]: value };
      onFiltersChange(nextFilters);
    }, 300),
    [onFiltersChange, filters]
  );

  // Throttled update for numeric inputs (150ms max frequency)
  const throttledUpdateFilter = useMemo(
    () => throttle((key: keyof FilterState, value: any) => {
      // Compute the next state locally, then pass complete FilterState object
      const nextFilters = { ...filters, [key]: value };
      onFiltersChange(nextFilters);
    }, 150),
    [onFiltersChange, filters]
  );

  // Clean up debounced/throttled functions on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateFilter.cancel();
      throttledUpdateFilter.cancel();
    };
  }, [debouncedUpdateFilter, throttledUpdateFilter]);

  // Initialize local input state from filters when they change
  useEffect(() => {
    setCapRateInputs({
      capRateMin: filters.capRateMin ? `${parseFloat(filters.capRateMin).toFixed(2)}%` : "",
      capRateMax: filters.capRateMax ? `${parseFloat(filters.capRateMax).toFixed(2)}%` : ""
    });
  }, [filters.capRateMin, filters.capRateMax]);

  // Sanitize input value - remove everything except numbers, dots, and single %
  const sanitizeCapRateInput = (value: string): string => {
    // Remove everything except numbers, dots, and %
    return value.replace(/[^0-9.%]/g, '')
      // Allow only one decimal point
      .replace(/\..*\./, (match) => match.replace(/\./g, '').replace(/^/, '.'))
      // Allow only one % at the end
      .replace(/%/g, '')
      .replace(/$/, value.includes('%') ? '%' : '');
  };

  // Handle Cap Rate input focus - clear % symbol for editing
  const handleCapRateFocus = (field: 'capRateMin' | 'capRateMax') => {
    const currentValue = capRateInputs[field];
    if (currentValue.endsWith('%')) {
      setCapRateInputs(prev => ({
        ...prev,
        [field]: currentValue.slice(0, -1)
      }));
    }
  };

  // Handle Cap Rate input change during typing
  const handleCapRateChange = (field: 'capRateMin' | 'capRateMax', value: string) => {
    const sanitizedValue = sanitizeCapRateInput(value);
    setCapRateInputs(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));
  };

  // Handle Cap Rate input formatting on blur
  const handleCapRateBlur = (field: 'capRateMin' | 'capRateMax') => {
    const value = capRateInputs[field];
    
    if (!value || value.trim() === "") {
      setCapRateInputs(prev => ({
        ...prev,
        [field]: ""
      }));
      updateFilter(field, "");
      return;
    }
    
    // Remove % and any non-numeric except decimal
    const cleanValue = value.replace(/[^0-9.]/g, '');
    if (cleanValue === '' || cleanValue === '.') {
      setCapRateInputs(prev => ({
        ...prev,
        [field]: ""
      }));
      updateFilter(field, "");
      return;
    }
    
    const numValue = parseFloat(cleanValue);
    if (isNaN(numValue) || numValue < 0) {
      setCapRateInputs(prev => ({
        ...prev,
        [field]: ""
      }));
      updateFilter(field, "");
      return;
    }
    
    // Format display value and store clean numeric value
    const formattedDisplay = `${numValue.toFixed(2)}%`;
    setCapRateInputs(prev => ({
      ...prev,
      [field]: formattedDisplay
    }));
    updateFilter(field, numValue.toString());
  };

  const clearAllFilters = () => {
    onFiltersChange({
      q: "",
      state: "",
      region: "",
      saleYearMin: "",
      saleYearMax: "",
      priceMin: "",
      priceMax: "",
      capRateMin: "",
      capRateMax: "",
      occupancyMin: "",
      occupancyMax: "",
      wetSlipsMin: "",
      wetSlipsMax: "",
      dryRacksMin: "",
      dryRacksMax: "",
      ioBoth: "",
      hasArticle: false,
      disclosedOnly: false,
      disclosedCapRateOnly: false,
      columnFilters: {},
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'q') return false; // Search is handled separately
    if (key === 'columnFilters') {
      return Object.keys(value as Record<string, string[]>).length > 0;
    }
    return value !== "" && value !== false;
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Quick Filters */}
      <Collapsible open={openSections.quick} onOpenChange={() => toggleSection('quick')}>
        <div className="filter-section">
          <CollapsibleTrigger className="w-full">
            <h3 className="font-medium text-foreground mb-2 flex items-center justify-between gap-2 text-sm hover:text-primary transition-colors">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Quick Filters
                {getActiveFilterCount('quick') > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    {getActiveFilterCount('quick')}
                  </span>
                )}
              </span>
              {openSections.quick ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </h3>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="disclosed-only"
                  checked={filters.disclosedOnly}
                  onCheckedChange={(checked) => updateFilter('disclosedOnly', checked)}
                  data-testid="checkbox-disclosed-only"
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="disclosed-only" className="text-xs text-foreground leading-none">
                  Disclosed Prices Only
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="disclosed-cap-rate-only"
                  checked={filters.disclosedCapRateOnly}
                  onCheckedChange={(checked) => updateFilter('disclosedCapRateOnly', checked)}
                  data-testid="checkbox-disclosed-cap-rate-only"
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="disclosed-cap-rate-only" className="text-xs text-foreground leading-none">
                  Disclosed Cap Rates Only
                </Label>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Location */}
      <Collapsible open={openSections.location} onOpenChange={() => toggleSection('location')}>
        <div className="filter-section">
          <CollapsibleTrigger className="w-full">
            <h3 className="font-medium text-foreground mb-2 flex items-center justify-between gap-2 text-sm hover:text-primary transition-colors">
              <span className="flex items-center gap-2">
                Location
                {getActiveFilterCount('location') > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    {getActiveFilterCount('location')}
                  </span>
                )}
              </span>
              {openSections.location ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </h3>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3">
          <div>
            <Label className="text-sm text-muted-foreground">State/Country</Label>
            <Select
              value={filters.state}
              onValueChange={(value) => updateFilter('state', value)}
            >
              <SelectTrigger className="w-full mt-1" data-testid="select-state">
                <SelectValue placeholder="All States/Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All States/Countries</SelectItem>
                {/* US States */}
                <SelectItem value="FL">Florida</SelectItem>
                <SelectItem value="CA">California</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
                <SelectItem value="KS">Kansas</SelectItem>
                <SelectItem value="NY">New York</SelectItem>
                <SelectItem value="NC">North Carolina</SelectItem>
                <SelectItem value="SC">South Carolina</SelectItem>
                <SelectItem value="GA">Georgia</SelectItem>
                <SelectItem value="MD">Maryland</SelectItem>
                <SelectItem value="VA">Virginia</SelectItem>
                {/* International Countries */}
                <SelectItem value="Canada">Canada</SelectItem>
                <SelectItem value="Costa Rica">Costa Rica</SelectItem>
                <SelectItem value="Monaco">Monaco</SelectItem>
                <SelectItem value="Bahamas">Bahamas</SelectItem>
                <SelectItem value="Bermuda">Bermuda</SelectItem>
                <SelectItem value="Mexico">Mexico</SelectItem>
                <SelectItem value="France">France</SelectItem>
                <SelectItem value="Italy">Italy</SelectItem>
                <SelectItem value="Spain">Spain</SelectItem>
                <SelectItem value="Greece">Greece</SelectItem>
                <SelectItem value="Croatia">Croatia</SelectItem>
                <SelectItem value="Australia">Australia</SelectItem>
                <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                <SelectItem value="Netherlands">Netherlands</SelectItem>
                <SelectItem value="British Virgin Islands">British Virgin Islands</SelectItem>
                <SelectItem value="Cayman Islands">Cayman Islands</SelectItem>
                <SelectItem value="Virgin Islands">Virgin Islands</SelectItem>
                <SelectItem value="Puerto Rico">Puerto Rico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Region</Label>
            <Input
              type="text"
              placeholder="Enter region..."
              className="w-full mt-1"
              value={filters.region}
              onChange={(e) => debouncedUpdateFilter('region', e.target.value)}
              data-testid="input-region"
            />
          </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Sale Details */}
      <Collapsible open={openSections.saleDetails} onOpenChange={() => toggleSection('saleDetails')}>
        <div className="filter-section">
          <CollapsibleTrigger className="w-full">
            <h3 className="font-medium text-foreground mb-2 flex items-center justify-between gap-2 text-sm hover:text-primary transition-colors">
              <span className="flex items-center gap-2">
                Sale Details
                {getActiveFilterCount('saleDetails') > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    {getActiveFilterCount('saleDetails')}
                  </span>
                )}
              </span>
              {openSections.saleDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </h3>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Sale Year</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                placeholder="2020"
                className="flex-1"
                value={filters.saleYearMin}
                onChange={(e) => throttledUpdateFilter('saleYearMin', e.target.value)}
                data-testid="input-sale-year-min"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="number"
                placeholder="2024"
                className="flex-1"
                value={filters.saleYearMax}
                onChange={(e) => throttledUpdateFilter('saleYearMax', e.target.value)}
                data-testid="input-sale-year-max"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Sale Price</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="text"
                placeholder="$0"
                className="flex-1"
                value={filters.priceMin}
                onChange={(e) => debouncedUpdateFilter('priceMin', e.target.value)}
                data-testid="input-price-min"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="text"
                placeholder="$50M"
                className="flex-1"
                value={filters.priceMax}
                onChange={(e) => debouncedUpdateFilter('priceMax', e.target.value)}
                data-testid="input-price-max"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Cap Rate (%)</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="text"
                placeholder="0.00%"
                className="flex-1"
                value={capRateInputs.capRateMin}
                onFocus={() => handleCapRateFocus('capRateMin')}
                onChange={(e) => handleCapRateChange('capRateMin', e.target.value)}
                onBlur={() => handleCapRateBlur('capRateMin')}
                data-testid="input-cap-rate-min"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="text"
                placeholder="15.00%"
                className="flex-1"
                value={capRateInputs.capRateMax}
                onFocus={() => handleCapRateFocus('capRateMax')}
                onChange={(e) => handleCapRateChange('capRateMax', e.target.value)}
                onBlur={() => handleCapRateBlur('capRateMax')}
                data-testid="input-cap-rate-max"
              />
            </div>
          </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Marina Features */}
      <Collapsible open={openSections.marinaFeatures} onOpenChange={() => toggleSection('marinaFeatures')}>
        <div className="filter-section">
          <CollapsibleTrigger className="w-full">
            <h3 className="font-medium text-foreground mb-2 flex items-center justify-between gap-2 text-sm hover:text-primary transition-colors">
              <span className="flex items-center gap-2">
                Marina Features
                {getActiveFilterCount('marinaFeatures') > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    {getActiveFilterCount('marinaFeatures')}
                  </span>
                )}
              </span>
              {openSections.marinaFeatures ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </h3>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3">
          <div>
            <Label className="text-sm text-muted-foreground">Wet Slips</Label>
            <Input
              type="number"
              placeholder="Min slips..."
              className="w-full mt-1"
              value={filters.wetSlipsMin}
              onChange={(e) => throttledUpdateFilter('wetSlipsMin', e.target.value)}
              data-testid="input-wet-slips-min"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Dry Racks</Label>
            <Input
              type="number"
              placeholder="Min racks..."
              className="w-full mt-1"
              value={filters.dryRacksMin}
              onChange={(e) => throttledUpdateFilter('dryRacksMin', e.target.value)}
              data-testid="input-dry-racks-min"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Storage Type</Label>
            <Select
              value={filters.ioBoth}
              onValueChange={(value) => updateFilter('ioBoth', value === 'none' ? '' : value)}
            >
              <SelectTrigger className="w-full mt-1" data-testid="select-storage-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All Types</SelectItem>
                {allStorageTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Filter Actions */}
      <div className="p-4 border-t border-border">
        <div className="space-y-2">
          <SavedSearchesMenu
            filters={filters}
            onFiltersChange={onFiltersChange}
            activeSavedSearchId={activeSavedSearchId}
            onActiveSavedSearchChange={onActiveSavedSearchChange}
          />
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="w-full"
              onClick={clearAllFilters}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
          <div className="text-xs text-muted-foreground text-center">
            {hasActiveFilters ? 'Filters applied' : 'No filters applied'}
          </div>
        </div>
      </div>
    </div>
  );
}
