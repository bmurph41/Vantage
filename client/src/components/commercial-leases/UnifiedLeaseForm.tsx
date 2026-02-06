/**
 * UnifiedLeaseForm
 * ================
 * Create/Edit dialog shared between Operations and Valuator.
 * Tabbed layout: Basic Info, Financial/Rent, Escalations, Options.
 * Same form fields, same validation — context only affects save endpoint.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLeaseContext } from "./LeaseContextProvider";
import { useUnifiedLeaseMutations } from "@/hooks/use-unified-leases";

// ─── Types & Constants ──────────────────────────────────────────────────────

type LeaseType = "retail" | "office" | "industrial" | "other";
type BaseRentMode = "PER_SF_YEAR" | "PER_MONTH" | "PER_YEAR";
type EscalationType = "NONE" | "FIXED_DOLLAR" | "FIXED_PER_SF" | "PERCENT" | "CPI";

const LEASE_TYPE_OPTIONS: { value: LeaseType; label: string }[] = [
  { value: "retail", label: "Retail" },
  { value: "office", label: "Office" },
  { value: "industrial", label: "Industrial" },
  { value: "other", label: "Other" },
];

const RENT_MODE_OPTIONS: { value: BaseRentMode; label: string }[] = [
  { value: "PER_SF_YEAR", label: "$/SF/Year" },
  { value: "PER_MONTH", label: "$/Month" },
  { value: "PER_YEAR", label: "$/Year" },
];

const ESCALATION_OPTIONS: { value: EscalationType; label: string }[] = [
  { value: "NONE", label: "None (Flat)" },
  { value: "PERCENT", label: "% Annual" },
  { value: "FIXED_DOLLAR", label: "$ Step-Up" },
  { value: "FIXED_PER_SF", label: "$/SF/Yr Step-Up" },
  { value: "CPI", label: "CPI" },
];

interface FormData {
  // Tenant
  tenantName: string;
  suite: string;
  sf: string;
  leaseType: LeaseType;
  units: string;
  active: boolean;
  // Dates
  commencementDate: string;
  rentCommencementDate: string;
  expirationDate: string;
  // Rent
  baseRentMode: BaseRentMode;
  baseRentValue: string;
  // Escalation
  escalationType: EscalationType;
  escalationValue: string;
  escalationCycleMonths: string;
  // Security
  securityDeposit: string;
  fiscalYearEndMonth: string;
  // Notes
  notes: string;
  // Operations-specific
  propertyId: string;
}

const getDefaultFormData = (): FormData => ({
  tenantName: "",
  suite: "",
  sf: "",
  leaseType: "retail",
  units: "1",
  active: true,
  commencementDate: "",
  rentCommencementDate: "",
  expirationDate: "",
  baseRentMode: "PER_SF_YEAR",
  baseRentValue: "",
  escalationType: "PERCENT",
  escalationValue: "3",
  escalationCycleMonths: "12",
  securityDeposit: "",
  fiscalYearEndMonth: "12",
  notes: "",
  propertyId: "",
});

// ─── Derived Rent Calculator ─────────────────────────────────────────────────

function getDerivedRent(fd: FormData) {
  const sf = parseFloat(fd.sf) || 0;
  const val = parseFloat(fd.baseRentValue) || 0;
  if (!sf || !val) return { monthly: 0, yearly: 0, psfYear: 0 };

  switch (fd.baseRentMode) {
    case "PER_SF_YEAR":
      return {
        psfYear: val,
        yearly: val * sf,
        monthly: (val * sf) / 12,
      };
    case "PER_MONTH":
      return {
        monthly: val,
        yearly: val * 12,
        psfYear: sf > 0 ? (val * 12) / sf : 0,
      };
    case "PER_YEAR":
      return {
        yearly: val,
        monthly: val / 12,
        psfYear: sf > 0 ? val / sf : 0,
      };
    default:
      return { monthly: 0, yearly: 0, psfYear: 0 };
  }
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);

// ─── Component ──────────────────────────────────────────────────────────────

interface UnifiedLeaseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLease?: any | null;
}

export function UnifiedLeaseForm({
  open,
  onOpenChange,
  editingLease,
}: UnifiedLeaseFormProps) {
  const { mode, propertyId: ctxPropertyId } = useLeaseContext();
  const { toast } = useToast();
  const { createLease, updateLease } = useUnifiedLeaseMutations();
  const isEditing = !!editingLease;

  const [fd, setFd] = useState<FormData>(getDefaultFormData());

  // Populate form when editing
  useEffect(() => {
    if (editingLease) {
      setFd({
        tenantName: editingLease.tenantName || "",
        suite: editingLease.suite || "",
        sf: editingLease.sf ? String(parseFloat(editingLease.sf)) : "",
        leaseType: editingLease.leaseType || "retail",
        units: editingLease.units ? String(editingLease.units) : "1",
        active: editingLease.active !== false,
        commencementDate: editingLease.commencementDate || "",
        rentCommencementDate: editingLease.rentCommencementDate || "",
        expirationDate: editingLease.expirationDate || "",
        baseRentMode: editingLease._termBaseRentMode || "PER_SF_YEAR",
        baseRentValue: editingLease._termBaseRentValue || "",
        escalationType: editingLease._termEscalationType || "NONE",
        escalationValue: editingLease._termEscalationValue || "",
        escalationCycleMonths: editingLease._termEscalationCycle || "12",
        securityDeposit: editingLease.securityDeposit || "",
        fiscalYearEndMonth: editingLease.fiscalYearEndMonth
          ? String(editingLease.fiscalYearEndMonth)
          : "12",
        notes: editingLease.notes || "",
        propertyId: editingLease.propertyId || ctxPropertyId || "",
      });
    } else {
      const defaults = getDefaultFormData();
      defaults.propertyId = ctxPropertyId || "";
      setFd(defaults);
    }
  }, [editingLease, ctxPropertyId]);

  const update = (key: keyof FormData, value: any) =>
    setFd((prev) => ({ ...prev, [key]: value }));

  const derivedRent = getDerivedRent(fd);

  const handleSubmit = () => {
    if (!fd.tenantName.trim()) {
      toast({
        title: "Error",
        description: "Tenant name is required",
        variant: "destructive",
      });
      return;
    }
    if (!fd.commencementDate || !fd.expirationDate) {
      toast({
        title: "Error",
        description: "Lease dates are required",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      lease: {
        tenantName: fd.tenantName.trim(),
        suite: fd.suite || null,
        sf: parseFloat(fd.sf) || 0,
        leaseType: fd.leaseType,
        units: parseInt(fd.units) || 1,
        active: fd.active,
        commencementDate: fd.commencementDate,
        rentCommencementDate: fd.rentCommencementDate || null,
        expirationDate: fd.expirationDate,
        securityDeposit: fd.securityDeposit ? parseFloat(fd.securityDeposit) : null,
        fiscalYearEndMonth: parseInt(fd.fiscalYearEndMonth) || 12,
        notes: fd.notes || null,
        propertyId: fd.propertyId || null,
      },
      initialTerm: {
        termStartDate: fd.commencementDate,
        termEndDate: fd.expirationDate,
        baseRentInputUnit: fd.baseRentMode,
        baseRentInputValue: parseFloat(fd.baseRentValue) || 0,
        escalationType: fd.escalationType,
        escalationValue:
          fd.escalationType !== "NONE" ? parseFloat(fd.escalationValue) : 0,
        escalationFrequencyMonths:
          fd.escalationType !== "NONE"
            ? parseInt(fd.escalationCycleMonths)
            : 12,
      },
    };

    if (isEditing) {
      updateLease.mutate(
        { leaseId: editingLease.id, payload },
        {
          onSuccess: () => {
            toast({ title: "Tenant updated" });
            onOpenChange(false);
          },
          onError: (err: any) =>
            toast({
              title: "Error",
              description: err.message,
              variant: "destructive",
            }),
        }
      );
    } else {
      createLease.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Tenant created" });
          onOpenChange(false);
        },
        onError: (err: any) =>
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          }),
      });
    }
  };

  const isPending = createLease.isPending || updateLease.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Tenant" : "Add Commercial Tenant"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update lease details"
              : mode === "operations"
                ? "Enter lease details for this property"
                : "Enter lease details for this project"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="rent">Rent</TabsTrigger>
            <TabsTrigger value="escalation">Escalation</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Basic Info ── */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tenant Name *</Label>
                <Input
                  value={fd.tenantName}
                  onChange={(e) => update("tenantName", e.target.value)}
                  placeholder="e.g., Ship's Store Inc."
                />
              </div>
              <div className="space-y-2">
                <Label>Suite / Unit</Label>
                <Input
                  value={fd.suite}
                  onChange={(e) => update("suite", e.target.value)}
                  placeholder="e.g., Suite 101"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Square Feet *</Label>
                <Input
                  type="number"
                  value={fd.sf}
                  onChange={(e) => update("sf", e.target.value)}
                  placeholder="2,500"
                />
              </div>
              <div className="space-y-2">
                <Label>Lease Type</Label>
                <Select
                  value={fd.leaseType}
                  onValueChange={(v: LeaseType) => update("leaseType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEASE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Units</Label>
                <Input
                  type="number"
                  value={fd.units}
                  onChange={(e) => update("units", e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Commencement Date *</Label>
                <Input
                  type="date"
                  value={fd.commencementDate}
                  onChange={(e) => update("commencementDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiration Date *</Label>
                <Input
                  type="date"
                  value={fd.expirationDate}
                  onChange={(e) => update("expirationDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rent Commencement</Label>
                <Input
                  type="date"
                  value={fd.rentCommencementDate}
                  onChange={(e) =>
                    update("rentCommencementDate", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={fd.active}
                onCheckedChange={(v) => update("active", v)}
              />
              <Label>Active Lease</Label>
            </div>
          </TabsContent>

          {/* ── Tab 2: Base Rent ── */}
          <TabsContent value="rent" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rent Unit</Label>
                <Select
                  value={fd.baseRentMode}
                  onValueChange={(v: BaseRentMode) =>
                    update("baseRentMode", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENT_MODE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rent Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fd.baseRentValue}
                  onChange={(e) => update("baseRentValue", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {derivedRent.monthly > 0 && (
              <div className="flex gap-4 text-sm text-muted-foreground bg-muted p-3 rounded-md">
                <span>
                  Monthly:{" "}
                  <strong className="text-foreground">
                    {fmt(derivedRent.monthly)}
                  </strong>
                </span>
                <span>
                  Annual:{" "}
                  <strong className="text-foreground">
                    {fmt(derivedRent.yearly)}
                  </strong>
                </span>
                <span>
                  $/SF/Yr:{" "}
                  <strong className="text-foreground">
                    ${derivedRent.psfYear.toFixed(2)}
                  </strong>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Security Deposit ($)</Label>
                <Input
                  type="number"
                  value={fd.securityDeposit}
                  onChange={(e) => update("securityDeposit", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year End Month</Label>
                <Select
                  value={fd.fiscalYearEndMonth}
                  onValueChange={(v) => update("fiscalYearEndMonth", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(2000, m - 1).toLocaleString("default", {
                          month: "long",
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 3: Escalation ── */}
          <TabsContent value="escalation" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Escalation Type</Label>
                <Select
                  value={fd.escalationType}
                  onValueChange={(v: EscalationType) =>
                    update("escalationType", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCALATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {fd.escalationType !== "NONE" && (
                <>
                  <div className="space-y-2">
                    <Label>
                      {fd.escalationType === "PERCENT" ||
                      fd.escalationType === "CPI"
                        ? "Percent (%)"
                        : "Amount ($)"}
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={fd.escalationValue}
                      onChange={(e) =>
                        update("escalationValue", e.target.value)
                      }
                      placeholder={
                        fd.escalationType === "PERCENT" ? "3" : "500"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency (months)</Label>
                    <Input
                      type="number"
                      value={fd.escalationCycleMonths}
                      onChange={(e) =>
                        update("escalationCycleMonths", e.target.value)
                      }
                      placeholder="12"
                    />
                  </div>
                </>
              )}
            </div>

            {fd.escalationType !== "NONE" && derivedRent.yearly > 0 && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                <p>
                  Year 1: {fmt(derivedRent.yearly)} →{" "}
                  Year 2:{" "}
                  {fd.escalationType === "PERCENT"
                    ? fmt(
                        derivedRent.yearly *
                          (1 + (parseFloat(fd.escalationValue) || 0) / 100)
                      )
                    : fmt(
                        derivedRent.yearly +
                          (parseFloat(fd.escalationValue) || 0)
                      )}
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 4: Options & Notes ── */}
          <TabsContent value="options" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={fd.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Additional lease terms, renewal options, co-tenancy clauses..."
                rows={4}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              After creating the lease, you can add detailed renewal option
              terms, charge lines, abatements, percentage rent rules, TI
              programs, and recovery models from the lease detail view.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
