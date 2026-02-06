import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign } from "lucide-react";

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

const SECURITY_DEPOSIT_TYPE_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "LOC", label: "Letter of Credit" },
  { value: "NONE", label: "None" },
] as const;

const formSchema = z.object({
  tenantName: z.string().min(1, "Tenant name is required"),
  tradeName: z.string().optional(),
  suiteLabel: z.string().optional(),
  squareFootage: z.string().optional(),
  proRataShare: z.string().optional(),
  permittedUse: z.string().optional(),

  leaseStartDate: z.string().min(1, "Start date is required"),
  leaseEndDate: z.string().min(1, "End date is required"),
  rentStartDate: z.string().optional(),

  leaseType: z.enum(["NNN", "MOD_GROSS", "FULL_GROSS", "ABSOLUTE_NNN", "OTHER"]),
  rentStructure: z.enum(["base_only", "base_plus_percentage", "percentage_only"]),
  tenantStatus: z.enum(["ACTIVE", "FUTURE", "EXPIRING", "EXPIRED", "ARCHIVED"]),

  baseRentInputUnit: z.enum(["PSF_YEAR", "PER_MONTH", "PER_YEAR"]),
  baseRentInputValue: z.string().optional(),
  rentFreePeriodMonths: z.string().optional(),

  escalationType: z.enum(["NONE", "PERCENT", "FIXED_DOLLAR", "DOLLAR_PSF_YEAR", "CPI"]),
  escalationRate: z.string().optional(),
  escalationAmount: z.string().optional(),
  escalationFrequencyMonths: z.string().optional(),

  securityDeposit: z.string().optional(),
  securityDepositType: z.enum(["CASH", "LOC", "NONE"]),

  percentageRentRate: z.string().optional(),
  naturalBreakpoint: z.string().optional(),

  estimatedCamPerSF: z.string().optional(),
  estimatedTaxPerSF: z.string().optional(),
  estimatedInsurancePerSF: z.string().optional(),

  renewalOptions: z.string().optional(),
  renewalTermYears: z.string().optional(),
  renewalNoticeMonths: z.string().optional(),

  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const LEASE_TYPE_MAP_TO_OPS: Record<string, string> = {
  NNN: "nnn",
  MOD_GROSS: "modified_gross",
  FULL_GROSS: "full_service",
  ABSOLUTE_NNN: "absolute_net",
  OTHER: "double_net",
};

const LEASE_TYPE_MAP_FROM_OPS: Record<string, string> = {
  nnn: "NNN",
  modified_gross: "MOD_GROSS",
  full_service: "FULL_GROSS",
  double_net: "OTHER",
  absolute_net: "ABSOLUTE_NNN",
};

const STATUS_MAP_TO_OPS: Record<string, string> = {
  ACTIVE: "active",
  FUTURE: "pending",
  EXPIRING: "month_to_month",
  EXPIRED: "expired",
  ARCHIVED: "terminated",
};

const STATUS_MAP_FROM_OPS: Record<string, string> = {
  active: "ACTIVE",
  pending: "FUTURE",
  month_to_month: "EXPIRING",
  expired: "EXPIRED",
  terminated: "ARCHIVED",
};

const ESCALATION_MAP_TO_OPS: Record<string, string> = {
  NONE: "none",
  PERCENT: "fixed_percent",
  FIXED_DOLLAR: "fixed_dollar",
  CPI: "cpi",
  DOLLAR_PSF_YEAR: "fixed_dollar",
};

const ESCALATION_MAP_FROM_OPS: Record<string, string> = {
  none: "NONE",
  fixed_percent: "PERCENT",
  fixed_dollar: "FIXED_DOLLAR",
  cpi: "CPI",
  fair_market_value: "NONE",
};

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
}

interface UnifiedTenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: "operations" | "valuator";
  tenant?: ExistingTenantData | null;
  projectId?: string;
  projectName?: string;
}

