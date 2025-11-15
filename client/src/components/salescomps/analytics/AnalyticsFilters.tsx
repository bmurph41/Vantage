import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X, RefreshCcw, ChevronDown } from "lucide-react";

export interface AnalyticsFilters {
  states?: string[];
  yearSoldMin?: number;
  yearSoldMax?: number;
  priceMin?: number;
  priceMax?: number;
  pricePerSlipMin?: number;
  pricePerSlipMax?: number;
  waterTypes?: string[];
  profitCenters?: string[];
  capacityMin?: number;
  capacityMax?: number;
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  availableStates: string[];
  availableWaterTypes: string[];
  availableProfitCenters: string[];
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function AnalyticsFiltersPanel({
  filters,
  onFiltersChange,
  availableStates,
  availableWaterTypes,
  availableProfitCenters
}: AnalyticsFiltersProps) {
  const [localFilters, setLocalFilters] = useState<AnalyticsFilters>(filters);

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters: AnalyticsFilters = {};
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const toggleState = (state: string) => {
    const currentStates = localFilters.states || [];
    const newStates = currentStates.includes(state)
      ? currentStates.filter(s => s !== state)
      : [...currentStates, state];
    setLocalFilters({ ...localFilters, states: newStates });
  };

  const toggleWaterType = (type: string) => {
    const currentTypes = localFilters.waterTypes || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    setLocalFilters({ ...localFilters, waterTypes: newTypes });
  };

  const toggleProfitCenter = (pc: string) => {
    const currentPCs = localFilters.profitCenters || [];
    const newPCs = currentPCs.includes(pc)
      ? currentPCs.filter(p => p !== pc)
      : [...currentPCs, pc];
    setLocalFilters({ ...localFilters, profitCenters: newPCs });
  };

  const activeFilterCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof AnalyticsFilters];
    return Array.isArray(value) ? value.length > 0 : value !== undefined;
  }).length;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Filters</CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 text-muted-foreground hover:text-foreground"
            data-testid="button-reset-filters"
          >
            <RefreshCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Year Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Year Range</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="2007"
                value={localFilters.yearSoldMin || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  yearSoldMin: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-year-min"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder={new Date().getFullYear().toString()}
                value={localFilters.yearSoldMax || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  yearSoldMax: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-year-max"
              />
            </div>
          </div>
        </div>

        {/* Price Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Range</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="0"
                value={localFilters.priceMin || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  priceMin: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-price-min"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="50000000"
                value={localFilters.priceMax || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  priceMax: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-price-max"
              />
            </div>
          </div>
        </div>

        {/* Capacity Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Slip Capacity</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.capacityMin || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  capacityMin: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-capacity-min"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.capacityMax || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  capacityMax: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-capacity-max"
              />
            </div>
          </div>
        </div>

        {/* Price Per Slip Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Per Slip</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.pricePerSlipMin || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  pricePerSlipMin: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-price-per-slip-min"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.pricePerSlipMax || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  pricePerSlipMax: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-price-per-slip-max"
              />
            </div>
          </div>
        </div>

        {/* States Multi-Select Dropdown */}
        {availableStates.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">States</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between h-9"
                  data-testid="button-states-dropdown"
                >
                  <span className="text-sm">
                    {localFilters.states?.length 
                      ? `${localFilters.states.length} state${localFilters.states.length > 1 ? 's' : ''} selected`
                      : 'Select states'}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="max-h-80 overflow-y-auto p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[...availableStates].sort().map(state => (
                      <div key={state} className="flex items-center space-x-2">
                        <Checkbox
                          id={`state-${state}`}
                          checked={localFilters.states?.includes(state)}
                          onCheckedChange={() => toggleState(state)}
                          data-testid={`checkbox-state-${state}`}
                        />
                        <label
                          htmlFor={`state-${state}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {state}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Water Types */}
        {availableWaterTypes.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Water Type</Label>
            <div className="flex flex-wrap gap-2">
              {availableWaterTypes.map(type => (
                <Badge
                  key={type}
                  variant={localFilters.waterTypes?.includes(type) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => toggleWaterType(type)}
                  data-testid={`badge-water-type-${type}`}
                >
                  {type}
                  {localFilters.waterTypes?.includes(type) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Profit Centers */}
        {availableProfitCenters.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Profit Centers</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableProfitCenters.map(pc => (
                <Badge
                  key={pc}
                  variant={localFilters.profitCenters?.includes(pc) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 text-xs"
                  onClick={() => toggleProfitCenter(pc)}
                  data-testid={`badge-profit-center-${pc}`}
                >
                  {pc}
                  {localFilters.profitCenters?.includes(pc) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Apply Button */}
        <Button
          onClick={handleApply}
          className="w-full"
          data-testid="button-apply-filters"
        >
          Apply Filters
        </Button>
      </CardContent>
    </Card>
  );
}
