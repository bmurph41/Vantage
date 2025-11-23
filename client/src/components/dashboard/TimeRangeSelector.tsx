import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TimeRange = '7d' | '30d' | '90d' | 'ytd' | 'all';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (timeRange: TimeRange) => void;
}

const timeRangeLabels: Record<TimeRange, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  'ytd': 'Year to Date',
  'all': 'All Time',
};

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
          {timeRangeLabels[value]}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(timeRangeLabels).map(([key, label]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => onChange(key as TimeRange)}
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
