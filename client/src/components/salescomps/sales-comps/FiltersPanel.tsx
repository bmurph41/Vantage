import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Filter, X, ChevronUp, MapPin, DollarSign, Building2, CalendarDays } from "lucide-react";
import type { FilterState } from '@/lib/salescomps/types';
import { STORAGE_TYPES, US_REGIONS, US_STATES, COUNTRIES } from "@shared/salescomps-constants";
import debounce from "lodash.debounce";
import throttle from "lodash.throttle";
import SavedSearchesMenu from "./SavedSearchesMenu";
import { useCustomStorageTypes } from "@/hooks/salescomps/useCustomStorageTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // Immediate update for non-performance critical filters (select dropdowns, checkboxes)
  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Debounced update for text inputs (300ms delay after user stops typing)
  const debouncedUpdateFilter = useMemo(
    () => debounce((key: keyof FilterState, value: any) => {
      const nextFilters = { ...filters, [key]: value };
      onFiltersChange(nextFilters);
    }, 300),
    [onFiltersChange, filters]
  );

  // Throttled update for numeric inputs (150ms max frequency)
  const throttledUpdateFilter = useMemo(
    () => throttle((key: keyof FilterState, value: any) => {
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
      if (filters.priceMin !== "" && filters.priceMin !== "Market") {
        setPreviousPriceMin("");
      }
    }
  }, [filters.priceMin]);
  
  // Handle Market Bid checkbox change
  const handleMarketBidChange = (checked: boolean) => {
    setIsMarketBid(checked);
    if (checked) {
      if (filters.priceMin !== "Market") {
        setPreviousPriceMin(filters.priceMin);
      }
      updateFilter('priceMin', 'Market');
    } else {
      updateFilter('priceMin', previousPriceMin || '');
      setPreviousPriceMin("");
    }
  };

  // Sanitize input value - remove everything except numbers, dots, and single %
  const sanitizeCapRateInput = (value: string): string => {
    return value.replace(/[^0-9.%]/g, '')
      .replace(/\..*\./, (match) => match.replace(/\./g, '').replace(/^/, '.'))
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

  // Count total active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.states && filters.states.length > 0) count += filters.states.length;
    if (filters.regions && filters.regions.length > 0) count += filters.regions.length;
    if (filters.saleYearMin || filters.saleYearMax) count++;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.capRateMin || filters.capRateMax) count++;
    if (filters.wetSlipsMin || filters.wetSlipsMax) count++;
    if (filters.dryRacksMin || filters.dryRacksMax) count++;
    if (filters.occupancyMin || filters.occupancyMax) count++;
    if (filters.ioBoth && filters.ioBoth !== 'none') count++;
    if (filters.disclosedOnly) count++;
    if (filters.disclosedCapRateOnly) count++;
    if (filters.portfoliosOnly) count++;
    return count;
  }, [filters]);

  return (
    <div className="bg-gradient-to-br from-card to-card/50 rounded-lg border border-border/60 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">Filter Comps</h3>
            {activeFilterCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SavedSearchesMenu
            filters={filters}
            onFiltersChange={onFiltersChange}
            activeSavedSearchId={activeSavedSearchId}
            onActiveSavedSearchChange={onActiveSavedSearchChange}
          />
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              data-testid="button-clear-all-filters"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filter Content - Horizontal Grid Layout */}
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Location Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm text-foreground">Location</h4>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">State/Country</Label>
                <Select
                  value={filters.states && filters.states.length === 1 ? filters.states[0] : "all"}
                  onValueChange={(value) => {
                    if (value && value !== "all") {
                      updateFilter('states', [value]);
                    } else {
                      updateFilter('states', []);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-sm" data-testid="select-state">
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">All states</SelectItem>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name}
                      </SelectItem>
                    ))}
                    <Separator className="my-2" />
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Region</Label>
                <Select
                  value={filters.regions && filters.regions.length === 1 ? filters.regions[0] : "all"}
                  onValueChange={(value) => {
                    if (value && value !== "all") {
                      updateFilter('regions', [value]);
                    } else {
                      updateFilter('regions', []);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-sm" data-testid="select-region">
                    <SelectValue placeholder="All regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All regions</SelectItem>
                    {US_REGIONS.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Sale Details Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm text-foreground">Sale Details</h4>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Year</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    className="h-9 text-sm"
                    value={filters.saleYearMin}
                    onChange={(e) => throttledUpdateFilter('saleYearMin', e.target.value)}
                    data-testid="input-sale-year-min"
                  />
                  <span className="text-muted-foreground text-xs">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    className="h-9 text-sm"
                    value={filters.saleYearMax}
                    onChange={(e) => throttledUpdateFilter('saleYearMax', e.target.value)}
                    data-testid="input-sale-year-max"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-muted-foreground">Cap Rate (%)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Min"
                    className="h-9 text-sm"
                    value={capRateInputs.capRateMin}
                    onChange={(e) => handleCapRateChange('capRateMin', e.target.value)}
                    onFocus={() => handleCapRateFocus('capRateMin')}
                    onBlur={() => handleCapRateBlur('capRateMin')}
                    data-testid="input-cap-rate-min"
                  />
                  <span className="text-muted-foreground text-xs">-</span>
                  <Input
                    type="text"
                    placeholder="Max"
                    className="h-9 text-sm"
                    value={capRateInputs.capRateMax}
                    onChange={(e) => handleCapRateChange('capRateMax', e.target.value)}
                    onFocus={() => handleCapRateFocus('capRateMax')}
                    onBlur={() => handleCapRateBlur('capRateMax')}
                    data-testid="input-cap-rate-max"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Price Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm text-foreground">Price</h4>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-muted-foreground">Sale Price</Label>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="market-bid"
                      checked={isMarketBid}
                      onCheckedChange={handleMarketBidChange}
                      data-testid="checkbox-market-bid"
                      className="h-3.5 w-3.5"
                    />
                    <Label htmlFor="market-bid" className="text-xs text-foreground cursor-pointer">
                      Market Bid
                    </Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Min"
                    className="h-9 text-sm"
                    value={filters.priceMin}
                    onChange={(e) => debouncedUpdateFilter('priceMin', e.target.value)}
                    data-testid="input-price-min"
                    disabled={isMarketBid}
                  />
                  <span className="text-muted-foreground text-xs">-</span>
                  <Input
                    type="text"
                    placeholder="Max"
                    className="h-9 text-sm"
                    value={filters.priceMax}
                    onChange={(e) => debouncedUpdateFilter('priceMax', e.target.value)}
                    data-testid="input-price-max"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Occupancy (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    className="h-9 text-sm"
                    value={filters.occupancyMin}
                    onChange={(e) => throttledUpdateFilter('occupancyMin', e.target.value)}
                    data-testid="input-occupancy-min"
                  />
                  <span className="text-muted-foreground text-xs">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    className="h-9 text-sm"
                    value={filters.occupancyMax}
                    onChange={(e) => throttledUpdateFilter('occupancyMax', e.target.value)}
                    data-testid="input-occupancy-max"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Capacity & Quick Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm text-foreground">Capacity & Options</h4>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Wet Slips</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    className="h-9 text-sm"
                    value={filters.wetSlipsMin}
                    onChange={(e) => throttledUpdateFilter('wetSlipsMin', e.target.value)}
                    data-testid="input-wet-slips-min"
                  />
                  <span className="text-muted-foreground text-xs">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    className="h-9 text-sm"
                    value={filters.wetSlipsMax}
                    onChange={(e) => throttledUpdateFilter('wetSlipsMax', e.target.value)}
                    data-testid="input-wet-slips-max"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                  <Checkbox
                    id="disclosed-only"
                    checked={filters.disclosedOnly}
                    onCheckedChange={(checked) => updateFilter('disclosedOnly', checked)}
                    data-testid="checkbox-disclosed-only"
                    className="h-3.5 w-3.5"
                  />
                  <Label htmlFor="disclosed-only" className="text-xs text-foreground cursor-pointer flex-1">
                    Disclosed Prices Only
                  </Label>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                  <Checkbox
                    id="disclosed-cap-rate-only"
                    checked={filters.disclosedCapRateOnly}
                    onCheckedChange={(checked) => updateFilter('disclosedCapRateOnly', checked)}
                    data-testid="checkbox-disclosed-cap-rate-only"
                    className="h-3.5 w-3.5"
                  />
                  <Label htmlFor="disclosed-cap-rate-only" className="text-xs text-foreground cursor-pointer flex-1">
                    Disclosed Cap Rates Only
                  </Label>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                  <Checkbox
                    id="portfolios-only"
                    checked={filters.portfoliosOnly}
                    onCheckedChange={(checked) => updateFilter('portfoliosOnly', checked)}
                    data-testid="checkbox-portfolios-only"
                    className="h-3.5 w-3.5"
                  />
                  <Label htmlFor="portfolios-only" className="text-xs text-foreground cursor-pointer flex-1">
                    Portfolios Only
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="mt-5 pt-5 border-t border-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Active filters:</span>
              {filters.states && filters.states.map((state) => (
                <Badge key={state} variant="secondary" className="gap-1 h-6">
                  {state}
                  <button
                    onClick={() => updateFilter('states', filters.states?.filter(s => s !== state) || [])}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filters.regions && filters.regions.map((region) => (
                <Badge key={region} variant="secondary" className="gap-1 h-6">
                  {region}
                  <button
                    onClick={() => updateFilter('regions', filters.regions?.filter(r => r !== region) || [])}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {(filters.saleYearMin || filters.saleYearMax) && (
                <Badge variant="secondary" className="gap-1 h-6">
                  Year: {filters.saleYearMin || '∞'} - {filters.saleYearMax || '∞'}
                  <button
                    onClick={() => {
                      updateFilter('saleYearMin', '');
                      updateFilter('saleYearMax', '');
                    }}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.disclosedOnly && (
                <Badge variant="secondary" className="gap-1 h-6">
                  Disclosed Prices
                  <button onClick={() => updateFilter('disclosedOnly', false)} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.portfoliosOnly && (
                <Badge variant="secondary" className="gap-1 h-6">
                  Portfolios
                  <button onClick={() => updateFilter('portfoliosOnly', false)} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
