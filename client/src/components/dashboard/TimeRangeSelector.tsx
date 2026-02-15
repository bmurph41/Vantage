import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export type TimeRange = '7d' | '30d' | '90d' | 'ytd' | 'all'
  | 'q1' | 'q2' | 'q3' | 'q4'
  | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'
  | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec'
  | 'last_year' | 'this_year';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (timeRange: TimeRange) => void;
}

const quickRanges: { key: TimeRange; label: string }[] = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'all', label: 'All Time' },
];

const quarterRanges: { key: TimeRange; label: string }[] = [
  { key: 'q1', label: 'Q1 (Jan–Mar)' },
  { key: 'q2', label: 'Q2 (Apr–Jun)' },
  { key: 'q3', label: 'Q3 (Jul–Sep)' },
  { key: 'q4', label: 'Q4 (Oct–Dec)' },
];

const monthRanges: { key: TimeRange; label: string }[] = [
  { key: 'jan', label: 'January' },
  { key: 'feb', label: 'February' },
  { key: 'mar', label: 'March' },
  { key: 'apr', label: 'April' },
  { key: 'may', label: 'May' },
  { key: 'jun', label: 'June' },
  { key: 'jul', label: 'July' },
  { key: 'aug', label: 'August' },
  { key: 'sep', label: 'September' },
  { key: 'oct', label: 'October' },
  { key: 'nov', label: 'November' },
  { key: 'dec', label: 'December' },
];

const allLabels: Record<string, string> = {};
[...quickRanges, ...quarterRanges, ...monthRanges].forEach(r => { allLabels[r.key] = r.label; });

export function getTimeRangeLabel(value: TimeRange): string {
  return allLabels[value] || value;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          data-testid="timerange-selector-trigger"
        >
          <Calendar className="h-4 w-4" />
          {allLabels[value] || value}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {quickRanges.map(({ key, label }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => onChange(key)}
            className={value === key ? 'bg-accent' : ''}
            data-testid={`timerange-option-${key}`}
          >
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Quarters</DropdownMenuLabel>
        {quarterRanges.map(({ key, label }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => onChange(key)}
            className={value === key ? 'bg-accent' : ''}
            data-testid={`timerange-option-${key}`}
          >
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Months</DropdownMenuLabel>
        {monthRanges.map(({ key, label }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => onChange(key)}
            className={value === key ? 'bg-accent' : ''}
            data-testid={`timerange-option-${key}`}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
