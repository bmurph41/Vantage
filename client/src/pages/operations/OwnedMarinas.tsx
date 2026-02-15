import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  Building2,
  DollarSign,
  TrendingUp,
  MapPin,
  Calendar,
  ChevronRight,
  Anchor,
  Users,
  BarChart3,
  Plus,
  ExternalLink,
  Target,
} from "lucide-react";
import MarinaBudgetTab from "@/components/operations/MarinaBudgetTab";
import MarinaMapEmbed from "@/components/marina-map/MarinaMapEmbed";
import { Map } from "lucide-react";

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

const formatCurrency = (value: number | null | undefined): string => {
  if (!value) return "$0";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatPercent = (value: number | null | undefined): string => {
  if (!value) return "0%";
  return `${value.toFixed(1)}%`;
};

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
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
  subtitle?: string;
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

  return (
    <div className={`p-4 rounded-lg ${bgColors[color] || "bg-muted"}`} data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-5 w-5 ${textColors[color] || "text-muted-foreground"}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textColors[color] || "text-foreground"}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}

export default function OwnedMarinas() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: marinas, isLoading } = useQuery<OwnedMarina[]>({
    queryKey: ["/api/operations/owned-marinas"],
  });

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
          <h1 className="text-2xl font-bold" data-testid="page-title">Owned Marinas</h1>
          <p className="text-muted-foreground">
            Manage your marina portfolio and track performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/modeling/portfolio")}
            data-testid="button-view-analytics"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Portfolio Analytics
          </Button>
          <Button onClick={() => navigate("/crm/properties/new")} data-testid="button-add-marina">
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
        />
        <KPICard
          label="Annual EBITDA"
          value={formatCurrency(summary.totalEbitda)}
          icon={TrendingUp}
          color="purple"
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
        />
        <KPICard
          label="Annual Revenue"
          value={formatCurrency(summary.totalRevenue)}
          icon={DollarSign}
          color="green"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="budget" data-testid="tab-budget">
            <Target className="h-4 w-4 mr-1" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="map" data-testid="tab-map">
            <Map className="h-4 w-4 mr-1" />
            Map
          </TabsTrigger>
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
                  <Button onClick={() => navigate("/crm/properties")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Browse Properties
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
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marinas.map((marina) => (
                        <TableRow key={marina.id} data-testid={`row-marina-${marina.id}`}>
                          <TableCell className="font-medium">{marina.name}</TableCell>
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
                              variant={marina.status === "active" ? "default" : "secondary"}
                            >
                              {marina.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {marina.projectId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/modeling/projects/${marina.projectId}`)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
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

        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Performance</CardTitle>
              <CardDescription>Financial performance trends across your portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Performance analytics coming soon</p>
                <p>Track revenue, occupancy, and valuation trends over time</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Budget Management</CardTitle>
              <CardDescription>Track annual budgets and compare actual vs budgeted performance</CardDescription>
            </CardHeader>
            <CardContent>
              <MarinaBudgetTab isPortfolioView={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <MarinaMapEmbed
            source="properties"
            markerColor="#4285F4"
            sourceLabel="Owned Marinas"
            height="calc(100vh - 380px)"
            showSearch={true}
            showStateFilter={true}
            showSourceFilter={false}
            showLayerToggles={false}
            showListPanel={true}
            emptyMessage="No owned marinas with location data found"
            onLocationClick={(loc) => {
              if (loc.id) navigate(`/crm/properties/${loc.id}`);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
