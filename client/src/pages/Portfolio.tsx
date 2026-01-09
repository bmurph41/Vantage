import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  MapPin,
  Anchor,
  Users,
  Plus,
  ExternalLink,
  PieChart,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Briefcase,
} from "lucide-react";
import { MarinaModal } from "@/components/portfolio/MarinaModal";
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
  totalValue: number;
  totalEbitda: number;
  totalSlips: number;
  avgOccupancy: number;
  totalRevenue: number;
}

const formatDate = (date: string | null): string => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
};

function KPICard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
  onClick,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  const bgColors: Record<string, string> = {
    blue: "bg-blue-100 dark:bg-blue-900/30",
    green: "bg-green-100 dark:bg-green-900/30",
    purple: "bg-purple-100 dark:bg-purple-900/30",
    amber: "bg-amber-100 dark:bg-amber-900/30",
  };
  const textColors: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    purple: "text-purple-600 dark:text-purple-400",
    amber: "text-amber-600 dark:text-amber-400",
  };

  const baseClasses = `p-4 rounded-lg ${bgColors[color] || "bg-muted"}`;
  const interactiveClasses = onClick ? "cursor-pointer transition-all hover:shadow-md hover:scale-105" : "";

  return (
    <div 
      className={`${baseClasses} ${interactiveClasses}`} 
      onClick={onClick}
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-5 w-5 ${textColors[color] || "text-muted-foreground"}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textColors[color] || "text-foreground"}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}

