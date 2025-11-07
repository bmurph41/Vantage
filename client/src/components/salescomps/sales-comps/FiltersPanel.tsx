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
  
  const [isMarketBid, setIsMarketBid] = useState(false);
  const [previousPriceMin, setPreviousPriceMin] = useState("");
  
  // Fetch custom storage types
  const { data: customStorageTypes = [] } = useCustomStorageTypes();
  const allStorageTypes = [...STORAGE_TYPES, ...customStorageTypes.map(t => t.name)];
  
  // Collapsible sections state - all collapsed by default
  const [openSections, setOpenSections] = useState({
    quick: false,
    location: false,
    saleDetails: false,
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
        if (filters.portfoliosOnly) count++;
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
  
  // Sync Market Bid checkbox with priceMin filter
  useEffect(() => {
    if (filters.priceMin === "Market") {
      setIsMarketBid(true);
    } else {
      setIsMarketBid(false);
      // If priceMin changed externally (e.g., from saved search), reset previousPriceMin
      // so we don't restore stale data
      if (filters.priceMin !== "" && filters.priceMin !== "Market") {
        setPreviousPriceMin("");
      }
    }
  }, [filters.priceMin]);
  
  // Handle Market Bid checkbox change
  const handleMarketBidChange = (checked: boolean) => {
    setIsMarketBid(checked);
    if (checked) {
      // Save current value before setting to "Market" (only if it's not "Market")
      if (filters.priceMin !== "Market") {
        setPreviousPriceMin(filters.priceMin);
      }
      updateFilter('priceMin', 'Market');
    } else {
      // Restore previous value when unchecking, or clear if no previous value
      updateFilter('priceMin', previousPriceMin || '');
      // Clear the saved value after restoring
      setPreviousPriceMin("");
    }
  };

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
      disclosedOnly: false,
      disclosedCapRateOnly: false,
      portfoliosOnly: false,
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
    <div className="flex-1 overflow-y-auto pt-6 px-1">
      {/* Quick Filters */}
      <Collapsible open={openSections.quick} onOpenChange={() => toggleSection('quick')}>
        <div className="mb-5">
          <CollapsibleTrigger className="w-full group">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-all cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Filter className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  Quick Filters
                </h3>
                {getActiveFilterCount('quick') > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                    {getActiveFilterCount('quick')}
                  </span>
                )}
              </div>
              {openSections.quick ? 
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> : 
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              }
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="mt-3 px-3 space-y-3.5">
              <div className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                <Checkbox
                  id="disclosed-only"
                  checked={filters.disclosedOnly}
                  onCheckedChange={(checked) => updateFilter('disclosedOnly', checked)}
                  data-testid="checkbox-disclosed-only"
                  className="h-4 w-4"
                />
                <Label htmlFor="disclosed-only" className="text-sm text-foreground font-medium cursor-pointer flex-1 leading-none">
                  Disclosed Prices Only
                </Label>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                <Checkbox
                  id="disclosed-cap-rate-only"
                  checked={filters.disclosedCapRateOnly}
                  onCheckedChange={(checked) => updateFilter('disclosedCapRateOnly', checked)}
                  data-testid="checkbox-disclosed-cap-rate-only"
                  className="h-4 w-4"
                />
                <Label htmlFor="disclosed-cap-rate-only" className="text-sm text-foreground font-medium cursor-pointer flex-1 leading-none">
                  Disclosed Cap Rates Only
                </Label>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                <Checkbox
                  id="portfolios-only"
                  checked={filters.portfoliosOnly}
                  onCheckedChange={(checked) => updateFilter('portfoliosOnly', checked)}
                  data-testid="checkbox-portfolios-only"
                  className="h-4 w-4"
                />
                <Label htmlFor="portfolios-only" className="text-sm text-foreground font-medium cursor-pointer flex-1 leading-none">
                  Portfolios
                </Label>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Location */}
      <Collapsible open={openSections.location} onOpenChange={() => toggleSection('location')}>
        <div className="mb-5">
          <CollapsibleTrigger className="w-full group">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-all cursor-pointer">
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  Location
                </h3>
                {getActiveFilterCount('location') > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                    {getActiveFilterCount('location')}
                  </span>
                )}
              </div>
              {openSections.location ? 
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> : 
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              }
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="mt-3 px-3 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">State</Label>
            <Select
              value={filters.state}
              onValueChange={(value) => updateFilter('state', value)}
            >
              <SelectTrigger className="w-full h-10 bg-background" data-testid="select-state">
                <SelectValue placeholder="All States/Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All States/Countries</SelectItem>
                <SelectItem value="Australia">Australia</SelectItem>
                <SelectItem value="Bahamas">Bahamas</SelectItem>
                <SelectItem value="Bermuda">Bermuda</SelectItem>
                <SelectItem value="British Virgin Islands">British Virgin Islands</SelectItem>
                <SelectItem value="CA">California</SelectItem>
                <SelectItem value="Canada">Canada</SelectItem>
                <SelectItem value="Cayman Islands">Cayman Islands</SelectItem>
                <SelectItem value="Costa Rica">Costa Rica</SelectItem>
                <SelectItem value="Croatia">Croatia</SelectItem>
                <SelectItem value="FL">Florida</SelectItem>
                <SelectItem value="France">France</SelectItem>
                <SelectItem value="GA">Georgia</SelectItem>
                <SelectItem value="Greece">Greece</SelectItem>
                <SelectItem value="Italy">Italy</SelectItem>
                <SelectItem value="KS">Kansas</SelectItem>
                <SelectItem value="MD">Maryland</SelectItem>
                <SelectItem value="Mexico">Mexico</SelectItem>
                <SelectItem value="Monaco">Monaco</SelectItem>
                <SelectItem value="NC">North Carolina</SelectItem>
                <SelectItem value="Netherlands">Netherlands</SelectItem>
                <SelectItem value="NY">New York</SelectItem>
                <SelectItem value="Puerto Rico">Puerto Rico</SelectItem>
                <SelectItem value="SC">South Carolina</SelectItem>
                <SelectItem value="Spain">Spain</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
                <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                <SelectItem value="VA">Virginia</SelectItem>
                <SelectItem value="Virgin Islands">Virgin Islands</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Region</Label>
            <Input
              type="text"
              placeholder="Enter region..."
              className="w-full h-10"
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
        <div className="mb-5">
          <CollapsibleTrigger className="w-full group">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-all cursor-pointer">
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  Sale Details
                </h3>
                {getActiveFilterCount('saleDetails') > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                    {getActiveFilterCount('saleDetails')}
                  </span>
                )}
              </div>
              {openSections.saleDetails ? 
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> : 
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              }
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="mt-3 px-3 space-y-5">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Sale Year</Label>
            <div className="flex items-center gap-2.5">
              <Input
                type="number"
                placeholder="2020"
                className="flex-1 h-10"
                value={filters.saleYearMin}
                onChange={(e) => throttledUpdateFilter('saleYearMin', e.target.value)}
                data-testid="input-sale-year-min"
              />
              <span className="text-muted-foreground text-sm font-medium">to</span>
              <Input
                type="number"
                placeholder="2024"
                className="flex-1 h-10"
                value={filters.saleYearMax}
                onChange={(e) => throttledUpdateFilter('saleYearMax', e.target.value)}
                data-testid="input-sale-year-max"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sale Price</Label>
              <div className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                <Checkbox
                  id="market-bid"
                  checked={isMarketBid}
                  onCheckedChange={handleMarketBidChange}
                  data-testid="checkbox-market-bid"
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="market-bid" className="text-xs text-foreground font-medium cursor-pointer leading-none">
                  Market Bid
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Input
                type="text"
                placeholder="$0"
                className="flex-1 h-10"
                value={filters.priceMin}
                onChange={(e) => debouncedUpdateFilter('priceMin', e.target.value)}
                data-testid="input-price-min"
                disabled={isMarketBid}
              />
              <span className="text-muted-foreground text-sm font-medium">to</span>
              <Input
                type="text"
                placeholder="$50M"
                className="flex-1 h-10"
                value={filters.priceMax}
                onChange={(e) => debouncedUpdateFilter('priceMax', e.target.value)}
                data-testid="input-price-max"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Cap Rate (%)</Label>
            <div className="flex items-center gap-2.5">
              <Input
                type="text"
                placeholder="0.00%"
                className="flex-1 h-10"
                value={capRateInputs.capRateMin}
                onFocus={() => handleCapRateFocus('capRateMin')}
                onChange={(e) => handleCapRateChange('capRateMin', e.target.value)}
                onBlur={() => handleCapRateBlur('capRateMin')}
                data-testid="input-cap-rate-min"
              />
              <span className="text-muted-foreground text-sm font-medium">to</span>
              <Input
                type="text"
                placeholder="15.00%"
                className="flex-1 h-10"
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
        <div className="mb-5">
          <CollapsibleTrigger className="w-full group">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-all cursor-pointer">
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  Marina Features
                </h3>
                {getActiveFilterCount('marinaFeatures') > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                    {getActiveFilterCount('marinaFeatures')}
                  </span>
                )}
              </div>
              {openSections.marinaFeatures ? 
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> : 
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              }
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="mt-3 px-3 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Wet Slips</Label>
            <div className="flex items-center gap-2.5">
              <Input
                type="number"
                placeholder="Min"
                className="flex-1 h-10"
                value={filters.wetSlipsMin}
                onChange={(e) => throttledUpdateFilter('wetSlipsMin', e.target.value)}
                data-testid="input-wet-slips-min"
              />
              <span className="text-muted-foreground text-sm font-medium">to</span>
              <Input
                type="number"
                placeholder="Max"
                className="flex-1 h-10"
                value={filters.wetSlipsMax}
                onChange={(e) => throttledUpdateFilter('wetSlipsMax', e.target.value)}
                data-testid="input-wet-slips-max"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Dry Racks</Label>
            <div className="flex items-center gap-2.5">
              <Input
                type="number"
                placeholder="Min"
                className="flex-1 h-10"
                value={filters.dryRacksMin}
                onChange={(e) => throttledUpdateFilter('dryRacksMin', e.target.value)}
                data-testid="input-dry-racks-min"
              />
              <span className="text-muted-foreground text-sm font-medium">to</span>
              <Input
                type="number"
                placeholder="Max"
                className="flex-1 h-10"
                value={filters.dryRacksMax}
                onChange={(e) => throttledUpdateFilter('dryRacksMax', e.target.value)}
                data-testid="input-dry-racks-max"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Occupancy (%)</Label>
            <div className="flex items-center gap-2.5">
              <Input
                type="number"
                placeholder="Min %"
                className="flex-1 h-10"
                value={filters.occupancyMin}
                onChange={(e) => throttledUpdateFilter('occupancyMin', e.target.value)}
                data-testid="input-occupancy-min"
              />
              <span className="text-muted-foreground text-sm font-medium">to</span>
              <Input
                type="number"
                placeholder="Max %"
                className="flex-1 h-10"
                value={filters.occupancyMax}
                onChange={(e) => throttledUpdateFilter('occupancyMax', e.target.value)}
                data-testid="input-occupancy-max"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Storage Type</Label>
            <Select
              value={filters.ioBoth}
              onValueChange={(value) => updateFilter('ioBoth', value === 'none' ? '' : value)}
            >
              <SelectTrigger className="w-full h-10 bg-background" data-testid="select-storage-type">
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
      <div className="mt-6 pt-5 px-3 border-t border-border/60">
        <div className="space-y-3">
          <SavedSearchesMenu
            filters={filters}
            onFiltersChange={onFiltersChange}
            activeSavedSearchId={activeSavedSearchId}
            onActiveSavedSearchChange={onActiveSavedSearchChange}
          />
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="w-full h-10 font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
              onClick={clearAllFilters}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          )}
          <div className="text-xs text-muted-foreground text-center py-2">
            {hasActiveFilters ? 'Filters are active' : 'No filters applied'}
          </div>
        </div>
      </div>
    </div>
  );
}
