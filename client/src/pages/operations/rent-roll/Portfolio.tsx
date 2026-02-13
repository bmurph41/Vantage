import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Users,
  Anchor,
  Plus,
  MapPin,
  TrendingUp,
  ChevronRight,
  BarChart3,
  Percent,
} from "lucide-react";

interface PropertyData {
  id: string;
  name: string;
  location: string;
  slips: number;
  occupied: number;
  monthlyRevenue: number;
  leasesExpiringIn90Days: number;
  status: "active" | "inactive";
}

interface PortfolioSummary {
  totalProperties: number;
  totalSlips: number;
  averageOccupancy: number;
  totalMonthlyRevenue: number;
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

function KPICard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
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
    <div
      className={`p-4 rounded-lg ${bgColors[color] || "bg-muted"}`}
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-5 w-5 ${textColors[color] || "text-muted-foreground"}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textColors[color] || "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  const [, navigate] = useLocation();

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No properties yet</h3>
        <p className="text-muted-foreground mb-6">
          Add your first rent roll property to get started with portfolio tracking.
        </p>
        <Button onClick={() => navigate("/operations/rent-roll")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Property
        </Button>
      </CardContent>
    </Card>
  );
}

function RevenueComparisonChart({ properties }: { properties: PropertyData[] }) {
  if (!properties.length) return null;

  const maxRevenue = Math.max(...properties.map((p) => p.monthlyRevenue));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Revenue by Property</CardTitle>
        <CardDescription>Revenue comparison across your portfolio</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {properties.map((property) => {
            const percentage = (property.monthlyRevenue / maxRevenue) * 100;
            return (
              <div key={property.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{property.name}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(property.monthlyRevenue)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <Skeleton className="h-96" />
      <Skeleton className="h-72" />
    </div>
  );
}

export default function RentRollPortfolio() {
  const [, navigate] = useLocation();

  const { data: properties, isLoading } = useQuery<PropertyData[]>({
    queryKey: ["/api/operations/rent-roll/portfolio"],
  });

  const summary: PortfolioSummary = {
    totalProperties: properties?.length || 0,
    totalSlips: properties?.reduce((sum, p) => sum + p.slips, 0) || 0,
    averageOccupancy:
      properties && properties.length > 0
        ? (properties.reduce((sum, p) => sum + (p.occupied / p.slips) * 100, 0) /
            properties.length) *
          (properties.length / Math.max(1, properties.length))
        : 0,
    totalMonthlyRevenue: properties?.reduce((sum, p) => sum + p.monthlyRevenue, 0) || 0,
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll-portfolio">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll-portfolio">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-foreground mb-2"
            data-testid="heading-rent-roll-portfolio"
          >
            Rent Roll Portfolio
          </h1>
          <p className="text-muted-foreground" data-testid="description-rent-roll-portfolio">
            Manage and analyze your portfolio of rent rolls across multiple properties and scenarios.
          </p>
        </div>
        <Button onClick={() => navigate("/operations/rent-roll")} data-testid="button-add-property">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      {!properties || properties.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Properties"
              value={String(summary.totalProperties)}
              icon={Building2}
              color="blue"
            />
            <KPICard
              label="Total Slips/Units"
              value={String(summary.totalSlips)}
              icon={Anchor}
              color="purple"
            />
            <KPICard
              label="Average Occupancy"
              value={formatPercent(summary.averageOccupancy)}
              icon={Users}
              color="amber"
            />
            <KPICard
              label="Monthly Revenue"
              value={formatCurrency(summary.totalMonthlyRevenue)}
              icon={DollarSign}
              color="green"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Properties Overview</CardTitle>
              <CardDescription>
                All rent roll properties and their key metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Slips/Units</TableHead>
                      <TableHead className="text-right">Occupied</TableHead>
                      <TableHead className="text-right">Vacancy Rate</TableHead>
                      <TableHead className="text-right">Monthly Revenue</TableHead>
                      <TableHead className="text-right">Lease Expiries (90 days)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties.map((property) => {
                      const vacancyRate = ((property.slips - property.occupied) / property.slips) * 100;
                      return (
                        <TableRow key={property.id} data-testid={`row-property-${property.id}`}>
                          <TableCell className="font-medium">{property.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {property.location}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{property.slips}</TableCell>
                          <TableCell className="text-right">{property.occupied}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Percent className="h-3 w-3 text-muted-foreground" />
                              {formatPercent(vacancyRate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(property.monthlyRevenue)}
                          </TableCell>
                          <TableCell className="text-right">{property.leasesExpiringIn90Days}</TableCell>
                          <TableCell>
                            <Badge
                              variant={property.status === "active" ? "default" : "secondary"}
                            >
                              {property.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-view-${property.id}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <RevenueComparisonChart properties={properties} />
        </>
      )}
    </div>
  );
}
