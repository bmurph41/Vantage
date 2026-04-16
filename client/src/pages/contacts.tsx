import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Mail, Phone, Building, Upload, Users, User, Star, Download, Thermometer, BarChart3, List } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { CrmListsManager } from "@/components/crm/panels/CrmListsManager";
import { useToast } from "@/hooks/use-toast";
import ContactFormModal from "@/components/modals/contact-form-modal";
import { CreateContactWizardModal } from "@/components/modals/create-contact-wizard-modal";
import { formatPhoneDisplay } from "@/components/ui/enhanced-card";
import { FileUpload } from "@/components/file-upload";
import { ImportResultsModal, type ImportResult } from "@/components/import-results-modal";
import { CrmPageShell } from "@/components/crm/CrmPageShell";
import { CrmTopBar } from "@/components/crm/CrmTopBar";
import { CrmDataTable, type CrmColumn } from "@/components/crm/CrmDataTable";
import { CsvExportButton } from "@/components/crm/csv-export-button";
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { SavedViewsSidebar } from '@/components/crm/SavedViewsSidebar';
import { RelationshipScoreBadge } from '@/components/crm/RelationshipScoreBadge';
import type { Contact, Company, Deal } from "@shared/schema";

type ContactWithCompany = Contact & { 
  company?: Company | null;
  deal?: Deal | null;
};

const contactTagColors = {
  lead: 'bg-blue-500 text-white',
  seller: 'bg-purple-500 text-white',
  competitor: 'bg-slate-500 text-white',
  broker: 'bg-emerald-500 text-white',
  vendor: 'bg-amber-500 text-white',
  insurance: 'bg-indigo-500 text-white',
  lender: 'bg-cyan-500 text-white',
  attorney: 'bg-rose-500 text-white',
  other: 'bg-gray-500 text-white'
};

const leadStatusColors = {
  none: 'bg-gray-100 text-gray-800',
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  unqualified: 'bg-red-100 text-red-800',
  converted: 'bg-purple-100 text-purple-800'
};

