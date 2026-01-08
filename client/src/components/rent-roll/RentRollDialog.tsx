import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertRentRollSchema, type InsertRentRoll } from "@shared/schema";
import { RENT_ROLL_QUERY_KEYS } from "@/types/rent-roll";
import type { RentRoll } from "@/types/rent-roll";
import { z } from "zod";

interface RentRollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentRoll: RentRoll | null;
  defaultContext?: "operational" | "valuation";
}

const formSchema = insertRentRollSchema.omit({ orgId: true }).extend({
  effectiveDate: z.string().min(1, "Effective date is required"),
});

type FormData = z.infer<typeof formSchema>;

export function RentRollDialog({ open, onOpenChange, rentRoll, defaultContext }: RentRollDialogProps) {
  const { toast } = useToast();
  const isEditing = !!rentRoll;

  const projectsQuery = useQuery<any[]>({
    queryKey: ['/api/dd/projects'],
    enabled: open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      context: defaultContext || "operational",
      effectiveDate: new Date().toISOString().split('T')[0],
      projectId: "",
      facilityId: "",
    },
  });

  useEffect(() => {
    if (rentRoll) {
      form.reset({
        name: rentRoll.name,
        context: rentRoll.context,
        effectiveDate: new Date(rentRoll.effectiveDate).toISOString().split('T')[0],
        projectId: rentRoll.projectId || "",
        facilityId: rentRoll.facilityId || "",
      });
    } else if (!isEditing) {
      form.reset({
        name: "",
        context: defaultContext || "operational",
        effectiveDate: new Date().toISOString().split('T')[0],
        projectId: "",
        facilityId: "",
      });
    }
  }, [rentRoll, defaultContext, isEditing, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        name: data.name,
        context: data.context,
        projectId: data.projectId || null,
        facilityId: data.facilityId || null,
        effectiveDate: data.effectiveDate,
      };
      return apiRequest('/api/operations/rent-rolls', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.all() });
      toast({
        title: "Success",
        description: "Rent roll created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create rent roll.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        name: data.name,
        context: data.context,
        projectId: data.projectId || null,
        facilityId: data.facilityId || null,
        effectiveDate: data.effectiveDate,
      };
      return apiRequest(`/api/operations/rent-rolls/${rentRoll!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.all() });
      queryClient.invalidateQueries({ queryKey: RENT_ROLL_QUERY_KEYS.byId(rentRoll!.id) });
      toast({
        title: "Success",
        description: "Rent roll updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update rent roll.",
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
      <DialogContent className="max-w-2xl" data-testid="dialog-rent-roll">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Rent Roll" : "Create Rent Roll"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Q4 2024 Operational" data-testid="input-rent-roll-name" />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this rent roll
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="context"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Context</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-rent-roll-context">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="operational">Operational</SelectItem>
                      <SelectItem value="valuation">Valuation</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Operational: Current operations | Valuation: Acquisition/appraisal scenario
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectiveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-rent-roll-effective-date" />
                  </FormControl>
                  <FormDescription>
                    The date this rent roll snapshot represents
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-rent-roll-project">
                        <SelectValue placeholder="Select a project..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {projectsQuery.data?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Link this rent roll to a specific project
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="facilityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facility ID</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g., FAC-001" data-testid="input-rent-roll-facility-id" />
                  </FormControl>
                  <FormDescription>
                    External facility identifier if applicable
                  </FormDescription>
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
                data-testid="button-cancel-rent-roll"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-rent-roll">
                {isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
