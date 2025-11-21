import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Plus, Trash2, Bell, BellOff, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface Watchlist {
  id: string;
  name: string;
  description?: string | null;
  criteria?: {
    entities?: string[];
    categories?: string[];
    locations?: string[];
  } | null;
  alertFrequency: 'none' | 'immediate' | 'daily' | 'weekly';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Article {
  id: number;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  categories: string[];
}

export default function WatchlistsPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [watchlistName, setWatchlistName] = useState("");
  const [description, setDescription] = useState("");
  const [entities, setEntities] = useState("");
  const [categories, setCategories] = useState("");
  const [locations, setLocations] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertFrequency, setAlertFrequency] = useState("daily");
  const [expandedWatchlist, setExpandedWatchlist] = useState<string | null>(null);

  // Fetch watchlists
  const { data: watchlists = [], isLoading } = useQuery<Watchlist[]>({
    queryKey: ['/api/docktalk/watchlists'],
  });

  // Fetch articles for expanded watchlist
  const { data: watchlistArticles = [] } = useQuery<Article[]>({
    queryKey: ['/api/docktalk/watchlists', expandedWatchlist, 'articles'],
    queryFn: async () => {
      if (!expandedWatchlist) return [];
      const response = await fetch(`/api/docktalk/watchlists/${expandedWatchlist}/articles?limit=20`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    },
    enabled: !!expandedWatchlist,
  });

  // Create watchlist mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      alertFrequency: 'none' | 'immediate' | 'daily' | 'weekly';
      isActive?: boolean;
      criteria?: {
        entities?: string[];
        categories?: string[];
        locations?: string[];
      };
    }) => {
      const response = await fetch('/api/docktalk/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description ?? null,
          criteria: data.criteria ?? null,
          alertFrequency: data.alertFrequency,
          isActive: data.isActive ?? true,
        }),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to create watchlist');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/watchlists'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Watchlist Created",
        description: "Your watchlist has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create watchlist",
        variant: "destructive",
      });
    },
  });

  // Update watchlist mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Watchlist> }) => {
      const response = await fetch(`/api/docktalk/watchlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to update watchlist');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/watchlists'] });
      toast({
        title: "Watchlist Updated",
        description: "Alert settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update watchlist",
        variant: "destructive",
      });
    },
  });

  // Delete watchlist mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/docktalk/watchlists/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete watchlist');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/watchlists'] });
      toast({
        title: "Watchlist Removed",
        description: "Entity has been removed from your watchlist.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete watchlist",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setWatchlistName("");
    setDescription("");
    setEntities("");
    setCategories("");
    setLocations("");
    setEmailAlerts(false);
    setAlertFrequency("daily");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!watchlistName.trim()) {
      toast({
        title: "Validation Error",
        description: "Watchlist name is required",
        variant: "destructive",
      });
      return;
    }

    // Parse comma-separated inputs
    const entitiesArray = entities
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    const categoriesArray = categories
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    const locationsArray = locations
      .split(',')
      .map(l => l.trim())
      .filter(Boolean);

    // Build criteria object with arrays for non-empty inputs
    const criteriaObj: { entities?: string[]; categories?: string[]; locations?: string[] } = {};
    
    if (entitiesArray.length > 0) {
      criteriaObj.entities = entitiesArray;
    }
    if (categoriesArray.length > 0) {
      criteriaObj.categories = categoriesArray;
    }
    if (locationsArray.length > 0) {
      criteriaObj.locations = locationsArray;
    }

    // Only include criteria if at least one field has data
    const hasCriteria = Object.keys(criteriaObj).length > 0;

    createMutation.mutate({
      name: watchlistName.trim(),
      description: description.trim() || undefined,
      alertFrequency: emailAlerts ? (alertFrequency as 'none' | 'immediate' | 'daily' | 'weekly') : 'none',
      isActive: true,
      criteria: hasCriteria ? criteriaObj : undefined,
    });
  };

  const handleDelete = (watchlist: Watchlist) => {
    if (window.confirm(`Are you sure you want to delete the watchlist "${watchlist.name}"?`)) {
      deleteMutation.mutate(watchlist.id);
    }
  };

  const getAlertFrequencyBadge = (frequency: string) => {
    const frequencies: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      none: { label: "No Alerts", variant: "outline" },
      immediate: { label: "Immediate", variant: "default" },
      daily: { label: "Daily", variant: "secondary" },
      weekly: { label: "Weekly", variant: "outline" },
    };
    return frequencies[frequency] || { label: frequency, variant: "outline" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Watchlists</h1>
          <p className="text-muted-foreground mt-1">
            Track specific entities and receive alerts when they appear in marina industry news
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-watchlist">
          <Plus className="h-4 w-4 mr-2" />
          Add to Watchlist
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create Watchlist</DialogTitle>
                <DialogDescription>
                  Define criteria to track and receive alerts when matching content appears in marina industry news
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="watchlistName">Watchlist Name *</Label>
                  <Input
                    id="watchlistName"
                    data-testid="input-watchlist-name"
                    placeholder="e.g., Southeast Marina M&A Activity"
                    value={watchlistName}
                    onChange={(e) => setWatchlistName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-description"
                    placeholder="Optional description of what this watchlist tracks..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Search Criteria</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Add multiple criteria to track specific entities, categories, or locations (comma-separated)
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="entities">Entities</Label>
                    <Input
                      id="entities"
                      data-testid="input-entities"
                      placeholder="e.g., Safe Harbor, Suntex, IGY Marinas"
                      value={entities}
                      onChange={(e) => setEntities(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Companies, people, or organizations (comma-separated)</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="categories">Categories</Label>
                    <Input
                      id="categories"
                      data-testid="input-categories"
                      placeholder="e.g., M&A, Transactions, Financing"
                      value={categories}
                      onChange={(e) => setCategories(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Article categories to track (comma-separated)</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="locations">Locations</Label>
                    <Input
                      id="locations"
                      data-testid="input-locations"
                      placeholder="e.g., Florida, Southeast, Gulf Coast"
                      value={locations}
                      onChange={(e) => setLocations(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Geographic regions to monitor (comma-separated)</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailAlerts">Email Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive notifications when matching articles are published
                      </p>
                    </div>
                    <Switch
                      id="emailAlerts"
                      checked={emailAlerts}
                      onCheckedChange={setEmailAlerts}
                      data-testid="switch-email-alerts"
                    />
                  </div>

                  {emailAlerts && (
                    <div className="grid gap-2">
                      <Label htmlFor="alertFrequency">Alert Frequency</Label>
                      <select
                        id="alertFrequency"
                        value={alertFrequency}
                        onChange={(e) => setAlertFrequency(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-testid="select-alert-frequency"
                      >
                        <option value="daily">Daily Digest</option>
                        <option value="weekly">Weekly Summary</option>
                        <option value="immediate">Immediate</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-add"
                >
                  {createMutation.isPending ? "Creating..." : "Create Watchlist"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : watchlists.length === 0 ? (
        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex justify-center mb-4">
              <Eye className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <CardTitle className="text-2xl">No Watchlists Yet</CardTitle>
            <CardDescription className="text-base mt-2">
              Start tracking companies, people, or locations to stay informed when they appear in industry news
            </CardDescription>
            <div className="mt-6">
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-watchlist">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Watchlist
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {watchlists.map((watchlist) => {
            const frequencyBadge = getAlertFrequencyBadge(watchlist.alertFrequency);
            return (
              <Card key={watchlist.id} data-testid={`card-watchlist-${watchlist.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        {watchlist.name}
                      </CardTitle>
                      {watchlist.description && (
                        <p className="text-sm text-muted-foreground mt-1">{watchlist.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={frequencyBadge.variant} data-testid={`badge-frequency-${watchlist.id}`}>
                          <Bell className="h-3 w-3 mr-1" />
                          {frequencyBadge.label}
                        </Badge>
                        {watchlist.isActive ? (
                          <Badge variant="outline">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2" data-testid={`alert-toggle-${watchlist.id}`}>
                        <Label htmlFor={`alert-${watchlist.id}`} className="text-sm cursor-pointer">
                          {watchlist.alertFrequency !== 'none' ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                        </Label>
                        <Switch
                          id={`alert-${watchlist.id}`}
                          checked={watchlist.alertFrequency !== 'none'}
                          onCheckedChange={(checked) => {
                            updateMutation.mutate({
                              id: watchlist.id,
                              data: { alertFrequency: checked ? 'daily' : 'none' },
                            });
                          }}
                          disabled={updateMutation.isPending}
                          data-testid={`switch-alert-${watchlist.id}`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(watchlist)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${watchlist.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Display saved criteria */}
                  {watchlist.criteria && (watchlist.criteria.entities || watchlist.criteria.categories || watchlist.criteria.locations) && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Tracking Criteria:</h4>
                      <div className="space-y-1 text-sm">
                        {watchlist.criteria.entities && watchlist.criteria.entities.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground font-medium">Entities:</span>
                            <span className="text-foreground">{watchlist.criteria.entities.join(', ')}</span>
                          </div>
                        )}
                        {watchlist.criteria.categories && watchlist.criteria.categories.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground font-medium">Categories:</span>
                            <span className="text-foreground">{watchlist.criteria.categories.join(', ')}</span>
                          </div>
                        )}
                        {watchlist.criteria.locations && watchlist.criteria.locations.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground font-medium">Locations:</span>
                            <span className="text-foreground">{watchlist.criteria.locations.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedWatchlist(expandedWatchlist === watchlist.id ? null : watchlist.id)}
                      className="w-full justify-start text-sm font-medium text-muted-foreground hover:text-foreground"
                      data-testid={`button-toggle-articles-${watchlist.id}`}
                    >
                      {expandedWatchlist === watchlist.id ? (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2" />
                      )}
                      <FileText className="h-4 w-4 mr-2" />
                      Mentions ({expandedWatchlist === watchlist.id ? watchlistArticles.length : '...'})
                    </Button>

                    {expandedWatchlist === watchlist.id && (
                      <div className="mt-3 space-y-2" data-testid={`articles-list-${watchlist.id}`}>
                        {watchlistArticles.length === 0 ? (
                          <p className="text-sm text-muted-foreground px-4 py-2">
                            No articles mentioning this entity yet
                          </p>
                        ) : (
                          watchlistArticles.map((article) => (
                            <a
                              key={article.id}
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 rounded-md border hover:bg-muted/50 transition-colors"
                              data-testid={`article-${article.id}`}
                            >
                              <h4 className="text-sm font-medium text-foreground line-clamp-2">
                                {article.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{article.source}</span>
                                <span>•</span>
                                <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                                {article.categories.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{article.categories[0]}</span>
                                  </>
                                )}
                              </div>
                            </a>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
