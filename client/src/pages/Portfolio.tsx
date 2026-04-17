import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  MapPin,
  Map,
  Anchor,
  Users,
  Plus,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  LayoutGrid,
  BarChart3,
  Wallet,
} from "lucide-react";
import { MarinaModal } from "@/components/portfolio/MarinaModal";
import MarinaMapEmbed from "@/components/marina-map/MarinaMapEmbed";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface OwnedMarina {
  id: string;
  name: string;
  location: string;
  state: string;
  acquisitionDate: string | null;
  acquisitionPrice: number | null;
  currentValue: number | null;
  slips: number | null;
  occupancy: number | null;
  annualRevenue: number | null;
  annualEbitda: number | null;
  status: string;
  projectId?: string;
  propertyId?: string;
}

interface PortfolioSummary {
  totalMarinas: number;
  totalAssets: number;
  totalValue: number;
  totalEbitda: number;
  totalSlips: number;
  totalUnits: number;
  avgOccupancy: number;
  totalRevenue: number;
}

const formatDate = (date: string | null): string => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short" });
};

const statusLabel: Record<string, string> = {
  under_management: "Under Management",
  stabilizing: "Stabilizing",
  value_add: "Value-Add",
  disposition: "Disposition",
  other: "Other",
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  under_management: "default",
  stabilizing: "secondary",
  value_add: "outline",
  disposition: "destructive",
};

