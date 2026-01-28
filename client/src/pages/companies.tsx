import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building, Plus, Edit, Trash2, Upload, Search, Globe, Users, MapPin, TrendingUp, Download, Phone, Settings, Calendar, Briefcase, Home, Loader2, User, ChevronRight, Anchor, DollarSign, Merge, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import CompanyFormModal from "@/components/modals/company-form-modal";
import { CreateCompanyWizardModal } from "@/components/modals/create-company-wizard-modal";
import { FileUpload } from "@/components/file-upload";
import KpiSettingsModal from "@/components/modals/kpi-settings-modal";
import { CrmPageShell } from "@/components/crm/CrmPageShell";
import { CrmTopBar } from "@/components/crm/CrmTopBar";
import { CrmSplitView } from "@/components/crm/CrmSplitView";
import { CrmDataTable, type CrmColumn } from "@/components/crm/CrmDataTable";
import { CrmDetailsPanel, CrmDetailSection, CrmDetailField } from "@/components/crm/CrmDetailsPanel";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/utils";
import type { Company, KpiConfigItem, Contact, Property } from "@shared/schema";

const industryColors: Record<string, string> = {
  technology: 'bg-blue-100 text-blue-800',
  manufacturing: 'bg-green-100 text-green-800',
  finance: 'bg-purple-100 text-purple-800',
  healthcare: 'bg-red-100 text-red-800',
  retail: 'bg-orange-100 text-orange-800',
  consulting: 'bg-indigo-100 text-indigo-800',
  education: 'bg-yellow-100 text-yellow-800',
  marina_operator: 'bg-cyan-100 text-cyan-800',
  marina_owner: 'bg-teal-100 text-teal-800',
  investor: 'bg-emerald-100 text-emerald-800',
  broker: 'bg-amber-100 text-amber-800',
  other: 'bg-gray-100 text-gray-800'
};

