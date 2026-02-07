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
  TableRow,
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
  Shield,
  BarChart3,
  Globe,
  Layers,
  RefreshCw,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import type { CommercialTenant, CommercialTenantRentSchedule } from "@shared/schema";

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatCurrencyPrecise = (value: string | number | null | undefined) => {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  if (isNaN(num)) return "-";
  return `${(num * 100).toFixed(2)}%`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// LABEL MAPS
// ═══════════════════════════════════════════════════════════════════════════════

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

const statusLabels: Record<string, string> = {
  active: "Active",
  pending: "Pending",
  expired: "Expired",
  terminated: "Terminated",
  month_to_month: "Month-to-Month",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  pending: "bg-blue-500",
  expired: "bg-red-500",
  terminated: "bg-gray-500",
  month_to_month: "bg-orange-500",
};

const tenantTypeLabels: Record<string, string> = {
  national: "National",
  regional: "Regional",
  local: "Local",
  mom_pop: "Mom-and-Pop",
};

const assetClassLabels: Record<string, string> = {
  retail: "Retail",
  office: "Office",
  industrial: "Industrial",
  marina: "Marina",
  mixed_use: "Mixed-Use",
  other: "Other",
};

const recoveryLabels: Record<string, string> = {
  nnn: "NNN (Actual)",
  base_year_stop: "Base Year Stop",
  expense_stop: "Expense Stop",
  mod_gross: "Modified Gross",
};

const utilitiesLabels: Record<string, string> = {
  landlord: "Landlord",
  tenant: "Tenant",
  submetered: "Submetered",
};

const optionTypeLabels: Record<string, string> = {
  renewal: "Renewal",
  expansion: "Expansion",
  termination: "Termination",
  rofr: "ROFR",
  rofo: "ROFO",
  other: "Other",
};

const rentResetLabels: Record<string, string> = {
  fixed_pct: "Fixed %",
  fixed_amt: "Fixed $",
  cpi: "CPI",
  fmv: "FMV",
  tbd: "TBD",
};

const tiStructureLabels: Record<string, string> = {
  landlord: "Landlord",
  tenant: "Tenant",
  shared: "Shared",
};

const commissionTypeLabels: Record<string, string> = {
  pct_total_rent: "% of Total Rent",
  pct_base_year: "% of Base Year",
  flat: "Flat Fee",
};

const riskLabels: Record<number, string> = {
  1: "1 — Minimal",
  2: "2 — Low",
  3: "3 — Moderate",
  4: "4 — Elevated",
  5: "5 — High",
};

const riskColors: Record<number, string> = {
  1: "bg-green-500",
  2: "bg-green-400",
  3: "bg-yellow-500",
  4: "bg-orange-500",
  5: "bg-red-500",
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-b-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-right text-sm max-w-[60%]">{value || "-"}</span>
    </div>
  );
}

function BooleanBadge({ value }: { value: boolean | null | undefined }) {
  if (value) {
    return <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Yes</Badge>;
  }
  return <Badge variant="outline"><X className="h-3 w-3 mr-1" /> No</Badge>;
}

function SectionCard({ title, icon, children }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">{children}</CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface TenantDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: CommercialTenant | null;
  onEdit: (tenant: CommercialTenant) => void;
  /** "valuator" shows scenario modeling; "operations" shows review status */
  context?: "operations" | "valuator";
  /** Required for valuator context to fetch full tenant data */
  projectId?: string;
}

