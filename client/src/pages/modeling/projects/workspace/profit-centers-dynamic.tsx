/**
 * profit-centers-dynamic.tsx — Asset-Class-Aware Profit Centers / Revenue Departments
 * 
 * REPLACES the rendering inside the "Profit Centers" TabsContent.
 * 
 * For Marina: Fuel, Ship's Store, Service, Boat Rentals, etc.
 * For Hotel: Rooms, F&B, Meetings & Events, Spa, Parking, etc.
 * For Multifamily: Parking, Laundry & Vending, Pet Fees, etc. (labeled "Other Income")
 * For Self-Storage: Tenant Insurance, Merchandise, Truck Rental, etc.
 * 
 * Place at: client/src/pages/modeling/projects/workspace/profit-centers-dynamic.tsx
 * 
 * Then in workspace.tsx, change the profit TabsContent to render this:
 *   <ProfitCentersDynamic project={project} />
 */

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Save, Plus, Trash2, DollarSign, Store, Wrench, Users,
  Anchor, Home, Building2, type LucideIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ModelingProject } from '@shared/schema';
import { getModelConfig } from '@shared/asset-class-model-config';
import type { DepartmentConfig } from '@shared/asset-class-model-config';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  'store': Store, 'fuel': Store, 'wrench': Wrench, 'users': Users,
  'anchor': Anchor, 'home': Home, 'building': Building2,
  'car': Home, 'zap': DollarSign, 'dollar-sign': DollarSign,
  'sailboat': Anchor, 'utensils': Store, 'heart': Home,
  'layers': Building2, 'shield': DollarSign, 'alert-circle': DollarSign,
  'file-text': DollarSign, 'presentation': Building2, 'container': Store,
  'crown': Building2,
};

function getIcon(name: string): LucideIcon { return ICON_MAP[name] || Store; }

// ─── Revenue line item state ─────────────────────────────────
interface RevenueLineItem {
  id: string;
  name: string;
  monthlyAmount: number;
  annualAmount: number;
  isCustom: boolean;
}

interface DepartmentState {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  enabled: boolean;
  revenueLines: RevenueLineItem[];
  cogsLines: RevenueLineItem[];
  expenseLines: RevenueLineItem[];
}

interface ProfitCentersDynamicProps {
  project: ModelingProject;
}

