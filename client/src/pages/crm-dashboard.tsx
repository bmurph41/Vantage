import { useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, Building, DollarSign, TrendingUp, Phone, Mail, Calendar,
  ArrowRight, Sparkles, Home, Clock, CheckCircle2, AlertCircle, Layers,
  Activity, MapPin, StickyNote, Info, Flame, Target, Award, Zap,
  BarChart3, Timer, ArrowUpRight, ExternalLink, ChevronRight,
  Anchor, Building2, Briefcase, Factory, Hotel, Mountain, Store,
} from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { DealMetricsDashboard } from "@/components/crm/_wip/DealMetricsDashboard";
import { FeatureChecklist } from "@/components/ui/_primitives/feature-highlight";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { formatDistanceToNow, isToday, isBefore, startOfDay, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import {
  ASSET_CLASSES, ACTIVITY_TYPES, DEAL_PRIORITIES,
  calculateDaysInStage, formatCompactCurrency,
  calculateDealScore, getDealScoreGrade,
} from "@shared/crm-constants";

// ─── Constants ───────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "initial_contact", label: "Initial Contact", color: "bg-slate-500" },
  { key: "qualification",   label: "Qualification",   color: "bg-blue-500" },
  { key: "proposal",        label: "Proposal",        color: "bg-purple-500" },
  { key: "negotiation",     label: "Negotiation",     color: "bg-amber-500" },
  { key: "due_diligence",   label: "Due Diligence",   color: "bg-cyan-500" },
  { key: "closed_won",      label: "Closed Won",      color: "bg-green-500" },
  { key: "closed_lost",     label: "Closed Lost",     color: "bg-red-500" },
];

const AVATAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
  "bg-teal-500", "bg-pink-500", "bg-indigo-500", "bg-amber-500",
];

const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (name: string): string => {
  if (!name) return AVATAR_COLORS[0];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'call':    return <Phone className="w-4 h-4 text-blue-600" />;
    case 'email':   return <Mail className="w-4 h-4 text-purple-600" />;
    case 'meeting': return <Calendar className="w-4 h-4 text-green-600" />;
    case 'task':    return <CheckCircle2 className="w-4 h-4 text-amber-600" />;
    case 'note':    return <StickyNote className="w-4 h-4 text-gray-600" />;
    default:        return <Activity className="w-4 h-4 text-gray-600" />;
  }
};

