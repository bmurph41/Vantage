import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function csrfHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) headers["Content-Type"] = "application/json";
  const token = getCsrfToken();
  if (token) headers["X-CSRF-Token"] = token;
  return headers;
}
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Mail,
  Search,
  Plus,
  Trash2,
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  Calendar as CalendarIcon,
  Settings2,
  Pencil,
  Zap,
  Send,
  Globe,
  Tag,
  Building2,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { normalizeSavedSearchData } from "../lib/normalization";
import { formatDistanceToNow } from "date-fns";

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

const FREQUENCY_OPTIONS = [
  { value: "immediate", label: "Immediate", description: "Get notified right away", icon: Zap },
  { value: "daily", label: "Daily Digest", description: "Once per day at your chosen time", icon: Clock },
  { value: "weekly", label: "Weekly Summary", description: "Once per week on Mondays", icon: CalendarIcon },
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

function getTimezoneLabel(value: string) {
  return TIMEZONES.find(tz => tz.value === value)?.label || value;
}

function getFrequencyLabel(value: string | null) {
  if (!value) return "Off";
  return FREQUENCY_OPTIONS.find(f => f.value === value)?.label || value;
}

export default function SavedSearchesPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<SavedSearch | null>(null);
  const [deleteAlertId, setDeleteAlertId] = useState<string | null>(null);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null);

  const [alertName, setAlertName] = useState("");
  const [alertKeywords, setAlertKeywords] = useState("");
  const [alertCategories, setAlertCategories] = useState<string[]>([]);
  const [alertEntities, setAlertEntities] = useState("");
  const [alertFrequency, setAlertFrequency] = useState("daily");

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

  const { data: availableCategories = [] } = useQuery<string[]>({
    queryKey: ["/api/docktalk/categories/all"],
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
  }, [currentUser]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: EmailSettingsForm) => {
      const response = await fetch("/api/docktalk/user/notification-preferences", {
        method: "PATCH",
        headers: csrfHeaders(),
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
        title: "Settings Saved",
        description: "Your email delivery settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/docktalk/test-email", {
        method: "POST",
        headers: csrfHeaders(),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send test email");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Test Email Sent!", description: data.message || "Check your inbox." });
    },
    onError: (error: Error) => {
      toast({ title: "Email Test Failed", description: error.message, variant: "destructive" });
    },
  });

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
    mutationFn: async (data: any) => {
      const response = await fetch('/api/docktalk/saved-searches', {
        method: 'POST',
        headers: csrfHeaders(),
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to create alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/saved-searches'] });
      closeAlertDialog();
      toast({ title: "Alert Created", description: "You'll start receiving notifications for matching articles." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create alert", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SavedSearch> }) => {
      const response = await fetch(`/api/docktalk/saved-searches/${id}`, {
        method: 'PATCH',
        headers: csrfHeaders(),
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/saved-searches'] });
      closeAlertDialog();
      toast({ title: "Alert Updated", description: "Your alert has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update alert", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/docktalk/saved-searches/${id}`, {
        method: 'DELETE',
        headers: csrfHeaders(false),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete alert');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/saved-searches'] });
      setDeleteAlertId(null);
      toast({ title: "Alert Deleted", description: "Email alert has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete alert", variant: "destructive" });
    },
  });

  const closeAlertDialog = () => {
    setIsAddDialogOpen(false);
    setEditingAlert(null);
    setAlertName("");
    setAlertKeywords("");
    setAlertCategories([]);
    setAlertEntities("");
    setAlertFrequency("daily");
  };

  const openEditDialog = (search: SavedSearch) => {
    setEditingAlert(search);
    setAlertName(search.searchName);
    setAlertKeywords(search.queryText);
    setAlertCategories(search.categories || []);
    setAlertEntities((search.entities || []).join(", "));
    setAlertFrequency(search.alertFrequency || "daily");
    setIsAddDialogOpen(true);
  };

  const handleAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertName.trim() || !alertKeywords.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide an alert name and at least one keyword.",
        variant: "destructive",
      });
      return;
    }

    const entitiesArray = alertEntities.split(',').map(e => e.trim()).filter(Boolean);
    const normalizedData = normalizeSavedSearchData({
      searchName: alertName,
      queryText: alertKeywords,
      categories: alertCategories,
      entities: entitiesArray,
      emailAlerts: true,
      alertFrequency: alertFrequency,
    });

    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, data: normalizedData });
    } else {
      createMutation.mutate(normalizedData);
    }
  };

  const activeAlerts = searches.filter(s => s.emailAlerts);
  const pausedAlerts = searches.filter(s => !s.emailAlerts);
  const userEmail = form.watch("email");
  const userTimezone = form.watch("timezone");
  const userDeliveryTime = form.watch("deliveryTime");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Email Alerts
          </h1>
          <p className="text-muted-foreground mt-1">
            Get notified when articles matching your criteria are published
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-search">
          <Plus className="h-4 w-4 mr-2" />
          New Alert
        </Button>
      </div>

      <Card className="border-dashed">
        <div
          className="flex items-center justify-between px-6 py-4 cursor-pointer select-none"
          onClick={() => setSettingsExpanded(!settingsExpanded)}
        >
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-sm">Delivery Settings</h3>
              <p className="text-xs text-muted-foreground">
                {userEmail ? (
                  <>
                    <span className="font-medium">{userEmail}</span>
                    {" "}&middot;{" "}
                    {getTimezoneLabel(userTimezone || "America/New_York")}
                    {" "}&middot; Digest at{" "}
                    {userDeliveryTime || "09:00"}
                  </>
                ) : (
                  "Set your email address to receive alerts"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!userEmail && (
              <Badge variant="destructive" className="text-xs">Setup Required</Badge>
            )}
            {settingsExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {settingsExpanded && (
          <CardContent className="border-t pt-4">
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
                <form onSubmit={form.handleSubmit((data) => updatePreferencesMutation.mutate(data))} className="space-y-4">
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
                        <FormDescription>All alerts will be sent to this address</FormDescription>
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
                            <Globe className="h-3.5 w-3.5" />
                            Timezone
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
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
                            <Clock className="h-3.5 w-3.5" />
                            Digest Delivery Time
                          </FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-delivery-time" />
                          </FormControl>
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
                      <Send className="h-4 w-4 mr-2" />
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
        )}
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Bell className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Alerts Yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Create your first alert to get notified when articles about marina acquisitions, industry news, or specific companies are published.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} size="lg" data-testid="button-add-first-search">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Alert
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeAlerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Active Alerts ({activeAlerts.length})
              </h2>
              <div className="grid gap-3">
                {activeAlerts.map((search) => (
                  <AlertCard
                    key={search.id}
                    search={search}
                    onEdit={openEditDialog}
                    onDelete={(id) => setDeleteAlertId(id)}
                    onToggle={(id, enabled) => {
                      const normalizedData = normalizeSavedSearchData({
                        emailAlerts: enabled,
                        alertFrequency: enabled ? (search.alertFrequency || 'daily') : null,
                        categories: search.categories || [],
                        entities: search.entities || [],
                      });
                      updateMutation.mutate({ id, data: normalizedData });
                    }}
                    isUpdating={updateMutation.isPending}
                    expandedSearch={expandedSearch}
                    onToggleExpand={(id) => setExpandedSearch(expandedSearch === id ? null : id)}
                    searchResults={expandedSearch === search.id ? searchResults : []}
                  />
                ))}
              </div>
            </div>
          )}

          {pausedAlerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Paused ({pausedAlerts.length})
              </h2>
              <div className="grid gap-3">
                {pausedAlerts.map((search) => (
                  <AlertCard
                    key={search.id}
                    search={search}
                    onEdit={openEditDialog}
                    onDelete={(id) => setDeleteAlertId(id)}
                    onToggle={(id, enabled) => {
                      const normalizedData = normalizeSavedSearchData({
                        emailAlerts: enabled,
                        alertFrequency: enabled ? (search.alertFrequency || 'daily') : null,
                        categories: search.categories || [],
                        entities: search.entities || [],
                      });
                      updateMutation.mutate({ id, data: normalizedData });
                    }}
                    isUpdating={updateMutation.isPending}
                    expandedSearch={expandedSearch}
                    onToggleExpand={(id) => setExpandedSearch(expandedSearch === id ? null : id)}
                    searchResults={expandedSearch === search.id ? searchResults : []}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) closeAlertDialog(); else setIsAddDialogOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <form onSubmit={handleAlertSubmit} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingAlert ? "Edit Alert" : "Create New Alert"}</DialogTitle>
              <DialogDescription>
                {editingAlert
                  ? "Update your alert criteria and delivery preferences"
                  : "Set up keyword and category filters to receive email notifications"
                }
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
              <div className="space-y-2">
                <Label htmlFor="alertName" className="text-sm font-medium">
                  Alert Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="alertName"
                  placeholder="e.g., Southeast Marina Acquisitions"
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  data-testid="input-search-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alertKeywords" className="text-sm font-medium">
                  Keywords <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="alertKeywords"
                  placeholder="Enter keywords, phrases, or search terms..."
                  value={alertKeywords}
                  onChange={(e) => setAlertKeywords(e.target.value)}
                  rows={2}
                  data-testid="input-query-text"
                />
                <p className="text-xs text-muted-foreground">
                  Articles matching any of these keywords will trigger this alert
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Categories</Label>
                <p className="text-xs text-muted-foreground">
                  Narrow your alert to specific topics (leave empty for all categories)
                </p>
                <ScrollArea className="h-40 border rounded-md p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {availableCategories.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`alert-cat-${category}`}
                          checked={alertCategories.includes(category)}
                          onCheckedChange={(checked) => {
                            setAlertCategories(prev =>
                              checked
                                ? [...prev, category]
                                : prev.filter(c => c !== category)
                            );
                          }}
                          data-testid={`checkbox-category-${category.toLowerCase().replace(/ /g, '-')}`}
                        />
                        <label htmlFor={`alert-cat-${category}`} className="text-sm cursor-pointer leading-none">
                          {category}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {alertCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {alertCategories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-destructive/20"
                        onClick={() => setAlertCategories(prev => prev.filter(c => c !== cat))}
                      >
                        {cat} &times;
                      </Badge>
                    ))}
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
                      onClick={() => setAlertCategories([])}
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="alertEntities" className="text-sm font-medium">
                  Companies / Entities
                </Label>
                <Input
                  id="alertEntities"
                  placeholder="e.g., Safe Harbor, Suntex, Sun Communities"
                  value={alertEntities}
                  onChange={(e) => setAlertEntities(e.target.value)}
                  data-testid="input-entities"
                />
                <p className="text-xs text-muted-foreground">Comma-separated list of companies to track</p>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">How Often</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FREQUENCY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = alertFrequency === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAlertFrequency(option.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${
                          isSelected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-muted hover:border-muted-foreground/30 text-muted-foreground"
                        }`}
                        data-testid={`freq-${option.value}`}
                      >
                        <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : ''}`} />
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className="text-[11px] leading-tight">{option.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeAlertDialog}
                data-testid="button-cancel-add"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-add"
              >
                {(createMutation.isPending || updateMutation.isPending)
                  ? "Saving..."
                  : editingAlert ? "Save Changes" : "Create Alert"
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAlertId} onOpenChange={(open) => { if (!open) setDeleteAlertId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this alert?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this alert and you'll stop receiving notifications for it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAlertId && deleteMutation.mutate(deleteAlertId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AlertCard({
  search,
  onEdit,
  onDelete,
  onToggle,
  isUpdating,
  expandedSearch,
  onToggleExpand,
  searchResults,
}: {
  search: SavedSearch;
  onEdit: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  isUpdating: boolean;
  expandedSearch: string | null;
  onToggleExpand: (id: string) => void;
  searchResults: Article[];
}) {
  const isExpanded = expandedSearch === search.id;
  const isActive = search.emailAlerts;

  return (
    <Card
      className={`transition-all ${!isActive ? 'opacity-60 border-dashed' : ''}`}
      data-testid={`card-search-${search.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 mt-0.5 ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
            {isActive ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">{search.searchName}</h3>
              {search.alertFrequency && isActive && (
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {getFrequencyLabel(search.alertFrequency)}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
              <Search className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{search.queryText}</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {(search.categories || []).map((cat, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {cat}
                </Badge>
              ))}
              {(search.entities || []).map((entity, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {entity}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => onToggleExpand(search.id)}
                data-testid={`button-toggle-results-${search.id}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 mr-1" />
                )}
                <FileText className="h-3.5 w-3.5 mr-1" />
                Matching Articles
              </Button>
              <span className="text-xs text-muted-foreground">
                Created {formatDistanceToNow(new Date(search.createdAt))} ago
              </span>
            </div>

            {isExpanded && (
              <div className="mt-3 space-y-2 border-t pt-3" data-testid={`results-list-${search.id}`}>
                {searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No matching articles found yet
                  </p>
                ) : (
                  searchResults.map((article) => (
                    <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2.5 rounded-md border hover:bg-muted/50 transition-colors"
                      data-testid={`article-${article.id}`}
                    >
                      <h4 className="text-sm font-medium line-clamp-1">{article.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{article.source}</span>
                        <span>&middot;</span>
                        <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                        {article.categories?.[0] && (
                          <>
                            <span>&middot;</span>
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

          <div className="flex items-center gap-1 flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => onToggle(search.id, checked)}
                    disabled={isUpdating}
                    data-testid={`switch-alert-${search.id}`}
                  />
                </TooltipTrigger>
                <TooltipContent>{isActive ? "Pause alert" : "Enable alert"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(search)}
              data-testid={`button-edit-${search.id}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(search.id)}
              data-testid={`button-delete-${search.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
