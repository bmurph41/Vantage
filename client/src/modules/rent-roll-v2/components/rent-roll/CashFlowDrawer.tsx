import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, startOfYear, endOfYear, addYears } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  Settings,
} from "lucide-react";

// Types
interface CashFlowPeriod {
  periodId: string;
  periodDate: string;
  year: number;
  month: number;
  label: string;
  charges: ChargeLineItem[];
  totalAmount: number;
}

interface ChargeLineItem {
  chargeId: string;
  chargeType: string;
  chargeName: string;
  basisType: string;
  baseAmount: number;
  calculatedAmount: number;
  boatLength?: number;
  proRataFactor: number;
  isPartialPeriod: boolean;
  daysInPeriod: number;
  seasonApplied: boolean;
  escalationApplied: boolean;
  escalationAmount?: number;
}

interface CashFlowSummary {
  leaseId: string;
  tenantName: string;
  vesselName?: string;
  boatLength?: number;
  leaseStart: string;
  leaseEnd?: string;
  periods: CashFlowPeriod[];
  totalProjectedRevenue: number;
  annualizedRevenue: number;
  chargeTypeSummary: Record<string, number>;
}

interface ContractCharge {
  id: string;
  leaseId: string;
  chargeType: string;
  chargeName: string | null;
  basisType: string;
  amount: string;
  frequency: string;
  seasonStartMonth: number | null;
  seasonEndMonth: number | null;
  chargeStartDate: string | null;
  chargeEndDate: string | null;
  escalationMethod: string | null;
  escalationValue: string | null;
  escalationStartDate: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

interface CashFlowDrawerProps {
  open: boolean;
  onClose: () => void;
  leaseId: string | null;
  tenantName?: string;
  boatLength?: number;
}

const CHARGE_TYPES = [
  { value: "slip_rent", label: "Slip Rent" },
  { value: "rack_rent", label: "Rack Rent" },
  { value: "storage_rent", label: "Storage Rent" },
  { value: "liveaboard_fee", label: "Liveaboard Fee" },
  { value: "electric", label: "Electric" },
  { value: "water", label: "Water" },
  { value: "parking", label: "Parking" },
  { value: "wifi", label: "WiFi" },
  { value: "pump_out", label: "Pump Out" },
  { value: "transient_fee", label: "Transient Fee" },
  { value: "other", label: "Other" },
];

const BASIS_TYPES = [
  { value: "per_ft_per_month", label: "Per Foot/Month" },
  { value: "per_ft_per_year", label: "Per Foot/Year" },
  { value: "per_month", label: "Per Month (Flat)" },
  { value: "per_year", label: "Per Year (Flat)" },
  { value: "per_day", label: "Per Day" },
  { value: "per_season", label: "Per Season" },
];

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
  { value: "seasonal", label: "Seasonal" },
  { value: "daily", label: "Daily" },
  { value: "one_time", label: "One-Time" },
];

const ESCALATION_METHODS = [
  { value: "none", label: "No Escalation" },
  { value: "fixed_step", label: "Fixed Step (% per year)" },
  { value: "index_linked", label: "Index Linked (CPI)" },
];

