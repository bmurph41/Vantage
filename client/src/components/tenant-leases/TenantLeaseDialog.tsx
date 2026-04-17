import { useState, useEffect } from "react";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, DollarSign, Building2, Percent } from "lucide-react";

// ── Domain types ───────────────────────────────────────────────────────────────

export interface LeaseListItem {
  id: string;
  projectId: string;
  tenantName: string;
  suiteLabel?: string | null;
  sf: number;
  leaseType: string;
  leaseStartDate: string;
  leaseEndDate: string;
  status: string;
  baseRentMonthly: number;
  escalationDisplay?: string;
  optionsCount?: number;
  percentRentEnabled?: boolean;
  recoveriesEnabled?: boolean;
}

interface ApiRentTerm {
  termType: string;
  optionIndex?: number | null;
  termStartDate: string;
  termEndDate: string;
  baseRentInputUnit: string;
  baseRentInputValue: string;
  escalationType: string;
  escalationValue?: string | null;
  escalationFrequencyMonths?: number | null;
}

interface ApiRecovery {
  recoveryType: string;
  method: string;
  amount?: string | null;
  psfAmount?: string | null;
  adminFeePercent?: string | null;
  grossUpToOccupancy?: string | null;
  nonrecoverablePercent?: string | null;
  expenseGrowthRatePercent?: string | null;
}

interface ApiConcession {
  concessionType: string;
  startDate: string;
  endDate: string;
  value: string;
  notes?: string | null;
}

interface ApiCapex {
  tiAllowancePsf?: string | null;
  tiTotal?: string | null;
  tiPaymentTiming?: string | null;
  lcPercentInitial?: string | null;
  lcPercentRenewal?: string | null;
  lcPaymentTiming?: string | null;
}

interface ApiRollover {
  id?: string;
  assumeRenewal: boolean;
  renewalProbability?: string | null;
  downtimeMonths?: number | null;
  marketRentPsfYear?: string | null;
  marketRentGrowthPercent?: string | null;
  renewalTiPsf?: string | null;
  renewalLcPercent?: string | null;
}

interface ApiPercentageRent {
  enabled: boolean;
  overagePercent?: string | null;
  breakpointAmountAnnual?: string | null;
}

interface LeaseDetail {
  id: string;
  tenantName: string;
  suiteLabel?: string | null;
  sf: string;
  leaseType: string;
  leaseStartDate: string;
  leaseEndDate: string;
  rentCommencementDate?: string | null;
  status: string;
  securityDepositAmount?: string | null;
  securityDepositType: string;
  notes?: string | null;
  rentTerms: ApiRentTerm[];
  recoveries: ApiRecovery[];
  concessions: ApiConcession[];
  capexLeasing: ApiCapex[];
  percentageRent: ApiPercentageRent[];
  rollover?: ApiRollover[];
}

// ── Enums ──────────────────────────────────────────────────────────────────────

const LEASE_TYPES = [
  { value: "NNN", label: "Triple Net (NNN)" },
  { value: "MOD_GROSS", label: "Modified Gross" },
  { value: "FULL_GROSS", label: "Full Service / Gross" },
  { value: "ABSOLUTE_NNN", label: "Absolute Net" },
  { value: "OTHER", label: "Other" },
];

const LEASE_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "FUTURE", label: "Future / Pending" },
  { value: "EXPIRING", label: "Expiring" },
  { value: "EXPIRED", label: "Expired" },
  { value: "ARCHIVED", label: "Archived" },
];

const RENT_INPUT_UNITS = [
  { value: "PSF_YEAR", label: "$/SF/Year" },
  { value: "PER_MONTH", label: "$/Month" },
  { value: "PER_YEAR", label: "$/Year" },
];

const ESCALATION_TYPES = [
  { value: "NONE", label: "None (Flat)" },
  { value: "PERCENT", label: "Fixed %" },
  { value: "FIXED_DOLLAR", label: "Fixed $" },
  { value: "DOLLAR_PSF_YEAR", label: "$/SF/Year Step-Up" },
  { value: "CPI", label: "CPI-Based" },
  { value: "CPI_CAP_FLOOR", label: "CPI with Cap/Floor" },
  { value: "SCHEDULE", label: "Custom Schedule" },
];

