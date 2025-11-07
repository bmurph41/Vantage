import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X, RefreshCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.priceMin || 0,
    filters.priceMax || 50000000
  ]);
  const [yearRange, setYearRange] = useState<[number, number]>([
    filters.yearSoldMin || 2000,
    filters.yearSoldMax || new Date().getFullYear()
  ]);

  const handleApply = () => {
    onFiltersChange({
      ...localFilters,
      priceMin: priceRange[0] > 0 ? priceRange[0] : undefined,
      priceMax: priceRange[1] < 50000000 ? priceRange[1] : undefined,
      yearSoldMin: yearRange[0] > 2000 ? yearRange[0] : undefined,
      yearSoldMax: yearRange[1] < new Date().getFullYear() ? yearRange[1] : undefined,
    });
  };

  const handleReset = () => {
    const resetFilters: AnalyticsFilters = {};
    setLocalFilters(resetFilters);
    setPriceRange([0, 50000000]);
    setYearRange([2000, new Date().getFullYear()]);
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
          <div className="space-y-2">
            <Slider
              value={yearRange}
              onValueChange={setYearRange}
              min={2000}
              max={new Date().getFullYear()}
              step={1}
              className="w-full"
              data-testid="slider-year-range"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{yearRange[0]}</span>
              <span>{yearRange[1]}</span>
            </div>
          </div>
        </div>

        {/* Price Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Range</Label>
          <div className="space-y-2">
            <Slider
              value={priceRange}
              onValueChange={setPriceRange}
              min={0}
              max={50000000}
              step={100000}
              className="w-full"
              data-testid="slider-price-range"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>${(priceRange[0] / 1000000).toFixed(1)}M</span>
              <span>${(priceRange[1] / 1000000).toFixed(1)}M</span>
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

        {/* States Multi-Select */}
        {availableStates.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">States</Label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
              {availableStates.map(state => (
                <Badge
                  key={state}
                  variant={localFilters.states?.includes(state) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => toggleState(state)}
                  data-testid={`badge-state-${state}`}
                >
                  {state}
                  {localFilters.states?.includes(state) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
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