const formatRole = (role: string | null | undefined): string => {
  if (!role) return "-";
  return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const sizeColors: Record<string, string> = {
  'startup': 'bg-green-100 text-green-800',
  'small': 'bg-blue-100 text-blue-800', 
  'medium': 'bg-yellow-100 text-yellow-800',
  'large': 'bg-purple-100 text-purple-800',
  'enterprise': 'bg-red-100 text-red-800'
};

const PAGE_KEY = 'crm_companies';

const DEFAULT_KPI_CONFIG: KpiConfigItem[] = [
  { title: 'Total Companies', metricType: 'total_companies', icon: 'building', color: 'blue' },
  { title: 'Portfolio Companies', metricType: 'portfolio_companies', icon: 'briefcase', color: 'purple' },
  { title: 'Active Deals', metricType: 'active_deals', icon: 'trendingUp', color: 'green' },
  { title: 'New This Month', metricType: 'new_this_month', icon: 'calendar', color: 'orange' },
];

const AVAILABLE_METRICS = [
  { value: 'total_companies', label: 'Total Companies', icon: 'building', color: 'blue' },
  { value: 'portfolio_companies', label: 'Portfolio Companies (2+ properties)', icon: 'briefcase', color: 'purple' },
  { value: 'active_deals', label: 'Companies with Active Deals', icon: 'trendingUp', color: 'green' },
  { value: 'new_this_month', label: 'New This Month', icon: 'calendar', color: 'orange' },
  { value: 'number_of_marinas', label: 'Number of Marinas', icon: 'home', color: 'teal' },
  { value: 'with_website', label: 'With Website', icon: 'globe', color: 'teal' },
  { value: 'with_contacts', label: 'With Contacts', icon: 'users', color: 'indigo' },
  { value: 'with_properties', label: 'With Properties', icon: 'home', color: 'blue' },
];

const iconMap: Record<string, any> = {
  building: Building,
  users: Users,
  trendingUp: TrendingUp,
  calendar: Calendar,
  globe: Globe,
  briefcase: Briefcase,
  home: Home,
};

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
  red: { bg: 'bg-red-100', text: 'text-red-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
};

export default function Companies() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isKpiSettingsOpen, setIsKpiSettingsOpen] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });
  
  const { data: companyContacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/companies', selectedCompany?.id, 'contacts'],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const response = await fetch(`/api/companies/${selectedCompany.id}/contacts`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedCompany?.id,
  });
  
  const { data: companyProperties = [] } = useQuery<Property[]>({
    queryKey: ['/api/companies', selectedCompany?.id, 'properties'],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const response = await fetch(`/api/companies/${selectedCompany.id}/properties`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedCompany?.id,
  });
  
  const { data: companySalesComps = [] } = useQuery<any[]>({
    queryKey: ['/api/companies', selectedCompany?.id, 'acquisitions'],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const response = await fetch(`/api/sales-comps?buyerCompanyId=${selectedCompany.id}`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : data.comps || [];
    },
    enabled: !!selectedCompany?.id,
  });
  
  const lastAcquisition = useMemo(() => {
    if (!companySalesComps?.length) return null;
    const sorted = [...companySalesComps].sort((a, b) => {
      const dateA = new Date(a.saleDate || a.closingDate || 0);
      const dateB = new Date(b.saleDate || b.closingDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
    return sorted[0];
  }, [companySalesComps]);
  
  const topContacts = useMemo(() => {
    return companyContacts.slice(0, 3);
  }, [companyContacts]);
  
  useEffect(() => {
    if (companies && searchString) {
      const params = new URLSearchParams(searchString);
      const selectedId = params.get('selected');
      if (selectedId) {
        const company = companies.find(c => c.id === selectedId);
        if (company) {
          setSelectedCompany(company);
          setLocation('/crm/companies', { replace: true });
        }
      }
    }
  }, [companies, searchString, setLocation]);

  const { data: kpiPreferences } = useQuery<{ kpiConfig: KpiConfigItem[] }>({
    queryKey: ['/api/user-preferences/kpis', PAGE_KEY],
  });

  const { data: kpiStats, isLoading: isLoadingStats } = useQuery<{
    portfolioCompanies: number;
    companiesWithActiveDeals: number;
    newThisMonth: number;
    withProperties: number;
    withContacts: number;
  }>({
    queryKey: ['/api/companies/kpi-stats'],
  });

  const kpiConfig = useMemo(() => {
    return (kpiPreferences?.kpiConfig && kpiPreferences.kpiConfig.length > 0) 
      ? kpiPreferences.kpiConfig 
      : DEFAULT_KPI_CONFIG;
  }, [kpiPreferences]);

  const getKpiValue = (metricType: string): number | null => {
    switch (metricType) {
      case 'total_companies': return companies?.length || 0;
      case 'portfolio_companies': return kpiStats?.portfolioCompanies ?? null;
      case 'active_deals': return kpiStats?.companiesWithActiveDeals ?? null;
      case 'new_this_month': return kpiStats?.newThisMonth ?? null;
      case 'with_website': return companies?.filter(c => c.website).length || 0;
      case 'with_contacts': return kpiStats?.withContacts ?? null;
      case 'with_properties': return kpiStats?.withProperties ?? null;
      case 'number_of_marinas': return kpiStats?.withProperties ?? null;
      default: return 0;
    }
  };

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: "Company deleted successfully" });
      setSelectedCompany(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete company", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => apiRequest('POST', '/api/companies/bulk/delete', { ids }),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} company(ies) deleted successfully` });
    },
    onError: () => {
      toast({ title: "Failed to delete companies", variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ primaryId, secondaryId }: { primaryId: string; secondaryId: string }) => {
      const response = await apiRequest('POST', '/api/crm/companies/merge', { primaryId, secondaryId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Companies merged successfully" });
      setSelectedCompanies(new Set());
      setShowMergeDialog(false);
      setMergeMode(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to merge companies", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this company?')) {
      deleteCompanyMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setEditingCompany(null);
    setIsCreateWizardOpen(true);
  };

  const handleRowClick = (company: Company) => {
    setSelectedCompany(company);
  };

  const handleCloseDetail = () => {
    setSelectedCompany(null);
  };

  const handleFileUpload = async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/upload/companies', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      const totalCreated = result.results.reduce((sum: number, r: any) => sum + (r.created || 0), 0);
      toast({ title: "Import successful", description: `Created ${totalCreated} new companies from ${files.length} file(s)` });
      setShowFileUpload(false);
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to process files", variant: "destructive" });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} company(ies)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;
    const selectedCompanies = companies?.filter(c => selectedIds.has(c.id)) || [];
    const csv = [
      ['Name', 'Industry', 'Size', 'Phone', 'Website', 'Address'].join(','),
      ...selectedCompanies.map(c => [c.name, c.industry || '', c.size || '', c.phone || '', c.website || '', c.address || ''].map(f => `"${f}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `companies_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${selectedIds.size} company(ies)` });
  };

  const handleToggleSelect = (companyId: string) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId);
    } else {
      newSelected.add(companyId);
    }
    setSelectedCompanies(newSelected);
  };

  const handleMerge = () => {
    if (selectedCompanies.size !== 2) {
      toast({ 
        title: "Select exactly 2 companies", 
        description: "Please select exactly 2 companies to merge",
        variant: "destructive" 
      });
      return;
    }
    setShowMergeDialog(true);
  };

  const confirmMerge = () => {
    const ids = Array.from(selectedCompanies);
    mergeMutation.mutate({ primaryId: ids[0], secondaryId: ids[1] });
  };

  const getSelectedCompaniesData = () => {
    const ids = Array.from(selectedCompanies);
    if (!companies) return [];
    return ids.map(id => companies.find((c: Company) => c.id === id)).filter(Boolean);
  };

  const getIndustryCategory = (industry?: string): string => {
    if (!industry) return 'other';
    const normalized = industry.toLowerCase();
    if (normalized.includes('marina') && normalized.includes('operator')) return 'marina_operator';
    if (normalized.includes('marina') && normalized.includes('owner')) return 'marina_owner';
    if (normalized.includes('investor')) return 'investor';
    if (normalized.includes('broker')) return 'broker';
    if (normalized.includes('tech')) return 'technology';
    if (normalized.includes('consulting')) return 'consulting';
    return 'other';
  };

  const getSizeCategory = (size?: string): string => {
    if (!size) return 'small';
    const normalized = size.toLowerCase();
    if (normalized.includes('startup') || normalized.includes('1-10')) return 'startup';
    if (normalized.includes('small') || normalized.includes('11-50')) return 'small';
    if (normalized.includes('medium') || normalized.includes('51-200')) return 'medium';
    if (normalized.includes('large') || normalized.includes('201-1000')) return 'large';
    if (normalized.includes('enterprise') || normalized.includes('1000+')) return 'enterprise';
    return 'small';
  };

  const filteredCompanies = useMemo(() => {
    return companies?.filter(company => {
      const matchesSearch = !searchTerm || 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.website?.toLowerCase().includes(searchTerm.toLowerCase());
      const companyIndustry = getIndustryCategory(company.industry ?? undefined);
      const matchesIndustry = industryFilter === 'all' || companyIndustry === industryFilter;
      const companySize = getSizeCategory(company.size ?? undefined);
      const matchesSize = sizeFilter === 'all' || companySize === sizeFilter;
      return matchesSearch && matchesIndustry && matchesSize;
    }) || [];
  }, [companies, searchTerm, industryFilter, sizeFilter]);

  const columns: CrmColumn<Company>[] = [
    ...(mergeMode ? [{
      key: 'select',
      header: '',
      width: 'w-10',
      render: (company: Company) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedCompanies.has(company.id)}
            onCheckedChange={() => handleToggleSelect(company.id)}
          />
        </div>
      ),
    }] : []),
    {
      key: 'company',
      header: 'Company',
      render: (company) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{company.name}</div>
            {company.address && (
              <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {company.address}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role',
      render: (company) => company.industry ? (
        <Badge className={industryColors[company.industry] || industryColors[getIndustryCategory(company.industry)] || 'bg-gray-100 text-gray-800'}>
          {formatRole(company.industry)}
        </Badge>
      ) : <span className="text-gray-400">—</span>
    },
    {
      key: 'size',
      header: 'Size',
      render: (company) => company.size ? (
        <Badge className={sizeColors[getSizeCategory(company.size)] || 'bg-gray-100 text-gray-800'}>
          {company.size}
        </Badge>
      ) : <span className="text-gray-400">—</span>
    },
    {
      key: 'marinas',
      header: '# Marinas',
      render: (company) => (
        <span className="text-sm font-medium text-gray-900">{company.portfolioCount || 0}</span>
      )
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (company) => company.phone ? (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Phone className="w-3.5 h-3.5 text-gray-400" />
          <span>{company.phone}</span>
        </div>
      ) : <span className="text-gray-400">—</span>
    },
    {
      key: 'actions',
      header: '',
      width: 'w-20',
      render: (company) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(company)} className="h-7 w-7 p-0">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(company.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" disabled={deleteCompanyMutation.isPending}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    }
  ];

  const listContent = (
    <div className="flex flex-col h-full">
      {showFileUpload && (
        <div className="bg-white border-b border-gray-200 p-4">
          <FileUpload onUpload={handleFileUpload} title="Import Companies" description="Upload CSV, TXT, or PDF files with company information" acceptedFileTypes={['.txt', '.csv', '.pdf', '.docx']} maxFiles={5} />
        </div>
      )}

      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Key Metrics</h2>
          <Button variant="ghost" size="sm" onClick={() => setIsKpiSettingsOpen(true)} className="h-7 px-2 text-gray-500 hover:text-gray-700">
            <Settings className="w-3.5 h-3.5 mr-1" />
            Customize
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {kpiConfig.map((kpi, index) => {
            const IconComponent = iconMap[kpi.icon || 'building'] || Building;
            const colors = colorMap[kpi.color || 'blue'] || colorMap.blue;
            const value = getKpiValue(kpi.metricType);
            const isKpiLoading = value === null && isLoadingStats;
            return (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{kpi.title}</p>
                    {isKpiLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-1" />
                    ) : (
                      <p className="text-xl font-bold text-gray-900">{formatNumber(value)}</p>
                    )}
                  </div>
                  <div className={`w-9 h-9 ${colors.bg} rounded-lg flex items-center justify-center`}>
                    <IconComponent className={`w-4 h-4 ${colors.text}`} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">{selectedIds.size} company(ies) selected</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkExport}><Download className="w-3.5 h-3.5 mr-1.5" />Export</Button>
            <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}><Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <CrmDataTable
          data={filteredCompanies}
          columns={columns}
          isLoading={isLoading}
          selectedId={selectedCompany?.id}
          onRowClick={handleRowClick}
          getRowId={(c) => c.id}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          emptyState={{
            title: searchTerm || industryFilter !== 'all' || sizeFilter !== 'all' ? 'No companies found' : 'No companies yet',
            description: searchTerm || industryFilter !== 'all' || sizeFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Start by adding your first company to build your network.',
            action: !searchTerm && industryFilter === 'all' && sizeFilter === 'all' ? { label: 'Add Company', onClick: handleAdd } : undefined
          }}
        />
      </div>
    </div>
  );

  const detailsContent = selectedCompany ? (
    <CrmDetailsPanel
      title={selectedCompany.name}
      subtitle={selectedCompany.industry ? formatRole(selectedCompany.industry) : undefined}
      onEdit={() => handleEdit(selectedCompany)}
      onDelete={() => handleDelete(selectedCompany.id)}
    >
      <CrmDetailSection title="Company Information">
        <CrmDetailField label="Phone" value={selectedCompany.phone} />
        <CrmDetailField label="Website" value={selectedCompany.website ? (
          <a href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{selectedCompany.website}</a>
        ) : null} />
        <CrmDetailField label="Address" value={selectedCompany.address} />
        <CrmDetailField label="Industry" value={selectedCompany.industry ? (
          <Badge className={industryColors[selectedCompany.industry] || 'bg-gray-100 text-gray-800'}>{formatRole(selectedCompany.industry)}</Badge>
        ) : null} />
        <CrmDetailField label="Size" value={
          companyProperties.length > 0 ? (
            <button 
              onClick={() => setShowPropertiesModal(true)}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              <span>{companyProperties.length} {companyProperties.length === 1 ? 'Property' : 'Properties'}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            selectedCompany.size ? (
              <Badge className={sizeColors[getSizeCategory(selectedCompany.size)] || 'bg-gray-100 text-gray-800'}>{selectedCompany.size}</Badge>
            ) : null
          )
        } />
      </CrmDetailSection>

      <CrmDetailSection title="Portfolio">
        <CrmDetailField label="# of Marinas" value={selectedCompany.portfolioCount || companyProperties.length || 0} />
        <CrmDetailField label="Portfolio Company" value={selectedCompany.isPortfolioCompany ? 'Yes' : 'No'} />
        {selectedCompany.isPortfolioCompany && selectedCompany.capitalPartner && (
          <CrmDetailField label="Capital Partner" value={selectedCompany.capitalPartner} />
        )}
        {lastAcquisition && (
          <CrmDetailField label="Last Acquisition" value={
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-green-600" />
              <span className="text-sm">
                {lastAcquisition.propertyName || lastAcquisition.name || 'Marina'} 
                {' - '}
                {new Date(lastAcquisition.saleDate || lastAcquisition.closingDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          } />
        )}
      </CrmDetailSection>

      {topContacts.length > 0 && (
        <CrmDetailSection title="Key Contacts">
          <div className="space-y-2">
            {topContacts.map((contact: Contact) => (
              <div 
                key={contact.id}
                onClick={() => setLocation(`/crm/contacts?selected=${contact.id}`)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {contact.firstName} {contact.lastName}
                  </div>
                  {contact.position && (
                    <div className="text-xs text-gray-500 truncate">{contact.position}</div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
            {companyContacts.length > 3 && (
              <button 
                onClick={() => setLocation(`/crm/contacts?company=${selectedCompany.id}`)}
                className="text-xs text-blue-600 hover:underline pl-2"
              >
                View all {companyContacts.length} contacts
              </button>
            )}
          </div>
        </CrmDetailSection>
      )}

      {selectedCompany.description && (
        <CrmDetailSection title="Description">
          <p className="text-sm text-gray-700">{selectedCompany.description}</p>
        </CrmDetailSection>
      )}
    </CrmDetailsPanel>
  ) : null;

  return (
    <CrmPageShell>
      <CrmTopBar
        title="Companies"
        subtitle={`${companies?.length || 0} companies`}
        actions={
          <>
            <Button
              variant={mergeMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMergeMode(!mergeMode);
                if (mergeMode) {
                  setSelectedCompanies(new Set());
                }
              }}
            >
              <Merge className="h-4 w-4 mr-2" />
              {mergeMode ? "Cancel Merge" : "Merge Duplicates"}
            </Button>
            {mergeMode && selectedCompanies.size > 0 && (
              <Button
                size="sm"
                onClick={handleMerge}
                disabled={selectedCompanies.size !== 2}
              >
                Merge Selected ({selectedCompanies.size}/2)
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowFileUpload(!showFileUpload)}>
              <Upload className="h-4 w-4 mr-2" />Import
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />Add Company
            </Button>
          </>
        }
        filters={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search companies..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-60 h-9" />
            </div>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="marina_operator">Marina Operator</SelectItem>
                <SelectItem value="marina_owner">Marina Owner</SelectItem>
                <SelectItem value="investor">Investor</SelectItem>
                <SelectItem value="broker">Broker</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="consulting">Consulting</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-28 h-9"><SelectValue placeholder="All Sizes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                <SelectItem value="startup">Startup</SelectItem>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <CrmSplitView list={listContent} details={detailsContent} isDetailOpen={!!selectedCompany} onCloseDetail={handleCloseDetail} />

      <CompanyFormModal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingCompany(null); }} company={editingCompany} />
      <KpiSettingsModal isOpen={isKpiSettingsOpen} onClose={() => setIsKpiSettingsOpen(false)} pageKey={PAGE_KEY} currentConfig={kpiConfig} availableMetrics={AVAILABLE_METRICS} />
      
      <Dialog open={showPropertiesModal} onOpenChange={setShowPropertiesModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              Properties Owned by {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {companyProperties.length > 0 ? (
              <div className="space-y-3 p-1">
                {companyProperties.map((property: any) => (
                  <div 
                    key={property.id}
                    onClick={() => {
                      setShowPropertiesModal(false);
                      setLocation(`/crm/properties?selected=${property.id}`);
                    }}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Anchor className="w-6 h-6 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{property.name || property.propertyName}</div>
                      {property.address && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {property.address}
                        </div>
                      )}
                      {(property.city || property.state) && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {[property.city, property.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Building className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No properties linked to this company</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Merge
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will merge these two companies:</p>
                {getSelectedCompaniesData().length === 2 && (
                  <div className="space-y-2">
                    <div className="p-2 border rounded bg-green-50 dark:bg-green-950">
                      <p className="font-medium text-green-700 dark:text-green-300">Keep: {getSelectedCompaniesData()[0]?.name}</p>
                      <p className="text-xs text-muted-foreground">All contacts and properties will be moved here</p>
                    </div>
                    <div className="p-2 border rounded bg-red-50 dark:bg-red-950">
                      <p className="font-medium text-red-700 dark:text-red-300">Delete: {getSelectedCompaniesData()[1]?.name}</p>
                      <p className="text-xs text-muted-foreground">This company will be removed after merge</p>
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  All linked contacts and properties from the deleted company will be transferred to the kept company.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge} disabled={mergeMutation.isPending}>
              {mergeMutation.isPending ? "Merging..." : "Confirm Merge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateCompanyWizardModal
        open={isCreateWizardOpen}
        onOpenChange={setIsCreateWizardOpen}
      />
    </CrmPageShell>
  );
}
