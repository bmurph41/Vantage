import { useQuery } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Pencil, 
  Calendar, 
  DollarSign, 
  Building2,
  TrendingUp,
  FileText,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { CommercialTenant, CommercialTenantRentSchedule } from "@shared/schema";

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
};

const formatPercent = (value: string | number | null | undefined) => {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `${(num * 100).toFixed(2)}%`;
};

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "-"}</span>
    </div>
  );
}

function BooleanBadge({ value }: { value: boolean | null | undefined }) {
  if (value) {
    return <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Yes</Badge>;
  }
  return <Badge variant="outline"><X className="h-3 w-3 mr-1" /> No</Badge>;
}

interface TenantDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: CommercialTenant | null;
  onEdit: (tenant: CommercialTenant) => void;
}

export function TenantDetailSheet({ open, onOpenChange, tenant, onEdit }: TenantDetailSheetProps) {
  const { data: fullTenant } = useQuery({
    queryKey: ["/api/commercial-tenants", tenant?.id],
    enabled: !!tenant?.id,
  });

  if (!tenant) return null;

  const daysUntilExpiration = tenant.leaseExpirationDate 
    ? differenceInDays(parseISO(tenant.leaseExpirationDate), new Date())
    : null;

  const leaseTypeLabels: Record<string, string> = {
    nnn: "Triple Net (NNN)",
    modified_gross: "Modified Gross",
    full_service: "Full Service Gross",
    absolute_net: "Absolute Net",
    double_net: "Double Net (NN)",
  };

  const escalationTypeLabels: Record<string, string> = {
    fixed_percent: "Fixed Percentage",
    fixed_dollar: "Fixed Dollar",
    cpi: "CPI-Based",
    fair_market_value: "Fair Market Value",
    none: "None (Flat)",
  };

  const rentSchedule = (fullTenant as any)?.rentSchedule as CommercialTenantRentSchedule[] || [];
  const amendments = (fullTenant as any)?.amendments || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{tenant.tenantName}</SheetTitle>
              <SheetDescription>
                {tenant.tradeName && <span>dba {tenant.tradeName} • </span>}
                Suite {tenant.suiteNumber || "N/A"}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(tenant)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Square Feet</span>
                </div>
                <div className="text-lg font-bold">
                  {tenant.squareFootage ? parseFloat(tenant.squareFootage).toLocaleString() : "-"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Annual Rent</span>
                </div>
                <div className="text-lg font-bold">{formatCurrency(tenant.currentBaseRent)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Expiration</span>
                </div>
                <div className="text-lg font-bold">
                  {daysUntilExpiration !== null && daysUntilExpiration <= 90 ? (
                    <span className="text-orange-600">{daysUntilExpiration}d</span>
                  ) : (
                    formatDate(tenant.leaseExpirationDate)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="lease" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="lease">Lease Terms</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="schedule">Rent Schedule</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
            </TabsList>

            <TabsContent value="lease" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Basic Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Lease Type" value={leaseTypeLabels[tenant.leaseType] || tenant.leaseType} />
                  <DetailRow label="Commencement Date" value={formatDate(tenant.leaseCommencementDate)} />
                  <DetailRow label="Expiration Date" value={formatDate(tenant.leaseExpirationDate)} />
                  <DetailRow label="Rent Start Date" value={formatDate(tenant.rentStartDate)} />
                  <DetailRow label="Pro-Rata Share" value={tenant.proRataShare ? `${parseFloat(tenant.proRataShare).toFixed(2)}%` : "-"} />
                  <DetailRow label="Permitted Use" value={tenant.permittedUse} />
                </CardContent>
              </Card>

              {tenant.securityDeposit && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Security</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <DetailRow label="Security Deposit" value={formatCurrency(tenant.securityDeposit)} />
                    <DetailRow label="Letter of Credit" value={formatCurrency(tenant.letterOfCreditAmount)} />
                    <DetailRow label="Guarantor" value={tenant.guarantorName} />
                    <DetailRow label="Guarantor Type" value={tenant.guarantorType} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="financial" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Base Rent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Annual Base Rent" value={formatCurrency(tenant.currentBaseRent)} />
                  <DetailRow label="Rent per SF/Year" value={formatCurrency(tenant.baseRentPerSF)} />
                  <DetailRow label="Monthly Rent" value={formatCurrency(tenant.currentBaseRent ? parseFloat(tenant.currentBaseRent) / 12 : null)} />
                  <DetailRow label="Rent-Free Period" value={tenant.rentFreePeriodMonths ? `${tenant.rentFreePeriodMonths} months` : "-"} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Escalations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Escalation Type" value={escalationTypeLabels[tenant.escalationType || ''] || tenant.escalationType} />
                  <DetailRow label="Escalation Rate" value={tenant.escalationRate ? `${(parseFloat(tenant.escalationRate) * 100).toFixed(2)}%` : "-"} />
                  <DetailRow label="Escalation Amount" value={formatCurrency(tenant.escalationAmount)} />
                  <DetailRow label="CPI Index" value={tenant.cpiIndex} />
                  <DetailRow label="CPI Floor/Ceiling" value={tenant.cpiFloor && tenant.cpiCeiling ? `${(parseFloat(tenant.cpiFloor) * 100).toFixed(1)}% - ${(parseFloat(tenant.cpiCeiling) * 100).toFixed(1)}%` : "-"} />
                </CardContent>
              </Card>

              {tenant.percentageRentRate && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Percentage Rent</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <DetailRow label="Percentage Rate" value={`${(parseFloat(tenant.percentageRentRate) * 100).toFixed(2)}%`} />
                    <DetailRow label="Natural Breakpoint" value={formatCurrency(tenant.naturalBreakpoint)} />
                    <DetailRow label="Artificial Breakpoint" value={formatCurrency(tenant.artificialBreakpoint)} />
                    <DetailRow label="Reporting Frequency" value={tenant.salesReportingFrequency} />
                    <DetailRow label="Audit Rights" value={<BooleanBadge value={tenant.auditRights} />} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">NNN / Operating Expenses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="CAM per SF" value={formatCurrency(tenant.estimatedCamPerSF)} />
                  <DetailRow label="Tax per SF" value={formatCurrency(tenant.estimatedTaxPerSF)} />
                  <DetailRow label="Insurance per SF" value={formatCurrency(tenant.estimatedInsurancePerSF)} />
                  <DetailRow label="Total NNN/Year" value={formatCurrency(tenant.totalEstimatedNNN)} />
                  <DetailRow label="CAM Cap" value={tenant.camCapPercent ? `${(parseFloat(tenant.camCapPercent) * 100).toFixed(1)}%` : "-"} />
                  <DetailRow label="Base Year" value={tenant.baseYear} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Projected Rent Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rentSchedule.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Base Rent</TableHead>
                          <TableHead className="text-right">NNN</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rentSchedule.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>Year {row.yearNumber}</TableCell>
                            <TableCell className="text-xs">
                              {formatDate(row.periodStart)} - {formatDate(row.periodEnd)}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(row.baseRentAnnual)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.estimatedNNNAnnual)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.totalRentAnnual)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2" />
                      <p>No rent schedule generated</p>
                      <p className="text-xs">Add base rent and lease dates to auto-generate</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="options" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Renewal Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Number of Renewals" value={tenant.renewalOptions} />
                  <DetailRow label="Renewal Term" value={tenant.renewalTermYears ? `${tenant.renewalTermYears} years` : "-"} />
                  <DetailRow label="Notice Period" value={tenant.renewalNoticeMonths ? `${tenant.renewalNoticeMonths} months` : "-"} />
                  <DetailRow label="Renewal Rent Terms" value={tenant.renewalRentTerms} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Termination Rights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Has Termination Option" value={<BooleanBadge value={tenant.hasTerminationOption} />} />
                  <DetailRow label="Termination Date" value={formatDate(tenant.terminationOptionDate)} />
                  <DetailRow label="Termination Fee" value={formatCurrency(tenant.terminationFee)} />
                  <DetailRow label="Notice Required" value={tenant.terminationNoticeMonths ? `${tenant.terminationNoticeMonths} months` : "-"} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Expansion / ROFR</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Has Expansion Option" value={<BooleanBadge value={tenant.hasExpansionOption} />} />
                  <DetailRow label="ROFR Square Footage" value={tenant.rofrSquareFootage ? parseFloat(tenant.rofrSquareFootage).toLocaleString() : "-"} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Co-Tenancy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Opening Co-Tenancy" value={<BooleanBadge value={tenant.hasOpeningCoTenancy} />} />
                  <DetailRow label="Opening Requirements" value={tenant.openingCoTenancyRequirements} />
                  <DetailRow label="Operating Co-Tenancy" value={<BooleanBadge value={tenant.hasOperatingCoTenancy} />} />
                  <DetailRow label="Operating Requirements" value={tenant.operatingCoTenancyRequirements} />
                  <DetailRow label="Remedies" value={tenant.coTenancyRemedies} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Operating Requirements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Operating Hours" value={tenant.requiredOperatingHours} />
                  <DetailRow label="Can Go Dark" value={<BooleanBadge value={tenant.canGoDark} />} />
                  <DetailRow label="Exclusive Use" value={tenant.exclusiveUseClause} />
                  <DetailRow label="Signage Rights" value={tenant.signageRights} />
                  <DetailRow label="Parking Spaces" value={tenant.parkingSpaces} />
                </CardContent>
              </Card>

              {(tenant.tiAllowance || tenant.tiAllowancePerSF) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">TI Allowance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <DetailRow label="TI Allowance" value={formatCurrency(tenant.tiAllowance)} />
                    <DetailRow label="TI per SF" value={formatCurrency(tenant.tiAllowancePerSF)} />
                    <DetailRow label="Delivery Condition" value={tenant.tiDeliveryCondition} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {tenant.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tenant.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