export default function ProfitCentersDynamic({ project }: ProfitCentersDynamicProps) {
  const config = useMemo(() => getModelConfig(project.assetClass), [project.assetClass]);
  const pcConfig = config.profitCenters;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [departments, setDepartments] = useState<DepartmentState[]>([]);

  // ─── Initialize from config + project ──────────────────────
  useEffect(() => {
    const projectPCs = (project as any)?.profitCentersData || {};
    
    const initial: DepartmentState[] = pcConfig.departments.map(dept => {
      const existing = projectPCs[dept.id];
      
      const makeLines = (defaults: string[], existingLines?: any[]): RevenueLineItem[] => {
        if (existingLines?.length) {
          return existingLines.map((l: any, i: number) => ({
            id: l.id || `${dept.id}_line_${i}`,
            name: l.name,
            monthlyAmount: parseFloat(l.monthlyAmount) || 0,
            annualAmount: parseFloat(l.annualAmount) || 0,
            isCustom: l.isCustom || false,
          }));
        }
        return defaults.map((name, i) => ({
          id: `${dept.id}_line_${i}`,
          name,
          monthlyAmount: 0,
          annualAmount: 0,
          isCustom: false,
        }));
      };

      return {
        id: dept.id,
        name: dept.name,
        icon: dept.icon,
        category: dept.category,
        description: dept.description,
        enabled: existing?.enabled ?? false,
        revenueLines: makeLines(dept.revenueLines, existing?.revenueLines),
        cogsLines: makeLines(dept.cogsLines || [], existing?.cogsLines),
        expenseLines: makeLines(dept.expenseLines || [], existing?.expenseLines),
      };
    });
    setDepartments(initial);
  }, [project.id, pcConfig]);

  // ─── Computed Totals ─────────────────────────────────────────
  const enabledDepts = departments.filter(d => d.enabled);
  const totalMonthlyRevenue = enabledDepts.reduce((sum, d) => 
    sum + d.revenueLines.reduce((s, l) => s + l.monthlyAmount, 0), 0);
  const totalMonthlyCOGS = enabledDepts.reduce((sum, d) => 
    sum + d.cogsLines.reduce((s, l) => s + l.monthlyAmount, 0), 0);
  const totalMonthlyExpenses = enabledDepts.reduce((sum, d) => 
    sum + d.expenseLines.reduce((s, l) => s + l.monthlyAmount, 0), 0);
  const netContribution = totalMonthlyRevenue - totalMonthlyCOGS - totalMonthlyExpenses;

  // ─── Save ──────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('PATCH', `/api/modeling/projects/${project.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', String(project.id)] });
      toast({ title: 'Saved', description: `${pcConfig.tabLabel} saved.` });
    },
  });

  const handleSave = () => {
    const data: Record<string, any> = {};
    departments.forEach(d => {
      data[d.id] = {
        enabled: d.enabled,
        revenueLines: d.revenueLines,
        cogsLines: d.cogsLines,
        expenseLines: d.expenseLines,
      };
    });
    saveMutation.mutate({
      profitCentersData: data,
      enabledProfitCenters: departments.filter(d => d.enabled).map(d => d.id),
    });
  };

  // ─── Helpers ─────────────────────────────────────────────────
  const toggleDept = (id: string) => {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  };

  const updateLine = (deptId: string, lineType: 'revenueLines' | 'cogsLines' | 'expenseLines', lineId: string, field: 'monthlyAmount' | 'annualAmount', value: number) => {
    setDepartments(prev => prev.map(d => {
      if (d.id !== deptId) return d;
      const lines = d[lineType].map(l => {
        if (l.id !== lineId) return l;
        const updated = { ...l, [field]: value };
        if (field === 'monthlyAmount') updated.annualAmount = value * 12;
        if (field === 'annualAmount') updated.monthlyAmount = value / 12;
        return updated;
      });
      return { ...d, [lineType]: lines };
    }));
  };

  const addCustomLine = (deptId: string, lineType: 'revenueLines' | 'cogsLines' | 'expenseLines') => {
    setDepartments(prev => prev.map(d => {
      if (d.id !== deptId) return d;
      return {
        ...d,
        [lineType]: [...d[lineType], {
          id: `${deptId}_custom_${Date.now()}`,
          name: 'New Line Item',
          monthlyAmount: 0,
          annualAmount: 0,
          isCustom: true,
        }],
      };
    }));
  };

  const removeLine = (deptId: string, lineType: 'revenueLines' | 'cogsLines' | 'expenseLines', lineId: string) => {
    setDepartments(prev => prev.map(d => {
      if (d.id !== deptId) return d;
      return { ...d, [lineType]: d[lineType].filter(l => l.id !== lineId) };
    }));
  };

  const renderLineItems = (
    deptId: string,
    lineType: 'revenueLines' | 'cogsLines' | 'expenseLines',
    lines: RevenueLineItem[],
    label: string,
    color: string,
  ) => {
    if (lines.length === 0) return null;
    const total = lines.reduce((s, l) => s + l.monthlyAmount, 0);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addCustomLine(deptId, lineType)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        {lines.map(line => (
          <div key={line.id} className="grid grid-cols-[1fr_120px_120px_24px] gap-2 items-center">
            {line.isCustom ? (
              <Input
                value={line.name}
                onChange={(e) => {
                  setDepartments(prev => prev.map(d => {
                    if (d.id !== deptId) return d;
                    return { ...d, [lineType]: d[lineType].map(l => l.id === line.id ? { ...l, name: e.target.value } : l) };
                  }));
                }}
                className="h-7 text-sm"
              />
            ) : (
              <span className="text-sm">{line.name}</span>
            )}
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number" min="0" step="1"
                value={line.monthlyAmount || ''}
                onChange={(e) => updateLine(deptId, lineType, line.id, 'monthlyAmount', parseFloat(e.target.value) || 0)}
                className="h-7 text-right text-sm pl-5"
                placeholder="Mo"
              />
            </div>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number" min="0" step="1"
                value={line.annualAmount || ''}
                onChange={(e) => updateLine(deptId, lineType, line.id, 'annualAmount', parseFloat(e.target.value) || 0)}
                className="h-7 text-right text-sm pl-5"
                placeholder="Yr"
              />
            </div>
            {line.isCustom ? (
              <button onClick={() => removeLine(deptId, lineType, line.id)} className="text-destructive hover:text-destructive/80">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : <div />}
          </div>
        ))}
        <div className={cn("flex justify-between text-xs font-medium pt-1 border-t", color)}>
          <span>Subtotal</span>
          <span>${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo</span>
        </div>
      </div>
    );
  };

  // Group departments by category
  const categories = ['core', 'ancillary', 'specialty'];
  const catLabels: Record<string, string> = { core: 'Core Departments', ancillary: 'Ancillary Revenue', specialty: 'Specialty' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{pcConfig.tabLabel}</h2>
          <p className="text-sm text-muted-foreground">
            Configure revenue departments for this {config.terms.property}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Active Departments</p>
          <p className="text-xl font-bold">{enabledDepts.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Monthly Revenue</p>
          <p className="text-xl font-bold text-green-600">${totalMonthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Monthly COGS + Expense</p>
          <p className="text-xl font-bold text-red-500">${(totalMonthlyCOGS + totalMonthlyExpenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Net Contribution / Mo</p>
          <p className={cn("text-xl font-bold", netContribution >= 0 ? "text-green-600" : "text-red-500")}>
            ${netContribution.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </Card>
      </div>

      {/* Department Cards */}
      <Accordion type="multiple" defaultValue={enabledDepts.map(d => d.id)} className="space-y-3">
        {categories.map(cat => {
          const catDepts = departments.filter(d => d.category === cat);
          if (catDepts.length === 0) return null;
          return (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-4">
                {catLabels[cat] || cat}
              </p>
              {catDepts.map(dept => {
                const DeptIcon = getIcon(dept.icon);
                const deptRevenue = dept.revenueLines.reduce((s, l) => s + l.monthlyAmount, 0);
                const deptCOGS = dept.cogsLines.reduce((s, l) => s + l.monthlyAmount, 0);
                const deptExpenses = dept.expenseLines.reduce((s, l) => s + l.monthlyAmount, 0);
                const deptNet = deptRevenue - deptCOGS - deptExpenses;
                return (
                  <AccordionItem key={dept.id} value={dept.id} className="border rounded-lg px-4 mb-2">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 w-full">
                        <Switch
                          checked={dept.enabled}
                          onCheckedChange={() => toggleDept(dept.id)}
                          className="scale-75"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <DeptIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="text-left flex-1">
                          <span className="text-sm font-medium">{dept.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{dept.description}</span>
                        </div>
                        {dept.enabled && deptRevenue > 0 && (
                          <Badge variant="secondary" className="text-xs mr-2">
                            ${deptNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo net
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-4">
                      {!dept.enabled ? (
                        <p className="text-xs text-muted-foreground italic">
                          Enable this department to configure revenue and expenses.
                        </p>
                      ) : (
                        <>
                          {/* Column headers */}
                          <div className="grid grid-cols-[1fr_120px_120px_24px] gap-2 text-xs font-medium text-muted-foreground">
                            <span>Line Item</span>
                            <span className="text-right">Monthly</span>
                            <span className="text-right">Annual</span>
                            <span />
                          </div>
                          {renderLineItems(dept.id, 'revenueLines', dept.revenueLines, 'Revenue', 'text-green-600')}
                          {dept.cogsLines.length > 0 && renderLineItems(dept.id, 'cogsLines', dept.cogsLines, 'Cost of Goods Sold', 'text-red-500')}
                          {dept.expenseLines.length > 0 && renderLineItems(dept.id, 'expenseLines', dept.expenseLines, 'Direct Expenses', 'text-orange-500')}
                          {/* Dept Net */}
                          <div className="flex justify-between font-semibold text-sm pt-2 border-t-2">
                            <span>Net Contribution</span>
                            <span className={deptNet >= 0 ? "text-green-600" : "text-red-500"}>
                              ${deptNet.toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo
                              &nbsp;(${(deptNet * 12).toLocaleString(undefined, { maximumFractionDigits: 0 })} / yr)
                            </span>
                          </div>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </div>
          );
        })}
      </Accordion>
    </div>
  );
}
