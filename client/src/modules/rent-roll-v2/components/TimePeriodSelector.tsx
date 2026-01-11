import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import type { TimePeriodFilter, TimePeriodType } from "@shared/timePeriodUtils";
import {
  getAvailableMonths,
  getAvailableQuarters,
  calculateDateRange,
  detectSeasonFromMonth,
} from "@shared/timePeriodUtils";

export type SuggestedContractTerm = "overall" | "seasonal" | "winter" | "annual" | null;

interface TimePeriodSelectorProps {
  value: TimePeriodFilter;
  onChange: (filter: TimePeriodFilter, suggestedContractTerm?: SuggestedContractTerm) => void;
  locationId?: string | null;
}

const periodTypeLabels: Record<TimePeriodType, string> = {
  TTM: "Trailing 12 Months",
  Year: "Full Year",
  Month: "Monthly",
  Quarter: "Quarterly",
  Summer: "Summer Season",
  Winter: "Winter Season",
};

export default function TimePeriodSelector({ value, onChange, locationId }: TimePeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  
  const { data: availableYears = [currentYear] } = useQuery<number[]>({
    queryKey: ['/api/rent-roll/available-years', { locationId: locationId || undefined }],
    enabled: true,
  });
  
  const availableMonths = getAvailableMonths();
  const availableQuarters = getAvailableQuarters();
  const dateRange = calculateDateRange(value);

  const getSuggestedContractTerm = (type: TimePeriodType, month?: number): SuggestedContractTerm => {
    if (type === "TTM" || type === "Year") {
      return "overall";
    }
    if (type === "Summer") {
      return "seasonal";
    }
    if (type === "Winter") {
      return "winter";
    }
    if (type === "Month" && month) {
      const season = detectSeasonFromMonth(month);
      if (season === "summer") return "seasonal";
      if (season === "winter") return "winter";
    }
    if (type === "Quarter") {
      return "seasonal";
    }
    return null;
  };

  const handleTypeChange = (type: TimePeriodType) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);

    let newFilter: TimePeriodFilter;
    let suggestedTerm: SuggestedContractTerm = null;
    
    if (type === "Year") {
      newFilter = { type, year: currentYear };
      suggestedTerm = "overall";
    } else if (type === "Month") {
      newFilter = { type, year: currentYear, month: currentMonth };
      suggestedTerm = getSuggestedContractTerm(type, currentMonth);
    } else if (type === "Quarter") {
      newFilter = { type, year: currentYear, quarter: currentQuarter };
      suggestedTerm = "seasonal";
    } else if (type === "Summer") {
      newFilter = { type, year: currentYear };
      suggestedTerm = "seasonal";
    } else if (type === "Winter") {
      newFilter = { type, year: currentYear };
      suggestedTerm = "winter";
    } else {
      newFilter = { type };
      suggestedTerm = "overall";
    }
    
    onChange(newFilter, suggestedTerm);
  };

  const handleYearChange = (year: string) => {
    const newFilter = { ...value, year: parseInt(year) };
    const suggestedTerm = value.type === "Month" && value.month
      ? getSuggestedContractTerm(value.type, value.month)
      : getSuggestedContractTerm(value.type);
    onChange(newFilter, suggestedTerm);
  };

  const handleMonthChange = (month: string) => {
    const monthNum = parseInt(month);
    const newFilter = { ...value, month: monthNum };
    const suggestedTerm = getSuggestedContractTerm("Month", monthNum);
    onChange(newFilter, suggestedTerm);
  };

  const handleQuarterChange = (quarter: string) => {
    const newFilter = { ...value, quarter: parseInt(quarter) };
    onChange(newFilter, "seasonal");
  };

  const getButtonLabel = () => {
    if (value.type === "TTM") return "TTM";
    if (value.type === "Year") return `${value.year}`;
    if (value.type === "Month") {
      const monthName = availableMonths.find(m => m.value === value.month)?.label || "";
      return `${monthName} ${value.year}`;
    }
    if (value.type === "Quarter") {
      return `Q${value.quarter} ${value.year}`;
    }
    if (value.type === "Summer") {
      return `Summer ${value.year}`;
    }
    if (value.type === "Winter") {
      return `Winter ${(value.year || 2025) - 1}/${value.year}`;
    }
    return "Select Period";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 min-w-[120px]"
          data-testid="button-time-period"
        >
          <Calendar className="h-4 w-4" />
          {getButtonLabel()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" data-testid="popover-time-period">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {(["TTM", "Year", "Month", "Quarter", "Summer", "Winter"] as TimePeriodType[]).map((type) => (
              <Button
                key={type}
                size="sm"
                variant={value.type === type ? "default" : "outline"}
                className="text-xs h-8"
                onClick={() => handleTypeChange(type)}
                data-testid={`button-period-${type.toLowerCase()}`}
              >
                {type === "TTM" ? "TTM" : type}
              </Button>
            ))}
          </div>

          {value.type === "Year" && (
            <Select value={value.year?.toString()} onValueChange={handleYearChange}>
              <SelectTrigger data-testid="select-year" className="h-9">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {value.type === "Month" && (
            <div className="grid grid-cols-2 gap-2">
              <Select value={value.year?.toString()} onValueChange={handleYearChange}>
                <SelectTrigger data-testid="select-month-year" className="h-9">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={value.month?.toString()} onValueChange={handleMonthChange}>
                <SelectTrigger data-testid="select-month" className="h-9">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {value.type === "Quarter" && (
            <div className="grid grid-cols-2 gap-2">
              <Select value={value.year?.toString()} onValueChange={handleYearChange}>
                <SelectTrigger data-testid="select-quarter-year" className="h-9">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={value.quarter?.toString()} onValueChange={handleQuarterChange}>
                <SelectTrigger data-testid="select-quarter" className="h-9">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  {availableQuarters.map((quarter) => (
                    <SelectItem key={quarter.value} value={quarter.value.toString()}>
                      {quarter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {value.type === "Summer" && (
            <Select value={value.year?.toString()} onValueChange={handleYearChange}>
              <SelectTrigger data-testid="select-summer-year" className="h-9">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    Summer {year} (Apr-Oct)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {value.type === "Winter" && (
            <Select value={value.year?.toString()} onValueChange={handleYearChange}>
              <SelectTrigger data-testid="select-winter-year" className="h-9">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    Winter {year - 1}/{year} (Nov-Mar)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="pt-2 border-t text-xs text-muted-foreground">
            <p className="font-medium">{dateRange.label}</p>
            <p className="mt-0.5">{dateRange.startDate} to {dateRange.endDate}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
