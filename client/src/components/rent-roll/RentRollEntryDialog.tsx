import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertRentRollEntrySchema, type InsertRentRollEntry } from "@shared/schema";
import { RENT_ROLL_QUERY_KEYS } from "@/types/rent-roll";
import type { RentRollEntry } from "@/types/rent-roll";
import { z } from "zod";

interface RentRollEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentRollId: string;
  entry: RentRollEntry | null;
}

const formSchema = insertRentRollEntrySchema.omit({ orgId: true, rentRollId: true }).extend({
  monthlyRate: z.string().min(1, "Monthly rate is required"),
  leaseStartDate: z.string().optional(),
  leaseEndDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function RentRollEntryDialog({ open, onOpenChange, rentRollId, entry }: RentRollEntryDialogProps) {
  const { toast } = useToast();
  const isEditing = !!entry;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entryType: "slip",
      unitNumber: "",
      tenantName: "",
      customerId: "",
      monthlyRate: "",
      status: "vacant",
      leaseStartDate: "",
      leaseEndDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (entry) {
      form.reset({
        entryType: entry.entryType,
        unitNumber: entry.unitNumber || "",
        tenantName: entry.tenantName || "",
        customerId: entry.customerId || "",
        monthlyRate: entry.monthlyRate,
        status: entry.status,
        leaseStartDate: entry.leaseStartDate ? new Date(entry.leaseStartDate).toISOString().split('T')[0] : "",
        leaseEndDate: entry.leaseEndDate ? new Date(entry.leaseEndDate).toISOString().split('T')[0] : "",
        notes: entry.notes || "",
      });
    } else if (!isEditing) {
      form.reset({
        entryType: "slip",
        unitNumber: "",
        tenantName: "",
        customerId: "",
        monthlyRate: "",
        status: "vacant",
        leaseStartDate: "",
        leaseEndDate: "",
        notes: "",
      });
    }
  }, [entry, isEditing]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        rentRollId,
        entryType: data.entryType,
        unitNumber: data.unitNumber || null,
        tenantName: data.tenantName || null,
        customerId: data.customerId || null,
        monthlyRate: data.monthlyRate,
        status: data.status,
        leaseStartDate: data.leaseStartDate || null,
        leaseEndDate: data.leaseEndDate || null,
        notes: data.notes || null,
      };
      return apiRequest(`/api/operations/rent-rolls/${rentRollId}/entries`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.entries(rentRollId) });
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.summary(rentRollId) });
      toast({
        title: "Success",
        description: "Entry created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create entry.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        entryType: data.entryType,
        unitNumber: data.unitNumber || null,
        tenantName: data.tenantName || null,
        customerId: data.customerId || null,
        monthlyRate: data.monthlyRate,
        status: data.status,
        leaseStartDate: data.leaseStartDate || null,
        leaseEndDate: data.leaseEndDate || null,
        notes: data.notes || null,
      };
      return apiRequest(`/api/operations/rent-rolls/${rentRollId}/entries/${entry!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.entries(rentRollId) });
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.summary(rentRollId) });
      toast({
        title: "Success",
        description: "Entry updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update entry.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-rent-roll-entry">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Entry" : "Add Entry"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="entryType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-entry-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="slip">Slip</SelectItem>
                        <SelectItem value="rack">Rack</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="seasonal">Seasonal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-entry-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="occupied">Occupied</SelectItem>
                        <SelectItem value="vacant">Vacant</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="unitNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="e.g., A-101" data-testid="input-unit-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tenantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="e.g., John Doe" data-testid="input-tenant-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="monthlyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Rate</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      data-testid="input-monthly-rate"
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the monthly rental rate in dollars
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="leaseStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lease Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-lease-start-date" />
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
                    <FormLabel>Lease End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-lease-end-date" />
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
                    <Input {...field} value={field.value || ""} placeholder="Additional notes..." data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel-entry"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-entry">
                {isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
