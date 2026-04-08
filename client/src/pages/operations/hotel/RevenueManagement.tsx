import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Calendar, DollarSign, TrendingUp, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RateCalendarEntry {
  date: string;
  rates: Record<string, number>;
}

interface SeasonalRate {
  id: string;
  season: string;
  startDate: string;
  endDate: string;
  multiplier: number;
}

interface RevenueManagementData {
  rateCalendar: RateCalendarEntry[];
  roomTypes: string[];
  seasonalRates: SeasonalRate[];
}

interface CompetitorRate {
  id: string;
  competitorName: string;
  slipType: string;
  dailyRate: string | null;
  weeklyRate: string | null;
  monthlyRate: string | null;
  notes: string | null;
}

const SLIP_TYPES = ["standard", "premium", "mega", "end-tie", "side-tie", "covered"];

export default function HotelRevenueManagement() {
  const { toast } = useToast();
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [newRow, setNewRow] = useState({ competitorName: "", slipType: "standard", dailyRate: "", weeklyRate: "", monthlyRate: "" });
  const [showAddRow, setShowAddRow] = useState(false);

  const { data, isLoading, isError } = useQuery<RevenueManagementData>({
    queryKey: ["/api/hotel-ops/rates"],
    retry: false,
  });

  const { data: competitorRates = [], isLoading: crLoading } = useQuery<CompetitorRate[]>({
    queryKey: ["/api/hotel-ops/competitor-rates"],
    retry: false,
  });

  const addMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/hotel-ops/competitor-rates", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hotel-ops/competitor-rates"] });
      setNewRow({ competitorName: "", slipType: "standard", dailyRate: "", weeklyRate: "", monthlyRate: "" });
      setShowAddRow(false);
      toast({ title: "Competitor rate added" });
    },
    onError: () => toast({ title: "Failed to add competitor rate", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hotel-ops/competitor-rates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hotel-ops/competitor-rates"] });
      toast({ title: "Entry deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const handleAdd = () => {
    if (!newRow.competitorName.trim()) {
      toast({ title: "Competitor name is required", variant: "destructive" });
      return;
    }
    addMutation.mutate({
      competitorName: newRow.competitorName.trim(),
      slipType: newRow.slipType,
      dailyRate: newRow.dailyRate || null,
      weeklyRate: newRow.weeklyRate || null,
      monthlyRate: newRow.monthlyRate || null,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const rateCalendar = data?.rateCalendar || [];
  const roomTypes = data?.roomTypes || ["Standard", "Deluxe", "Suite", "King"];
  const seasonalRates = data?.seasonalRates || [];
  const hasData = !isError && data;

  return (
    <div className="p-6 space-y-6">
      {/* Rate Calendar Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Rate Calendar</CardTitle>
              <CardDescription>Daily rates by room type</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasData || rateCalendar.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No rate data yet</p>
              <p className="text-sm mt-1">Configure room types and base rates to populate the calendar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Date</TableHead>
                    {roomTypes.map((type) => (
                      <TableHead key={type} className="text-right">{type}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateCalendar.map((entry) => (
                    <TableRow key={entry.date}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {entry.date}
                      </TableCell>
                      {roomTypes.map((type) => (
                        <TableCell key={type} className="text-right">
                          ${(entry.rates[type] || 0).toFixed(2)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seasonal Rate Adjustments */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Seasonal Rate Adjustments</CardTitle>
              <CardDescription>Configure rate multipliers for different seasons</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {seasonalRates.length === 0 ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">No seasonal rates configured. Add rate adjustments below.</p>
              </div>
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Add Seasonal Rate</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label>Season Name</Label>
                    <Input placeholder="e.g., Peak Summer" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input type="date" />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input type="date" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Rate Multiplier</Label>
                    <Input type="number" step="0.1" placeholder="e.g., 1.5" />
                  </div>
                </div>
                <Button>Add Season</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Season</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Multiplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasonalRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.season}</TableCell>
                    <TableCell>{rate.startDate}</TableCell>
                    <TableCell>{rate.endDate}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{rate.multiplier}x</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competitor Rate Comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Competitor Rate Comparison</CardTitle>
                <CardDescription>Compare your rates against local competitors</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowAddRow(true)} disabled={showAddRow}>
              <Plus className="h-4 w-4 mr-1" />
              Add Competitor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {crLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-4">
              {(competitorRates.length > 0 || showAddRow) && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competitor Name</TableHead>
                        <TableHead>Slip Type</TableHead>
                        <TableHead className="text-right">Daily Rate</TableHead>
                        <TableHead className="text-right">Weekly Rate</TableHead>
                        <TableHead className="text-right">Monthly Rate</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hasData && rateCalendar.length > 0 && (
                        <TableRow className="bg-primary/5 border-b-2 border-primary/20">
                          <TableCell className="font-semibold text-primary">Our Marina</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">Base Rate</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {roomTypes.length > 0
                              ? `$${(Object.values(rateCalendar[0].rates).reduce((s, r) => s + r, 0) / Math.max(1, Object.values(rateCalendar[0].rates).length)).toFixed(2)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">—</TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">—</TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                      {competitorRates.map((cr) => (
                        <TableRow key={cr.id}>
                          <TableCell className="font-medium">{cr.competitorName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{cr.slipType}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {cr.dailyRate ? `$${parseFloat(cr.dailyRate).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {cr.weeklyRate ? `$${parseFloat(cr.weeklyRate).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {cr.monthlyRate ? `$${parseFloat(cr.monthlyRate).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteMutation.mutate(cr.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {showAddRow && (
                        <TableRow>
                          <TableCell>
                            <Input
                              className="h-8 text-sm"
                              placeholder="Marina name"
                              value={newRow.competitorName}
                              onChange={(e) => setNewRow({ ...newRow, competitorName: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={newRow.slipType} onValueChange={(v) => setNewRow({ ...newRow, slipType: v })}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SLIP_TYPES.map((s) => (
                                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-sm text-right"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newRow.dailyRate}
                              onChange={(e) => setNewRow({ ...newRow, dailyRate: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-sm text-right"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newRow.weeklyRate}
                              onChange={(e) => setNewRow({ ...newRow, weeklyRate: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-sm text-right"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newRow.monthlyRate}
                              onChange={(e) => setNewRow({ ...newRow, monthlyRate: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" className="h-8" onClick={handleAdd} disabled={addMutation.isPending}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAddRow(false)}>
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              {competitorRates.length === 0 && !showAddRow && (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <p className="text-sm font-medium">No competitor rates added yet</p>
                  <p className="text-xs mt-1">Click "Add Competitor" to start tracking local marina rates.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