// ─── KPI Stat Card ───────────────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, color, bgColor, link, isLoading, trend,
}: {
  title: string; value: string | number; subtitle: string;
  icon: any; color: string; bgColor: string;
  link: string; isLoading: boolean; trend?: { value: string; positive: boolean };
}) {
  return (
    <Link href={link}>
      <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group border hover:border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded-xl ${bgColor} group-hover:scale-110 transition-transform`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} />
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-500">{subtitle}</p>
            {trend && (
              <Badge variant="outline" className={`text-[10px] ${trend.positive ? 'text-green-600 border-green-200 bg-green-50' : 'text-red-600 border-red-200 bg-red-50'}`}>
                {trend.value}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Dashboard Component ─────────────────────────────────────────────

export default function CRMDashboard() {
  const reportRef = useRef<HTMLDivElement>(null);

  // ── Data Queries ──
  const { data: dealsData, isLoading: dealsLoading } = useQuery({ queryKey: ['/api/crm/deals'] });
  const { data: leadsData, isLoading: leadsLoading } = useQuery({ queryKey: ['/api/crm/leads'] });
  const { data: contactsData, isLoading: contactsLoading } = useQuery({ queryKey: ['/api/crm/contacts'] });
  const { data: companiesData, isLoading: companiesLoading } = useQuery({ queryKey: ['/api/crm/companies'] });
  const { data: propertiesData, isLoading: propertiesLoading } = useQuery({ queryKey: ['/api/crm/properties'] });
  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({ queryKey: ['/api/crm/activities'] });

  // Safe arrays
  const safeArr = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (data?.deals) return data.deals;
    if (data?.data) return data.data;
    return [];
  };
  const deals = safeArr(dealsData);
  const leads = safeArr(leadsData);
  const contacts = safeArr(contactsData);
  const companies = safeArr(companiesData);
  const properties = safeArr(propertiesData);
  const activities = safeArr(activitiesData);

  const isAnyLoading = dealsLoading || leadsLoading || contactsLoading || companiesLoading;

  // ── Computed Metrics ──
  const metrics = useMemo(() => {
    const totalDealValue = deals.reduce((sum: number, d: any) => sum + (parseFloat(d.value || d.amount || '0') || 0), 0);

    const activeDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const activePipelineValue = activeDeals.reduce((sum: number, d: any) => sum + (parseFloat(d.value || d.amount || '0') || 0), 0);

    const wonDeals = deals.filter((d: any) => d.stage === 'closed_won' || d.status === 'won');
    const lostDeals = deals.filter((d: any) => d.stage === 'closed_lost' || d.status === 'lost');
    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;
    const wonValue = wonDeals.reduce((sum: number, d: any) => sum + (parseFloat(d.value || d.amount || '0') || 0), 0);

    const weightedPipeline = activeDeals.reduce((sum: number, d: any) => {
      const amt = parseFloat(d.value || d.amount || '0') || 0;
      const prob = (d.probability ?? 50) / 100;
      return sum + amt * prob;
    }, 0);

    const avgDealSize = activeDeals.length > 0 ? activePipelineValue / activeDeals.length : 0;
    const avgDaysInStage = activeDeals.length > 0
      ? Math.round(activeDeals.reduce((sum: number, d: any) => sum + calculateDaysInStage(d.currentStageEnteredAt || d.updatedAt), 0) / activeDeals.length)
      : 0;

    const rottingDeals = activeDeals.filter((d: any) => calculateDaysInStage(d.currentStageEnteredAt || d.updatedAt) > 30);
    const hotLeads = leads.filter((l: any) => l.leadStatus === 'hot' || (Number(l.score) || 0) >= 70);
    const activeLeads = leads.filter((l: any) => l.leadStatus !== 'converted' && l.leadStatus !== 'unqualified');

    // This month closing
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const closingThisMonth = activeDeals.filter((d: any) => {
      if (!d.expectedCloseDate) return false;
      try {
        return isWithinInterval(new Date(d.expectedCloseDate), { start: monthStart, end: monthEnd });
      } catch { return false; }
    });

    const totalCommission = deals.reduce((sum: number, d: any) =>
      sum + (parseFloat(d.commissionAmount || '0') || 0), 0);

    return {
      totalDealValue, activePipelineValue, weightedPipeline, avgDealSize, avgDaysInStage,
      winRate, wonValue, wonCount: wonDeals.length, rottingCount: rottingDeals.length,
      hotLeadsCount: hotLeads.length, activeLeadsCount: activeLeads.length,
      closingThisMonthCount: closingThisMonth.length,
      closingThisMonthValue: closingThisMonth.reduce((sum: number, d: any) => sum + (parseFloat(d.value || d.amount || '0') || 0), 0),
      totalCommission,
    };
  }, [deals, leads]);

  // ── Pipeline by Stage ──
  const pipelineByStage = useMemo(() => {
    return PIPELINE_STAGES.map(stage => {
      const stageDeals = deals.filter((d: any) => d.stage === stage.key);
      const stageValue = stageDeals.reduce((sum: number, d: any) =>
        sum + (parseFloat(d.value || d.amount || '0') || 0), 0);
      return { ...stage, count: stageDeals.length, value: stageValue };
    }).filter(s => s.key !== 'closed_lost');
  }, [deals]);

  // ── Asset Class Breakdown ──
  const assetClassBreakdown = useMemo(() => {
    const buckets: Record<string, { count: number; value: number }> = {};
    deals.forEach((d: any) => {
      const ac = d.assetClass || 'other';
      if (!buckets[ac]) buckets[ac] = { count: 0, value: 0 };
      buckets[ac].count += 1;
      buckets[ac].value += parseFloat(d.value || d.amount || '0') || 0;
    });
    return Object.entries(buckets)
      .map(([key, data]) => ({
        ...data,
        assetClass: ASSET_CLASSES.find(a => a.value === key) || ASSET_CLASSES[ASSET_CLASSES.length - 1],
      }))
      .sort((a, b) => b.value - a.value);
  }, [deals]);

  // ── Activity Metrics ──
  const activityMetrics = useMemo(() => {
    const today = activities.filter((a: any) => {
      try { return isToday(new Date(a.createdAt || a.dueDate)); } catch { return false; }
    });
    const followUps = activities.filter((a: any) => {
      if (!a.dueDate) return false;
      try { return isToday(new Date(a.dueDate)) && a.type !== 'meeting'; } catch { return false; }
    });
    const meetings = activities.filter((a: any) => {
      try { return isToday(new Date(a.scheduledAt || a.dueDate)) && a.type === 'meeting'; } catch { return false; }
    });
    const overdue = activities.filter((a: any) => {
      if (!a.dueDate || a.completed) return false;
      try { return isBefore(new Date(a.dueDate), startOfDay(new Date())); } catch { return false; }
    });
    return { todayCount: today.length, followUps, meetings, overdue };
  }, [activities]);

  const recentActivities = activities
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);

  // ── Deals needing attention ──
  const needsAttention = useMemo(() => {
    return deals.filter((d: any) => {
      if (d.stage === 'closed_won' || d.stage === 'closed_lost') return false;
      if (d.updatedAt) {
        const daysSince = Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 7) return true;
      }
      return d.stage === 'negotiation' || d.stage === 'due_diligence';
    }).slice(0, 5);
  }, [deals]);

  return (
    <div ref={reportRef} className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">CRM Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Investment pipeline command center</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <ExportPdfButton contentRef={reportRef} filename="crm-dashboard" title="CRM Dashboard" />
          <Link href="/crm/deals">
            <Button size="sm"><DollarSign className="w-4 h-4 mr-1.5" />New Deal</Button>
          </Link>
          <Link href="/crm/leads">
            <Button variant="outline" size="sm"><TrendingUp className="w-4 h-4 mr-1.5" />New Lead</Button>
          </Link>
        </div>
      </div>

      {/* ── Top KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        <StatCard title="Pipeline Value" value={formatCompactCurrency(metrics.activePipelineValue)}
          subtitle={`${deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length} active deals`}
          icon={DollarSign} color="text-green-600" bgColor="bg-green-100" link="/crm/pipeline" isLoading={isAnyLoading} />
        <StatCard title="Weighted Pipeline" value={formatCompactCurrency(metrics.weightedPipeline)}
          subtitle="Probability adjusted"
          icon={Target} color="text-blue-600" bgColor="bg-blue-100" link="/crm/pipeline" isLoading={isAnyLoading} />
        <StatCard title="Win Rate" value={`${metrics.winRate.toFixed(0)}%`}
          subtitle={`${metrics.wonCount} won deals`}
          icon={Award} color="text-emerald-600" bgColor="bg-emerald-100" link="/crm/deals" isLoading={isAnyLoading} />
        <StatCard title="Active Leads" value={metrics.activeLeadsCount}
          subtitle={`${metrics.hotLeadsCount} hot`}
          icon={Flame} color="text-orange-600" bgColor="bg-orange-100" link="/crm/leads" isLoading={isAnyLoading} />
        <StatCard title="Contacts" value={contacts.length}
          subtitle={`${companies.length} companies`}
          icon={Users} color="text-purple-600" bgColor="bg-purple-100" link="/crm/contacts" isLoading={isAnyLoading} />
        <StatCard title="Properties" value={properties.length}
          subtitle="Tracked assets"
          icon={Home} color="text-teal-600" bgColor="bg-teal-100" link="/crm/properties" isLoading={isAnyLoading} />
      </div>

      {/* ── Today's Activity Panel (3 columns) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Follow-ups */}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold">Today's Follow-ups</span>
              </div>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                {activityMetrics.followUps.length}
              </Badge>
            </div>
            {activityMetrics.followUps.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No follow-ups today</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {activityMetrics.followUps.slice(0, 4).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-gray-50">
                    <div className={`w-6 h-6 rounded-full ${getAvatarColor(a.contactName || '')} flex items-center justify-center text-white text-[10px] font-medium`}>
                      {getInitials(a.contactName || 'T')}
                    </div>
                    <span className="truncate flex-1 text-xs">{a.subject || a.type}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meetings */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-500" />
                <span className="text-sm font-semibold">Today's Meetings</span>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                {activityMetrics.meetings.length}
              </Badge>
            </div>
            {activityMetrics.meetings.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No meetings today</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {activityMetrics.meetings.slice(0, 4).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-gray-50">
                    <div className={`w-6 h-6 rounded-full ${getAvatarColor(a.contactName || '')} flex items-center justify-center text-white text-[10px] font-medium`}>
                      {getInitials(a.contactName || 'M')}
                    </div>
                    <span className="truncate flex-1 text-xs">{a.subject || 'Meeting'}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue / Alerts */}
        <Card className={`border-l-4 ${activityMetrics.overdue.length > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${activityMetrics.overdue.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                <span className="text-sm font-semibold">Overdue Items</span>
              </div>
              <Badge variant={activityMetrics.overdue.length > 0 ? "destructive" : "outline"} className="text-xs">
                {activityMetrics.overdue.length}
              </Badge>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Overdue tasks</span>
                <span className="font-semibold text-red-600">{activityMetrics.overdue.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rotting deals</span>
                <span className={`font-semibold ${metrics.rottingCount > 0 ? 'text-red-600' : 'text-gray-700'}`}>{metrics.rottingCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Closing this month</span>
                <span className="font-semibold text-blue-600">{metrics.closingThisMonthCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Commission pending</span>
                <span className="font-semibold text-purple-600">{formatCompactCurrency(metrics.totalCommission)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Pipeline + Asset Class Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Summary (2/3) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="w-4.5 h-4.5 text-blue-600" />
                  Pipeline Summary
                </CardTitle>
                <CardDescription className="text-xs">
                  {formatCompactCurrency(metrics.activePipelineValue)} active pipeline
                </CardDescription>
              </div>
              <Link href="/crm/pipeline">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  View Pipeline <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {dealsLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-2.5">
                {pipelineByStage.map(stage => {
                  const maxValue = Math.max(...pipelineByStage.map(s => s.value), 1);
                  const barPct = Math.max((stage.value / maxValue) * 100, stage.count > 0 ? 3 : 0);
                  return (
                    <div key={stage.key} className="flex items-center gap-3 group hover:bg-gray-50 rounded-lg p-1.5 -mx-1.5 transition-colors">
                      <div className="w-28 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                      </div>
                      <div className="flex-1">
                        <div className="h-5 bg-gray-100 rounded-md overflow-hidden">
                          <div
                            className={`h-full ${stage.color} rounded-md transition-all duration-700 flex items-center justify-end pr-2`}
                            style={{ width: `${barPct}%`, minWidth: stage.count > 0 ? '24px' : '0' }}
                          >
                            {stage.count > 0 && (
                              <span className="text-[10px] text-white font-bold">{stage.count}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        <span className="text-sm font-semibold text-gray-700">
                          {formatCompactCurrency(stage.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset Class Breakdown (1/3) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4.5 h-4.5 text-purple-600" />
              By Asset Class
            </CardTitle>
            <CardDescription className="text-xs">{assetClassBreakdown.length} asset types in pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            {assetClassBreakdown.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No asset class data yet</p>
            ) : (
              <div className="space-y-3">
                {assetClassBreakdown.slice(0, 6).map(item => (
                  <div key={item.assetClass.value} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${item.assetClass.color}15` }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.assetClass.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 truncate">{item.assetClass.label}</span>
                        <span className="text-xs text-gray-500 ml-2">{item.count}</span>
                      </div>
                      <div className="text-xs text-gray-500">{formatCompactCurrency(item.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Deals + Activity Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Recent Deals</CardTitle>
              <Link href="/crm/deals">
                <Button variant="ghost" size="sm" className="text-xs gap-1">View All <ArrowRight className="w-3.5 h-3.5" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {dealsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : deals.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No deals yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deals.slice(0, 5).map((deal: any) => {
                  const stageInfo = PIPELINE_STAGES.find(s => s.key === deal.stage);
                  const assetClass = ASSET_CLASSES.find(a => a.value === deal.assetClass);
                  return (
                    <div key={deal.id} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-gray-50 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium truncate">{deal.title}</h4>
                          {assetClass && (
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: assetClass.color }}
                              title={assetClass.label} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className={`text-[10px] text-white ${stageInfo?.color || 'bg-gray-500'}`}>
                            {stageInfo?.label || deal.stage}
                          </Badge>
                          {deal.expectedCloseDate && (
                            <span className="text-[10px] text-gray-500">
                              Close: {formatDistanceToNow(new Date(deal.expectedCloseDate), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <div className="text-sm font-bold text-gray-900">
                          {formatCompactCurrency(parseFloat(deal.value || deal.amount || '0'))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4" /> Recent Activity
              </CardTitle>
              <Link href="/crm/activities">
                <Button variant="ghost" size="sm" className="text-xs gap-1">View All <ArrowRight className="w-3.5 h-3.5" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No activities yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentActivities.map((activity: any) => (
                  <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className="flex-shrink-0">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.subject || activity.type}</p>
                      <p className="text-[11px] text-gray-500">
                        {activity.createdAt ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }) : 'Recently'}
                        {activity.contactName ? ` · ${activity.contactName}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6"><Phone className="w-3 h-3 text-blue-600" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6"><Mail className="w-3 h-3 text-purple-600" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Properties Overview ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Home className="w-4.5 h-4.5 text-teal-600" /> Properties Overview
              </CardTitle>
              <CardDescription className="text-xs">Tracked assets in your portfolio</CardDescription>
            </div>
            <Link href="/crm/properties">
              <Button variant="ghost" size="sm" className="text-xs gap-1">View All <ArrowRight className="w-3.5 h-3.5" /></Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {propertiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Home className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No properties tracked yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {properties.slice(0, 6).map((p: any) => (
                <div key={p.id} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <h4 className="text-sm font-medium truncate">{p.title || p.name}</h4>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{p.address || p.city || 'No address'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{(p.status || 'available').replace('_', ' ')}</Badge>
                    {p.listingPrice && (
                      <span className="text-xs font-semibold text-green-600">{formatCompactCurrency(parseFloat(p.listingPrice))}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions + Platform Features ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100"><Zap className="w-4 h-4 text-blue-600" /></div>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Log a Call", icon: Phone, color: "bg-blue-100", textColor: "text-blue-600", href: "/crm/activities" },
                { label: "Send Email", icon: Mail, color: "bg-purple-100", textColor: "text-purple-600", href: "/crm/activities" },
                { label: "Schedule Meeting", icon: Calendar, color: "bg-green-100", textColor: "text-green-600", href: "/crm/activities" },
                { label: "Add Contact", icon: Users, color: "bg-orange-100", textColor: "text-orange-600", href: "/crm/contacts" },
                { label: "New Property", icon: Home, color: "bg-teal-100", textColor: "text-teal-600", href: "/crm/properties" },
                { label: "Pipeline View", icon: Layers, color: "bg-indigo-100", textColor: "text-indigo-600", href: "/crm/pipeline" },
              ].map(action => (
                <Link key={action.label} href={action.href}>
                  <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5 hover:bg-gray-50 group" size="sm">
                    <div className={`p-2 rounded-lg ${action.color} group-hover:scale-110 transition-transform`}>
                      <action.icon className={`w-4 h-4 ${action.textColor}`} />
                    </div>
                    <span className="text-[11px] font-medium">{action.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50/50 via-white to-teal-50/30 border-2 border-blue-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">MarinaMatch CRM Includes:</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureChecklist
              items={[
                { text: "Multi-Asset-Class Pipeline Management" },
                { text: "Deal Scoring & Rot Detection" },
                { text: "Lead Tracking & Qualification" },
                { text: "Contact & Company Database" },
                { text: "Activity Logging & Timeline" },
                { text: "Due Diligence Integration" },
                { text: "Commission Tracking" },
                { text: "Property Portfolio Management" },
                { text: "Email & Call Automation" },
              ]}
              columns={3}
              variant="accent"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
