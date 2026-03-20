import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { RefreshCcw, DollarSign, Clock, Wrench } from "lucide-react";

interface TurnRecord {
  id: string;
  unitNumber: string;
  moveOutDate: string;
  targetMoveIn: string;
  daysVacant: number;
  scope: string;
  cost: number;
  status: "in_progress" | "completed" | "pending" | "delayed";
}

interface TurnSummary {
  activeTurns: number;
  averageTurnDays: number;
  totalTurnCostMtd: number;
  averageTurnCost: number;
  turns: TurnRecord[];
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  in_progress: { label: "In Progress", className: "border-blue-500 text-blue-700 bg-blue-50" },
  completed: { label: "Completed", className: "border-green-500 text-green-700 bg-green-50" },
  pending: { label: "Pending", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  delayed: { label: "Delayed", className: "border-red-500 text-red-700 bg-red-50" },
};

const SCOPE_BADGE: Record<string, string> = {
  paint: "bg-blue-50 text-blue-700",
  carpet: "bg-purple-50 text-purple-700",
  full_reno: "bg-orange-50 text-orange-700",
  appliances: "bg-teal-50 text-teal-700",
  standard: "bg-gray-50 text-gray-700",
};

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof RefreshCcw;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className="p-3 rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MultifamilyTurnTracking() {
  const { data, isLoading, isError } = useQuery<TurnSummary>({
    queryKey: ["/api/operations-context/multifamily/turns"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const turns = data?.turns || [];
  const hasData = !isError && data;

  return (
    <div className="p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Active Turns"
          value={hasData ? String(data.activeTurns) : "--"}
          icon={RefreshCcw}
        />
        <SummaryCard
          title="Avg Turn Time"
          value={hasData ? `${data.averageTurnDays} days` : "--"}
          icon={Clock}
        />
        <SummaryCard
          title="Turn Cost MTD"
          value={hasData ? `$${data.totalTurnCostMtd.toLocaleString()}` : "--"}
          icon={DollarSign}
        />
        <SummaryCard
          title="Avg Turn Cost"
          value={hasData ? `$${data.averageTurnCost.toLocaleString()}` : "--"}
          icon={Wrench}
        />
      </div>

      {/* Active turns table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Turns</CardTitle>
          <CardDescription>Track unit turnovers and renovation progress</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!hasData || turns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No turns in progress</p>
              <p className="text-sm mt-1">Turn tracking will appear when units are vacated and being prepared for new tenants.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Move-out Date</TableHead>
                  <TableHead>Target Move-in</TableHead>
                  <TableHead className="text-right">Days Vacant</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turns.map((turn) => {
                  const statusBadge = STATUS_BADGE[turn.status] || STATUS_BADGE.pending;
                  const scopeClass = SCOPE_BADGE[turn.scope.toLowerCase().replace(/\s+/g, "_")] || SCOPE_BADGE.standard;
                  return (
                    <TableRow key={turn.id}>
                      <TableCell className="font-medium">{turn.unitNumber}</TableCell>
                      <TableCell>{turn.moveOutDate}</TableCell>
                      <TableCell>{turn.targetMoveIn}</TableCell>
                      <TableCell className="text-right">
                        <span className={turn.daysVacant > 14 ? "text-red-600 font-semibold" : ""}>
                          {turn.daysVacant}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={scopeClass}>
                          {turn.scope}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${turn.cost.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge.className}>
                          {statusBadge.label}
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
