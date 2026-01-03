import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, Plus, Edit, Trash2, Upload, Search, Globe, Users, MapPin, TrendingUp, Download, Phone, Settings, Calendar, Briefcase, Home, Loader2 } from "lucide-react";
import CompanyFormModal from "@/components/modals/company-form-modal";
import CompanyDetailModal from "@/components/modals/company-detail-modal";
import ContactDetailModal from "@/components/modals/contact-detail-modal";
import PropertyDetailModal from "@/components/modals/property-detail-modal";
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { FileUpload } from "@/components/file-upload";
import KpiSettingsModal from "@/components/modals/kpi-settings-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company, Contact, Property, KpiConfigItem } from "@shared/schema";

const industryColors = {
  technology: 'bg-blue-100 text-blue-800',
  manufacturing: 'bg-green-100 text-green-800',
  finance: 'bg-purple-100 text-purple-800',
  healthcare: 'bg-red-100 text-red-800',
  retail: 'bg-orange-100 text-orange-800',
  consulting: 'bg-indigo-100 text-indigo-800',
  education: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800'
};

const sizeColors = {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isKpiSettingsOpen, setIsKpiSettingsOpen] = useState(false);
  
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isCompanyDetailModalOpen, setIsCompanyDetailModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

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
      case 'total_companies':
        return companies?.length || 0;
      case 'portfolio_companies':
        return kpiStats?.portfolioCompanies ?? null;
      case 'active_deals':
        return kpiStats?.companiesWithActiveDeals ?? null;
      case 'new_this_month':
        return kpiStats?.newThisMonth ?? null;
      case 'with_website':
        return companies?.filter(c => c.website).length || 0;
      case 'with_contacts':
        return kpiStats?.withContacts ?? null;
      case 'with_properties':
        return kpiStats?.withProperties ?? null;
      default:
        return 0;
    }
  };

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: "Company deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete company", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest('POST', '/api/companies/bulk/delete', { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} company(ies) deleted successfully` });
    },
    onError: () => {
      toast({ title: "Failed to delete companies", variant: "destructive" });
    },
  });

  const handleRowClick = (company: Company) => {
    setSelectedCompany(company);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCompany(company);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const company = companies?.find(c => c.id === id);
    if (company && confirm(`Are you sure you want to delete "${company.name}"? This action cannot be undone.`)) {
      deleteCompanyMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setEditingCompany(null);
    setIsFormOpen(true);
  };

  const handleFileUpload = async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload/companies', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      // Refresh companies list after successful upload
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      
      // Show success message with details
      const totalCreated = result.results.reduce((sum: number, r: any) => sum + (r.created || 0), 0);
      toast({
        title: "Files processed successfully",
        description: `Created ${totalCreated} new companies from ${files.length} file(s)`,
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
    if (selectedIds.size === filteredCompanies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCompanies.map(c => c.id)));
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
      ['Name', 'Industry', 'Size', 'Website', 'Phone', 'Email', 'Address'].join(','),
      ...selectedCompanies.map(c => [
        c.name,
        c.industry || '',
        c.size || '',
        c.website || '',
        c.phone || '',
        c.email || '',
        c.address || ''
      ].map(field => `"${field}"`).join(','))
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

  const getIndustryCategory = (industry?: string): string => {
    if (!industry) return 'other';
    const normalized = industry.toLowerCase();
    if (normalized.includes('tech') || normalized.includes('software') || normalized.includes('it')) return 'technology';
    if (normalized.includes('health') || normalized.includes('medical')) return 'healthcare';
    if (normalized.includes('finance') || normalized.includes('bank')) return 'finance';
    if (normalized.includes('retail') || normalized.includes('store')) return 'retail';
    if (normalized.includes('manufactur')) return 'manufacturing';
    if (normalized.includes('consult')) return 'consulting';
    if (normalized.includes('educat') || normalized.includes('school')) return 'education';
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

  // Filter companies based on search and filters
  const filteredCompanies = companies?.filter(company => {
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900" data-testid="companies-title">Companies</h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{companies?.length || 0} companies</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search companies" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64 h-9 text-sm border-gray-300 focus:border-gray-400"
                data-testid="search-companies"
              />
            </div>
            
            {/* Industry Filter */}
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-32 h-9 text-sm" data-testid="filter-industry">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="consulting">Consulting</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Size Filter */}
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-24 h-9 text-sm" data-testid="filter-size">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                <SelectItem value="startup">Startup</SelectItem>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Import Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFileUpload(!showFileUpload)}
              className="h-9 text-sm"
              data-testid="import-companies-button"
            >
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            
            {/* Add Company Button */}
            <Button 
              className="bg-blue-600 hover:bg-blue-700 h-9 text-sm" 
              size="sm" 
              onClick={handleAdd}
              data-testid="add-company-button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Company
            </Button>
          </div>
        </div>
      </div>
        
      <main className="flex-1 overflow-y-auto p-6" data-testid="companies-main">

        {/* File Upload Section */}
        {showFileUpload && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <FileUpload
              onUpload={handleFileUpload}
              title="Import Companies"
              description="Upload CSV, TXT, or PDF files with company information"
              acceptedFileTypes={['.txt', '.csv', '.pdf', '.docx']}
              maxFiles={5}
            />
          </div>
        )}

        {/* Customizable KPI Cards */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-500">Key Metrics</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsKpiSettingsOpen(true)}
            className="h-7 px-2 text-gray-500 hover:text-gray-700"
            data-testid="button-kpi-settings"
          >
            <Settings className="w-4 h-4 mr-1" />
            Customize
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {kpiConfig.map((kpi, index) => {
            const IconComponent = iconMap[kpi.icon || 'building'] || Building;
            const colors = colorMap[kpi.color || 'blue'] || colorMap.blue;
            const value = getKpiValue(kpi.metricType);
            const isLoading = value === null && isLoadingStats;
            
            return (
              <Card key={index} className="p-4 bg-white" data-testid={`kpi-card-${index}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
                    {isLoading ? (
                      <div className="flex items-center mt-1">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {value?.toLocaleString() || 0}
                      </p>
                    )}
                  </div>
                  <div className={`w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center`}>
                    <IconComponent className={`w-6 h-6 ${colors.text}`} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.size === filteredCompanies.length}
                onCheckedChange={toggleSelectAll}
                data-testid="checkbox-select-all-toolbar"
              />
              <span className="text-sm font-medium text-blue-900">
                {selectedIds.size} company(ies) selected
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
        ) : filteredCompanies.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || industryFilter !== 'all' || sizeFilter !== 'all' ? 'No companies found' : 'No companies yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || industryFilter !== 'all' || sizeFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by adding your first company to build your network.'}
            </p>
            {!searchTerm && industryFilter === 'all' && sizeFilter === 'all' && (
              <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Company
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
                      checked={selectedIds.size > 0 && selectedIds.size === filteredCompanies.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Industry</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Website</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCompanies.map((company: Company) => {
                  const industryCategory = getIndustryCategory(company.industry ?? undefined);
                  const sizeCategory = getSizeCategory(company.size ?? undefined);
                  
                  return (
                    <tr 
                      key={company.id} 
                      className="hover:bg-gray-50 transition-colors" 
                      data-testid={`row-company-${company.id}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(company.id)}
                          onCheckedChange={() => toggleSelection(company.id)}
                          data-testid={`checkbox-company-${company.id}`}
                        />
                      </td>

                      {/* Company */}
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleRowClick(company)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900" data-testid={`text-company-name-${company.id}`}>
                              {company.name}
                            </div>
                            {company.address && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {company.address}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      {/* Industry */}
                      <td className="px-6 py-4">
                        {company.industry ? (
                          <Badge className={industryColors[industryCategory as keyof typeof industryColors] || 'bg-gray-100 text-gray-800'} data-testid={`badge-company-industry-${company.id}`}>
                            {company.industry}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Size */}
                      <td className="px-6 py-4">
                        {company.size ? (
                          <Badge className={sizeColors[sizeCategory as keyof typeof sizeColors] || 'bg-gray-100 text-gray-800'} data-testid={`badge-company-size-${company.id}`}>
                            {company.size}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Website */}
                      <td className="px-6 py-4">
                        {company.website ? (
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900" data-testid={`text-company-website-${company.id}`}>
                              {company.website}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Phone */}
                      <td className="px-6 py-4">
                        {company.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900" data-testid={`text-company-phone-${company.id}`}>
                              {company.phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleEdit(company, e)}
                            className="h-8 w-8 p-0 hover:bg-gray-200"
                            data-testid={`button-edit-company-${company.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDelete(company.id, e)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            disabled={deleteCompanyMutation.isPending}
                            data-testid={`button-delete-company-${company.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        
        <CompanyFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingCompany(null);
          }}
          company={editingCompany}
        />

        <DetailDrawer
          open={isDetailModalOpen}
          onOpenChange={(open) => {
            setIsDetailModalOpen(open);
            if (!open) setSelectedCompany(null);
          }}
          entityType="company"
          entityId={selectedCompany?.id || null}
          onDelete={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
          }}
        />

        <CompanyDetailModal
          isOpen={isCompanyDetailModalOpen}
          onClose={() => {
            setIsCompanyDetailModalOpen(false);
            setSelectedCompany(null);
          }}
          company={selectedCompany}
          onContactClick={(contact) => {
            setSelectedContact(contact);
            setIsContactModalOpen(true);
          }}
          onPropertyClick={(property) => {
            setSelectedProperty(property);
            setIsPropertyModalOpen(true);
          }}
        />

        <ContactDetailModal
          isOpen={isContactModalOpen}
          onClose={() => {
            setIsContactModalOpen(false);
            setSelectedContact(null);
          }}
          contact={selectedContact}
          onCompanyClick={(company) => {
            setSelectedCompany(company);
            setIsCompanyDetailModalOpen(true);
          }}
          onPropertyClick={(property) => {
            setSelectedProperty(property);
            setIsPropertyModalOpen(true);
          }}
        />

        <PropertyDetailModal
          isOpen={isPropertyModalOpen}
          onClose={() => {
            setIsPropertyModalOpen(false);
            setSelectedProperty(null);
          }}
          property={selectedProperty}
          onContactClick={(contact) => {
            setSelectedContact(contact);
            setIsContactModalOpen(true);
          }}
          onCompanyClick={(company) => {
            setSelectedCompany(company);
            setIsCompanyDetailModalOpen(true);
          }}
        />

        <KpiSettingsModal
          isOpen={isKpiSettingsOpen}
          onClose={() => setIsKpiSettingsOpen(false)}
          pageKey={PAGE_KEY}
          currentConfig={kpiConfig}
          availableMetrics={AVAILABLE_METRICS}
        />
      </main>
    </div>
  );
}
