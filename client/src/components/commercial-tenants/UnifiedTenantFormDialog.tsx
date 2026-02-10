import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  DollarSign,
  Plus,
  Trash2,
  BarChart3,
  Shield,
  ChevronDown,
  Info,
  Building2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const LEASE_TYPE_OPTIONS = [
  { value: "NNN", label: "Triple Net (NNN)" },
  { value: "MOD_GROSS", label: "Modified Gross" },
  { value: "FULL_GROSS", label: "Full Service / Gross" },
  { value: "ABSOLUTE_NNN", label: "Absolute Net" },
  { value: "OTHER", label: "Other" },
] as const;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "FUTURE", label: "Pending / Future" },
  { value: "EXPIRING", label: "Expiring" },
  { value: "EXPIRED", label: "Expired" },
  { value: "ARCHIVED", label: "Terminated / Archived" },
] as const;

const RENT_STRUCTURE_OPTIONS = [
  { value: "base_only", label: "Base Rent Only" },
  { value: "base_plus_percentage", label: "Base + Percentage" },
  { value: "percentage_only", label: "Percentage Only" },
] as const;

const RENT_UNIT_OPTIONS = [
  { value: "PSF_YEAR", label: "$/SF/Year" },
  { value: "PER_MONTH", label: "$/Month" },
  { value: "PER_YEAR", label: "$/Year" },
] as const;

const ESCALATION_TYPE_OPTIONS = [
  { value: "NONE", label: "None (Flat)" },
  { value: "PERCENT", label: "Fixed Percentage" },
  { value: "FIXED_DOLLAR", label: "Fixed Dollar" },
  { value: "DOLLAR_PSF_YEAR", label: "$/SF/Yr Step-Up" },
  { value: "CPI", label: "CPI-Based" },
] as const;

const ESCALATION_TYPE_OPTIONS_ADVANCED = [
  ...ESCALATION_TYPE_OPTIONS,
  { value: "FMV", label: "Fair Market Value" },
] as const;

const SECURITY_DEPOSIT_TYPE_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "LOC", label: "Letter of Credit" },
  { value: "CORP_GUARANTEE", label: "Corporate Guarantee" },
  { value: "PERSONAL_GUARANTEE", label: "Personal Guarantee" },
  { value: "NONE", label: "None" },
] as const;

const ASSET_CLASS_OPTIONS = [
  { value: "retail", label: "Retail" },
  { value: "office", label: "Office" },
  { value: "industrial", label: "Industrial" },
  { value: "marina", label: "Marina" },
  { value: "mixed_use", label: "Mixed-Use" },
  { value: "other", label: "Other" },
] as const;

const TENANT_TYPE_OPTIONS = [
  { value: "national", label: "National" },
  { value: "regional", label: "Regional" },
  { value: "local", label: "Local" },
  { value: "mom_pop", label: "Mom-and-Pop" },
] as const;

const SPACE_TYPE_OPTIONS = [
  { value: "inline", label: "Inline" },
  { value: "endcap", label: "Endcap" },
  { value: "pad", label: "Pad" },
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
  { value: "other", label: "Other" },
] as const;

const RECOVERY_STRUCTURE_OPTIONS = [
  { value: "nnn", label: "NNN (Actual)" },
  { value: "base_year_stop", label: "Base Year Stop" },
  { value: "expense_stop", label: "Expense Stop" },
  { value: "mod_gross", label: "Modified Gross" },
] as const;

const UTILITIES_OPTIONS = [
  { value: "landlord", label: "Landlord" },
  { value: "tenant", label: "Tenant" },
  { value: "submetered", label: "Submetered" },
] as const;

const OPTION_TYPE_OPTIONS = [
  { value: "renewal", label: "Renewal" },
  { value: "expansion", label: "Expansion" },
  { value: "termination", label: "Termination" },
  { value: "rofr", label: "ROFR" },
  { value: "rofo", label: "ROFO" },
  { value: "other", label: "Other" },
] as const;

const RENT_RESET_OPTIONS = [
  { value: "fixed_pct", label: "Fixed %" },
  { value: "fixed_amt", label: "Fixed $" },
  { value: "cpi", label: "CPI" },
  { value: "fmv", label: "FMV" },
  { value: "tbd", label: "To Be Negotiated" },
] as const;

const BILLING_FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
] as const;

const BREAKPOINT_TYPE_OPTIONS = [
  { value: "natural", label: "Natural" },
  { value: "artificial", label: "Artificial" },
] as const;

const TI_STRUCTURE_OPTIONS = [
  { value: "landlord", label: "Landlord" },
  { value: "tenant", label: "Tenant" },
  { value: "shared", label: "Shared" },
] as const;

const COMMISSION_TYPE_OPTIONS = [
  { value: "pct_total_rent", label: "% of Total Rent" },
  { value: "pct_base_year", label: "% of Base Year" },
  { value: "flat", label: "Flat Fee" },
] as const;

const RISK_RATING_OPTIONS = [
  { value: "1", label: "1 — Minimal" },
  { value: "2", label: "2 — Low" },
  { value: "3", label: "3 — Moderate" },
  { value: "4", label: "4 — Elevated" },
  { value: "5", label: "5 — High" },
] as const;

// ─── Enum mappings (operations context) ─────────────────────────────────────