export default function Contacts() {
  const [location, setLocation] = useLocation();
  const searchString = typeof window !== 'undefined' ? window.location.search : '';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contactTagFilter, setContactTagFilter] = useState('all');
  const [crmRoleFilter, setCrmRoleFilter] = useState('all');
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // HubSpot-style: Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContactId, setDrawerContactId] = useState<string | null>(null);

  const [showFileUpload, setShowFileUpload] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [showImportResults, setShowImportResults] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeViewId, setActiveViewId] = useState<string | null>('default-0');
  const [viewMode, setViewMode] = useState<'contacts' | 'lists'>('contacts');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading, isError: contactsError } = useQuery<ContactWithCompany[]>({
    queryKey: ['/api/contacts'],
  });

  const { data: modelCoverage } = useQuery<{ propertyIds: string[]; companyIds: string[]; contactIds: string[] }>({
    queryKey: ['/api/modeling/property-coverage'],
  });
  const modeledContactIds = new Set(modelCoverage?.contactIds ?? []);

  const capitalizeFirst = (str: string | null | undefined) => {
    if (!str) return null;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  useEffect(() => {
    if (contacts.length > 0 && searchString) {
      const params = new URLSearchParams(searchString);
      const selectedId = params.get('selected');
      if (selectedId) {
        const contact = contacts.find(c => c.id === selectedId);
        if (contact) {
          setDrawerContactId(selectedId);
          setDrawerOpen(true);
          setLocation('/crm/contacts', { replace: true });
        }
      }
    }
  }, [contacts, searchString, setLocation]);

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Contact deleted successfully" });
      setDrawerOpen(false);
      setDrawerContactId(null);
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
      toast({ title: `${ids.length} ${ids.length === 1 ? 'contact' : 'contacts'} deleted successfully` });
    },
    onError: () => {
      toast({ title: "Failed to delete contacts", variant: "destructive" });
    },
  });

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsContactFormOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteContactMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setEditingContact(null);
    setIsCreateWizardOpen(true);
  };

  // HubSpot-style: Row click opens drawer
  const handleRowClick = (contact: ContactWithCompany) => {
    setDrawerContactId(contact.id);
    setDrawerOpen(true);
  };

  // HubSpot-style: Name click navigates to full record page
  const handleNameClick = (e: React.MouseEvent, contact: ContactWithCompany) => {
    e.stopPropagation();
    setLocation(`/crm/contacts/${contact.id}`);
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

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
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

      setImportResults(transformedResults);
      setShowImportResults(true);
      setShowFileUpload(false);

      toast({
        title: totalErrors > 0 ? "Import completed with errors" : "Import successful",
        description: `Created ${totalCreated} contacts${totalErrors > 0 ? `, ${totalErrors} errors` : ''}`,
        variant: totalErrors > 0 ? "destructive" : "default",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process files",
        variant: "destructive",
      });
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getContactStatus = (contact: ContactWithCompany): string => {
    if (contact.company) return 'customer';
    return 'prospect';
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} ${selectedIds.size === 1 ? 'contact' : 'contacts'}?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;
    const selectedContacts = contacts.filter(c => selectedIds.has(c.id));
    const csv = [
      ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Title', 'Type'].join(','),
      ...selectedContacts.map(c => [
        c.firstName, c.lastName, c.email || '', c.phone || '',
        c.company?.name || '', c.position || c.role || '', c.contactType || ''
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
    toast({ title: `Exported ${selectedIds.size} ${selectedIds.size === 1 ? 'contact' : 'contacts'}` });
  };

  const handleSelectView = (view: any) => {
    if (!view) {
      setActiveViewId(null);
      setStatusFilter('all');
      setContactTagFilter('all');
      return;
    }
    setActiveViewId(view.id);
    if (view.filters?.leadStatus) setStatusFilter(view.filters.leadStatus);
    else setStatusFilter('all');
    if (view.filters?.contactTag) setContactTagFilter(view.filters.contactTag);
    else setContactTagFilter('all');
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      const matchesSearch = !searchTerm || 
        `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const contactStatus = getContactStatus(contact);
      const matchesStatus = statusFilter === 'all' || contactStatus === statusFilter;
      const matchesContactTag = contactTagFilter === 'all' || contact.contactTag === contactTagFilter;
      const matchesCrmRole = crmRoleFilter === 'all' || (contact as any).crmRole === crmRoleFilter;
      return matchesSearch && matchesStatus && matchesContactTag && matchesCrmRole;
    });
  }, [contacts, searchTerm, statusFilter, contactTagFilter]);

  const totalContacts = contacts.length;
  const prospects = contacts.filter(c => c.contactTag === 'lead').length;
  const clients = contacts.filter(c => c.dealAssignment).length;
  const hotLeads = contacts.filter(c => c.contactTag === 'lead' && c.leadStatus === 'qualified').length;

  const columns: CrmColumn<ContactWithCompany>[] = [
    {
      key: 'contact',
      header: 'Contact',
      sortable: true,
      sortValue: (contact) => `${contact.firstName} ${contact.lastName}`.toLowerCase(),
      render: (contact) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {getInitials(contact.firstName, contact.lastName)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleNameClick(e, contact)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block text-left"
              >
                {contact.firstName} {contact.lastName}
              </button>
              {modeledContactIds.has(contact.id) && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0" title="Linked to a modeled property">
                  <BarChart3 className="h-2.5 w-2.5" />
                  Modeled
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {capitalizeFirst(contact.position || contact.role) || '—'}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      sortValue: (contact) => contact.email || null,
      render: (contact) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">{contact.email || '—'}</span>
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Phone',
      sortable: true,
      sortValue: (contact) => contact.phone || null,
      render: (contact) => (
        contact.phone ? (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{formatPhoneDisplay(contact.phone)}</span>
          </div>
        ) : <span className="text-gray-400">—</span>
      )
    },
    {
      key: 'company',
      header: 'Company',
      sortable: true,
      sortValue: (contact) => contact.company?.name || null,
      render: (contact) => (
        contact.company ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/crm/companies/${contact.company!.id}`);
            }}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{contact.company.name}</span>
          </button>
        ) : <span className="text-gray-400">—</span>
      )
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      sortValue: (contact) => contact.contactTag || null,
      render: (contact) => (
        <div className="flex flex-wrap gap-1">
          {contact.contactTag && (
            <Badge className={`text-xs ${contactTagColors[contact.contactTag as keyof typeof contactTagColors] || 'bg-gray-500 text-white'}`}>
              {contact.contactTag.charAt(0).toUpperCase() + contact.contactTag.slice(1)}
            </Badge>
          )}
          {contact.contactTag === 'lead' && contact.leadStatus && (
            <Badge className={`text-xs flex items-center gap-0.5 ${leadStatusColors[contact.leadStatus as keyof typeof leadStatusColors] || 'bg-gray-100 text-gray-800'}`}>
              <Thermometer className="h-3 w-3" />
              {contact.leadStatus.charAt(0).toUpperCase() + contact.leadStatus.slice(1)}
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      header: '',
      width: 'w-20',
      render: (contact) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(contact)} className="h-7 w-7 p-0">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, contact.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <CrmPageShell>
      <div className="flex h-full">
        <SavedViewsSidebar
          objectType="contact"
          activeViewId={activeViewId}
          onSelectView={handleSelectView}
          currentFilters={{ leadStatus: statusFilter !== 'all' ? statusFilter : undefined, contactTag: contactTagFilter !== 'all' ? contactTagFilter : undefined }}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {contactsError && (
            <div className="mx-4 mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              Unable to load contacts. Check your connection and try refreshing.
            </div>
          )}
      <CrmTopBar
        title="Contacts"
        subtitle={`${filteredContacts.length} contacts`}
        actions={
          <>
            <Button
              variant={viewMode === 'lists' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode(viewMode === 'lists' ? 'contacts' : 'lists')}
            >
              <List className="w-4 h-4 mr-1.5" />Lists
            </Button>
            {viewMode === 'contacts' && <>
              <CsvExportButton entityType="contacts" />
              <Button variant="outline" size="sm" onClick={() => setShowFileUpload(!showFileUpload)}>
                <Upload className="w-4 h-4 mr-1.5" />Import
              </Button>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="w-4 h-4 mr-1.5" />Add Contact
              </Button>
            </>}
          </>
        }
        filters={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search contacts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-60 h-9" />
            </div>
            <Select value={crmRoleFilter} onValueChange={setCrmRoleFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="CRE Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="listing_broker">Listing Broker</SelectItem>
            <SelectItem value="buyers_broker">Buyer's Broker</SelectItem>
            <SelectItem value="lender">Lender</SelectItem>
            <SelectItem value="investor_lp">Investor (LP)</SelectItem>
            <SelectItem value="investor_gp">Investor (GP)</SelectItem>
            <SelectItem value="family_office">Family Office</SelectItem>
            <SelectItem value="institutional_buyer">Institutional</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contactTagFilter} onValueChange={setContactTagFilter}>
              <SelectTrigger className="w-32 h-9"><SelectValue placeholder="All Tags" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="competitor">Competitor</SelectItem>
                <SelectItem value="broker">Broker</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="lender">Lender</SelectItem>
                <SelectItem value="attorney">Attorney</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {showFileUpload && (
          <div className="bg-white border-b border-gray-200 p-4">
            <FileUpload onUpload={handleFileUpload} title="Import Contacts" description="Upload CSV, TXT, PDF, DOCX, or XLSX files" acceptedFileTypes={['.txt', '.csv', '.pdf', '.docx', '.xlsx']} maxFiles={5} />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-white border-b border-gray-200">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Contacts</p>
                <p className="text-2xl font-bold text-gray-900">{totalContacts}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Prospects</p>
                <p className="text-2xl font-bold text-gray-900">{prospects}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Clients</p>
                <p className="text-2xl font-bold text-gray-900">{clients}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Hot Leads</p>
                <p className="text-2xl font-bold text-gray-900">{hotLeads}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">{selectedIds.size} {selectedIds.size === 1 ? 'contact' : 'contacts'} selected</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkExport}><Download className="w-3.5 h-3.5 mr-1.5" />Export</Button>
              <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}><Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {viewMode === 'lists' ? (
            <div className="p-4">
              <CrmListsManager entityType="contact" />
            </div>
          ) : (
            <CrmDataTable
              data={filteredContacts}
              columns={columns}
              isLoading={isLoading}
              selectedId={drawerContactId}
              onRowClick={handleRowClick}
              getRowId={(c) => c.id}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              emptyState={{
                title: searchTerm || statusFilter !== 'all' ? 'No contacts found' : 'No contacts yet',
                description: searchTerm || statusFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'Start by adding your first contact.',
                action: !searchTerm && statusFilter === 'all' ? { label: 'Add Contact', onClick: handleAdd } : undefined
              }}
            />
          )}
        </div>
      </div>

      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        entityType="contact"
        entityId={drawerContactId}
        onDelete={() => { setDrawerOpen(false); setDrawerContactId(null); }}
      />

      <ContactFormModal isOpen={isContactFormOpen} onClose={() => { setIsContactFormOpen(false); setEditingContact(null); }} contact={editingContact} />
      <ImportResultsModal isOpen={showImportResults} onClose={() => setShowImportResults(false)} results={importResults} entityType="contacts" />
      <CreateContactWizardModal open={isCreateWizardOpen} onOpenChange={setIsCreateWizardOpen} />
        </div>
      </div>
    </CrmPageShell>
  );
}