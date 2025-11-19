import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Mail, Bell, Clock, CheckCircle, Search, Plus, Pencil, Trash2, Calendar as CalendarIcon } from "lucide-react";
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
import { apiRequest } from "@/lib/queryClient";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const CATEGORIES = [
  "Development",
  "Operations",
  "Regulatory",
  "Environmental",
  "Technology",
  "Macro",
  "M&A",
  "General",
  "Boat Sales",
  "Boat Show",
  "Manufacturing",
  "Industry Trends",
  "Marina Sale",
  "Education",
  "Insurance",
  "Legal",
  "People Moves",
  "Company Earnings",
  "Awards",
  "Business Planning",
  "International",
] as const;

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

const savedSearchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  criteria: z.object({
    search: z.string().optional(),
    categories: z.array(z.string()).optional(),
    minRelevance: z.number().min(0).max(100).optional(),
    sentiment: z.enum(["any", "positive", "neutral", "negative"]).optional(),
    dealsOnly: z.boolean().optional(),
  }),
  alertFrequency: z.enum(["none", "immediate", "daily", "weekly"]),
});

type SavedSearchForm = z.infer<typeof savedSearchSchema>;

interface NotificationPreferencesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NotificationPreferences({
  open,
  onOpenChange,
}: NotificationPreferencesProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("email-updates");
  const [editingSearch, setEditingSearch] = useState<any | null>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [deleteSearchId, setDeleteSearchId] = useState<string | null>(null);

  // Fetch current user preferences
  const { data: currentUser, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/docktalk/user/current"],
    enabled: open,
  });

  // Fetch saved searches
  const { data: savedSearches, isLoading: searchesLoading } = useQuery<any[]>({
    queryKey: ["/api/docktalk/saved-searches"],
    enabled: open && activeTab === "email-updates",
  });

  // Fetch notifications
  const { data: notifications, isLoading: notificationsLoading } = useQuery<any[]>({
    queryKey: ["/api/docktalk/notifications"],
    enabled: open && activeTab === "history",
  });

  const form = useForm<EmailSettingsForm>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      email: "",
      deliveryTime: "09:00",
      timezone: "America/New_York",
    },
  });

  // Update form when user data loads
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
          // Keep existing categories and frequency for backwards compatibility
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
        title: "Test Email Sent! ✅",
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

  // Saved search form
  const searchForm = useForm<SavedSearchForm>({
    resolver: zodResolver(savedSearchSchema),
    defaultValues: {
      name: "",
      criteria: {
        search: "",
        categories: [],
        minRelevance: 50,
        sentiment: "any",
        dealsOnly: false,
      },
      alertFrequency: "daily",
    },
  });

  useEffect(() => {
    if (searchDialogOpen) {
      if (editingSearch) {
        searchForm.reset({
          name: editingSearch.name,
          criteria: editingSearch.criteria || {
            search: "",
            categories: [],
            minRelevance: 50,
            sentiment: "any",
            dealsOnly: false,
          },
          alertFrequency: editingSearch.alertFrequency || "daily",
        });
      } else {
        searchForm.reset({
          name: "",
          criteria: {
            search: "",
            categories: [],
            minRelevance: 50,
            sentiment: "any",
            dealsOnly: false,
          },
          alertFrequency: "daily",
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
      return await apiRequest(`/api/saved-searches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json"},
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
      const response = await fetch(`/api/saved-searches/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete search");
      }
      
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/docktalk/saved-searches"] });
      await queryClient.refetchQueries({ queryKey: ["/api/docktalk/saved-searches"] });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notifications
          </DialogTitle>
          <DialogDescription>
            Manage email delivery settings and saved searches
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="email-updates" data-testid="tab-email-updates">
              <Mail className="h-4 w-4 mr-2" />
              Email Updates
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-notification-history">
              <Bell className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email-updates" className="mt-4 overflow-y-auto flex-1 pr-2">
            {userLoading || searchesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                {/* Global Email Settings */}
                <div>
                  <h3 className="text-lg font-semibold mb-1">Email Delivery Settings</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure where and when to receive email alerts
                  </p>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          {testEmailMutation.isPending ? "Sending..." : "Test Email"}
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
                </div>

                <Separator />

                {/* Saved Searches Section */}
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Email Alert Searches</h3>
                      <p className="text-sm text-muted-foreground">
                        Create searches to define what articles trigger email alerts. Each search can have its own alert frequency.
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

                  {savedSearches && savedSearches.length > 0 ? (
                    <div className="space-y-3">
                      {savedSearches.map((search: any) => (
                        <Card key={search.id} data-testid={`saved-search-${search.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-base flex items-center gap-2">
                                  {search.name}
                                  <Badge variant={search.alertFrequency === "none" ? "outline" : "default"} className="text-xs">
                                    {search.alertFrequency === "none" ? "No Alerts" : `${search.alertFrequency}`}
                                  </Badge>
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  Created {formatDistanceToNow(new Date(search.createdAt))} ago
                                  {search.lastAlertSent && (
                                    <> • Last alert {formatDistanceToNow(new Date(search.lastAlertSent))} ago</>
                                  )}
                                </CardDescription>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
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
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteSearchId(search.id);
                                  }}
                                  data-testid={`button-delete-search-${search.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 pt-0">
                            {search.criteria?.search && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Keywords:</span>{" "}
                                <span className="font-medium">{search.criteria.search}</span>
                              </div>
                            )}
                            {search.criteria?.categories && search.criteria.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {search.criteria.categories.map((cat: string) => (
                                  <Badge key={cat} variant="secondary" className="text-xs">
                                    {cat}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {search.criteria?.sentiment && search.criteria.sentiment !== "any" && (
                                <span>Sentiment: {search.criteria.sentiment}</span>
                              )}
                              {search.criteria?.minRelevance && (
                                <span>Min Relevance: {search.criteria.minRelevance}%</span>
                              )}
                              {search.criteria?.dealsOnly && (
                                <Badge variant="outline" className="text-xs">Deals Only</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border rounded-lg bg-muted/20">
                      <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium">No email alert searches yet</p>
                      <p className="text-sm text-muted-foreground mt-1 mb-3">
                        Create a search to start receiving email alerts for specific articles
                      </p>
                      <Button
                        onClick={() => {
                          setEditingSearch(null);
                          setSearchDialogOpen(true);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Search
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 overflow-y-auto flex-1">
            {notificationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : notifications && notifications.length > 0 ? (
              <div className="space-y-3 pb-4">
                {notifications.map((notification: any) => (
                  <div
                    key={notification.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    data-testid={`notification-item-${notification.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <h4 className="font-medium text-sm">
                            {notification.message}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(notification.sentAt))} ago</span>
                          <span>•</span>
                          <span>{notification.frequency} alert</span>
                          {notification.deliveryMethod && (
                            <>
                              <span>•</span>
                              <span>{notification.deliveryMethod}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No notifications yet</p>
                <p className="text-sm mt-1">
                  Create a saved search to start receiving alerts
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Create/Edit Search Dialog */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingSearch ? "Edit Search" : "Create New Search"}</DialogTitle>
            <DialogDescription>
              {editingSearch ? "Update your saved search criteria" : "Set up a new search to monitor specific marina industry articles"}
            </DialogDescription>
          </DialogHeader>

          <Form {...searchForm}>
            <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="space-y-4 overflow-y-auto pr-2">
              <FormField
                control={searchForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Search Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Marina M&A Activity" {...field} data-testid="input-search-name" />
                    </FormControl>
                    <FormDescription>A descriptive name for this search</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={searchForm.control}
                name="criteria.search"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., acquisition, merger, valuation" {...field} data-testid="input-search-keywords" />
                    </FormControl>
                    <FormDescription>Keywords to search for in articles</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={searchForm.control}
                name="criteria.categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categories (Optional)</FormLabel>
                    <FormDescription className="mb-2">
                      Select categories to monitor
                    </FormDescription>
                    <ScrollArea className="h-32 border rounded-md p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {CATEGORIES.map((category) => (
                          <div key={category} className="flex items-center space-x-2">
                            <Checkbox
                              id={`search-category-${category}`}
                              checked={field.value?.includes(category)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                const updated = checked
                                  ? [...current, category]
                                  : current.filter((c) => c !== category);
                                field.onChange(updated);
                              }}
                              data-testid={`checkbox-search-category-${category.toLowerCase().replace(/ /g, '-')}`}
                            />
                            <label htmlFor={`search-category-${category}`} className="text-sm cursor-pointer">
                              {category}
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    {field.value && field.value.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {field.value.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={searchForm.control}
                  name="criteria.minRelevance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Relevance: {field.value}%</FormLabel>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[field.value || 50]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          data-testid="slider-min-relevance"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Minimum relevance score</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={searchForm.control}
                  name="criteria.sentiment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sentiment</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "any"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-sentiment">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="positive">Positive</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="negative">Negative</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">Article sentiment filter</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={searchForm.control}
                name="criteria.dealsOnly"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-deals-only"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">Deals Only</FormLabel>
                      <FormDescription>Only show articles about M&A deals and transactions</FormDescription>
                    </div>
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
                        <SelectTrigger data-testid="select-search-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Alerts</SelectItem>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>How often to send alerts for this search</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchDialogOpen(false);
                    setEditingSearch(null);
                  }}
                  data-testid="button-cancel-search"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createSearchMutation.isPending || updateSearchMutation.isPending}
                  data-testid="button-save-search"
                >
                  {createSearchMutation.isPending || updateSearchMutation.isPending
                    ? "Saving..."
                    : editingSearch
                    ? "Update Search"
                    : "Create Search"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSearchId} onOpenChange={(open) => !open && setDeleteSearchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Search?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this saved search and stop all associated alerts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
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
    </Dialog>
  );
}
