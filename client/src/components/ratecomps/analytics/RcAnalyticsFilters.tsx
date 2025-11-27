import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, X, RefreshCcw, ChevronDown } from "lucide-react";
import { US_STATES } from "@shared/salescomps-constants";

export interface RcAnalyticsFilters {
  states?: string[];
  regions?: string[];
  storageTypes?: string[];
  ratePeriods?: string[];
  seasonalities?: string[];
  loaMin?: number;
  loaMax?: number;
  rateMin?: number;
  rateMax?: number;
  waterTypes?: string[];
  protectionLevels?: string[];
  electricIncluded?: boolean | null;
  liveaboardAllowed?: boolean | null;
}

interface RcAnalyticsFiltersProps {
  filters: RcAnalyticsFilters;
  onFiltersChange: (filters: RcAnalyticsFilters) => void;
  availableStates: string[];
  availableStorageTypes: string[];
  availableRatePeriods: string[];
  availableSeasonalities: string[];
}

const STORAGE_TYPE_LABELS: Record<string, string> = {
  'wet_slip': 'Wet Slip',
  'dry_rack': 'Dry Rack',
  'mooring': 'Mooring',
  'trailer': 'Trailer',
  'rack_storage': 'Rack Storage',
  'lift_storage': 'Lift Storage',
  'kayak_sup': 'Kayak/SUP',
  'jet_ski': 'Jet Ski',
  'rv_space': 'RV Space',
};

const RATE_PERIOD_LABELS: Record<string, string> = {
  'daily': 'Daily',
  'weekly': 'Weekly',
  'monthly': 'Monthly',
  'seasonal': 'Seasonal',
  'annual': 'Annual',
};

const SEASONALITY_LABELS: Record<string, string> = {
  'annual': 'Year-Round',
  'peak': 'Peak Season',
  'off_peak': 'Off-Peak',
  'shoulder': 'Shoulder Season',
};

export default function RcAnalyticsFiltersPanel({
  filters,
  onFiltersChange,
  availableStates,
  availableStorageTypes,
  availableRatePeriods,
  availableSeasonalities,
}: RcAnalyticsFiltersProps) {
  const [localFilters, setLocalFilters] = useState<RcAnalyticsFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters: RcAnalyticsFilters = {};
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const toggleArrayFilter = (field: keyof RcAnalyticsFilters, value: string) => {
    const current = (localFilters[field] as string[]) || [];
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setLocalFilters({ ...localFilters, [field]: newValues });
  };

  const activeFilterCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof RcAnalyticsFilters];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null;
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
        {/* LOA Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Boat Length (LOA)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min (ft)</Label>
              <Input
                type="number"
                placeholder="20"
                value={localFilters.loaMin || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  loaMin: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-loa-min"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max (ft)</Label>
              <Input
                type="number"
                placeholder="100"
                value={localFilters.loaMax || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  loaMax: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-loa-max"
              />
            </div>
          </div>
        </div>

        {/* Rate Range ($/ft/month) */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Rate Range ($/ft/month)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="$10"
                value={localFilters.rateMin || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  rateMin: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-rate-min"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="$100"
                value={localFilters.rateMax || ""}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  rateMax: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="h-9"
                data-testid="input-rate-max"
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
                <ScrollArea className="h-80">
                  <div className="p-4 space-y-2">
                    {US_STATES.map(state => (
                      <div key={state.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`state-${state.code}`}
                          checked={localFilters.states?.includes(state.code)}
                          onCheckedChange={() => toggleArrayFilter('states', state.code)}
                          data-testid={`checkbox-state-${state.code}`}
                        />
                        <label
                          htmlFor={`state-${state.code}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {state.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Storage Types */}
        {availableStorageTypes.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Storage Types</Label>
            <div className="flex flex-wrap gap-2">
              {availableStorageTypes.map(type => (
                <Badge
                  key={type}
                  variant={localFilters.storageTypes?.includes(type) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => toggleArrayFilter('storageTypes', type)}
                  data-testid={`badge-storage-type-${type}`}
                >
                  {STORAGE_TYPE_LABELS[type] || type}
                  {localFilters.storageTypes?.includes(type) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Rate Periods */}
        {availableRatePeriods.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Rate Period</Label>
            <div className="flex flex-wrap gap-2">
              {availableRatePeriods.map(period => (
                <Badge
                  key={period}
                  variant={localFilters.ratePeriods?.includes(period) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => toggleArrayFilter('ratePeriods', period)}
                  data-testid={`badge-rate-period-${period}`}
                >
                  {RATE_PERIOD_LABELS[period] || period}
                  {localFilters.ratePeriods?.includes(period) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Seasonality */}
        {availableSeasonalities.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Seasonality</Label>
            <div className="flex flex-wrap gap-2">
              {availableSeasonalities.map(season => (
                <Badge
                  key={season}
                  variant={localFilters.seasonalities?.includes(season) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => toggleArrayFilter('seasonalities', season)}
                  data-testid={`badge-seasonality-${season}`}
                >
                  {SEASONALITY_LABELS[season] || season}
                  {localFilters.seasonalities?.includes(season) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Amenity Filters */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Amenities</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="electric-included"
                checked={localFilters.electricIncluded === true}
                onCheckedChange={(checked) => setLocalFilters({
                  ...localFilters,
                  electricIncluded: checked ? true : null
                })}
                data-testid="checkbox-electric-included"
              />
              <label
                htmlFor="electric-included"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Electric Included
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="liveaboard-allowed"
                checked={localFilters.liveaboardAllowed === true}
                onCheckedChange={(checked) => setLocalFilters({
                  ...localFilters,
                  liveaboardAllowed: checked ? true : null
                })}
                data-testid="checkbox-liveaboard-allowed"
              />
              <label
                htmlFor="liveaboard-allowed"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Liveaboard Allowed
              </label>
            </div>
          </div>
        </div>

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
