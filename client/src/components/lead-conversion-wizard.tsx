import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  AlertCircle, 
  Building2, 
  User, 
  CheckCircle2, 
  DollarSign,
  Anchor,
  ChevronRight,
  ChevronLeft,
  Sparkles
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead, Contact, Company, CrmProperty } from "@shared/schema";

interface LeadConversionWizardProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const dealConfigSchema = z.object({
  dealName: z.string().min(1, "Deal name is required"),
  dealValue: z.string().optional(),
  stage: z.string().default("qualified"),
  priority: z.string().default("medium"),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
  createDdProject: z.boolean().default(false),
  createModelingProject: z.boolean().default(false),
  propertyId: z.string().optional(),
});

type DealConfigFormData = z.infer<typeof dealConfigSchema>;

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function LeadConversionWizard({
  lead,
  isOpen,
  onClose,
  onSuccess,
}: LeadConversionWizardProps) {
  const [step, setStep] = useState(1);
  const [potentialDuplicates, setPotentialDuplicates] = useState<{
    contacts: Contact[];
    companies: Company[];
  }>({ contacts: [], companies: [] });
  const { toast } = useToast();

  const form = useForm<DealConfigFormData>({
    resolver: zodResolver(dealConfigSchema),
    defaultValues: {
      dealName: "",
      dealValue: "",
      stage: "qualified",
      priority: "medium",
      expectedCloseDate: "",
      description: "",
      createDdProject: false,
      createModelingProject: false,
      propertyId: "",
    },
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isOpen && !!lead,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen && !!lead,
  });

  const { data: properties = [] } = useQuery<CrmProperty[]>({
    queryKey: ['/api/properties'],
    enabled: isOpen && step >= 2,
  });

  useEffect(() => {
    if (!lead || !isOpen) {
      setPotentialDuplicates({ contacts: [], companies: [] });
      setStep(1);
      return;
    }

    const duplicateContacts = contacts.filter(contact => {
      if (lead.email && contact.email?.toLowerCase() === lead.email.toLowerCase()) {
        return true;
      }
      const leadFullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      const contactFullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
      if (leadFullName === contactFullName) {
        return true;
      }
      return false;
    });

    const duplicateCompanies = lead.company
      ? companies.filter(company => 
          company.name.toLowerCase() === (lead.company?.toLowerCase() || '')
        )
      : [];

    setPotentialDuplicates({
      contacts: duplicateContacts,
      companies: duplicateCompanies,
    });

    form.setValue("dealName", `${lead.firstName} ${lead.lastName} - Marina Deal`);
    if (lead.estimatedValue) {
      form.setValue("dealValue", String(lead.estimatedValue));
    }
  }, [lead, contacts, companies, isOpen]);

  const convertMutation = useMutation({
    mutationFn: async (data: DealConfigFormData) => {
      if (!lead) throw new Error("No lead selected");
      
      return await apiRequest('POST', `/api/leads/${lead.id}/convert`, {
        dealConfig: {
          name: data.dealName,
          value: data.dealValue ? Number(data.dealValue) : undefined,
          stage: data.stage,
          priority: data.priority,
          expectedCloseDate: data.expectedCloseDate || undefined,
          description: data.description,
          propertyId: data.propertyId || undefined,
        },
        options: {
          createDdProject: data.createDdProject,
          createModelingProject: data.createModelingProject,
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-projects'] });
      toast({ 
        title: "Lead converted successfully",
        description: "Contact and deal have been created."
      });
      onSuccess?.();
      handleClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to convert lead",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleClose = () => {
    setStep(1);
    form.reset();
    onClose();
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = form.handleSubmit((data) => {
    convertMutation.mutate(data);
  });

  if (!lead) return null;

  const hasDuplicates = potentialDuplicates.contacts.length > 0 || potentialDuplicates.companies.length > 0;
  const progressPercent = (step / 3) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="modal-lead-conversion-wizard">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <DialogTitle>Lead Conversion Wizard</DialogTitle>
          </div>
          <DialogDescription>
            Convert "{lead.firstName} {lead.lastName}" to a deal - Step {step} of 3
          </DialogDescription>
          <Progress value={progressPercent} className="h-2 mt-2" />
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4 my-4">
                <h3 className="font-semibold text-lg">Step 1: Review Lead Information</h3>
                
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Lead Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span>{" "}
                        <span className="font-medium">{lead.firstName} {lead.lastName}</span>
                      </div>
                      {lead.email && (
                        <div>
                          <span className="text-gray-600">Email:</span> {lead.email}
                        </div>
                      )}
                      {lead.phone && (
                        <div>
                          <span className="text-gray-600">Phone:</span> {lead.phone}
                        </div>
                      )}
                      {lead.company && (
                        <div>
                          <span className="text-gray-600">Company:</span> {lead.company}
                        </div>
                      )}
                      {lead.source && (
                        <div>
                          <span className="text-gray-600">Source:</span>{" "}
                          <Badge variant="secondary">{lead.source}</Badge>
                        </div>
                      )}
                      {lead.leadScore !== undefined && lead.leadScore !== null && (
                        <div>
                          <span className="text-gray-600">Lead Score:</span>{" "}
                          <Badge variant={lead.leadScore >= 70 ? "default" : "secondary"}>
                            {lead.leadScore}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {hasDuplicates && (
                  <Card className="border-yellow-300 bg-yellow-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-yellow-900 mb-2">
                            Potential Duplicates Found
                          </h4>
                          <p className="text-sm text-yellow-800 mb-3">
                            Existing records will be linked automatically.
                          </p>

                          {potentialDuplicates.contacts.length > 0 && (
                            <div className="mb-2">
                              <p className="text-sm font-medium text-yellow-900">
                                Matching Contact: {potentialDuplicates.contacts[0].firstName} {potentialDuplicates.contacts[0].lastName}
                              </p>
                            </div>
                          )}

                          {potentialDuplicates.companies.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-yellow-900">
                                Matching Company: {potentialDuplicates.companies[0].name}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!hasDuplicates && (
                  <Card className="border-green-300 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-green-900 mb-1">
                            No Duplicates Found
                          </h4>
                          <p className="text-sm text-green-800">
                            New contact and company records will be created.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 my-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Step 2: Configure Deal
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dealName"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Deal Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter deal name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dealValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deal Value ($)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STAGES.map(stage => (
                              <SelectItem key={stage.value} value={stage.value}>
                                {stage.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRIORITIES.map(priority => (
                              <SelectItem key={priority.value} value={priority.value}>
                                {priority.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expectedCloseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Close Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Link to Property (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a property" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No property</SelectItem>
                            {properties.map(prop => (
                              <SelectItem key={prop.id} value={prop.id}>
                                <span className="flex items-center gap-2">
                                  <Anchor className="h-3 w-3" />
                                  {prop.name} - {prop.city}, {prop.state}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add notes about this deal..." 
                            className="resize-none"
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 my-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Step 3: Review & Confirm
                </h3>
                
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">Conversion Summary</h4>
                    <ul className="space-y-2 text-sm text-blue-800">
                      {potentialDuplicates.contacts.length > 0 ? (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Link to existing contact: {potentialDuplicates.contacts[0].firstName} {potentialDuplicates.contacts[0].lastName}
                        </li>
                      ) : (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Create new contact: {lead.firstName} {lead.lastName}
                        </li>
                      )}
                      {lead.company && (
                        potentialDuplicates.companies.length > 0 ? (
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Link to existing company: {potentialDuplicates.companies[0].name}
                          </li>
                        ) : (
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Create new company: {lead.company}
                          </li>
                        )
                      )}
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Create deal: {form.watch("dealName")}
                      </li>
                      {form.watch("dealValue") && (
                        <li className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          Deal value: ${Number(form.watch("dealValue")).toLocaleString()}
                        </li>
                      )}
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Mark lead as converted
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3">Additional Options</h4>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="createDdProject"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 space-y-0">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Create Due Diligence project
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="createModelingProject"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 space-y-0">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Create Modeling project for valuation
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <DialogFooter className="flex justify-between">
              <div>
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={convertMutation.isPending}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={convertMutation.isPending}
                >
                  Cancel
                </Button>
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={convertMutation.isPending}
                    data-testid="button-confirm-conversion"
                  >
                    {convertMutation.isPending ? 'Converting...' : 'Convert to Deal'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
