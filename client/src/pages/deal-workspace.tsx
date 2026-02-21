import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, LayoutGrid, List, Users, DollarSign, TrendingUp,
  Target, Clock, Flame, Filter, Settings2, BarChart3, Activity,
  CheckSquare, Bookmark, ArrowRight, Calendar, MapPin, ChevronDown,
  Zap, Eye, AlertTriangle, Award,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DealFormModal from "@/components/modals/deal-form-modal";
import LeadFormModal from "@/components/modals/lead-form-modal";
import type { Deal, Contact, Company, PipelineStage, Lead } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import {
  ASSET_CLASSES, SAVED_VIEW_PRESETS, formatCompactCurrency, calculateDaysInStage,
} from "@shared/crm-constants";

const PipelineView = lazy(() => import("@/components/deal-workspace/PipelineView"));
const ListView = lazy(() => import("@/components/deal-workspace/ListView"));
const LeadsView = lazy(() => import("@/components/deal-workspace/LeadsView"));
const ActivityView = lazy(() => import("@/components/deal-workspace/ActivityView"));
const TasksView = lazy(() => import("@/components/deal-workspace/TasksView"));

type DealWithRelations = Deal & { contact?: Contact | null; company?: Company | null };

// ─── KPI Card ────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, color, isLoading, subtitle, alert,
}: {
  title: string; value: string | number; icon: React.ElementType;
  color: string; isLoading?: boolean; subtitle?: string; alert?: boolean;
}) {
  return (
    <Card className={`bg-white border shadow-sm ${alert ? 'border-red-200 bg-red-50/30' : ''}`}>
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-gray-500 truncate">{title}</p>
            {isLoading ? (
              <Skeleton className="h-6 w-16 mt-0.5" />
            ) : (
              <p className={`text-lg font-bold text-gray-900 mt-0.5 leading-tight ${alert ? 'text-red-600' : ''}`}>{value}</p>
            )}
            {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-4.5 h-4.5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ViewLoader() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading view...</p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function DealWorkspace() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const initialView = urlParams.get('view') || 'pipeline';

  const [activeView, setActiveView] = useState<'pipeline' | 'list' | 'leads' | 'activity' | 'tasks'>(
    initialView as 'pipeline' | 'list' | 'leads' | 'activity' | 'tasks'
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [activeAssetClass, setActiveAssetClass] = useState<string>("all");
  const [activeSavedView, setActiveSavedView] = useState<string>("all_deals");

  useEffect(() => {
    const newUrl = `/deal-workspace?view=${activeView}`;
    if (location !== newUrl) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [activeView]);

  // ── Data Fetching ──
  const { data: deals = [], isLoading: dealsLoading } = useQuery<DealWithRelations[]>({ queryKey: ['/api/deals'] });
  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({ queryKey: ['/api/leads'] });
  const { data: stages = [] } = useQuery<PipelineStage[]>({ queryKey: ['/api/stages'] });

  // ── Analytics ──
  const analytics = useMemo(() => {
    const openDeals = deals.filter(d => !d.isClosed);
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const activeDeals = openDeals.length;

    const closedWonStage = stages?.find(s =>
      s.name.toLowerCase().includes('closed') && s.name.toLowerCase().includes('won')
    );
    const closedDeals = deals.filter(d => d.isClosed);
    const wonDeals = closedWonStage ? closedDeals.filter(d => d.stageId === closedWonStage.id).length : 0;
    const winRate = closedDeals.length > 0 ? Math.round((wonDeals / closedDeals.length) * 100) : 0;

    const weightedValue = openDeals.reduce((sum, d) => {
      const amt = Number(d.amount) || 0;
      const prob = ((d as any).probability ?? 50) / 100;
      return sum + amt * prob;
    }, 0);

    const hotLeads = leads.filter(l => (Number(l.score) || 0) >= 70).length;
    const activeLeads = leads.filter(l => l.status !== 'converted' && l.status !== 'unqualified').length;

    const rottingDeals = openDeals.filter(d => calculateDaysInStage(d.currentStageEnteredAt) > 30).length;
    const avgDealSize = activeDeals > 0 ? totalPipelineValue / activeDeals : 0;

    // Closing this month
    const now = new Date();
    const closingThisMonth = openDeals.filter(d => {
      if (!d.expectedCloseDate) return false;
      const cd = new Date(d.expectedCloseDate);
      return cd.getMonth() === now.getMonth() && cd.getFullYear() === now.getFullYear();
    }).length;

    const totalCommission = deals.reduce((sum, d) => sum + (Number(d.commissionAmount) || 0), 0);

    return {
      totalPipelineValue, activeDeals, winRate, hotLeads, activeLeads,
      weightedValue, rottingDeals, avgDealSize, closingThisMonth, totalCommission,
    };
  }, [deals, leads, stages]);

  // ── Asset Class Tabs ──
  const assetClassCounts = useMemo(() => {
    const counts: Record<string, number> = { all: deals.length };
    deals.forEach(d => {
      const ac = (d as any).assetClass || 'other';
      counts[ac] = (counts[ac] || 0) + 1;
    });
    return counts;
  }, [deals]);

  const handleViewChange = (view: string) => {
    setActiveView(view as typeof activeView);
  };

  const handleAddNew = () => {
    if (activeView === 'leads') {
      setIsLeadFormOpen(true);
    } else {
      setEditingDeal(null);
      setIsDealFormOpen(true);
    }
  };

  const isLoading = dealsLoading || leadsLoading;

  return (
    <div ref={reportRef} className="flex flex-col min-h-full bg-gray-50">
      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-white border-b shadow-sm">
        <div className="px-6 py-4">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Deal Management
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Manage your pipeline, deals, and leads in one place
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ExportPdfButton contentRef={reportRef} filename="deal-workspace" title="Deal Workspace" />

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search deals, leads, companies..."
                  className="pl-10 w-64 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="search-workspace"
                />
              </div>

              {/* Saved Views Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
                    <Bookmark className="w-4 h-4" />
                    Views
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">Saved Views</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SAVED_VIEW_PRESETS.map(view => (
                    <DropdownMenuItem
                      key={view.id}
                      onClick={() => setActiveSavedView(view.id)}
                      className={activeSavedView === view.id ? "bg-blue-50" : ""}
                    >
                      <Eye className="w-3.5 h-3.5 mr-2 text-gray-400" />
                      <span className="text-sm">{view.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" className="h-9"
                onClick={() => setLocation('/crm/deals/compare')}>
                <BarChart3 className="w-4 h-4 mr-1.5" /> Compare
              </Button>

              <Button onClick={handleAddNew} className="h-9" data-testid="button-add-new">
                <Plus className="w-4 h-4 mr-1.5" />
                {activeView === 'leads' ? 'New Lead' : 'New Deal'}
              </Button>
            </div>
          </div>

          {/* Asset Class Selector Strip */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
            <Button
              variant={activeAssetClass === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs flex-shrink-0"
              onClick={() => setActiveAssetClass("all")}
            >
              All Classes
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {assetClassCounts.all || 0}
              </Badge>
            </Button>
            {ASSET_CLASSES.filter(ac => assetClassCounts[ac.value]).map(ac => (
              <Button
                key={ac.value}
                variant={activeAssetClass === ac.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs flex-shrink-0 gap-1.5"
                onClick={() => setActiveAssetClass(ac.value)}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ac.color }} />
                {ac.label}
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {assetClassCounts[ac.value] || 0}
                </Badge>
              </Button>
            ))}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2 mb-4">
            <KpiCard title="Pipeline" value={formatCompactCurrency(analytics.totalPipelineValue)}
              icon={DollarSign} color="bg-green-500" isLoading={isLoading} />
            <KpiCard title="Weighted" value={formatCompactCurrency(analytics.weightedValue)}
              icon={Target} color="bg-blue-500" isLoading={isLoading} />
            <KpiCard title="Active" value={analytics.activeDeals}
              icon={LayoutGrid} color="bg-indigo-500" isLoading={isLoading} />
            <KpiCard title="Win Rate" value={`${analytics.winRate}%`}
              icon={Award} color="bg-emerald-500" isLoading={isLoading} />
            <KpiCard title="Avg Size" value={formatCompactCurrency(analytics.avgDealSize)}
              icon={BarChart3} color="bg-purple-500" isLoading={isLoading} />
            <KpiCard title="Leads" value={analytics.activeLeads}
              icon={Users} color="bg-orange-500" isLoading={isLoading}
              subtitle={`${analytics.hotLeads} hot`} />
            <KpiCard title="Hot Leads" value={analytics.hotLeads}
              icon={Flame} color="bg-red-500" isLoading={isLoading} />
            <KpiCard title="Rotting" value={analytics.rottingDeals}
              icon={AlertTriangle} color={analytics.rottingDeals > 0 ? "bg-red-500" : "bg-gray-400"}
              isLoading={isLoading} alert={analytics.rottingDeals > 0} />
            <KpiCard title="Closing" value={analytics.closingThisMonth}
              icon={Calendar} color="bg-blue-500" isLoading={isLoading}
              subtitle="this month" />
            <KpiCard title="Commission" value={formatCompactCurrency(analytics.totalCommission)}
              icon={DollarSign} color="bg-purple-500" isLoading={isLoading} />
          </div>

          {/* View Tabs + Controls */}
          <div className="flex items-center justify-between">
            <Tabs value={activeView} onValueChange={handleViewChange} className="w-auto">
              <TabsList className="bg-gray-100 h-9">
                {[
                  { value: 'pipeline', icon: LayoutGrid, label: 'Pipeline', count: deals.filter(d => !d.isClosed).length },
                  { value: 'list', icon: List, label: 'List' },
                  { value: 'leads', icon: Users, label: 'Leads', count: leads.length },
                  { value: 'activity', icon: Activity, label: 'Activity' },
                  { value: 'tasks', icon: CheckSquare, label: 'Tasks' },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="gap-1.5 data-[state=active]:bg-white text-xs h-7"
                    data-testid={`tab-${tab.value}`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.count != null && (
                      <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{tab.count}</Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-filter">
                <Filter className="w-3.5 h-3.5" /> Filters
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid="button-settings">
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<ViewLoader />}>
          {activeView === 'pipeline' && (
            <PipelineView
              searchQuery={searchQuery}
              onEditDeal={(deal) => { setEditingDeal(deal); setIsDealFormOpen(true); }}
            />
          )}
          {activeView === 'list' && (
            <ListView
              searchQuery={searchQuery}
              onEditDeal={(deal) => { setEditingDeal(deal); setIsDealFormOpen(true); }}
            />
          )}
          {activeView === 'leads' && <LeadsView searchQuery={searchQuery} />}
          {activeView === 'activity' && <ActivityView />}
          {activeView === 'tasks' && <TasksView />}
        </Suspense>
      </div>

      {/* ── Modals ── */}
      <DealFormModal open={isDealFormOpen} onOpenChange={setIsDealFormOpen} deal={editingDeal} />
      <LeadFormModal open={isLeadFormOpen} onOpenChange={setIsLeadFormOpen} lead={null} />
    </div>
  );
}
