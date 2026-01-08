import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Filter, X, Search, MapPin, RotateCcw } from 'lucide-react';
import type { MapFilters, MapConfig } from './types';

interface MapFilterBarProps {
  config: MapConfig;
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onSearch?: (address: string) => void;
  onReset: () => void;
  totalResults?: number;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const WATER_TYPES = ['Coastal', 'Lake', 'River'];

const REGIONS = [
  'Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'Pacific Northwest'
];

export function MapFilterBar({
  config,
  filters,
  onFiltersChange,
  onSearch,
  onReset,
  totalResults = 0,
}: MapFilterBarProps) {
  const [searchAddress, setSearchAddress] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = useCallback((key: keyof MapFilters, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  const handleSearch = useCallback(() => {
    if (searchAddress && onSearch) {
      onSearch(searchAddress);
    }
  }, [searchAddress, onSearch]);

  const activeFilterCount = Object.values(filters).filter(v => 
    v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  return (
    <div className="bg-background border-b p-3 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search address or location..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
              data-testid="input-map-search"
            />
          </div>
          <Button 
            size="sm" 
            onClick={handleSearch}
            data-testid="button-map-search"
          >
            <MapPin className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Radius (mi):</Label>
          <Select
            value={String(filters.radius || 50)}
            onValueChange={(v) => updateFilter('radius', Number(v))}
          >
            <SelectTrigger className="w-24" data-testid="select-radius">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 mi</SelectItem>
              <SelectItem value="25">25 mi</SelectItem>
              <SelectItem value="50">50 mi</SelectItem>
              <SelectItem value="100">100 mi</SelectItem>
              <SelectItem value="250">250 mi</SelectItem>
              <SelectItem value="500">500 mi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-filter-state">
              State {filters.states?.length ? `(${filters.states.length})` : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <Label>Select States</Label>
              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                {US_STATES.map(state => (
                  <Badge
                    key={state}
                    variant={filters.states?.includes(state) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const current = filters.states || [];
                      const updated = current.includes(state)
                        ? current.filter(s => s !== state)
                        : [...current, state];
                      updateFilter('states', updated.length > 0 ? updated : undefined);
                    }}
                  >
                    {state}
                  </Badge>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          data-testid="button-advanced-filters"
        >
          <Filter className="h-4 w-4 mr-1" />
          Advanced
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          data-testid="button-reset-filters"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>

        <div className="text-sm text-muted-foreground ml-auto">
          {totalResults.toLocaleString()} results
        </div>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-3 border-t">
          {config.module === 'sale_comps' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Price Range ($)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minPrice || ''}
                    onChange={(e) => updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 text-xs"
                    data-testid="input-min-price"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxPrice || ''}
                    onChange={(e) => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 text-xs"
                    data-testid="input-max-price"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sale Year</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="From"
                    value={filters.minYear || ''}
                    onChange={(e) => updateFilter('minYear', e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 text-xs"
                    data-testid="input-min-year"
                  />
                  <Input
                    type="number"
                    placeholder="To"
                    value={filters.maxYear || ''}
                    onChange={(e) => updateFilter('maxYear', e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 text-xs"
                    data-testid="input-max-year"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Water Type</Label>
            <Select
              value={filters.waterTypes?.[0] || 'all'}
              onValueChange={(v) => updateFilter('waterTypes', v === 'all' ? undefined : [v])}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-water-type">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {WATER_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Region</Label>
            <Select
              value={filters.regions?.[0] || 'all'}
              onValueChange={(v) => updateFilter('regions', v === 'all' ? undefined : [v])}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-region">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {REGIONS.map(region => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Wet Slips</Label>
            <div className="flex gap-1">
              <Input
                type="number"
                placeholder="Min"
                value={filters.minWetSlips || ''}
                onChange={(e) => updateFilter('minWetSlips', e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 text-xs"
                data-testid="input-min-wet-slips"
              />
              <Input
                type="number"
                placeholder="Max"
                value={filters.maxWetSlips || ''}
                onChange={(e) => updateFilter('maxWetSlips', e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 text-xs"
                data-testid="input-max-wet-slips"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Dry Racks</Label>
            <div className="flex gap-1">
              <Input
                type="number"
                placeholder="Min"
                value={filters.minDryRacks || ''}
                onChange={(e) => updateFilter('minDryRacks', e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 text-xs"
                data-testid="input-min-dry-racks"
              />
              <Input
                type="number"
                placeholder="Max"
                value={filters.maxDryRacks || ''}
                onChange={(e) => updateFilter('maxDryRacks', e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 text-xs"
                data-testid="input-max-dry-racks"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
