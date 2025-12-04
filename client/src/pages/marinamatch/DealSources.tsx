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
import { Plus, Rss, Globe, Building, User, RefreshCw, Trash2, Edit, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { format } from "date-fns";

type DealSource = {
  id: string;
  orgId: string;
  name: string;
  sourceType: "broker_feed" | "marketplace" | "proprietary" | "referral" | "auction" | "direct";
  feedUrl?: string;
  apiEndpoint?: string;
  apiKey?: string;
  isActive: boolean;
  syncFrequency: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  dealsImported: number;
  dealsConverted: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const sourceTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  broker_feed: { label: "Broker Feed", icon: Rss, color: "bg-blue-500" },
  marketplace: { label: "Marketplace", icon: Globe, color: "bg-green-500" },
  proprietary: { label: "Proprietary", icon: Building, color: "bg-purple-500" },
  referral: { label: "Referral Network", icon: User, color: "bg-orange-500" },
  auction: { label: "Auction Site", icon: Building, color: "bg-red-500" },
  direct: { label: "Direct Contact", icon: User, color: "bg-gray-500" },
};

export function DealSourcesTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DealSource | null>(null);
  const { toast } = useToast();

  const { data: sources, isLoading } = useQuery<DealSource[]>({
    queryKey: ["/api/marinamatch/deal-sources"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<DealSource>) => {
      return apiRequest("POST", "/api/marinamatch/deal-sources", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/deal-sources"] });
      setCreateDialogOpen(false);
      toast({ title: "Success", description: "Deal source created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DealSource> }) => {
      return apiRequest("PATCH", `/api/marinamatch/deal-sources/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/deal-sources"] });
      setEditingSource(null);
      toast({ title: "Success", description: "Deal source updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/marinamatch/deal-sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/deal-sources"] });
      toast({ title: "Success", description: "Deal source deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleActive = async (source: DealSource) => {
    updateMutation.mutate({ id: source.id, data: { isActive: !source.isActive } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Deal Sources</h2>
          <p className="text-sm text-muted-foreground">
            Configure broker feeds, marketplace integrations, and proprietary deal sources
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-source">
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Deal Source</DialogTitle>
              <DialogDescription>
                Configure a new deal source for automated deal ingestion
              </DialogDescription>
            </DialogHeader>
            <DealSourceForm
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
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sources?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => {
            const config = sourceTypeConfig[source.sourceType] || sourceTypeConfig.direct;
            const Icon = config.icon;

            return (
              <Card key={source.id} className={!source.isActive ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base" data-testid={`source-name-${source.id}`}>
                          {source.name}
                        </CardTitle>
                        <CardDescription>{config.label}</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={source.isActive}
                      onCheckedChange={() => toggleActive(source)}
                      data-testid={`switch-source-${source.id}`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deals Imported</span>
                    <span className="font-medium">{source.dealsImported}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deals Converted</span>
                    <span className="font-medium">{source.dealsConverted}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Sync</span>
                    <span className="font-medium">
                      {source.lastSyncAt
                        ? format(new Date(source.lastSyncAt), "MMM d, HH:mm")
                        : "Never"}
                    </span>
                  </div>
                  {source.lastSyncStatus && (
                    <Badge 
                      variant={source.lastSyncStatus === "success" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {source.lastSyncStatus}
                    </Badge>
                  )}
                  {source.feedUrl && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{source.feedUrl}</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSource(source)}
                      data-testid={`btn-edit-source-${source.id}`}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(source.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`btn-delete-source-${source.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Rss className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Deal Sources Configured</h3>
            <p className="text-muted-foreground mb-4">
              Add broker feeds, marketplace integrations, or proprietary sources to start receiving deals
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Source
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingSource} onOpenChange={(open) => !open && setEditingSource(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Deal Source</DialogTitle>
            <DialogDescription>
              Update the configuration for this deal source
            </DialogDescription>
          </DialogHeader>
          {editingSource && (
            <DealSourceForm
              initialData={editingSource}
              onSubmit={(data) => updateMutation.mutate({ id: editingSource.id, data })}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealSourceForm({
  initialData,
  onSubmit,
  isLoading,
}: {
  initialData?: Partial<DealSource>;
  onSubmit: (data: Partial<DealSource>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    sourceType: initialData?.sourceType || "broker_feed",
    feedUrl: initialData?.feedUrl || "",
    apiEndpoint: initialData?.apiEndpoint || "",
    syncFrequency: initialData?.syncFrequency || "daily",
    notes: initialData?.notes || "",
    isActive: initialData?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Source Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., CoStar Marina Listings"
          required
          data-testid="input-source-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceType">Source Type</Label>
        <Select
          value={formData.sourceType}
          onValueChange={(value) => setFormData({ ...formData, sourceType: value as any })}
        >
          <SelectTrigger data-testid="select-source-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="broker_feed">Broker Feed</SelectItem>
            <SelectItem value="marketplace">Marketplace</SelectItem>
            <SelectItem value="proprietary">Proprietary</SelectItem>
            <SelectItem value="referral">Referral Network</SelectItem>
            <SelectItem value="auction">Auction Site</SelectItem>
            <SelectItem value="direct">Direct Contact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(formData.sourceType === "broker_feed" || formData.sourceType === "marketplace") && (
        <div className="space-y-2">
          <Label htmlFor="feedUrl">Feed URL</Label>
          <Input
            id="feedUrl"
            type="url"
            value={formData.feedUrl}
            onChange={(e) => setFormData({ ...formData, feedUrl: e.target.value })}
            placeholder="https://example.com/feed"
            data-testid="input-feed-url"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="syncFrequency">Sync Frequency</Label>
        <Select
          value={formData.syncFrequency}
          onValueChange={(value) => setFormData({ ...formData, syncFrequency: value })}
        >
          <SelectTrigger data-testid="select-sync-frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="realtime">Real-time</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="manual">Manual Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes about this source..."
          rows={3}
          data-testid="textarea-notes"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          data-testid="switch-is-active"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="btn-save-source">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Source"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
