/**
 * unit-mix-leases.tsx — Asset-Class-Aware Unit Mix / Storage Leases
 * 
 * REPLACES the rendering inside the "Storage Leases" TabsContent.
 * 
 * For Marina: Shows slip types with seasonal rates (existing behavior).
 * For Multifamily: Shows unit mix (Studio, 1BR, 2BR, etc.) with rent/SF columns.
 * For Hotel: Shows room types with ADR.
 * For Self-Storage: Shows unit sizes with monthly rent.
 * For Laundromat: Shows equipment with vend prices.
 * 
 * This can either REPLACE leases-combined.tsx entirely, or be imported
 * as a wrapper that conditionally renders the existing component vs
 * the new dynamic version based on asset class.
 * 
 * Place at: client/src/pages/modeling/projects/workspace/unit-mix-leases.tsx
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Save, Plus, Trash2, Calculator, Anchor, Home, Warehouse,
  Building2, type LucideIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ModelingProject } from '@shared/schema';
import { getModelConfig } from '@shared/asset-class-model-config';
import type { UnitMixTypeConfig } from '@shared/asset-class-model-config';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// ─── Revenue calculation helpers ─────────────────────────────────
const AVG_DAYS_PER_MONTH = 365.25 / 12; // 30.4375

/** Calculate monthly revenue for a unit row based on rate type */
function calcMonthlyRevenue(
  count: number,
  rate: number,
  occupancy: number,
  rateType: string,
): number {
  const occPct = occupancy / 100;
  switch (rateType) {
    case 'nightly':
      // Nightly rate × occupancy × avg days per month × count
      return count * rate * occPct * AVG_DAYS_PER_MONTH;
    case 'per_sf_annual':
      // Annual $/SF rate → monthly
      return count * rate / 12 * occPct;
    case 'monthly':
    default:
      // Monthly rate × occupancy × count
      return count * rate * occPct;
  }
}

// ─── Unit row state ──────────────────────────────────────────────
interface UnitRow {
  typeId: string;
  name: string;
  section: string;
  enabled: boolean;
  count: number;
  avgSF: number;
  monthlyRate: number;
  annualRate: number;
  occupancy: number;
  // Marina seasonal
  inSeasonRate?: number;
  offSeasonRate?: number;
}

interface UnitMixLeasesProps {
  project: ModelingProject;
}

