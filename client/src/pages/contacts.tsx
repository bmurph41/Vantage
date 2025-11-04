import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Mail, Phone, Building, Upload, Users, User, Star, Download, Tag, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ContactFormModal from "@/components/modals/contact-form-modal";
import ContactDetailModal from "@/components/modals/contact-detail-modal";
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { FileUpload } from "@/components/file-upload";
import { ImportResultsModal, type ImportResult } from "@/components/import-results-modal";
import type { Contact, Company, Deal } from "@shared/schema";

type ContactWithCompany = Contact & { 
  company?: Company | null;
  deal?: Deal | null;
};

const statusColors = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  prospect: 'bg-blue-100 text-blue-800',
  customer: 'bg-purple-100 text-purple-800',
  lead: 'bg-yellow-100 text-yellow-800'
};

const contactTypeColors = {
  prospect: 'bg-blue-100 text-blue-800',
  vendor: 'bg-orange-100 text-orange-800',
  buyer: 'bg-green-100 text-green-800',
  seller: 'bg-purple-100 text-purple-800',
  partner: 'bg-indigo-100 text-indigo-800',
  client: 'bg-emerald-100 text-emerald-800'
};

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [showImportResults, setShowImportResults] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery<ContactWithCompany[]>({
    queryKey: ['/api/contacts'],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest('POST', '/api/contacts/bulk/delete', { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} contact(s) deleted successfully` });
    },
    onError: () => {
      toast({ title: "Failed to delete contacts", variant: "destructive" });
    },
  });

  const handleEdit = (contact: Contact, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent row click when clicking edit
    setEditingContact(contact);
    setIsContactFormOpen(true);
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent row click when clicking delete
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteContactMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setEditingContact(null);
    setIsContactFormOpen(true);
  };

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsDetailModalOpen(true);
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
      
      // Transform results to match ImportResult interface
      const transformedResults: ImportResult[] = result.results.map((r: any) => ({
        filename: r.filename,
        processed: r.processed || 0,
        created: r.created || 0, 
        updated: r.updated || 0,
        skipped: r.skipped || 0,
        rowErrors: r.rowErrors || []
      }));
      
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      
      const totalCreated = transformedResults.reduce((sum: number, r) => sum + r.created, 0);
      const totalErrors = transformedResults.reduce((sum: number, r) => sum + (r.rowErrors?.length || 0), 0);
      
      // Show results modal
      setImportResults(transformedResults);
      setShowImportResults(true);
      setShowFileUpload(false);
      
      // Show quick toast summary
      if (totalErrors > 0) {
        toast({
          title: "Import completed with errors",
          description: `Created ${totalCreated} contacts, ${totalErrors} errors found`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Import successful",
          description: `Created ${totalCreated} new contacts from ${files.length} file(s)`,
        });
      }
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

  const getContactStatus = (contact: ContactWithCompany): string => {
    // Simple logic to determine contact status
    if (contact.company) return 'customer';
    return 'prospect';
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} contact(s)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;
    
    const selectedContacts = contacts.filter(c => selectedIds.has(c.id));
    const csv = [
      ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Title', 'Type'].join(','),
      ...selectedContacts.map(c => [
        c.firstName,
        c.lastName,
        c.email || '',
        c.phone || '',
        c.company?.name || '',
        c.position || c.role || '',
        c.contactType || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: `Exported ${selectedIds.size} contact(s)` });
  };

  // Filter contacts based on search and status
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = !searchTerm || 
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const contactStatus = getContactStatus(contact);
    const matchesStatus = statusFilter === 'all' || contactStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate metrics
  const totalContacts = contacts.length;
  const prospects = contacts.filter(c => (c.contactType || 'prospect') === 'prospect').length;
  const clients = contacts.filter(c => (c.contactType || 'prospect') === 'client').length;
  const hotLeads = contacts.filter(c => (c.leadScore || 'new') === 'hot').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="contacts-title">Contacts</h1>
            <p className="text-sm text-gray-500 mt-1">{totalContacts} total contacts</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search contacts..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64 h-10"
                data-testid="search-contacts"
              />
            </div>
            
            {/* Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-10" data-testid="filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Import Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFileUpload(!showFileUpload)}
              className="h-10"
              data-testid="import-contacts-button"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            
            {/* Add Contact Button */}
            <Button 
              className="bg-blue-600 hover:bg-blue-700 h-10" 
              size="sm" 
              onClick={handleAdd}
              data-testid="add-contact-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>
      </div>
        
      <main className="flex-1 overflow-y-auto p-6" data-testid="contacts-main">
        {/* File Upload Section */}
        {showFileUpload && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <FileUpload
              onUpload={handleFileUpload}
              title="Import Contacts"
              description="Upload CSV, TXT, PDF, DOCX, or XLSX files with contact information"
              acceptedFileTypes={['.txt', '.csv', '.pdf', '.docx', '.xlsx']}
              maxFiles={5}
            />
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          <Card className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Contacts</p>
                <p className="text-3xl font-bold text-gray-900">{totalContacts}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Prospects</p>
                <p className="text-3xl font-bold text-gray-900">{prospects}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Clients</p>
                <p className="text-3xl font-bold text-gray-900">{clients}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center">
              <div>
                <p className="text-sm text-gray-600 mb-1">Hot Leads</p>
                <p className="text-3xl font-bold text-gray-900">{hotLeads}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.size === filteredContacts.length}
                onCheckedChange={toggleSelectAll}
                data-testid="checkbox-select-all-toolbar"
              />
              <span className="text-sm font-medium text-blue-900">
                {selectedIds.size} contact(s) selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkExport}
                data-testid="button-bulk-export"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                data-testid="button-bulk-delete"
                disabled={bulkDeleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                data-testid="button-clear-selection"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 py-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-20"></div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by adding your first contact to build your network.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 w-12">
                    <Checkbox
                      checked={selectedIds.size > 0 && selectedIds.size === filteredContacts.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredContacts.map((contact) => (
                  <tr 
                    key={contact.id} 
                    className="hover:bg-gray-50 transition-colors" 
                    data-testid={`row-contact-${contact.id}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => toggleSelection(contact.id)}
                        data-testid={`checkbox-contact-${contact.id}`}
                      />
                    </td>
                    
                    {/* Contact */}
                    <td className="px-6 py-4 cursor-pointer" onClick={() => handleRowClick(contact)}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm flex-shrink-0">
                          {getInitials(contact.firstName, contact.lastName)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900" data-testid={`text-contact-name-${contact.id}`}>
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-sm text-gray-500" data-testid={`text-contact-title-${contact.id}`}>
                            {contact.position || contact.role || 'No title'}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Email */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900" data-testid={`text-contact-email-${contact.id}`}>
                          {contact.email}
                        </span>
                      </div>
                    </td>
                    
                    {/* Phone */}
                    <td className="px-6 py-4">
                      {contact.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900" data-testid={`text-contact-phone-${contact.id}`}>
                            {contact.phone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    
                    {/* Company */}
                    <td className="px-6 py-4">
                      {contact.company ? (
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900" data-testid={`text-contact-company-${contact.id}`}>
                            {contact.company.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    
                    {/* Type */}
                    <td className="px-6 py-4">
                      <Badge 
                        className={contactTypeColors[contact.contactType as keyof typeof contactTypeColors] || 'bg-gray-100 text-gray-800'} 
                        data-testid={`badge-contact-type-${contact.id}`}
                      >
                        {contact.contactType || 'prospect'}
                      </Badge>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEdit(contact, e)}
                          className="h-8 w-8 p-0 hover:bg-gray-200"
                          data-testid={`button-edit-contact-${contact.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(contact.id, e)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          data-testid={`button-delete-contact-${contact.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <ContactFormModal
          isOpen={isContactFormOpen}
          onClose={() => {
            setIsContactFormOpen(false);
            setEditingContact(null);
          }}
          contact={editingContact}
        />

        <DetailDrawer
          open={isDetailModalOpen}
          onOpenChange={(open) => {
            setIsDetailModalOpen(open);
            if (!open) setSelectedContact(null);
          }}
          entityType="contact"
          entityId={selectedContact?.id || null}
          onDelete={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
          }}
        />
        
        <ImportResultsModal 
          isOpen={showImportResults}
          onClose={() => setShowImportResults(false)}
          results={importResults}
          entityType="contacts"
        />
      </main>
    </div>
  );
}
