import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Activity, Filter, RefreshCw } from 'lucide-react';
import UtilizationSummaryCard from './UtilizationSummaryCard';
import UtilizationByTypeTable from './UtilizationByTypeTable';
import UtilizationByBandChart from './UtilizationByBandChart';

type PeriodPreset = 'monthly' | 'quarterly' | 'seasonal' | 't12' | 'custom';

const MARINA_UNIT_TYPES = [
  { value: 'wet_slip', label: 'Wet Slip' },
  { value: 'lift_slip', label: 'Lift Slip' },
  { value: 'dry_rack', label: 'Dry Rack' },
  { value: 'dry_slip', label: 'Dry Slip' },
  { value: 'mooring', label: 'Mooring' },
  { value: 'anchorage', label: 'Anchorage' },
  { value: 'indoor_rack', label: 'Indoor Rack' },
  { value: 'outdoor_rack', label: 'Outdoor Rack' },
];

function getPeriodDates(preset: PeriodPreset): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'monthly': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case 'quarterly': {
      const qStart = Math.floor(month / 3) * 3;
      const start = new Date(year, qStart, 1);
      const end = new Date(year, qStart + 3, 0);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case 'seasonal': {
      const start = month >= 4 && month <= 8
        ? new Date(year, 4, 1)
        : month >= 9
          ? new Date(year, 9, 1)
          : new Date(year - 1, 9, 1);
      const end = month >= 4 && month <= 8
        ? new Date(year, 8, 30)
        : month >= 9
          ? new Date(year + 1, 3, 30)
          : new Date(year, 3, 30);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case 't12': {
      const end = new Date(year, month + 1, 0);
      const start = new Date(year - 1, month + 1, 1);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case 'custom':
    default:
      return getPeriodDates('monthly');
  }
}

interface UtilizationSectionProps {
  projectId: string;
  propertyId?: string;
}

export default function UtilizationSection({ projectId, propertyId }: UtilizationSectionProps) {
  const [period, setPeriod] = useState<PeriodPreset>('monthly');
  const [viewMode, setViewMode] = useState<'unit' | 'weighted'>('unit');
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<string[]>([]);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownMetric, setDrilldownMetric] = useState<string>('');

  const effectivePropertyId = propertyId || projectId;
  const { start: periodStart, end: periodEnd } = useMemo(() => getPeriodDates(period), [period]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      propertyId: effectivePropertyId,
      periodStart,
      periodEnd,
      mode: 'contracted',
    });
    if (selectedUnitTypes.length > 0) {
      params.set('unitTypes', selectedUnitTypes.join(','));
    }
    return params.toString();
  }, [effectivePropertyId, periodStart, periodEnd, selectedUnitTypes]);

  const unitTypesKey = selectedUnitTypes.join(',');

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/utilization/summary', effectivePropertyId, periodStart, periodEnd, unitTypesKey],
    queryFn: async () => {
      const res = await fetch(`/api/utilization/summary?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch utilization summary');
      return res.json();
    },
    enabled: !!effectivePropertyId,
  });

  const { data: byTypeData, isLoading: byTypeLoading } = useQuery({
    queryKey: ['/api/utilization/by-type', effectivePropertyId, periodStart, periodEnd, unitTypesKey],
    queryFn: async () => {
      const res = await fetch(`/api/utilization/by-type?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch by-type data');
      return res.json();
    },
    enabled: !!effectivePropertyId,
  });

  const { data: byBandData, isLoading: byBandLoading } = useQuery({
    queryKey: ['/api/utilization/by-band', effectivePropertyId, periodStart, periodEnd, unitTypesKey],
    queryFn: async () => {
      const res = await fetch(`/api/utilization/by-band?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch by-band data');
      return res.json();
    },
    enabled: !!effectivePropertyId,
  });

  const handleCardClick = (metric: string) => {
    setDrilldownMetric(metric);
    setDrilldownOpen(true);
  };

  const handleTypeRowClick = (unitType: string) => {
    setDrilldownMetric(`type:${unitType}`);
    setDrilldownOpen(true);
  };

  const handleBandBarClick = (bandKey: string) => {
    setDrilldownMetric(`band:${bandKey}`);
    setDrilldownOpen(true);
  };

  const toggleUnitType = (ut: string) => {
    setSelectedUnitTypes(prev =>
      prev.includes(ut) ? prev.filter(v => v !== ut) : [...prev, ut]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Capacity Utilization
          </h3>
          <p className="text-sm text-muted-foreground">
            {periodStart} to {periodEnd}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="seasonal">Seasonal</SelectItem>
              <SelectItem value="t12">Trailing 12</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'unit' | 'weighted')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unit">Unit Count</SelectItem>
              <SelectItem value="weighted">Weighted (LF)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 flex-wrap">
            {MARINA_UNIT_TYPES.slice(0, 4).map(ut => (
              <Badge
                key={ut.value}
                variant={selectedUnitTypes.includes(ut.value) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleUnitType(ut.value)}
              >
                {ut.label}
              </Badge>
            ))}
            {selectedUnitTypes.length > 0 && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => setSelectedUnitTypes([])}
              >
                Clear
              </Badge>
            )}
          </div>
        </div>
      </div>

      <UtilizationSummaryCard
        overall={summaryData?.overall ?? null}
        churn={summaryData?.churn ?? null}
        viewMode={viewMode}
        loading={summaryLoading}
        onCardClick={handleCardClick}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <UtilizationByTypeTable
          byUnitType={byTypeData?.byUnitType ?? []}
          viewMode={viewMode}
          loading={byTypeLoading}
          onRowClick={handleTypeRowClick}
        />

        <UtilizationByBandChart
          bands={byBandData?.bands ?? []}
          viewMode={viewMode}
          loading={byBandLoading}
          onBarClick={handleBandBarClick}
        />
      </div>

      <Sheet open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Drilldown Details</SheetTitle>
            <SheetDescription>
              Detailed view for: {drilldownMetric || 'selected metric'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center py-8">
                  Detailed drilldown will be available in Phase 3.
                  <br />
                  <span className="text-xs">Selected: {drilldownMetric}</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