const TERM_TYPES = [
  { value: "INITIAL", label: "Initial Term" },
  { value: "OPTION", label: "Option / Renewal" },
];

const RECOVERY_TYPES = [
  { value: "CAM", label: "CAM" },
  { value: "TAXES", label: "Real Estate Taxes" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "TRASH", label: "Trash" },
  { value: "SECURITY", label: "Security" },
  { value: "OTHER", label: "Other" },
];

const RECOVERY_METHODS = [
  { value: "PRO_RATA", label: "Pro-Rata Share" },
  { value: "BASE_YEAR_STOP", label: "Base Year Stop" },
  { value: "EXPENSE_STOP_PSF", label: "Expense Stop ($/SF)" },
  { value: "FIXED_MONTHLY", label: "Fixed Monthly" },
  { value: "FIXED_ANNUAL", label: "Fixed Annual" },
];

const CONCESSION_TYPES = [
  { value: "FREE_RENT", label: "Free Rent" },
  { value: "DISCOUNT_PERCENT", label: "Discount (%)" },
  { value: "DISCOUNT_FIXED", label: "Discount ($)" },
  { value: "OTHER", label: "Other" },
];

const SECURITY_DEPOSIT_TYPES = [
  { value: "NONE", label: "None" },
  { value: "CASH", label: "Cash" },
  { value: "LOC", label: "Letter of Credit" },
];

// ── Schemas ────────────────────────────────────────────────────────────────────

const rentTermSchema = z.object({
  termType: z.string().default("INITIAL"),
  optionIndex: z.string().optional(),
  termStartDate: z.string().min(1, "Start date required"),
  termEndDate: z.string().min(1, "End date required"),
  baseRentInputUnit: z.string().default("PSF_YEAR"),
  baseRentInputValue: z.string().min(1, "Base rent required"),
  escalationType: z.string().default("NONE"),
  escalationValue: z.string().optional(),
  escalationFrequencyMonths: z.string().optional(),
});

const recoverySchema = z.object({
  recoveryType: z.string().min(1),
  method: z.string().min(1),
  amount: z.string().optional(),
  psfAmount: z.string().optional(),
  adminFeePercent: z.string().optional(),
  grossUpToOccupancy: z.string().optional(),
  nonrecoverablePercent: z.string().optional(),
  expenseGrowthRatePercent: z.string().optional(),
});

const concessionSchema = z.object({
  concessionType: z.string().min(1),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  value: z.string().min(1, "Value required"),
  notes: z.string().optional(),
});

const leaseFormSchema = z.object({
  tenantName: z.string().min(1, "Tenant name is required"),
  suiteLabel: z.string().optional(),
  sf: z.string().min(1, "Square footage is required"),
  leaseType: z.string().default("NNN"),
  leaseStartDate: z.string().min(1, "Lease start date is required"),
  leaseEndDate: z.string().min(1, "Lease end date is required"),
  rentCommencementDate: z.string().optional(),
  status: z.string().default("ACTIVE"),
  securityDepositAmount: z.string().optional(),
  securityDepositType: z.string().default("NONE"),
  notes: z.string().optional(),
  rentTerms: z.array(rentTermSchema).default([]),
  recoveries: z.array(recoverySchema).default([]),
  concessions: z.array(concessionSchema).default([]),
  tiAllowancePsf: z.string().optional(),
  tiTotal: z.string().optional(),
  tiPaymentTiming: z.string().optional(),
  lcPercentInitial: z.string().optional(),
  lcPercentRenewal: z.string().optional(),
  lcPaymentTiming: z.string().optional(),
  percentRentEnabled: z.boolean().default(false),
  overagePercent: z.string().optional(),
  breakpointAmountAnnual: z.string().optional(),
  assumeRenewal: z.boolean().default(false),
  renewalProbability: z.string().optional(),
  downtimeMonths: z.string().optional(),
  marketRentPsfYear: z.string().optional(),
  renewalTiPsf: z.string().optional(),
  renewalLcPercent: z.string().optional(),
});

type LeaseFormValues = z.infer<typeof leaseFormSchema>;

