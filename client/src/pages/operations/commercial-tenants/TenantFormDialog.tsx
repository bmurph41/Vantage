import { useEffect } from "react";
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
import { CommercialTenant } from "@shared/schema";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  tenantName: z.string().min(1, "Tenant name is required"),
  tradeName: z.string().optional(),
  suiteNumber: z.string().optional(),
  squareFootage: z.string().optional(),
  proRataShare: z.string().optional(),
  permittedUse: z.string().optional(),
  
  leaseCommencementDate: z.string().min(1, "Commencement date is required"),
  leaseExpirationDate: z.string().min(1, "Expiration date is required"),
  rentStartDate: z.string().optional(),
  
  leaseType: z.enum(["nnn", "modified_gross", "full_service", "absolute_net", "double_net"]),
  rentStructure: z.enum(["base_only", "base_plus_percentage", "percentage_only"]),
  tenantStatus: z.enum(["active", "pending", "expired", "terminated", "month_to_month"]),
  
  currentBaseRent: z.string().optional(),
  baseRentPerSF: z.string().optional(),
  rentFreePeriodMonths: z.string().optional(),
  
  escalationType: z.enum(["fixed_dollar", "fixed_percent", "cpi", "fair_market_value", "none"]).optional(),
  escalationRate: z.string().optional(),
  escalationAmount: z.string().optional(),
  
  securityDeposit: z.string().optional(),
  
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

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: CommercialTenant | null;
}

export function TenantFormDialog({ open, onOpenChange, tenant }: TenantFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!tenant;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenantName: "",
      leaseType: "nnn",
      rentStructure: "base_only",
      tenantStatus: "active",
      leaseCommencementDate: "",
      leaseExpirationDate: "",
    },
  });

  useEffect(() => {
    if (tenant) {
      form.reset({
        tenantName: tenant.tenantName || "",
        tradeName: tenant.tradeName || "",
        suiteNumber: tenant.suiteNumber || "",
        squareFootage: tenant.squareFootage || "",
        proRataShare: tenant.proRataShare || "",
        permittedUse: tenant.permittedUse || "",
        leaseCommencementDate: tenant.leaseCommencementDate || "",
        leaseExpirationDate: tenant.leaseExpirationDate || "",
        rentStartDate: tenant.rentStartDate || "",
        leaseType: tenant.leaseType as any || "nnn",
        rentStructure: tenant.rentStructure as any || "base_only",
        tenantStatus: tenant.tenantStatus as any || "active",
        currentBaseRent: tenant.currentBaseRent || "",
        baseRentPerSF: tenant.baseRentPerSF || "",
        rentFreePeriodMonths: tenant.rentFreePeriodMonths?.toString() || "",
        escalationType: tenant.escalationType as any || undefined,
        escalationRate: tenant.escalationRate || "",
        escalationAmount: tenant.escalationAmount || "",
        securityDeposit: tenant.securityDeposit || "",
        percentageRentRate: tenant.percentageRentRate || "",
        naturalBreakpoint: tenant.naturalBreakpoint || "",
        estimatedCamPerSF: tenant.estimatedCamPerSF || "",
        estimatedTaxPerSF: tenant.estimatedTaxPerSF || "",
        estimatedInsurancePerSF: tenant.estimatedInsurancePerSF || "",
        renewalOptions: tenant.renewalOptions?.toString() || "",
        renewalTermYears: tenant.renewalTermYears?.toString() || "",
        renewalNoticeMonths: tenant.renewalNoticeMonths?.toString() || "",
        notes: tenant.notes || "",
      });
    } else {
      form.reset({
        tenantName: "",
        leaseType: "nnn",
        rentStructure: "base_only",
        tenantStatus: "active",
        leaseCommencementDate: "",
        leaseExpirationDate: "",
      });
    }
  }, [tenant]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        squareFootage: values.squareFootage || null,
        proRataShare: values.proRataShare || null,
        currentBaseRent: values.currentBaseRent || null,
        baseRentPerSF: values.baseRentPerSF || null,
        rentFreePeriodMonths: values.rentFreePeriodMonths ? parseInt(values.rentFreePeriodMonths) : null,
        escalationRate: values.escalationRate || null,
        escalationAmount: values.escalationAmount || null,
        securityDeposit: values.securityDeposit || null,
        percentageRentRate: values.percentageRentRate || null,
        naturalBreakpoint: values.naturalBreakpoint || null,
        estimatedCamPerSF: values.estimatedCamPerSF || null,
        estimatedTaxPerSF: values.estimatedTaxPerSF || null,
        estimatedInsurancePerSF: values.estimatedInsurancePerSF || null,
        renewalOptions: values.renewalOptions ? parseInt(values.renewalOptions) : null,
        renewalTermYears: values.renewalTermYears ? parseInt(values.renewalTermYears) : null,
        renewalNoticeMonths: values.renewalNoticeMonths ? parseInt(values.renewalNoticeMonths) : null,
      };

      if (isEditing) {
        return apiRequest(`/api/commercial-tenants/${tenant.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        return apiRequest("/api/commercial-tenants", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-tenants"] });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Tenant" : "Add Commercial Tenant"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update lease abstract details" : "Enter lease abstract details for the new tenant"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="expenses">NNN/CAM</TabsTrigger>
                <TabsTrigger value="options">Options</TabsTrigger>
              </TabsList>

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
                    name="suiteNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suite/Unit</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="101" />
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
                        <FormLabel>Square Footage</FormLabel>
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
                    name="leaseCommencementDate"
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
                    name="leaseExpirationDate"
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
                            <SelectItem value="nnn">Triple Net (NNN)</SelectItem>
                            <SelectItem value="modified_gross">Modified Gross</SelectItem>
                            <SelectItem value="full_service">Full Service</SelectItem>
                            <SelectItem value="double_net">Double Net</SelectItem>
                            <SelectItem value="absolute_net">Absolute Net</SelectItem>
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
                            <SelectItem value="base_only">Base Rent Only</SelectItem>
                            <SelectItem value="base_plus_percentage">Base + Percentage</SelectItem>
                            <SelectItem value="percentage_only">Percentage Only</SelectItem>
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
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="month_to_month">Month-to-Month</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
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

              <TabsContent value="financial" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="currentBaseRent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Base Rent ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="50000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="baseRentPerSF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rent per SF/Year ($)</FormLabel>
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
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="fixed_percent">Fixed Percentage</SelectItem>
                            <SelectItem value="fixed_dollar">Fixed Dollar</SelectItem>
                            <SelectItem value="cpi">CPI-Based</SelectItem>
                            <SelectItem value="fair_market_value">Fair Market Value</SelectItem>
                            <SelectItem value="none">None (Flat)</SelectItem>
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
