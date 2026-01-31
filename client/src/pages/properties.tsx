import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Search, Edit, Trash2, MapPin, Anchor, Building, DollarSign, Home, TrendingUp, FolderPlus } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import PropertyFormModal from "@/components/modals/property-form-modal";
import { CreatePropertyWizardModal } from "@/components/modals/create-property-wizard-modal";
import PortfolioWizard from "@/components/salescomps/sales-comps/PortfolioWizard";
import { CrmPageShell } from "@/components/crm/CrmPageShell";
import { CrmTopBar } from "@/components/crm/CrmTopBar";
import { CrmDataTable, type CrmColumn } from "@/components/crm/CrmDataTable";
import { DetailDrawer } from "@/components/crm/detail-drawer";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  // HubSpot-style: Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPropertyId, setDrawerPropertyId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

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

  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      const matchesSearch = !searchTerm || 
        property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || property.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || property.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [properties, searchTerm, typeFilter, statusFilter]);

  const totalProperties = properties.length;
  const marinas = properties.filter(p => p.type === 'marina').length;
  const available = properties.filter(p => p.status === 'available').length;
  const underContract = properties.filter(p => p.status === 'under_contract').length;

  const columns: CrmColumn<Property>[] = [
    {
      key: 'property',
      header: 'Property',
      render: (property) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
            {getPropertyIcon(property.type)}
          </div>
          <div className="min-w-0">
            <button
              onClick={(e) => handleNameClick(e, property)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block text-left"
            >
              {property.title}
            </button>
            <div className="text-xs text-gray-500 truncate">{getSpecificationSummary(property)}</div>
          </div>
        </div>
      )
    },
    {
      key: 'type',
      header: 'Type',
      render: (property) => (
        <Badge className={propertyTypeColors[property.type] || 'bg-gray-100 text-gray-800'}>
          {toTitleCase(property.type)}
        </Badge>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (property) => (
        <Badge className={statusColors[property.status] || 'bg-gray-100 text-gray-800'}>
          {toTitleCase(property.status)}
        </Badge>
      )
    },
    {
      key: 'price',
      header: 'Est. Price',
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
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="under_contract">Under Contract</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="off_market">Off Market</SelectItem>
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

        <div className="flex-1 overflow-auto">
          <CrmDataTable
            data={filteredProperties}
            columns={columns}
            isLoading={isLoading}
            selectedId={drawerPropertyId}
            onRowClick={handleRowClick}
            getRowId={(p) => p.id}
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
    </CrmPageShell>
  );
}