function KpiBar({ summary, totalCost, unrealizedGain, gainPercent, avgCapRate }: {
  summary: PortfolioSummary;
  totalCost: number;
  unrealizedGain: number;
  gainPercent: string;
  avgCapRate: string;
}) {
  const kpis = [
    { label: "Owned Assets", value: String(summary.totalAssets), icon: Building2, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
    { label: "Portfolio Value", value: formatCurrency(summary.totalValue), icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    { label: "Annual EBITDA", value: formatCurrency(summary.totalEbitda), icon: TrendingUp, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40" },
    { label: "Avg Occupancy", value: formatPercent(summary.avgOccupancy), icon: Users, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
    { label: "Total Units", value: String(summary.totalUnits || summary.totalSlips), icon: Anchor, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/40" },
    { label: "Unrealized Gain", value: formatCurrency(unrealizedGain), sub: `${gainPercent}% from cost`, icon: unrealizedGain >= 0 ? ArrowUpRight : ArrowDownRight, color: unrealizedGain >= 0 ? "text-green-600" : "text-red-600", bg: unrealizedGain >= 0 ? "bg-green-50 dark:bg-green-950/40" : "bg-red-50 dark:bg-red-950/40" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map(({ label, value, sub, icon: Icon, color, bg }) => (
        <div key={label} className={`rounded-xl p-4 ${bg} border border-border/50`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg bg-white dark:bg-gray-900 shadow-sm`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
          </div>
          <div className={`text-xl font-bold ${color}`}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

function AssetCard({ marina, onEdit, onDelete, navigate }: {
  marina: OwnedMarina;
  onEdit: (m: OwnedMarina) => void;
  onDelete: (m: OwnedMarina) => void;
  navigate: (path: string) => void;
}) {
  const gain = (marina.currentValue || 0) - (marina.acquisitionPrice || 0);
  const gainPct = marina.acquisitionPrice ? ((gain / marina.acquisitionPrice) * 100).toFixed(1) : null;
  const capRate = marina.currentValue && marina.annualEbitda
    ? ((marina.annualEbitda / marina.currentValue) * 100).toFixed(1)
    : null;
  const occupiedSlips = Math.round((marina.slips || 0) * ((marina.occupancy || 0) / 100));

  return (
    <Card
      className="group hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer flex flex-col overflow-hidden"
      onClick={() => navigate(`/portfolio/${marina.id}`)}
    >
      <div className="h-2 w-full bg-gradient-to-r from-primary/70 to-primary/20" />
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold leading-tight group-hover:text-primary transition-colors truncate">
              {marina.name}
            </CardTitle>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{marina.location}, {marina.state}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={statusVariant[marina.status] || "secondary"} className="text-xs whitespace-nowrap">
              {statusLabel[marina.status] || marina.status?.replace(/_/g, " ") || "Unknown"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => navigate(`/portfolio/${marina.id}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {marina.propertyId && (
                  <DropdownMenuItem onClick={() => navigate(`/crm/properties/${marina.propertyId}`)}>
                    <Building2 className="h-4 w-4 mr-2" />
                    View Property
                  </DropdownMenuItem>
                )}
                {marina.projectId && (
                  <DropdownMenuItem onClick={() => navigate(`/modeling/projects/${marina.projectId}`)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Model
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onEdit(marina)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(marina)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Acq. Price</div>
            <div className="text-sm font-semibold">{formatCurrency(marina.acquisitionPrice)}</div>
            <div className="text-xs text-muted-foreground">{formatDate(marina.acquisitionDate)}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Current Value</div>
            <div className="text-sm font-semibold">{formatCurrency(marina.currentValue)}</div>
            {gainPct && (
              <div className={`text-xs flex items-center gap-0.5 ${gain >= 0 ? "text-green-600" : "text-red-600"}`}>
                {gain >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {gainPct}% {gain >= 0 ? "gain" : "loss"}
              </div>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Annual EBITDA</div>
            <div className="text-sm font-semibold">{formatCurrency(marina.annualEbitda)}</div>
            {capRate && <div className="text-xs text-muted-foreground">{capRate}% cap rate</div>}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Annual Revenue</div>
            <div className="text-sm font-semibold">{formatCurrency(marina.annualRevenue)}</div>
          </div>
        </div>

        {marina.slips && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Anchor className="h-3 w-3" />
                {occupiedSlips} / {marina.slips} slips occupied
              </span>
              <span className={`font-medium ${(marina.occupancy || 0) >= 85 ? "text-green-600" : (marina.occupancy || 0) >= 70 ? "text-amber-600" : "text-red-500"}`}>
                {formatPercent(marina.occupancy)}
              </span>
            </div>
            <Progress
              value={marina.occupancy || 0}
              className="h-1.5"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyPortfolio({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-5 rounded-full bg-muted mb-5">
        <Building2 className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No owned assets yet</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Add marinas and properties to your portfolio to track performance, returns, and financials.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Add First Asset
      </Button>
    </div>
  );
}

function FinancialSummaryCard({ label, value, sub, isPositive }: {
  label: string;
  value: string;
  sub?: string;
  isPositive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {sub !== undefined && (
          <div className={`text-xs mt-1 flex items-center gap-0.5 ${isPositive === true ? "text-green-600" : isPositive === false ? "text-red-600" : "text-muted-foreground"}`}>
            {isPositive === true && <ArrowUpRight className="h-3 w-3" />}
            {isPositive === false && <ArrowDownRight className="h-3 w-3" />}
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Portfolio() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialTab = searchParams.get("tab") || "assets";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedMarina, setSelectedMarina] = useState<OwnedMarina | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [marinaToDelete, setMarinaToDelete] = useState<OwnedMarina | null>(null);
  const [mapSource, setMapSource] = useState<'owned' | 'pipeline' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'ebitda' | 'occupancy'>('name');

  useEffect(() => {
    const newTab = searchParams.get("tab");
    if (newTab && newTab !== activeTab) setActiveTab(newTab);
  }, [searchString]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(tab === "assets" ? "/portfolio" : `/portfolio?tab=${tab}`, { replace: true });
  };

  const { data: marinas, isLoading } = useQuery<OwnedMarina[]>({
    queryKey: ["/api/portfolio/marinas"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/portfolio/marinas/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/marinas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/available-properties"] });
      toast({ title: "Asset removed from portfolio" });
      setDeleteDialogOpen(false);
      setMarinaToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove asset", description: error.message, variant: "destructive" });
    },
  });

  const handleAddAsset = () => { setSelectedMarina(null); setModalMode("create"); setModalOpen(true); };
  const handleEditMarina = (marina: OwnedMarina) => { setSelectedMarina(marina); setModalMode("edit"); setModalOpen(true); };
  const handleDeleteMarina = (marina: OwnedMarina) => { setMarinaToDelete(marina); setDeleteDialogOpen(true); };
  const confirmDelete = () => { if (marinaToDelete) deleteMutation.mutate(marinaToDelete.id); };

  const summary: PortfolioSummary = {
    totalMarinas: marinas?.length || 0,
    totalAssets: marinas?.length || 0,
    totalValue: marinas?.reduce((s, m) => s + (m.currentValue || m.acquisitionPrice || 0), 0) || 0,
    totalEbitda: marinas?.reduce((s, m) => s + (m.annualEbitda || 0), 0) || 0,
    totalSlips: marinas?.reduce((s, m) => s + (m.slips || 0), 0) || 0,
    totalUnits: marinas?.reduce((s, m) => s + (m.slips || 0), 0) || 0,
    avgOccupancy: marinas?.length ? marinas.reduce((s, m) => s + (m.occupancy || 0), 0) / marinas.length : 0,
    totalRevenue: marinas?.reduce((s, m) => s + (m.annualRevenue || 0), 0) || 0,
  };
  const totalCost = marinas?.reduce((s, m) => s + (m.acquisitionPrice || 0), 0) || 0;
  const unrealizedGain = summary.totalValue - totalCost;
  const gainPercent = totalCost > 0 ? ((unrealizedGain / totalCost) * 100).toFixed(1) : "0";
  const avgCapRate = summary.totalValue > 0 ? ((summary.totalEbitda / summary.totalValue) * 100).toFixed(1) : "0";
  const revenuePerUnit = (summary.totalUnits || summary.totalSlips) > 0
    ? Math.round(summary.totalRevenue / (summary.totalUnits || summary.totalSlips)) : 0;

  const sortedMarinas = [...(marinas || [])].sort((a, b) => {
    if (sortBy === 'value') return (b.currentValue || 0) - (a.currentValue || 0);
    if (sortBy === 'ebitda') return (b.annualEbitda || 0) - (a.annualEbitda || 0);
    if (sortBy === 'occupancy') return (b.occupancy || 0) - (a.occupancy || 0);
    return a.name.localeCompare(b.name);
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investment Portfolio</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {summary.totalAssets} owned asset{summary.totalAssets !== 1 ? "s" : ""} · Track performance, returns, and financials
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate("/marinalytics/marina-map")}>
            <Map className="h-4 w-4 mr-1.5" />
            Map View
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/deal-workspace")}>
            <Briefcase className="h-4 w-4 mr-1.5" />
            Active Deals
          </Button>
          <Button size="sm" onClick={handleAddAsset}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Asset
          </Button>
        </div>
      </div>

      <KpiBar
        summary={summary}
        totalCost={totalCost}
        unrealizedGain={unrealizedGain}
        gainPercent={gainPercent}
        avgCapRate={avgCapRate}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="assets" className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-1.5">
              <Map className="h-3.5 w-3.5" />
              Map
            </TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              Financials
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Performance
            </TabsTrigger>
          </TabsList>

          {activeTab === "assets" && (marinas?.length || 0) > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Sort by:</span>
              {(["name", "value", "ebitda", "occupancy"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-2 py-1 rounded-md capitalize transition-colors ${sortBy === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <TabsContent value="assets" className="mt-4">
          {!marinas || marinas.length === 0 ? (
            <EmptyPortfolio onAdd={handleAddAsset} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedMarinas.map((marina) => (
                <AssetCard
                  key={marina.id}
                  marina={marina}
                  onEdit={handleEditMarina}
                  onDelete={handleDeleteMarina}
                  navigate={navigate}
                />
              ))}
              <Card
                className="border-dashed border-2 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] gap-2 text-muted-foreground hover:text-primary"
                onClick={handleAddAsset}
              >
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">Add Asset</span>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Map className="h-5 w-5" />
                    Portfolio Map
                  </CardTitle>
                  <CardDescription className="mt-1">
                    View owned assets and pipeline deals on the map
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  {(["all", "owned", "pipeline"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={mapSource === s ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs capitalize"
                      onClick={() => setMapSource(s)}
                    >
                      {s === "owned" && <Building2 className="h-3.5 w-3.5 mr-1" />}
                      {s === "pipeline" && <Anchor className="h-3.5 w-3.5 mr-1" />}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <MarinaMapEmbed
                key={mapSource}
                source={mapSource === 'owned' ? 'owned' : mapSource === 'pipeline' ? 'pipeline' : 'all'}
                baseUrl={mapSource === 'owned' || mapSource === 'pipeline' ? '/api/portfolio/map-locations' : '/api/marina-map/locations'}
                sourceLabel={mapSource === 'all' ? 'All Assets' : mapSource === 'owned' ? 'Owned Assets' : 'Pipeline Deals'}
                height="calc(100vh - 460px)"
                showSearch={true}
                showStateFilter={true}
                showSourceFilter={false}
                showLayerToggles={mapSource === 'all'}
                showListPanel={true}
                emptyMessage={mapSource === 'owned' ? 'No owned assets with location data found' : mapSource === 'pipeline' ? 'No pipeline deals with location data found' : 'No assets with location data found'}
                onLocationClick={(loc) => {
                  if (loc.source === 'owned' && loc.id) navigate(`/portfolio/${loc.id}`);
                  else if (loc.source === 'pipeline' && loc.id) navigate(`/crm/deals/${loc.id}`);
                  else if (loc.source === 'property' && loc.id) navigate(`/crm/properties/${loc.id}`);
                  else if (loc.source === 'comp' && loc.id) navigate(`/analysis/sales-comps/${loc.id}`);
                  else if (loc.source === 'rate_comp' && loc.id) navigate(`/analysis/rate-comps/${loc.id}`);
                  else if (loc.source === 'project' && loc.id) navigate(`/modeling/${loc.id}`);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FinancialSummaryCard label="Total Acquisition Cost" value={formatCurrency(totalCost)} />
            <FinancialSummaryCard
              label="Current Portfolio Value"
              value={formatCurrency(summary.totalValue)}
              sub={`${gainPercent}% from cost`}
              isPositive={unrealizedGain >= 0}
            />
            <FinancialSummaryCard
              label="Unrealized Gain / Loss"
              value={formatCurrency(unrealizedGain)}
              isPositive={unrealizedGain >= 0}
            />
            <FinancialSummaryCard label="Weighted Avg Cap Rate" value={`${avgCapRate}%`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FinancialSummaryCard label="Total Annual Revenue" value={formatCurrency(summary.totalRevenue)} />
            <FinancialSummaryCard label="Total Annual EBITDA" value={formatCurrency(summary.totalEbitda)} />
            <FinancialSummaryCard label="Revenue per Unit" value={formatCurrency(revenuePerUnit)} />
          </div>

          {marinas && marinas.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...marinas]
                .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
                .map((marina) => {
                  const gain = (marina.currentValue || 0) - (marina.acquisitionPrice || 0);
                  const pct = marina.acquisitionPrice ? ((gain / marina.acquisitionPrice) * 100).toFixed(1) : null;
                  const capRate = marina.currentValue && marina.annualEbitda
                    ? ((marina.annualEbitda / marina.currentValue) * 100).toFixed(1)
                    : null;
                  return (
                    <Card
                      key={marina.id}
                      className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer"
                      onClick={() => navigate(`/portfolio/${marina.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">{marina.name}</CardTitle>
                          {capRate && (
                            <Badge variant="outline" className="text-xs">{capRate}% cap</Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {marina.location}, {marina.state}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Cost Basis</div>
                            <div className="font-semibold">{formatCurrency(marina.acquisitionPrice)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Current Value</div>
                            <div className="font-semibold">{formatCurrency(marina.currentValue)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Gain / Loss</div>
                            <div className={`font-semibold flex items-center gap-0.5 ${gain >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {pct && `${gain >= 0 ? "+" : ""}${pct}%`}
                              <span className="text-muted-foreground font-normal ml-1">({formatCurrency(gain)})</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Annual EBITDA</div>
                            <div className="font-semibold">{formatCurrency(marina.annualEbitda)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}

          {(!marinas || marinas.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No financial data available. Add assets to get started.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FinancialSummaryCard label="Portfolio Occupancy" value={formatPercent(summary.avgOccupancy)} />
            <FinancialSummaryCard label="Total Units / Slips" value={String(summary.totalUnits || summary.totalSlips)} />
            <FinancialSummaryCard
              label="Occupied"
              value={String(Math.round((summary.totalUnits || summary.totalSlips) * (summary.avgOccupancy / 100)))}
            />
            <FinancialSummaryCard
              label="Vacant"
              value={String(Math.round((summary.totalUnits || summary.totalSlips) * (1 - summary.avgOccupancy / 100)))}
            />
          </div>

          {marinas && marinas.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...marinas]
                .sort((a, b) => (b.occupancy || 0) - (a.occupancy || 0))
                .map((marina) => {
                  const occ = marina.occupancy || 0;
                  const occupied = Math.round((marina.slips || 0) * (occ / 100));
                  const vacant = (marina.slips || 0) - occupied;
                  const revPerSlip = marina.slips && marina.annualRevenue
                    ? Math.round(marina.annualRevenue / marina.slips) : 0;
                  return (
                    <Card
                      key={marina.id}
                      className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer"
                      onClick={() => navigate(`/portfolio/${marina.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">{marina.name}</CardTitle>
                          <span className={`text-sm font-bold ${occ >= 85 ? "text-green-600" : occ >= 70 ? "text-amber-600" : "text-red-500"}`}>
                            {formatPercent(occ)}
                          </span>
                        </div>
                        <CardDescription className="text-xs flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {marina.location}, {marina.state}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <Progress value={occ} className="h-2" />
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="text-muted-foreground">Total</div>
                            <div className="font-semibold">{marina.slips || "—"}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground text-green-600">Occupied</div>
                            <div className="font-semibold text-green-600">{occupied}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground text-red-500">Vacant</div>
                            <div className="font-semibold text-red-500">{vacant}</div>
                          </div>
                        </div>
                        {revPerSlip > 0 && (
                          <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                            {formatCurrency(revPerSlip)} / slip / yr
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}

          {(!marinas || marinas.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No performance data available. Add assets to get started.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MarinaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        marina={selectedMarina}
        mode={modalMode}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Asset from Portfolio?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{marinaToDelete?.name}" from your portfolio. The property will still exist in your CRM but won't be tracked as an owned asset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
