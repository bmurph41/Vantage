import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Search, Edit, Trash2, MapPin, Anchor, Building, DollarSign, Home, TrendingUp, FolderPlus, AlertTriangle, CheckCircle } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import PropertyFormModal from "@/components/modals/property-form-modal";
import { CreatePropertyWizardModal } from "@/components/modals/create-property-wizard-modal";
import PortfolioWizard from "@/components/salescomps/sales-comps/PortfolioWizard";
import { CrmPageShell } from "@/components/crm/CrmPageShell";
import { CrmTopBar } from "@/components/crm/CrmTopBar";
import { CrmDataTable, type CrmColumn } from "@/components/crm/CrmDataTable";
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { SavedViewsSidebar } from '@/components/crm/SavedViewsSidebar';
import { BulkActionBar } from "@/components/ui/_primitives/bulk-action-bar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const toTitleCase = (str: string) => 
  str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

type Property = {
  id: string;
  title: string;
  type: 'marina' | 'boat' | 'slip' | 'dry_storage';
  status: 'available' | 'under_contract' | 'sold' | 'off_market';
  listingPrice?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  specifications?: {
    slipCount?: number;
    maxBoatLength?: number;
    dockType?: string;
    amenities?: string[];
    make?: string;
    model?: string;
    year?: number;
    length?: number;
    boatType?: string;
  };
  description?: string;
  images?: string[];
  ownerId: string;
  listingAgentId?: string;
  createdAt: string;
  updatedAt: string;
  wetSlips?: number;
  drySlips?: number;
  moorings?: number;
  totalCapacity?: number;
  lastSaleMonth?: number;
  lastSaleYear?: number;
  lastSalePrice?: number;
};

const propertyTypeColors: Record<string, string> = {
  marina: 'bg-blue-100 text-blue-800',
  boat: 'bg-green-100 text-green-800',
  slip: 'bg-purple-100 text-purple-800',
  dry_storage: 'bg-orange-100 text-orange-800'
};

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  under_contract: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-gray-100 text-gray-800',
  off_market: 'bg-red-100 text-red-800'
};
const listingStatusColors: Record<string, string> = {
  off_market:      'bg-gray-100 text-gray-700 border-gray-300',
  on_market:       'bg-green-100 text-green-800 border-green-300',
  under_loi:       'bg-amber-100 text-amber-800 border-amber-300',
  under_contract:  'bg-blue-100 text-blue-800 border-blue-300',
  closed:          'bg-purple-100 text-purple-800 border-purple-300',
  portfolio:       'bg-teal-100 text-teal-800 border-teal-300',
  watchlist:       'bg-orange-100 text-orange-800 border-orange-300',
  // Legacy values
  available:       'bg-green-100 text-green-800 border-green-300',
  sold:            'bg-purple-100 text-purple-800 border-purple-300',
};

const listingStatusLabels: Record<string, string> = {
  off_market: 'Off Market',
  on_market: 'On Market',
  under_loi: 'Under LOI',
  under_contract: 'Under Contract',
  closed: 'Closed',
  portfolio: 'Portfolio',
  watchlist: 'Watchlist',
  available: 'Available',
  sold: 'Sold',
};



