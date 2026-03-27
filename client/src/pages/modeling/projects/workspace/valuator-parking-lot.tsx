import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  Car, Plus, Trash2, DollarSign, Edit,
  TrendingUp, Download, Calendar, Sun, Moon,
  Percent, Calculator, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

interface ValuatorParkingLotProps {
  projectId: string;
  projectName: string;
}

interface ParkingRecord {
  id: string;
  txnDate: string;
  rateType: string;
  spacesUsed: number;
  hours: string | null;
  grossRevenue: string;
  dayType: string;
  source: string;
  notes?: string | null;
}

interface ParkingSummary {
  byRateType: Array<{
    rateType: string;
    totalRevenue: number;
    totalSpaces: number;
    transactionCount: number;
  }>;
  byDayType: Array<{
    dayType: string;
    totalRevenue: number;
    transactionCount: number;
  }>;
  totalRevenue: number;
  totalSpaces: number;
  transactionCount: string;
}

const rateTypeLabels: Record<string, string> = {
  HOURLY: "Hourly",
  DAILY: "Daily",
  MONTHLY: "Monthly Pass",
  EVENT: "Event",
};

const dayTypeLabels: Record<string, string> = {
  weekday: "Weekday",
  weekend: "Weekend",
  holiday: "Holiday",
  event: "Event Day",
};

interface ScenarioInputs {
  totalSpaces: number;
  coveredSpaces: number;
  uncoveredSpaces: number;
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  eventRate: number;
  weekdayOccupancy: number;
  weekendOccupancy: number;
  holidayOccupancy: number;
  eventOccupancy: number;
  monthlyPassSpaces: number;
  avgHoursPerVisit: number;
  turnoversPerDayWeekday: number;
  turnoversPerDayWeekend: number;
  weekdaysPerMonth: number;
  weekendsPerMonth: number;
  eventsPerMonth: number;
  annualGrowthRate: number;
  operatingExpensePct: number;
  coveredPremiumPct: number;
  enableHourly: boolean;
  enableDaily: boolean;
  enableMonthly: boolean;
  enableEvent: boolean;
}

const DEFAULT_SCENARIO: ScenarioInputs = {
  totalSpaces: 50,
  coveredSpaces: 10,
  uncoveredSpaces: 40,
  hourlyRate: 5,
  dailyRate: 20,
  monthlyRate: 150,
  eventRate: 40,
  weekdayOccupancy: 60,
  weekendOccupancy: 85,
  holidayOccupancy: 90,
  eventOccupancy: 95,
  monthlyPassSpaces: 10,
  avgHoursPerVisit: 4,
  turnoversPerDayWeekday: 2,
  turnoversPerDayWeekend: 3,
  weekdaysPerMonth: 22,
  weekendsPerMonth: 8,
  eventsPerMonth: 2,
  annualGrowthRate: 3,
  operatingExpensePct: 15,
  coveredPremiumPct: 25,
  enableHourly: true,
  enableDaily: true,
  enableMonthly: true,
  enableEvent: true,
};

