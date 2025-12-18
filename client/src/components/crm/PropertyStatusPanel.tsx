import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Building,
  Calendar,
  Check,
  DollarSign,
  Loader2,
  MapPin,
  Store,
  TrendingUp,
  User,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatUtils';
import { format } from 'date-fns';

export type PipelineStage = 'lead' | 'opportunity' | 'under_contract' | 'closed';

interface PropertyStatus {
  isSelling?: boolean;
  isOnMarket?: boolean;
  pipelineStage?: PipelineStage | null;
  listingDate?: string | null;
  listingPrice?: string | null;
  broker?: string | null;
}

interface Property extends PropertyStatus {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface PropertyStatusPanelProps {
  property: Property;
  onUpdate?: () => void;
  compact?: boolean;
}

const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string }[] = [
  { value: 'lead', label: 'Lead', color: 'bg-gray-500' },
  { value: 'opportunity', label: 'Opportunity', color: 'bg-blue-500' },
  { value: 'under_contract', label: 'Under Contract', color: 'bg-amber-500' },
  { value: 'closed', label: 'Closed', color: 'bg-green-500' },
];

export function PropertyStatusPanel({ 
  property, 
  onUpdate,
  compact = false 
}: PropertyStatusPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeData, setCloseData] = useState({
    salePrice: '',
    saleDate: new Date().toISOString().split('T')[0],
    createComp: true,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: PropertyStatus) => {
      const response = await apiRequest('PATCH', `/api/crm/properties/${property.id}/status`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties', property.id] });
      onUpdate?.();
      toast({ title: 'Status Updated', description: 'Property status has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const closeSaleMutation = useMutation({
    mutationFn: async (data: { salePrice: string; saleDate: string; createComp: boolean }) => {
      const response = await apiRequest('POST', `/api/crm/properties/${property.id}/close-sale`, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties', property.id] });
      const compCreated = data.salesComp != null;
      if (compCreated) {
        queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
      }
      onUpdate?.();
      setShowCloseDialog(false);
      toast({ 
        title: 'Sale Closed', 
        description: compCreated 
          ? 'Property closed and sales comp created.' 
          : 'Property has been marked as closed.' 
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleToggle = (field: 'isSelling' | 'isOnMarket', value: boolean) => {
    updateStatusMutation.mutate({ [field]: value });
  };

  const handleStageChange = (stage: PipelineStage | 'none') => {
    if (stage === 'closed') {
      setShowCloseDialog(true);
    } else {
      updateStatusMutation.mutate({ 
        pipelineStage: stage === 'none' ? null : stage 
      });
    }
  };

  const handleCloseSale = () => {
    if (!closeData.salePrice) return;
    closeSaleMutation.mutate(closeData);
  };

  const currentStage = PIPELINE_STAGES.find(s => s.value === property.pipelineStage);

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">For Sale</Label>
            <Switch
              checked={property.isSelling || false}
              onCheckedChange={(v) => handleToggle('isSelling', v)}
              disabled={updateStatusMutation.isPending}
              data-testid="switch-is-selling-compact"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">On Market</Label>
            <Switch
              checked={property.isOnMarket || false}
              onCheckedChange={(v) => handleToggle('isOnMarket', v)}
              disabled={updateStatusMutation.isPending}
              data-testid="switch-is-on-market-compact"
            />
          </div>
          {currentStage && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${currentStage.color}`} />
              <span className="text-sm">{currentStage.label}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Property Status
          </CardTitle>
          <CardDescription>
            Manage acquisition pipeline stage and listing details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">For Sale</Label>
                  <p className="text-sm text-muted-foreground">
                    Mark this property as being sold
                  </p>
                </div>
                <Switch
                  checked={property.isSelling || false}
                  onCheckedChange={(v) => handleToggle('isSelling', v)}
                  disabled={updateStatusMutation.isPending}
                  data-testid="switch-is-selling"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">On Market</Label>
                  <p className="text-sm text-muted-foreground">
                    Property is actively listed for sale
                  </p>
                </div>
                <Switch
                  checked={property.isOnMarket || false}
                  onCheckedChange={(v) => handleToggle('isOnMarket', v)}
                  disabled={updateStatusMutation.isPending}
                  data-testid="switch-is-on-market"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pipeline Stage</Label>
                <Select 
                  value={property.pipelineStage || 'none'} 
                  onValueChange={handleStageChange}
                >
                  <SelectTrigger data-testid="select-pipeline-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not in Pipeline</SelectItem>
                    {PIPELINE_STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                          {stage.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {currentStage && (
                <Badge className={`${currentStage.color} text-white`}>
                  {currentStage.label}
                </Badge>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Listing Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="listingPrice" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Listing Price
                </Label>
                <Input
                  id="listingPrice"
                  type="number"
                  value={property.listingPrice || ''}
                  onChange={(e) => {
                    updateStatusMutation.mutate({ listingPrice: e.target.value || null });
                  }}
                  placeholder="0"
                  data-testid="input-listing-price"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="listingDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Listing Date
                </Label>
                <Input
                  id="listingDate"
                  type="date"
                  value={property.listingDate || ''}
                  onChange={(e) => {
                    updateStatusMutation.mutate({ listingDate: e.target.value || null });
                  }}
                  data-testid="input-listing-date"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="broker" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Broker
                </Label>
                <Input
                  id="broker"
                  value={property.broker || ''}
                  onChange={(e) => {
                    updateStatusMutation.mutate({ broker: e.target.value || null });
                  }}
                  placeholder="Broker name"
                  data-testid="input-broker"
                />
              </div>
            </div>
          </div>
          
          {property.pipelineStage && property.pipelineStage !== 'closed' && (
            <>
              <Separator />
              <div className="flex justify-end">
                <Button 
                  onClick={() => setShowCloseDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-close-sale"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Close Sale
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Close Sale
            </DialogTitle>
            <DialogDescription>
              Record the final sale details for {property.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="salePrice">Sale Price</Label>
              <Input
                id="salePrice"
                type="number"
                value={closeData.salePrice}
                onChange={(e) => setCloseData({ ...closeData, salePrice: e.target.value })}
                placeholder="Enter final sale price"
                data-testid="input-sale-price"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="saleDate">Sale Date</Label>
              <Input
                id="saleDate"
                type="date"
                value={closeData.saleDate}
                onChange={(e) => setCloseData({ ...closeData, saleDate: e.target.value })}
                data-testid="input-sale-date"
              />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div className="space-y-0.5">
                <Label className="text-base">Create Sales Comp</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically add this sale to your comparables database
                </p>
              </div>
              <Switch
                checked={closeData.createComp}
                onCheckedChange={(v) => setCloseData({ ...closeData, createComp: v })}
                data-testid="switch-create-comp"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCloseSale}
              disabled={!closeData.salePrice || closeSaleMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-close-sale"
            >
              {closeSaleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Close Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PipelineStageBadge({ stage }: { stage: PipelineStage | null | undefined }) {
  if (!stage) return null;
  
  const stageInfo = PIPELINE_STAGES.find(s => s.value === stage);
  if (!stageInfo) return null;
  
  return (
    <Badge className={`${stageInfo.color} text-white`} data-testid={`badge-stage-${stage}`}>
      {stageInfo.label}
    </Badge>
  );
}
