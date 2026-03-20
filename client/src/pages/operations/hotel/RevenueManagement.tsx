import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Calendar, DollarSign, TrendingUp } from "lucide-react";

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

export default function HotelRevenueManagement() {
  const [selectedSeason, setSelectedSeason] = useState<string>("");

  const { data, isLoading, isError } = useQuery<RevenueManagementData>({
    queryKey: ["/api/hotel-ops/rates"],
    retry: false,
  });

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
          )}
        </CardContent>
      </Card>

      {/* Competitor Rate Comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Competitor Rate Comparison</CardTitle>
              <CardDescription>Compare your rates against local competitors</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-1">
              Competitor rate tracking will be available with rate intelligence integrations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
