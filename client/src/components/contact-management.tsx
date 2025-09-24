import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Mail, Phone, Clock, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TaskFiles } from "./task-files";
import type { Contact, Task } from "@shared/schema";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone is required"),
  timezone: z.string().min(1, "Timezone is required"),
});

// Phone formatting utility
const formatPhoneNumber = (value: string) => {
  // Remove all non-digit characters
  const cleaned = value.replace(/\D/g, '');
  
  // Apply (000) 000-0000 format
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Return original if not 10 digits
  return value;
};

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactManagementProps {
  contacts: Contact[];
  isLoading: boolean;
  projectId: string;
}

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKST)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "Europe/London", label: "London Time (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Time (JST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AEST)" },
];

export function ContactManagement({ contacts, isLoading, projectId }: ContactManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tasks to get company representative information
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/dd/projects', projectId, 'tasks'],
    enabled: !!projectId,
  });

  // Extract company representatives from tasks
  const companyRepresentatives = tasks
    .filter(task => task.repName && task.repEmail) // Only include tasks with rep information
    .map(task => ({
      id: `rep-${task.id}`,
      taskId: task.id, // Keep the original task ID for file queries
      name: task.repName!,
      email: task.repEmail!,
      phone: task.repPhone || undefined,
      company: task.companyHired || 'Unknown Company',
      type: 'company_rep' as const,
      taskTitle: task.title,
    }));

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      timezone: "America/New_York",
    },
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await apiRequest("POST", "/api/dd/contacts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/contacts'] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContactFormData }) => {
      const response = await apiRequest("PUT", `/api/dd/contacts/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/contacts'] });
      setEditingContact(null);
      form.reset();
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/dd/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/contacts'] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message?.includes("active notification subscriptions") 
        ? "Cannot delete contact: they have active notification subscriptions"
        : "Failed to delete contact";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ContactFormData) => {
    // Check for duplicate email
    const existingContact = contacts.find(contact => 
      contact.email.toLowerCase() === data.email.toLowerCase() && 
      contact.id !== editingContact?.id
    );
    
    if (existingContact) {
      toast({
        title: "Error",
        description: "A contact with this email address already exists",
        variant: "destructive",
      });
      return;
    }

    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data });
    } else {
      createContactMutation.mutate(data);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    form.reset({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
      timezone: contact.timezone,
    });
  };

  const handleDelete = (contactId: string) => {
    deleteContactMutation.mutate(contactId);
  };

  const handleExportCSV = () => {
    const csvHeaders = ["Name", "Email", "Phone", "Timezone"];
    const csvData = contacts.map(contact => [
      contact.name,
      contact.email,
      contact.phone || "",
      contact.timezone
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Combine user contacts and company representatives for filtering
  const allContacts = [
    ...contacts.map(c => ({ ...c, type: 'user_contact' as const })),
    ...companyRepresentatives
  ];

  const filteredContacts = allContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ('company' in contact && contact.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading || tasksLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="contact-management">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-contacts"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExportCSV} size="sm" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-contact">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-contact">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>
                  Add a new contact who can receive notifications about this project.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} data-testid="input-contact-name" />
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} data-testid="input-contact-email" />
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
                          <Input 
                            placeholder="(000) 000-0000" 
                            {...field} 
                            onBlur={(e) => {
                              const formatted = formatPhoneNumber(e.target.value);
                              field.onChange(formatted);
                              field.onBlur();
                            }}
                            data-testid="input-contact-phone" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contact-timezone">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {timezones.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel">
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createContactMutation.isPending}
                      data-testid="button-save-contact"
                    >
                      {createContactMutation.isPending ? "Adding..." : "Add Contact"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contact Cards */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-state">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Contacts Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? "No contacts match your search criteria." : "Add your first contact to start sending notifications."}
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-contact">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Contact
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="contacts-grid">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow" data-testid={`contact-card-${contact.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground" data-testid={`contact-name-${contact.id}`}>
                        {contact.name}
                      </h3>
                      <Badge variant={contact.type === 'user_contact' ? 'default' : 'secondary'} className="text-xs">
                        {contact.type === 'user_contact' ? 'Contact' : 'Company Rep'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Mail className="h-3 w-3 mr-2" />
                        <span data-testid={`contact-email-${contact.id}`}>{contact.email}</span>
                      </div>
                      {contact.phone && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Phone className="h-3 w-3 mr-2" />
                          <span data-testid={`contact-phone-${contact.id}`}>{contact.phone}</span>
                        </div>
                      )}
                      {contact.type === 'user_contact' && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 mr-2" />
                          <span data-testid={`contact-timezone-${contact.id}`}>
                            {timezones.find(tz => tz.value === contact.timezone)?.label || contact.timezone}
                          </span>
                        </div>
                      )}
                      {contact.type === 'company_rep' && 'company' in contact && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <span className="font-medium mr-1">Company:</span>
                          <span data-testid={`contact-company-${contact.id}`}>{contact.company}</span>
                        </div>
                      )}
                      {contact.type === 'company_rep' && 'taskTitle' in contact && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <span className="font-medium mr-1">Task:</span>
                          <span data-testid={`contact-task-${contact.id}`}>{contact.taskTitle}</span>
                        </div>
                      )}
                      
                      {/* Show associated files for company representatives */}
                      {contact.type === 'company_rep' && 'taskId' in contact && (
                        <div className="mt-3 pt-2 border-t">
                          <TaskFiles 
                            taskId={contact.taskId} 
                            taskTitle={contact.taskTitle}
                            compact={true}
                            readOnly={true}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {contact.type === 'user_contact' && (
                    <div className="flex items-center space-x-1 ml-2">
                      <Dialog open={editingContact?.id === contact.id} onOpenChange={(open) => !open && setEditingContact(null)}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(contact)}
                          data-testid={`button-edit-${contact.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent data-testid="dialog-edit-contact">
                        <DialogHeader>
                          <DialogTitle>Edit Contact</DialogTitle>
                          <DialogDescription>
                            Update the contact information below.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-edit-name" />
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
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" {...field} data-testid="input-edit-email" />
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
                                    <Input 
                                      placeholder="(000) 000-0000"
                                      {...field} 
                                      onBlur={(e) => {
                                        const formatted = formatPhoneNumber(e.target.value);
                                        field.onChange(formatted);
                                        field.onBlur();
                                      }}
                                      data-testid="input-edit-phone" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="timezone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Timezone</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-edit-timezone">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {timezones.map((tz) => (
                                        <SelectItem key={tz.value} value={tz.value}>
                                          {tz.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end space-x-2 pt-4">
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setEditingContact(null)}
                                data-testid="button-cancel-edit"
                              >
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                disabled={updateContactMutation.isPending}
                                data-testid="button-save-edit"
                              >
                                {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-${contact.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent data-testid="dialog-delete-contact">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{contact.name}"? This action cannot be undone.
                            They will no longer receive any notifications.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(contact.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid="button-confirm-delete"
                          >
                            Delete Contact
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground text-center pt-4" data-testid="contacts-summary">
        Showing {filteredContacts.length} of {contacts.length} contacts
      </div>
    </div>
  );
}