import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailSequence } from "@shared/schema";

const sequenceFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "paused", "draft"]),
});

type SequenceFormData = z.infer<typeof sequenceFormSchema>;

interface SequenceFormModalProps {
  open: boolean;
  onClose: () => void;
  sequence?: EmailSequence | null;
}

export function SequenceFormModal({ open, onClose, sequence }: SequenceFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!sequence;

  const form = useForm<SequenceFormData>({
    resolver: zodResolver(sequenceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "draft",
    },
  });

  useEffect(() => {
    if (sequence) {
      form.reset({
        name: sequence.name,
        description: sequence.description || "",
        status: sequence.status,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        status: "draft",
      });
    }
  }, [sequence, form]);

  const createMutation = useMutation({
    mutationFn: async (data: SequenceFormData) => {
      return await apiRequest("/api/email-sequences", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-sequences"] });
      toast({
        title: "Sequence created",
        description: "Email sequence has been created successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sequence. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SequenceFormData) => {
      return await apiRequest(`/api/email-sequences/${sequence!.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-sequences"] });
      toast({
        title: "Sequence updated",
        description: "Email sequence has been updated successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update sequence. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SequenceFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="modal-sequence-form">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Email Sequence" : "Create Email Sequence"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the details of your email sequence"
              : "Create a new email sequence to automate your outreach"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Welcome Series, Onboarding Flow" 
                      {...field} 
                      data-testid="input-sequence-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose of this sequence..."
                      {...field}
                      data-testid="input-sequence-description"
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description to help you remember what this sequence is for
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sequence-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Active sequences will automatically send emails. Draft and paused sequences won't send.
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
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
                data-testid="button-submit"
              >
                {isPending ? "Saving..." : isEditing ? "Update Sequence" : "Create Sequence"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