const MONTHS = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CashFlowDrawer({ 
  open, 
  onClose, 
  leaseId, 
  tenantName,
  boatLength 
}: CashFlowDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("projection");
  const [yearsToProject, setYearsToProject] = useState(1);
  const [includeEscalation, setIncludeEscalation] = useState(true);
  const [addChargeOpen, setAddChargeOpen] = useState(false);
  const [chargesExpanded, setChargesExpanded] = useState(true);

  // New charge form state
  const [newCharge, setNewCharge] = useState({
    chargeType: "slip_rent",
    chargeName: "",
    basisType: "per_month",
    amount: "",
    frequency: "monthly",
    seasonStartMonth: null as number | null,
    seasonEndMonth: null as number | null,
    chargeStartDate: "",
    chargeEndDate: "",
    escalationMethod: "none",
    escalationValue: "",
    escalationStartDate: "",
    notes: "",
  });

  // Fetch contract charges
  const { data: charges = [], isLoading: chargesLoading } = useQuery<ContractCharge[]>({
    queryKey: ["/api/rent-roll/leases", leaseId, "charges"],
    queryFn: () => fetch(`/api/rent-roll/leases/${leaseId}/charges`).then(r => r.json()),
    enabled: !!leaseId && open,
  });

  // Fetch cash flow projection
  const { data: cashFlow, isLoading: cashFlowLoading, refetch: refetchCashFlow } = useQuery<CashFlowSummary>({
    queryKey: ["/api/rent-roll/leases", leaseId, "cash-flow", yearsToProject, includeEscalation],
    queryFn: () => fetch(
      `/api/rent-roll/leases/${leaseId}/cash-flow?yearsToProject=${yearsToProject}&includeEscalation=${includeEscalation}`
    ).then(r => r.json()),
    enabled: !!leaseId && open,
  });

  // Create charge mutation
  const createChargeMutation = useMutation({
    mutationFn: async (data: typeof newCharge) => {
      const payload = {
        ...data,
        amount: parseFloat(data.amount) || 0,
        escalationValue: data.escalationValue ? parseFloat(data.escalationValue) : undefined,
        seasonStartMonth: data.seasonStartMonth,
        seasonEndMonth: data.seasonEndMonth,
        chargeStartDate: data.chargeStartDate || undefined,
        chargeEndDate: data.chargeEndDate || undefined,
        escalationStartDate: data.escalationStartDate || undefined,
      };
      const res = await apiRequest("POST", `/api/rent-roll/leases/${leaseId}/charges`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases", leaseId, "charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases", leaseId, "cash-flow"] });
      toast({ title: "Charge added", description: "The contract charge has been created." });
      setAddChargeOpen(false);
      resetNewCharge();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create charge.", variant: "destructive" });
    },
  });

  // Delete charge mutation
  const deleteChargeMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      await apiRequest("DELETE", `/api/rent-roll/charges/${chargeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases", leaseId, "charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases", leaseId, "cash-flow"] });
      toast({ title: "Charge deleted", description: "The contract charge has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete charge.", variant: "destructive" });
    },
  });

  const resetNewCharge = () => {
    setNewCharge({
      chargeType: "slip_rent",
      chargeName: "",
      basisType: "per_month",
      amount: "",
      frequency: "monthly",
      seasonStartMonth: null,
      seasonEndMonth: null,
      chargeStartDate: "",
      chargeEndDate: "",
      escalationMethod: "none",
      escalationValue: "",
      escalationStartDate: "",
      notes: "",
    });
  };

  // Prepare chart data
  const chartData = cashFlow?.periods.map(period => ({
    name: period.label,
    revenue: period.totalAmount,
    ...period.charges.reduce((acc, charge) => {
      acc[charge.chargeType] = (acc[charge.chargeType] || 0) + charge.calculatedAmount;
      return acc;
    }, {} as Record<string, number>),
  })) || [];

  // Get unique charge types for chart legend
  const uniqueChargeTypes = Array.from(
    new Set(cashFlow?.periods.flatMap(p => p.charges.map(c => c.chargeType)) || [])
  );

  // Chart colors
  const CHART_COLORS = [
    "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8",
    "#82ca9d", "#ffc658", "#ff7300", "#a4de6c", "#d0ed57",
  ];

  const isLoading = chargesLoading || cashFlowLoading;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Cash Flow Projection
          </SheetTitle>
          <SheetDescription>
            {tenantName && `${tenantName} • `}
            {boatLength && `${boatLength} ft • `}
            View and manage contract charges and projected revenue
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projection" data-testid="tab-projection">Projection</TabsTrigger>
            <TabsTrigger value="charges" data-testid="tab-charges">
              Charges ({charges.length})
            </TabsTrigger>
            <TabsTrigger value="breakdown" data-testid="tab-breakdown">Breakdown</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Projection Tab */}
            <TabsContent value="projection" className="m-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : cashFlow ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Total Projected</div>
                        <div className="text-2xl font-bold tabular-nums" data-testid="text-total-projected">
                          {formatCurrency(cashFlow.totalProjectedRevenue)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Annualized</div>
                        <div className="text-2xl font-bold tabular-nums" data-testid="text-annualized">
                          {formatCurrency(cashFlow.annualizedRevenue)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Periods</div>
                        <div className="text-2xl font-bold tabular-nums" data-testid="text-periods">
                          {cashFlow.periods.length}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Projection Controls */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Projection Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="yearsToProject" className="text-sm whitespace-nowrap">
                            Years:
                          </Label>
                          <Select
                            value={yearsToProject.toString()}
                            onValueChange={(v) => setYearsToProject(parseInt(v))}
                          >
                            <SelectTrigger className="w-20" id="yearsToProject" data-testid="select-years">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="includeEscalation"
                            checked={includeEscalation}
                            onChange={(e) => setIncludeEscalation(e.target.checked)}
                            className="rounded"
                            data-testid="checkbox-escalation"
                          />
                          <Label htmlFor="includeEscalation" className="text-sm">
                            Include Escalation
                          </Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Chart */}
                  {chartData.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis 
                                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                tick={{ fontSize: 10 }}
                              />
                              <Tooltip 
                                formatter={(value: number) => formatCurrencyPrecise(value)}
                              />
                              <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#0088FE"
                                fill="#0088FE"
                                fillOpacity={0.3}
                                name="Total Revenue"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* No charges warning */}
                  {charges.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center text-center space-y-2">
                          <AlertCircle className="h-8 w-8 text-muted-foreground" />
                          <div className="text-sm text-muted-foreground">
                            No contract charges defined. Add charges to generate a cash flow projection.
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveTab("charges");
                              setAddChargeOpen(true);
                            }}
                            data-testid="button-add-first-charge"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add First Charge
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No cash flow data available
                </div>
              )}
            </TabsContent>

            {/* Charges Tab */}
            <TabsContent value="charges" className="m-0">
              <div className="space-y-4">
                {/* Add Charge Button */}
                <div className="flex justify-end">
                  <Dialog open={addChargeOpen} onOpenChange={setAddChargeOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-add-charge">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Charge
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add Contract Charge</DialogTitle>
                        <DialogDescription>
                          Define a new pricing component for this lease
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Charge Type & Name */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Charge Type</Label>
                            <Select
                              value={newCharge.chargeType}
                              onValueChange={(v) => setNewCharge(prev => ({ ...prev, chargeType: v }))}
                            >
                              <SelectTrigger data-testid="select-charge-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CHARGE_TYPES.map(t => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Custom Name (Optional)</Label>
                            <Input
                              value={newCharge.chargeName}
                              onChange={(e) => setNewCharge(prev => ({ ...prev, chargeName: e.target.value }))}
                              placeholder="e.g., Winter Slip Rent"
                              data-testid="input-charge-name"
                            />
                          </div>
                        </div>

                        {/* Basis Type & Amount */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Pricing Basis</Label>
                            <Select
                              value={newCharge.basisType}
                              onValueChange={(v) => setNewCharge(prev => ({ ...prev, basisType: v }))}
                            >
                              <SelectTrigger data-testid="select-basis-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {BASIS_TYPES.map(t => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Amount ($)</Label>
                            <Input
                              type="number"
                              value={newCharge.amount}
                              onChange={(e) => setNewCharge(prev => ({ ...prev, amount: e.target.value }))}
                              placeholder="0.00"
                              data-testid="input-amount"
                            />
                          </div>
                        </div>

                        {/* Seasonal Settings */}
                        <div className="space-y-2">
                          <Label>Season (Optional)</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <Select
                              value={newCharge.seasonStartMonth?.toString() || "none"}
                              onValueChange={(v) => setNewCharge(prev => ({ 
                                ...prev, 
                                seasonStartMonth: v === "none" ? null : parseInt(v)
                              }))}
                            >
                              <SelectTrigger data-testid="select-season-start">
                                <SelectValue placeholder="Start Month" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Season</SelectItem>
                                {MONTHS.map(m => (
                                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={newCharge.seasonEndMonth?.toString() || "none"}
                              onValueChange={(v) => setNewCharge(prev => ({ 
                                ...prev, 
                                seasonEndMonth: v === "none" ? null : parseInt(v)
                              }))}
                            >
                              <SelectTrigger data-testid="select-season-end">
                                <SelectValue placeholder="End Month" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Season</SelectItem>
                                {MONTHS.map(m => (
                                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Escalation */}
                        <div className="space-y-2">
                          <Label>Escalation</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <Select
                              value={newCharge.escalationMethod}
                              onValueChange={(v) => setNewCharge(prev => ({ ...prev, escalationMethod: v }))}
                            >
                              <SelectTrigger data-testid="select-escalation">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ESCALATION_METHODS.map(m => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {newCharge.escalationMethod !== "none" && (
                              <Input
                                type="number"
                                value={newCharge.escalationValue}
                                onChange={(e) => setNewCharge(prev => ({ ...prev, escalationValue: e.target.value }))}
                                placeholder="% per year"
                                data-testid="input-escalation-value"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddChargeOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createChargeMutation.mutate(newCharge)}
                          disabled={!newCharge.amount || createChargeMutation.isPending}
                          data-testid="button-save-charge"
                        >
                          {createChargeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Charge
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Charges List */}
                {chargesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : charges.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground py-4">
                        No charges defined yet
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {charges.map((charge) => (
                      <Card key={charge.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {charge.chargeName || CHARGE_TYPES.find(t => t.value === charge.chargeType)?.label}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {BASIS_TYPES.find(b => b.value === charge.basisType)?.label}
                                </Badge>
                                {charge.seasonStartMonth !== null && (
                                  <Badge variant="secondary" className="text-xs">
                                    Seasonal
                                  </Badge>
                                )}
                                {charge.escalationMethod && charge.escalationMethod !== "none" && (
                                  <Badge variant="secondary" className="text-xs">
                                    {charge.escalationValue}% Escalation
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatCurrencyPrecise(parseFloat(charge.amount))}
                                {charge.seasonStartMonth !== null && charge.seasonEndMonth !== null && (
                                  <span className="ml-2">
                                    ({MONTHS[charge.seasonStartMonth]?.label} - {MONTHS[charge.seasonEndMonth]?.label})
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => deleteChargeMutation.mutate(charge.id)}
                              disabled={deleteChargeMutation.isPending}
                              data-testid={`button-delete-charge-${charge.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Breakdown Tab */}
            <TabsContent value="breakdown" className="m-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : cashFlow && cashFlow.periods.length > 0 ? (
                <div className="space-y-4">
                  {/* Charge Type Summary */}
                  {Object.keys(cashFlow.chargeTypeSummary).length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">By Charge Type</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(cashFlow.chargeTypeSummary).map(([type, amount]) => (
                            <div key={type} className="flex items-center justify-between">
                              <span className="text-sm">
                                {CHARGE_TYPES.find(t => t.value === type)?.label || type}
                              </span>
                              <span className="font-medium tabular-nums">
                                {formatCurrency(amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Monthly Breakdown Table */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Monthly Detail</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Charges</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cashFlow.periods.map((period) => (
                            <TableRow key={period.periodId}>
                              <TableCell className="font-medium">{period.label}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrencyPrecise(period.totalAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {period.charges.length}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No breakdown data available
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
