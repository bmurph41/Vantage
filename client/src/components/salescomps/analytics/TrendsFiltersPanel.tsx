import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Filter, ChevronDown, ChevronUp, X, Calendar, MapPin, 
  Building2, Anchor, Ship, RotateCcw
} from "lucide-react";

export interface TrendsFilters {
  yearMin?: number;
  yearMax?: number;
  regions?: string[];
  states?: string[];
  wetSlipsMin?: number;
  wetSlipsMax?: number;
  dryRacksMin?: number;
  dryRacksMax?: number;
  profitCenters?: string[];
}

interface TrendsFiltersPanelProps {
  filters: TrendsFilters;
  onFiltersChange: (filters: TrendsFilters) => void;
}

const PROFIT_CENTER_OPTIONS = [
  { id: 'fuel', label: 'Fuel Operations', icon: '⛽' },
  { id: 'ship_store', label: 'Ship Store', icon: '🏪' },
  { id: 'storage', label: 'Dry Storage', icon: '📦' },
  { id: 'service', label: 'Service/Repair', icon: '🔧' },
  { id: 'boat_rentals', label: 'Boat Rentals', icon: '🚤' },
  { id: 'boat_brokerage', label: 'Boat Brokerage', icon: '💼' },
  { id: 'events', label: 'Events', icon: '🎉' },
  { id: 'rv_park', label: 'RV Park', icon: '🏕️' },
  { id: 'third_party_leases', label: 'Third Party Leases', icon: '📋' },
  { id: 'parts', label: 'Parts', icon: '🔩' },
];

const REGION_OPTIONS = [
  'Southeast',
  'Gulf Coast',
  'Northeast',
  'Mid-Atlantic',
  'Great Lakes',
  'Pacific Northwest',
  'Southwest',
  'West Coast',
  'Florida',
  'Caribbean',
];

