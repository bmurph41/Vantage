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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "../lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Mail, Bell, Clock, Plus, Pencil, Trash2, Calendar as CalendarIcon, CheckCircle, Info, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";


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
  deliveryTime: z.string().optional(),
  timezone: z.string().default("America/New_York"),
});

type EmailSettingsForm = z.infer<typeof emailSettingsSchema>;

interface CurrentUser {
  id: string;
  orgId: string;
  role: string;
  email: string;
  name: string;
}

const TIMEZONES_LIST = [
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

const savedSearchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  criteria: z.object({
    search: z.string().optional(),
    categories: z.array(z.string()).optional(),
    sentiment: z.enum(["any", "positive", "neutral", "negative"]).optional(),
    dealsOnly: z.boolean().optional(),
  }),
  alertFrequency: z.enum(["none", "immediate", "daily", "weekly"]),
  deliveryTime: z.string().default("09:00"),
  timezone: z.string().default("America/New_York"),
});

type SavedSearchForm = z.infer<typeof savedSearchSchema>;

interface UserPreferences {
  id: string;
  emailNotifications: boolean;
  alertFrequency: string;
  subscriptionTier: string;
  categoriesFilter: string[];
  email?: string;
  deliveryTime?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("email-updates");
  const [editingSearch, setEditingSearch] = useState<any | null>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [deleteSearchId, setDeleteSearchId] = useState<string | null>(null);
  const [allNewsSelected, setAllNewsSelected] = useState(false);

  const { data: currentUser, isLoading: userLoading } = useQuery<CurrentUser>({
    queryKey: ['/api/auth/me'],
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['/api/docktalk/categories/all'],
  });

  const { data: preferences, isLoading: preferencesLoading } = useQuery<UserPreferences>({
    queryKey: ['/api/docktalk/user-preferences'],
  });

