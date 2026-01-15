import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays, subWeeks, subMonths } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  CalendarIcon, 
  Camera,
  TrendingUp, 
  DollarSign, 
  Building2, 
  Fuel, 
  Store,
  Clock,
  ChevronRight,
  RefreshCw,
  ArrowRightCircle
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface ValuationResult {
  snapshotId?: string;
  isHistorical: boolean;
  asOfDate: string;
  dataAsOfDate: string;
  purchasePrice: number | null;
  indicatedValue: number | null;
  capRate: number | null;
  grossRevenue: number;
  operatingExpenses: number;
  noi: number;
  ebitda: number;
  revenueBreakdown: {
    rentRoll: number;
    fuel: number;
    fuelCogs: number;
    fuelMargin: number;
    shipStore: number;
    shipStoreCogs: number;
    shipStoreMargin: number;
    other: number;
  };
  compSummary: {
    rateSet?: {
      id: string;
      name: string;
      indication: number | null;
      compCount: number;
    };
    salesSet?: {
      id: string;
      name: string;
      indication: number | null;
      compCount: number;
    };
  };
  sources: Array<{
    sourceType: string;
    sourceId: string;
    dataAsOf: string | null;
    revenueContribution: number;
  }>;
}

interface ModelingProject {
  id: string;
  marinaName: string;
  purchasePrice?: string;
  year1CapRate?: string;
  totalStorageUnits?: number;
  city?: string;
  state?: string;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(2)}%`;
};

export default function ValuationTimelinePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const { data: projects, isLoading: projectsLoading } = useQuery<ModelingProject[]>({
    queryKey: ["/api/modeling-projects"],
  });

  const { data: currentValuation, isLoading: valuationLoading } = useQuery<ValuationResult>({
    queryKey: ["/api/valuations/projects", selectedProjectId, "as-of", selectedDate.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/valuations/projects/${selectedProjectId}/as-of?asOfDate=${selectedDate.toISOString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch valuation");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: timeline } = useQuery<ValuationResult[]>({
    queryKey: ["/api/valuations/projects", selectedProjectId, "timeline"],
    queryFn: async () => {
      const startDate = subMonths(new Date(), 6).toISOString();
      const res = await fetch(
        `/api/valuations/projects/${selectedProjectId}/timeline?startDate=${startDate}`
      );
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/valuations/projects/${selectedProjectId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asOfDate: new Date().toISOString(),
          trigger: "manual",
          triggerNote: "Manual snapshot from Valuation Timeline",
        }),
      });
      if (!res.ok) throw new Error("Failed to create snapshot");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Snapshot created", description: "Valuation snapshot saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/valuations/projects", selectedProjectId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const pushToModelingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/valuations/projects/${selectedProjectId}/push-to-modeling`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: "Pushed from Valuation Timeline"
        }),
      });
      if (!res.ok) throw new Error("Failed to push metrics to modeling");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Metrics Pushed", 
        description: "Valuation metrics have been synced to the modeling project" 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling-projects"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const quickDates = [
    { label: "Today", date: new Date() },
    { label: "1 Week Ago", date: subWeeks(new Date(), 1) },
    { label: "2 Weeks Ago", date: subWeeks(new Date(), 2) },
    { label: "1 Month Ago", date: subMonths(new Date(), 1) },
    { label: "3 Months Ago", date: subMonths(new Date(), 3) },
  ];

  const chartData = timeline?.map((v) => ({
    date: format(new Date(v.asOfDate), "MMM d"),
    noi: v.noi,
    indicatedValue: v.indicatedValue,
    grossRevenue: v.grossRevenue,
  })) || [];

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Valuation Timeline</h1>
          <p className="text-muted-foreground">
            Track valuations over time and see how your marina's value has changed
          </p>
        </div>
        {selectedProjectId && (
          <div className="flex gap-2">
            <Button 
              onClick={() => createSnapshotMutation.mutate()}
              disabled={createSnapshotMutation.isPending}
            >
              <Camera className="h-4 w-4 mr-2" />
              {createSnapshotMutation.isPending ? "Saving..." : "Take Snapshot"}
            </Button>
            <Button 
              variant="outline"
              onClick={() => pushToModelingMutation.mutate()}
              disabled={pushToModelingMutation.isPending || !currentValuation}
              title="Sync current valuation metrics to the modeling project"
            >
              <ArrowRightCircle className="h-4 w-4 mr-2" />
              {pushToModelingMutation.isPending ? "Pushing..." : "Push to Modeling"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Select Project</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projectsLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : projects?.length === 0 ? (
                  <SelectItem value="none" disabled>No projects found</SelectItem>
                ) : (
                  projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.marinaName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">View As Of Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {quickDates.map((qd) => (
                <Button
                  key={qd.label}
                  variant={selectedDate.toDateString() === qd.date.toDateString() ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDate(qd.date)}
                >
                  {qd.label}
                </Button>
              ))}
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(selectedDate, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setDatePickerOpen(false);
                      }
                    }}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      </div>

      {!selectedProjectId ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Select a Project</h3>
          <p className="text-muted-foreground">
            Choose a modeling project to view its valuation timeline
          </p>
        </Card>
      ) : valuationLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : currentValuation ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Indicated Value
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(currentValuation.indicatedValue)}
                </div>
                {currentValuation.capRate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Cap Rate: {formatPercent(currentValuation.capRate)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Net Operating Income
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(currentValuation.noi)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  EBITDA: {formatCurrency(currentValuation.ebitda)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Gross Revenue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(currentValuation.grossRevenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  OpEx: {formatCurrency(currentValuation.operatingExpenses)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Data As Of
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {format(new Date(currentValuation.dataAsOfDate), "MMM d, yyyy")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentValuation.isHistorical ? "From Snapshot" : "Live Calculation"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="breakdown" className="w-full">
            <TabsList>
              <TabsTrigger value="breakdown">Revenue Breakdown</TabsTrigger>
              <TabsTrigger value="sources">Data Sources</TabsTrigger>
              <TabsTrigger value="comps">Comp Analysis</TabsTrigger>
              <TabsTrigger value="history">Historical Trend</TabsTrigger>
            </TabsList>

            <TabsContent value="breakdown" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Rent Roll
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">
                      {formatCurrency(currentValuation.revenueBreakdown.rentRoll)}
                    </div>
                    <p className="text-xs text-muted-foreground">Annual slip/storage revenue</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Fuel className="h-4 w-4" />
                      Fuel Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">
                      {formatCurrency(currentValuation.revenueBreakdown.fuel)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Margin: {formatCurrency(currentValuation.revenueBreakdown.fuelMargin)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Ship Store
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">
                      {formatCurrency(currentValuation.revenueBreakdown.shipStore)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Margin: {formatCurrency(currentValuation.revenueBreakdown.shipStoreMargin)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sources" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Data Sources Contributing to Valuation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentValuation.sources.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No data sources available
                      </p>
                    ) : (
                      currentValuation.sources.map((source, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">
                              {source.sourceType.replace("_", " ").toUpperCase()}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {source.dataAsOf
                                ? `As of ${format(new Date(source.dataAsOf), "MMM d, yyyy")}`
                                : "Current data"}
                            </span>
                          </div>
                          <div className="text-right">
                            {source.revenueContribution > 0 && (
                              <span className="font-medium">
                                {formatCurrency(source.revenueContribution)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comps" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Rate Comp Set</CardTitle>
                    <CardDescription>Indicated rates from comparable marinas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {currentValuation.compSummary.rateSet ? (
                      <div className="space-y-2">
                        <p className="font-medium">{currentValuation.compSummary.rateSet.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge>{currentValuation.compSummary.rateSet.compCount} comps</Badge>
                          {currentValuation.compSummary.rateSet.indication && (
                            <span className="font-semibold">
                              {formatCurrency(currentValuation.compSummary.rateSet.indication)}/slip/month
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No rate comp set linked</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Sales Comp Set</CardTitle>
                    <CardDescription>Indicated values from comparable sales</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {currentValuation.compSummary.salesSet ? (
                      <div className="space-y-2">
                        <p className="font-medium">{currentValuation.compSummary.salesSet.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge>{currentValuation.compSummary.salesSet.compCount} comps</Badge>
                          {currentValuation.compSummary.salesSet.indication && (
                            <span className="font-semibold">
                              {formatCurrency(currentValuation.compSummary.salesSet.indication)}/slip
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No sales comp set linked</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Valuation History (Last 6 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis 
                            tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                          />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="indicatedValue"
                            name="Indicated Value"
                            stroke="#2563eb"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="noi"
                            name="NOI"
                            stroke="#16a34a"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-50" />
                      <p>No historical snapshots yet</p>
                      <p className="text-sm">Take snapshots to track valuation over time</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
