import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { Deal } from "@shared/schema";
import { useLocation } from "wouter";

interface ConvertToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal;
}

const conversionSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  includeDescription: z.boolean().default(true),
  includeContacts: z.boolean().default(true),
  includeFinancials: z.boolean().default(true),
  includeLocation: z.boolean().default(true),
  ddPeriodDays: z.number().min(1, "DD period must be at least 1 day").default(30),
  createDefaultTasks: z.boolean().default(true),
  notes: z.string().optional(),
});

type ConversionFormData = z.infer<typeof conversionSchema>;

export default function ConvertToProjectModal({ isOpen, onClose, deal }: ConvertToProjectModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const form = useForm<ConversionFormData>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      projectName: deal.title || `${deal.marinaName || 'Marina'} DD Project`,
      includeDescription: true,
      includeContacts: true,
      includeFinancials: true,
      includeLocation: true,
      ddPeriodDays: 30,
      createDefaultTasks: true,
      notes: "",
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (data: ConversionFormData) => {
      return await apiRequest('/api/deals/convert-to-project', 'POST', {
        dealId: deal.id,
        ...data,
      });
    },
    onSuccess: (result) => {
      setCreatedProjectId(result.projectId);
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', deal.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects'] });
      toast({
        title: "Success!",
        description: "Deal successfully converted to DD project",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Conversion failed",
        description: error.message || "Failed to convert deal to project",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ConversionFormData) => {
    convertMutation.mutate(data);
  };

  const handleViewProject = () => {
    if (createdProjectId) {
      setLocation(`/dd/projects/${createdProjectId}`);
      onClose();
    }
  };

  const handleClose = () => {
    if (!convertMutation.isPending) {
      onClose();
      setCreatedProjectId(null);
      form.reset();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-convert-to-project">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Convert Deal to DD Project
          </DialogTitle>
          <DialogDescription>
            Create a new Due Diligence project from this deal. Data will be mapped automatically.
          </DialogDescription>
        </DialogHeader>

        {createdProjectId ? (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Project created successfully!</strong>
                <br />
                Your Due Diligence project has been created with all selected data from the deal.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} data-testid="button-close">
                Stay Here
              </Button>
              <Button onClick={handleViewProject} data-testid="button-view-project">
                View DD Project
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Deal: {deal.title}</strong>
                  <br />
                  Amount: ${parseFloat(deal.amount || deal.value || '0').toLocaleString()}
                  {deal.marinaName && ` • Marina: ${deal.marinaName}`}
                </AlertDescription>
              </Alert>

              <FormField
                control={form.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter project name" data-testid="input-project-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ddPeriodDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Diligence Period (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                        placeholder="30"
                        data-testid="input-dd-period"
                      />
                    </FormControl>
                    <FormDescription>
                      Number of days for the DD period (typically 30-60 days)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Data to Include</h3>

                <FormField
                  control={form.control}
                  name="includeDescription"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Description & Notes</FormLabel>
                        <FormDescription>
                          Copy deal description to project
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-include-description"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeLocation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Location Details</FormLabel>
                        <FormDescription>
                          Copy city, state, marina name, and dock location
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-include-location"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeFinancials"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Financial Data</FormLabel>
                        <FormDescription>
                          Copy purchase price, revenues, and financial metrics
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-include-financials"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeContacts"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Contact Information</FormLabel>
                        <FormDescription>
                          Link deal contacts to project roles
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-include-contacts"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="createDefaultTasks"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Create Default Tasks</FormLabel>
                        <FormDescription>
                          Add standard DD tasks (PCA, ESA, Survey, Title, etc.)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-create-tasks"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any notes about this conversion..."
                        rows={3}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={convertMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={convertMutation.isPending}
                  data-testid="button-convert"
                >
                  {convertMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    "Convert to DD Project"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
