/**
 * UnifiedLeaseDetail
 * ==================
 * Slide-over sheet showing full lease details.
 * Works in both Operations and Valuator contexts.
 * Shows linked/source status in Valuator mode.
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Pencil,
  Calendar,
  DollarSign,
  Building2,
  TrendingUp,
  FileText,
  Link2,
  ArrowRightLeft,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { useLeaseContext } from "./LeaseContextProvider";
import { useToast } from "@/hooks/use-toast";
import { usePushToOperations } from "@/hooks/use-unified-leases";

const fmt = (value: number | string | null | undefined) => {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(num);
};

const fmtDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    return format(parseISO(value), "MM/dd/yyyy");
  } catch {
    return value;
  }
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "-"}</span>
    </div>
  );
}

interface UnifiedLeaseDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease: any | null;
  onEdit?: (lease: any) => void;
}

export function UnifiedLeaseDetail({
  open,
  onOpenChange,
  lease,
  onEdit,
}: UnifiedLeaseDetailProps) {
  const { mode, features } = useLeaseContext();
  const { toast } = useToast();
  const pushToOps = usePushToOperations();

  // Fetch full details including terms, cashflows
  const { data: fullLease } = useQuery({
    queryKey: ["lease-detail-full", lease?.id],
    queryFn: async () => {
      if (!lease?.id) return null;
      return apiRequest(`/api/commercial-leases/leases/${lease.id}`);
    },
    enabled: !!lease?.id && open,
  });

  // Fetch terms
  const { data: terms = [] } = useQuery({
    queryKey: ["lease-terms", lease?.id],
    queryFn: async () => {
      const result = await apiRequest(
        `/api/commercial-leases/leases/${lease.id}/terms`
      );
      return Array.isArray(result) ? result : [];
    },
    enabled: !!lease?.id && open,
  });

  if (!lease) return null;

  const daysUntil = lease.expirationDate
    ? differenceInDays(parseISO(lease.expirationDate), new Date())
    : null;

  const leaseTypeLabels: Record<string, string> = {
    retail: "Retail",
    office: "Office",
    industrial: "Industrial",
    other: "Other",
  };

  const escalationLabels: Record<string, string> = {
    NONE: "None (Flat)",
    PERCENT: "% Annual",
    FIXED_DOLLAR: "$ Step-Up",
    FIXED_PER_SF: "$/SF/Yr Step-Up",
    CPI: "CPI-Based",
  };

  const rentModeLabels: Record<string, string> = {
    PER_SF_YEAR: "$/SF/Year",
    PER_MONTH: "$/Month",
    PER_YEAR: "$/Year",
  };

  const handlePushToOps = () => {
    if (
      confirm(
        "Push changes from this model back to the Operations source lease?"
      )
    ) {
      pushToOps.mutate(lease.id, {
        onSuccess: (result: any) =>
          toast({
            title: "Pushed to Operations",
            description: `Updated ${result.updatedFields.length} field(s)`,
          }),
        onError: (err: any) =>
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          }),
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{lease.tenantName}</SheetTitle>
              <SheetDescription>
                {lease.suite && <span>Suite {lease.suite} • </span>}
                {leaseTypeLabels[lease.leaseType] || lease.leaseType}
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              {features.pushToOps && lease.sourceLeaseId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePushToOps}
                  disabled={pushToOps.isPending}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Push to Ops
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(lease)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Source badge (Valuator mode) */}
          {mode === "valuator" && lease.sourceLeaseId && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded-md">
              <Link2 className="h-4 w-4" />
              Linked to Operations lease — changes can be pushed back
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Square Feet
                  </span>
                </div>
                <div className="text-lg font-bold">
                  {lease.sf
                    ? parseFloat(lease.sf).toLocaleString()
                    : "-"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Monthly Rent
                  </span>
                </div>
                <div className="text-lg font-bold">
                  {lease.monthlyBaseRent ? fmt(lease.monthlyBaseRent) : "-"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Expiration
                  </span>
                </div>
                <div className="text-lg font-bold">
                  {daysUntil !== null && daysUntil <= 90 ? (
                    <span className="text-orange-600">{daysUntil}d</span>
                  ) : (
                    fmtDate(lease.expirationDate)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detail Tabs */}
          <Tabs defaultValue="lease" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <TabsTrigger value="lease">Lease Terms</TabsTrigger>
              <TabsTrigger value="rent">Rent Terms</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="lease" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Basic Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow
                    label="Lease Type"
                    value={
                      leaseTypeLabels[lease.leaseType] || lease.leaseType
                    }
                  />
                  <DetailRow
                    label="Commencement"
                    value={fmtDate(lease.commencementDate)}
                  />
                  <DetailRow
                    label="Expiration"
                    value={fmtDate(lease.expirationDate)}
                  />
                  <DetailRow
                    label="Rent Commencement"
                    value={fmtDate(lease.rentCommencementDate)}
                  />
                  <DetailRow
                    label="Security Deposit"
                    value={fmt(lease.securityDeposit)}
                  />
                  <DetailRow
                    label="Status"
                    value={
                      <Badge
                        variant={lease.active ? "default" : "secondary"}
                      >
                        {lease.active ? "Active" : "Inactive"}
                      </Badge>
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rent" className="mt-4 space-y-4">
              {terms.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Rent Terms ({terms.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Term</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">
                            Base Rent
                          </TableHead>
                          <TableHead>Escalation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {terms.map((term: any, i: number) => (
                          <TableRow key={term.id}>
                            <TableCell>
                              {term.termIndex === 0
                                ? "Initial"
                                : `Option ${term.termIndex}`}
                            </TableCell>
                            <TableCell className="text-xs">
                              {fmtDate(term.startDate)} –{" "}
                              {fmtDate(term.endDate)}
                            </TableCell>
                            <TableCell className="text-right">
                              {term.baseRentValue}{" "}
                              <span className="text-xs text-muted-foreground">
                                {rentModeLabels[term.baseRentMode] ||
                                  term.baseRentMode}
                              </span>
                            </TableCell>
                            <TableCell>
                              {escalationLabels[term.escalationType] ||
                                term.escalationType}
                              {term.escalationType !== "NONE" &&
                                ` (${term.escalationValue})`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p>No rent terms configured</p>
                  <p className="text-xs">
                    Edit this lease to add initial and option terms
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  {lease.notes ? (
                    <p className="text-sm whitespace-pre-wrap">{lease.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No notes</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
