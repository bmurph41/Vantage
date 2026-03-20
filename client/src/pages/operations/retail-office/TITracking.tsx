import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Wrench, DollarSign } from "lucide-react";

interface TIRecord {
  id: string;
  tenant: string;
  suite: string;
  tiAllowance: number;
  amountDrawn: number;
  remaining: number;
  drawSchedule: string;
  status: "active" | "fully_drawn" | "expired";
}

interface TISummary {
  totalAllowance: number;
  totalDrawn: number;
  totalRemaining: number;
  records: TIRecord[];
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "border-green-500 text-green-700 bg-green-50" },
  fully_drawn: { label: "Fully Drawn", className: "border-blue-500 text-blue-700 bg-blue-50" },
  expired: { label: "Expired", className: "border-gray-500 text-gray-700 bg-gray-50" },
};

export default function RetailOfficeTITracking() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError } = useQuery<TISummary>({
    queryKey: ["/api/operations-context/retail-office/ti-tracking"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const records = data?.records || [];
  const hasData = !isError && data;

  return (
    <div className="p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total TI Allowance</p>
                <p className="text-2xl font-bold mt-1">
                  {hasData ? `$${data.totalAllowance.toLocaleString()}` : "--"}
                </p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Drawn</p>
                <p className="text-2xl font-bold mt-1">
                  {hasData ? `$${data.totalDrawn.toLocaleString()}` : "--"}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            {hasData && data.totalAllowance > 0 && (
              <Progress
                value={(data.totalDrawn / data.totalAllowance) * 100}
                className="mt-3 h-2"
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold mt-1">
                  {hasData ? `$${data.totalRemaining.toLocaleString()}` : "--"}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add TI button */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add TI Allowance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add TI Allowance</DialogTitle>
              <DialogDescription>Track a new tenant improvement allowance.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tiTenant">Tenant</Label>
                <Input id="tiTenant" placeholder="e.g., Acme Corp" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tiSuite">Suite</Label>
                <Input id="tiSuite" placeholder="e.g., Suite 200" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tiAllowance">TI Allowance ($)</Label>
                <Input id="tiAllowance" type="number" placeholder="e.g., 50000" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tiDrawSchedule">Draw Schedule</Label>
                <Input id="tiDrawSchedule" placeholder="e.g., Monthly, upon completion" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Add TI Allowance</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* TI tracking table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Improvement Allowances</CardTitle>
          <CardDescription>Track TI allowances, draws, and remaining balances</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!hasData || records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No TI allowances yet</p>
              <p className="text-sm mt-1">Add tenant improvement allowances to start tracking draws and balances.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Suite</TableHead>
                  <TableHead className="text-right">TI Allowance</TableHead>
                  <TableHead className="text-right">Amount Drawn</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Draw Schedule</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const badge = STATUS_BADGE[record.status] || STATUS_BADGE.active;
                  const pct = record.tiAllowance > 0 ? (record.amountDrawn / record.tiAllowance) * 100 : 0;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.tenant}</TableCell>
                      <TableCell>{record.suite}</TableCell>
                      <TableCell className="text-right">${record.tiAllowance.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${record.amountDrawn.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${record.remaining.toLocaleString()}</TableCell>
                      <TableCell>{record.drawSchedule}</TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={pct} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
