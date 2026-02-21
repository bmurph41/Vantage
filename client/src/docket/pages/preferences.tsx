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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Bell, Eye, Filter, CreditCard } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { normalizeUserPreferences } from "../lib/normalization";

interface UserPreferences {
  id: string;
  emailNotifications: boolean;
  alertFrequency: string;
  subscriptionTier: string;
  categoriesFilter: string[];
  createdAt: string;
  updatedAt: string;
}

export default function PreferencesPage() {
  const { toast } = useToast();

  // Fetch user preferences
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ['/api/docket/user-preferences'],
  });

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      const response = await fetch('/api/docket/user-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docket/user-preferences'] });
      toast({
        title: "Preferences Updated",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      });
    },
  });

  const handleEmailNotificationsToggle = (checked: boolean) => {
    const normalizedData = normalizeUserPreferences({
      emailNotifications: checked,
      alertFrequency: checked ? (preferences?.alertFrequency || 'daily') : null,
    });
    updateMutation.mutate(normalizedData);
  };

  const handleAlertFrequencyChange = (frequency: string) => {
    if (!preferences?.emailNotifications) return;
    const normalizedData = normalizeUserPreferences({
      alertFrequency: frequency,
    });
    updateMutation.mutate(normalizedData);
  };

  const getSubscriptionBadge = (tier: string) => {
    const badges: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      free: { label: "Free", variant: "outline" },
      professional: { label: "Professional", variant: "default" },
      enterprise: { label: "Enterprise", variant: "secondary" },
    };
    return badges[tier] || { label: tier, variant: "outline" };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Preferences</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Docket notification and display settings
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

  if (!preferences) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Preferences</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Docket notification and display settings
          </p>
        </div>
        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex justify-center mb-4">
              <Settings className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <CardTitle className="text-2xl">No Preferences Found</CardTitle>
            <CardDescription className="text-base mt-2">
              Unable to load your preferences. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const subscriptionBadge = getSubscriptionBadge(preferences.subscriptionTier);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Preferences</h1>
        <p className="text-muted-foreground mt-1">
          Manage your Docket notification and display settings
        </p>
      </div>

      {/* Subscription Tier */}
      <Card data-testid="card-subscription">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Subscription</CardTitle>
          </div>
          <CardDescription>
            Your current Docket subscription tier and features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Plan</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {preferences.subscriptionTier === 'enterprise' && 'Unlimited access to all Docket features'}
                {preferences.subscriptionTier === 'professional' && 'Advanced analytics and unlimited watchlists'}
                {preferences.subscriptionTier === 'free' && 'Basic access to Docket intelligence'}
              </p>
            </div>
            <Badge variant={subscriptionBadge.variant} className="text-base px-4 py-1" data-testid="badge-subscription">
              {subscriptionBadge.label}
            </Badge>
          </div>

          {preferences.subscriptionTier === 'free' && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Upgrade to unlock advanced features like unlimited saved searches, enhanced analytics, and priority alerts.
              </p>
              <Button variant="default" size="sm" data-testid="button-upgrade">
                Upgrade Subscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card data-testid="card-notifications">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure how you receive alerts for portfolio companies, watchlists, and saved searches
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="text-base">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email alerts when new articles match your interests
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={preferences.emailNotifications}
              onCheckedChange={handleEmailNotificationsToggle}
              disabled={updateMutation.isPending}
              data-testid="switch-email-notifications"
            />
          </div>

          {preferences.emailNotifications && (
            <div className="border-t pt-6 space-y-3">
              <Label className="text-base">Alert Frequency</Label>
              <div className="space-y-2">
                {['immediate', 'daily', 'weekly'].map((frequency) => (
                  <label
                    key={frequency}
                    className="flex items-center gap-3 cursor-pointer p-3 rounded-md border hover:bg-muted/50 transition-colors"
                    data-testid={`option-frequency-${frequency}`}
                  >
                    <input
                      type="radio"
                      name="alertFrequency"
                      value={frequency}
                      checked={preferences.alertFrequency === frequency}
                      onChange={(e) => handleAlertFrequencyChange(e.target.value)}
                      disabled={updateMutation.isPending}
                      className="h-4 w-4 text-primary"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{frequency}</p>
                      <p className="text-xs text-muted-foreground">
                        {frequency === 'immediate' && 'Get notified as soon as new articles are published'}
                        {frequency === 'daily' && 'Receive a daily digest of new articles at 9 AM'}
                        {frequency === 'weekly' && 'Get a weekly summary every Monday morning'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card data-testid="card-display">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle>Display Preferences</CardTitle>
          </div>
          <CardDescription>
            Customize how articles and feeds are displayed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-base mb-2 block">Default Category Filters</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Choose which article categories to show by default in your feed
            </p>
            <div className="flex flex-wrap gap-2">
              {['M&A', 'Transactions', 'Operations', 'Technology', 'Regulation', 'Market Analysis'].map((category) => {
                const isActive = preferences.categoriesFilter.includes(category);
                return (
                  <Button
                    key={category}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newFilters = isActive
                        ? preferences.categoriesFilter.filter(c => c !== category)
                        : [...preferences.categoriesFilter, category];
                      const normalizedData = normalizeUserPreferences({
                        categoriesFilter: newFilters,
                      });
                      updateMutation.mutate(normalizedData);
                    }}
                    disabled={updateMutation.isPending}
                    data-testid={`button-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {category}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Data */}
      <Card data-testid="card-privacy">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <CardTitle>Privacy & Data</CardTitle>
          </div>
          <CardDescription>
            Control how your data is used and manage your privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              • Your preferences and watchlists are private to your organization
            </p>
            <p>
              • Article reading history is used to improve AI-powered recommendations
            </p>
            <p>
              • Email alerts are sent only based on your explicitly configured saved searches and watchlists
            </p>
          </div>
          <div className="border-t pt-4">
            <Button variant="outline" size="sm" data-testid="button-export-data">
              Export My Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