const DEFAULT_VALUES: FormValues = {
  tenantName: "",
  tradeName: "",
  suiteLabel: "",
  squareFootage: "",
  proRataShare: "",
  permittedUse: "",
  leaseStartDate: "",
  leaseEndDate: "",
  rentStartDate: "",
  leaseType: "NNN",
  rentStructure: "base_only",
  tenantStatus: "ACTIVE",
  baseRentInputUnit: "PSF_YEAR",
  baseRentInputValue: "",
  rentFreePeriodMonths: "",
  escalationType: "NONE",
  escalationRate: "",
  escalationAmount: "",
  escalationFrequencyMonths: "12",
  securityDeposit: "",
  securityDepositType: "NONE",
  percentageRentRate: "",
  naturalBreakpoint: "",
  estimatedCamPerSF: "",
  estimatedTaxPerSF: "",
  estimatedInsurancePerSF: "",
  renewalOptions: "",
  renewalTermYears: "",
  renewalNoticeMonths: "",
  notes: "",
};

function tenantToFormValues(tenant: ExistingTenantData, context: "operations" | "valuator"): FormValues {
  if (context === "operations") {
    let depositType: FormValues["securityDepositType"] = "NONE";
    if (tenant.letterOfCreditAmount && parseFloat(tenant.letterOfCreditAmount) > 0) {
      depositType = "LOC";
    } else if (tenant.securityDeposit && parseFloat(tenant.securityDeposit) > 0) {
      depositType = "CASH";
    }

    const hasBaseRentPerSF = tenant.baseRentPerSF && parseFloat(tenant.baseRentPerSF) > 0;
    const rentUnit: FormValues["baseRentInputUnit"] = hasBaseRentPerSF ? "PSF_YEAR" : "PER_YEAR";
    const rentValue = hasBaseRentPerSF ? tenant.baseRentPerSF : tenant.currentBaseRent;

    return {
      tenantName: tenant.tenantName || "",
      tradeName: tenant.tradeName || "",
      suiteLabel: tenant.suiteNumber || "",
      squareFootage: tenant.squareFootage || "",
      proRataShare: tenant.proRataShare || "",
      permittedUse: tenant.permittedUse || "",
      leaseStartDate: tenant.leaseCommencementDate || "",
      leaseEndDate: tenant.leaseExpirationDate || "",
      rentStartDate: tenant.rentStartDate || "",
      leaseType: (LEASE_TYPE_MAP_FROM_OPS[tenant.leaseType || ""] || "NNN") as FormValues["leaseType"],
      rentStructure: (tenant.rentStructure || "base_only") as FormValues["rentStructure"],
      tenantStatus: (STATUS_MAP_FROM_OPS[tenant.tenantStatus || ""] || "ACTIVE") as FormValues["tenantStatus"],
      baseRentInputUnit: rentUnit,
      baseRentInputValue: rentValue || "",
      rentFreePeriodMonths: tenant.rentFreePeriodMonths?.toString() || "",
      escalationType: (ESCALATION_MAP_FROM_OPS[tenant.escalationType || ""] || "NONE") as FormValues["escalationType"],
      escalationRate: tenant.escalationRate || "",
      escalationAmount: tenant.escalationAmount || "",
      escalationFrequencyMonths: tenant.escalationFrequency?.toString() || "12",
      securityDeposit: depositType === "LOC" ? (tenant.letterOfCreditAmount || "") : (tenant.securityDeposit || ""),
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
    };
  }

  return {
    tenantName: tenant.tenantName || "",
    tradeName: "",
    suiteLabel: tenant.suiteLabel || "",
    squareFootage: tenant.sf?.toString() || "",
    proRataShare: "",
    permittedUse: "",
    leaseStartDate: tenant.leaseStartDate || "",
    leaseEndDate: tenant.leaseEndDate || "",
    rentStartDate: "",
    leaseType: (tenant.leaseType || "NNN") as FormValues["leaseType"],
    rentStructure: "base_only",
    tenantStatus: (tenant.status || "ACTIVE") as FormValues["tenantStatus"],
    baseRentInputUnit: (tenant.baseRentInputUnit || "PSF_YEAR") as FormValues["baseRentInputUnit"],
    baseRentInputValue: tenant.baseRentInputValue?.toString() || "",
    rentFreePeriodMonths: "",
    escalationType: (tenant.escalationType || "NONE") as FormValues["escalationType"],
    escalationRate: "",
    escalationAmount: "",
    escalationFrequencyMonths: tenant.escalationFrequencyMonths?.toString() || "12",
    securityDeposit: tenant.securityDepositAmount?.toString() || "",
    securityDepositType: (tenant.securityDepositType || "NONE") as FormValues["securityDepositType"],
    percentageRentRate: "",
    naturalBreakpoint: "",
    estimatedCamPerSF: "",
    estimatedTaxPerSF: "",
    estimatedInsurancePerSF: "",
    renewalOptions: "",
    renewalTermYears: "",
    renewalNoticeMonths: "",
    notes: tenant.notes || "",
  };
}

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

  useEffect(() => {
    if (tenant) {
      form.reset(tenantToFormValues(tenant, context));
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [tenant, context, form]);

  const watchedSF = form.watch("squareFootage");
  const watchedRentValue = form.watch("baseRentInputValue");
  const watchedRentUnit = form.watch("baseRentInputUnit");

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

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (context === "operations") {
        const payload = {
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
          securityDeposit: values.securityDepositType === "CASH" ? (values.securityDeposit || null) : null,
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
        };

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
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiRequest(`/api/valuator/${projectId}/leases`, {
        method: "POST",
        body: JSON.stringify(payload),
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

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  const showRentPreview = derivedRent.yearly > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="expenses">NNN / CAM</TabsTrigger>
                <TabsTrigger value="options">Options</TabsTrigger>
              </TabsList>

              {/* ───── TAB 1: BASIC INFO ───── */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tenantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ABC Retail Inc." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tradeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trade Name (DBA)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ABC Store" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="suiteLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suite / Unit</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Suite 101" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="squareFootage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Footage {context === "valuator" ? "*" : ""}</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="2,500" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="proRataShare"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pro-Rata Share (%)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="12.50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="leaseStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commencement Date *</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leaseEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration Date *</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rentStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent Start Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="leaseType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEASE_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rentStructure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent Structure</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RENT_STRUCTURE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tenantStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="permittedUse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permitted Use</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Retail sales of marine supplies and accessories..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* ───── TAB 2: FINANCIAL ───── */}
              <TabsContent value="financial" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="baseRentInputUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent Input Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RENT_UNIT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="baseRentInputValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Rent Amount *</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="20.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rentFreePeriodMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent-Free Period (months)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {showRentPreview && (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Derived Rent</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Monthly:</span>{" "}
                        <span className="font-mono font-medium">${derivedRent.monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Annual:</span>{" "}
                        <span className="font-mono font-medium">${derivedRent.yearly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">$/SF/Yr:</span>{" "}
                        <span className="font-mono font-medium">${derivedRent.psfYear.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="escalationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escalation Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ESCALATION_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="escalationRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escalation Rate (%)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="3.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="escalationFrequencyMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escalation Frequency (mo)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="securityDeposit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Security Deposit ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="10000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="securityDepositType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deposit Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SECURITY_DEPOSIT_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="percentageRentRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Percentage Rent Rate (%)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="6.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="naturalBreakpoint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Natural Breakpoint ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="833333" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* ───── TAB 3: NNN / CAM ───── */}
              <TabsContent value="expenses" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="estimatedCamPerSF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CAM per SF/Year ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="5.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedTaxPerSF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax per SF/Year ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="3.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedInsurancePerSF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance per SF/Year ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="1.50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* ───── TAB 4: OPTIONS ───── */}
              <TabsContent value="options" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="renewalOptions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Renewals</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="2" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="renewalTermYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Renewal Term (years)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="renewalNoticeMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notice Period (months)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="6" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Additional lease terms or notes..." rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4">
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
