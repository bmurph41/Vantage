import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, X, ChevronDown, ChevronRight } from "lucide-react";
import type { FilterState } from '@/lib/ratecomps/types';
import { STORAGE_TYPES, US_REGIONS, US_STATES, COUNTRIES } from "@shared/salescomps-constants";
import debounce from "lodash.debounce";
import throttle from "lodash.throttle";
import SavedSearchesMenu from "./SavedSearchesMenu";
import { useCustomStorageTypes } from "@/hooks/ratecomps/useCustomStorageTypes";

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
        if (filters.states && filters.states.length > 0) count += filters.states.length;
        if (filters.regions && filters.regions.length > 0) count += filters.regions.length;
        break;
      case 'saleDetails':
        if (filters.storageTypes && filters.storageTypes.length > 0) count += filters.storageTypes.length;
        if (filters.rateTypes && filters.rateTypes.length > 0) count += filters.rateTypes.length;
        if (filters.seasonalities && filters.seasonalities.length > 0) count += filters.seasonalities.length;
        if (filters.boatLengthMin) count++;
        if (filters.boatLengthMax) count++;
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
      regions: [],
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
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">State/Country</Label>
              {filters.states && filters.states.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateFilter('states', [])}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-states"
                >
                  Clear ({filters.states.length})
                </Button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-md p-2">
              {/* US States */}
              <div className="mb-2">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">US States</div>
                {US_STATES.map((state) => (
                  <div key={state.code} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                    <Checkbox
                      id={`state-${state.code}`}
                      checked={filters.states?.includes(state.code) || false}
                      onCheckedChange={(checked) => {
                        const currentStates = filters.states || [];
                        const newStates = checked
                          ? [...currentStates, state.code]
                          : currentStates.filter(s => s !== state.code);
                        updateFilter('states', newStates);
                      }}
                      data-testid={`checkbox-state-${state.code.toLowerCase()}`}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`state-${state.code}`} className="text-sm text-foreground font-medium cursor-pointer flex-1 leading-none">
                      {state.name}
                    </Label>
                  </div>
                ))}
              </div>
              
              {/* International */}
              <div className="border-t border-border pt-2 mt-2">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">International</div>
                {COUNTRIES.map((country) => (
                  <div key={country} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                    <Checkbox
                      id={`country-${country}`}
                      checked={filters.states?.includes(country) || false}
                      onCheckedChange={(checked) => {
                        const currentStates = filters.states || [];
                        const newStates = checked
                          ? [...currentStates, country]
                          : currentStates.filter(s => s !== country);
                        updateFilter('states', newStates);
                      }}
                      data-testid={`checkbox-country-${country.toLowerCase().replace(/\s+/g, '-')}`}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`country-${country}`} className="text-sm text-foreground font-medium cursor-pointer flex-1 leading-none">
                      {country}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Region</Label>
            <div className="space-y-3">
              {US_REGIONS.map((region) => (
                <div key={region} className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                  <Checkbox
                    id={`region-${region}`}
                    checked={filters.regions?.includes(region) || false}
                    onCheckedChange={(checked) => {
                      const currentRegions = filters.regions || [];
                      const newRegions = checked
                        ? [...currentRegions, region]
                        : currentRegions.filter(r => r !== region);
                      updateFilter('regions', newRegions);
                    }}
                    data-testid={`checkbox-region-${region.toLowerCase().replace(/\s+/g, '-')}`}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={`region-${region}`} className="text-sm text-foreground font-medium cursor-pointer flex-1 leading-none">
                    {region}
                  </Label>
                </div>
              ))}
            </div>
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
              {/* Storage Type */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Storage Type</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {allStorageTypes.map(storageType => (
                    <div key={storageType} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                      <Checkbox
                        id={`storage-${storageType}`}
                        checked={filters.storageTypes?.includes(storageType) || false}
                        onCheckedChange={(checked) => {
                          const newStorageTypes = checked
                            ? [...(filters.storageTypes || []), storageType]
                            : (filters.storageTypes || []).filter(s => s !== storageType);
                          updateFilter('storageTypes', newStorageTypes);
                        }}
                        className="h-3.5 w-3.5"
                        data-testid={`checkbox-storage-${storageType}`}
                      />
                      <Label htmlFor={`storage-${storageType}`} className="text-xs text-foreground font-medium cursor-pointer leading-none flex-1">
                        {storageType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rate Type */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Rate Type</Label>
                <div className="space-y-2">
                  {['Monthly', 'Annual', 'Daily', 'Weekly', 'Seasonal'].map(rateType => (
                    <div key={rateType} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                      <Checkbox
                        id={`rate-type-${rateType}`}
                        checked={filters.rateTypes?.includes(rateType) || false}
                        onCheckedChange={(checked) => {
                          const newRateTypes = checked
                            ? [...(filters.rateTypes || []), rateType]
                            : (filters.rateTypes || []).filter(r => r !== rateType);
                          updateFilter('rateTypes', newRateTypes);
                        }}
                        className="h-3.5 w-3.5"
                        data-testid={`checkbox-rate-type-${rateType}`}
                      />
                      <Label htmlFor={`rate-type-${rateType}`} className="text-xs text-foreground font-medium cursor-pointer leading-none flex-1">
                        {rateType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seasonality */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Seasonality</Label>
                <div className="space-y-2">
                  {['Year-Round', 'Seasonal', 'Summer Only', 'Winter Only'].map(seasonality => (
                    <div key={seasonality} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/30 transition-colors cursor-pointer">
                      <Checkbox
                        id={`seasonality-${seasonality}`}
                        checked={filters.seasonalities?.includes(seasonality) || false}
                        onCheckedChange={(checked) => {
                          const newSeasonalities = checked
                            ? [...(filters.seasonalities || []), seasonality]
                            : (filters.seasonalities || []).filter(s => s !== seasonality);
                          updateFilter('seasonalities', newSeasonalities);
                        }}
                        className="h-3.5 w-3.5"
                        data-testid={`checkbox-seasonality-${seasonality}`}
                      />
                      <Label htmlFor={`seasonality-${seasonality}`} className="text-xs text-foreground font-medium cursor-pointer leading-none flex-1">
                        {seasonality}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Boat Length Range */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Boat Length (feet)</Label>
                <div className="flex items-center gap-2.5">
                  <Input
                    type="number"
                    placeholder="Min"
                    className="flex-1 h-10"
                    value={filters.boatLengthMin}
                    onChange={(e) => throttledUpdateFilter('boatLengthMin', e.target.value)}
                    data-testid="input-boat-length-min"
                  />
                  <span className="text-muted-foreground text-sm font-medium">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    className="flex-1 h-10"
                    value={filters.boatLengthMax}
                    onChange={(e) => throttledUpdateFilter('boatLengthMax', e.target.value)}
                    data-testid="input-boat-length-max"
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
