import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DollarSign, TrendingUp, Settings } from "lucide-react";

interface RateEntry {
  size: string;
  type: string;
  currentRate: number;
  marketRate: number;
  variance: number;
  unitCount: number;
  occupiedCount: number;
}

interface CompetitorRate {
  competitor: string;
  size: string;
  rate: number;
  distance: string;
}

interface RateManagementData {
  rates: RateEntry[];
  competitorRates: CompetitorRate[];
}

export default function SelfStorageRateManagement() {
  const [adjustmentSize, setAdjustmentSize] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("");

  const { data, isLoading, isError } = useQuery<RateManagementData>({
    queryKey: ["/api/self-storage-ops/rates"],
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

  const rates = data?.rates || [];
  const competitorRates = data?.competitorRates || [];
  const hasData = !isError && data;

  return (
    <div className="p-6 space-y-6">
      {/* Rate table by unit size and type */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Rate Sheet</CardTitle>
              <CardDescription>Current rates by unit size and type</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasData || rates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No rate data yet</p>
              <p className="text-sm mt-1">Add units to automatically populate the rate sheet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Current Rate</TableHead>
                  <TableHead className="text-right">Market Rate</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Occupied</TableHead>
                  <TableHead className="text-right">Occ %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((entry, idx) => {
                  const occPct = entry.unitCount > 0
                    ? ((entry.occupiedCount / entry.unitCount) * 100)
                    : 0;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{entry.size}</TableCell>
                      <TableCell>{entry.type}</TableCell>
                      <TableCell className="text-right">${entry.currentRate.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${entry.marketRate.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={entry.variance < 0 ? "text-red-600" : "text-green-600"}>
                          {entry.variance > 0 ? "+" : ""}{entry.variance.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{entry.unitCount}</TableCell>
                      <TableCell className="text-right">{entry.occupiedCount}</TableCell>
                      <TableCell className="text-right">{occPct.toFixed(0)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competitor rate comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Competitor Rate Comparison</CardTitle>
              <CardDescription>Nearby competitor rates by unit size</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasData || competitorRates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No competitor data yet</p>
              <p className="text-sm mt-1">Competitor rate tracking will populate as data becomes available.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competitor</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Distance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitorRates.map((comp, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{comp.competitor}</TableCell>
                    <TableCell>{comp.size}</TableCell>
                    <TableCell className="text-right">${comp.rate.toFixed(2)}</TableCell>
                    <TableCell>{comp.distance}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rate adjustment form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Rate Adjustment</CardTitle>
              <CardDescription>Adjust rates for selected unit sizes and types</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label>Unit Size</Label>
              <Select value={adjustmentSize} onValueChange={setAdjustmentSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="5x5">5x5</SelectItem>
                  <SelectItem value="5x10">5x10</SelectItem>
                  <SelectItem value="10x10">10x10</SelectItem>
                  <SelectItem value="10x15">10x15</SelectItem>
                  <SelectItem value="10x20">10x20</SelectItem>
                  <SelectItem value="10x30">10x30</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Unit Type</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="climate">Climate Controlled</SelectItem>
                  <SelectItem value="drive_up">Drive-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>New Rate ($)</Label>
              <Input type="number" step="0.01" placeholder="e.g., 125.00" />
            </div>
            <div className="grid gap-2">
              <Label>Effective Date</Label>
              <Input type="date" />
            </div>
          </div>
          <div className="mt-4">
            <Button>Apply Rate Change</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