function FinancialMetricCard({
  label,
  value,
  change,
  isPositive,
}: {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground mb-1">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <div className={`flex items-center gap-1 text-sm mt-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
            {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {change}
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
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedMarina, setSelectedMarina] = useState<OwnedMarina | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [marinaToDelete, setMarinaToDelete] = useState<OwnedMarina | null>(null);

  useEffect(() => {
    const newTab = searchParams.get("tab");
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchString]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "overview") {
      navigate("/portfolio", { replace: true });
    } else {
      navigate(`/portfolio?tab=${tab}`, { replace: true });
    }
  };

  const { data: marinas, isLoading } = useQuery<OwnedMarina[]>({
    queryKey: ["/api/portfolio/marinas"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/portfolio/marinas/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/marinas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/available-properties"] });
      toast({ title: "Marina removed from portfolio" });
      setDeleteDialogOpen(false);
      setMarinaToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove marina", description: error.message, variant: "destructive" });
    },
  });

  const handleAddMarina = () => {
    setSelectedMarina(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleEditMarina = (marina: OwnedMarina) => {
    setSelectedMarina(marina);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleDeleteMarina = (marina: OwnedMarina) => {
    setMarinaToDelete(marina);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (marinaToDelete) {
      deleteMutation.mutate(marinaToDelete.id);
    }
  };

  const summary: PortfolioSummary = {
    totalMarinas: marinas?.length || 0,
    totalValue: marinas?.reduce((sum, m) => sum + (m.currentValue || m.acquisitionPrice || 0), 0) || 0,
    totalEbitda: marinas?.reduce((sum, m) => sum + (m.annualEbitda || 0), 0) || 0,
    totalSlips: marinas?.reduce((sum, m) => sum + (m.slips || 0), 0) || 0,
    avgOccupancy:
      marinas && marinas.length > 0
        ? marinas.reduce((sum, m) => sum + (m.occupancy || 0), 0) / marinas.length
        : 0,
    totalRevenue: marinas?.reduce((sum, m) => sum + (m.annualRevenue || 0), 0) || 0,
  };

  const totalCost = marinas?.reduce((sum, m) => sum + (m.acquisitionPrice || 0), 0) || 0;
  const unrealizedGain = summary.totalValue - totalCost;
  const gainPercent = totalCost > 0 ? ((unrealizedGain / totalCost) * 100).toFixed(1) : "0";
  const avgCapRate = summary.totalValue > 0 ? ((summary.totalEbitda / summary.totalValue) * 100).toFixed(1) : "0";
  const revenuePerSlip = summary.totalSlips > 0 ? Math.round(summary.totalRevenue / summary.totalSlips) : 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Portfolio</h1>
          <p className="text-muted-foreground">
            Manage your marina portfolio and track performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/deal-workspace")}
            data-testid="button-view-deals"
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Active Deals
          </Button>
          <Button onClick={handleAddMarina} data-testid="button-add-marina">
            <Plus className="h-4 w-4 mr-2" />
            Add Marina
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          label="Owned Marinas"
          value={String(summary.totalMarinas)}
          icon={Building2}
          color="blue"
        />
        <KPICard
          label="Portfolio Value"
          value={formatCurrency(summary.totalValue)}
          icon={DollarSign}
          color="green"
          onClick={() => handleTabChange("financials")}
        />
        <KPICard
          label="Annual EBITDA"
          value={formatCurrency(summary.totalEbitda)}
          icon={TrendingUp}
          color="purple"
          onClick={() => handleTabChange("financials")}
        />
        <KPICard
          label="Total Slips"
          value={String(summary.totalSlips)}
          icon={Anchor}
          color="blue"
        />
        <KPICard
          label="Avg Occupancy"
          value={formatPercent(summary.avgOccupancy)}
          icon={Users}
          color="amber"
          onClick={() => handleTabChange("performance")}
        />
        <KPICard
          label="Annual Revenue"
          value={formatCurrency(summary.totalRevenue)}
          icon={DollarSign}
          color="green"
          onClick={() => handleTabChange("financials")}
        />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="financials" data-testid="tab-financials">Financials</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Marina Portfolio</CardTitle>
              <CardDescription>All owned marinas and their key metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {(!marinas || marinas.length === 0) ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No owned marinas yet</p>
                  <p className="mb-4">Add properties to your portfolio to see them here</p>
                  <Button onClick={handleAddMarina}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Marina
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marina</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Acquisition</TableHead>
                        <TableHead className="text-right">Current Value</TableHead>
                        <TableHead className="text-right">EBITDA</TableHead>
                        <TableHead className="text-right">Slips</TableHead>
                        <TableHead className="text-right">Occupancy</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marinas.map((marina) => (
                        <TableRow key={marina.id} data-testid={`row-marina-${marina.id}`}>
                          <TableCell 
                            className="font-medium cursor-pointer hover:text-primary hover:underline" 
                            onClick={() => navigate(`/portfolio/${marina.id}`)}
                          >
                            {marina.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {marina.location}, {marina.state}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{formatCurrency(marina.acquisitionPrice)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(marina.acquisitionDate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(marina.currentValue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(marina.annualEbitda)}
                          </TableCell>
                          <TableCell className="text-right">{marina.slips || "-"}</TableCell>
                          <TableCell className="text-right">
                            {formatPercent(marina.occupancy)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={marina.status === "under_management" ? "default" : "secondary"}
                            >
                              {marina.status?.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
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
                                <DropdownMenuItem onClick={() => handleEditMarina(marina)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteMarina(marina)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove from Portfolio
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FinancialMetricCard
              label="Total Acquisition Cost"
              value={formatCurrency(totalCost)}
            />
            <FinancialMetricCard
              label="Current Portfolio Value"
              value={formatCurrency(summary.totalValue)}
              change={`${gainPercent}% from cost`}
              isPositive={unrealizedGain >= 0}
            />
            <FinancialMetricCard
              label="Unrealized Gain/Loss"
              value={formatCurrency(unrealizedGain)}
              isPositive={unrealizedGain >= 0}
            />
            <FinancialMetricCard
              label="Weighted Avg Cap Rate"
              value={`${avgCapRate}%`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FinancialMetricCard
              label="Total Annual Revenue"
              value={formatCurrency(summary.totalRevenue)}
            />
            <FinancialMetricCard
              label="Total Annual EBITDA"
              value={formatCurrency(summary.totalEbitda)}
            />
            <FinancialMetricCard
              label="Revenue per Slip"
              value={formatCurrency(revenuePerSlip)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Financial Summary by Marina</CardTitle>
              <CardDescription>Detailed financial breakdown for each property</CardDescription>
            </CardHeader>
            <CardContent>
              {(!marinas || marinas.length === 0) ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No financial data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marina</TableHead>
                        <TableHead className="text-right">Cost Basis</TableHead>
                        <TableHead className="text-right">Current Value</TableHead>
                        <TableHead className="text-right">Gain/Loss</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">EBITDA</TableHead>
                        <TableHead className="text-right">Cap Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marinas.map((marina) => {
                        const gain = (marina.currentValue || 0) - (marina.acquisitionPrice || 0);
                        const capRate = marina.currentValue && marina.annualEbitda 
                          ? ((marina.annualEbitda / marina.currentValue) * 100).toFixed(1)
                          : "-";
                        return (
                          <TableRow key={marina.id}>
                            <TableCell className="font-medium">{marina.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(marina.acquisitionPrice)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(marina.currentValue)}</TableCell>
                            <TableCell className={`text-right ${gain >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(gain)}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(marina.annualRevenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(marina.annualEbitda)}</TableCell>
                            <TableCell className="text-right">{capRate}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FinancialMetricCard
              label="Portfolio Occupancy"
              value={formatPercent(summary.avgOccupancy)}
            />
            <FinancialMetricCard
              label="Total Slips"
              value={String(summary.totalSlips)}
            />
            <FinancialMetricCard
              label="Occupied Slips"
              value={String(Math.round(summary.totalSlips * (summary.avgOccupancy / 100)))}
            />
            <FinancialMetricCard
              label="Vacant Slips"
              value={String(Math.round(summary.totalSlips * (1 - summary.avgOccupancy / 100)))}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance by Marina</CardTitle>
              <CardDescription>Occupancy and operational metrics by property</CardDescription>
            </CardHeader>
            <CardContent>
              {(!marinas || marinas.length === 0) ? (
                <div className="text-center py-12 text-muted-foreground">
                  <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No performance data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marina</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Total Slips</TableHead>
                        <TableHead className="text-right">Occupancy</TableHead>
                        <TableHead className="text-right">Occupied</TableHead>
                        <TableHead className="text-right">Vacant</TableHead>
                        <TableHead className="text-right">Rev/Slip</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marinas.map((marina) => {
                        const occupiedSlips = Math.round((marina.slips || 0) * ((marina.occupancy || 0) / 100));
                        const vacantSlips = (marina.slips || 0) - occupiedSlips;
                        const revPerSlip = marina.slips && marina.annualRevenue 
                          ? Math.round(marina.annualRevenue / marina.slips) 
                          : 0;
                        return (
                          <TableRow key={marina.id}>
                            <TableCell className="font-medium">{marina.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {marina.location}, {marina.state}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{marina.slips || "-"}</TableCell>
                            <TableCell className="text-right">
                              <span className={marina.occupancy && marina.occupancy >= 85 ? "text-green-600" : marina.occupancy && marina.occupancy >= 70 ? "text-amber-600" : "text-red-600"}>
                                {formatPercent(marina.occupancy)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{occupiedSlips}</TableCell>
                            <TableCell className="text-right">{vacantSlips}</TableCell>
                            <TableCell className="text-right">{formatCurrency(revPerSlip)}</TableCell>
                            <TableCell>
                              <Badge variant={marina.status === "under_management" ? "default" : "secondary"}>
                                {marina.status?.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
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
            <AlertDialogTitle>Remove Marina from Portfolio?</AlertDialogTitle>
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
