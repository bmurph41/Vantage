import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Search, Edit, Trash2, MapPin, Anchor, Building, DollarSign, Home, TrendingUp, AlertCircle, X } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import PropertyDetailModal from "@/components/modals/property-detail-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
// import PropertyFormModal from "@/components/modals/property-form-modal"; // TODO: Create PropertyFormModal component

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
};

const propertyTypeColors = {
  marina: 'bg-blue-100 text-blue-800',
  boat: 'bg-green-100 text-green-800',
  slip: 'bg-purple-100 text-purple-800',
  dry_storage: 'bg-orange-100 text-orange-800'
};

const statusColors = {
  available: 'bg-green-100 text-green-800',
  under_contract: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-gray-100 text-gray-800',
  off_market: 'bg-red-100 text-red-800'
};

type PendingPropertyProfile = {
  id: string;
  compId: string;
  orgId: string;
  status: string;
  createdAt: string;
};

export default function Properties() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showPendingBanner, setShowPendingBanner] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  const { data: pendingProfiles = [] } = useQuery<PendingPropertyProfile[]>({
    queryKey: ['/api/sales-comps/pending-property-profiles'],
    enabled: showPendingBanner,
  });

  const deletePropertyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete property", variant: "destructive" });
    },
  });

  const handleRowClick = (property: Property) => {
    setSelectedProperty(property);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (property: Property, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toast({
      title: "Feature coming soon",
      description: "Property editing will be available in the next update.",
    });
    // TODO: Uncomment when PropertyFormModal is implemented
    // setEditingProperty(property);
    // setIsPropertyFormOpen(true);
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Are you sure you want to delete this property?')) {
      deletePropertyMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    toast({
      title: "Feature coming soon",
      description: "Property form will be available in the next update.",
    });
    // TODO: Uncomment when PropertyFormModal is implemented
    // setEditingProperty(null);
    // setIsPropertyFormOpen(true);
  };

  const handleFileUpload = async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload/properties', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      
      const totalCreated = result.results.reduce((sum: number, r: any) => sum + (r.created || 0), 0);
      toast({
        title: "Files processed successfully",
        description: `Parsed ${totalCreated} properties from ${files.length} file(s)`,
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

  const formatPrice = (price?: string) => {
    if (!price) return '-';
    const num = parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
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
    if (property.type === 'marina') {
      return specs.slipCount ? `${specs.slipCount} slips` : 'Marina';
    }
    if (property.type === 'boat') {
      return specs.length ? `${specs.length}ft ${specs.make || 'Boat'}` : 'Boat';
    }
    if (property.type === 'slip') {
      return specs.maxBoatLength ? `Max ${specs.maxBoatLength}ft` : 'Slip';
    }
    return property.type.replace('_', ' ');
  };

  // Filter properties based on search and filters
  const filteredProperties = properties.filter(property => {
    const matchesSearch = !searchTerm || 
      property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || property.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || property.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const pendingCount = pendingProfiles.filter((p: PendingPropertyProfile) => p.status === 'pending').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Pending Property Profiles Banner */}
      {showPendingBanner && pendingCount > 0 && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-blue-50 border-blue-200" data-testid="pending-profiles-banner">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-900">
                <strong>{pendingCount}</strong> sales comp{pendingCount !== 1 ? 's' : ''} need property profile{pendingCount !== 1 ? 's' : ''}
              </span>
              <Button 
                variant="link" 
                className="h-auto p-0 text-sm text-blue-600 hover:text-blue-800 underline"
                onClick={() => {
                  toast({
                    title: "Feature coming soon",
                    description: "Property form will be available in the next update to complete these profiles.",
                  });
                }}
                data-testid="button-complete-profiles"
              >
                Complete now
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-100"
              onClick={() => setShowPendingBanner(false)}
              data-testid="button-dismiss-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900" data-testid="properties-title">Properties</h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{properties.length} properties</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search properties" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64 h-9 text-sm border-gray-300 focus:border-gray-400"
                data-testid="search-properties"
              />
            </div>
            
            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 h-9 text-sm" data-testid="filter-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="marina">Marina</SelectItem>
                <SelectItem value="boat">Boat</SelectItem>
                <SelectItem value="slip">Slip</SelectItem>
                <SelectItem value="dry_storage">Dry Storage</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9 text-sm" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="under_contract">Under Contract</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="off_market">Off Market</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Import Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFileUpload(!showFileUpload)}
              className="h-9 text-sm"
              data-testid="import-properties-button"
            >
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            
            {/* Add Property Button */}
            <Button 
              className="bg-blue-600 hover:bg-blue-700 h-9 text-sm" 
              size="sm" 
              onClick={handleAdd}
              data-testid="add-property-button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Property
            </Button>
          </div>
        </div>
      </div>
        
      <main className="flex-1 overflow-y-auto p-6" data-testid="properties-main">

        {/* File Upload Section */}
        {showFileUpload && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <FileUpload
              onUpload={handleFileUpload}
              title="Import Properties"
              description="Upload CSV, TXT, or PDF files with property information"
              acceptedFileTypes={['.txt', '.csv', '.pdf', '.docx']}
              maxFiles={5}
            />
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Properties</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{properties.length || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Home className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Marinas</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {properties.filter(p => p.type === 'marina').length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Anchor className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {properties.filter(p => p.status === 'available').length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Under Contract</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {properties.filter(p => p.status === 'under_contract').length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>

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
        ) : filteredProperties.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
              <Anchor className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' ? 'No properties found' : 'No properties yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by adding your first property listing.'}
            </p>
            {!searchTerm && typeFilter === 'all' && statusFilter === 'all' && (
              <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Property
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProperties.map((property) => (
                  <tr 
                    key={property.id} 
                    onClick={() => handleRowClick(property)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors" 
                    data-testid={`row-property-${property.id}`}
                  >
                    {/* Property */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                          {getPropertyIcon(property.type)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900" data-testid={`text-property-title-${property.id}`}>
                            {property.title}
                          </div>
                          <div className="text-sm text-gray-500" data-testid={`text-property-specs-${property.id}`}>
                            {getSpecificationSummary(property)}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Type */}
                    <td className="px-6 py-4">
                      <Badge className={propertyTypeColors[property.type] || 'bg-gray-100 text-gray-800'} data-testid={`badge-property-type-${property.id}`}>
                        {property.type.replace('_', ' ')}
                      </Badge>
                    </td>
                    
                    {/* Status */}
                    <td className="px-6 py-4">
                      <Badge className={statusColors[property.status] || 'bg-gray-100 text-gray-800'} data-testid={`badge-property-status-${property.id}`}>
                        {property.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    
                    {/* Price */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900" data-testid={`text-property-price-${property.id}`}>
                          {formatPrice(property.listingPrice)}
                        </span>
                      </div>
                    </td>
                    
                    {/* Location */}
                    <td className="px-6 py-4">
                      {property.address ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900" data-testid={`text-property-location-${property.id}`}>
                            {property.address}
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
                          onClick={(e) => handleEdit(property, e)}
                          className="h-8 w-8 p-0 hover:bg-gray-200"
                          data-testid={`button-edit-property-${property.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(property.id, e)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          data-testid={`button-delete-property-${property.id}`}
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
        
        {/* TODO: Add PropertyFormModal component
        <PropertyFormModal
          isOpen={isPropertyFormOpen}
          onClose={() => {
            setIsPropertyFormOpen(false);
            setEditingProperty(null);
          }}
          property={editingProperty}
        />
        */}

        <PropertyDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedProperty(null);
          }}
          property={selectedProperty}
        />
      </main>
    </div>
  );
}