function computeRevenue(inputs: ScenarioInputs) {
  const transientSpaces = inputs.totalSpaces - inputs.monthlyPassSpaces;
  const weekdaySpacesUsed = Math.round(transientSpaces * (inputs.weekdayOccupancy / 100));
  const weekendSpacesUsed = Math.round(transientSpaces * (inputs.weekendOccupancy / 100));
  const eventSpacesUsed = Math.round(transientSpaces * (inputs.eventOccupancy / 100));

  const coveredFraction = inputs.totalSpaces > 0 ? inputs.coveredSpaces / inputs.totalSpaces : 0;
  const premiumMultiplier = 1 + (coveredFraction * (inputs.coveredPremiumPct / 100));

  let hourlyRevenue = 0;
  let dailyRevenue = 0;
  let monthlyRevenue = 0;
  let eventRevenue = 0;

  if (inputs.enableHourly) {
    const weekdayHourly = weekdaySpacesUsed * inputs.turnoversPerDayWeekday * inputs.avgHoursPerVisit * inputs.hourlyRate * inputs.weekdaysPerMonth;
    const weekendHourly = weekendSpacesUsed * inputs.turnoversPerDayWeekend * inputs.avgHoursPerVisit * inputs.hourlyRate * inputs.weekendsPerMonth;
    hourlyRevenue = (weekdayHourly + weekendHourly) * premiumMultiplier;
  }

  if (inputs.enableDaily) {
    const weekdayDaily = weekdaySpacesUsed * inputs.dailyRate * inputs.weekdaysPerMonth;
    const weekendDaily = weekendSpacesUsed * inputs.dailyRate * inputs.weekendsPerMonth;
    dailyRevenue = (weekdayDaily + weekendDaily) * premiumMultiplier;
  }

  if (inputs.enableMonthly) {
    monthlyRevenue = inputs.monthlyPassSpaces * inputs.monthlyRate;
  }

  if (inputs.enableEvent) {
    eventRevenue = eventSpacesUsed * inputs.eventRate * inputs.eventsPerMonth * premiumMultiplier;
  }

  const totalMonthly = hourlyRevenue + dailyRevenue + monthlyRevenue + eventRevenue;
  const totalAnnual = totalMonthly * 12;
  const operatingExpenses = totalAnnual * (inputs.operatingExpensePct / 100);
  const noi = totalAnnual - operatingExpenses;

  const projections = Array.from({ length: 5 }, (_, i) => {
    const year = i + 1;
    const growthFactor = Math.pow(1 + inputs.annualGrowthRate / 100, i);
    const yearRevenue = totalAnnual * growthFactor;
    const yearExpenses = yearRevenue * (inputs.operatingExpensePct / 100);
    return {
      year,
      revenue: yearRevenue,
      expenses: yearExpenses,
      noi: yearRevenue - yearExpenses,
    };
  });

  const revenuePerSpace = inputs.totalSpaces > 0 ? totalAnnual / inputs.totalSpaces : 0;
  const blendedOccupancy = inputs.weekdaysPerMonth > 0 && inputs.weekendsPerMonth > 0
    ? (inputs.weekdayOccupancy * inputs.weekdaysPerMonth + inputs.weekendOccupancy * inputs.weekendsPerMonth) / (inputs.weekdaysPerMonth + inputs.weekendsPerMonth)
    : inputs.weekdayOccupancy;

  return {
    hourlyRevenue,
    dailyRevenue,
    monthlyRevenue,
    eventRevenue,
    totalMonthly,
    totalAnnual,
    operatingExpenses,
    noi,
    projections,
    revenuePerSpace,
    blendedOccupancy,
    noiMargin: totalAnnual > 0 ? (noi / totalAnnual) * 100 : 0,
  };
}

