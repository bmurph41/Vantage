import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, Plus, Mail, Phone, MoreHorizontal, Search, 
  Star, ArrowRight, Edit, Trash2, Upload 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ContactFormModal from "@/components/modals/contact-form-modal";
import { FileUpload } from "@/components/file-upload";
import { ImportedDataBadge } from "@/components/integrations/ImportedDataBadge";
import type { Contact, Company } from "@shared/schema";

interface ContactsTableProps {
  showFullView?: boolean;
}

type ContactWithCompany = Contact & { company?: Company | null };

export default function ContactsTable({ showFullView = false }: ContactsTableProps) {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFileUpload, setShowFileUpload] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery<ContactWithCompany[]>({
    queryKey: ['/api/contacts'],
  });

  const { data: searchResults = [], isLoading: isSearching } = useQuery<ContactWithCompany[]>({
    queryKey: ['/api/contacts/search', { q: searchQuery }],
    enabled: searchQuery.length > 2,
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Contact deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete contact", variant: "destructive" });
    },
  });

  const displayContacts = searchQuery.length > 2 ? searchResults : contacts;

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsContactFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteContactMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setEditingContact(null);
    setIsContactFormOpen(true);
  };

  const handleFileUpload = async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload/contacts', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      // Refresh contacts list after successful upload
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      
      // Show success message with details
      const totalCreated = result.results.reduce((sum: number, r: any) => sum + (r.created || 0), 0);
      toast({
        title: "Files processed successfully",
        description: `Created ${totalCreated} new contacts from ${files.length} file(s)`,
      });
      
      setShowFileUpload(false);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process files",
        variant: "destructive",
      });
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getLeadScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getRandomGradient = (index: number) => {
    const gradients = [
      'from-blue-500 to-purple-600',
      'from-pink-500 to-rose-600',
      'from-green-500 to-green-600',
      'from-orange-500 to-red-600',
      'from-purple-500 to-indigo-600',
      'from-yellow-500 to-orange-600',
    ];
    return gradients[index % gradients.length];
  };

  if (isLoading) {
    return (
      <Card className="border border-gray-100">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">Recent Contacts</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border border-gray-100" data-testid="contacts-table">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {showFullView ? 'All Contacts' : 'Recent Contacts'}
            </CardTitle>
            {showFullView ? (
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                    data-testid="input-search-contacts"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowFileUpload(!showFileUpload)}
                  data-testid="button-upload-contacts"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
                <Button onClick={handleAdd} data-testid="button-add-contact">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 font-medium" data-testid="button-view-all-contacts">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>

        {showFileUpload && showFullView && (
          <CardContent className="border-b border-gray-200 bg-gray-50">
            <FileUpload
              onUpload={handleFileUpload}
              title="Import Contacts"
              description="Upload CSV, TXT, or PDF files with contact information"
              acceptedFileTypes={['.txt', '.csv', '.pdf', '.docx']}
              maxFiles={5}
            />
          </CardContent>
        )}

        {displayContacts.length === 0 ? (
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery 
                ? `No contacts match "${searchQuery}"`
                : 'Get started by adding your first contact'
              }
            </p>
            {!searchQuery && (
              <Button onClick={handleAdd} data-testid="button-add-first-contact">
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            )}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayContacts.slice(0, showFullView ? displayContacts.length : 5).map((contact: ContactWithCompany, index: number) => (
                  <tr 
                    key={contact.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    data-testid={`contact-row-${contact.id}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 bg-gradient-to-r ${getRandomGradient(index)} rounded-full flex items-center justify-center`}>
                          <span className="text-white font-medium text-sm" data-testid={`contact-initials-${contact.id}`}>
                            {getInitials(contact.firstName, contact.lastName)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900" data-testid={`contact-name-${contact.id}`}>
                              {contact.firstName} {contact.lastName}
                            </div>
                            <ImportedDataBadge
                              integrationSource={(contact as any).integrationSource}
                              externalId={(contact as any).externalId}
                              lastSyncedAt={(contact as any).lastSyncedAt}
                            />
                          </div>
                          <div className="text-sm text-gray-500" data-testid={`contact-email-${contact.id}`}>
                            {contact.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contact.company ? (
                        <div>
                          <div className="text-sm text-gray-900" data-testid={`contact-company-${contact.id}`}>
                            {contact.company.name}
                          </div>
                          {contact.position && (
                            <div className="text-sm text-gray-500" data-testid={`contact-position-${contact.id}`}>
                              {contact.position}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No company</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge 
                        className={`${getLeadScoreColor(contact.leadScore || 0)} inline-flex items-center`}
                        data-testid={`contact-lead-score-${contact.id}`}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        {contact.leadScore || 0}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-testid={`contact-last-activity-${contact.id}`}>
                      {new Date(contact.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary/80"
                          data-testid={`button-email-contact-${contact.id}`}
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-800"
                          data-testid={`button-call-contact-${contact.id}`}
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(contact)}
                          data-testid={`button-edit-contact-${contact.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(contact.id)}
                          data-testid={`button-delete-contact-${contact.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ContactFormModal
        isOpen={isContactFormOpen}
        onClose={() => {
          setIsContactFormOpen(false);
          setEditingContact(null);
        }}
        contact={editingContact}
      />
    </>
  );
}
