import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailSequence } from "@shared/schema";

const enrollmentFormSchema = z.object({
  sequenceId: z.coerce.number().min(1, "Sequence is required"),
  entityType: z.enum(["contact", "lead", "deal"], {
    errorMap: () => ({ message: "Please select an entity type" }),
  }),
  entityId: z.coerce.number().min(1, "Entity ID is required"),
});

type EnrollmentFormData = z.infer<typeof enrollmentFormSchema>;

interface EnrollmentFormModalProps {
  open: boolean;
  onClose: () => void;
}

export function EnrollmentFormModal({ open, onClose }: EnrollmentFormModalProps) {
  const { toast } = useToast();

  const { data: sequences = [] } = useQuery<EmailSequence[]>({
    queryKey: ["/api/email-sequences"],
  });

  const form = useForm<EnrollmentFormData>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: {
      sequenceId: 0,
      entityType: "contact",
      entityId: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EnrollmentFormData) => {
      return await apiRequest("/api/email-sequence-enrollments", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          status: "active",
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-sequence-enrollments"] });
      toast({
        title: "Enrollment created",
        description: "Entity has been enrolled in the sequence successfully.",
      });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create enrollment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EnrollmentFormData) => {
    createMutation.mutate(data);
  };

  const activeSequences = sequences.filter(s => s.status === "active");

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="modal-enrollment-form">
        <DialogHeader>
          <DialogTitle>Enroll Entity in Sequence</DialogTitle>
          <DialogDescription>
            Add a contact, lead, or deal to an active email sequence
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sequenceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sequence *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sequence">
                        <SelectValue placeholder="Select a sequence" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeSequences.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">No active sequences available</div>
                      ) : (
                        activeSequences.map((seq) => (
                          <SelectItem key={seq.id} value={seq.id.toString()}>
                            {seq.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the email sequence to enroll this entity in
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entityType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-entity-type">
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="contact">Contact</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="deal">Deal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of entity to enroll
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity ID *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter the entity ID"
                      {...field}
                      data-testid="input-entity-id"
                    />
                  </FormControl>
                  <FormDescription>
                    The ID of the contact, lead, or deal to enroll
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={createMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || activeSequences.length === 0}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "Enrolling..." : "Enroll Entity"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
