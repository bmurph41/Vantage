import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactCardModal } from "./contact-card-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, Plus, Search, Mail, Phone, Building2, UserPlus, Clock, X, Link2 } from "lucide-react";
import { 
  EntityAvatar, 
  RoleBadge, 
  ContactQuickActions,
  formatPhoneDisplay 
} from "@/components/ui/enhanced-card";
import { Textarea } from "@/components/ui/textarea";
import type { Contact, ProjectContact, ProjectPendingContact, PendingContact } from "@shared/schema";

interface KeyContactsSectionProps {
  projectId: string;
}

interface ProjectContactWithContact extends Omit<ProjectContact, 'contact'> {
  contact: Contact;
}

interface ProjectPendingContactWithPendingContact extends Omit<ProjectPendingContact, 'pendingContact'> {
  pendingContact: PendingContact;
}

const roleLabels: Record<string, string> = {
  seller: "Seller",
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

export function KeyContactsSection({ projectId }: KeyContactsSectionProps) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | undefined>();
  const [modalMode, setModalMode] = useState<"view" | "create" | "edit">("view");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState("");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkContactId, setLinkContactId] = useState("");
  const [linkRole, setLinkRole] = useState("");
  const [linkCustomRole, setLinkCustomRole] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [linkIsPrimary, setLinkIsPrimary] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all organization contacts
  const { data: allContacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/dd/contacts"],
  });

  // Fetch project-specific contacts
  const { data: projectContacts = [], isLoading: projectContactsLoading } = useQuery<ProjectContactWithContact[]>({
    queryKey: ["/api/dd/projects", projectId, "contacts"],
  });

  // Fetch project-specific pending contacts
  const { data: projectPendingContacts = [] } = useQuery<ProjectPendingContactWithPendingContact[]>({
    queryKey: ["/api/dd/projects", projectId, "pending-contacts"],
  });

  // Quick-add pending contact to project
  const quickAddMutation = useMutation({
    mutationFn: async (data: { fullName: string; role: string }) => {
      const res = await apiRequest("POST", `/api/dd/projects/${projectId}/pending-contacts/quick-add`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "pending-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pending-contacts"] });
      setIsQuickAddOpen(false);
      setQuickAddName("");
      setQuickAddRole("");
      toast({
        title: "Contact name added",
        description: "The contact has been added to the pending review queue.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  // Add contact to project
  const addContactToProjectMutation = useMutation({
    mutationFn: async (data: { contactId: string; role: string; customRole?: string; projectNotes?: string; isPrimary: boolean }) => {
      const res = await apiRequest("POST", `/api/dd/projects/${projectId}/contacts`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "contacts"] });
      setIsLinkDialogOpen(false);
      setLinkContactId("");
      setLinkRole("");
      setLinkCustomRole("");
      setLinkNotes("");
      setLinkIsPrimary(false);
      toast({
        title: "Contact linked",
        description: "Contact has been added to this project.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add contact to project",
        variant: "destructive",
      });
    },
  });

  const removeContactFromProjectMutation = useMutation({
    mutationFn: async (data: { contactId: string; role: string }) => {
      await apiRequest("DELETE", `/api/dd/projects/${projectId}/contacts/${data.contactId}/${data.role}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "contacts"] });
      toast({
        title: "Contact removed",
        description: "Contact has been removed from this project.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove contact from project",
        variant: "destructive",
      });
    },
  });

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setModalMode("view");
    setIsModalOpen(true);
  };

  const handleCreateContact = () => {
    setSelectedContact(undefined);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleContactCreated = (newContact: Contact) => {
    queryClient.invalidateQueries({ queryKey: ["/api/dd/contacts"] });
    setLinkContactId(newContact.id);
    setIsLinkDialogOpen(true);
  };

  const openLinkDialog = (contactId: string) => {
    setLinkContactId(contactId);
    setLinkRole("");
    setLinkCustomRole("");
    setLinkNotes("");
    setLinkIsPrimary(false);
    setIsLinkDialogOpen(true);
  };

  const handleLinkSubmit = () => {
    if (!linkRole) {
      toast({
        title: "Role required",
        description: "Please select a role for this contact on the project.",
        variant: "destructive",
      });
      return;
    }
    addContactToProjectMutation.mutate({
      contactId: linkContactId,
      role: linkRole,
      customRole: linkRole === "other" ? linkCustomRole : undefined,
      projectNotes: linkNotes || undefined,
      isPrimary: linkIsPrimary,
    });
  };

  const handleRemoveFromProject = (contactId: string, role: string) => {
    if (confirm("Remove this contact from the project?")) {
      removeContactFromProjectMutation.mutate({ contactId, role });
    }
  };

  const handleQuickAdd = () => {
    if (!quickAddName.trim() || !quickAddRole) {
      toast({
        title: "Missing information",
        description: "Please provide a contact name and role",
        variant: "destructive",
      });
      return;
    }
    quickAddMutation.mutate({ fullName: quickAddName.trim(), role: quickAddRole });
  };

  // Filter contacts based on search query
  const filteredContacts = searchQuery
    ? allContacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (contact.email &&
contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (contact.company && contact.company.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allContacts;

  // Group project contacts by role
  const contactsByRole = projectContacts.reduce((acc, pc) => {
    const role = pc.role;
    if (!acc[role]) {
      acc[role] = [];
    }
    acc[role].push(pc);
    return acc;
  }, {} as Record<string, ProjectContactWithContact[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Key Contacts</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsQuickAddOpen(true)} size="sm" variant="outline" data-testid="button-quick-add-contact">
              <Plus className="h-4 w-4 mr-2" />
              Quick Add
            </Button>
            <Button onClick={handleCreateContact} size="sm" data-testid="button-create-contact">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search contacts by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-contacts"
            />
          </div>

          {/* Pending Contacts */}
          {projectPendingContacts.length > 0 && (
            <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-amber-900">Pending Review ({projectPendingContacts.length})</h3>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setLocation('/pending-contacts')}
                  className="bg-white hover:bg-amber-100"
                  data-testid="button-review-pending-contacts"
                >
                  Review All
                </Button>
              </div>
              <div className="space-y-2">
                {projectPendingContacts.map((ppc) => (
                  <button
                    key={ppc.id}
                    onClick={() => setLocation('/pending-contacts')}
                    className="w-full flex items-center justify-between p-2 bg-white border border-amber-200 rounded hover:border-amber-400 hover:bg-amber-50 transition-all text-left"
                    data-testid={`pending-contact-${ppc.pendingContact.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={`${roleColors[ppc.role]} text-xs`} variant="outline">
                        {roleLabels[ppc.role] || ppc.role}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">{ppc.pendingContact.fullName}</span>
                    </div>
                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                      Pending
                    </Badge>
                  </button>
                ))}
              </div>
              <p className="text-xs text-amber-700">
                Click any contact or "Review All" to accept or reject on the Pending Contacts page
              </p>
            </div>
          )}

          {/* Project Contacts Grouped by Role */}
          {projectContacts.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Project Team</h3>
              {Object.entries(contactsByRole).map(([role, contacts]) => (
                <div key={role} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge className={roleColors[role]} variant="outline">
                      {roleLabels[role] || role}
                    </Badge>
                    <span className="text-xs text-gray-500">({contacts.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                    {contacts.map((pc) => (
                      <div
                        key={pc.id}
                        className="relative bg-card border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ease-out hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 group"
                        data-testid={`contact-card-${pc.contact.id}`}
                      >
                        <button
                          onClick={() => handleContactClick(pc.contact)}
                          className="w-full flex items-start p-4 text-left"
                        >
                          <EntityAvatar 
                            name={pc.contact.name} 
                            size="md"
                            className="group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="ml-3 flex-1 min-w-0">
                            <div className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {pc.contact.name}
                            </div>
                            {pc.contact.company && (
                              <div className="flex items-center text-xs text-muted-foreground mt-1 truncate">
                                <Building2 className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                {pc.contact.company}
                              </div>
                            )}
                            {pc.contact.email && (
                              <div className="flex items-center text-xs text-muted-foreground mt-0.5 truncate">
                                <Mail className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                {pc.contact.email}
                              </div>
                            )}
                            {pc.contact.phone && (
                              <div className="flex items-center text-xs text-muted-foreground mt-0.5 truncate">
                                <Phone className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                {formatPhoneDisplay(pc.contact.phone)}
                              </div>
                            )}
                          </div>
                        </button>
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <ContactQuickActions
                            email={pc.contact.email}
                            phone={pc.contact.phone}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromProject(pc.contactId, pc.role);
                            }}
                            title="Remove from project"
                            data-testid={`remove-contact-${pc.contact.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium mb-1">No contacts assigned yet</p>
              <p className="text-xs text-gray-500">Add contacts to organize your project team</p>
            </div>
          )}

          {/* All Contacts (when searching) */}
          {searchQuery && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Search Results ({filteredContacts.length})
              </h3>
              {filteredContacts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredContacts.map((contact) => {
                    const isOnProject = projectContacts.some((pc) => pc.contactId === contact.id);
                    return (
                      <div
                        key={contact.id}
                        className="relative bg-card border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ease-out hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 group"
                        data-testid={`search-contact-card-${contact.id}`}
                      >
                        <button
                          onClick={() => handleContactClick(contact)}
                          className="w-full flex items-start p-4 text-left"
                        >
                          <EntityAvatar 
                            name={contact.name} 
                            size="md"
                            className="group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="ml-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {contact.name}
                              </span>
                              {isOnProject && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0">
                                  On Project
                                </Badge>
                              )}
                            </div>
                            {contact.company && (
                              <div className="flex items-center text-xs text-muted-foreground mt-1 truncate">
                                <Building2 className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                {contact.company}
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center text-xs text-muted-foreground mt-0.5 truncate">
                                <Mail className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                {contact.email}
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center text-xs text-muted-foreground mt-0.5 truncate">
                                <Phone className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                {formatPhoneDisplay(contact.phone)}
                              </div>
                            )}
                          </div>
                        </button>
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <ContactQuickActions
                            email={contact.email}
                            phone={contact.phone}
                          />
                          {!isOnProject && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                openLinkDialog(contact.id);
                              }}
                              title="Link to project"
                              data-testid={`link-contact-${contact.id}`}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">No contacts found matching "{searchQuery}"</p>
                  <Button
                    onClick={handleCreateContact}
                    size="sm"
                    className="mt-3"
                    variant="outline"
                    data-testid="button-create-contact-from-search"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create New Contact
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* Contact Card Modal */}
      <ContactCardModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        contact={selectedContact}
        mode={modalMode}
        projectId={projectId}
        onContactCreated={handleContactCreated}
      />

      {/* Quick Add Dialog */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add Contact</DialogTitle>
            <DialogDescription>
              Add a contact name to the pending review queue. You can fill in full details later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="quick-add-name">Contact Name</Label>
              <Input
                id="quick-add-name"
                placeholder="e.g., John Smith"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                data-testid="input-quick-add-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-add-role">Role</Label>
              <Select value={quickAddRole} onValueChange={setQuickAddRole}>
                <SelectTrigger id="quick-add-role" data-testid="select-quick-add-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsQuickAddOpen(false)} data-testid="button-cancel-quick-add">
                Cancel
              </Button>
              <Button 
                onClick={handleQuickAdd} 
                disabled={quickAddMutation.isPending}
                data-testid="button-submit-quick-add"
              >
                {quickAddMutation.isPending ? "Adding..." : "Add to Pending"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Contact to Project Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Contact to Project</DialogTitle>
            <DialogDescription>
              Select a role for this contact on the project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="link-role">Role *</Label>
              <Select value={linkRole} onValueChange={setLinkRole}>
                <SelectTrigger id="link-role" data-testid="select-link-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {linkRole === "other" && (
              <div className="space-y-2">
                <Label htmlFor="link-custom-role">Custom Role Title</Label>
                <Input
                  id="link-custom-role"
                  placeholder="e.g., Marina Consultant"
                  value={linkCustomRole}
                  onChange={(e) => setLinkCustomRole(e.target.value)}
                  data-testid="input-link-custom-role"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="link-notes">Project Notes (optional)</Label>
              <Textarea
                id="link-notes"
                placeholder="Notes about this contact's role on this specific project..."
                value={linkNotes}
                onChange={(e) => setLinkNotes(e.target.value)}
                className="min-h-[60px]"
                data-testid="textarea-link-notes"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="link-primary"
                checked={linkIsPrimary}
                onChange={(e) => setLinkIsPrimary(e.target.checked)}
                className="rounded border-gray-300"
                data-testid="checkbox-link-primary"
              />
              <Label htmlFor="link-primary" className="text-sm font-normal">Primary contact for this role</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)} data-testid="button-cancel-link">
                Cancel
              </Button>
              <Button
                onClick={handleLinkSubmit}
                disabled={addContactToProjectMutation.isPending}
                data-testid="button-submit-link"
              >
                {addContactToProjectMutation.isPending ? "Adding..." : "Add to Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