export default function UnitMixLeases({ project }: UnitMixLeasesProps) {
  const config = useMemo(() => getModelConfig(project.assetClass), [project.assetClass]);
  const unitMixConfig = config.unitMix;
  const rateType: string = (unitMixConfig as any).rateType || 'monthly';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── State ───────────────────────────────────────────────────
  const [rows, setRows] = useState<UnitRow[]>([]);

  // Initialize from config + project data
  useEffect(() => {
    const projectUnits = (project as any)?.storageTypes || [];
    
    const initialRows: UnitRow[] = unitMixConfig.types.map(t => {
      // Try to find existing data for this type
      const existing = projectUnits.find((u: any) => u.id === t.id || u.typeId === t.id);
      return {
        typeId: t.id,
        name: t.name,
        section: t.section,
        enabled: existing ? (existing.isEnabled ?? existing.enabled ?? false) : false,
        count: existing?.count ?? existing?.totalSlips ?? 0,
        avgSF: existing?.avgSF ?? t.defaultFields?.avgSF ?? 0,
        monthlyRate: existing?.monthlyRate ? parseFloat(existing.monthlyRate) : 0,
        annualRate: existing?.annualRate ? parseFloat(existing.annualRate) : 0,
        occupancy: existing?.occupancy ?? existing?.occupancyPercent ? parseFloat(existing.occupancyPercent) : 95,
        inSeasonRate: existing?.inSeasonRate ? parseFloat(existing.inSeasonRate) : 0,
        offSeasonRate: existing?.offSeasonRate ? parseFloat(existing.offSeasonRate) : 0,
      };
    });
    setRows(initialRows);
  }, [project.id, unitMixConfig]);

  // ─── Computed Summaries ────────────────────────────────────
  const enabledRows = rows.filter(r => r.enabled);
  const totalUnits = enabledRows.reduce((sum, r) => sum + r.count, 0);
  const totalSF = enabledRows.reduce((sum, r) => sum + (r.count * r.avgSF), 0);
  const weightedAvgRate = totalUnits > 0
    ? enabledRows.reduce((sum, r) => sum + (r.count * r.monthlyRate), 0) / totalUnits
    : 0;
  const totalMonthlyRevenue = enabledRows.reduce((sum, r) => sum + calcMonthlyRevenue(r.count, r.monthlyRate, r.occupancy, rateType), 0);
  const totalAnnualRevenue = totalMonthlyRevenue * 12;

  // ─── Save ──────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/modeling/projects/${project.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', String(project.id)] });
      toast({ title: 'Saved', description: `${unitMixConfig.tabLabel} saved.` });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      storageTypes: rows.map(r => ({
        id: r.typeId,
        name: r.name,
        section: r.section,
        isEnabled: r.enabled,
        totalSlips: r.count,
        count: r.count,
        avgSF: r.avgSF,
        monthlyRate: String(r.monthlyRate),
        annualRate: String(r.annualRate),
        occupancyPercent: String(r.occupancy),
        inSeasonRate: String(r.inSeasonRate || 0),
        offSeasonRate: String(r.offSeasonRate || 0),
      })),
    });
  };

  // ─── Row Update Helper ─────────────────────────────────────
  const updateRow = (typeId: string, field: keyof UnitRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.typeId !== typeId) return r;
      const updated = { ...r, [field]: value };
      // Auto-calc annual from monthly
      if (field === 'monthlyRate') updated.annualRate = parseFloat(value) * 12;
      if (field === 'annualRate') updated.monthlyRate = parseFloat(value) / 12;
      return updated;
    }));
  };

  // ─── Sections ──────────────────────────────────────────────
  const sections = [...new Set(rows.map(r => r.section))];

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{unitMixConfig.tabLabel}</h2>
          <p className="text-sm text-muted-foreground">
            Configure {config.terms.unitPlural} and rates for this {config.terms.property}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{config.terms.totalUnitsLabel}</p>
          <p className="text-xl font-bold">{totalUnits.toLocaleString()}</p>
        </Card>
        {unitMixConfig.showSF && (
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Total SF</p>
            <p className="text-xl font-bold">{totalSF.toLocaleString()}</p>
          </Card>
        )}
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Wtd Avg {unitMixConfig.rateColumnLabel}</p>
          <p className="text-xl font-bold">${weightedAvgRate.toFixed(0)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Annual Revenue (Est)</p>
          <p className="text-xl font-bold">${totalAnnualRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </Card>
      </div>

      {/* Unit Rows by Section */}
      {sections.map(section => {
        const sectionRows = rows.filter(r => r.section === section);
        const sectionEnabled = sectionRows.filter(r => r.enabled);
        return (
          <Card key={section}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {section}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {sectionEnabled.length} / {sectionRows.length} active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* Column Headers */}
              <div className="grid gap-2 mb-2 text-xs font-medium text-muted-foreground"
                style={{ gridTemplateColumns: '2fr 40px 80px' + (unitMixConfig.showSF ? ' 80px' : '') + ' 100px 80px 100px' }}>
                <span>Type</span>
                <span className="text-center">On</span>
                <span className="text-right">{unitMixConfig.countColumnLabel}</span>
                {unitMixConfig.showSF && <span className="text-right">{unitMixConfig.sfColumnLabel || 'Avg SF'}</span>}
                <span className="text-right">{unitMixConfig.rateColumnLabel}</span>
                <span className="text-right">Occ %</span>
                <span className="text-right">Monthly Rev</span>
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {sectionRows.map(row => {
                  const monthlyRev = row.enabled ? calcMonthlyRevenue(row.count, row.monthlyRate, row.occupancy, rateType) : 0;
                  return (
                    <div
                      key={row.typeId}
                      className={cn(
                        "grid gap-2 items-center py-1.5 px-1 rounded transition-all",
                        row.enabled ? "bg-muted/20" : "opacity-50"
                      )}
                      style={{ gridTemplateColumns: '2fr 40px 80px' + (unitMixConfig.showSF ? ' 80px' : '') + ' 100px 80px 100px' }}
                    >
                      <span className="text-sm font-medium">{row.name}</span>
                      <div className="flex justify-center">
                        <Switch
                          checked={row.enabled}
                          onCheckedChange={(v) => updateRow(row.typeId, 'enabled', v)}
                          className="scale-75"
                        />
                      </div>
                      <Input
                        type="number" min="0" step="1"
                        value={row.count || ''}
                        onChange={(e) => updateRow(row.typeId, 'count', parseInt(e.target.value) || 0)}
                        disabled={!row.enabled}
                        className="h-8 text-right text-sm"
                      />
                      {unitMixConfig.showSF && (
                        <Input
                          type="number" min="0" step="1"
                          value={row.avgSF || ''}
                          onChange={(e) => updateRow(row.typeId, 'avgSF', parseInt(e.target.value) || 0)}
                          disabled={!row.enabled}
                          className="h-8 text-right text-sm"
                        />
                      )}
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number" min="0" step="1"
                          value={row.monthlyRate || ''}
                          onChange={(e) => updateRow(row.typeId, 'monthlyRate', parseFloat(e.target.value) || 0)}
                          disabled={!row.enabled}
                          className="h-8 text-right text-sm pl-5"
                        />
                      </div>
                      <div className="relative">
                        <Input
                          type="number" min="0" max="100" step="1"
                          value={row.occupancy || ''}
                          onChange={(e) => updateRow(row.typeId, 'occupancy', parseFloat(e.target.value) || 0)}
                          disabled={!row.enabled}
                          className="h-8 text-right text-sm pr-5"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                      <div className="text-right text-sm font-medium">
                        {row.enabled ? `$${monthlyRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Section Subtotal */}
              <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {sectionEnabled.reduce((s, r) => s + r.count, 0).toLocaleString()} {config.terms.unitPlural}
                </span>
                <span className="font-semibold">
                  ${sectionEnabled.reduce((s, r) => s + calcMonthlyRevenue(r.count, r.monthlyRate, r.occupancy, rateType), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Marina-specific: Seasonal rate columns (extend table) */}
      {config.hasSeasonal && config.seasonConfig.type === 'marina' && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Seasonal Rate Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xs text-muted-foreground mb-3">
              Set {config.seasonConfig.seasonLabel?.toLowerCase()} and {config.seasonConfig.offSeasonLabel?.toLowerCase()} rates for applicable {config.terms.unitPlural}.
            </p>
            <div className="space-y-2">
              {enabledRows.filter(r => unitMixConfig.types.find(t => t.id === r.typeId)?.hasSeasons).map(row => (
                <div key={row.typeId} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-center">
                  <span className="text-sm">{row.name}</span>
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">{config.seasonConfig.seasonLabel} Rate</Label>
                    <Input
                      type="number" min="0" step="1"
                      value={row.inSeasonRate || row.monthlyRate || ''}
                      onChange={(e) => updateRow(row.typeId, 'inSeasonRate', parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">{config.seasonConfig.offSeasonLabel} Rate</Label>
                    <Input
                      type="number" min="0" step="1"
                      value={row.offSeasonRate || ''}
                      onChange={(e) => updateRow(row.typeId, 'offSeasonRate', parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grand Total */}
      <Card className="bg-muted/30 border-2">
        <CardContent className="py-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total {config.terms.totalUnitsLabel}</p>
              <p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Estimated Annual Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                ${totalAnnualRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
