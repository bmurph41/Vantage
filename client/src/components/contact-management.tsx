import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Mail, Phone, Clock, Download, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TaskFiles } from "./task-files";
import ContactModal, { type ContactPayload } from "./ContactModal";
import ContactDetailsModal from "./ContactDetailsModal";
import type { Contact, Task } from "@shared/schema";

// ========== CRM INTEGRATION PLACEHOLDER ==========
// TODO: Future CRM Integration Framework
// This section will be expanded when integrating with external CRM systems

interface CRMContact {
  crmId?: string;          // External CRM contact ID
  crmSystem?: string;      // CRM system name (e.g., 'salesforce', 'hubspot')
  lastSyncedAt?: Date;     // Last sync timestamp
  syncStatus?: 'pending' | 'synced' | 'error'; // Sync status
}

// CRM Integration placeholder functions
const CRMIntegration = {
  // TODO: Implement these when connecting to actual CRM
  syncContactToCRM: async (contact: Contact): Promise<void> => {
    console.log('CRM Sync placeholder - Contact would be synced to CRM:', contact.name);
    // Future implementation will send contact data to external CRM
  },
  
  searchCRMContacts: async (searchTerm: string): Promise<Contact[]> => {
    console.log('CRM Search placeholder - Would search CRM for:', searchTerm);
    // Future implementation will search external CRM and return results
    return [];
  },
  
  importFromCRM: async (crmContactId: string): Promise<Contact | null> => {
    console.log('CRM Import placeholder - Would import contact:', crmContactId);
    // Future implementation will import contact from external CRM
    return null;
  }
};

// ========== END CRM INTEGRATION PLACEHOLDER ==========

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone is required"),
  timezone: z.string().min(1, "Timezone is required"),
  role: z.enum(["seller", "attorney", "lender", "title_insurance", "inspector", "surveyor", "environmental", "appraiser", "broker", "insurance_agent", "other"]).optional(),
  customRole: z.string().optional(),
  company: z.string().optional(),
  onDealTeam: z.boolean().optional(),
  dealTeamNotes: z.string().optional(),
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

const contactRoles = [
  { value: "seller", label: "Seller" },
  { value: "attorney", label: "Attorney" },
  { value: "lender", label: "Lender" },
  { value: "title_insurance", label: "Title Insurance" },
  { value: "inspector", label: "Inspector" },
  { value: "surveyor", label: "Surveyor" },
  { value: "environmental", label: "Environmental" },
  { value: "appraiser", label: "Appraiser" },
  { value: "broker", label: "Broker" },
  { value: "insurance_agent", label: "Insurance Agent" },
  { value: "other", label: "Other" },
];

