import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, Building2, MapPin, DollarSign, Calendar, Anchor, Ship, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DetailProps {
  compId?: string;
  onClose?: () => void;
  isModal?: boolean;
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }
];

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
];

export default function Detail({ compId: propCompId, onClose, isModal = false }: DetailProps) {
  const [, params] = useRoute("/analysis/sales-comps/:id");
  const [, navigate] = useLocation();
  const compId = propCompId || params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const { data: comp, isLoading, error } = useQuery({
    queryKey: ['/api/sales-comps', compId],
    enabled: !!compId,
  });

  useEffect(() => {
    if (comp) {
      setFormData({ ...comp });
    }
  }, [comp]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/sales-comps/${compId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps', compId] });
      toast({ title: "Success", description: "Sales comp updated successfully" });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update sales comp", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/sales-comps/${compId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
      toast({ title: "Success", description: "Sales comp deleted successfully" });
      navigate('/analysis/sales-comps');
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete sales comp", variant: "destructive" });
    },
  });

  const canEdit = true;
  const canDelete = true;

  const handleSave = () => {
    const updateData = {
      marina: formData.marina,
      city: formData.city,
      state: formData.state,
      address: formData.address,
      salePrice: formData.salePrice ? String(formData.salePrice) : null,
      saleMonth: formData.saleMonth ? Number(formData.saleMonth) : null,
      saleYear: formData.saleYear ? Number(formData.saleYear) : null,
      capRate: formData.capRate ? String(formData.capRate) : null,
      wetSlips: formData.wetSlips ? Number(formData.wetSlips) : null,
      dryRacks: formData.dryRacks ? Number(formData.dryRacks) : null,
      notes: formData.notes || null,
      noi: formData.noi ? String(formData.noi) : null,
      buyer: formData.buyer || null,
      seller: formData.seller || null,
      broker: formData.broker || null,
      listingPrice: formData.listingPrice ? String(formData.listingPrice) : null,
    };
    updateMutation.mutate(updateData);
  };

  const handleCancel = () => {
    setFormData({ ...comp });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this comp? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const Container = isModal ? 'div' : Card;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading comp details...</p>
        </div>
      </div>
    );
  }

  if (error || (!isLoading && !comp)) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Sales comp not found</p>
          <Button variant="outline" onClick={() => window.history.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const renderField = (label: string, field: string, options?: { 
    type?: 'text' | 'number' | 'currency' | 'percent' | 'select' | 'textarea';
    selectOptions?: { value: string; label: string }[];
    placeholder?: string;
    prefix?: string;
    suffix?: string;
    displayFormatter?: (value: any) => string;
  }) => {
    const value = formData[field];
    const { type = 'text', selectOptions, placeholder, prefix, suffix, displayFormatter } = options || {};
    
    if (!isEditing) {
      let displayValue = value;
      if (displayFormatter) {
        displayValue = displayFormatter(value);
      } else if (type === 'currency' && value) {
        displayValue = `$${Number(value).toLocaleString()}`;
      } else if (type === 'percent' && value) {
        displayValue = `${Number(value).toFixed(2)}%`;
      } else if (type === 'select' && selectOptions) {
        displayValue = selectOptions.find(o => o.value === String(value))?.label || value;
      }
      
      return (
        <div className="space-y-1">
          <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
          <p className={`text-base ${type === 'currency' ? 'text-green-600 font-semibold' : ''}`}>
            {displayValue || 'N/A'}
          </p>
        </div>
      );
    }

    if (type === 'select' && selectOptions) {
      return (
        <div className="space-y-1">
          <Label className="text-sm font-medium">{label}</Label>
          <Select 
            value={String(value || '')} 
            onValueChange={(v) => handleInputChange(field, v)}
          >
            <SelectTrigger data-testid={`select-${field}`}>
              <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (type === 'textarea') {
      return (
        <div className="space-y-1">
          <Label className="text-sm font-medium">{label}</Label>
          <Textarea
            value={value || ''}
            onChange={(e) => handleInputChange(field, e.target.value)}
            placeholder={placeholder}
            data-testid={`input-${field}`}
            className="min-h-[100px]"
          />
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{prefix}</span>
          )}
          <Input
            type={type === 'number' || type === 'currency' || type === 'percent' ? 'number' : 'text'}
            value={value || ''}
            onChange={(e) => handleInputChange(field, e.target.value)}
            placeholder={placeholder}
            data-testid={`input-${field}`}
            className={prefix ? 'pl-7' : ''}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{suffix}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Container className={isModal ? 'h-full overflow-auto' : 'max-w-5xl mx-auto'}>
      <div className={`${isModal ? 'sticky top-0 bg-background z-10 ' : ''}p-6 border-b border-border`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isModal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.history.back()}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Anchor className="h-5 w-5 text-primary" />
                {comp?.marina || 'Sales Comp Detail'}
              </h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3.5" />
                {comp?.city && comp?.state ? `${comp.city}, ${comp.state}` : 'Location not specified'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {canEdit && !isEditing && (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                data-testid="button-edit"
              >
                Edit
              </Button>
            )}
            {canEdit && isEditing && (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </div>

        {comp?.salePrice && (
          <div className="flex items-center gap-3 mt-4">
            <Badge variant="default" className="text-sm px-3 py-1">
              ${Number(comp.salePrice).toLocaleString()}
            </Badge>
            {comp.saleMonth && comp.saleYear && (
              <Badge variant="secondary" className="text-sm">
                Sold: {MONTHS.find(m => m.value === String(comp.saleMonth))?.label} {comp.saleYear}
              </Badge>
            )}
            {comp.capRate && (
              <Badge variant="outline" className="text-sm">
                {Number(comp.capRate).toFixed(2)}% Cap
              </Badge>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="details" className="flex-1">
        <div className="px-6 py-2 border-b">
          <TabsList>
            <TabsTrigger value="details" data-testid="tab-details">
              <Building2 className="h-4 w-4 mr-1.5" />
              Property Details
            </TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials">
              <DollarSign className="h-4 w-4 mr-1.5" />
              Financials
            </TabsTrigger>
            <TabsTrigger value="operations" data-testid="tab-operations">
              <Ship className="h-4 w-4 mr-1.5" />
              Operations
            </TabsTrigger>
            <TabsTrigger value="transaction" data-testid="tab-transaction">
              <Info className="h-4 w-4 mr-1.5" />
              Transaction
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Property Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField('Marina Name', 'marina', { placeholder: 'Enter marina name' })}
                {renderField('Address', 'address', { placeholder: 'Street address' })}
                {renderField('City', 'city', { placeholder: 'City' })}
                {renderField('State', 'state', { type: 'select', selectOptions: US_STATES })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Sale Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField('Sale Month', 'saleMonth', { type: 'select', selectOptions: MONTHS })}
                {renderField('Sale Year', 'saleYear', { type: 'number', placeholder: 'YYYY' })}
                {renderField('Sale Price', 'salePrice', { type: 'currency', prefix: '$', placeholder: 'Sale price' })}
                {renderField('Listing Price', 'listingPrice', { type: 'currency', prefix: '$', placeholder: 'Original listing price' })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {renderField('Notes', 'notes', { type: 'textarea', placeholder: 'Additional notes about this property...' })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField('Cap Rate', 'capRate', { type: 'percent', placeholder: 'Cap rate %' })}
                {renderField('NOI', 'noi', { type: 'currency', prefix: '$', placeholder: 'Net Operating Income' })}
                {renderField('Price per Slip', 'pricePerSlip', { 
                  type: 'currency', 
                  displayFormatter: () => {
                    const slips = (Number(comp?.wetSlips) || 0) + (Number(comp?.dryRacks) || 0);
                    if (slips > 0 && comp?.salePrice) {
                      return `$${Math.round(Number(comp.salePrice) / slips).toLocaleString()}`;
                    }
                    return 'N/A';
                  }
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ship className="h-4 w-4" />
                  Storage Capacity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField('Wet Slips', 'wetSlips', { type: 'number', placeholder: 'Number of wet slips' })}
                {renderField('Dry Racks', 'dryRacks', { type: 'number', placeholder: 'Number of dry racks' })}
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Total Units</Label>
                  <p className="text-base font-semibold">
                    {(Number(formData.wetSlips) || 0) + (Number(formData.dryRacks) || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transaction" className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transaction Parties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField('Buyer', 'buyer', { placeholder: 'Buyer name' })}
                {renderField('Seller', 'seller', { placeholder: 'Seller name' })}
                {renderField('Broker', 'broker', { placeholder: 'Broker name' })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Data Source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField('Source', 'source', { placeholder: 'Data source' })}
                {renderField('Source URL', 'sourceUrl', { placeholder: 'https://...' })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
