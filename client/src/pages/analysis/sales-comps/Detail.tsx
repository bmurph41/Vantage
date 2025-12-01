// TODO: Missing SalesComps-specific components and utilities:
// - @/lib/api (salesCompsApi)
// - @/lib/queryKeys
// - @/lib/authUtils
// - @/lib/format (formatCurrency, formatPercent, formatDate)
// - @shared/schema types (SalesComp, UpdateSalesComp)

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft, Save, Trash2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DetailProps {
  compId?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export default function Detail({ compId: propCompId, onClose, isModal = false }: DetailProps) {
  const [, params] = useRoute("/analysis/sales-comps/:id");
  const compId = propCompId || params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const { data: comp, isLoading, error } = useQuery({
    queryKey: ['/api/sales-comps', compId],
    enabled: !!compId,
  });

  // TODO: Get user from MarinaMatch auth context
  const user = { role: 'Admin' };
  const canEdit = true;
  const canDelete = true;

  const handleSave = () => {
    // TODO: Implement save when API is available
    toast({
      title: "TODO",
      description: "Save functionality pending API integration",
      variant: "destructive",
    });
  };

  const handleCancel = () => {
    setFormData(comp);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this comp? This action cannot be undone.')) {
      // TODO: Implement delete when API is available
      toast({
        title: "TODO",
        description: "Delete functionality pending API integration",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const Container = isModal ? 'div' : Card;
  const contentClass = isModal ? '' : 'p-6';

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

  return (
    <Container className={isModal ? 'h-full overflow-auto' : 'max-w-4xl mx-auto'}>
      {/* Header */}
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
              <h2 className="text-xl font-semibold text-foreground">Comp Detail</h2>
              <p className="text-sm text-muted-foreground">View and edit sales comparable</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                data-testid="button-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {canEdit && !isEditing && (
              <Button
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
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={contentClass}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Marina Name</Label>
              <p className="text-lg font-semibold">{comp?.marina || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Location</Label>
              <p className="text-base">{comp?.city && comp?.state ? `${comp.city}, ${comp.state}` : 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Address</Label>
              <p className="text-base">{comp?.address || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Sale Date</Label>
              <p className="text-base">{comp?.saleMonth && comp?.saleYear ? `${comp.saleMonth}/${comp.saleYear}` : 'N/A'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Sale Price</Label>
              <p className="text-lg font-semibold text-green-600">
                {comp?.salePrice ? `$${Number(comp.salePrice).toLocaleString()}` : 'N/A'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Cap Rate</Label>
              <p className="text-base">{comp?.capRate ? `${Number(comp.capRate).toFixed(2)}%` : 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Wet Slips</Label>
              <p className="text-base">{comp?.wetSlips || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Dry Racks</Label>
              <p className="text-base">{comp?.dryRacks || 'N/A'}</p>
            </div>
          </div>
          {comp?.notes && (
            <div className="col-span-2">
              <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
              <p className="text-base whitespace-pre-wrap">{comp.notes}</p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
