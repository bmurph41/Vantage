#!/bin/bash
# =============================================================
#  PATCH 02 — New component: PropertyFMPanel
#  Surfaces live Financial Model data on the Property CRM record.
#  No schema changes needed — reads existing modelingProjects table.
# =============================================================

set -e
OUT="client/src/components/crm/PropertyFMPanel.tsx"

echo "→ Writing PropertyFMPanel component..."
mkdir -p "$(dirname "$OUT")"

cat > "$OUT" << 'TSX'
/**
 * PropertyFMPanel
 *
 * Surfaces linked Financial Model (modeling project) data on a CRM
 * property record. Queries the modeling projects API for projects
 * associated with this property, then renders key outputs:
 *   • Going-in cap rate
 *   • Projected IRR + equity multiple
 *   • NOI estimate
 *   • Model status badge
 *   • Direct "Open Model" navigation link
 *
 * Usage:
 *   <PropertyFMPanel propertyId={property.id} dealId={property.deals?.[0]?.id} />
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp, DollarSign, BarChart3, ExternalLink,
  AlertCircle, ChevronRight, Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyFMPanelProps {
  propertyId: string;
  /** If you already know the deal id, pass it to narrow the query */
  dealId?: string | null;
  className?: string;
}

interface FMSummary {
  id: string;
  projectId: string;
  projectName: string;
  dealStage?: string;
  goingInCapRate?: number | null;
  projectedIrr?: number | null;
  equityMultiple?: number | null;
  noiEstimate?: number | null;
  purchasePrice?: number | null;
  status: 'draft' | 'active' | 'approved' | 'archived';
  updatedAt: string;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function fmtMult(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${v.toFixed(2)}x`;
}

function fmtCurrency(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

const statusConfig: Record<FMSummary['status'], { label: string; cls: string }> = {
  draft:    { label: 'Draft',    cls: 'bg-gray-100 text-gray-600' },
  active:   { label: 'Active',   cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  archived: { label: 'Archived', cls: 'bg-amber-100 text-amber-700' },
};

export function PropertyFMPanel({ propertyId, dealId, className }: PropertyFMPanelProps) {
  // Primary: fetch from the CRM property summary (already includes linked deals)
  const { data: propertySummary, isLoading: loadingProperty } = useQuery({
    queryKey: ['crm-property-summary', propertyId],
    queryFn: () => apiRequest('GET', `/api/crm/properties/${propertyId}/summary`).then(r => r.json()),
    enabled: !!propertyId,
    staleTime: 60_000,
  });

  // Extract deal ids from summary
  const deals: Array<{ id: string; name: string; stage: string }> = propertySummary?.deals ?? [];
  const targetDealId = dealId || deals[0]?.id;

  // Fetch modeling projects linked to this deal/property
  const { data: modelingData, isLoading: loadingModels } = useQuery({
    queryKey: ['property-modeling-projects', propertyId, targetDealId],
    queryFn: async () => {
      // Try deal-scoped query first
      if (targetDealId) {
        try {
          const res = await apiRequest('GET', `/api/modeling/projects?dealId=${targetDealId}&limit=5`);
          const data = await res.json();
          return Array.isArray(data) ? data : data?.projects ?? [];
        } catch {
          // fall through
        }
      }
      // Fallback: query by propertyId if the endpoint supports it
      try {
        const res = await apiRequest('GET', `/api/modeling/projects?propertyId=${propertyId}&limit=5`);
        const data = await res.json();
        return Array.isArray(data) ? data : data?.projects ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!propertyId,
    staleTime: 60_000,
  });

  const isLoading = loadingProperty || loadingModels;
  const models: FMSummary[] = (modelingData ?? []).map((m: any) => ({
    id: m.id,
    projectId: m.id,
    projectName: m.name || m.projectName || 'Unnamed Model',
    dealStage: deals.find(d => d.id === m.dealId)?.stage,
    goingInCapRate: m.goingInCapRate ?? m.capRate ?? null,
    projectedIrr: m.projectedIrr ?? m.irr ?? null,
    equityMultiple: m.equityMultiple ?? m.em ?? null,
    noiEstimate: m.noiEstimate ?? m.noi ?? null,
    purchasePrice: m.purchasePrice ?? null,
    status: m.status ?? 'draft',
    updatedAt: m.updatedAt ?? m.createdAt,
  }));

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Financial Models</span>
          {models.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{models.length}</Badge>
          )}
        </div>
        {targetDealId && (
          <Link href={`/modeling/projects?dealId=${targetDealId}`}>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-blue-600 hover:text-blue-700 px-2">
              All models <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>

      {models.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted p-4 text-center">
          <BarChart3 className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No financial models linked</p>
          {targetDealId && (
            <Link href={`/modeling/projects/new?dealId=${targetDealId}`}>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
                Build a Model
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((model) => {
            const sc = statusConfig[model.status] ?? statusConfig.draft;
            return (
              <Link key={model.id} href={`/modeling/projects/${model.projectId}/workspace`}>
                <div className="rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-pointer p-3 group">
                  {/* Model name + status */}
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{model.projectName}</p>
                      {model.dealStage && (
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {model.dealStage.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', sc.cls)}>
                        {sc.label}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* KPI grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <Metric icon={DollarSign} label="Going-In Cap" value={fmtPct(model.goingInCapRate)} highlight />
                    <Metric icon={TrendingUp} label="Proj. IRR" value={fmtPct(model.projectedIrr)} highlight />
                    <Metric icon={BarChart3} label="Equity Multiple" value={fmtMult(model.equityMultiple)} />
                    <Metric icon={DollarSign} label="NOI" value={fmtCurrency(model.noiEstimate)} />
                  </div>

                  {model.purchasePrice && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Purchase Price</span>
                      <span className="text-xs font-medium">{fmtCurrency(model.purchasePrice)}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
        <p className={cn(
          'text-xs font-medium leading-tight',
          highlight && value !== '—' ? 'text-emerald-700 dark:text-emerald-400' : '',
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default PropertyFMPanel;
TSX

echo "  ✓ Written: $OUT"

echo ""
echo "✅ Patch 02 complete."
echo "Next: run crm_patch_03_property_comps.sh"
