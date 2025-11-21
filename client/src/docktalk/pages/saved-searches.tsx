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
import { Search, Plus, Trash2, Bell, BellOff, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { normalizeSavedSearchData } from "../lib/normalization";

interface SavedSearch {
  id: string;
  searchName: string;
  queryText: string;
  categories: string[];
  entities: string[];
  dateFrom: string | null;
  dateTo: string | null;
  emailAlerts: boolean;
  alertFrequency: string | null;
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

export default function SavedSearchesPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [queryText, setQueryText] = useState("");
  const [categories, setCategories] = useState("");
  const [entities, setEntities] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertFrequency, setAlertFrequency] = useState("daily");
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null);

  // Fetch saved searches
  const { data: searches = [], isLoading } = useQuery<SavedSearch[]>({
    queryKey: ['/api/docktalk/saved-searches'],
  });

  // Fetch articles for expanded search
  const { data: searchResults = [] } = useQuery<Article[]>({
    queryKey: ['/api/docktalk/saved-searches', expandedSearch, 'results'],
    queryFn: async () => {
      if (!expandedSearch) return [];
      const response = await fetch(`/api/docktalk/saved-searches/${expandedSearch}/results?limit=20`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch search results');
      return response.json();
    },
    enabled: !!expandedSearch,
  });

  // Create saved search mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      searchName: string;
      queryText: string;
      categories?: string[];
      entities?: string[];
      emailAlerts?: boolean;
      alertFrequency?: string;
    }) => {
      const response = await fetch('/api/docktalk/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to create saved search');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/saved-searches'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Search Saved",
        description: "Your search has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save search",
        variant: "destructive",
      });
    },
  });

  // Update saved search mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SavedSearch> }) => {
      const response = await fetch(`/api/docktalk/saved-searches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to update saved search');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/saved-searches'] });
      toast({
        title: "Search Updated",
        description: "Search alert settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update saved search",
        variant: "destructive",
      });
    },
  });

  // Delete saved search mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/docktalk/saved-searches/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete saved search');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/saved-searches'] });
      toast({
        title: "Search Deleted",
        description: "Saved search has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete saved search",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSearchName("");
    setQueryText("");
    setCategories("");
    setEntities("");
    setEmailAlerts(false);
    setAlertFrequency("daily");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchName.trim() || !queryText.trim()) {
      toast({
        title: "Validation Error",
        description: "Search name and query text are required",
        variant: "destructive",
      });
      return;
    }

    const categoriesArray = categories
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    const entitiesArray = entities
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    const normalizedData = normalizeSavedSearchData({
      searchName: searchName,
      queryText: queryText,
      categories: categoriesArray,
      entities: entitiesArray,
      emailAlerts,
      alertFrequency: emailAlerts ? alertFrequency : null,
    });

    createMutation.mutate(normalizedData);
  };

  const handleDelete = (search: SavedSearch) => {
    if (window.confirm(`Are you sure you want to delete "${search.searchName}"?`)) {
      deleteMutation.mutate(search.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saved Searches</h1>
          <p className="text-muted-foreground mt-1">
            Save search queries and receive automated alerts when matching articles are published
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-search">
          <Plus className="h-4 w-4 mr-2" />
          New Search
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create Saved Search</DialogTitle>
                <DialogDescription>
                  Define search criteria to track marina industry news and M&A activity
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="searchName">Search Name *</Label>
                  <Input
                    id="searchName"
                    data-testid="input-search-name"
                    placeholder="e.g., Southeast Marina Acquisitions"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="queryText">Query Text *</Label>
                  <Textarea
                    id="queryText"
                    data-testid="input-query-text"
                    placeholder="Enter keywords, phrases, or search terms..."
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    rows={3}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Search articles matching these keywords
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="categories">Categories</Label>
                    <Input
                      id="categories"
                      data-testid="input-categories"
                      placeholder="e.g., M&A, Transactions"
                      value={categories}
                      onChange={(e) => setCategories(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="entities">Entities</Label>
                    <Input
                      id="entities"
                      data-testid="input-entities"
                      placeholder="e.g., Safe Harbor, Suntex"
                      value={entities}
                      onChange={(e) => setEntities(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
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
                  {createMutation.isPending ? "Saving..." : "Save Search"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex justify-center mb-4">
              <Search className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <CardTitle className="text-2xl">No Saved Searches Yet</CardTitle>
            <CardDescription className="text-base mt-2">
              Create automated search queries to track marina industry news, M&A deals, and portfolio companies
            </CardDescription>
            <div className="mt-6">
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-search">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Search
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {searches.map((search) => (
            <Card key={search.id} data-testid={`card-search-${search.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      {search.searchName}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {search.queryText}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-2">
                      {search.categories.map((category, idx) => (
                        <Badge key={idx} variant="secondary" data-testid={`badge-category-${search.id}-${idx}`}>
                          {category}
                        </Badge>
                      ))}
                      {search.entities.map((entity, idx) => (
                        <Badge key={idx} variant="outline" data-testid={`badge-entity-${search.id}-${idx}`}>
                          {entity}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2" data-testid={`alert-toggle-${search.id}`}>
                      <Label htmlFor={`alert-${search.id}`} className="text-sm cursor-pointer">
                        {search.emailAlerts ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      </Label>
                      <Switch
                        id={`alert-${search.id}`}
                        checked={search.emailAlerts}
                        onCheckedChange={(checked) => {
                          const normalizedData = normalizeSavedSearchData({
                            emailAlerts: checked,
                            alertFrequency: checked ? (search.alertFrequency || 'daily') : null,
                            categories: search.categories,
                            entities: search.entities,
                          });
                          updateMutation.mutate({
                            id: search.id,
                            data: normalizedData,
                          });
                        }}
                        disabled={updateMutation.isPending}
                        data-testid={`switch-alert-${search.id}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(search)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${search.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {search.emailAlerts && search.alertFrequency && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bell className="h-4 w-4" />
                    <span>Alert frequency: {search.alertFrequency}</span>
                  </div>
                )}

                <div className="border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedSearch(expandedSearch === search.id ? null : search.id)}
                    className="w-full justify-start text-sm font-medium text-muted-foreground hover:text-foreground"
                    data-testid={`button-toggle-results-${search.id}`}
                  >
                    {expandedSearch === search.id ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    <FileText className="h-4 w-4 mr-2" />
                    Matching Articles ({expandedSearch === search.id ? searchResults.length : '...'})
                  </Button>

                  {expandedSearch === search.id && (
                    <div className="mt-3 space-y-2" data-testid={`results-list-${search.id}`}>
                      {searchResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-4 py-2">
                          No matching articles found yet
                        </p>
                      ) : (
                        searchResults.map((article) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