function findDuplicateGroups(properties: Property[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (let i = 0; i < properties.length; i++) {
    for (let j = i + 1; j < properties.length; j++) {
      const a = properties[i];
      const b = properties[j];
      const nameA = normalize(a.title);
      const nameB = normalize(b.title);
      if (!nameA || !nameB) continue;
      const nameMatch = nameA.includes(nameB) || nameB.includes(nameA);
      if (!nameMatch) continue;

      const addrA = normalize(a.address || '');
      const addrB = normalize(b.address || '');
      const bothHaveAddress = addrA.length > 0 && addrB.length > 0;
      const locationMatch = !bothHaveAddress || addrA.includes(addrB) || addrB.includes(addrA);

      if (nameMatch && locationMatch) {
        const key = nameA < nameB ? nameA : nameB;
        if (!groups.has(key)) groups.set(key, []);
        const group = groups.get(key)!;
        if (!group.includes(a.id)) group.push(a.id);
        if (!group.includes(b.id)) group.push(b.id);
      }
    }
  }
  return groups;
}

export default function Properties() {
  const [, setLocation] = useLocation();
  const searchString = typeof window !== 'undefined' ? window.location.search : '';
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showPortfolioWizard, setShowPortfolioWizard] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('');
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>('default-0');

  // HubSpot-style: Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPropertyId, setDrawerPropertyId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  const duplicateGroups = useMemo(() => findDuplicateGroups(properties), [properties]);
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    duplicateGroups.forEach(group => group.forEach(id => ids.add(id)));
    return ids;
  }, [duplicateGroups]);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => apiRequest('POST', '/api/properties/bulk/delete', { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: `Successfully deleted ${selectedIds.size} property(ies)` });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Failed to bulk delete properties", variant: "destructive" });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) =>
      apiRequest('POST', '/api/properties/bulk/update-status', { ids, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: `Updated status for ${selectedIds.size} property(ies)` });
      setSelectedIds(new Set());
      setShowBulkStatusDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} property(ies)? This cannot be undone.`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleBulkStatusChange = () => {
    if (selectedIds.size === 0 || !bulkStatusValue) return;
    bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: bulkStatusValue });
  };

  useEffect(() => {
    if (properties.length > 0 && searchString) {
      const params = new URLSearchParams(searchString);
      const selectedId = params.get('selected');
      if (selectedId) {
        const property = properties.find(p => p.id === selectedId);
        if (property) {
          setDrawerPropertyId(selectedId);
          setDrawerOpen(true);
          setLocation('/crm/properties', { replace: true });
        }
      }
    }
  }, [properties, searchString, setLocation]);

  const deletePropertyMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/properties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property deleted successfully" });
      setDrawerOpen(false);
      setDrawerPropertyId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete property", variant: "destructive" });
    },
  });

  // HubSpot-style: Row click opens drawer
  const handleRowClick = (property: Property) => {
    setDrawerPropertyId(property.id);
    setDrawerOpen(true);
  };

  // HubSpot-style: Name click navigates to full record page
  const handleNameClick = (e: React.MouseEvent, property: Property) => {
    e.stopPropagation();
    setLocation(`/crm/properties/${property.id}`);
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setIsPropertyFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this property?')) {
      deletePropertyMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setEditingProperty(null);
    setIsCreateWizardOpen(true);
  };

  const handleFileUpload = async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/upload/properties', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      const totalCreated = result.results.reduce((sum: number, r: any) => sum + (r.created || 0), 0);
      toast({ title: "Files processed successfully", description: `Parsed ${totalCreated} properties from ${files.length} file(s)` });
      setShowFileUpload(false);
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to process files", variant: "destructive" });
    }
  };

  const formatPrice = (price?: string) => {
    if (!price) return '—';
    const num = parseFloat(price);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const getPropertyIcon = (type: string) => {
    switch (type) {
      case 'marina': return <Anchor className="w-4 h-4" />;
      case 'boat': return <Home className="w-4 h-4" />;
      case 'slip': return <MapPin className="w-4 h-4" />;
      case 'dry_storage': return <Building className="w-4 h-4" />;
      default: return <Home className="w-4 h-4" />;
    }
  };

  const getSpecificationSummary = (property: Property) => {
    const specs = property.specifications || {};
    if (property.type === 'marina') return specs.slipCount ? `${specs.slipCount} slips` : 'Marina';
    if (property.type === 'boat') return specs.length ? `${specs.length}ft ${specs.make || 'Boat'}` : 'Boat';
    if (property.type === 'slip') return specs.maxBoatLength ? `Max ${specs.maxBoatLength}ft` : 'Slip';
    return property.type.replace('_', ' ');
  };

  const handleSelectView = (view: any) => {
    if (!view) {
      setActiveViewId(null);
      setTypeFilter('all');
      setStatusFilter('all');
      return;
    }
    setActiveViewId(view.id);
    if (view.filters?.status) setStatusFilter(view.filters.status);
    else setStatusFilter('all');
    if (view.filters?.propertyType) setTypeFilter(view.filters.propertyType);
    else setTypeFilter('all');
  };

  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      const matchesSearch = !searchTerm || 
        property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || property.type === typeFilter;
      const matchesStatus = statusFilter === 'all' ||
        (property as any).listingStatus === statusFilter ||
        property.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [properties, searchTerm, typeFilter, statusFilter]);

  const totalProperties = properties.length;
  const marinas = properties.filter(p => p.type === 'marina').length;
  const available = properties.filter(p => p.status === 'available' || (p as any).listingStatus === 'on_market').length;
  const underContract = properties.filter(p => p.status === 'under_contract' || (p as any).listingStatus === 'under_contract' || (p as any).listingStatus === 'under_loi').length;

  const columns: CrmColumn<Property>[] = [
    {
      key: 'property',
      header: 'Property',
      sortable: true,
      sortValue: (property) => property.title.toLowerCase(),
      render: (property) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
            {getPropertyIcon(property.type)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleNameClick(e, property)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block text-left"
              >
                {property.title}
              </button>
              {duplicateIds.has(property.id) && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300 flex-shrink-0">
                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                  Duplicate
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">{getSpecificationSummary(property)}</div>
          </div>
        </div>
      )
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      sortValue: (property) => property.type,
      render: (property) => (
        <Badge className={propertyTypeColors[property.type] || 'bg-gray-100 text-gray-800'}>
          {toTitleCase(property.type)}
        </Badge>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (property) => property.status,
      render: (property) => (
        <Badge className={statusColors[property.status] || 'bg-gray-100 text-gray-800'}>
          {toTitleCase(property.status)}
        </Badge>
      )
    },
    {
      key: 'price',
      header: 'Est. Price',
      sortable: true,
      sortValue: (property) => property.listingPrice ? parseFloat(property.listingPrice) : null,
      render: (property) => (
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
          <span>{formatPrice(property.listingPrice)}</span>
        </div>
      )
    },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      sortValue: (property) => property.address || null,
      render: (property) => property.address ? (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">{property.address}</span>
        </div>
      ) : <span className="text-gray-400">—</span>
    },
    {
      key: 'actions',
      header: '',
      width: 'w-20',
      render: (property) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(property)} className="h-7 w-7 p-0">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(property.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
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
          objectType="property"
          activeViewId={activeViewId}
          onSelectView={handleSelectView}
          currentFilters={{ status: statusFilter !== 'all' ? statusFilter : undefined, propertyType: typeFilter !== 'all' ? typeFilter : undefined }}
        />
        <div className="flex-1 flex flex-col min-w-0">
      <CrmTopBar
        title="Properties"
        subtitle={`${totalProperties} properties`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowFileUpload(!showFileUpload)}>
              <Upload className="h-4 w-4 mr-2" />Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPortfolioWizard(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />Portfolio
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />Add Property
            </Button>
          </>
        }
        filters={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search properties..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-60 h-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="marina">Marina</SelectItem>
                <SelectItem value="boat">Boat</SelectItem>
                <SelectItem value="slip">Slip</SelectItem>
                <SelectItem value="dry_storage">Dry Storage</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-status-filter">
            <SelectValue placeholder="Listing Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="off_market">Off Market</SelectItem>
            <SelectItem value="on_market">On Market</SelectItem>
            <SelectItem value="under_loi">Under LOI</SelectItem>
            <SelectItem value="under_contract">Under Contract</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="portfolio">Portfolio</SelectItem>
            <SelectItem value="watchlist">Watchlist</SelectItem>
          </SelectContent>
        </Select>
          </>
        }
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {showFileUpload && (
          <div className="bg-white border-b border-gray-200 p-4">
            <FileUpload onUpload={handleFileUpload} title="Import Properties" description="Upload CSV, TXT, or PDF files with property information" acceptedFileTypes={['.txt', '.csv', '.pdf', '.docx']} maxFiles={5} />
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 p-4 bg-white border-b border-gray-200">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Properties</p>
                <p className="text-2xl font-bold text-gray-900">{totalProperties}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Home className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Marinas</p>
                <p className="text-2xl font-bold text-gray-900">{marinas}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Anchor className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Available</p>
                <p className="text-2xl font-bold text-gray-900">{available}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Under Contract</p>
                <p className="text-2xl font-bold text-gray-900">{underContract}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>

        {duplicateIds.size > 0 && (
          <div className="mx-4 mb-0">
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {duplicateIds.size} potential duplicate{duplicateIds.size !== 1 ? 's' : ''} detected
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Properties with similar names are flagged. Select duplicates and delete, or review individually.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => {
                  setSelectedIds(new Set(duplicateIds));
                }}
              >
                Select All Duplicates
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <CrmDataTable
            data={filteredProperties}
            columns={columns}
            isLoading={isLoading}
            selectedId={drawerPropertyId}
            onRowClick={handleRowClick}
            getRowId={(p) => p.id}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            emptyState={{
              title: searchTerm || typeFilter !== 'all' || statusFilter !== 'all' ? 'No properties found' : 'No properties yet',
              description: searchTerm || typeFilter !== 'all' || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by adding your first property.',
              action: !searchTerm && typeFilter === 'all' && statusFilter === 'all' ? { label: 'Add Property', onClick: handleAdd } : undefined
            }}
          />
        </div>
      </div>

      {/* HubSpot-style Detail Drawer */}
      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        entityType="property"
        entityId={drawerPropertyId}
        onDelete={() => { setDrawerOpen(false); setDrawerPropertyId(null); }}
      />

      <PropertyFormModal isOpen={isPropertyFormOpen} onClose={() => { setIsPropertyFormOpen(false); setEditingProperty(null); }} property={editingProperty} />
      <PortfolioWizard open={showPortfolioWizard} onClose={() => setShowPortfolioWizard(false)} />

      <CreatePropertyWizardModal
        open={isCreateWizardOpen}
        onOpenChange={setIsCreateWizardOpen}
      />

      <BulkActionBar
        selectedCount={selectedIds.size}
        itemLabel="property"
        onClearSelection={() => setSelectedIds(new Set())}
        actions={[
          {
            label: "Change Status",
            icon: <CheckCircle className="h-3.5 w-3.5" />,
            onClick: () => setShowBulkStatusDialog(true),
          },
          {
            label: `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`,
            icon: <Trash2 className="h-3.5 w-3.5" />,
            variant: "destructive",
            onClick: handleBulkDelete,
            disabled: bulkDeleteMutation.isPending,
          },
        ]}
      />

      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Update the status of {selectedIds.size} selected property(ies).
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
            <SelectTrigger><SelectValue placeholder="Select new status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="under_contract">Under Contract</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="off_market">Off Market</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkStatusDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkStatusChange} disabled={!bulkStatusValue || bulkStatusMutation.isPending}>
              Update {selectedIds.size} Property(ies)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </CrmPageShell>
  );
}