import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Search, Plus, Trash2, Bell, BellOff, ChevronDown, ChevronRight, FileText, Clock, Calendar as CalendarIcon } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { normalizeSavedSearchData } from "../lib/normalization";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Vancouver", label: "Vancouver (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
] as const;

const emailSettingsSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  deliveryTime: z.string().optional(),
  timezone: z.string().default("America/New_York"),
});

type EmailSettingsForm = z.infer<typeof emailSettingsSchema>;

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

  const form = useForm<EmailSettingsForm>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      email: "",
      deliveryTime: "09:00",
      timezone: "America/New_York",
    },
  });

  const { data: currentUser, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/docktalk/user/current"],
  });

  useEffect(() => {
    if (currentUser) {
      const prefs = currentUser.notificationPreferences;
      form.reset({
        email: prefs?.emailAddress || currentUser.email || "",
        deliveryTime: prefs?.deliveryTime || "09:00",
        timezone: prefs?.timezone || "America/New_York",
      });
    }
  }, [currentUser, form]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: EmailSettingsForm) => {
      const response = await fetch("/api/docktalk/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          deliveryTime: data.deliveryTime,
          timezone: data.timezone,
          categories: currentUser?.notificationPreferences?.categories || [],
          frequency: currentUser?.notificationPreferences?.frequency || "none",
          enabled: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update preferences");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/user/current"] });
      toast({
        title: "Email Settings Saved",
        description: "Your email delivery settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/docktalk/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send test email");
      }

      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test Email Sent!",
        description: data.message || "Check your inbox for the test email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Email Test Failed",
        description: error.message || "Failed to send test email. Please check your notification settings.",
        variant: "destructive",
      });
    },
  });

  const onEmailSettingsSubmit = (data: EmailSettingsForm) => {
    updatePreferencesMutation.mutate(data);
  };

  const { data: searches = [], isLoading } = useQuery<SavedSearch[]>({
    queryKey: ['/api/docktalk/saved-searches'],
  });

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
        title: "Alert Created",
        description: "Your email alert has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save alert",
        variant: "destructive",
      });
    },
  });

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
        title: "Alert Updated",
        description: "Alert settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update alert",
        variant: "destructive",
      });
    },
  });

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
        title: "Alert Deleted",
        description: "Email alert has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete alert",
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
        description: "Alert name and keywords are required",
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          Email Alerts
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure email delivery settings and create alerts to receive notifications when matching articles are published
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Delivery Settings
          </CardTitle>
          <CardDescription>
            Configure where and when to receive email alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onEmailSettingsSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your.email@company.com"
                          {...field}
                          data-testid="input-notification-email"
                        />
                      </FormControl>
                      <FormDescription>
                        Email address where you'll receive article alerts
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Timezone
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-timezone">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Your local timezone
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Delivery Time
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            data-testid="input-delivery-time"
                          />
                        </FormControl>
                        <FormDescription>
                          Daily/weekly digest time
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testEmailMutation.mutate()}
                    disabled={testEmailMutation.isPending || !form.watch("email")}
                    data-testid="button-test-email"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {testEmailMutation.isPending ? "Sending..." : "Send Test Email"}
                  </Button>
                  
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updatePreferencesMutation.isPending}
                    data-testid="button-save-preferences"
                  >
                    {updatePreferencesMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alert Rules</h2>
          <p className="text-muted-foreground mt-1">
            Create keyword-based alerts to track marina industry news and M&A activity
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-search">
          <Plus className="h-4 w-4 mr-2" />
          New Alert
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create Email Alert</DialogTitle>
                <DialogDescription>
                  Define search criteria to receive email notifications when matching articles are published
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="searchName">Alert Name *</Label>
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
                  <Label htmlFor="queryText">Keywords *</Label>
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
                    You'll receive alerts for articles matching these keywords
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
                      <Label htmlFor="emailAlerts">Enable Email Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive email notifications when matching articles are published
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
                  {createMutation.isPending ? "Saving..." : "Create Alert"}
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
              <Bell className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <CardTitle className="text-2xl">No Email Alerts Yet</CardTitle>
            <CardDescription className="text-base mt-2">
              Create keyword-based alerts to automatically receive emails when matching marina industry news is published
            </CardDescription>
            <div className="mt-6">
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-search">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Alert
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
                      <Bell className="h-5 w-5 text-primary" />
                      {search.searchName}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Keywords: {search.queryText}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {(search.categories || []).map((category, idx) => (
                        <Badge key={idx} variant="secondary" data-testid={`badge-category-${search.id}-${idx}`}>
                          {category}
                        </Badge>
                      ))}
                      {(search.entities || []).map((entity, idx) => (
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
                            categories: search.categories || [],
                            entities: search.entities || [],
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
                    <Mail className="h-4 w-4" />
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