export default function ValuatorParkingLotTab({ projectId, projectName }: ValuatorParkingLotProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("calculator");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ParkingRecord | null>(null);
  const [timeframe, setTimeframe] = useState("12m");
  const [scenario, setScenario] = useState<ScenarioInputs>({ ...DEFAULT_SCENARIO });

  const getDateRange = () => {
    const end = new Date();
    const start = subMonths(end, timeframe === "12m" ? 12 : timeframe === "6m" ? 6 : 3);
    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    };
  };

  const dateRange = getDateRange();

  const { data: records = [], isLoading } = useQuery<ParkingRecord[]>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/parking-lot", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/parking-lot?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch parking lot records");
      const data = await res.json();
      return data.data || [];
    },
  });

  const { data: summary } = useQuery<ParkingSummary>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/parking-lot/summary", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/parking-lot/summary?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      return data.data;
    },
  });

  const [formData, setFormData] = useState({
    txnDate: format(new Date(), "yyyy-MM-dd"),
    rateType: "DAILY",
    spacesUsed: "1",
    hours: "",
    grossRevenue: "",
    dayType: "weekday",
    notes: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/operations-context/projects/${projectId}/ops/parking-lot`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId, "ops/parking-lot"] });
      setShowAddDialog(false);
      setFormData({ txnDate: format(new Date(), "yyyy-MM-dd"), rateType: "DAILY", spacesUsed: "1", hours: "", grossRevenue: "", dayType: "weekday", notes: "" });
      toast({ title: "Record added" });
    },
    onError: () => toast({ title: "Failed to add record", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/operations-context/projects/${projectId}/ops/parking-lot/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId, "ops/parking-lot"] });
      setEditingRecord(null);
      toast({ title: "Record updated" });
    },
    onError: () => toast({ title: "Failed to update record", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/operations-context/projects/${projectId}/ops/parking-lot/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId, "ops/parking-lot"] });
      toast({ title: "Record deleted" });
    },
    onError: () => toast({ title: "Failed to delete record", variant: "destructive" }),
  });

  const revenue = useMemo(() => computeRevenue(scenario), [scenario]);

  const updateScenario = (key: keyof ScenarioInputs, value: number | boolean) => {
    setScenario(prev => {
      const next = { ...prev, [key]: value };
      if (key === "totalSpaces") {
        next.uncoveredSpaces = Math.max(0, (value as number) - next.coveredSpaces);
      }
      if (key === "coveredSpaces") {
        next.uncoveredSpaces = Math.max(0, next.totalSpaces - (value as number));
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!formData.grossRevenue || !formData.txnDate) return;
    createMutation.mutate({
      ...formData,
      spacesUsed: parseInt(formData.spacesUsed) || 1,
      hours: formData.hours || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Car className="h-5 w-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Parking Lot</h3>
            <p className="text-sm text-muted-foreground">Revenue modeling & actuals for {projectName}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalRevenue || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">Last {timeframe === "12m" ? "12 months" : timeframe === "6m" ? "6 months" : "3 months"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Car className="h-4 w-4" />
              Total Transactions
            </div>
            <div className="text-2xl font-bold">{summary?.transactionCount || "0"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calculator className="h-4 w-4" />
              Projected Annual
            </div>
            <div className="text-2xl font-bold">{formatCurrency(revenue.totalAnnual)}</div>
            <div className="text-xs text-muted-foreground mt-1">Based on scenario inputs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Projected NOI
            </div>
            <div className="text-2xl font-bold">{formatCurrency(revenue.noi)}</div>
            <div className="text-xs text-muted-foreground mt-1">{revenue.noiMargin.toFixed(1)}% margin</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" />
            Revenue Calculator
          </TabsTrigger>
          <TabsTrigger value="actuals" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Actuals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Space Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Total Spaces</Label>
                      <Input
                        type="number"
                        value={scenario.totalSpaces}
                        onChange={(e) => updateScenario("totalSpaces", parseInt(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Covered</Label>
                      <Input
                        type="number"
                        value={scenario.coveredSpaces}
                        onChange={(e) => updateScenario("coveredSpaces", Math.min(parseInt(e.target.value) || 0, scenario.totalSpaces))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Uncovered</Label>
                      <Input
                        type="number"
                        value={scenario.uncoveredSpaces}
                        readOnly
                        className="mt-1 bg-muted"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Monthly Pass Spaces (Reserved)</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <Slider
                        value={[scenario.monthlyPassSpaces]}
                        onValueChange={([v]) => updateScenario("monthlyPassSpaces", Math.min(v, scenario.totalSpaces))}
                        max={scenario.totalSpaces}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-10 text-right">{scenario.monthlyPassSpaces}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Covered Space Premium</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <Slider
                        value={[scenario.coveredPremiumPct]}
                        onValueChange={([v]) => updateScenario("coveredPremiumPct", v)}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12 text-right">{scenario.coveredPremiumPct}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Rate Structure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Switch checked={scenario.enableHourly} onCheckedChange={(v) => updateScenario("enableHourly", v)} />
                      <Label className="text-sm">Hourly</Label>
                    </div>
                    {scenario.enableHourly && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={scenario.hourlyRate}
                          onChange={(e) => updateScenario("hourlyRate", parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">/hr</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Switch checked={scenario.enableDaily} onCheckedChange={(v) => updateScenario("enableDaily", v)} />
                      <Label className="text-sm">Daily</Label>
                    </div>
                    {scenario.enableDaily && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={scenario.dailyRate}
                          onChange={(e) => updateScenario("dailyRate", parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">/day</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Switch checked={scenario.enableMonthly} onCheckedChange={(v) => updateScenario("enableMonthly", v)} />
                      <Label className="text-sm">Monthly Pass</Label>
                    </div>
                    {scenario.enableMonthly && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={scenario.monthlyRate}
                          onChange={(e) => updateScenario("monthlyRate", parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Switch checked={scenario.enableEvent} onCheckedChange={(v) => updateScenario("enableEvent", v)} />
                      <Label className="text-sm">Event Pricing</Label>
                    </div>
                    {scenario.enableEvent && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={scenario.eventRate}
                          onChange={(e) => updateScenario("eventRate", parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">/event</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Occupancy & Traffic
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs flex items-center gap-1"><Sun className="h-3 w-3" /> Weekday Occupancy</Label>
                        <span className="text-sm font-medium">{scenario.weekdayOccupancy}%</span>
                      </div>
                      <Slider
                        value={[scenario.weekdayOccupancy]}
                        onValueChange={([v]) => updateScenario("weekdayOccupancy", v)}
                        max={100}
                        step={5}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs flex items-center gap-1"><Moon className="h-3 w-3" /> Weekend Occupancy</Label>
                        <span className="text-sm font-medium">{scenario.weekendOccupancy}%</span>
                      </div>
                      <Slider
                        value={[scenario.weekendOccupancy]}
                        onValueChange={([v]) => updateScenario("weekendOccupancy", v)}
                        max={100}
                        step={5}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Event Day Occupancy</Label>
                        <span className="text-sm font-medium">{scenario.eventOccupancy}%</span>
                      </div>
                      <Slider
                        value={[scenario.eventOccupancy]}
                        onValueChange={([v]) => updateScenario("eventOccupancy", v)}
                        max={100}
                        step={5}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs">Turnovers/Day (Wkday)</Label>
                      <Input
                        type="number"
                        value={scenario.turnoversPerDayWeekday}
                        onChange={(e) => updateScenario("turnoversPerDayWeekday", parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Turnovers/Day (Wkend)</Label>
                      <Input
                        type="number"
                        value={scenario.turnoversPerDayWeekend}
                        onChange={(e) => updateScenario("turnoversPerDayWeekend", parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Avg Hours/Visit</Label>
                      <Input
                        type="number"
                        value={scenario.avgHoursPerVisit}
                        onChange={(e) => updateScenario("avgHoursPerVisit", parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Events/Month</Label>
                      <Input
                        type="number"
                        value={scenario.eventsPerMonth}
                        onChange={(e) => updateScenario("eventsPerMonth", parseInt(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Growth & Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Annual Revenue Growth</Label>
                      <span className="text-sm font-medium">{scenario.annualGrowthRate}%</span>
                    </div>
                    <Slider
                      value={[scenario.annualGrowthRate]}
                      onValueChange={([v]) => updateScenario("annualGrowthRate", v)}
                      max={15}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Operating Expense %</Label>
                      <span className="text-sm font-medium">{scenario.operatingExpensePct}%</span>
                    </div>
                    <Slider
                      value={[scenario.operatingExpensePct]}
                      onValueChange={([v]) => updateScenario("operatingExpensePct", v)}
                      max={50}
                      step={1}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Revenue Breakdown</CardTitle>
                  <CardDescription>Monthly projected revenue by rate type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scenario.enableHourly && (
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                        <div>
                          <div className="text-sm font-medium">Hourly Parking</div>
                          <div className="text-xs text-muted-foreground">{scenario.hourlyRate > 0 ? `$${scenario.hourlyRate}/hr × ${scenario.avgHoursPerVisit}h avg` : "Disabled"}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">{formatCurrency(revenue.hourlyRevenue)}/mo</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(revenue.hourlyRevenue * 12)}/yr</div>
                        </div>
                      </div>
                    )}
                    {scenario.enableDaily && (
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                        <div>
                          <div className="text-sm font-medium">Daily Parking</div>
                          <div className="text-xs text-muted-foreground">${scenario.dailyRate}/day</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">{formatCurrency(revenue.dailyRevenue)}/mo</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(revenue.dailyRevenue * 12)}/yr</div>
                        </div>
                      </div>
                    )}
                    {scenario.enableMonthly && (
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                        <div>
                          <div className="text-sm font-medium">Monthly Passes</div>
                          <div className="text-xs text-muted-foreground">{scenario.monthlyPassSpaces} passes × ${scenario.monthlyRate}/mo</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">{formatCurrency(revenue.monthlyRevenue)}/mo</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(revenue.monthlyRevenue * 12)}/yr</div>
                        </div>
                      </div>
                    )}
                    {scenario.enableEvent && (
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                        <div>
                          <div className="text-sm font-medium">Event Parking</div>
                          <div className="text-xs text-muted-foreground">{scenario.eventsPerMonth} events/mo × ${scenario.eventRate}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">{formatCurrency(revenue.eventRevenue)}/mo</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(revenue.eventRevenue * 12)}/yr</div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20 mt-2">
                      <div className="font-semibold">Total</div>
                      <div className="text-right">
                        <div className="font-bold text-lg tabular-nums">{formatCurrency(revenue.totalMonthly)}/mo</div>
                        <div className="text-sm font-medium text-primary">{formatCurrency(revenue.totalAnnual)}/yr</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Key Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground">Revenue/Space/Year</div>
                      <div className="font-semibold tabular-nums">{formatCurrency(revenue.revenuePerSpace)}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground">Blended Occupancy</div>
                      <div className="font-semibold tabular-nums">{revenue.blendedOccupancy.toFixed(1)}%</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground">NOI Margin</div>
                      <div className="font-semibold tabular-nums">{revenue.noiMargin.toFixed(1)}%</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground">Operating Expenses</div>
                      <div className="font-semibold tabular-nums">{formatCurrency(revenue.operatingExpenses)}/yr</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">5-Year Projection</CardTitle>
                  <CardDescription>{scenario.annualGrowthRate}% annual growth</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Expenses</TableHead>
                        <TableHead className="text-right">NOI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenue.projections.map((proj) => (
                        <TableRow key={proj.year}>
                          <TableCell className="font-medium">Year {proj.year}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(proj.revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(proj.expenses)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatCurrency(proj.noi)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="actuals" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="12m">Last 12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Record
            </Button>
          </div>

          {summary && (summary.byRateType?.length > 0 || summary.byDayType?.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4">
              {summary.byRateType?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Revenue by Rate Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summary.byRateType.map((rt) => (
                        <div key={rt.rateType} className="flex items-center justify-between text-sm">
                          <span>{rateTypeLabels[rt.rateType] || rt.rateType}</span>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-xs">{rt.transactionCount} txns</Badge>
                            <span className="font-medium tabular-nums">{formatCurrency(Number(rt.totalRevenue))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {summary.byDayType?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Revenue by Day Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summary.byDayType.map((dt) => (
                        <div key={dt.dayType} className="flex items-center justify-between text-sm">
                          <span>{dayTypeLabels[dt.dayType] || dt.dayType}</span>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-xs">{dt.transactionCount} txns</Badge>
                            <span className="font-medium tabular-nums">{formatCurrency(Number(dt.totalRevenue))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Car className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No parking lot records yet</p>
                <p className="text-sm mt-1">Add individual parking revenue entries to track actuals.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Rate Type</TableHead>
                      <TableHead>Day Type</TableHead>
                      <TableHead className="text-right">Spaces</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{format(new Date(record.txnDate), "MM/dd/yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rateTypeLabels[record.rateType] || record.rateType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{dayTypeLabels[record.dayType] || record.dayType}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{record.spacesUsed}</TableCell>
                        <TableCell className="text-right tabular-nums">{record.hours || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(record.grossRevenue))}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{record.source}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingRecord(record);
                                setFormData({
                                  txnDate: record.txnDate,
                                  rateType: record.rateType,
                                  spacesUsed: String(record.spacesUsed),
                                  hours: record.hours || "",
                                  grossRevenue: record.grossRevenue,
                                  dayType: record.dayType,
                                  notes: record.notes || "",
                                });
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteMutation.mutate(record.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog || !!editingRecord} onOpenChange={(open) => {
        if (!open) { setShowAddDialog(false); setEditingRecord(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Edit Parking Record" : "Add Parking Record"}</DialogTitle>
            <DialogDescription>Record a parking lot revenue entry</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.txnDate}
                  onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Rate Type</Label>
                <Select value={formData.rateType} onValueChange={(v) => setFormData({ ...formData, rateType: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="MONTHLY">Monthly Pass</SelectItem>
                    <SelectItem value="EVENT">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Day Type</Label>
                <Select value={formData.dayType} onValueChange={(v) => setFormData({ ...formData, dayType: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekday">Weekday</SelectItem>
                    <SelectItem value="weekend">Weekend</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="event">Event Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Spaces Used</Label>
                <Input
                  type="number"
                  value={formData.spacesUsed}
                  onChange={(e) => setFormData({ ...formData, spacesUsed: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hours (optional)</Label>
                <Input
                  type="number"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="mt-1"
                  step="0.5"
                />
              </div>
              <div>
                <Label>Gross Revenue ($)</Label>
                <Input
                  type="number"
                  value={formData.grossRevenue}
                  onChange={(e) => setFormData({ ...formData, grossRevenue: e.target.value })}
                  className="mt-1"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingRecord(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingRecord) {
                  updateMutation.mutate({
                    id: editingRecord.id,
                    data: {
                      ...formData,
                      spacesUsed: parseInt(formData.spacesUsed) || 1,
                      hours: formData.hours || null,
                    },
                  });
                } else {
                  handleSubmit();
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingRecord ? "Update" : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