export default function TrendsFiltersPanel({ filters, onFiltersChange }: TrendsFiltersPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    timeframe: true,
    location: false,
    capacity: false,
    amenities: false,
  });

  const { data: columnValues } = useQuery({
    queryKey: ['trends-column-values'],
    queryFn: async () => {
      const [statesRes, regionsRes] = await Promise.all([
        fetch('/api/sales-comps/column-values/state').then(r => r.json()),
        fetch('/api/sales-comps/column-values/region').then(r => r.json()),
      ]);
      return {
        states: statesRes.values || [],
        regions: regionsRes.values || [],
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  const availableStates = columnValues?.states || [];
  const availableRegions = columnValues?.regions?.length > 0 ? columnValues.regions : REGION_OPTIONS;

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = <K extends keyof TrendsFilters>(key: K, value: TrendsFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayItem = (key: 'regions' | 'states' | 'profitCenters', item: string) => {
    const current = filters[key] || [];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    updateFilter(key, updated.length > 0 ? updated : undefined);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = [
    filters.yearMin || filters.yearMax ? 1 : 0,
    filters.regions?.length || 0,
    filters.states?.length || 0,
    filters.wetSlipsMin || filters.wetSlipsMax ? 1 : 0,
    filters.dryRacksMin || filters.dryRacksMax ? 1 : 0,
    filters.profitCenters?.length || 0,
  ].reduce((a, b) => a + b, 0);

  const currentYear = new Date().getFullYear();

  return (
    <Card className="border-dashed">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Trend Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount} active
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllFilters();
                    }}
                    className="h-7 text-xs"
                    data-testid="button-clear-all-filters"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Time Frame Section */}
            <Collapsible open={openSections.timeframe} onOpenChange={() => toggleSection('timeframe')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:text-primary transition-colors">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Time Frame
                  {(filters.yearMin || filters.yearMax) && (
                    <Badge variant="outline" className="text-xs">
                      {filters.yearMin || 'Any'} - {filters.yearMax || 'Present'}
                    </Badge>
                  )}
                </span>
                {openSections.timeframe ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start Year</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2015"
                      min={1990}
                      max={currentYear}
                      value={filters.yearMin || ''}
                      onChange={(e) => updateFilter('yearMin', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="h-8 text-sm"
                      data-testid="input-year-min"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">End Year</Label>
                    <Input
                      type="number"
                      placeholder="Present"
                      min={1990}
                      max={currentYear}
                      value={filters.yearMax || ''}
                      onChange={(e) => updateFilter('yearMax', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="h-8 text-sm"
                      data-testid="input-year-max"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'Last 3Y', min: currentYear - 3 },
                    { label: 'Last 5Y', min: currentYear - 5 },
                    { label: 'Last 10Y', min: currentYear - 10 },
                    { label: 'All Time', min: undefined, max: undefined },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant={filters.yearMin === preset.min && !filters.yearMax ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        updateFilter('yearMin', preset.min);
                        updateFilter('yearMax', preset.max);
                      }}
                      data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Location Section */}
            <Collapsible open={openSections.location} onOpenChange={() => toggleSection('location')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:text-primary transition-colors">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                  {((filters.regions?.length || 0) + (filters.states?.length || 0)) > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {(filters.regions?.length || 0) + (filters.states?.length || 0)} selected
                    </Badge>
                  )}
                </span>
                {openSections.location ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                {/* Regions */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Regions</Label>
                  <div className="flex flex-wrap gap-1">
                    {availableRegions.map((region: string) => (
                      <Button
                        key={region}
                        variant={filters.regions?.includes(region) ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => toggleArrayItem('regions', region)}
                        data-testid={`button-region-${region.toLowerCase().replace(/\s/g, '-')}`}
                      >
                        {region}
                        {filters.regions?.includes(region) && <X className="h-3 w-3 ml-1" />}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* States */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">States</Label>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                      {availableStates.map((state: string) => (
                        <div key={state} className="flex items-center space-x-2">
                          <Checkbox
                            id={`state-${state}`}
                            checked={filters.states?.includes(state) || false}
                            onCheckedChange={() => toggleArrayItem('states', state)}
                            data-testid={`checkbox-state-${state}`}
                          />
                          <label
                            htmlFor={`state-${state}`}
                            className="text-xs cursor-pointer"
                          >
                            {state}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Capacity Section */}
            <Collapsible open={openSections.capacity} onOpenChange={() => toggleSection('capacity')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:text-primary transition-colors">
                <span className="flex items-center gap-2">
                  <Anchor className="h-4 w-4" />
                  Capacity
                  {(filters.wetSlipsMin || filters.wetSlipsMax || filters.dryRacksMin || filters.dryRacksMax) && (
                    <Badge variant="outline" className="text-xs">filtered</Badge>
                  )}
                </span>
                {openSections.capacity ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-4">
                {/* Wet Slips */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Ship className="h-3 w-3" />
                      Wet Slips
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {filters.wetSlipsMin || 0} - {filters.wetSlipsMax || '500+'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      min={0}
                      value={filters.wetSlipsMin || ''}
                      onChange={(e) => updateFilter('wetSlipsMin', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="h-7 text-xs"
                      data-testid="input-wet-slips-min"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      min={0}
                      value={filters.wetSlipsMax || ''}
                      onChange={(e) => updateFilter('wetSlipsMax', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="h-7 text-xs"
                      data-testid="input-wet-slips-max"
                    />
                  </div>
                  <div className="flex gap-1">
                    {[
                      { label: '0-50', min: 0, max: 50 },
                      { label: '50-100', min: 50, max: 100 },
                      { label: '100-200', min: 100, max: 200 },
                      { label: '200+', min: 200, max: undefined },
                    ].map((preset) => (
                      <Button
                        key={preset.label}
                        variant={filters.wetSlipsMin === preset.min && filters.wetSlipsMax === preset.max ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-5 text-xs px-2"
                        onClick={() => {
                          updateFilter('wetSlipsMin', preset.min);
                          updateFilter('wetSlipsMax', preset.max);
                        }}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Dry Racks */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Dry Racks
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {filters.dryRacksMin || 0} - {filters.dryRacksMax || '500+'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      min={0}
                      value={filters.dryRacksMin || ''}
                      onChange={(e) => updateFilter('dryRacksMin', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="h-7 text-xs"
                      data-testid="input-dry-racks-min"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      min={0}
                      value={filters.dryRacksMax || ''}
                      onChange={(e) => updateFilter('dryRacksMax', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="h-7 text-xs"
                      data-testid="input-dry-racks-max"
                    />
                  </div>
                  <div className="flex gap-1">
                    {[
                      { label: '0-100', min: 0, max: 100 },
                      { label: '100-300', min: 100, max: 300 },
                      { label: '300+', min: 300, max: undefined },
                    ].map((preset) => (
                      <Button
                        key={preset.label}
                        variant={filters.dryRacksMin === preset.min && filters.dryRacksMax === preset.max ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-5 text-xs px-2"
                        onClick={() => {
                          updateFilter('dryRacksMin', preset.min);
                          updateFilter('dryRacksMax', preset.max);
                        }}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Amenities/Profit Centers Section */}
            <Collapsible open={openSections.amenities} onOpenChange={() => toggleSection('amenities')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:text-primary transition-colors">
                <span className="flex items-center gap-2">
                  ⚓ Amenities
                  {(filters.profitCenters?.length || 0) > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {filters.profitCenters?.length} selected
                    </Badge>
                  )}
                </span>
                {openSections.amenities ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PROFIT_CENTER_OPTIONS.map((pc) => (
                    <div key={pc.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`pc-${pc.id}`}
                        checked={filters.profitCenters?.includes(pc.id) || false}
                        onCheckedChange={() => toggleArrayItem('profitCenters', pc.id)}
                        data-testid={`checkbox-pc-${pc.id}`}
                      />
                      <label
                        htmlFor={`pc-${pc.id}`}
                        className="text-xs cursor-pointer flex items-center gap-1"
                      >
                        <span>{pc.icon}</span>
                        {pc.label}
                      </label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