const LEASE_TYPE_MAP_TO_OPS: Record<string, string> = {
  NNN: "nnn", MOD_GROSS: "modified_gross", FULL_GROSS: "full_service",
  ABSOLUTE_NNN: "absolute_net", OTHER: "double_net",
};
const LEASE_TYPE_MAP_FROM_OPS: Record<string, string> = {
  nnn: "NNN", modified_gross: "MOD_GROSS", full_service: "FULL_GROSS",
  double_net: "OTHER", absolute_net: "ABSOLUTE_NNN",
};
const STATUS_MAP_TO_OPS: Record<string, string> = {
  ACTIVE: "active", FUTURE: "pending", EXPIRING: "month_to_month",
  EXPIRED: "expired", ARCHIVED: "terminated",
};
const STATUS_MAP_FROM_OPS: Record<string, string> = {
  active: "ACTIVE", pending: "FUTURE", month_to_month: "EXPIRING",
  expired: "EXPIRED", terminated: "ARCHIVED",
};
const ESCALATION_MAP_TO_OPS: Record<string, string> = {
  NONE: "none", PERCENT: "fixed_percent", FIXED_DOLLAR: "fixed_dollar",
  CPI: "cpi", DOLLAR_PSF_YEAR: "fixed_dollar", FMV: "fair_market_value",
};
const ESCALATION_MAP_FROM_OPS: Record<string, string> = {
  none: "NONE", fixed_percent: "PERCENT", fixed_dollar: "FIXED_DOLLAR",
  cpi: "CPI", fair_market_value: "FMV",
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const optionRowSchema = z.object({
  optionType: z.string().default("renewal"),
  noticeMonths: z.string().optional(),
  optionTermMonths: z.string().optional(),
  rentResetMethod: z.string().default("tbd"),
  rentResetValue: z.string().optional(),
  conditions: z.string().optional(),
  assumeInUnderwriting: z.boolean().default(false),
});

const formSchema = z.object({
  // ─── Basic Info (existing) ───────────────────────────────────────────────
  tenantName: z.string().min(1, "Tenant name is required"),
  tradeName: z.string().optional(),
  suiteLabel: z.string().optional(),
  squareFootage: z.string().optional(),
  proRataShare: z.string().optional(),
  permittedUse: z.string().optional(),
  leaseStartDate: z.string().min(1, "Start date is required"),
  leaseEndDate: z.string().min(1, "End date is required"),
  rentStartDate: z.string().optional(),
  leaseType: z.string().default("NNN"),
  rentStructure: z.string().default("base_only"),
  tenantStatus: z.string().default("ACTIVE"),

  // ─── Basic Info (new — advanced) ─────────────────────────────────────────
  tenantType: z.string().optional(),
  industry: z.string().optional(),
  tenantWebsite: z.string().optional(),
  spaceType: z.string().optional(),
  building: z.string().optional(),
  possessionDate: z.string().optional(),
  exclusiveUseClause: z.string().optional(),
  canGoDark: z.boolean().default(false),
  hasOpeningCoTenancy: z.boolean().default(false),
  openingCoTenancyRequirements: z.string().optional(),
  hasOperatingCoTenancy: z.boolean().default(false),
  operatingCoTenancyRequirements: z.string().optional(),

  // ─── Financial (existing) ────────────────────────────────────────────────
  baseRentInputUnit: z.string().default("PSF_YEAR"),
  baseRentInputValue: z.string().optional(),
  rentFreePeriodMonths: z.string().optional(),
  escalationType: z.string().default("NONE"),
  escalationRate: z.string().optional(),
  escalationAmount: z.string().optional(),
  escalationFrequencyMonths: z.string().optional(),
  securityDeposit: z.string().optional(),
  securityDepositType: z.string().default("NONE"),
  percentageRentRate: z.string().optional(),
  naturalBreakpoint: z.string().optional(),

  // ─── Financial (new — advanced) ──────────────────────────────────────────
  billingFrequency: z.string().optional(),
  abatementTiming: z.string().optional(),
  cpiCeiling: z.string().optional(),
  cpiFloor: z.string().optional(),
  breakpointType: z.string().optional(),
  salesReportingFrequency: z.string().optional(),
  trueUpMonth: z.string().optional(),
  guarantorName: z.string().optional(),
  guarantorType: z.string().optional(),

  // ─── NNN/CAM (existing) ──────────────────────────────────────────────────
  estimatedCamPerSF: z.string().optional(),
  estimatedTaxPerSF: z.string().optional(),
  estimatedInsurancePerSF: z.string().optional(),

  // ─── NNN/CAM (new — advanced) ────────────────────────────────────────────
  recoveryStructure: z.string().optional(),
  camCapPercent: z.string().optional(),
  adminFeePercent: z.string().optional(),
  reconMonth: z.string().optional(),
  auditRights: z.boolean().default(false),
  utilitiesResponsibility: z.string().optional(),

  // ─── Options (simple mode — existing) ────────────────────────────────────
  renewalOptions: z.string().optional(),
  renewalTermYears: z.string().optional(),
  renewalNoticeMonths: z.string().optional(),
  notes: z.string().optional(),

  // ─── Options (advanced mode — repeatable rows) ───────────────────────────
  leaseOptions: z.array(optionRowSchema).default([]),

  // ─── TI & Costs (advanced) ───────────────────────────────────────────────
  tiStructure: z.string().optional(),
  tiAllowance: z.string().optional(),
  tiAllowancePerSF: z.string().optional(),
  commissionType: z.string().optional(),
  commissionValue: z.string().optional(),
  commissionTiming: z.string().optional(),
  amortizeTi: z.boolean().default(false),
  amortizationTermMonths: z.string().optional(),
  amortizationRate: z.string().optional(),

  // ─── Risk (advanced) ─────────────────────────────────────────────────────
  internalRiskRating: z.string().optional(),
  underwritingNotes: z.string().optional(),
  assignmentClause: z.boolean().default(false),
  subleaseClause: z.boolean().default(false),
  glLimits: z.string().optional(),
  additionalInsured: z.boolean().default(false),

  // ─── Context row ─────────────────────────────────────────────────────────
  assetClassTemplate: z.string().default("other"),
  advancedModeEnabled: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface ExistingTenantData {
  id: string;
  tenantName?: string;
  tradeName?: string;
  suiteNumber?: string;
  suiteLabel?: string;
  squareFootage?: string;
  sf?: number | string;
  proRataShare?: string;
  permittedUse?: string;
  leaseCommencementDate?: string;
  leaseStartDate?: string;
  leaseExpirationDate?: string;
  leaseEndDate?: string;
  rentStartDate?: string;
  leaseType?: string;
  rentStructure?: string;
  tenantStatus?: string;
  status?: string;
  currentBaseRent?: string;
  baseRentPerSF?: string;
  baseRentInputUnit?: string;
  baseRentInputValue?: string | number;
  rentFreePeriodMonths?: number | string;
  escalationType?: string;
  escalationRate?: string;
  escalationAmount?: string;
  escalationFrequencyMonths?: number | string;
  escalationFrequency?: number | string;
  securityDeposit?: string;
  securityDepositAmount?: string | number;
  securityDepositType?: string;
  letterOfCreditAmount?: string;
  percentageRentRate?: string;
  naturalBreakpoint?: string;
  estimatedCamPerSF?: string;
  estimatedTaxPerSF?: string;
  estimatedInsurancePerSF?: string;
  renewalOptions?: number | string;
  renewalTermYears?: number | string;
  renewalNoticeMonths?: number | string;
  notes?: string;
  // New fields
  tenantType?: string;
  industry?: string;
  tenantWebsite?: string;
  spaceType?: string;
  building?: string;
  possessionDate?: string;
  assetClassTemplate?: string;
  advancedModeEnabled?: boolean;
  billingFrequency?: string;
  abatementTiming?: string;
  cpiCeiling?: string;
  cpiFloor?: string;
  breakpointType?: string;
  salesReportingFrequency?: string;
  trueUpMonth?: number | string;
  guarantorName?: string;
  guarantorType?: string;
  recoveryStructure?: string;
  camCapPercent?: string;
  adminFeePercent?: string;
  reconMonth?: number | string;
  auditRights?: boolean;
  utilitiesResponsibility?: string;
  exclusiveUseClause?: string;
  canGoDark?: boolean;
  hasOpeningCoTenancy?: boolean;
  openingCoTenancyRequirements?: string;
  hasOperatingCoTenancy?: boolean;
  operatingCoTenancyRequirements?: string;
  tiAllowance?: string;
  tiAllowancePerSF?: string;
  tiStructure?: string;
  commissionType?: string;
  commissionValue?: string;
  commissionTiming?: string;
  amortizeTi?: boolean;
  amortizationTermMonths?: number | string;
  amortizationRate?: string;
  internalRiskRating?: number | string;
  underwritingNotes?: string;
  assignmentClause?: boolean;
  subleaseClause?: boolean;
  glLimits?: string;
  additionalInsured?: boolean;
  // Options from the new table
  tenantOptions?: Array<{
    id?: string;
    optionType: string;
    noticeMonths?: number;
    optionTermMonths?: number;
    rentResetMethod?: string;
    rentResetValue?: string;
    conditions?: string;
    assumeInUnderwriting?: boolean;
  }>;
}

interface UnifiedTenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: "operations" | "valuator";
  tenant?: ExistingTenantData | null;
  projectId?: string;
  projectName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_VALUES: FormValues = {
  tenantName: "", tradeName: "", suiteLabel: "", squareFootage: "", proRataShare: "",
  permittedUse: "", leaseStartDate: "", leaseEndDate: "", rentStartDate: "",
  leaseType: "NNN", rentStructure: "base_only", tenantStatus: "ACTIVE",
  tenantType: "", industry: "", tenantWebsite: "", spaceType: "", building: "",
  possessionDate: "", exclusiveUseClause: "", canGoDark: false,
  hasOpeningCoTenancy: false, openingCoTenancyRequirements: "",
  hasOperatingCoTenancy: false, operatingCoTenancyRequirements: "",
  baseRentInputUnit: "PSF_YEAR", baseRentInputValue: "", rentFreePeriodMonths: "",
  escalationType: "NONE", escalationRate: "", escalationAmount: "",
  escalationFrequencyMonths: "12", securityDeposit: "", securityDepositType: "NONE",
  percentageRentRate: "", naturalBreakpoint: "",
  billingFrequency: "monthly", abatementTiming: "upfront",
  cpiCeiling: "", cpiFloor: "", breakpointType: "natural",
  salesReportingFrequency: "", trueUpMonth: "",
  guarantorName: "", guarantorType: "",
  estimatedCamPerSF: "", estimatedTaxPerSF: "", estimatedInsurancePerSF: "",
  recoveryStructure: "nnn", camCapPercent: "", adminFeePercent: "",
  reconMonth: "", auditRights: false, utilitiesResponsibility: "tenant",
  renewalOptions: "", renewalTermYears: "", renewalNoticeMonths: "", notes: "",
  leaseOptions: [],
  tiStructure: "landlord", tiAllowance: "", tiAllowancePerSF: "",
  commissionType: "", commissionValue: "", commissionTiming: "upfront",
  amortizeTi: false, amortizationTermMonths: "", amortizationRate: "",
  internalRiskRating: "", underwritingNotes: "",
  assignmentClause: false, subleaseClause: false,
  glLimits: "", additionalInsured: false,
  assetClassTemplate: "other", advancedModeEnabled: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPING: tenant data → form values
// ═══════════════════════════════════════════════════════════════════════════════

function tenantToFormValues(
  tenant: ExistingTenantData,
  context: "operations" | "valuator"
): FormValues {
  if (context === "operations") {
    // Derive deposit type
    let depositType = "NONE";
    if (tenant.letterOfCreditAmount && parseFloat(tenant.letterOfCreditAmount) > 0) {
      depositType = "LOC";
    } else if (tenant.guarantorType === "corporate") {
      depositType = "CORP_GUARANTEE";
    } else if (tenant.guarantorType === "personal") {
      depositType = "PERSONAL_GUARANTEE";
    } else if (tenant.securityDeposit && parseFloat(tenant.securityDeposit) > 0) {
      depositType = "CASH";
    }

    const hasBaseRentPerSF = tenant.baseRentPerSF && parseFloat(tenant.baseRentPerSF) > 0;
    const rentUnit = hasBaseRentPerSF ? "PSF_YEAR" : "PER_YEAR";
    const rentValue = hasBaseRentPerSF ? tenant.baseRentPerSF : tenant.currentBaseRent;

    // Map options from new table
    const leaseOptions = (tenant.tenantOptions || []).map((opt) => ({
      optionType: opt.optionType || "renewal",
      noticeMonths: opt.noticeMonths?.toString() || "",
      optionTermMonths: opt.optionTermMonths?.toString() || "",
      rentResetMethod: opt.rentResetMethod || "tbd",
      rentResetValue: opt.rentResetValue || "",
      conditions: opt.conditions || "",
      assumeInUnderwriting: opt.assumeInUnderwriting || false,
    }));

    return {
      ...DEFAULT_VALUES,
      tenantName: tenant.tenantName || "",
      tradeName: tenant.tradeName || "",
      suiteLabel: tenant.suiteNumber || "",
      squareFootage: tenant.squareFootage || "",
      proRataShare: tenant.proRataShare || "",
      permittedUse: tenant.permittedUse || "",
      leaseStartDate: tenant.leaseCommencementDate || "",
      leaseEndDate: tenant.leaseExpirationDate || "",
      rentStartDate: tenant.rentStartDate || "",
      leaseType: (LEASE_TYPE_MAP_FROM_OPS[tenant.leaseType || ""] || "NNN"),
      rentStructure: tenant.rentStructure || "base_only",
      tenantStatus: (STATUS_MAP_FROM_OPS[tenant.tenantStatus || ""] || "ACTIVE"),
      baseRentInputUnit: rentUnit,
      baseRentInputValue: rentValue || "",
      rentFreePeriodMonths: tenant.rentFreePeriodMonths?.toString() || "",
      escalationType: (ESCALATION_MAP_FROM_OPS[tenant.escalationType || ""] || "NONE"),
      escalationRate: tenant.escalationRate || "",
      escalationAmount: tenant.escalationAmount || "",
      escalationFrequencyMonths: (tenant.escalationFrequency ?? "12").toString(),
      securityDeposit: depositType === "LOC"
        ? (tenant.letterOfCreditAmount || "")
        : (tenant.securityDeposit || ""),
      securityDepositType: depositType,
      percentageRentRate: tenant.percentageRentRate || "",
      naturalBreakpoint: tenant.naturalBreakpoint || "",
      estimatedCamPerSF: tenant.estimatedCamPerSF || "",
      estimatedTaxPerSF: tenant.estimatedTaxPerSF || "",
      estimatedInsurancePerSF: tenant.estimatedInsurancePerSF || "",
      renewalOptions: tenant.renewalOptions?.toString() || "",
      renewalTermYears: tenant.renewalTermYears?.toString() || "",
      renewalNoticeMonths: tenant.renewalNoticeMonths?.toString() || "",
      notes: tenant.notes || "",
      // New fields
      tenantType: tenant.tenantType || "",
      industry: tenant.industry || "",
      tenantWebsite: tenant.tenantWebsite || "",
      spaceType: tenant.spaceType || "",
      building: tenant.building || "",
      possessionDate: tenant.possessionDate || "",
      assetClassTemplate: tenant.assetClassTemplate || "other",
      advancedModeEnabled: tenant.advancedModeEnabled || false,
      billingFrequency: tenant.billingFrequency || "monthly",
      abatementTiming: tenant.abatementTiming || "upfront",
      cpiCeiling: tenant.cpiCeiling || "",
      cpiFloor: tenant.cpiFloor || "",
      breakpointType: tenant.breakpointType || "natural",
      salesReportingFrequency: tenant.salesReportingFrequency || "",
      trueUpMonth: tenant.trueUpMonth?.toString() || "",
      guarantorName: tenant.guarantorName || "",
      guarantorType: tenant.guarantorType || "",
      recoveryStructure: tenant.recoveryStructure || "nnn",
      camCapPercent: tenant.camCapPercent || "",
      adminFeePercent: tenant.adminFeePercent || "",
      reconMonth: tenant.reconMonth?.toString() || "",
      auditRights: tenant.auditRights || false,
      utilitiesResponsibility: tenant.utilitiesResponsibility || "tenant",
      exclusiveUseClause: tenant.exclusiveUseClause || "",
      canGoDark: tenant.canGoDark || false,
      hasOpeningCoTenancy: tenant.hasOpeningCoTenancy || false,
      openingCoTenancyRequirements: tenant.openingCoTenancyRequirements || "",
      hasOperatingCoTenancy: tenant.hasOperatingCoTenancy || false,
      operatingCoTenancyRequirements: tenant.operatingCoTenancyRequirements || "",
      tiStructure: tenant.tiStructure || "landlord",
      tiAllowance: tenant.tiAllowance || "",
      tiAllowancePerSF: tenant.tiAllowancePerSF || "",
      commissionType: tenant.commissionType || "",
      commissionValue: tenant.commissionValue || "",
      commissionTiming: tenant.commissionTiming || "upfront",
      amortizeTi: tenant.amortizeTi || false,
      amortizationTermMonths: tenant.amortizationTermMonths?.toString() || "",
      amortizationRate: tenant.amortizationRate || "",
      internalRiskRating: tenant.internalRiskRating?.toString() || "",
      underwritingNotes: tenant.underwritingNotes || "",
      assignmentClause: tenant.assignmentClause || false,
      subleaseClause: tenant.subleaseClause || false,
      glLimits: tenant.glLimits || "",
      additionalInsured: tenant.additionalInsured || false,
      leaseOptions,
    };
  }

  // Valuator context — simplified
  return {
    ...DEFAULT_VALUES,
    tenantName: tenant.tenantName || "",
    suiteLabel: tenant.suiteLabel || "",
    squareFootage: tenant.sf?.toString() || "",
    leaseStartDate: tenant.leaseStartDate || "",
    leaseEndDate: tenant.leaseEndDate || "",
    leaseType: (tenant.leaseType || "NNN"),
    tenantStatus: (tenant.status || "ACTIVE"),
    baseRentInputUnit: (tenant.baseRentInputUnit || "PSF_YEAR"),
    baseRentInputValue: tenant.baseRentInputValue?.toString() || "",
    escalationType: (tenant.escalationType || "NONE"),
    escalationFrequencyMonths: tenant.escalationFrequencyMonths?.toString() || "12",
    securityDeposit: tenant.securityDepositAmount?.toString() || "",
    securityDepositType: (tenant.securityDepositType || "NONE"),
    notes: tenant.notes || "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════════

function SectionLabel({ children, badge }: { children: React.ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</h4>
      {badge && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{badge}</Badge>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function UnifiedTenantFormDialog({
  open,
  onOpenChange,
  context,
  tenant,
  projectId,
  projectName,
}: UnifiedTenantFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!tenant;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control: form.control,
    name: "leaseOptions",
  });

  const isAdvanced = form.watch("advancedModeEnabled");
  const assetClass = form.watch("assetClassTemplate");
  const watchedSF = form.watch("squareFootage");
  const watchedRentValue = form.watch("baseRentInputValue");
  const watchedRentUnit = form.watch("baseRentInputUnit");
  const watchedEscalationType = form.watch("escalationType");
  const watchedRentStructure = form.watch("rentStructure");
  const watchedAmortize = form.watch("amortizeTi");

  const isRetail = assetClass === "retail";
  const isOffice = assetClass === "office";
  const isMarina = assetClass === "marina";
  const showPercentRent = ["base_plus_percentage", "percentage_only"].includes(watchedRentStructure);
  const showCpi = watchedEscalationType === "CPI";

  // Active tab state
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    if (tenant) {
      form.reset(tenantToFormValues(tenant, context));
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [tenant, context]);

  // Reset to basic tab if advanced tabs become hidden
  useEffect(() => {
    if (!isAdvanced && (activeTab === "ti_costs" || activeTab === "risk")) {
      setActiveTab("basic");
    }
  }, [isAdvanced, activeTab]);

  // ─── Derived Rent Computation ──────────────────────────────────────────────

  const derivedRent = useMemo(() => {
    const sf = parseFloat(watchedSF || "0") || 0;
    const value = parseFloat(watchedRentValue || "0") || 0;
    if (!sf || !value) return { monthly: 0, yearly: 0, psfYear: 0 };
    switch (watchedRentUnit) {
      case "PSF_YEAR":
        return { psfYear: value, yearly: value * sf, monthly: (value * sf) / 12 };
      case "PER_MONTH":
        return { monthly: value, yearly: value * 12, psfYear: sf > 0 ? (value * 12) / sf : 0 };
      case "PER_YEAR":
        return { yearly: value, monthly: value / 12, psfYear: sf > 0 ? value / sf : 0 };
      default:
        return { monthly: 0, yearly: 0, psfYear: 0 };
    }
  }, [watchedSF, watchedRentValue, watchedRentUnit]);

  const watchedCam = form.watch("estimatedCamPerSF");
  const watchedTax = form.watch("estimatedTaxPerSF");
  const watchedIns = form.watch("estimatedInsurancePerSF");

  const nnnPreview = useMemo(() => {
    const sf = parseFloat(watchedSF || "0") || 0;
    const cam = parseFloat(watchedCam || "0") || 0;
    const tax = parseFloat(watchedTax || "0") || 0;
    const ins = parseFloat(watchedIns || "0") || 0;
    return { perSf: cam + tax + ins, total: (cam + tax + ins) * sf };
  }, [watchedSF, watchedCam, watchedTax, watchedIns]);

  const leaseTermMonths = useMemo(() => {
    const start = form.watch("leaseStartDate");
    const end = form.watch("leaseEndDate");
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  }, [form.watch("leaseStartDate"), form.watch("leaseEndDate")]);

  const showRentPreview = derivedRent.yearly > 0;

  // ─── Mutation ──────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (context === "operations") {
        const payload: Record<string, any> = {
          // Existing fields
          tenantName: values.tenantName,
          tradeName: values.tradeName || null,
          suiteNumber: values.suiteLabel || null,
          squareFootage: values.squareFootage || null,
          proRataShare: values.proRataShare || null,
          permittedUse: values.permittedUse || null,
          leaseCommencementDate: values.leaseStartDate,
          leaseExpirationDate: values.leaseEndDate,
          rentStartDate: values.rentStartDate || null,
          leaseType: LEASE_TYPE_MAP_TO_OPS[values.leaseType] || "nnn",
          rentStructure: values.rentStructure,
          tenantStatus: STATUS_MAP_TO_OPS[values.tenantStatus] || "active",
          currentBaseRent: derivedRent.yearly ? derivedRent.yearly.toFixed(2) : (values.baseRentInputValue || null),
          baseRentPerSF: derivedRent.psfYear ? derivedRent.psfYear.toFixed(2) : null,
          rentFreePeriodMonths: values.rentFreePeriodMonths ? parseInt(values.rentFreePeriodMonths) : null,
          escalationType: ESCALATION_MAP_TO_OPS[values.escalationType] || "none",
          escalationRate: values.escalationRate || null,
          escalationAmount: values.escalationAmount || null,
          escalationFrequency: values.escalationFrequencyMonths ? parseInt(values.escalationFrequencyMonths) : null,
          securityDeposit: ["CASH", "CORP_GUARANTEE", "PERSONAL_GUARANTEE"].includes(values.securityDepositType) ? (values.securityDeposit || null) : null,
          letterOfCreditAmount: values.securityDepositType === "LOC" ? (values.securityDeposit || null) : null,
          percentageRentRate: values.percentageRentRate || null,
          naturalBreakpoint: values.naturalBreakpoint || null,
          estimatedCamPerSF: values.estimatedCamPerSF || null,
          estimatedTaxPerSF: values.estimatedTaxPerSF || null,
          estimatedInsurancePerSF: values.estimatedInsurancePerSF || null,
          renewalOptions: values.renewalOptions ? parseInt(values.renewalOptions) : null,
          renewalTermYears: values.renewalTermYears ? parseInt(values.renewalTermYears) : null,
          renewalNoticeMonths: values.renewalNoticeMonths ? parseInt(values.renewalNoticeMonths) : null,
          notes: values.notes || null,
          // New fields
          tenantType: values.tenantType || null,
          industry: values.industry || null,
          tenantWebsite: values.tenantWebsite || null,
          spaceType: values.spaceType || null,
          building: values.building || null,
          possessionDate: values.possessionDate || null,
          assetClassTemplate: values.assetClassTemplate || "other",
          advancedModeEnabled: values.advancedModeEnabled,
          billingFrequency: values.billingFrequency || null,
          abatementTiming: values.abatementTiming || null,
          cpiCeiling: values.cpiCeiling || null,
          cpiFloor: values.cpiFloor || null,
          breakpointType: values.breakpointType || null,
          salesReportingFrequency: values.salesReportingFrequency || null,
          trueUpMonth: values.trueUpMonth ? parseInt(values.trueUpMonth) : null,
          guarantorName: values.guarantorName || null,
          guarantorType: values.guarantorType || null,
          recoveryStructure: values.recoveryStructure || null,
          camCapPercent: values.camCapPercent || null,
          adminFeePercent: values.adminFeePercent || null,
          reconMonth: values.reconMonth ? parseInt(values.reconMonth) : null,
          auditRights: values.auditRights,
          utilitiesResponsibility: values.utilitiesResponsibility || null,
          exclusiveUseClause: values.exclusiveUseClause || null,
          canGoDark: values.canGoDark,
          hasOpeningCoTenancy: values.hasOpeningCoTenancy,
          openingCoTenancyRequirements: values.openingCoTenancyRequirements || null,
          hasOperatingCoTenancy: values.hasOperatingCoTenancy,
          operatingCoTenancyRequirements: values.operatingCoTenancyRequirements || null,
          tiStructure: values.tiStructure || null,
          tiAllowance: values.tiAllowance || null,
          tiAllowancePerSF: values.tiAllowancePerSF || null,
          commissionType: values.commissionType || null,
          commissionValue: values.commissionValue || null,
          commissionTiming: values.commissionTiming || null,
          amortizeTi: values.amortizeTi,
          amortizationTermMonths: values.amortizationTermMonths ? parseInt(values.amortizationTermMonths) : null,
          amortizationRate: values.amortizationRate || null,
          internalRiskRating: values.internalRiskRating ? parseInt(values.internalRiskRating) : null,
          underwritingNotes: values.underwritingNotes || null,
          assignmentClause: values.assignmentClause,
          subleaseClause: values.subleaseClause,
          glLimits: values.glLimits || null,
          additionalInsured: values.additionalInsured,
        };

        // Include options for advanced mode
        if (values.advancedModeEnabled && values.leaseOptions.length > 0) {
          payload.leaseOptions = values.leaseOptions.map((opt, idx) => ({
            optionType: opt.optionType,
            noticeMonths: opt.noticeMonths ? parseInt(opt.noticeMonths) : null,
            optionTermMonths: opt.optionTermMonths ? parseInt(opt.optionTermMonths) : null,
            rentResetMethod: opt.rentResetMethod,
            rentResetValue: opt.rentResetValue || null,
            conditions: opt.conditions || null,
            assumeInUnderwriting: opt.assumeInUnderwriting,
            sortOrder: idx,
          }));
        }

        if (isEditing) {
          return apiRequest(`/api/commercial-tenants/${tenant.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        }
        return apiRequest("/api/commercial-tenants", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      // Valuator context (unchanged)
      const sf = parseFloat(values.squareFootage || "0") || 0;
      const rentValue = parseFloat(values.baseRentInputValue || "0") || 0;
      const payload = {
        lease: {
          tenantName: values.tenantName,
          suiteLabel: values.suiteLabel || null,
          sf,
          leaseType: values.leaseType,
          leaseStartDate: values.leaseStartDate,
          leaseEndDate: values.leaseEndDate,
          securityDepositAmount: values.securityDeposit ? parseFloat(values.securityDeposit) : null,
          securityDepositType: values.securityDepositType,
          notes: values.notes || null,
        },
        initialTerm: {
          termStartDate: values.leaseStartDate,
          termEndDate: values.leaseEndDate,
          baseRentInputUnit: values.baseRentInputUnit,
          baseRentInputValue: rentValue,
          escalationType: values.escalationType,
          escalationValue: values.escalationType !== "NONE" ? (parseFloat(values.escalationRate || "0") || null) : null,
          escalationFrequencyMonths: values.escalationType !== "NONE" ? (parseInt(values.escalationFrequencyMonths || "12") || null) : null,
        },
      };
      if (isEditing) {
        return apiRequest(`/api/valuator/${projectId}/leases/${tenant.id}`, {
          method: "PATCH", body: JSON.stringify(payload),
        });
      }
      return apiRequest(`/api/valuator/${projectId}/leases`, {
        method: "POST", body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      if (context === "operations") {
        queryClient.invalidateQueries({ queryKey: ["/api/commercial-tenants"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/valuator", projectId, "leases"] });
        queryClient.invalidateQueries({ queryKey: ["/api/valuator", projectId, "leases/kpis"] });
      }
      toast({ title: isEditing ? "Tenant updated" : "Tenant created" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  // Tab configuration
  const tabs = useMemo(() => {
    const base = [
      { id: "basic", label: "Basic Info" },
      { id: "financial", label: "Financial" },
      { id: "expenses", label: "NNN / CAM" },
      { id: "options", label: "Options" },
    ];
    if (isAdvanced) {
      base.push({ id: "ti_costs", label: "TI & Costs" });
      base.push({ id: "risk", label: "Risk" });
    }
    return base;
  }, [isAdvanced]);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[92vh] overflow-hidden flex flex-col ${isAdvanced ? "max-w-5xl" : "max-w-3xl"}`}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Tenant" : "Add Commercial Tenant"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update lease abstract details"
              : projectName
                ? `Enter lease details for ${projectName}`
                : "Enter lease abstract details for the new tenant"}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Context Row ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg border text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider">Template</span>
            <FormField
              control={form.control}
              name="assetClassTemplate"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CLASS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider">Mode</span>
            <FormField
              control={form.control}
              name="advancedModeEnabled"
              render={({ field }) => (
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs ${!field.value ? "font-medium" : "text-muted-foreground"}`}>Simple</span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="scale-75"
                  />
                  <span className={`text-xs ${field.value ? "font-medium" : "text-muted-foreground"}`}>Advanced</span>
                </div>
              )}
            />
          </div>

          {isAdvanced && leaseTermMonths > 0 && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                <span><strong className="text-foreground">{leaseTermMonths}</strong> mo term</span>
                {derivedRent.yearly > 0 && (
                  <span className="ml-2"><strong className="text-foreground">${fmt(derivedRent.yearly)}</strong>/yr</span>
                )}
                {nnnPreview.total > 0 && (
                  <span className="ml-2">+ <strong className="text-foreground">${fmt(nnnPreview.total)}</strong> NNN</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── Form ────────────────────────────────────────────────────────── */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className={`grid w-full ${isAdvanced ? "grid-cols-6" : "grid-cols-4"}`}>
                {tabs.map((t) => (
                  <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto pr-1 mt-4 space-y-4">

                {/* ════════════ TAB: BASIC INFO ════════════ */}
                <TabsContent value="basic" className="space-y-4 mt-0">
                  {isAdvanced && (
                    <>
                      <SectionLabel>Tenant Identity</SectionLabel>
                      <Separator />
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="tenantName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant Name *</FormLabel>
                        <FormControl><Input {...field} placeholder="ABC Retail Inc." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="tradeName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trade Name (DBA)</FormLabel>
                        <FormControl><Input {...field} placeholder="ABC Store" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {isAdvanced && (
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="tenantType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tenant Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {TENANT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="industry" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <FormControl><Input {...field} placeholder="Marine Retail..." /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="tenantWebsite" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl><Input {...field} placeholder="https://..." /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}

                  {isAdvanced && <><SectionLabel>Space</SectionLabel><Separator /></>}
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="suiteLabel" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suite / Unit</FormLabel>
                        <FormControl><Input {...field} placeholder="Suite 101" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="squareFootage" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Footage</FormLabel>
                        <FormControl><Input {...field} type="number" placeholder="2,500" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="proRataShare" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pro-Rata Share (%)</FormLabel>
                        <FormControl><Input {...field} type="number" step="0.01" placeholder="12.50" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {isAdvanced && (
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="spaceType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Space Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {SPACE_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="building" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Building</FormLabel>
                          <FormControl><Input {...field} placeholder="Building A" /></FormControl>
                        </FormItem>
                      )} />
                      <div />
                    </div>
                  )}

                  {isAdvanced && <><SectionLabel>Dates & Status</SectionLabel><Separator /></>}
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="leaseStartDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commencement Date *</FormLabel>
                        <FormControl><Input {...field} type="date" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="leaseEndDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration Date *</FormLabel>
                        <FormControl><Input {...field} type="date" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="rentStartDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent Start Date</FormLabel>
                        <FormControl><Input {...field} type="date" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {isAdvanced && (
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="possessionDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Possession Date</FormLabel>
                          <FormControl><Input {...field} type="date" /></FormControl>
                          <FormDescription>For TI & abatement timing</FormDescription>
                        </FormItem>
                      )} />
                      <div /><div />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="leaseType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {LEASE_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="rentStructure" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent Structure</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {RENT_STRUCTURE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="tenantStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="permittedUse" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permitted Use</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Retail sales of marine supplies and accessories..." /></FormControl>
                    </FormItem>
                  )} />

                  {/* Clause toggles — Advanced + Retail/Marina */}
                  {isAdvanced && (isRetail || isMarina) && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <SectionLabel>Lease Clauses</SectionLabel>
                      <FormField control={form.control} name="exclusiveUseClause" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exclusive Use Clause</FormLabel>
                          <FormControl><Input {...field} placeholder="Sole rights to sell..." /></FormControl>
                        </FormItem>
                      )} />
                      {isRetail && (
                        <>
                          <FormField control={form.control} name="canGoDark" render={({ field }) => (
                            <FormItem className="flex items-center gap-3">
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <FormLabel className="!mt-0">Go-Dark Right</FormLabel>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="hasOpeningCoTenancy" render={({ field }) => (
                            <FormItem className="flex items-center gap-3">
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <FormLabel className="!mt-0">Opening Co-Tenancy</FormLabel>
                            </FormItem>
                          )} />
                          {form.watch("hasOpeningCoTenancy") && (
                            <FormField control={form.control} name="openingCoTenancyRequirements" render={({ field }) => (
                              <FormItem>
                                <FormControl><Input {...field} placeholder="Required co-tenants for opening..." /></FormControl>
                              </FormItem>
                            )} />
                          )}
                          <FormField control={form.control} name="hasOperatingCoTenancy" render={({ field }) => (
                            <FormItem className="flex items-center gap-3">
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <FormLabel className="!mt-0">Operating Co-Tenancy</FormLabel>
                            </FormItem>
                          )} />
                          {form.watch("hasOperatingCoTenancy") && (
                            <FormField control={form.control} name="operatingCoTenancyRequirements" render={({ field }) => (
                              <FormItem>
                                <FormControl><Input {...field} placeholder="Required co-tenants for ongoing operations..." /></FormControl>
                              </FormItem>
                            )} />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ════════════ TAB: FINANCIAL ════════════ */}
                <TabsContent value="financial" className="space-y-4 mt-0">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="baseRentInputUnit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent Input Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {RENT_UNIT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="baseRentInputValue" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Rent Amount *</FormLabel>
                        <FormControl><Input {...field} type="number" step="0.01" placeholder="20.00" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="rentFreePeriodMonths" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent-Free Period (months)</FormLabel>
                        <FormControl><Input {...field} type="number" placeholder="0" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {isAdvanced && (
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="billingFrequency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {BILLING_FREQUENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="abatementTiming" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Abatement Timing</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="upfront">Upfront</SelectItem>
                              <SelectItem value="spread">Spread</SelectItem>
                              <SelectItem value="custom">Custom Schedule</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <div />
                    </div>
                  )}

                  {showRentPreview && (
                    <div className="rounded-lg border bg-muted/50 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Derived Rent</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Monthly:</span>{" "}
                          <span className="font-mono font-medium">${fmt(derivedRent.monthly)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Annual:</span>{" "}
                          <span className="font-mono font-medium">${fmt(derivedRent.yearly)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">$/SF/Yr:</span>{" "}
                          <span className="font-mono font-medium">${derivedRent.psfYear.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="escalationType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escalation Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {(isAdvanced ? ESCALATION_TYPE_OPTIONS_ADVANCED : ESCALATION_TYPE_OPTIONS).map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="escalationRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escalation Rate (%)</FormLabel>
                        <FormControl><Input {...field} type="number" step="0.01" placeholder="3.00" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="escalationFrequencyMonths" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escalation Frequency (mo)</FormLabel>
                        <FormControl><Input {...field} type="number" placeholder="12" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {showCpi && isAdvanced && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="cpiCeiling" render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPI Annual Cap (%)</FormLabel>
                          <FormControl><Input {...field} type="number" step="0.01" placeholder="5.00" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="cpiFloor" render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPI Annual Floor (%)</FormLabel>
                          <FormControl><Input {...field} type="number" step="0.01" placeholder="2.00" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="securityDeposit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Security Deposit ($)</FormLabel>
                        <FormControl><Input {...field} type="number" placeholder="10000" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="securityDepositType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deposit Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {SECURITY_DEPOSIT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    {isAdvanced && (
                      <FormField control={form.control} name="guarantorName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guarantor Name</FormLabel>
                          <FormControl><Input {...field} placeholder="Guarantor..." /></FormControl>
                        </FormItem>
                      )} />
                    )}
                  </div>

                  {/* Percentage Rent */}
                  {showPercentRent && (
                    <>
                      <SectionLabel>Percentage Rent</SectionLabel>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="percentageRentRate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>% Rent Rate</FormLabel>
                            <FormControl><Input {...field} type="number" step="0.01" placeholder="6.00" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="naturalBreakpoint" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Breakpoint Sales Threshold ($)</FormLabel>
                            <FormControl><Input {...field} type="number" placeholder="833333" /></FormControl>
                          </FormItem>
                        )} />
                        {isAdvanced && (
                          <FormField control={form.control} name="breakpointType" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Breakpoint Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {BREAKPOINT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        )}
                      </div>
                      {isAdvanced && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="salesReportingFrequency" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sales Reporting Frequency</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {BILLING_FREQUENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="trueUpMonth" render={({ field }) => (
                            <FormItem>
                              <FormLabel>True-Up Month (1-12)</FormLabel>
                              <FormControl><Input {...field} type="number" min="1" max="12" placeholder="3" /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* ════════════ TAB: NNN / CAM ════════════ */}
                <TabsContent value="expenses" className="space-y-4 mt-0">
                  {isAdvanced && (
                    <>
                      <SectionLabel badge="Advanced">Recovery Structure</SectionLabel>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="recoveryStructure" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recovery Structure</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                {RECOVERY_STRUCTURE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <div className="flex items-end pb-2 text-sm text-muted-foreground">
                          Pro-Rata Share: <strong className="ml-1">{form.watch("proRataShare") || "—"}%</strong>
                        </div>
                      </div>
                    </>
                  )}

                  <SectionLabel>Estimated Recoveries</SectionLabel>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="estimatedCamPerSF" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CAM per SF/Year ($)</FormLabel>
                        <FormControl><Input {...field} type="number" step="0.01" placeholder="5.00" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="estimatedTaxPerSF" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax per SF/Year ($)</FormLabel>
                        <FormControl><Input {...field} type="number" step="0.01" placeholder="3.00" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="estimatedInsurancePerSF" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance per SF/Year ($)</FormLabel>
                        <FormControl><Input {...field} type="number" step="0.01" placeholder="1.50" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {isAdvanced && (
                    <>
                      <SectionLabel badge="Advanced">Caps & Controls</SectionLabel>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="camCapPercent" render={({ field }) => (
                          <FormItem>
                            <FormLabel>CAM Cap (% annual)</FormLabel>
                            <FormControl><Input {...field} type="number" step="0.01" placeholder="5" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="adminFeePercent" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Admin Fee (%)</FormLabel>
                            <FormControl><Input {...field} type="number" step="0.01" placeholder="15" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="reconMonth" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reconciliation Month</FormLabel>
                            <FormControl><Input {...field} type="number" min="1" max="12" placeholder="3" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="auditRights" render={({ field }) => (
                          <FormItem className="flex items-center gap-3">
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel className="!mt-0">Audit Rights</FormLabel>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="utilitiesResponsibility" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Utilities Responsibility</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                {UTILITIES_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* ════════════ TAB: OPTIONS ════════════ */}
                <TabsContent value="options" className="space-y-4 mt-0">
                  {!isAdvanced ? (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="renewalOptions" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Renewals</FormLabel>
                            <FormControl><Input {...field} type="number" placeholder="2" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="renewalTermYears" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Renewal Term (years)</FormLabel>
                            <FormControl><Input {...field} type="number" placeholder="5" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="renewalNoticeMonths" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notice Period (months)</FormLabel>
                            <FormControl><Input {...field} type="number" placeholder="6" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </>
                  ) : (
                    <>
                      <SectionLabel badge="Advanced">Lease Options</SectionLabel>
                      <div className="space-y-3">
                        {optionFields.map((field, index) => (
                          <div key={field.id} className="rounded-lg border bg-muted/30 p-4 relative">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-semibold">Option {index + 1}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => removeOption(index)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <FormField control={form.control} name={`leaseOptions.${index}.optionType`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {OPTION_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )} />
                              <FormField control={form.control} name={`leaseOptions.${index}.noticeMonths`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Notice (months)</FormLabel>
                                  <FormControl><Input {...field} type="number" placeholder="6" className="h-9" /></FormControl>
                                </FormItem>
                              )} />
                              <FormField control={form.control} name={`leaseOptions.${index}.optionTermMonths`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Term (months)</FormLabel>
                                  <FormControl><Input {...field} type="number" placeholder="60" className="h-9" /></FormControl>
                                </FormItem>
                              )} />
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <FormField control={form.control} name={`leaseOptions.${index}.rentResetMethod`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Rent Reset Method</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {RENT_RESET_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )} />
                              <FormField control={form.control} name={`leaseOptions.${index}.conditions`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Conditions</FormLabel>
                                  <FormControl><Input {...field} placeholder="No default required..." className="h-9" /></FormControl>
                                </FormItem>
                              )} />
                            </div>
                            <FormField control={form.control} name={`leaseOptions.${index}.assumeInUnderwriting`} render={({ field }) => (
                              <FormItem className="flex items-center gap-2 mt-3">
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} className="scale-75" /></FormControl>
                                <FormLabel className="!mt-0 text-xs">Assume in Underwriting</FormLabel>
                              </FormItem>
                            )} />
                          </div>
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="w-full border-dashed"
                        onClick={() => appendOption({
                          optionType: "renewal", noticeMonths: "", optionTermMonths: "",
                          rentResetMethod: "tbd", conditions: "", assumeInUnderwriting: false,
                        })}>
                        <Plus className="h-4 w-4 mr-2" /> Add Option
                      </Button>
                    </>
                  )}

                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Additional lease terms or notes..." rows={4} /></FormControl>
                    </FormItem>
                  )} />
                </TabsContent>

                {/* ════════════ TAB: TI & COSTS (Advanced) ════════════ */}
                {isAdvanced && (
                  <TabsContent value="ti_costs" className="space-y-4 mt-0">
                    <SectionLabel badge="Advanced">Tenant Improvements</SectionLabel>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="tiStructure" render={({ field }) => (
                        <FormItem>
                          <FormLabel>TI Structure</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {TI_STRUCTURE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="tiAllowance" render={({ field }) => (
                        <FormItem>
                          <FormLabel>TI Budget ($)</FormLabel>
                          <FormControl><Input {...field} type="number" placeholder="50000" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="tiAllowancePerSF" render={({ field }) => (
                        <FormItem>
                          <FormLabel>TI Cap ($/SF)</FormLabel>
                          <FormControl><Input {...field} type="number" step="0.01" placeholder="20.00" /></FormControl>
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="amortizeTi" render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="!mt-0">Amortize TI into Rent</FormLabel>
                      </FormItem>
                    )} />
                    {watchedAmortize && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="amortizationTermMonths" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amortization Term (months)</FormLabel>
                            <FormControl><Input {...field} type="number" placeholder="60" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="amortizationRate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amortization Rate (%)</FormLabel>
                            <FormControl><Input {...field} type="number" step="0.01" placeholder="8.00" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    )}

                    <SectionLabel>Leasing Commissions</SectionLabel>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="commissionType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {COMMISSION_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="commissionValue" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount / Rate</FormLabel>
                          <FormControl><Input {...field} type="number" step="0.01" placeholder="5.00" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="commissionTiming" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pay Timing</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="upfront">Upfront</SelectItem>
                              <SelectItem value="spread">Spread</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                  </TabsContent>
                )}

                {/* ════════════ TAB: RISK (Advanced) ════════════ */}
                {isAdvanced && (
                  <TabsContent value="risk" className="space-y-4 mt-0">
                    <SectionLabel badge="Advanced">Risk Assessment</SectionLabel>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="internalRiskRating" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Internal Risk Rating</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {RISK_RATING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <div />
                    </div>
                    <FormField control={form.control} name="underwritingNotes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Underwriting Notes</FormLabel>
                        <FormControl><Textarea {...field} placeholder="Key assumptions, risk factors..." rows={3} /></FormControl>
                      </FormItem>
                    )} />

                    <SectionLabel>Critical Clauses</SectionLabel>
                    <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="assignmentClause" render={({ field }) => (
                        <FormItem className="flex items-center gap-3">
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="!mt-0">Assignment Clause</FormLabel>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="subleaseClause" render={({ field }) => (
                        <FormItem className="flex items-center gap-3">
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="!mt-0">Sublease Clause</FormLabel>
                        </FormItem>
                      )} />
                    </div>

                    <SectionLabel>Insurance Requirements</SectionLabel>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="glLimits" render={({ field }) => (
                        <FormItem>
                          <FormLabel>GL Limits</FormLabel>
                          <FormControl><Input {...field} placeholder="$1,000,000 / $2,000,000" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="additionalInsured" render={({ field }) => (
                        <FormItem className="flex items-center gap-3 pt-6">
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="!mt-0">Additional Insured Required</FormLabel>
                        </FormItem>
                      )} />
                    </div>
                  </TabsContent>
                )}

              </div>
            </Tabs>

            {/* ─── Footer ──────────────────────────────────────────────────── */}
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Tenant"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
