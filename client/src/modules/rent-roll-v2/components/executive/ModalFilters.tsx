import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter, X, Calendar, Building2, Warehouse } from "lucide-react";
import { calculateDateRange, getAvailableMonths, type TimePeriodFilter } from "@shared/timePeriodUtils";

const STORAGE_TYPES = [
  "Wet Slip",
  "Lift Slip",
  "Mooring",
  "Jet Ski",
  "Dry Rack - Indoor",
  "Dry Rack - Outdoor",
  "Houseboat",
  "Land Storage",
  "Boat on Trailer",
  "Trailer Only",
  "Carport",
  "RV Site",
  "Other",
];

interface IncludedProject {
  locationId: string;
  name: string;
  projectType: "OWNED" | "DEAL";
}

export interface ModalFilterState {
  timePeriod: TimePeriodFilter;
  selectedProjectIds: string[];
  selectedStorageTypes: string[];
}

interface ModalFiltersProps {
  filters: ModalFilterState;
  onFiltersChange: (filters: ModalFilterState) => void;
  showProjectFilter?: boolean;
  showStorageTypeFilter?: boolean;
  showTimePeriodFilter?: boolean;
  availableYears?: number[];
  className?: string;
}

export function ModalFilters({
  filters,
  onFiltersChange,
  showProjectFilter = true,
  showStorageTypeFilter = true,
  showTimePeriodFilter = true,
  availableYears = [new Date().getFullYear()],
  className = "",
}: ModalFiltersProps) {
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [storageFilterOpen, setStorageFilterOpen] = useState(false);

  const { data: projects } = useQuery<IncludedProject[]>({
    queryKey: ["/api/rent-roll/included-projects"],
    enabled: showProjectFilter,
  });

  const { startDate, endDate, label } = calculateDateRange(filters.timePeriod);

  const handleTimePeriodChange = (type: string) => {
    let newPeriod: TimePeriodFilter;
    
    if (type === "TTM") {
      newPeriod = { type: "TTM" };
    } else if (type.startsWith("year-")) {
      const year = parseInt(type.replace("year-", ""));
      newPeriod = { type: "Year", year };
    } else if (type.startsWith("q-")) {
      const [_, qStr, yearStr] = type.split("-");
      const quarter = parseInt(qStr) as 1 | 2 | 3 | 4;
      const year = parseInt(yearStr);
      newPeriod = { type: "Quarter", quarter, year };
    } else if (type.startsWith("month-")) {
      const [_, monthStr, yearStr] = type.split("-");
      const month = parseInt(monthStr) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
      const year = parseInt(yearStr);
      newPeriod = { type: "Month", month, year };
    } else {
      newPeriod = { type: "TTM" };
    }
    
    onFiltersChange({ ...filters, timePeriod: newPeriod });
  };

  const handleProjectToggle = (projectId: string) => {
    const newSelected = filters.selectedProjectIds.includes(projectId)
      ? filters.selectedProjectIds.filter(id => id !== projectId)
      : [...filters.selectedProjectIds, projectId];
    onFiltersChange({ ...filters, selectedProjectIds: newSelected });
  };

  const handleStorageTypeToggle = (storageType: string) => {
    const newSelected = filters.selectedStorageTypes.includes(storageType)
      ? filters.selectedStorageTypes.filter(t => t !== storageType)
      : [...filters.selectedStorageTypes, storageType];
    onFiltersChange({ ...filters, selectedStorageTypes: newSelected });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      selectedProjectIds: [],
      selectedStorageTypes: [],
    });
  };

  const hasActiveFilters = filters.selectedProjectIds.length > 0 || filters.selectedStorageTypes.length > 0;

  const getTimePeriodValue = () => {
    if (filters.timePeriod.type === "TTM") return "TTM";
    if (filters.timePeriod.type === "Year") return `year-${filters.timePeriod.year}`;
    if (filters.timePeriod.type === "Quarter") return `q-${filters.timePeriod.quarter}-${filters.timePeriod.year}`;
    if (filters.timePeriod.type === "Month") return `month-${filters.timePeriod.month}-${filters.timePeriod.year}`;
    return "TTM";
  };

  const months = getAvailableMonths();

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {showTimePeriodFilter && (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={getTimePeriodValue()} onValueChange={handleTimePeriodChange}>
            <SelectTrigger className="w-[170px] h-8" data-testid="select-time-period">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TTM">Trailing 12M</SelectItem>
              {availableYears.map(year => (
                <SelectItem key={year} value={`year-${year}`}>
                  Full Year {year}
                </SelectItem>
              ))}
              {availableYears.map(year => [1, 2, 3, 4].map(q => (
                <SelectItem key={`q-${q}-${year}`} value={`q-${q}-${year}`}>
                  Q{q} {year}
                </SelectItem>
              )))}
              {availableYears.flatMap(year => months.map(m => (
                <SelectItem key={`month-${m.value}-${year}`} value={`month-${m.value}-${year}`}>
                  {m.label} {year}
                </SelectItem>
              )))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showProjectFilter && projects && projects.length > 0 && (
        <Popover open={projectFilterOpen} onOpenChange={setProjectFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              data-testid="button-project-filter"
            >
              <Building2 className="h-4 w-4" />
              Projects
              {filters.selectedProjectIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {filters.selectedProjectIds.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Filter by Project</span>
                {filters.selectedProjectIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onFiltersChange({ ...filters, selectedProjectIds: [] })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {projects.map((project) => (
                  <div key={project.locationId} className="flex items-center gap-2">
                    <Checkbox
                      id={`project-${project.locationId}`}
                      checked={filters.selectedProjectIds.includes(project.locationId)}
                      onCheckedChange={() => handleProjectToggle(project.locationId)}
                      data-testid={`checkbox-project-${project.locationId}`}
                    />
                    <Label
                      htmlFor={`project-${project.locationId}`}
                      className="text-sm cursor-pointer flex-1 truncate"
                    >
                      {project.name}
                    </Label>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {project.projectType}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {showStorageTypeFilter && (
        <Popover open={storageFilterOpen} onOpenChange={setStorageFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              data-testid="button-storage-filter"
            >
              <Warehouse className="h-4 w-4" />
              Storage Type
              {filters.selectedStorageTypes.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {filters.selectedStorageTypes.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Filter by Storage Type</span>
                {filters.selectedStorageTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onFiltersChange({ ...filters, selectedStorageTypes: [] })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {STORAGE_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`storage-${type}`}
                      checked={filters.selectedStorageTypes.includes(type)}
                      onCheckedChange={() => handleStorageTypeToggle(type)}
                      data-testid={`checkbox-storage-${type.replace(/\s+/g, "-").toLowerCase()}`}
                    />
                    <Label
                      htmlFor={`storage-${type}`}
                      className="text-sm cursor-pointer"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          onClick={clearAllFilters}
          data-testid="button-clear-filters"
        >
          <X className="h-4 w-4 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

export function getFilterQueryParams(filters: ModalFilterState): URLSearchParams {
  const { startDate, endDate } = calculateDateRange(filters.timePeriod);
  const params = new URLSearchParams({ startDate, endDate });
  
  if (filters.selectedProjectIds.length > 0) {
    params.set("projectIds", filters.selectedProjectIds.join(","));
  }
  
  if (filters.selectedStorageTypes.length > 0) {
    params.set("storageTypes", filters.selectedStorageTypes.join(","));
  }
  
  return params;
}
