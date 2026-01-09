import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Users, Edit, Trash2, RefreshCw, Phone, Mail, Building2, DollarSign, MessageSquare, Activity, Ship, Link2, Copy, Check, ExternalLink, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

type BrokerRelationship = {
  id: string;
  orgId: string;
  contactName: string;
  company?: string;
  companyName?: string;
  primaryContactName?: string;
  email?: string;
  phone?: string;
  tier: "platinum" | "gold" | "silver" | "bronze";
  specialty?: string;
  regions?: string[];
  lastContactDate?: string;
  nextFollowUp?: string;
  totalDealsSubmitted: number;
  totalDealsConverted: number;
  totalDealValue?: string;
  avgDealQuality?: string;
  notes?: string;
  isActive: boolean;
  shareToken?: string | null;
  portalEnabled?: boolean;
  portalLastAccessedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type BrokerActivity = {
  id: string;
  activityType: string;
  activityDate: string;
  subject?: string;
  description?: string;
};

const tierConfig: Record<string, { label: string; color: string }> = {
  platinum: { label: "Platinum", color: "bg-slate-700" },
  gold: { label: "Gold", color: "bg-yellow-500" },
  silver: { label: "Silver", color: "bg-gray-400" },
  bronze: { label: "Bronze", color: "bg-orange-700" },
};

export function BrokersTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerRelationship | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<BrokerRelationship | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [submitDealDialogOpen, setSubmitDealDialogOpen] = useState(false);
  const [sharePortalDialogOpen, setSharePortalDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: brokers, isLoading } = useQuery<BrokerRelationship[]>({
    queryKey: ["/api/marinamatch/broker-relationships"],
  });

  const { data: activities } = useQuery<BrokerActivity[]>({
    queryKey: ["/api/marinamatch/broker-relationships", selectedBroker?.id, "activity"],
    enabled: !!selectedBroker,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<BrokerRelationship>) => {
      return apiRequest("POST", "/api/marinamatch/broker-relationships", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/broker-relationships"] });
      setCreateDialogOpen(false);
      toast({ title: "Success", description: "Broker added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BrokerRelationship> }) => {
      return apiRequest("PATCH", `/api/marinamatch/broker-relationships/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/broker-relationships"] });
      setEditingBroker(null);
      toast({ title: "Success", description: "Broker updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/marinamatch/broker-relationships/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/broker-relationships"] });
      toast({ title: "Success", description: "Broker removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const logActivityMutation = useMutation({
    mutationFn: async ({ brokerId, data }: { brokerId: string; data: any }) => {
      return apiRequest("POST", `/api/marinamatch/broker-relationships/${brokerId}/activity`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/broker-relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/broker-relationships", selectedBroker?.id, "activity"] });
      setActivityDialogOpen(false);
      toast({ title: "Success", description: "Activity logged" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitDealMutation = useMutation({
    mutationFn: async ({ brokerId, data }: { brokerId: string; data: any }) => {
      return apiRequest("POST", `/api/marinamatch/broker-relationships/${brokerId}/submit-deal`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/broker-relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/sourced-deals"] });
      setSubmitDealDialogOpen(false);
      toast({ 
        title: "Deal Submitted", 
        description: "The marina deal has been added to your pipeline" 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async (brokerId: string) => {
      const response = await apiRequest("POST", `/api/marinamatch/broker-relationships/${brokerId}/generate-token`);
      return response;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/broker-relationships"] });
      if (selectedBroker) {
        setSelectedBroker(prev => prev ? { 
          ...prev, 
          shareToken: (data as any).shareToken, 
          portalEnabled: true 
        } : null);
      }
      toast({ 
        title: "Portal Link Generated", 
        description: "Broker can now submit deals via their portal link" 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const disablePortalMutation = useMutation({
    mutationFn: async (brokerId: string) => {
      return apiRequest("POST", `/api/marinamatch/broker-relationships/${brokerId}/disable-portal`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/broker-relationships"] });
      if (selectedBroker) {
        setSelectedBroker(prev => prev ? { 
          ...prev, 
          shareToken: null, 
          portalEnabled: false 
        } : null);
      }
      setSharePortalDialogOpen(false);
      toast({ 
        title: "Portal Disabled", 
        description: "The broker portal link has been deactivated" 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatCurrencyValue = (value: string | undefined) => {
    if (!value) return "$0";
    return formatCurrency(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Broker Network</h2>
          <p className="text-sm text-muted-foreground">
            Manage broker relationships and track deal attribution
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-broker">
              <Plus className="h-4 w-4 mr-2" />
              Add Broker
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Broker</DialogTitle>
              <DialogDescription>
                Add a new broker to your network
              </DialogDescription>
            </DialogHeader>
            <BrokerForm
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : brokers?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brokers.map((broker) => {
            const tier = tierConfig[broker.tier] || tierConfig.bronze;

            return (
              <Card 
                key={broker.id} 
                className={`hover:shadow-md transition-shadow cursor-pointer ${!broker.isActive ? "opacity-60" : ""}`}
                onClick={() => setSelectedBroker(broker)}
                data-testid={`broker-card-${broker.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base" data-testid={`broker-name-${broker.id}`}>
                        {broker.contactName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        {broker.company && (
                          <>
                            <Building2 className="h-3 w-3" />
                            {broker.company}
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <Badge className={`${tier.color} text-white`}>
                      {tier.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Deals Submitted</span>
                      <p className="font-medium">{broker.totalDealsSubmitted}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Converted</span>
                      <p className="font-medium">{broker.totalDealsConverted}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-sm">Total Value</span>
                    <p className="font-semibold">{formatCurrencyValue(broker.totalDealValue)}</p>
                  </div>
                  {broker.specialty && (
                    <Badge variant="outline" className="text-xs">
                      {broker.specialty}
                    </Badge>
                  )}
                  {broker.lastContactDate && (
                    <p className="text-xs text-muted-foreground">
                      Last contact: {format(new Date(broker.lastContactDate), "MMM d, yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Brokers in Network</h3>
            <p className="text-muted-foreground mb-4">
              Add brokers to track relationships and deal attribution
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Broker
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Broker Detail Dialog */}
      <Dialog open={!!selectedBroker && !editingBroker} onOpenChange={(open) => !open && setSelectedBroker(null)}>
        <DialogContent className="max-w-lg">
          {selectedBroker && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tierConfig[selectedBroker.tier]?.color || "bg-gray-500"}`}>
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle>{selectedBroker.contactName}</DialogTitle>
                    <DialogDescription>{selectedBroker.company}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex gap-4">
                  {selectedBroker.email && (
                    <a 
                      href={`mailto:${selectedBroker.email}`}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {selectedBroker.email}
                    </a>
                  )}
                  {selectedBroker.phone && (
                    <a 
                      href={`tel:${selectedBroker.phone}`}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {selectedBroker.phone}
                    </a>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{selectedBroker.totalDealsSubmitted}</p>
                    <p className="text-xs text-muted-foreground">Deals Submitted</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{selectedBroker.totalDealsConverted}</p>
                    <p className="text-xs text-muted-foreground">Converted</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatCurrencyValue(selectedBroker.totalDealValue)}</p>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                  </div>
                </div>

                {selectedBroker.notes && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground">Notes</Label>
                      <p className="text-sm mt-1">{selectedBroker.notes}</p>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Recent Activity</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivityDialogOpen(true)}
                      data-testid="btn-log-activity"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Log Activity
                    </Button>
                  </div>
                  {activities?.length ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {activities.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex items-start gap-2 text-sm">
                          <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">{activity.subject || activity.activityType}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(activity.activityDate), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No activity logged yet</p>
                  )}
                </div>
              </div>

              <Separator />
              
              <div className="flex flex-wrap gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setSubmitDealDialogOpen(true)}
                        data-testid="btn-submit-deal"
                      >
                        <Ship className="h-4 w-4 mr-2" />
                        Submit Deal
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Submit a marina deal from this broker</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => setSharePortalDialogOpen(true)}
                        data-testid="btn-share-portal"
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        {selectedBroker.portalEnabled ? "Manage Portal" : "Share Portal"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Generate a shareable link for broker to submit deals</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedBroker(null);
                    setEditingBroker(selectedBroker);
                  }}
                  data-testid="btn-edit-broker"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    deleteMutation.mutate(selectedBroker.id);
                    setSelectedBroker(null);
                  }}
                  data-testid="btn-delete-broker"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Broker Dialog */}
      <Dialog open={!!editingBroker} onOpenChange={(open) => !open && setEditingBroker(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Broker</DialogTitle>
            <DialogDescription>
              Update broker information
            </DialogDescription>
          </DialogHeader>
          {editingBroker && (
            <BrokerForm
              initialData={editingBroker}
              onSubmit={(data) => updateMutation.mutate({ id: editingBroker.id, data })}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Log Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>
              Record an interaction with {selectedBroker?.contactName}
            </DialogDescription>
          </DialogHeader>
          <ActivityForm
            onSubmit={(data) => {
              if (selectedBroker) {
                logActivityMutation.mutate({ brokerId: selectedBroker.id, data });
              }
            }}
            isLoading={logActivityMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Submit Deal Dialog */}
      <Dialog open={submitDealDialogOpen} onOpenChange={setSubmitDealDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Submit Deal from {selectedBroker?.contactName || selectedBroker?.primaryContactName}
              </div>
            </DialogTitle>
            <DialogDescription>
              Add a marina deal submitted by this broker to your pipeline
            </DialogDescription>
          </DialogHeader>
          {selectedBroker && (
            <SubmitDealForm
              onSubmit={(data) => submitDealMutation.mutate({ brokerId: selectedBroker.id, data })}
              isLoading={submitDealMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Share Portal Dialog */}
      <Dialog open={sharePortalDialogOpen} onOpenChange={setSharePortalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Broker Portal
              </div>
            </DialogTitle>
            <DialogDescription>
              Share a portal link with {selectedBroker?.contactName || selectedBroker?.primaryContactName} to let them submit deals directly
            </DialogDescription>
          </DialogHeader>
          {selectedBroker && (
            <SharePortalContent
              broker={selectedBroker}
              onGenerateToken={() => generateTokenMutation.mutate(selectedBroker.id)}
              onDisablePortal={() => disablePortalMutation.mutate(selectedBroker.id)}
              isGenerating={generateTokenMutation.isPending}
              isDisabling={disablePortalMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrokerForm({
  initialData,
  onSubmit,
  isLoading,
}: {
  initialData?: Partial<BrokerRelationship>;
  onSubmit: (data: Partial<BrokerRelationship>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    contactName: initialData?.contactName || "",
    company: initialData?.company || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    tier: initialData?.tier || "bronze",
    specialty: initialData?.specialty || "",
    notes: initialData?.notes || "",
    isActive: initialData?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name *</Label>
          <Input
            id="contactName"
            value={formData.contactName}
            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            placeholder="John Smith"
            required
            data-testid="input-broker-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            placeholder="Marina Brokers Inc."
            data-testid="input-broker-company"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@example.com"
            data-testid="input-broker-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
            data-testid="input-broker-phone"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tier">Relationship Tier</Label>
          <Select
            value={formData.tier}
            onValueChange={(value: any) => setFormData({ ...formData, tier: value })}
          >
            <SelectTrigger data-testid="select-broker-tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="platinum">Platinum</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="specialty">Specialty</Label>
          <Input
            id="specialty"
            value={formData.specialty}
            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            placeholder="Southeast Marinas"
            data-testid="input-broker-specialty"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Notes about this broker relationship..."
          rows={3}
          data-testid="textarea-broker-notes"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          data-testid="switch-broker-active"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="btn-save-broker">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Broker"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ActivityForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    activityType: "call",
    subject: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="activityType">Activity Type</Label>
        <Select
          value={formData.activityType}
          onValueChange={(value) => setFormData({ ...formData, activityType: value })}
        >
          <SelectTrigger data-testid="select-activity-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="call">Phone Call</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="deal_submitted">Deal Submitted</SelectItem>
            <SelectItem value="deal_reviewed">Deal Reviewed</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Brief summary..."
          data-testid="input-activity-subject"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Details about the interaction..."
          rows={3}
          data-testid="textarea-activity-description"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="btn-log-activity-submit">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Logging...
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 mr-2" />
              Log Activity
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

function SubmitDealForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    propertyName: "",
    propertyAddress: "",
    city: "",
    state: "",
    askingPrice: "",
    totalSlips: "",
    grossRevenue: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      askingPrice: formData.askingPrice || undefined,
      totalSlips: formData.totalSlips ? parseInt(formData.totalSlips) : undefined,
      grossRevenue: formData.grossRevenue || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="propertyName">Property Name *</Label>
        <Input
          id="propertyName"
          value={formData.propertyName}
          onChange={(e) => setFormData({ ...formData, propertyName: e.target.value })}
          placeholder="Sunset Marina"
          required
          data-testid="input-deal-property-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="propertyAddress">Address</Label>
        <Input
          id="propertyAddress"
          value={formData.propertyAddress}
          onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
          placeholder="123 Harbor Drive"
          data-testid="input-deal-address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="Miami"
            data-testid="input-deal-city"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Select
            value={formData.state}
            onValueChange={(value) => setFormData({ ...formData, state: value })}
          >
            <SelectTrigger data-testid="select-deal-state">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="askingPrice">Asking Price ($)</Label>
          <Input
            id="askingPrice"
            value={formData.askingPrice}
            onChange={(e) => setFormData({ ...formData, askingPrice: e.target.value })}
            placeholder="2,500,000"
            data-testid="input-deal-price"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalSlips">Total Slips</Label>
          <Input
            id="totalSlips"
            type="number"
            value={formData.totalSlips}
            onChange={(e) => setFormData({ ...formData, totalSlips: e.target.value })}
            placeholder="150"
            data-testid="input-deal-slips"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="grossRevenue">Annual Gross Revenue ($)</Label>
        <Input
          id="grossRevenue"
          value={formData.grossRevenue}
          onChange={(e) => setFormData({ ...formData, grossRevenue: e.target.value })}
          placeholder="500,000"
          data-testid="input-deal-revenue"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Notes / Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Additional details about the marina..."
          rows={3}
          data-testid="textarea-deal-description"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="btn-submit-deal-confirm">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Deal
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SharePortalContent({
  broker,
  onGenerateToken,
  onDisablePortal,
  isGenerating,
  isDisabling,
}: {
  broker: BrokerRelationship;
  onGenerateToken: () => void;
  onDisablePortal: () => void;
  isGenerating: boolean;
  isDisabling: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const portalUrl = broker.shareToken 
    ? `${window.location.origin}/broker-portal/${broker.shareToken}`
    : null;

  const copyToClipboard = async () => {
    if (portalUrl) {
      try {
        await navigator.clipboard.writeText(portalUrl);
        setCopied(true);
        toast({ title: "Copied!", description: "Portal link copied to clipboard" });
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
      }
    }
  };

  if (!broker.portalEnabled || !broker.shareToken) {
    return (
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <Link2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-2">Enable Broker Portal</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate a unique link that allows {broker.contactName || broker.primaryContactName} to submit marina deals directly to your pipeline.
          </p>
          <Button onClick={onGenerateToken} disabled={isGenerating} data-testid="btn-generate-portal-link">
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Generate Portal Link
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Check className="h-4 w-4 text-green-600" />
          <span className="font-medium text-green-700 dark:text-green-400">Portal Active</span>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {broker.contactName || broker.primaryContactName} can submit deals using this link
        </p>
        
        <div className="flex gap-2">
          <Input 
            value={portalUrl || ""} 
            readOnly 
            className="text-xs font-mono"
            data-testid="input-portal-url"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={copyToClipboard}
                  data-testid="btn-copy-portal-link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy link</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {broker.portalLastAccessedAt && (
          <p className="text-xs text-muted-foreground mt-2">
            Last accessed: {format(new Date(broker.portalLastAccessedAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        )}
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={onGenerateToken} 
          disabled={isGenerating}
          className="flex-1"
          data-testid="btn-rotate-portal-link"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Rotating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rotate Link
            </>
          )}
        </Button>
        <Button 
          variant="destructive" 
          onClick={onDisablePortal} 
          disabled={isDisabling}
          className="flex-1"
          data-testid="btn-disable-portal"
        >
          {isDisabling ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Disabling...
            </>
          ) : (
            "Disable Portal"
          )}
        </Button>
      </div>
    </div>
  );
}