export function ContactManagement({ contacts, isLoading, projectId }: ContactManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [viewingContact, setViewingContact] = useState<any | null>(null);
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

  // Form handling is now done by ContactModal component

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await apiRequest("POST", "/api/dd/contacts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/contacts'] });
      setIsAddDialogOpen(false);
      // Form reset handled by ContactModal
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
      // Form reset handled by ContactModal
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
  };

  // Convert Contact to ContactPayload for the modal
  const convertContactToPayload = (contact: Contact): ContactPayload => {
    const nameParts = contact.name.split(' ');
    return {
      id: contact.id,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || undefined,
      email: contact.email,
      phone: contact.phone || undefined,
      company: contact.company || undefined,
      role: contact.role || undefined,
      customRole: contact.customRole || undefined,
      timezone: contact.timezone,
      onDealTeam: contact.onDealTeam || false,
      dealTeamNotes: contact.dealTeamNotes || undefined,
    };
  };

  // Convert ContactPayload to ContactFormData for the API
  const convertPayloadToFormData = (payload: ContactPayload): ContactFormData => {
    const fullName = [payload.firstName, payload.lastName].filter(Boolean).join(' ');
    return {
      name: fullName,
      email: payload.email || '',
      phone: payload.phone || '',
      timezone: payload.timezone || 'America/New_York',
      role: payload.role as any,
      customRole: payload.customRole,
      company: payload.company || '',
      onDealTeam: payload.onDealTeam,
      dealTeamNotes: payload.dealTeamNotes,
    };
  };

  const handleModalSave = (payload: ContactPayload) => {
    const formData = convertPayloadToFormData(payload);
    handleSubmit(formData);
  };

  const handleDelete = (contactId: string) => {
    deleteContactMutation.mutate(contactId);
  };

  const handleExportCSV = () => {
    const csvHeaders = ["Name", "Email", "Phone", "Timezone", "Role", "Company"];
    const csvData = contacts.map(contact => [
      contact.name,
      contact.email,
      contact.phone || "",
      contact.timezone,
      contact.role || "",
      contact.company || ""
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
    ('company' in contact && contact.company?.toLowerCase().includes(searchTerm.toLowerCase()))
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
    <div className="space-y-8" data-testid="contact-management">
      {/* Header Actions */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Search contacts by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 text-base bg-white border-2 focus:border-blue-500 transition-colors"
              data-testid="input-search-contacts"
            />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleExportCSV} className="border-2 hover:bg-gray-50" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {/* CRM Integration Placeholder Button */}
          <Button 
            variant="outline" 
            onClick={() => {
              console.log('CRM Search clicked - Future CRM integration point');
              // TODO: Implement CRM search when connecting to external CRM
            }}
            className="border-2 hover:bg-purple-50 border-purple-200 text-purple-700" 
            data-testid="button-search-crm"
            disabled={true}
            title="CRM Integration - Coming Soon"
          >
            <Search className="h-4 w-4 mr-2" />
            Search CRM
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 shadow-sm" 
            data-testid="button-add-contact"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Contact Cards */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-16" data-testid="empty-state">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center mb-6">
            <Mail className="h-10 w-10 text-blue-600" />
          </div>
          <h3 className="text-2xl font-semibold mb-3 text-foreground">No Contacts Found</h3>
          <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
            {searchTerm ? "No contacts match your search criteria. Try adjusting your search terms." : "Add your first contact to start sending notifications to stakeholders."}
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => setIsAddDialogOpen(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg shadow-sm"
              data-testid="button-add-first-contact"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Contact
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="contacts-grid">
          {filteredContacts.map((contact) => (
            <Card 
              key={contact.id} 
              className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50 cursor-pointer hover:scale-[1.02]" 
              data-testid={`contact-card-${contact.id}`}
              onClick={() => setViewingContact(contact)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${
                        contact.type === 'user_contact' 
                          ? 'bg-blue-100' 
                          : 'bg-purple-100'
                      }`}>
                        <Users className={`h-4 w-4 ${
                          contact.type === 'user_contact' 
                            ? 'text-blue-600' 
                            : 'text-purple-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground" data-testid={`contact-name-${contact.id}`}>
                          {contact.name}
                        </h3>
                        <Badge 
                          variant={contact.type === 'user_contact' ? 'default' : 'secondary'} 
                          className={`text-xs font-medium ${
                            contact.type === 'user_contact' 
                              ? 'bg-blue-100 text-blue-800 border-blue-200' 
                              : 'bg-purple-100 text-purple-800 border-purple-200'
                          }`}
                        >
                          {contact.type === 'user_contact' ? 'External Contact' : 'Company Representative'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm">
                        <div className="p-1 bg-gray-100 rounded mr-3">
                          <Mail className="h-3 w-3 text-gray-600" />
                        </div>
                        <span className="font-medium text-foreground" data-testid={`contact-email-${contact.id}`}>{contact.email}</span>
                      </div>
                      {contact.phone && (
                        <div className="flex items-center text-sm">
                          <div className="p-1 bg-gray-100 rounded mr-3">
                            <Phone className="h-3 w-3 text-gray-600" />
                          </div>
                          <span className="font-medium text-foreground" data-testid={`contact-phone-${contact.id}`}>{contact.phone}</span>
                        </div>
                      )}
                      {contact.type === 'user_contact' && (
                        <div className="flex items-center text-sm">
                          <div className="p-1 bg-gray-100 rounded mr-3">
                            <Clock className="h-3 w-3 text-gray-600" />
                          </div>
                          <span className="text-muted-foreground" data-testid={`contact-timezone-${contact.id}`}>
                            {timezones.find(tz => tz.value === contact.timezone)?.label || contact.timezone}
                          </span>
                        </div>
                      )}
                      {contact.type === 'user_contact' && contact.role && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                          <div className="text-sm">
                            <span className="font-medium text-green-900">Role:</span>
                            <span className="ml-2 text-green-800" data-testid={`contact-role-${contact.id}`}>
                              {contactRoles.find(role => role.value === contact.role)?.label || contact.role}
                            </span>
                          </div>
                        </div>
                      )}
                      {contact.type === 'user_contact' && contact.company && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="text-sm">
                            <span className="font-medium text-blue-900">Company:</span>
                            <span className="ml-2 text-blue-800" data-testid={`contact-user-company-${contact.id}`}>{contact.company}</span>
                          </div>
                        </div>
                      )}
                      {contact.type === 'company_rep' && 'company' in contact && (
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                          <div className="text-sm">
                            <span className="font-medium text-purple-900">Company:</span>
                            <span className="ml-2 text-purple-800" data-testid={`contact-company-${contact.id}`}>{contact.company}</span>
                          </div>
                        </div>
                      )}
                      {contact.type === 'company_rep' && 'taskTitle' in contact && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="text-sm">
                            <span className="font-medium text-blue-900">Related Task:</span>
                            <span className="ml-2 text-blue-800" data-testid={`contact-task-${contact.id}`}>{contact.taskTitle}</span>
                          </div>
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(contact);
                          }}
                          data-testid={`button-edit-${contact.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-${contact.id}`}
                          onClick={(e) => e.stopPropagation()}
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
        Showing {filteredContacts.length} of {allContacts.length} Contacts
      </div>

      {/* Contact Modals */}
      <ContactModal
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={(payload) => {
          handleModalSave(payload);
          setIsAddDialogOpen(false);
        }}
      />

      <ContactModal
        open={!!editingContact}
        onClose={() => setEditingContact(null)}
        initialData={editingContact ? convertContactToPayload(editingContact) : undefined}
        onSave={(payload) => {
          handleModalSave(payload);
          setEditingContact(null);
        }}
      />

      {/* Contact Details Modal */}
      <ContactDetailsModal
        open={!!viewingContact}
        onClose={() => setViewingContact(null)}
        contact={viewingContact}
        onEdit={() => {
          if (viewingContact?.type === 'user_contact') {
            setEditingContact(viewingContact);
            setViewingContact(null);
          }
        }}
      />
    </div>
  );
}