import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ContactCardModal } from "./contact-card-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, Plus, Search, Mail, Phone, Building2, UserPlus } from "lucide-react";
import type { Contact, ProjectContact } from "@shared/schema";

interface KeyContactsSectionProps {
  projectId: string;
}

interface ProjectContactWithContact extends Omit<ProjectContact, 'contact'> {
  contact: Contact;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | undefined>();
  const [modalMode, setModalMode] = useState<"view" | "create" | "edit">("view");
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  // Add contact to project
  const addContactToProjectMutation = useMutation({
    mutationFn: async (data: { contactId: string; role: string; customRole?: string; projectNotes?: string; isPrimary: boolean }) => {
      const res = await apiRequest("POST", `/api/dd/projects/${projectId}/contacts`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "contacts"] });
      toast({
        title: "Contact added",
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
    // Automatically add the new contact to the project
    // User can set the role in a follow-up dialog
    toast({
      title: "Contact created",
      description: "You can now assign this contact to a role on this project.",
    });
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
          <Button onClick={handleCreateContact} size="sm" data-testid="button-create-contact">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
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
                      <button
                        key={pc.id}
                        onClick={() => handleContactClick(pc.contact)}
                        className="flex items-start p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group"
                        data-testid={`contact-card-${pc.contact.id}`}
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-md group-hover:scale-110 transition-transform">
                          {pc.contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900 truncate group-hover:text-blue-700">
                            {pc.contact.name}
                          </div>
                          {pc.contact.company && (
                            <div className="flex items-center text-xs text-gray-600 mt-0.5 truncate">
                              <Building2 className="h-3 w-3 mr-1 flex-shrink-0" />
                              {pc.contact.company}
                            </div>
                          )}
                          {pc.contact.email && (
                            <div className="flex items-center text-xs text-gray-500 mt-0.5 truncate">
                              <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                              {pc.contact.email}
                            </div>
                          )}
                        </div>
                      </button>
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
                      <button
                        key={contact.id}
                        onClick={() => handleContactClick(contact)}
                        className="flex items-start p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group relative"
                        data-testid={`search-contact-card-${contact.id}`}
                      >
                        {isOnProject && (
                          <Badge className="absolute top-2 right-2 text-xs bg-green-100 text-green-800">
                            On Project
                          </Badge>
                        )}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-md group-hover:scale-110 transition-transform">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900 truncate group-hover:text-blue-700">
                            {contact.name}
                          </div>
                          {contact.company && (
                            <div className="flex items-center text-xs text-gray-600 mt-0.5 truncate">
                              <Building2 className="h-3 w-3 mr-1 flex-shrink-0" />
                              {contact.company}
                            </div>
                          )}
                          {contact.email && (
                            <div className="flex items-center text-xs text-gray-500 mt-0.5 truncate">
                              <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                              {contact.email}
                            </div>
                          )}
                        </div>
                      </button>
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
    </Card>
  );
}
