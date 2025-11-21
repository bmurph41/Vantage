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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Plus, Trash2, Bell, BellOff, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface Watchlist {
  id: string;
  entityType: string;
  entityName: string;
  emailAlerts: boolean;
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
  const [entityType, setEntityType] = useState("company");
  const [entityName, setEntityName] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(false);
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
      entityType: string;
      entityName: string;
      emailAlerts?: boolean;
    }) => {
      const response = await fetch('/api/docktalk/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
        description: "Entity has been added to your watchlist.",
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
    setEntityType("company");
    setEntityName("");
    setEmailAlerts(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!entityName.trim()) {
      toast({
        title: "Validation Error",
        description: "Entity name is required",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      entityType,
      entityName: entityName.trim(),
      emailAlerts,
    });
  };

  const handleDelete = (watchlist: Watchlist) => {
    if (window.confirm(`Are you sure you want to remove "${watchlist.entityName}" from your watchlist?`)) {
      deleteMutation.mutate(watchlist.id);
    }
  };

  const getEntityTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      company: { label: "Company", variant: "default" },
      person: { label: "Person", variant: "secondary" },
      location: { label: "Location", variant: "outline" },
    };
    return types[type] || { label: type, variant: "outline" };
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
          <DialogContent className="max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Entity to Watchlist</DialogTitle>
                <DialogDescription>
                  Track companies, people, or locations mentioned in marina industry news
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="entityType">Entity Type *</Label>
                  <select
                    id="entityType"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="select-entity-type"
                  >
                    <option value="company">Company</option>
                    <option value="person">Person</option>
                    <option value="location">Location</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="entityName">Entity Name *</Label>
                  <Input
                    id="entityName"
                    data-testid="input-entity-name"
                    placeholder="e.g., Safe Harbor Marinas"
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    required
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailAlerts">Email Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive notifications when this entity is mentioned
                      </p>
                    </div>
                    <Switch
                      id="emailAlerts"
                      checked={emailAlerts}
                      onCheckedChange={setEmailAlerts}
                      data-testid="switch-email-alerts"
                    />
                  </div>
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
                  {createMutation.isPending ? "Adding..." : "Add to Watchlist"}
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
            const typeBadge = getEntityTypeBadge(watchlist.entityType);
            return (
              <Card key={watchlist.id} data-testid={`card-watchlist-${watchlist.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        {watchlist.entityName}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={typeBadge.variant} data-testid={`badge-type-${watchlist.id}`}>
                          {typeBadge.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2" data-testid={`alert-toggle-${watchlist.id}`}>
                        <Label htmlFor={`alert-${watchlist.id}`} className="text-sm cursor-pointer">
                          {watchlist.emailAlerts ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                        </Label>
                        <Switch
                          id={`alert-${watchlist.id}`}
                          checked={watchlist.emailAlerts}
                          onCheckedChange={(checked) => {
                            updateMutation.mutate({
                              id: watchlist.id,
                              data: { emailAlerts: checked },
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
