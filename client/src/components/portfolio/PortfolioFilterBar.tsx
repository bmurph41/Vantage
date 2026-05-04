import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';

export interface PortfolioFilters {
  assetClasses: string[];
  statuses: string[];
  regions: string[];
  states: string[];
  vintageFrom: string;
  vintageTo: string;
}

export const EMPTY_FILTERS: PortfolioFilters = {
  assetClasses: [],
  statuses: [],
  regions: [],
  states: [],
  vintageFrom: '',
  vintageTo: '',
};

const ASSET_CLASS_OPTIONS = [
  { value: 'marina', label: 'Marina' },
  { value: 'str', label: 'STR' },
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'self_storage', label: 'Self Storage' },
  { value: 'laundromat', label: 'Laundromat' },
  { value: 'car_wash', label: 'Car Wash' },
  { value: 'retail', label: 'Retail' },
  { value: 'office', label: 'Office' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'won', label: 'Closed' },
];

const REGION_OPTIONS = [
  { value: 'Northeast', label: 'Northeast' },
  { value: 'Southeast', label: 'Southeast' },
  { value: 'Midwest', label: 'Midwest' },
  { value: 'Southwest', label: 'Southwest' },
  { value: 'West', label: 'West' },
  { value: 'Mountain', label: 'Mountain' },
  { value: 'Great Lakes', label: 'Great Lakes' },
  { value: 'Mid-Atlantic', label: 'Mid-Atlantic' },
];

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}

function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-normal">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer" onClick={() => toggle(opt.value)}>
              <Checkbox
                id={`filter-${opt.value}`}
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              <Label htmlFor={`filter-${opt.value}`} className="text-xs cursor-pointer flex-1">{opt.label}</Label>
            </div>
          ))}
        </div>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-1 h-6 text-xs text-muted-foreground" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface PortfolioFilterBarProps {
  filters: PortfolioFilters;
  onChange: (filters: PortfolioFilters) => void;
  assetCount?: number;
}

export function PortfolioFilterBar({ filters, onChange, assetCount }: PortfolioFilterBarProps) {
  const activeCount = [
    ...filters.assetClasses,
    ...filters.statuses,
    ...filters.regions,
    ...filters.states,
    filters.vintageFrom,
    filters.vintageTo,
  ].filter(Boolean).length;

  const update = (partial: Partial<PortfolioFilters>) => onChange({ ...filters, ...partial });

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 border-b mb-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>Filters</span>
        {assetCount !== undefined && (
          <span className="ml-1 text-foreground font-medium">({assetCount} assets)</span>
        )}
      </div>

      <MultiSelectFilter
        label="Asset Class"
        options={ASSET_CLASS_OPTIONS}
        selected={filters.assetClasses}
        onChange={(v) => update({ assetClasses: v })}
      />

      <MultiSelectFilter
        label="Status"
        options={STATUS_OPTIONS}
        selected={filters.statuses}
        onChange={(v) => update({ statuses: v })}
      />

      <MultiSelectFilter
        label="Region"
        options={REGION_OPTIONS}
        selected={filters.regions}
        onChange={(v) => update({ regions: v })}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-normal">
            Vintage Year
            {(filters.vintageFrom || filters.vintageTo) && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">1</Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3" align="start">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="number"
                placeholder="e.g. 2018"
                value={filters.vintageFrom}
                onChange={(e) => update({ vintageFrom: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="number"
                placeholder="e.g. 2024"
                value={filters.vintageTo}
                onChange={(e) => update({ vintageTo: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            {(filters.vintageFrom || filters.vintageTo) && (
              <Button variant="ghost" size="sm" className="w-full h-6 text-xs text-muted-foreground"
                onClick={() => update({ vintageFrom: '', vintageTo: '' })}>
                Clear
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground gap-1 ml-1"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          <X className="h-3 w-3" />
          Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
        </Button>
      )}
    </div>
  );
}
