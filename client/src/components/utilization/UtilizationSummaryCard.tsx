import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Anchor,
  Percent,
  Ruler,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UtilizationOverall {
  unitUtil: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    offlineUnits: number;
    availableUnits: number;
    utilizationPct: number;
  };
  weightedUtil: {
    totalCapacity: number;
    occupiedCapacity: number;
    offlineCapacity: number;
    availableCapacity: number;
    weightedUtilPct: number;
    label: string;
  };
  economicUtil: {
    revenuePerAvailableCapacityTime: number;
    label: string;
  };
}

interface ChurnMetrics {
  moveIns: number;
  moveOuts: number;
  netAbsorption: number;
  avgTenureMonths: number | null;
}

interface UtilizationSummaryCardProps {
  overall: UtilizationOverall | null;
  churn: ChurnMetrics | null;
  viewMode: 'unit' | 'weighted';
  loading: boolean;
  onCardClick?: (metric: string) => void;
}

function MetricTile({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  loading,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color?: string;
  loading: boolean;
  onClick?: () => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
      <CardContent className="pt-6" onClick={onClick}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UtilizationSummaryCard({
  overall,
  churn,
  viewMode,
  loading,
  onCardClick,
}: UtilizationSummaryCardProps) {
  if (loading || !overall) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const utilPct = viewMode === 'unit'
    ? overall.unitUtil.utilizationPct
    : overall.weightedUtil.weightedUtilPct;

  const utilLabel = viewMode === 'unit' ? 'Unit Utilization' : 'Weighted Utilization';
  const utilSubtitle = viewMode === 'unit'
    ? `${overall.unitUtil.occupiedUnits} of ${overall.unitUtil.availableUnits} available`
    : `${overall.weightedUtil.occupiedCapacity.toFixed(0)} of ${overall.weightedUtil.availableCapacity.toFixed(0)} ${overall.weightedUtil.label}`;

  const utilColor = utilPct >= 90 ? 'text-green-600' : utilPct >= 70 ? 'text-amber-600' : 'text-red-600';

  const netAbsorption = churn?.netAbsorption ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          title={utilLabel}
          value={`${utilPct.toFixed(1)}%`}
          subtitle={utilSubtitle}
          icon={Percent}
          color={utilColor}
          loading={false}
          onClick={() => onCardClick?.('utilization')}
        />
        <MetricTile
          title="Total Units"
          value={overall.unitUtil.totalUnits}
          subtitle={`${overall.unitUtil.occupiedUnits} occupied, ${overall.unitUtil.vacantUnits} vacant`}
          icon={Anchor}
          loading={false}
          onClick={() => onCardClick?.('units')}
        />
        <MetricTile
          title="Offline Units"
          value={overall.unitUtil.offlineUnits}
          subtitle={overall.unitUtil.offlineUnits > 0 ? 'Under maintenance or blocked' : 'All units available'}
          icon={AlertTriangle}
          color={overall.unitUtil.offlineUnits > 0 ? 'text-amber-600' : undefined}
          loading={false}
          onClick={() => onCardClick?.('offline')}
        />
        <MetricTile
          title="Net Absorption"
          value={netAbsorption >= 0 ? `+${netAbsorption}` : `${netAbsorption}`}
          subtitle={`${churn?.moveIns ?? 0} in / ${churn?.moveOuts ?? 0} out`}
          icon={ArrowRightLeft}
          color={netAbsorption > 0 ? 'text-green-600' : netAbsorption < 0 ? 'text-red-600' : undefined}
          loading={false}
          onClick={() => onCardClick?.('churn')}
        />
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">{utilLabel}</span>
            <Badge variant={utilPct >= 90 ? "default" : utilPct >= 70 ? "secondary" : "destructive"}>
              {utilPct.toFixed(1)}%
            </Badge>
          </div>
          <Progress value={utilPct} className="h-2" />
        </CardContent>
      </Card>
    </div>
  );
}
