import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  DollarSign,
  Lock,
  Users,
  Wrench,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { useState } from 'react';

interface UnderutilizationInsightsProps {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
}

interface DiagnosisSignal {
  signalType: 'priceHigh' | 'constraint' | 'friction' | 'downtime';
  label: string;
  description: string;
  confidence: number;
  evidence: Record<string, any>;
}

interface SegmentDiagnosis {
  unitType: string;
  bandKey: string | null;
  bandLabel: string;
  unitUtilPct: number;
  weightedUtilPct: number;
  totalUnits: number;
  occupiedUnits: number;
  offlineUnits: number;
  signals: DiagnosisSignal[];
  primarySignal: string | null;
  summaryText: string;
}

const SIGNAL_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  priceHigh: { icon: DollarSign, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  constraint: { icon: Lock, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
  friction: { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  downtime: { icon: Wrench, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30' },
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  let variant: 'default' | 'secondary' | 'outline' = 'outline';
  let className = 'text-xs';

  if (pct >= 70) {
    variant = 'default';
    className += ' bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  } else if (pct >= 40) {
    className += ' text-amber-600 border-amber-300';
  } else {
    className += ' text-muted-foreground';
  }

  return <Badge variant={variant} className={className}>{pct}%</Badge>;
}

function SignalCard({ signal }: { signal: DiagnosisSignal }) {
  const config = SIGNAL_CONFIG[signal.signalType] || SIGNAL_CONFIG.friction;
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-md ${config.bgColor}`}>
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{signal.label}</span>
          <ConfidenceBadge confidence={signal.confidence} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{signal.description}</p>
      </div>
    </div>
  );
}

function DiagnosisCard({ diagnosis }: { diagnosis: SegmentDiagnosis }) {
  const [expanded, setExpanded] = useState(false);
  const primaryConfig = diagnosis.primarySignal
    ? SIGNAL_CONFIG[diagnosis.primarySignal] || SIGNAL_CONFIG.friction
    : SIGNAL_CONFIG.friction;
  const PrimaryIcon = primaryConfig.icon;

  const utilColor = diagnosis.unitUtilPct < 30
    ? 'text-red-600'
    : diagnosis.unitUtilPct < 50
    ? 'text-orange-500'
    : 'text-amber-500';

  return (
    <div className="border rounded-lg p-4 transition-colors hover:bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-0.5 p-1.5 rounded ${primaryConfig.bgColor}`}>
            <PrimaryIcon className={`h-4 w-4 ${primaryConfig.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{diagnosis.bandLabel}</span>
              <span className={`text-sm font-semibold ${utilColor}`}>
                {diagnosis.unitUtilPct}% util
              </span>
              <Badge variant="outline" className="text-xs">
                {diagnosis.occupiedUnits}/{diagnosis.totalUnits} occupied
              </Badge>
              {diagnosis.offlineUnits > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {diagnosis.offlineUnits} offline
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{diagnosis.summaryText}</p>
          </div>
        </div>
        <button
          className="text-muted-foreground hover:text-foreground p-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Diagnostic Signals (ranked by confidence)</p>
          {diagnosis.signals.map((signal, idx) => (
            <SignalCard key={idx} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function UnderutilizationInsights({ propertyId, periodStart, periodEnd }: UnderutilizationInsightsProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/utilization/diagnosis', propertyId, periodStart, periodEnd],
    queryFn: async () => {
      const res = await fetch(`/api/utilization/diagnosis?propertyId=${propertyId}&periodStart=${periodStart}&periodEnd=${periodEnd}`);
      if (!res.ok) throw new Error('Failed to fetch diagnosis');
      return res.json();
    },
    enabled: !!propertyId && !!periodStart && !!periodEnd,
  });

  const diagnoses: SegmentDiagnosis[] = data?.diagnoses ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || diagnoses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Underutilization Insights
          </CardTitle>
          <CardDescription>Root-cause analysis for underperforming segments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {isError ? 'Unable to load diagnosis data.' : 'All segments are performing at or above the 65% utilization threshold.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Underutilization Insights
              <Badge variant="destructive" className="text-xs ml-1">{diagnoses.length}</Badge>
            </CardTitle>
            <CardDescription>Root-cause analysis for underperforming segments (&lt;65% utilization)</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {diagnoses.map((d, idx) => (
            <DiagnosisCard key={`${d.unitType}-${d.bandKey}-${idx}`} diagnosis={d} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
