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
  const [, params] = useRoute("/analysis/rate-comps/:id");
  const compId = propCompId || params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const { data: comp, isLoading } = useQuery<any>({
    queryKey: ['/api/rate-comps', compId],
    enabled: !!compId,
  });

  useEffect(() => {
    if (comp) setFormData(comp);
  }, [comp]);

  const canEdit = true;
  const canDelete = true;

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/rate-comps/${compId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Rate comp changes have been saved." });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rate-comps/${compId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Rate comp has been removed." });
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps'] });
      if (onClose) onClose();
      else window.history.back();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete comp.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData(comp);
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

  if (!comp) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Comp not found or API integration pending</p>
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
              <h2 className="text-xl font-semibold text-foreground">Rate Comp Detail</h2>
              <p className="text-sm text-muted-foreground">View and edit rate comparable</p>
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
              <Label>Marina Name</Label>
              <Input value={formData.marinaName || ''} disabled={!isEditing} onChange={e => handleInputChange('marinaName', e.target.value)} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={formData.location || formData.city || ''} disabled={!isEditing} onChange={e => handleInputChange('location', e.target.value)} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={formData.state || ''} disabled={!isEditing} onChange={e => handleInputChange('state', e.target.value)} />
            </div>
            <div>
              <Label>Total Slips</Label>
              <Input type="number" value={formData.totalSlips || ''} disabled={!isEditing} onChange={e => handleInputChange('totalSlips', e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Avg Rate per Foot</Label>
              <Input type="number" value={formData.avgRatePerFoot || ''} disabled={!isEditing} onChange={e => handleInputChange('avgRatePerFoot', e.target.value)} />
            </div>
            <div>
              <Label>Occupancy (%)</Label>
              <Input type="number" value={formData.occupancy || ''} disabled={!isEditing} onChange={e => handleInputChange('occupancy', e.target.value)} />
            </div>
            <div>
              <Label>Storage Type</Label>
              <Input value={formData.storageType || formData.ioBoth || ''} disabled={!isEditing} onChange={e => handleInputChange('storageType', e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes || ''} disabled={!isEditing} onChange={e => handleInputChange('notes', e.target.value)} rows={3} />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