interface TenantLeaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  lease?: LeaseListItem;
  initialTab?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TenantLeaseDialog({ open, onOpenChange, projectId, projectName, lease, initialTab }: TenantLeaseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!lease;
  const [activeTab, setActiveTab] = useState(initialTab ?? "basic");

  useEffect(() => {
    if (open) setActiveTab(initialTab ?? "basic");
  }, [open, initialTab]);

  const { data: leaseDetail } = useQuery<LeaseDetail>({
    queryKey: ["/api/tenant-leases", lease?.id],
    enabled: isEditing && open,
    queryFn: async () => {
      const res = await fetch(`/api/tenant-leases/${lease!.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lease detail");
      return res.json() as Promise<LeaseDetail>;
    },
  });

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      tenantName: "",
      suiteLabel: "",
      sf: "",
      leaseType: "NNN",
      leaseStartDate: "",
      leaseEndDate: "",
      rentCommencementDate: "",
      status: "ACTIVE",
      securityDepositAmount: "",
      securityDepositType: "NONE",
      notes: "",
      rentTerms: [],
      recoveries: [],
      concessions: [],
      tiAllowancePsf: "",
      tiTotal: "",
      tiPaymentTiming: "UPFRONT",
      lcPercentInitial: "",
      lcPercentRenewal: "",
      lcPaymentTiming: "AT_SIGNING",
      percentRentEnabled: false,
      overagePercent: "",
      breakpointAmountAnnual: "",
      assumeRenewal: false,
      renewalProbability: "",
      downtimeMonths: "",
      marketRentPsfYear: "",
      renewalTiPsf: "",
      renewalLcPercent: "",
    },
  });

  const { fields: rentTermFields, append: appendRentTerm, remove: removeRentTerm } = useFieldArray({ control: form.control, name: "rentTerms" });
  const { fields: recoveryFields, append: appendRecovery, remove: removeRecovery } = useFieldArray({ control: form.control, name: "recoveries" });
  const { fields: concessionFields, append: appendConcession, remove: removeConcession } = useFieldArray({ control: form.control, name: "concessions" });

  useEffect(() => {
    if (leaseDetail && open) {
      const capex = leaseDetail.capexLeasing?.[0] ?? null;
      const pr = leaseDetail.percentageRent?.[0] ?? null;
      const ro = leaseDetail.rollover?.[0] ?? null;
      form.reset({
        tenantName: leaseDetail.tenantName ?? "",
        suiteLabel: leaseDetail.suiteLabel ?? "",
        sf: leaseDetail.sf ? String(leaseDetail.sf) : "",
        leaseType: leaseDetail.leaseType ?? "NNN",
        leaseStartDate: leaseDetail.leaseStartDate ?? "",
        leaseEndDate: leaseDetail.leaseEndDate ?? "",
        rentCommencementDate: leaseDetail.rentCommencementDate ?? "",
        status: leaseDetail.status ?? "ACTIVE",
        securityDepositAmount: leaseDetail.securityDepositAmount ? String(leaseDetail.securityDepositAmount) : "",
        securityDepositType: leaseDetail.securityDepositType ?? "NONE",
        notes: leaseDetail.notes ?? "",
        rentTerms: (leaseDetail.rentTerms ?? []).map((t: ApiRentTerm) => ({
          termType: t.termType ?? "INITIAL",
          optionIndex: t.optionIndex != null ? String(t.optionIndex) : "",
          termStartDate: t.termStartDate ?? "",
          termEndDate: t.termEndDate ?? "",
          baseRentInputUnit: t.baseRentInputUnit ?? "PSF_YEAR",
          baseRentInputValue: t.baseRentInputValue ? String(t.baseRentInputValue) : "",
          escalationType: t.escalationType ?? "NONE",
          escalationValue: t.escalationValue ? String(t.escalationValue) : "",
          escalationFrequencyMonths: t.escalationFrequencyMonths != null ? String(t.escalationFrequencyMonths) : "",
        })),
        recoveries: (leaseDetail.recoveries ?? []).map((r: ApiRecovery) => ({
          recoveryType: r.recoveryType ?? "CAM",
          method: r.method ?? "PRO_RATA",
          amount: r.amount ? String(r.amount) : "",
          psfAmount: r.psfAmount ? String(r.psfAmount) : "",
          adminFeePercent: r.adminFeePercent ? String(r.adminFeePercent) : "",
          grossUpToOccupancy: r.grossUpToOccupancy ? String(r.grossUpToOccupancy) : "",
          nonrecoverablePercent: r.nonrecoverablePercent ? String(r.nonrecoverablePercent) : "",
          expenseGrowthRatePercent: r.expenseGrowthRatePercent ? String(r.expenseGrowthRatePercent) : "",
        })),
        concessions: (leaseDetail.concessions ?? []).map((c: ApiConcession) => ({
          concessionType: c.concessionType ?? "FREE_RENT",
          startDate: c.startDate ?? "",
          endDate: c.endDate ?? "",
          value: c.value ? String(c.value) : "",
          notes: c.notes ?? "",
        })),
        tiAllowancePsf: capex?.tiAllowancePsf ? String(capex.tiAllowancePsf) : "",
        tiTotal: capex?.tiTotal ? String(capex.tiTotal) : "",
        tiPaymentTiming: capex?.tiPaymentTiming ?? "UPFRONT",
        lcPercentInitial: capex?.lcPercentInitial ? String(capex.lcPercentInitial) : "",
        lcPercentRenewal: capex?.lcPercentRenewal ? String(capex.lcPercentRenewal) : "",
        lcPaymentTiming: capex?.lcPaymentTiming ?? "AT_SIGNING",
        percentRentEnabled: pr?.enabled ?? false,
        overagePercent: pr?.overagePercent ? String(pr.overagePercent) : "",
        breakpointAmountAnnual: pr?.breakpointAmountAnnual ? String(pr.breakpointAmountAnnual) : "",
        assumeRenewal: ro?.assumeRenewal ?? false,
        renewalProbability: ro?.renewalProbability ? String(ro.renewalProbability) : "",
        downtimeMonths: ro?.downtimeMonths != null ? String(ro.downtimeMonths) : "",
        marketRentPsfYear: ro?.marketRentPsfYear ? String(ro.marketRentPsfYear) : "",
        renewalTiPsf: ro?.renewalTiPsf ? String(ro.renewalTiPsf) : "",
        renewalLcPercent: ro?.renewalLcPercent ? String(ro.renewalLcPercent) : "",
      });
    } else if (!isEditing && !open) {
      form.reset();
    }
  }, [leaseDetail, open, isEditing]);

  const mutation = useMutation({
    mutationFn: async (values: LeaseFormValues) => {
      const {
        rentTerms, recoveries, concessions,
        tiAllowancePsf, tiTotal, tiPaymentTiming,
        lcPercentInitial, lcPercentRenewal, lcPaymentTiming,
        percentRentEnabled, overagePercent, breakpointAmountAnnual,
        assumeRenewal, renewalProbability, downtimeMonths,
        marketRentPsfYear, renewalTiPsf, renewalLcPercent,
        ...leaseData
      } = values;

      let leaseId: string;
      if (isEditing) {
        await apiRequest("PATCH", `/api/tenant-leases/${lease!.id}`, leaseData);
        leaseId = lease!.id;
      } else {
        const res = await apiRequest("POST", "/api/tenant-leases", { ...leaseData, projectId });
        const created = await res.json() as { id: string };
        leaseId = created.id;
      }

      if (isEditing) {
        const termRes = await fetch(`/api/tenant-leases/${leaseId}/rent-terms`, { credentials: "include" });
        if (termRes.ok) {
          const existing = await termRes.json() as Array<{ id: string }>;
          for (const t of existing) {
            await apiRequest("DELETE", `/api/tenant-leases/${leaseId}/rent-terms/${t.id}`);
          }
        }
      }
      for (const term of rentTerms) {
        await apiRequest("POST", `/api/tenant-leases/${leaseId}/rent-terms`, {
          ...term,
          leaseId,
          optionIndex: term.optionIndex ? parseInt(term.optionIndex, 10) : null,
          escalationFrequencyMonths: term.escalationFrequencyMonths ? parseInt(term.escalationFrequencyMonths, 10) : null,
        });
      }

      if (isEditing) {
        const recRes = await fetch(`/api/tenant-leases/${leaseId}/recoveries`, { credentials: "include" });
        if (recRes.ok) {
          const existing = await recRes.json() as Array<{ id: string }>;
          for (const r of existing) {
            await apiRequest("DELETE", `/api/tenant-leases/${leaseId}/recoveries/${r.id}`);
          }
        }
      }
      for (const rec of recoveries) {
        await apiRequest("POST", `/api/tenant-leases/${leaseId}/recoveries`, { ...rec, leaseId });
      }

      if (isEditing) {
        const concRes = await fetch(`/api/tenant-leases/${leaseId}/concessions`, { credentials: "include" });
        if (concRes.ok) {
          const existing = await concRes.json() as Array<{ id: string }>;
          for (const c of existing) {
            await apiRequest("DELETE", `/api/tenant-leases/${leaseId}/concessions/${c.id}`);
          }
        }
      }
      for (const conc of concessions) {
        await apiRequest("POST", `/api/tenant-leases/${leaseId}/concessions`, { ...conc, leaseId });
      }

      await apiRequest("POST", `/api/tenant-leases/${leaseId}/capex`, {
        leaseId,
        tiAllowancePsf: tiAllowancePsf || null,
        tiTotal: tiTotal || null,
        tiPaymentTiming: tiPaymentTiming || null,
        lcPercentInitial: lcPercentInitial || null,
        lcPercentRenewal: lcPercentRenewal || null,
        lcPaymentTiming: lcPaymentTiming || null,
      });

      await apiRequest("POST", `/api/tenant-leases/${leaseId}/percentage-rent`, {
        leaseId,
        enabled: percentRentEnabled,
        overagePercent: overagePercent || null,
        breakpointAmountAnnual: breakpointAmountAnnual || null,
      });

      await apiRequest("POST", `/api/tenant-leases/${leaseId}/rollover`, {
        leaseId,
        assumeRenewal,
        renewalProbability: renewalProbability || null,
        downtimeMonths: downtimeMonths ? parseInt(downtimeMonths, 10) : null,
        marketRentPsfYear: marketRentPsfYear || null,
        renewalTiPsf: renewalTiPsf || null,
        renewalLcPercent: renewalLcPercent || null,
      });

      return { leaseId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuator", projectId, "leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/valuator", projectId, "leases/kpis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant-leases", lease?.id] });
      toast({ title: "Success", description: isEditing ? "Lease updated" : "Lease created" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to save lease", variant: "destructive" });
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {isEditing ? `Edit Lease — ${lease?.tenantName}` : "Add Tenant Lease"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update lease details and sub-records" : `Add a new tenant lease to ${projectName}`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="grid grid-cols-6 w-full">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="rentTerms">Rent Terms</TabsTrigger>
                <TabsTrigger value="recoveries">Recoveries</TabsTrigger>
                <TabsTrigger value="concessions">Concessions</TabsTrigger>
                <TabsTrigger value="capex">CapEx</TabsTrigger>
                <TabsTrigger value="rollover">Rollover</TabsTrigger>
              </TabsList>

              <div className="overflow-y-auto flex-1 mt-4">

                {/* ── BASIC INFO ────────────────────────────────────────────── */}
                <TabsContent value="basic" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="tenantName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant Name *</FormLabel>
                        <FormControl><Input placeholder="e.g. Acme Corp" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="suiteLabel" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suite / Unit</FormLabel>
                        <FormControl><Input placeholder="e.g. Suite 101" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="sf" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Footage (SF) *</FormLabel>
                        <FormControl><Input type="number" placeholder="5000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="leaseType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease Type *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {LEASE_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {LEASE_STATUSES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="leaseStartDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease Start *</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="leaseEndDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease End *</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="rentCommencementDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent Commencement</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="securityDepositAmount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Security Deposit ($)</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="securityDepositType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deposit Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {SECURITY_DEPOSIT_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea rows={3} placeholder="Any additional notes..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="border rounded-md p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2"><Percent className="h-4 w-4" />Percentage Rent</span>
                      <FormField control={form.control} name="percentRentEnabled" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                    {form.watch("percentRentEnabled") && (
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="breakpointAmountAnnual" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Natural Breakpoint ($/yr)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="500000" className="h-8 text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="overagePercent" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Overage % (e.g. 0.06)</FormLabel>
                            <FormControl><Input type="number" step="0.0001" placeholder="0.06" className="h-8 text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── RENT TERMS ────────────────────────────────────────────── */}
                <TabsContent value="rentTerms" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Rent Terms</p>
                      <p className="text-sm text-muted-foreground">Add initial term and option periods with escalation</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendRentTerm({
                      termType: rentTermFields.length === 0 ? "INITIAL" : "OPTION",
                      optionIndex: "",
                      termStartDate: "",
                      termEndDate: "",
                      baseRentInputUnit: "PSF_YEAR",
                      baseRentInputValue: "",
                      escalationType: "NONE",
                      escalationValue: "",
                      escalationFrequencyMonths: "",
                    })}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Term
                    </Button>
                  </div>

                  {rentTermFields.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No rent terms added yet</p>
                      <p className="text-xs">Add at least one initial term to define base rent</p>
                    </div>
                  )}

                  {rentTermFields.map((field, idx) => (
                    <Card key={field.id}>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            Term {idx + 1} — {form.watch(`rentTerms.${idx}.termType`) === "INITIAL" ? "Initial" : "Option"}
                          </CardTitle>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRentTerm(idx)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={form.control} name={`rentTerms.${idx}.termType`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Term Type</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {TERM_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`rentTerms.${idx}.baseRentInputUnit`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Rent Unit</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {RENT_INPUT_UNITS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <FormField control={form.control} name={`rentTerms.${idx}.termStartDate`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Start Date</FormLabel>
                              <FormControl><Input type="date" className="h-8 text-sm" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`rentTerms.${idx}.termEndDate`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">End Date</FormLabel>
                              <FormControl><Input type="date" className="h-8 text-sm" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`rentTerms.${idx}.baseRentInputValue`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Base Rent Value</FormLabel>
                              <FormControl><Input type="number" step="0.01" placeholder="25.00" className="h-8 text-sm" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <FormField control={form.control} name={`rentTerms.${idx}.escalationType`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Escalation</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {ESCALATION_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          {form.watch(`rentTerms.${idx}.escalationType`) !== "NONE" && (
                            <FormField control={form.control} name={`rentTerms.${idx}.escalationValue`} render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Escalation Value</FormLabel>
                                <FormControl><Input type="number" step="0.0001" placeholder="0.03" className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          )}
                          {form.watch(`rentTerms.${idx}.escalationType`) !== "NONE" && (
                            <FormField control={form.control} name={`rentTerms.${idx}.escalationFrequencyMonths`} render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Frequency (months)</FormLabel>
                                <FormControl><Input type="number" placeholder="12" className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                {/* ── RECOVERIES ────────────────────────────────────────────── */}
                <TabsContent value="recoveries" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Expense Recoveries</p>
                      <p className="text-sm text-muted-foreground">CAM, taxes, insurance, and other recovery structures</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendRecovery({
                      recoveryType: "CAM",
                      method: "PRO_RATA",
                      amount: "",
                      psfAmount: "",
                      adminFeePercent: "",
                      grossUpToOccupancy: "",
                      nonrecoverablePercent: "",
                      expenseGrowthRatePercent: "",
                    })}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Recovery
                    </Button>
                  </div>

                  {recoveryFields.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                      <p className="text-sm">No expense recoveries configured</p>
                      <p className="text-xs">NNN leases typically include CAM, taxes, and insurance recoveries</p>
                    </div>
                  )}

                  {recoveryFields.map((field, idx) => (
                    <Card key={field.id}>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {form.watch(`recoveries.${idx}.recoveryType`) || "Recovery"} — {form.watch(`recoveries.${idx}.method`) || ""}
                          </CardTitle>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRecovery(idx)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={form.control} name={`recoveries.${idx}.recoveryType`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Recovery Type</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {RECOVERY_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`recoveries.${idx}.method`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Method</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {RECOVERY_METHODS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {["PRO_RATA", "BASE_YEAR_STOP", "FIXED_MONTHLY", "FIXED_ANNUAL"].includes(form.watch(`recoveries.${idx}.method`)) && (
                            <FormField control={form.control} name={`recoveries.${idx}.amount`} render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Amount ($)</FormLabel>
                                <FormControl><Input type="number" step="0.01" className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          )}
                          {["EXPENSE_STOP_PSF", "PRO_RATA"].includes(form.watch(`recoveries.${idx}.method`)) && (
                            <FormField control={form.control} name={`recoveries.${idx}.psfAmount`} render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">$/SF Amount</FormLabel>
                                <FormControl><Input type="number" step="0.01" className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          )}
                          <FormField control={form.control} name={`recoveries.${idx}.adminFeePercent`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Admin Fee %</FormLabel>
                              <FormControl><Input type="number" step="0.01" placeholder="0.15" className="h-8 text-sm" {...field} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                {/* ── CONCESSIONS ───────────────────────────────────────────── */}
                <TabsContent value="concessions" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Concessions</p>
                      <p className="text-sm text-muted-foreground">Free rent, discounts, and other tenant incentives</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendConcession({
                      concessionType: "FREE_RENT",
                      startDate: "",
                      endDate: "",
                      value: "",
                      notes: "",
                    })}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Concession
                    </Button>
                  </div>

                  {concessionFields.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                      <p className="text-sm">No concessions configured</p>
                    </div>
                  )}

                  {concessionFields.map((field, idx) => (
                    <Card key={field.id}>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">Concession {idx + 1}</CardTitle>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeConcession(idx)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        <FormField control={form.control} name={`concessions.${idx}.concessionType`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                {CONCESSION_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-3 gap-3">
                          <FormField control={form.control} name={`concessions.${idx}.startDate`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Start</FormLabel>
                              <FormControl><Input type="date" className="h-8 text-sm" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`concessions.${idx}.endDate`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">End</FormLabel>
                              <FormControl><Input type="date" className="h-8 text-sm" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`concessions.${idx}.value`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Value</FormLabel>
                              <FormControl><Input type="number" step="0.01" className="h-8 text-sm" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name={`concessions.${idx}.notes`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Notes</FormLabel>
                            <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                {/* ── CAPEX ─────────────────────────────────────────────────── */}
                <TabsContent value="capex" className="space-y-4 mt-0">
                  <p className="font-medium">CapEx / Leasing Costs</p>
                  <p className="text-sm text-muted-foreground">Tenant improvement allowances and leasing commission structure</p>

                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-medium">Tenant Improvements (TI)</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <FormField control={form.control} name="tiAllowancePsf" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">TI Allowance ($/SF)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="50.00" className="h-8 text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="tiTotal" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">TI Total ($)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="250000" className="h-8 text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="tiPaymentTiming" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Payment Timing</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="UPFRONT">Upfront</SelectItem>
                                <SelectItem value="REIMBURSEMENT">Reimbursement</SelectItem>
                                <SelectItem value="DRAW_SCHEDULE">Draw Schedule</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-medium">Leasing Commissions (LC)</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <FormField control={form.control} name="lcPercentInitial" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">LC % Initial (e.g. 0.05)</FormLabel>
                            <FormControl><Input type="number" step="0.001" placeholder="0.05" className="h-8 text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="lcPercentRenewal" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">LC % Renewal</FormLabel>
                            <FormControl><Input type="number" step="0.001" placeholder="0.025" className="h-8 text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="lcPaymentTiming" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Payment Timing</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="AT_SIGNING">At Signing</SelectItem>
                                <SelectItem value="SPREAD">Spread</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── ROLLOVER ASSUMPTIONS ──────────────────────────────────── */}
                <TabsContent value="rollover" className="space-y-4 mt-0">
                  <div>
                    <p className="font-medium">Rollover Assumptions</p>
                    <p className="text-sm text-muted-foreground">
                      Define re-leasing risk parameters used in underwriting scenarios after lease expiration
                    </p>
                  </div>

                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span>Renewal Scenario</span>
                        <FormField control={form.control} name="assumeRenewal" render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormLabel className="text-xs font-normal">Assume Renewal</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="renewalProbability" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Renewal Probability (0–1)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min="0" max="1" placeholder="0.70" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="downtimeMonths" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Downtime Months</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="1" placeholder="6" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-medium">Market Rent & Leasing Costs</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <FormField control={form.control} name="marketRentPsfYear" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Market Rent ($/SF/yr)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="28.00" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="renewalTiPsf" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Renewal TI ($/SF)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="20.00" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="renewalLcPercent" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Renewal LC % (e.g. 0.03)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.001" min="0" placeholder="0.03" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isEditing ? "Update Lease" : "Create Lease"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
