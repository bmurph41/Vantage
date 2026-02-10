import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Building2, Briefcase, FileText, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Contact } from "@shared/schema";

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  company: z.string().optional(),
  role: z.enum(["seller", "attorney", "lender", "title_insurance", "inspector", "surveyor", "environmental", "appraiser", "broker", "insurance_agent", "other"]).optional(),
  customRole: z.string().optional(),
  dealTeamNotes: z.string().optional(),
  timezone: z.string().default("America/New_York"),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface ContactCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  mode: "view" | "create" | "edit";
  projectId?: string;
  onContactCreated?: (contact: Contact) => void;
}

const roleLabels: Record<string, string> = {
  seller: "Seller",
  buyer: "Buyer",
  attorney: "Attorney",
  lender: "Lender",
  title_insurance: "Title Insurance",
  inspector: "Inspector",
  surveyor: "Surveyor",
  environmental: "Environmental Consultant",
  appraiser: "Appraiser",
  broker: "Broker",
  insurance_agent: "Insurance Agent",
  other: "Other",
};

const roleColors: Record<string, string> = {
  seller: "bg-blue-100 text-blue-800 border-blue-200",
  buyer: "bg-sky-100 text-sky-800 border-sky-200",
  attorney: "bg-purple-100 text-purple-800 border-purple-200",
  lender: "bg-green-100 text-green-800 border-green-200",
  title_insurance: "bg-amber-100 text-amber-800 border-amber-200",
  inspector: "bg-indigo-100 text-indigo-800 border-indigo-200",
  surveyor: "bg-cyan-100 text-cyan-800 border-cyan-200",
  environmental: "bg-emerald-100 text-emerald-800 border-emerald-200",
  appraiser: "bg-orange-100 text-orange-800 border-orange-200",
  broker: "bg-pink-100 text-pink-800 border-pink-200",
  insurance_agent: "bg-violet-100 text-violet-800 border-violet-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

export function ContactCardModal({ open, onOpenChange, contact, mode, projectId, onContactCreated }: ContactCardModalProps) {
  const [isEditing, setIsEditing] = useState(mode === "create" || mode === "edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      company: contact?.company || "",
      role: contact?.role || undefined,
      customRole: contact?.customRole || "",
      dealTeamNotes: contact?.dealTeamNotes || "",
      timezone: contact?.timezone || "America/New_York",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: contact?.name || "",
        email: contact?.email || "",
        phone: contact?.phone || "",
        company: contact?.company || "",
        role: contact?.role || undefined,
        customRole: contact?.customRole || "",
        dealTeamNotes: contact?.dealTeamNotes || "",
        timezone: contact?.timezone || "America/New_York",
      });
      setIsEditing(mode === "create" || mode === "edit");
    }
  }, [open, contact, mode]);

  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const res = await apiRequest("POST", "/api/dd/contacts", { ...data, projectId });
      return await res.json();
    },
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/contacts"] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "pending-contacts"] });
      }
      toast({
        title: "Contact created",
        description: `${newContact.name} has been added to your contacts.`,
      });
      onContactCreated?.(newContact);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const res = await apiRequest("PUT", `/api/dd/contacts/${contact?.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/contacts"] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "contacts"] });
      }
      toast({
        title: "Contact updated",
        description: "Contact information has been saved.",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/dd/contacts/${contact?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/contacts"] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "contacts"] });
      }
      toast({
        title: "Contact deleted",
        description: "Contact has been removed.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    if (mode === "create") {
      createContactMutation.mutate(data);
    } else {
      updateContactMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate();
    }
  };

  if (!isEditing && contact) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-2xl">{contact.name}</DialogTitle>
                  {contact.role && (
                    <Badge className={`mt-1 ${roleColors[contact.role]}`}>
                      {contact.customRole || roleLabels[contact.role]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <Mail className="h-5 w-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <Label className="text-xs text-gray-600">Email</Label>
                  <p className="text-sm font-medium text-gray-900">{contact.email}</p>
                </div>
              </div>

              {contact.phone && (
                <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <Phone className="h-5 w-5 text-gray-600 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-gray-600">Phone</Label>
                    <p className="text-sm font-medium text-gray-900">{contact.phone}</p>
                  </div>
                </div>
              )}

              {contact.company && (
                <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <Building2 className="h-5 w-5 text-gray-600 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-gray-600">Company</Label>
                    <p className="text-sm font-medium text-gray-900">{contact.company}</p>
                  </div>
                </div>
              )}

              {contact.dealTeamNotes && (
                <div className="flex items-start space-x-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-blue-600">Deal Team Notes</Label>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{contact.dealTeamNotes}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Clock className="h-3.5 w-3.5" />
              <span>Added {format(new Date(contact.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteContactMutation.isPending}
              data-testid="button-delete-contact"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-close"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
                data-testid="button-edit-contact"
              >
                Edit Contact
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Contact" : "Edit Contact"}</DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Enter contact information. This contact will be saved to your organization's CRM."
              : "Update contact information. Changes will be reflected across all projects."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input {...field} placeholder="Full Name" className="pl-10" data-testid="input-contact-name" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input {...field} type="email" placeholder="email@example.com" className="pl-10" data-testid="input-contact-email" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input {...field} placeholder="+1 (555) 123-4567" className="pl-10" data-testid="input-contact-phone" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input {...field} placeholder="Company name" className="pl-10" data-testid="input-contact-company" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-contact-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("role") === "other" && (
              <FormField
                control={form.control}
                name="customRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Role Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Specify role" data-testid="input-contact-custom-role" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="dealTeamNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Team Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Notes about this contact's role on the deal team..."
                      className="min-h-[80px]"
                      data-testid="textarea-contact-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (mode === "edit") {
                    setIsEditing(false);
                  } else {
                    onOpenChange(false);
                  }
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createContactMutation.isPending || updateContactMutation.isPending}
                data-testid="button-save-contact"
              >
                {(createContactMutation.isPending || updateContactMutation.isPending) ? "Saving..." : mode === "create" ? "Create Contact" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
