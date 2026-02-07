import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Calendar, Download, Plus, ArrowRightToLine, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { addDays, subDays, startOfYear, endOfYear, subMonths } from "date-fns";

interface Marina {
  id: string;
  name: string;
  ownershipStatus: "OWNED" | "DEAL";
}

interface GlobalControlsBarProps {
  selectedMarinaId: string | null;
  onMarinaChange: (marinaId: string) => void;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  aggregation?: string;
  onAggregationChange?: (aggregation: string) => void;
  showAggregation?: boolean;
  showSourceFilter?: boolean;
  source?: string;
  onSourceChange?: (source: string) => void;
  onExport?: () => void;
  onAddEntry?: () => void;
  onUseInValuator?: () => void;
  showValuatorButton?: boolean;
}

export function GlobalControlsBar({
  selectedMarinaId,
  onMarinaChange,
  timeframe,
  onTimeframeChange,
  dateRange,
  onDateRangeChange,
  aggregation = "monthly",
  onAggregationChange,
  showAggregation = true,
  showSourceFilter = false,
  source = "all",
  onSourceChange,
  onExport,
  onAddEntry,
  onUseInValuator,
  showValuatorButton = true,
}: GlobalControlsBarProps) {
  const [showCustomRange, setShowCustomRange] = useState(false);

  const { data: marinas = [] } = useQuery<Marina[]>({
    queryKey: ["/api/operations-context/marinas/owned"],
  });

  const handleTimeframeChange = (value: string) => {
    onTimeframeChange(value);
    if (value === "custom") {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      if (onDateRangeChange) {
        const today = new Date();
        let from: Date;
        let to = today;
        
        switch (value) {
          case "30d":
            from = subDays(today, 30);
            break;
          case "90d":
            from = subDays(today, 90);
            break;
          case "ytd":
            from = startOfYear(today);
            break;
          case "trailing12":
            from = subMonths(today, 12);
            break;
          case "lastYear":
            from = startOfYear(subMonths(today, 12));
            to = endOfYear(subMonths(today, 12));
            break;
          default:
            from = subDays(today, 30);
        }
        
        onDateRangeChange({ from, to });
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg border mb-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Select value={selectedMarinaId || ""} onValueChange={onMarinaChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Marina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owned Marinas</SelectItem>
            {marinas.map((marina) => (
              <SelectItem key={marina.id} value={marina.id}>
                {marina.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={timeframe} onValueChange={handleTimeframeChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="ytd">Year to Date</SelectItem>
            <SelectItem value="trailing12">Trailing 12 Months</SelectItem>
            <SelectItem value="lastYear">Last Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showCustomRange && onDateRangeChange && (
        <DatePickerWithRange
          date={dateRange}
          onDateChange={onDateRangeChange}
        />
      )}

      {showAggregation && onAggregationChange && (
        <Select value={aggregation} onValueChange={onAggregationChange}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="Aggregation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      )}

      {showSourceFilter && onSourceChange && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={source} onValueChange={onSourceChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="CSV_IMPORT">CSV Import</SelectItem>
              <SelectItem value="INTEGRATION">Integration</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
        
        {onAddEntry && (
          <Button variant="outline" size="sm" onClick={onAddEntry}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        )}

        {showValuatorButton && onUseInValuator && (
          <Button variant="default" size="sm" onClick={onUseInValuator}>
            <ArrowRightToLine className="h-4 w-4 mr-2" />
            Use in Financial Model
          </Button>
        )}
      </div>
    </div>
  );
}

export default GlobalControlsBar;