  const { data: savedSearches = [], isLoading: searchesLoading } = useQuery<any[]>({
    queryKey: ["/api/docktalk/saved-searches"],
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<any[]>({
    queryKey: ["/api/docktalk/notifications"],
    enabled: activeTab === "history",
  });

  const form = useForm<EmailSettingsForm>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      deliveryTime: "09:00",
      timezone: "America/New_York",
    },
  });

  useEffect(() => {
    if (preferences) {
      form.reset({
        deliveryTime: preferences.deliveryTime || "09:00",
        timezone: preferences.timezone || "America/New_York",
      });
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: EmailSettingsForm & { emailNotifications?: boolean }) => {
      return await apiRequest("/api/docktalk/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentUser?.email,
          deliveryTime: data.deliveryTime,
          timezone: data.timezone,
          emailNotifications: data.emailNotifications ?? preferences?.emailNotifications ?? true,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/user-preferences"] });
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
      return await apiRequest("/api/docktalk/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
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

  const onSubmit = (data: EmailSettingsForm) => {
    updatePreferencesMutation.mutate(data);
  };

  const searchForm = useForm<SavedSearchForm>({
    resolver: zodResolver(savedSearchSchema),
    defaultValues: {
      name: "",
      criteria: {
        search: "",
        categories: [],
        sentiment: "any",
        dealsOnly: false,
      },
      alertFrequency: "daily",
      deliveryTime: "09:00",
      timezone: "America/New_York",
    },
  });

  useEffect(() => {
    if (searchDialogOpen) {
      if (editingSearch) {
        const hasNoCategories = !editingSearch.criteria?.categories || editingSearch.criteria.categories.length === 0;
        setAllNewsSelected(hasNoCategories);
        searchForm.reset({
          name: editingSearch.name,
          criteria: editingSearch.criteria || {
            search: "",
            categories: [],
            sentiment: "any",
            dealsOnly: false,
          },
          alertFrequency: editingSearch.alertFrequency || "daily",
          deliveryTime: editingSearch.deliveryTime || "09:00",
          timezone: editingSearch.timezone || "America/New_York",
        });
      } else {
        setAllNewsSelected(false);
        searchForm.reset({
          name: "",
          criteria: {
            search: "",
            categories: [],
            sentiment: "any",
            dealsOnly: false,
          },
          alertFrequency: "daily",
          deliveryTime: "09:00",
          timezone: "America/New_York",
        });
      }
    }
  }, [searchDialogOpen, editingSearch?.id]);

  const createSearchMutation = useMutation({
    mutationFn: async (data: SavedSearchForm) => {
      return await apiRequest("/api/docktalk/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/saved-searches"] });
      setSearchDialogOpen(false);
      setEditingSearch(null);
      toast({
        title: "Search Saved",
        description: "Your search has been saved successfully.",
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

  const updateSearchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SavedSearchForm }) => {
      return await apiRequest(`/api/docktalk/saved-searches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/saved-searches"] });
      setSearchDialogOpen(false);
      setEditingSearch(null);
      toast({
        title: "Search Updated",
        description: "Your search has been updated successfully.",
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

  const deleteSearchMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/docktalk/saved-searches/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/docktalk/saved-searches"] });
      setDeleteSearchId(null);
      toast({
        title: "Search Deleted",
        description: "Your search has been deleted successfully.",
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

  const onSearchSubmit = (data: SavedSearchForm) => {
    if (editingSearch) {
      updateSearchMutation.mutate({ id: editingSearch.id, data });
    } else {
      createSearchMutation.mutate(data);
    }
  };

  if (preferencesLoading || userLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Configure email alerts and saved searches
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-8 w-8 text-primary" />
          Email Notifications
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure email alerts for new articles and saved searches
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="email-updates" data-testid="tab-email-updates">
            <Mail className="h-4 w-4 mr-2" />
            Email Settings
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-notification-history">
            <Bell className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email-updates" className="mt-6 space-y-6">
          <Card data-testid="card-email-settings">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <CardTitle>Email Delivery Settings</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Enable Emails</span>
                  <Switch
                    checked={preferences?.emailNotifications ?? false}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        ...form.getValues(),
                        emailNotifications: checked,
                      });
                    }}
                    data-testid="switch-email-notifications"
                  />
                </div>
              </div>
              <CardDescription>
                Configure where and when to receive email alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Quick Status Summary */}
              {!searchesLoading && (
                <div className="mb-6 p-4 bg-muted/50 rounded-lg border" data-testid="active-searches-summary">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      {savedSearches.filter((s: any) => s.alertFrequency !== "none").length > 0 ? (
                        <div>
                          <p className="text-sm font-medium">
                            {savedSearches.filter((s: any) => s.alertFrequency !== "none").length} active alert{savedSearches.filter((s: any) => s.alertFrequency !== "none").length !== 1 ? 's' : ''} configured
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Alerts will be sent to <span className="font-medium">{currentUser?.email}</span>. Manage your searches below.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium">No active alerts</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Create a search below to start receiving email alerts for articles matching your criteria.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Separator className="mb-6" />

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <div 
                      className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm"
                      data-testid="display-notification-email"
                    >
                      <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                      {currentUser?.email || "Loading..."}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Alerts will be sent to your account email. To change this, update your account settings.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div className="flex justify-between items-center pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testEmailMutation.mutate()}
                      disabled={testEmailMutation.isPending || !currentUser?.email}
                      data-testid="button-test-email"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {testEmailMutation.isPending ? "Sending..." : "Send Test Email"}
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="button-save-preferences"
                    >
                      {updatePreferencesMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                </form>
              </Form>

              <Separator className="my-6" />

              {/* Email Alert Searches Section - Combined into same card */}
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Email Alert Searches
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Define what articles trigger email alerts. Each search can have its own alert frequency.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingSearch(null);
                      setSearchDialogOpen(true);
                    }}
                    size="sm"
                    data-testid="button-create-search"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Search
                  </Button>
                </div>

                {searchesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : savedSearches.length > 0 ? (
                  <div className="space-y-3">
                    {savedSearches.map((search: any) => (
                      <div 
                        key={search.id} 
                        className="p-4 border rounded-lg bg-background"
                        data-testid={`saved-search-${search.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{search.name}</span>
                              <Badge variant={search.alertFrequency === "none" ? "outline" : "default"} className="text-xs">
                                {search.alertFrequency === "none" ? "No Alerts" : search.alertFrequency}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Created {formatDistanceToNow(new Date(search.createdAt))} ago
                              {search.lastAlertSent && (
                                <> • Last alert {formatDistanceToNow(new Date(search.lastAlertSent))} ago</>
                              )}
                            </p>
                            {search.criteria?.search && (
                              <div className="text-sm mt-2">
                                <span className="text-muted-foreground">Keywords:</span>{" "}
                                <span className="font-medium">{search.criteria.search}</span>
                              </div>
                            )}
                            {search.criteria?.categories?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {search.criteria.categories.map((cat: string) => (
                                  <Badge key={cat} variant="secondary" className="text-xs">
                                    {cat}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingSearch(search);
                                setSearchDialogOpen(true);
                              }}
                              data-testid={`button-edit-search-${search.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteSearchId(search.id)}
                              data-testid={`button-delete-search-${search.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No saved searches yet.</p>
                    <p className="text-sm">Create a search to receive email alerts for matching articles.</p>
                    <Button
                      onClick={() => {
                        setEditingSearch(null);
                        setSearchDialogOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      data-testid="button-create-first-search"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Search
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card data-testid="card-notification-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification History
              </CardTitle>
              <CardDescription>
                Recent email alerts that have been sent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notificationsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notification: any) => (
                    <div 
                      key={notification.id} 
                      className="flex items-start gap-3 p-3 border rounded-lg"
                      data-testid={`notification-${notification.id}`}
                    >
                      <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{notification.title || "Email Alert"}</p>
                        <p className="text-sm text-muted-foreground">
                          {notification.message || "Alert sent successfully"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt))} ago
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications yet.</p>
                  <p className="text-sm">Your email alert history will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSearch ? "Edit Saved Search" : "Create Saved Search"}
            </DialogTitle>
            <DialogDescription>
              Define criteria for articles that will trigger email alerts
            </DialogDescription>
          </DialogHeader>
          <Form {...searchForm}>
            <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="space-y-4">
              <FormField
                control={searchForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Search Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., M&A Deals" {...field} data-testid="input-search-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={searchForm.control}
                name="criteria.search"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., acquisition, merger, marina" {...field} data-testid="input-search-keywords" />
                    </FormControl>
                    <FormDescription>Comma-separated keywords to match</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={searchForm.control}
                name="criteria.categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categories</FormLabel>
                    
                    {/* All News Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 mt-2">
                      <div>
                        <span className="font-medium text-sm">All News</span>
                        <p className="text-xs text-muted-foreground">Receive alerts for all categories</p>
                      </div>
                      <Switch
                        checked={allNewsSelected}
                        onCheckedChange={(checked) => {
                          setAllNewsSelected(checked);
                          if (checked) {
                            field.onChange([]);
                          }
                        }}
                        data-testid="switch-all-news"
                      />
                    </div>
                    
                    {/* Category Grid */}
                    <div className={`grid grid-cols-2 gap-2 mt-3 p-3 rounded-lg border ${allNewsSelected ? 'opacity-50 bg-muted/20' : ''}`}>
                      {categories.map((category) => (
                        <label
                          key={category}
                          className={`flex items-center gap-2 ${allNewsSelected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <Checkbox
                            checked={allNewsSelected || field.value?.includes(category)}
                            disabled={allNewsSelected}
                            onCheckedChange={(checked) => {
                              if (allNewsSelected) return;
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, category]);
                              } else {
                                field.onChange(current.filter((c) => c !== category));
                                setAllNewsSelected(false);
                              }
                            }}
                            data-testid={`checkbox-category-${category.toLowerCase().replace(/ /g, '-')}`}
                          />
                          <span className="text-sm">{category}</span>
                        </label>
                      ))}
                    </div>
                    {!allNewsSelected && field.value && field.value.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {field.value.length} of {categories.length} categories selected
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={searchForm.control}
                name="alertFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alert Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-alert-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Alerts</SelectItem>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="daily">Daily Digest</SelectItem>
                        <SelectItem value="weekly">Weekly Digest</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === "immediate" && "Get notified as soon as matching articles are found"}
                      {field.value === "daily" && "Receive a daily digest at your chosen time"}
                      {field.value === "weekly" && "Receive a weekly digest every Monday at your chosen time"}
                      {field.value === "none" && "Alerts are disabled for this search"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Time & Timezone - only show when alerts are enabled and not immediate */}
              {searchForm.watch("alertFrequency") !== "none" && searchForm.watch("alertFrequency") !== "immediate" && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                  <FormField
                    control={searchForm.control}
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
                            data-testid="input-alert-delivery-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={searchForm.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Timezone
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-alert-timezone">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONES_LIST.map((tz) => (
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
                </div>
              )}

              {/* Info about first email */}
              {searchForm.watch("alertFrequency") !== "none" && !editingSearch && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>First alert:</strong> You'll receive articles from the past 7 days matching your criteria. 
                    After that, you'll only receive new articles.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setSearchDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createSearchMutation.isPending || updateSearchMutation.isPending}
                  data-testid="button-save-search"
                >
                  {editingSearch ? "Update Search" : "Create Search"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSearchId} onOpenChange={() => setDeleteSearchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Search</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this saved search? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSearchId && deleteSearchMutation.mutate(deleteSearchId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