export function TenantDetailSheet({
  open,
  onOpenChange,
  tenant,
  onEdit,
  context = "operations",
  projectId,
}: TenantDetailSheetProps) {
  const { data: fullTenant } = useQuery({
    queryKey: ["/api/commercial-tenants", tenant?.id],
    enabled: !!tenant?.id,
  });

  if (!tenant) return null;

  // Merge full data (includes nested relations) with row-level data
  const ft = fullTenant as any;
  const rentSchedule: CommercialTenantRentSchedule[] = ft?.rentSchedule || [];
  const amendments = ft?.amendments || [];
  const scenarios = ft?.scenarios || [];
  const tenantOptions = ft?.tenantOptions || [];
  const isAdvanced = (tenant as any).advancedModeEnabled;

  const daysUntilExpiration = tenant.leaseExpirationDate
    ? differenceInDays(parseISO(tenant.leaseExpirationDate), new Date())
    : null;

  const leaseTermMonths = tenant.leaseCommencementDate && tenant.leaseExpirationDate
    ? Math.round(differenceInDays(
        parseISO(tenant.leaseExpirationDate),
        parseISO(tenant.leaseCommencementDate)
      ) / 30.44)
    : null;

  // Computed financials
  const annualRent = tenant.currentBaseRent ? parseFloat(tenant.currentBaseRent) : 0;
  const sf = tenant.squareFootage ? parseFloat(tenant.squareFootage) : 0;
  const nnnPerSf =
    (parseFloat(tenant.estimatedCamPerSF || "0") || 0) +
    (parseFloat(tenant.estimatedTaxPerSF || "0") || 0) +
    (parseFloat(tenant.estimatedInsurancePerSF || "0") || 0);
  const totalNNN = nnnPerSf * sf;
  const allInAnnual = annualRent + totalNNN;
  const allInPerSf = sf > 0 ? allInAnnual / sf : 0;

  // New fields via type assertion (columns exist on DB, may not be on TS type yet)
  const t = tenant as any;
  const riskRating = t.internalRiskRating ? parseInt(t.internalRiskRating) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[680px] sm:max-w-[680px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{tenant.tenantName}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 flex-wrap">
                {tenant.tradeName && <span>dba {tenant.tradeName}</span>}
                {tenant.tradeName && <span>·</span>}
                <span>Suite {tenant.suiteNumber || "N/A"}</span>
                {t.assetClassTemplate && t.assetClassTemplate !== "other" && (
                  <Badge variant="secondary" className="text-[10px]">
                    {assetClassLabels[t.assetClassTemplate] || t.assetClassTemplate}
                  </Badge>
                )}
                {t.tenantType && (
                  <Badge variant="outline" className="text-[10px]">
                    {tenantTypeLabels[t.tenantType] || t.tenantType}
                  </Badge>
                )}
                {isAdvanced && (
                  <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">
                    Advanced
                  </Badge>
                )}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(tenant)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* ─── KPI Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase">SF</span>
                </div>
                <div className="text-lg font-bold">{sf > 0 ? sf.toLocaleString() : "-"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase">Annual Rent</span>
                </div>
                <div className="text-lg font-bold">{formatCurrency(tenant.currentBaseRent)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase">All-In $/SF</span>
                </div>
                <div className="text-lg font-bold">{allInPerSf > 0 ? formatCurrencyPrecise(allInPerSf) : "-"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase">Expires</span>
                </div>
                <div className="text-lg font-bold">
                  {daysUntilExpiration !== null && daysUntilExpiration < 0 ? (
                    <span className="text-red-600">Expired</span>
                  ) : daysUntilExpiration !== null && daysUntilExpiration <= 90 ? (
                    <span className="text-orange-600">{daysUntilExpiration}d</span>
                  ) : daysUntilExpiration !== null && daysUntilExpiration <= 365 ? (
                    <span className="text-yellow-600">{Math.round(daysUntilExpiration / 30)}mo</span>
                  ) : (
                    formatDate(tenant.leaseExpirationDate)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status + Risk badge row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusColors[tenant.tenantStatus] || "bg-gray-500"}>
              {statusLabels[tenant.tenantStatus] || tenant.tenantStatus}
            </Badge>
            {leaseTermMonths && (
              <span className="text-xs text-muted-foreground">
                {leaseTermMonths} mo ({(leaseTermMonths / 12).toFixed(1)} yr)
              </span>
            )}
            {riskRating && (
              <Badge className={`${riskColors[riskRating] || "bg-gray-500"} ml-auto`}>
                Risk: {riskLabels[riskRating] || riskRating}
              </Badge>
            )}
          </div>

          {/* All-in summary strip */}
          {allInAnnual > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Monthly</span>
                <div className="font-semibold font-mono">{formatCurrency(annualRent / 12)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">NNN/SF</span>
                <div className="font-semibold font-mono">{nnnPerSf > 0 ? formatCurrencyPrecise(nnnPerSf) : "-"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">NNN Total</span>
                <div className="font-semibold font-mono">{formatCurrency(totalNNN)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">All-In Annual</span>
                <div className="font-semibold font-mono text-primary">{formatCurrency(allInAnnual)}</div>
              </div>
            </div>
          )}

          {/* ─── Tabs ───────────────────────────────────────────────── */}
          <Tabs defaultValue="lease" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="lease">Lease</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
              <TabsTrigger value="risk">Risk & TI</TabsTrigger>
            </TabsList>

            {/* ════════════ TAB 1: LEASE TERMS ════════════ */}
            <TabsContent value="lease" className="mt-4 space-y-4">
              <SectionCard title="Tenant Identity" icon={<Building2 className="h-4 w-4" />}>
                <DetailRow label="Legal Name" value={tenant.tenantName} />
                {tenant.tradeName && <DetailRow label="Trade Name (DBA)" value={tenant.tradeName} />}
                {t.tenantType && <DetailRow label="Tenant Type" value={tenantTypeLabels[t.tenantType] || t.tenantType} />}
                {t.industry && <DetailRow label="Industry" value={t.industry} />}
                {t.tenantWebsite && (
                  <DetailRow label="Website" value={
                    <a href={t.tenantWebsite} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {t.tenantWebsite.replace(/^https?:\/\//, "")}
                    </a>
                  } />
                )}
              </SectionCard>

              <SectionCard title="Space Details" icon={<Layers className="h-4 w-4" />}>
                <DetailRow label="Suite / Unit" value={tenant.suiteNumber} />
                <DetailRow label="Square Footage" value={sf > 0 ? sf.toLocaleString() : "-"} />
                <DetailRow label="Pro-Rata Share" value={tenant.proRataShare ? `${parseFloat(tenant.proRataShare).toFixed(2)}%` : "-"} />
                {t.spaceType && <DetailRow label="Space Type" value={t.spaceType} />}
                {t.building && <DetailRow label="Building" value={t.building} />}
                {tenant.parkingSpaces && <DetailRow label="Parking Spaces" value={tenant.parkingSpaces} />}
              </SectionCard>

              <SectionCard title="Dates & Term" icon={<Calendar className="h-4 w-4" />}>
                <DetailRow label="Lease Type" value={leaseTypeLabels[tenant.leaseType] || tenant.leaseType} />
                <DetailRow label="Commencement" value={formatDate(tenant.leaseCommencementDate)} />
                <DetailRow label="Expiration" value={formatDate(tenant.leaseExpirationDate)} />
                <DetailRow label="Rent Start" value={formatDate(tenant.rentStartDate)} />
                {t.possessionDate && <DetailRow label="Possession" value={formatDate(t.possessionDate)} />}
                {tenant.leaseExecutionDate && <DetailRow label="Execution" value={formatDate(tenant.leaseExecutionDate)} />}
                {leaseTermMonths && <DetailRow label="Term" value={`${leaseTermMonths} months (${(leaseTermMonths / 12).toFixed(1)} years)`} />}
              </SectionCard>

              <SectionCard title="Use & Clauses" icon={<FileText className="h-4 w-4" />}>
                <DetailRow label="Permitted Use" value={tenant.permittedUse} />
                {tenant.useRestrictions && <DetailRow label="Restrictions" value={tenant.useRestrictions} />}
                {tenant.exclusiveUseClause && <DetailRow label="Exclusive Use" value={tenant.exclusiveUseClause} />}
                <DetailRow label="Can Go Dark" value={<BooleanBadge value={tenant.canGoDark} />} />
                {tenant.requiredOperatingHours && <DetailRow label="Operating Hours" value={tenant.requiredOperatingHours} />}
                {tenant.signageRights && <DetailRow label="Signage Rights" value={tenant.signageRights} />}
              </SectionCard>

              {(tenant.hasOpeningCoTenancy || tenant.hasOperatingCoTenancy) && (
                <SectionCard title="Co-Tenancy">
                  <DetailRow label="Opening Co-Tenancy" value={<BooleanBadge value={tenant.hasOpeningCoTenancy} />} />
                  {tenant.openingCoTenancyRequirements && <DetailRow label="Opening Requirements" value={tenant.openingCoTenancyRequirements} />}
                  <DetailRow label="Operating Co-Tenancy" value={<BooleanBadge value={tenant.hasOperatingCoTenancy} />} />
                  {tenant.operatingCoTenancyRequirements && <DetailRow label="Operating Requirements" value={tenant.operatingCoTenancyRequirements} />}
                  {tenant.coTenancyRemedies && <DetailRow label="Remedies" value={tenant.coTenancyRemedies} />}
                </SectionCard>
              )}

              {(tenant.contactName || tenant.contactEmail || tenant.contactPhone) && (
                <SectionCard title="Contact">
                  {tenant.contactName && <DetailRow label="Name" value={tenant.contactName} />}
                  {tenant.contactEmail && <DetailRow label="Email" value={tenant.contactEmail} />}
                  {tenant.contactPhone && <DetailRow label="Phone" value={tenant.contactPhone} />}
                </SectionCard>
              )}
            </TabsContent>

            {/* ════════════ TAB 2: FINANCIAL ════════════ */}
            <TabsContent value="financial" className="mt-4 space-y-4">
              <SectionCard title="Base Rent" icon={<DollarSign className="h-4 w-4" />}>
                <DetailRow label="Annual Base Rent" value={formatCurrency(tenant.currentBaseRent)} />
                <DetailRow label="Rent per SF/Year" value={formatCurrencyPrecise(tenant.baseRentPerSF)} />
                <DetailRow label="Monthly Rent" value={formatCurrency(annualRent > 0 ? annualRent / 12 : null)} />
                <DetailRow label="Rent Structure" value={
                  tenant.rentStructure === "base_only" ? "Base Only" :
                  tenant.rentStructure === "base_plus_percentage" ? "Base + Percentage" :
                  tenant.rentStructure === "percentage_only" ? "Percentage Only" :
                  tenant.rentStructure || "-"
                } />
                {t.billingFrequency && t.billingFrequency !== "monthly" && (
                  <DetailRow label="Billing Frequency" value={t.billingFrequency} />
                )}
                {tenant.rentFreePeriodMonths && Number(tenant.rentFreePeriodMonths) > 0 && (
                  <DetailRow label="Rent-Free Period" value={`${tenant.rentFreePeriodMonths} months`} />
                )}
                {t.abatementTiming && t.abatementTiming !== "upfront" && (
                  <DetailRow label="Abatement Timing" value={t.abatementTiming} />
                )}
              </SectionCard>

              <SectionCard title="Escalations" icon={<TrendingUp className="h-4 w-4" />}>
                <DetailRow label="Type" value={escalationTypeLabels[tenant.escalationType || ""] || tenant.escalationType} />
                {tenant.escalationRate && <DetailRow label="Rate" value={formatPercent(tenant.escalationRate)} />}
                {tenant.escalationAmount && <DetailRow label="Dollar Amount" value={formatCurrencyPrecise(tenant.escalationAmount)} />}
                {tenant.escalationFrequency && <DetailRow label="Frequency" value={`Every ${tenant.escalationFrequency} months`} />}
                {tenant.nextEscalationDate && <DetailRow label="Next Escalation" value={formatDate(tenant.nextEscalationDate)} />}
                {tenant.escalationType === "cpi" && (
                  <>
                    {tenant.cpiIndex && <DetailRow label="CPI Index" value={tenant.cpiIndex} />}
                    {(tenant.cpiFloor || tenant.cpiCeiling) && (
                      <DetailRow label="CPI Floor / Cap" value={
                        `${tenant.cpiFloor ? formatPercent(tenant.cpiFloor) : "-"} / ${tenant.cpiCeiling ? formatPercent(tenant.cpiCeiling) : "-"}`
                      } />
                    )}
                  </>
                )}
              </SectionCard>

              {(tenant.securityDeposit || tenant.letterOfCreditAmount || tenant.guarantorName) && (
                <SectionCard title="Security & Guarantees" icon={<Shield className="h-4 w-4" />}>
                  {tenant.securityDeposit && <DetailRow label="Security Deposit" value={formatCurrency(tenant.securityDeposit)} />}
                  {tenant.letterOfCreditAmount && <DetailRow label="Letter of Credit" value={formatCurrency(tenant.letterOfCreditAmount)} />}
                  {tenant.guarantorName && <DetailRow label="Guarantor" value={tenant.guarantorName} />}
                  {tenant.guarantorType && <DetailRow label="Guarantor Type" value={tenant.guarantorType} />}
                </SectionCard>
              )}

              {tenant.percentageRentRate && (
                <SectionCard title="Percentage Rent">
                  <DetailRow label="Rate" value={formatPercent(tenant.percentageRentRate)} />
                  <DetailRow label="Natural Breakpoint" value={formatCurrency(tenant.naturalBreakpoint)} />
                  {tenant.artificialBreakpoint && <DetailRow label="Artificial Breakpoint" value={formatCurrency(tenant.artificialBreakpoint)} />}
                  {t.breakpointType && <DetailRow label="Breakpoint Type" value={t.breakpointType} />}
                  {tenant.salesReportingFrequency && <DetailRow label="Reporting Frequency" value={tenant.salesReportingFrequency} />}
                  {t.trueUpMonth && <DetailRow label="True-Up Month" value={`Month ${t.trueUpMonth}`} />}
                  <DetailRow label="Audit Rights" value={<BooleanBadge value={tenant.auditRights} />} />
                </SectionCard>
              )}

              <SectionCard title="NNN / Operating Expenses">
                {t.recoveryStructure && (
                  <DetailRow label="Recovery Structure" value={recoveryLabels[t.recoveryStructure] || t.recoveryStructure} />
                )}
                <DetailRow label="CAM per SF" value={formatCurrencyPrecise(tenant.estimatedCamPerSF)} />
                <DetailRow label="Tax per SF" value={formatCurrencyPrecise(tenant.estimatedTaxPerSF)} />
                <DetailRow label="Insurance per SF" value={formatCurrencyPrecise(tenant.estimatedInsurancePerSF)} />
                <DetailRow label="Total NNN/SF" value={nnnPerSf > 0 ? formatCurrencyPrecise(nnnPerSf) : "-"} />
                <DetailRow label="Total NNN/Year" value={totalNNN > 0 ? formatCurrency(totalNNN) : formatCurrency(tenant.totalEstimatedNNN)} />
                {tenant.camCapPercent && <DetailRow label="CAM Cap" value={formatPercent(tenant.camCapPercent)} />}
                {t.adminFeePercent && <DetailRow label="Admin Fee" value={formatPercent(t.adminFeePercent)} />}
                {t.reconMonth && <DetailRow label="Reconciliation Month" value={`Month ${t.reconMonth}`} />}
                {t.utilitiesResponsibility && (
                  <DetailRow label="Utilities" value={utilitiesLabels[t.utilitiesResponsibility] || t.utilitiesResponsibility} />
                )}
                {tenant.baseYear && <DetailRow label="Base Year" value={tenant.baseYear} />}
                {tenant.baseYearExpenses && <DetailRow label="Base Year Expenses" value={formatCurrency(tenant.baseYearExpenses)} />}
              </SectionCard>
            </TabsContent>

            {/* ════════════ TAB 3: RENT SCHEDULE ════════════ */}
            <TabsContent value="schedule" className="mt-4 space-y-4">
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
                          <TableHead className="text-right">$/SF</TableHead>
                          <TableHead className="text-right">NNN</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rentSchedule.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">Yr {row.yearNumber}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(row.periodStart)} — {formatDate(row.periodEnd)}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(row.baseRentAnnual)}</TableCell>
                            <TableCell className="text-right">{formatCurrencyPrecise(row.baseRentPerSF)}</TableCell>
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

              {amendments.length > 0 && (
                <SectionCard title="Amendment History" icon={<FileText className="h-4 w-4" />}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Effective</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Summary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {amendments.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.amendmentNumber}</TableCell>
                          <TableCell className="text-xs">{formatDate(a.effectiveDate)}</TableCell>
                          <TableCell className="text-xs">{a.amendmentType || "-"}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{a.summary}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </SectionCard>
              )}

              {scenarios.length > 0 && (
                <SectionCard title="Underwriting Scenarios" icon={<BarChart3 className="h-4 w-4" />}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scenario</TableHead>
                        <TableHead>Case</TableHead>
                        <TableHead className="text-right">Base Rent</TableHead>
                        <TableHead className="text-right">Escalation</TableHead>
                        <TableHead className="text-right">Renewal %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scenarios.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-xs">{s.scenarioName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{s.caseType}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {s.overrideBaseRent ? formatCurrency(s.overrideBaseRent) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {s.overrideEscalationRate ? formatPercent(s.overrideEscalationRate) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {s.renewalProbability ? `${parseFloat(s.renewalProbability).toFixed(0)}%` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </SectionCard>
              )}
            </TabsContent>

            {/* ════════════ TAB 4: OPTIONS ════════════ */}
            <TabsContent value="options" className="mt-4 space-y-4">
              {tenantOptions.length > 0 && (
                <SectionCard title="Lease Options (Detailed)" icon={<RefreshCw className="h-4 w-4" />}>
                  {tenantOptions.map((opt: any, idx: number) => (
                    <div key={opt.id || idx} className="py-3 border-b border-border/50 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {optionTypeLabels[opt.optionType] || opt.optionType}
                          </Badge>
                          {opt.assumeInUnderwriting && (
                            <Badge variant="default" className="text-[10px] bg-blue-500">In UW</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">Option {idx + 1}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                        {opt.noticeMonths && (
                          <div><span className="text-muted-foreground">Notice:</span> {opt.noticeMonths} mo</div>
                        )}
                        {opt.optionTermMonths && (
                          <div><span className="text-muted-foreground">Term:</span> {opt.optionTermMonths} mo</div>
                        )}
                        {opt.rentResetMethod && (
                          <div><span className="text-muted-foreground">Reset:</span> {rentResetLabels[opt.rentResetMethod] || opt.rentResetMethod}</div>
                        )}
                        {opt.rentResetValue && (
                          <div><span className="text-muted-foreground">Value:</span> {opt.rentResetValue}</div>
                        )}
                        {opt.effectiveDate && (
                          <div><span className="text-muted-foreground">Date:</span> {formatDate(opt.effectiveDate)}</div>
                        )}
                      </div>
                      {opt.conditions && (
                        <p className="text-xs text-muted-foreground mt-1">{opt.conditions}</p>
                      )}
                    </div>
                  ))}
                </SectionCard>
              )}

              <SectionCard title="Renewal Options">
                <DetailRow label="Number of Renewals" value={tenant.renewalOptions} />
                <DetailRow label="Renewal Term" value={tenant.renewalTermYears ? `${tenant.renewalTermYears} years` : "-"} />
                <DetailRow label="Notice Period" value={tenant.renewalNoticeMonths ? `${tenant.renewalNoticeMonths} months` : "-"} />
                {tenant.renewalRentTerms && <DetailRow label="Rent Terms" value={tenant.renewalRentTerms} />}
              </SectionCard>

              <SectionCard title="Termination">
                <DetailRow label="Has Termination Option" value={<BooleanBadge value={tenant.hasTerminationOption} />} />
                {tenant.terminationOptionDate && <DetailRow label="Termination Date" value={formatDate(tenant.terminationOptionDate)} />}
                {tenant.terminationFee && <DetailRow label="Fee" value={formatCurrency(tenant.terminationFee)} />}
                {tenant.terminationNoticeMonths && <DetailRow label="Notice Required" value={`${tenant.terminationNoticeMonths} months`} />}
              </SectionCard>

              <SectionCard title="Expansion / ROFR">
                <DetailRow label="Has Expansion Option" value={<BooleanBadge value={tenant.hasExpansionOption} />} />
                {tenant.rofrSquareFootage && <DetailRow label="ROFR SF" value={parseFloat(tenant.rofrSquareFootage).toLocaleString()} />}
                {tenant.expansionNoticeMonths && <DetailRow label="Notice" value={`${tenant.expansionNoticeMonths} months`} />}
              </SectionCard>

              {(tenant.tenantMaintenance?.length || tenant.landlordMaintenance?.length) && (
                <SectionCard title="Maintenance Responsibilities">
                  {tenant.tenantMaintenance?.length > 0 && <DetailRow label="Tenant" value={tenant.tenantMaintenance.join(", ")} />}
                  {tenant.landlordMaintenance?.length > 0 && <DetailRow label="Landlord" value={tenant.landlordMaintenance.join(", ")} />}
                  {tenant.hvacResponsibility && <DetailRow label="HVAC" value={tenant.hvacResponsibility} />}
                </SectionCard>
              )}
            </TabsContent>

            {/* ════════════ TAB 5: RISK & TI ════════════ */}
            <TabsContent value="risk" className="mt-4 space-y-4">
              <SectionCard title="Tenant Improvements" icon={<DollarSign className="h-4 w-4" />}>
                {t.tiStructure && <DetailRow label="TI Structure" value={tiStructureLabels[t.tiStructure] || t.tiStructure} />}
                <DetailRow label="TI Allowance" value={formatCurrency(tenant.tiAllowance)} />
                <DetailRow label="TI per SF" value={formatCurrencyPrecise(tenant.tiAllowancePerSF)} />
                {tenant.tiDeliveryCondition && <DetailRow label="Delivery Condition" value={tenant.tiDeliveryCondition} />}
                {t.amortizeTi && (
                  <>
                    <DetailRow label="Amortized" value={<BooleanBadge value={true} />} />
                    {t.amortizationTermMonths && <DetailRow label="Term" value={`${t.amortizationTermMonths} months`} />}
                    {t.amortizationRate && <DetailRow label="Rate" value={formatPercent(t.amortizationRate)} />}
                  </>
                )}
              </SectionCard>

              {(t.commissionType || t.commissionValue) && (
                <SectionCard title="Leasing Commissions">
                  {t.commissionType && <DetailRow label="Type" value={commissionTypeLabels[t.commissionType] || t.commissionType} />}
                  {t.commissionValue && (
                    <DetailRow label="Value" value={t.commissionType === "flat" ? formatCurrency(t.commissionValue) : `${t.commissionValue}%`} />
                  )}
                  {t.commissionTiming && <DetailRow label="Timing" value={t.commissionTiming} />}
                </SectionCard>
              )}

              <SectionCard title="Risk Assessment" icon={<AlertTriangle className="h-4 w-4" />}>
                <DetailRow label="Risk Rating" value={
                  riskRating ? (
                    <Badge className={riskColors[riskRating] || "bg-gray-500"}>
                      {riskLabels[riskRating] || riskRating}
                    </Badge>
                  ) : "-"
                } />
                {t.assignmentClause !== undefined && <DetailRow label="Assignment Clause" value={<BooleanBadge value={t.assignmentClause} />} />}
                {t.subleaseClause !== undefined && <DetailRow label="Sublease Clause" value={<BooleanBadge value={t.subleaseClause} />} />}
              </SectionCard>

              {(tenant.requiredLiabilityLimit || tenant.requiredPropertyLimit || t.glLimits) && (
                <SectionCard title="Insurance Requirements" icon={<Shield className="h-4 w-4" />}>
                  {t.glLimits && <DetailRow label="GL Limits" value={t.glLimits} />}
                  {tenant.requiredLiabilityLimit && <DetailRow label="Liability Limit" value={formatCurrency(tenant.requiredLiabilityLimit)} />}
                  {tenant.requiredPropertyLimit && <DetailRow label="Property Limit" value={formatCurrency(tenant.requiredPropertyLimit)} />}
                  {t.additionalInsured !== undefined && <DetailRow label="Additional Insured" value={<BooleanBadge value={t.additionalInsured} />} />}
                </SectionCard>
              )}

              {t.underwritingNotes && (
                <SectionCard title="Underwriting Notes">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.underwritingNotes}</p>
                </SectionCard>
              )}

              {(tenant.needsReview || tenant.reviewedAt) && (
                <SectionCard title="Review Status">
                  <DetailRow label="Needs Review" value={<BooleanBadge value={tenant.needsReview} />} />
                  {tenant.reviewedAt && <DetailRow label="Reviewed" value={formatDate(tenant.reviewedAt as any)} />}
                  {tenant.importSource && <DetailRow label="Import Source" value={tenant.importSource} />}
                  {tenant.parseConfidence && <DetailRow label="Parse Confidence" value={`${parseFloat(tenant.parseConfidence).toFixed(0)}%`} />}
                </SectionCard>
              )}
            </TabsContent>
          </Tabs>

          {/* ─── Notes ──────────────────────────────────────────────── */}
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

          {tenant.leaseDocumentId && (
            <div className="text-xs text-muted-foreground">
              Document: {tenant.leaseDocumentId}
              {tenant.originalLeasePageRef && ` · Pages: ${tenant.originalLeasePageRef}`}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}