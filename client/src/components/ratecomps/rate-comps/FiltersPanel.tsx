import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Filter, X, ChevronDown, ChevronRight, Database, Building2, BarChart3, Info } from "lucide-react";
import type { FilterState } from '@/lib/ratecomps/types';
import { STORAGE_TYPES, US_REGIONS, US_STATES, COUNTRIES } from "@shared/salescomps-constants";
import debounce from "lodash.debounce";
import throttle from "lodash.throttle";
import SavedSearchesMenu from "./SavedSearchesMenu";
import { useCustomStorageTypes } from "@/hooks/ratecomps/useCustomStorageTypes";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";

interface CrossRefFilters {
  states: { salesComps: string[]; crmProperties: string[]; merged: string[] };
  waterTypes: { salesComps: string[]; merged: string[] };
  regions: { salesComps: string[]; merged: string[] };
  bodiesOfWater: { salesComps: string[]; merged: string[] };
  cities: { crmProperties: string[]; merged: string[] };
  sources: { salesCompsCount: string; crmPropertiesCount: number };
}

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
  
  // Fetch cross-reference filter options from Sales Comps and CRM Properties
  const { data: crossRefFilters } = useQuery<CrossRefFilters>({
    queryKey: ['/api/rate-comps/cross-reference/filters'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
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
      states: [],
      regions: [],
      storageTypes: [],
      rateTypes: [],
      seasonalities: [],
      boatLengthMin: "",
      boatLengthMax: "",
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
      waterTypes: [],
      bodiesOfWater: [],
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
                {crossRefFilters && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          <Database className="h-3 w-3" />
                          Cross-Ref
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <div className="text-xs space-y-1">
                          <p className="font-medium">Data Sources:</p>
                          <div className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3 text-green-500" />
                            <span>Sales Comps: {crossRefFilters.sources.salesCompsCount === 'available' ? 'Available' : 'Empty'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-purple-500" />
                            <span>CRM Properties: {crossRefFilters.sources.crmPropertiesCount}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">State/Country</Label>
                <MultiSelectDropdown
                  label="State"
                  placeholder="All states"
                  options={[
                    ...US_STATES.map((state) => ({ label: state.name, value: state.code })),
                    ...COUNTRIES.map((country) => ({ label: country, value: country }))
                  ]}
                  value={filters.states || []}
                  onChange={(states) => updateFilter('states', states)}
                  triggerClassName="h-9 text-sm"
                  testId="select-state"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Region</Label>
                <MultiSelectDropdown
                  label="Region"
                  placeholder="All regions"
                  options={US_REGIONS.map((region) => ({ label: region, value: region }))}
                  value={filters.regions || []}
                  onChange={(regions) => updateFilter('regions', regions)}
                  triggerClassName="h-9 text-sm"
                  testId="select-region"
                />
              </div>
              {/* Water Type - Cross-Referenced from Sales Comps */}
              {crossRefFilters && crossRefFilters.waterTypes.merged.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Water Type</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            <BarChart3 className="h-2.5 w-2.5" />
                            SC
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span className="text-xs">From Sales Comps</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <MultiSelectDropdown
                    label="Water Type"
                    placeholder="All water types"
                    options={crossRefFilters.waterTypes.merged.map((type) => ({ label: type, value: type }))}
                    value={filters.waterTypes || []}
                    onChange={(types) => updateFilter('waterTypes', types)}
                    triggerClassName="h-9 text-sm"
                    testId="select-water-type"
                  />
                </div>
              )}
              {/* Body of Water - Cross-Referenced from Sales Comps */}
              {crossRefFilters && crossRefFilters.bodiesOfWater.merged.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Body of Water</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            <BarChart3 className="h-2.5 w-2.5" />
                            SC
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span className="text-xs">From Sales Comps</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <MultiSelectDropdown
                    label="Body of Water"
                    placeholder="All bodies of water"
                    options={crossRefFilters.bodiesOfWater.merged.map((bow) => ({ label: bow, value: bow }))}
                    value={filters.bodiesOfWater || []}
                    onChange={(bows) => updateFilter('bodiesOfWater', bows)}
                    triggerClassName="h-9 text-sm"
                    testId="select-body-of-water"
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Rate Details */}
      <Collapsible open={openSections.saleDetails} onOpenChange={() => toggleSection('saleDetails')}>
        <div className="mb-5">
          <CollapsibleTrigger className="w-full group">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-all cursor-pointer">
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  Rate Details
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
                <MultiSelectDropdown
                  label="Storage Type"
                  placeholder="All storage types"
                  options={allStorageTypes.map((type) => ({ label: type, value: type }))}
                  value={filters.storageTypes || []}
                  onChange={(types) => updateFilter('storageTypes', types)}
                  triggerClassName="h-9 text-sm"
                  testId="select-storage-type"
                />
              </div>

              {/* Rate Type */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Rate Type</Label>
                <MultiSelectDropdown
                  label="Rate Type"
                  placeholder="All rate types"
                  options={['Monthly', 'Annual', 'Daily', 'Weekly', 'Seasonal'].map((type) => ({ label: type, value: type }))}
                  value={filters.rateTypes || []}
                  onChange={(types) => updateFilter('rateTypes', types)}
                  triggerClassName="h-9 text-sm"
                  testId="select-rate-type"
                />
              </div>

              {/* Seasonality */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Seasonality</Label>
                <MultiSelectDropdown
                  label="Seasonality"
                  placeholder="All seasonalities"
                  options={['Year-Round', 'Seasonal', 'Summer Only', 'Winter Only'].map((s) => ({ label: s, value: s }))}
                  value={filters.seasonalities || []}
                  onChange={(types) => updateFilter('seasonalities', types)}
                  triggerClassName="h-9 text-sm"
                  testId="select-seasonality"
                />
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
