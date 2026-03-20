import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Calendar, Download, Plus, ArrowRightToLine, Filter, Home, Hotel, Warehouse, Store, Trees } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface OwnedAsset {
  id: string;
  name: string;
  assetType: string;
  propertyId: string;
  projectId: string | null;
  status: string;
}

// Legacy Marina interface for backward compatibility
interface Marina {
  id: string;
  name: string;
  ownershipStatus: "OWNED" | "DEAL";
}

const ASSET_TYPE_ICONS: Record<string, typeof Building2> = {
  marina: Building2,
  multifamily: Home,
  hotel: Hotel,
  industrial: Warehouse,
  retail: Store,
  office: Building2,
  self_storage: Warehouse,
  land: Trees,
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  marina: 'Marina',
  multifamily: 'Multifamily',
  retail: 'Retail',
  office: 'Office',
  industrial: 'Industrial',
  hotel: 'Hotel',
  str: 'STR',
  self_storage: 'Self Storage',
  mixed_use: 'Mixed Use',
  medical_office: 'Medical Office',
  sfr: 'SFR',
  duplex: 'Duplex',
  triplex: 'Triplex',
  quad: 'Quad',
  rv_park: 'RV Park',
  mobile_home: 'Mobile Home',
  land: 'Land',
  business: 'Business',
  laundromat: 'Laundromat',
};

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
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Fetch universal owned assets (all asset types)
  const { data: ownedAssets = [] } = useQuery<OwnedAsset[]>({
    queryKey: ["/api/operations-context/assets/owned"],
  });

  // Backward compatible: also fetch marinas for legacy consumers
  const { data: marinas = [] } = useQuery<Marina[]>({
    queryKey: ["/api/operations-context/marinas/owned"],
  });

  // Combine: prefer owned assets, fall back to marinas
  const allAssets: OwnedAsset[] = ownedAssets.length > 0
    ? ownedAssets
    : marinas.map(m => ({
        id: m.id,
        name: m.name,
        assetType: 'marina',
        propertyId: '',
        projectId: null,
        status: 'under_management',
      }));

  // Apply type filter
  const filteredAssets = typeFilter
    ? allAssets.filter(a => a.assetType === typeFilter)
    : allAssets;

  // Get unique asset types for filter chips
  const assetTypes = [...new Set(allAssets.map(a => a.assetType))];

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
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select Asset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assets (Portfolio)</SelectItem>
            {filteredAssets.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>
                <span className="flex items-center gap-2">
                  {asset.name}
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {ASSET_TYPE_LABELS[asset.assetType] || asset.assetType}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {assetTypes.length > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant={typeFilter === null ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setTypeFilter(null)}
            >
              All
            </Button>
            {assetTypes.map(type => (
              <Button
                key={type}
                variant={typeFilter === type ? "secondary" : "ghost"}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              >
                {ASSET_TYPE_LABELS[type] || type}
              </Button>
            ))}
          </div>
        )}
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
