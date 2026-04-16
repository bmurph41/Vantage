import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DollarSign, Calendar, User, Building, Target, Clock, Edit,
  Anchor, MapPin, FileText, FolderOpen, FileSpreadsheet, CheckCircle,
  ListChecks, TrendingUp, Files, Activity, ExternalLink, Calculator,
  ChevronRight, Phone, Mail, MessageSquare, BarChart3, AlertCircle,
  Circle, CheckCircle2, ArrowUpRight, Newspaper, Scale, Plus, Hash,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CrmRecordPage, RecordFieldGroup, RecordField, AssociationCard, AssociationRow,
} from "@/components/crm/CrmRecordPage";
import ConvertToProjectModal from "@/components/modals/convert-to-project-modal";
import DocumentGeneratorModal from "@/components/modals/document-generator-modal";
import { ComposeEmailModal } from "@/components/email/compose-email-modal";
import CompSetSelector from "@/components/comp-set-selector";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { RedFlagsPanel } from "@/components/crm/panels/red-flags-panel";
import DealTimelineTab from "@/components/deals/deal-timeline-tab";
import { PhaseGatesPanel } from "@/components/crm/panels/phase-gates-panel";
import { DealPlaybookPanel } from "@/components/crm/panels/deal-playbook-panel";
import { CommentThreadsPanel } from "@/components/crm/panels/comment-threads-panel";
import { PipelineForecastingPanel } from "@/components/crm/panels/pipeline-forecasting-panel";
import { SlaTrackingPanel } from "@/components/crm/panels/sla-tracking-panel";

// ── Helpers ───────────────────────────────────────────────
function fmtCurrency(v: string | number | null | undefined): string {
  if (!v) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return format(new Date(d), 'MM/dd/yyyy'); } catch { return '—'; }
}
function fmtLabel(str: string): string {
  return str.split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const stageColors: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-700', qualified: 'bg-blue-100 text-blue-700',
  proposal: 'bg-indigo-100 text-indigo-700', negotiation: 'bg-amber-100 text-amber-700',
  closed_won: 'bg-emerald-100 text-emerald-700', 'closed-won': 'bg-emerald-100 text-emerald-700',
  closed_lost: 'bg-red-100 text-red-700', 'closed-lost': 'bg-red-100 text-red-700',
  under_contract: 'bg-purple-100 text-purple-700',
};
const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
};
const activityTypeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  call: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50' },
  email: { icon: Mail, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  meeting: { icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  note: { icon: MessageSquare, color: 'text-gray-600', bg: 'bg-gray-50' },
  follow_up: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  task: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  site_visit: { icon: MapPin, color: 'text-rose-600', bg: 'bg-rose-50' },
};

function EmptyState({ icon: Icon, title, subtitle, action }: { icon: any; title: string; subtitle?: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4"><Icon className="h-8 w-8 text-gray-400" /></div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1 max-w-xs">{subtitle}</p>}
      {action && (
        <a href={action.href} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
          {action.label} →
        </a>
      )}
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────
function DealOverviewTab({ deal, workspace }: { deal: any; workspace: any }) {
  const [, setLocation] = useLocation();
  const dealValue = Number(deal.amount || deal.value) || 0;
  const commission = deal.commissionAmount
    ? parseFloat(deal.commissionAmount)
    : deal.commissionRate
      ? dealValue * (parseFloat(deal.commissionRate) / 100)
      : dealValue * 0.03;

  return (
    <div className="space-y-4">
      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4">
          <p className="text-xs text-blue-500 mb-1">Deal Value</p>
          <p className="text-2xl font-bold text-blue-700">{fmtCurrency(dealValue)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
          <p className="text-xs text-emerald-500 mb-1">Commission</p>
          <p className="text-2xl font-bold text-emerald-700">{fmtCurrency(commission)}</p>
          {deal.commissionRate && <p className="text-[10px] text-emerald-400 mt-0.5">{parseFloat(deal.commissionRate).toFixed(1)}% rate</p>}
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4">
          <p className="text-xs text-purple-500 mb-1">Probability</p>
          <p className="text-2xl font-bold text-purple-700">{deal.probability ?? 0}%</p>
          <Progress value={deal.probability ?? 0} className="h-1 mt-2" />
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4">
          <p className="text-xs text-amber-500 mb-1">Days in Stage</p>
          <p className="text-2xl font-bold text-amber-700">{deal.daysInCurrentStage ?? 0}</p>
        </div>
      </div>

      {/* Key dates */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Key Dates</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {deal.expectedCloseDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Expected Close</span>
              <span className="font-medium">{fmtDate(deal.expectedCloseDate)}</span>
            </div>
          )}
          {deal.psaSignedDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">PSA Signed</span>
              <span className="font-medium">{fmtDate(deal.psaSignedDate)}</span>
            </div>
          )}
          {deal.ddExpirationDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">DD Expiration</span>
              <span className={cn("font-medium", new Date(deal.ddExpirationDate) < new Date() ? 'text-red-600' : '')}>
                {fmtDate(deal.ddExpirationDate)}
              </span>
            </div>
          )}
          {deal.closingDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Closing Date</span>
              <span className="font-medium">{fmtDate(deal.closingDate)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm pt-1 border-t">
            <span className="text-gray-400">Created</span>
            <span className="text-gray-500">{fmtDate(deal.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {deal.description && (
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{deal.description}</p>
        </CardContent></Card>
      )}

      {/* Workspace links */}
      {(workspace?.ddProject || workspace?.modelingProject || workspace?.vdrFolder) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Linked Workspaces</p>
          {workspace?.ddProject && (
            <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md"
              onClick={() => (window.location.href = `/dd/projects/${workspace.ddProject.id}`)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Due Diligence</p>
                      <p className="text-xs text-gray-500">{workspace.ddProject.name}</p>
                    </div>
                  </div>
                  {workspace?.ddTaskSummary && (
                    <div className="text-right">
                      <p className="text-xs font-medium">{workspace.ddTaskSummary.completed}/{workspace.ddTaskSummary.total} tasks</p>
                      <Progress value={workspace.ddTaskSummary.percentComplete} className="h-1 w-20 mt-1" />
                    </div>
                  )}
                  <ExternalLink className="h-4 w-4 text-gray-400 ml-2" />
                </div>
              </CardContent>
            </Card>
          )}
          {workspace?.modelingProject && (
            <Card className="border-l-4 border-l-emerald-500 cursor-pointer hover:shadow-md"
              onClick={() => (window.location.href = `/modeling/projects/${workspace.modelingProject.id}/workspace`)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium">Financial Model</p>
                      <p className="text-xs text-gray-500">{workspace.modelingProject.name}</p>
                    </div>
                  </div>
                  {workspace?.latestValuation?.totalValue && (
                    <span className="text-sm font-bold text-emerald-600">{fmtCurrency(workspace.latestValuation.totalValue)}</span>
                  )}
                  <ExternalLink className="h-4 w-4 text-gray-400 ml-2" />
                </div>
              </CardContent>
            </Card>
          )}
          {workspace?.vdrFolder && (
            <Card className="border-l-4 border-l-purple-500 cursor-pointer hover:shadow-md"
              onClick={() => (window.location.href = `/vdr/folders/${workspace.vdrFolder.id}`)}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Files className="h-4 w-4 text-purple-500" />
                  <p className="text-sm font-medium">Data Room: {workspace.vdrFolder.name}</p>
                  <ExternalLink className="h-4 w-4 text-gray-400 ml-auto" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Property Details */}
      {deal.propertyDetails && Object.keys(deal.propertyDetails).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Anchor className="h-4 w-4" />Property Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {Object.entries(deal.propertyDetails as any)
                .filter(([, v]) => v != null && v !== '')
                .slice(0, 16)
                .map(([k, v]: any) => (
                  <div key={k} className="flex justify-between border-b border-dashed pb-1">
                    <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-medium text-gray-800 text-right max-w-[50%] truncate">{String(v)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Activities ───────────────────────────────────────────────────
function DealActivitiesTab({ dealId }: { dealId: string }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['deal-activities', dealId, filter],
    queryFn: async () => {
      const params = new URLSearchParams({ entityType: 'deal', entityId: dealId, limit: '50' });
      if (filter !== 'all') params.set('status', filter);
      const res = await apiRequest('GET', `/api/crm/activities?${params}`);
      const arr = await res.json();
      return Array.isArray(arr) ? arr : arr.activities || [];
    },
  });
  const activities = data || [];
  const typeCounts = activities.reduce((acc: any, a: any) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
  const typeChartData = Object.entries(typeCounts).map(([name, value]) => ({ name: fmtLabel(name), value }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'open', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors',
                filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{activities.length} total</span>
      </div>
      {typeChartData.length > 1 && filter === 'all' && (
        <Card><CardContent className="px-2 py-3">
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={typeChartData} barSize={18}><XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip /><Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      )}
      {isLoading && <div className="space-y-2">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-3"><Skeleton className="h-10 w-full" /></CardContent></Card>)}</div>}
      {!isLoading && !activities.length && <EmptyState icon={Activity} title="No activities yet" subtitle="Log a call, email, or meeting to track deal progress" />}
      {activities.map((act: any) => {
        const cfg = activityTypeConfig[act.type] || activityTypeConfig.note;
        const Icon = cfg.icon;
        const isDone = act.status === 'completed';
        const isOverdue = !isDone && act.scheduledAt && new Date(act.scheduledAt) < new Date();
        return (
          <Card key={act.id} className={cn(isDone && 'opacity-60')}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className={cn('rounded-lg p-2 shrink-0', cfg.bg)}><Icon className={cn('h-3.5 w-3.5', cfg.color)} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{act.subject}</p>
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : isOverdue ? <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                    <span className="capitalize">{act.type?.replace(/_/g, ' ')}</span>
                    {act.scheduledAt && <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{fmtDate(act.scheduledAt)}</span>}
                    {act.completedAt && <span className="text-emerald-500">Done {fmtDate(act.completedAt)}</span>}
                  </div>
                  {act.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{act.notes}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Tab: Financial Model ──────────────────────────────────────────────
function DealModelsTab({ dealId }: { dealId: string }) {
  const [, setLocation] = useLocation();
  const { data: allProjects = [], isLoading } = useQuery<any[]>({
    queryKey: ['modeling-projects-deal', dealId],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/modeling/projects');
      const all = await res.json();
      return (Array.isArray(all) ? all : []).filter((p: any) => p.dealId === dealId);
    },
  });

  if (isLoading) return <div className="space-y-3">{[...Array(2)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>;
  if (!allProjects.length) return (
    <EmptyState icon={BarChart3} title="No financial model yet"
      subtitle="Convert this deal to a DD project to create a linked financial model" />
  );

  return (
    <div className="space-y-4">
      {allProjects.map((proj: any) => {
        const statusCls = proj.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';
        return (
          <Card key={proj.id} className="hover:shadow-md cursor-pointer" onClick={() => setLocation(`/modeling/projects/${proj.id}/workspace`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div><p className="text-sm font-semibold">{proj.name}</p><Badge className={`text-[10px] mt-0.5 ${statusCls}`}>{proj.status || 'draft'}</Badge></div>
                <ArrowUpRight className="h-4 w-4 text-gray-400" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {proj.purchasePrice != null && <div className="rounded-lg bg-gray-50 p-2 text-center"><p className="text-[10px] text-gray-400">Price</p><p className="text-xs font-bold text-gray-700">{fmtCurrency(proj.purchasePrice)}</p></div>}
                {proj.goingInCapRate != null && <div className="rounded-lg bg-blue-50 p-2 text-center"><p className="text-[10px] text-blue-400">Cap Rate</p><p className="text-xs font-bold text-blue-700">{(proj.goingInCapRate * 100).toFixed(2)}%</p></div>}
                {proj.projectedIrr != null && <div className="rounded-lg bg-emerald-50 p-2 text-center"><p className="text-[10px] text-emerald-400">IRR</p><p className="text-xs font-bold text-emerald-700">{(proj.projectedIrr * 100).toFixed(1)}%</p></div>}
                {proj.equityMultiple != null && <div className="rounded-lg bg-purple-50 p-2 text-center"><p className="text-[10px] text-purple-400">EM</p><p className="text-xs font-bold text-purple-700">{proj.equityMultiple.toFixed(2)}x</p></div>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Tab: Sales Comps ──────────────────────────────────────────────────
function DealCompsTab({ state, city }: { state?: string | null; city?: string | null }) {
  const { data, isLoading } = useQuery<{ comps: any[] }>({
    queryKey: ['sales-comps-deal', state],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '20', includeGlobal: 'true' });
      if (state) params.set('state', state);
      const res = await apiRequest('GET', `/api/sales-comps?${params}`);
      return res.json();
    },
  });
  const comps = data?.comps || [];
  const prices = comps.filter(c => c.salePrice).map(c => parseFloat(c.salePrice));
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const capRates = comps.filter(c => c.capRate).map(c => parseFloat(c.capRate));
  const avgCapRate = capRates.length ? capRates.reduce((a, b) => a + b, 0) / capRates.length : 0;

  const priceByYear = comps.filter(c => c.saleYear && c.salePrice)
    .reduce((acc: any, c: any) => { const yr = c.saleYear; if (!acc[yr]) acc[yr] = []; acc[yr].push(parseFloat(c.salePrice)); return acc; }, {});
  const chartData = Object.entries(priceByYear)
    .map(([year, prices]: any) => ({ year, avg: prices.reduce((a: number, b: number) => a + b, 0) / prices.length }))
    .sort((a: any, b: any) => a.year - b.year);

  if (isLoading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-3"><Skeleton className="h-14 w-full" /></CardContent></Card>)}</div>;
  if (!comps.length) return <EmptyState icon={Scale} title="No sales comps" subtitle="Comparable sales for this region will appear here" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-xs text-blue-400">Avg Sale Price</p><p className="text-lg font-bold text-blue-700">{fmtCurrency(avgPrice)}</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-xs text-emerald-400">Avg Cap Rate</p><p className="text-lg font-bold text-emerald-700">{avgCapRate ? `${avgCapRate.toFixed(2)}%` : '—'}</p></div>
        <div className="rounded-xl bg-purple-50 p-3 text-center"><p className="text-xs text-purple-400">Comps</p><p className="text-lg font-bold text-purple-700">{comps.length}</p></div>
      </div>
      {chartData.length > 1 && (
        <Card><CardContent className="px-2 pt-3 pb-2">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} barSize={24}><XAxis dataKey="year" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(v: number) => fmtCurrency(v)} /><Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      )}
      <div className="space-y-2">
        {comps.map((comp: any, i: number) => (
          <Card key={comp.id || i}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{comp.marina || comp.propertyName || 'Comp'}</p>
                  <p className="text-xs text-gray-500">{[comp.city, comp.state].filter(Boolean).join(', ')}{comp.saleYear ? ` · ${comp.saleYear}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  {comp.salePrice && <p className="text-sm font-bold">{fmtCurrency(comp.salePrice)}</p>}
                  {comp.capRate && <p className="text-xs text-emerald-600">{parseFloat(comp.capRate).toFixed(2)}% cap</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Market Intel ─────────────────────────────────────────────────
function DealIntelTab({ state }: { state?: string | null }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['docket-articles-deal', state],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '12', status: 'approved' });
      if (state) params.set('state', state);
      const res = await apiRequest('GET', `/api/docket/articles?${params}`);
      return res.json();
    },
  });
  const articles: any[] = Array.isArray(data) ? data : data?.articles || [];
  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>;
  if (!articles.length) return <EmptyState icon={Newspaper} title="No market intel" subtitle="Industry news will appear here as it's ingested" />;
  return (
    <div className="space-y-3">
      {articles.map((a: any) => {
        const sentCls = a.sentiment === 'positive' ? 'bg-green-100 text-green-700' : a.sentiment === 'negative' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
        return (
          <Card key={a.id} className="hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {a.sentiment && <Badge className={`text-[10px] ${sentCls}`}>{a.sentiment}</Badge>}
                    {a.category && <Badge variant="outline" className="text-[10px]">{fmtLabel(a.category)}</Badge>}
                  </div>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-900 hover:text-blue-600 line-clamp-2">{a.title}</a>
                  {a.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.summary}</p>}
                  <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                    {a.source && <span>{a.source}</span>}<span>{fmtDate(a.publishedAt)}</span>
                  </div>
                </div>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100 shrink-0"><ExternalLink className="h-3.5 w-3.5 text-gray-400" /></a>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Tab: Notes ────────────────────────────────────────────────────────
function DealNotesTab({ notes }: { notes: any[] }) {
  if (!notes?.length) return <EmptyState icon={MessageSquare} title="No notes yet" />;
  return (
    <div className="space-y-3">
      {notes.map((note: any) => (
        <Card key={note.id}><CardContent className="p-4">
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.content}</p>
          <p className="text-[10px] text-gray-400 mt-2">{fmtDate(note.createdAt)}</p>
        </CardContent></Card>
      ))}
    </div>
  );
}

// ── About Sidebar ─────────────────────────────────────────────────────
function DealAboutSidebar({ deal }: { deal: any }) {
  return (
    <>
      <RecordFieldGroup title="Deal Info" icon={Target}>
        <RecordField label="Stage" value={<Badge className={`text-xs ${stageColors[deal.stage] || 'bg-gray-100 text-gray-700'}`}>{fmtLabel(deal.stage)}</Badge>} icon={Target} />
        <RecordField label="Priority" value={<Badge className={`text-xs ${priorityColors[deal.priority] || 'bg-gray-100 text-gray-700'}`}>{fmtLabel(deal.priority)}</Badge>} icon={AlertCircle} />
        <RecordField label="Type" value={deal.type ? fmtLabel(deal.type) : null} icon={FileText} />
        <RecordField label="Asset Class" value={deal.assetClass ? fmtLabel(deal.assetClass) : null} icon={Building} />
        {deal.leadSource && <RecordField label="Lead Source" value={fmtLabel(deal.leadSource)} icon={TrendingUp} />}
        {deal.forecastCategory && <RecordField label="Forecast" value={fmtLabel(deal.forecastCategory)} icon={BarChart3} />}
      </RecordFieldGroup>
      {(deal.city || deal.state) && (
        <RecordFieldGroup title="Location" icon={MapPin}>
          <RecordField label="City" value={deal.city} icon={MapPin} />
          <RecordField label="State" value={deal.state} icon={MapPin} />
        </RecordFieldGroup>
      )}
      {(deal.marinaName || deal.slipNumber) && (
        <RecordFieldGroup title="Asset Details" icon={Anchor}>
          {deal.marinaName && <RecordField label="Property" value={deal.marinaName} icon={Anchor} />}
          {deal.slipNumber && <RecordField label="Slip #" value={deal.slipNumber} icon={Hash} />}
          {deal.boatName && <RecordField label="Boat" value={deal.boatName} icon={Anchor} />}
        </RecordFieldGroup>
      )}
      {(deal.firstDepositAmount || deal.secondDepositAmount) && (
        <RecordFieldGroup title="Deposits" icon={DollarSign}>
          {deal.firstDepositAmount && <RecordField label="1st Deposit" value={fmtCurrency(deal.firstDepositAmount)} icon={DollarSign} />}
          {deal.firstDepositDueDate && <RecordField label="Due" value={fmtDate(deal.firstDepositDueDate)} icon={Calendar} />}
          {deal.secondDepositAmount && <RecordField label="2nd Deposit" value={fmtCurrency(deal.secondDepositAmount)} icon={DollarSign} />}
        </RecordFieldGroup>
      )}
    </>
  );
}

// ── Right Sidebar ─────────────────────────────────────────────────────
function DealRightSidebar({ deal, associations }: { deal: any; associations: any }) {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-4">
      {associations?.contact && (
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setLocation(`/crm/contacts/${associations.contact.id}`)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 h-9 w-9 flex items-center justify-center text-sm font-bold text-blue-700">
                {associations.contact.firstName?.[0]}{associations.contact.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">Primary Contact</p>
                <p className="text-sm font-semibold truncate">{associations.contact.firstName} {associations.contact.lastName}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      )}
      {associations?.company && (
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setLocation(`/crm/companies/${associations.company.id}`)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 h-9 w-9 flex items-center justify-center text-sm font-bold text-emerald-700">
                {associations.company.name?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">Company</p>
                <p className="text-sm font-semibold truncate">{associations.company.name}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      )}
      {associations?.property && (
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setLocation(`/crm/properties/${associations.property.id}`)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 h-9 w-9 flex items-center justify-center">
                <Anchor className="h-4 w-4 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">Property</p>
                <p className="text-sm font-semibold truncate">{associations.property.name || associations.property.title}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Tab: LOI / Transaction Timeline ───────────────────────────────────
function DealLoiTimelineTab({ deal }: { deal: any }) {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const milestones = [
    { key: 'offerSubmittedAt', label: 'Offer Submitted', icon: FileText, color: 'bg-gray-100 text-gray-600' },
    { key: 'loiSubmittedAt', label: 'LOI Submitted', icon: FileText, color: 'bg-blue-100 text-blue-700' },
    { key: 'loiAcceptedAt', label: 'LOI Accepted', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
    { key: 'loiRejectedAt', label: 'LOI Rejected', icon: Circle, color: 'bg-red-100 text-red-700' },
    { key: 'loiExpiresAt', label: 'LOI Expiry', icon: Clock, color: 'bg-amber-100 text-amber-700' },
    { key: 'termSheetSignedAt', label: 'Term Sheet Signed', icon: FileText, color: 'bg-purple-100 text-purple-700' },
    { key: 'psaSignedDate', label: 'PSA Signed', icon: FileText, color: 'bg-indigo-100 text-indigo-700' },
    { key: 'psaExecutedAt', label: 'PSA Executed', icon: CheckCircle2, color: 'bg-indigo-100 text-indigo-700' },
    { key: 'ddExpirationDate', label: 'DD Expiration', icon: Clock, color: 'bg-orange-100 text-orange-700' },
    { key: 'closingScheduledAt', label: 'Closing Scheduled', icon: Calendar, color: 'bg-blue-100 text-blue-700' },
    { key: 'closingDate', label: 'Closing Date', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
  ];

  const updateMilestone = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string | null }) => {
      const res = await apiRequest('PUT', `/api/crm/deals/${deal.id}`, { [key]: value || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/deals', deal.id] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/deals/${deal.id}`] });
      setEditingKey(null);
    },
    onError: () => toast({ title: 'Failed to update milestone', variant: 'destructive' }),
  });

  const handleStartEdit = (key: string, current: string | null | undefined) => {
    setEditingKey(key);
    if (current) {
      try {
        setEditValue(format(new Date(current), 'yyyy-MM-dd'));
      } catch {
        setEditValue('');
      }
    } else {
      setEditValue('');
    }
  };

  const handleSave = (key: string) => {
    updateMilestone.mutate({ key, value: editValue || null });
  };

  const handleClear = (key: string) => {
    updateMilestone.mutate({ key, value: null });
    setEditingKey(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            Transaction Timeline
            <span className="text-[10px] font-normal text-gray-400">Click any date to edit</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {milestones.map((m) => {
              const val = deal[m.key];
              const Icon = m.icon;
              const isPast = val && new Date(val) < new Date();
              const isExpiry = m.key === 'loiExpiresAt' || m.key === 'ddExpirationDate';
              const isOverdue = val && isPast && isExpiry;
              const isEditing = editingKey === m.key;
              return (
                <div key={m.key} className={cn(
                  "flex items-center justify-between py-2 border-b last:border-b-0 gap-2",
                  !val && !isEditing && "opacity-50"
                )}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("rounded-lg p-1.5 shrink-0", val ? m.color : 'bg-gray-50 text-gray-300')}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm text-gray-700 truncate">{m.label}</span>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="date"
                        className="border rounded px-2 py-0.5 text-xs"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" className="h-6 px-2 text-[10px]"
                        onClick={() => handleSave(m.key)}
                        disabled={updateMilestone.isPending}>
                        Save
                      </Button>
                      {val && (
                        <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px] text-red-500"
                          onClick={() => handleClear(m.key)}>
                          Clear
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]"
                        onClick={() => setEditingKey(null)}>
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <button
                      className={cn(
                        "text-sm font-medium shrink-0 rounded px-1.5 py-0.5 hover:bg-gray-100 transition-colors",
                        isOverdue ? 'text-red-600' : val ? 'text-gray-900' : 'text-gray-300 hover:text-gray-500'
                      )}
                      onClick={() => handleStartEdit(m.key, val)}
                    >
                      {val ? fmtDate(val) : '+ Set date'}
                      {isOverdue && <span className="ml-1 text-[10px] text-red-500">OVERDUE</span>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {deal.offerPrice && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Offer Price</p>
            <p className="text-lg font-bold text-gray-900">{fmtCurrency(deal.offerPrice)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Commission Tracking ───────────────────────────────────────────
function DealCommissionsTab({ dealId, deal }: { dealId: string; deal: any }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    recipientName: '', recipientType: 'internal', role: '',
    splitPercent: '', commissionAmount: '', status: 'pending', notes: '', contactId: '',
  });

  const { data: commissions = [], isLoading } = useQuery<any[]>({
    queryKey: ['deal-commissions', dealId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/deals/${dealId}/commissions`);
      return res.json();
    },
    enabled: !!dealId,
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const nullableFields = ['contactId', 'role', 'splitPercent', 'commissionAmount', 'notes'];
      const sanitized: Record<string, any> = { ...data };
      for (const f of nullableFields) {
        if (sanitized[f] === '') sanitized[f] = undefined;
      }
      const res = await apiRequest('POST', `/api/crm/deals/${dealId}/commissions`, sanitized);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to add commission');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-commissions', dealId] });
      setShowForm(false);
      setForm({ recipientName: '', recipientType: 'internal', role: '', splitPercent: '', commissionAmount: '', status: 'pending', notes: '', contactId: '' });
    },
    onError: (err: any) => toast({ title: err?.message ?? 'Failed to add commission', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/crm/deals/${dealId}/commissions/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-commissions', dealId] }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/crm/deals/${dealId}/commissions/${id}`, { status });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-commissions', dealId] }),
  });

  const dealValue = Number(deal?.amount || deal?.value) || 0;
  const totalCommissionPool = deal?.commissionAmount
    ? parseFloat(deal.commissionAmount)
    : deal?.commissionRate
      ? dealValue * (parseFloat(deal.commissionRate) / 100)
      : 0;

  const totalAllocated = commissions.reduce((sum: number, c: any) => sum + (parseFloat(c.commissionAmount || '0') || 0), 0);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    paid: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
          <p className="text-xs text-emerald-500 mb-1">Commission Pool</p>
          <p className="text-xl font-bold text-emerald-700">{fmtCurrency(totalCommissionPool)}</p>
          {deal?.commissionRate && <p className="text-[10px] text-emerald-400 mt-0.5">{parseFloat(deal.commissionRate).toFixed(1)}% rate</p>}
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4">
          <p className="text-xs text-blue-500 mb-1">Allocated</p>
          <p className="text-xl font-bold text-blue-700">{fmtCurrency(totalAllocated)}</p>
          {totalCommissionPool > 0 && (
            <div className="mt-2">
              <Progress value={Math.min(100, (totalAllocated / totalCommissionPool) * 100)} className="h-1" />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><div className="h-12 bg-gray-100 rounded animate-pulse" /></CardContent></Card>)}</div>
      ) : commissions.length === 0 ? (
        <EmptyState icon={DollarSign} title="No commission splits yet" subtitle="Add recipients and split the commission pool." />
      ) : (
        <div className="space-y-2">
          {commissions.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{c.recipientName}</p>
                      {c.role && <Badge variant="outline" className="text-[10px]">{fmtLabel(c.role)}</Badge>}
                      <Badge className={cn("text-[10px]", statusColors[c.status] || 'bg-gray-100 text-gray-600')}>{c.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {c.splitPercent && <span>{parseFloat(c.splitPercent).toFixed(1)}% split</span>}
                      {c.commissionAmount && <span className="font-medium text-gray-700">{fmtCurrency(c.commissionAmount)}</span>}
                      <span className="capitalize">{c.recipientType}</span>
                    </div>
                    {c.notes && <p className="text-xs text-gray-500 mt-1">{c.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.status !== 'paid' && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => statusMutation.mutate({ id: c.id, status: c.status === 'pending' ? 'approved' : 'paid' })}>
                        {c.status === 'pending' ? 'Approve' : 'Mark Paid'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteMutation.mutate(c.id)}>
                      <span className="text-xs">✕</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Add Commission Split</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Recipient Name *</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.recipientName}
                  onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="John Smith" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 bg-white" value={form.recipientType}
                  onChange={e => setForm(f => ({ ...f, recipientType: e.target.value }))}>
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                  <option value="referral">Referral</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Role</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 bg-white" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="">Select role...</option>
                  <option value="listing_broker">Listing Broker</option>
                  <option value="buyers_broker">Buyer's Broker</option>
                  <option value="referral_agent">Referral Agent</option>
                  <option value="transaction_coordinator">Transaction Coordinator</option>
                  <option value="co_broker">Co-Broker</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Split %</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" type="number" step="0.5" min="0" max="100"
                  value={form.splitPercent} onChange={e => setForm(f => ({ ...f, splitPercent: e.target.value }))} placeholder="50" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Commission Amount ($)</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" type="number" step="100"
                  value={form.commissionAmount} onChange={e => setForm(f => ({ ...f, commissionAmount: e.target.value }))} placeholder="25000" />
              </div>
              {deal?.contacts?.length > 0 && (
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Link to Contact (optional)</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 bg-white" value={form.contactId}
                    onChange={e => setForm(f => ({ ...f, contactId: e.target.value }))}>
                    <option value="">None</option>
                    {deal.contacts.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}{c.company ? ` — ${c.company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Notes</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => addMutation.mutate(form)} disabled={!form.recipientName || addMutation.isPending}>
                {addMutation.isPending ? 'Adding...' : 'Add Split'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" variant="outline" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Add Commission Split
        </Button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function DealDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const dealId = params.dealId;
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isDocGenModalOpen, setIsDocGenModalOpen] = useState(false);
  const [isEmailComposeOpen, setIsEmailComposeOpen] = useState(false);

  const { data: deal, isLoading } = useQuery<any>({
    queryKey: ['/api/deals', dealId],
    enabled: !!dealId,
  });

  const { data: workspaceData } = useQuery<any>({
    queryKey: ['/api/deals', dealId, 'workspace'],
    enabled: !!dealId,
  });

  const { data: summaryData } = useQuery<any>({
    queryKey: ['crm-deal-summary', dealId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/summary/deals/${dealId}/summary`);
      return res.json();
    },
    enabled: !!dealId,
  });

  const { data: notesData } = useQuery<any[]>({
    queryKey: ['deal-notes', dealId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/notes?entityType=deal&entityId=${dealId}&limit=20`);
      const d = await res.json();
      return Array.isArray(d) ? d : d.notes || [];
    },
    enabled: !!dealId,
  });

  if (!dealId) return null;

  const dealValue = Number(deal?.amount || deal?.value) || 0;
  const associations = summaryData?.associations || {};

  const kpiChips = deal ? [
    { label: 'Value', value: fmtCurrency(dealValue), icon: DollarSign, color: 'text-blue-600' },
    { label: 'Probability', value: `${deal.probability ?? 0}%`, icon: TrendingUp },
    { label: 'Days in Stage', value: deal.daysInCurrentStage ?? 0, icon: Clock },
    ...(deal.priority === 'critical' || deal.priority === 'high' ? [{
      label: 'Priority',
      value: fmtLabel(deal.priority),
      icon: AlertCircle,
      color: 'text-red-600',
    }] : []),
  ] : [];

  const headerActions = deal && (
    <div className="flex items-center gap-2">
      {deal.ddProjectId ? (
        <Button size="sm" onClick={() => setLocation(`/dd/projects/${deal.ddProjectId}`)}>
          <FolderOpen className="h-4 w-4 mr-1.5" />DD Project
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setIsConvertModalOpen(true)}>
          <FolderOpen className="h-4 w-4 mr-1.5" />Convert to DD
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setIsEmailComposeOpen(true)}>
        <Mail className="h-4 w-4 mr-1.5" />Email
      </Button>
      <Button size="sm" variant="outline" onClick={() => setIsDocGenModalOpen(true)}>
        <FileText className="h-4 w-4 mr-1.5" />Docs
      </Button>
    </div>
  );

  return (
    <>
      {deal && (
        <ConvertToProjectModal isOpen={isConvertModalOpen} onClose={() => setIsConvertModalOpen(false)} deal={deal} />
      )}
      {deal && (
        <DocumentGeneratorModal isOpen={isDocGenModalOpen} onClose={() => setIsDocGenModalOpen(false)} dealId={dealId} dealName={deal.title} />
      )}
      <ComposeEmailModal
        open={isEmailComposeOpen}
        onOpenChange={setIsEmailComposeOpen}
        dealId={dealId}
        dealName={deal?.title}
      />
      <CrmRecordPage
        entityType="deal"
        entityId={dealId}
        entityName={deal?.title || deal?.name || 'Loading...'}
        entitySubtitle={deal ? [
          deal.stage ? fmtLabel(deal.stage) : null,
          deal.city && deal.state ? `${deal.city}, ${deal.state}` : deal.marinaName || null,
        ].filter(Boolean).join(' · ') : undefined}
        entityAvatar={deal && (
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-bold">
              {(deal.title || deal.name || 'D').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        status={deal?.stage ? fmtLabel(deal.stage) : undefined}
        statusColor={deal?.stage ? stageColors[deal.stage] || 'bg-gray-100 text-gray-700' : undefined}
        owner={summaryData?.owner || deal?.owner}
        isLoading={isLoading}
        kpiChips={kpiChips}
        headerActions={headerActions}

        aboutSidebar={deal && <DealAboutSidebar deal={deal} />}

        centerTabs={deal ? [
          {
            value: 'overview',
            label: 'Overview',
            content: <DealOverviewTab deal={deal} workspace={workspaceData} />,
          },
          {
            value: 'activities',
            label: 'Activities',
            count: summaryData?.activities?.openCount || 0,
            content: <DealActivitiesTab dealId={dealId} />,
          },
          {
            value: 'timeline',
            label: 'Timeline',
            content: <DealTimelineTab dealId={dealId} deal={deal} />,
          },
          {
            value: 'model',
            label: 'FM',
            content: <DealModelsTab dealId={dealId} />,
          },
          {
            value: 'comps',
            label: 'Comps',
            content: <DealCompsTab state={deal.state} city={deal.city} />,
          },
          {
            value: 'intel',
            label: 'Intel',
            content: <DealIntelTab state={deal.state} />,
          },
          {
            value: 'playbook',
            label: 'Playbook',
            content: <DealPlaybookPanel
              dealId={dealId}
              dealType={deal.type || undefined}
              stageId={deal.stageId || undefined}
              pipelineId={deal.pipelineId || undefined}
            />,
          },
          {
            value: 'red-flags',
            label: 'Red Flags',
            content: <RedFlagsPanel dealId={dealId} />,
          },
          {
            value: 'phase-gates',
            label: 'Approvals',
            content: <PhaseGatesPanel dealId={dealId} />,
          },
          {
            value: 'discussion',
            label: 'Discussion',
            content: <CommentThreadsPanel
              entityType="deal"
              entityId={dealId}
              entityName={deal.title || deal.name}
            />,
          },
          {
            value: 'notes',
            label: 'Notes',
            count: notesData?.length || 0,
            content: <DealNotesTab notes={notesData || []} />,
          },
          {
            value: 'loi-timeline',
            label: 'LOI / Milestones',
            content: <DealLoiTimelineTab deal={deal} />,
          },
          {
            value: 'commissions',
            label: 'Commissions',
            content: <DealCommissionsTab dealId={dealId} deal={deal} />,
          },
          {
            value: 'sla',
            label: 'SLA',
            content: <SlaTrackingPanel entityType="deal" entityId={dealId} />,
          },
        ] : []}

        rightSidebar={deal && <DealRightSidebar deal={deal} associations={associations} />}
      />
    </>
  );
}
