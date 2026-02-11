import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, Check, X, Download, Loader2, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const calendarSettingsSchema = z.object({
  syncEnabled: z.boolean(),
  defaultCalendarId: z.string(),
  syncActivities: z.boolean(),
  syncTasks: z.boolean(),
  reminderMinutes: z.number().min(0).max(1440),
});

type CalendarSettingsForm = z.infer<typeof calendarSettingsSchema>;

export default function CalendarSettings() {
  const { toast } = useToast();

  // Check if Google Calendar is connected
  const { data: connectionStatus, isLoading: statusLoading } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/calendar/status"],
  });

  // Get user's calendar settings
  const { data: settings, isLoading: settingsLoading } = useQuery<CalendarSettingsForm>({
    queryKey: ["/api/calendar/settings"],
    enabled: !!connectionStatus?.connected,
  });

  // Get available calendars
  const { data: calendars = [], isLoading: calendarsLoading } = useQuery<any[]>({
    queryKey: ["/api/calendar/calendars"],
    enabled: !!(connectionStatus?.connected && settings?.syncEnabled),
  });

  const form = useForm<CalendarSettingsForm>({
    resolver: zodResolver(calendarSettingsSchema),
    values: settings || {
      syncEnabled: false,
      defaultCalendarId: "primary",
      syncActivities: true,
      syncTasks: true,
      reminderMinutes: 15,
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: CalendarSettingsForm) => {
      return await apiRequest("/api/calendar/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/settings"] });
      toast({
        title: "Settings updated",
        description: "Your calendar sync settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update calendar settings.",
        variant: "destructive",
      });
    },
  });

  const handleExportActivities = async () => {
    try {
      window.open("/api/calendar/export/activities.ics", "_blank");
      toast({
        title: "Export started",
        description: "Your activities ICS file will download shortly.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export activities.",
        variant: "destructive",
      });
    }
  };

  const handleExportTasks = async () => {
    try {
      window.open("/api/calendar/export/tasks.ics", "_blank");
      toast({
        title: "Export started",
        description: "Your tasks ICS file will download shortly.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export tasks.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: CalendarSettingsForm) => {
    updateSettingsMutation.mutate(data);
  };

  if (statusLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4" data-testid="page-calendar-settings">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-8 w-8" />
          Calendar Integration
        </h1>
        <p className="text-muted-foreground mt-2">
          Sync your CRM activities and due diligence tasks with Google Calendar
        </p>
      </div>

      {/* Connection Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {connectionStatus?.connected ? (
              <>
                <Check className="h-5 w-5 text-green-600" />
                <span className="font-medium">Google Calendar Connected</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Active
                </Badge>
              </>
            ) : (
              <>
                <X className="h-5 w-5 text-red-600" />
                <span className="font-medium">Google Calendar Not Connected</span>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  Inactive
                </Badge>
              </>
            )}
          </div>
          {!connectionStatus?.connected && (
            <p className="text-sm text-muted-foreground mt-3">
              Please connect your Google Calendar through the Replit integrations panel to enable sync.
            </p>
          )}
        </CardContent>
      </Card>

      {connectionStatus?.connected && (
        <>
          {/* Sync Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>
                Configure which items to sync and set default preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="syncEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Calendar Sync</FormLabel>
                          <FormDescription>
                            Automatically sync activities and tasks to Google Calendar
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-sync-enabled"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <FormField
                    control={form.control}
                    name="defaultCalendarId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Calendar</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!form.watch("syncEnabled") || calendarsLoading}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-default-calendar">
                              <SelectValue placeholder="Select calendar" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="primary">Primary Calendar</SelectItem>
                            {calendars.map((cal) => (
                              <SelectItem key={cal.id} value={cal.id}>
                                {cal.summary}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose which calendar to sync your events to
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="syncActivities"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Sync CRM Activities</FormLabel>
                          <FormDescription>
                            Sync meetings, calls, and scheduled activities
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch("syncEnabled")}
                            data-testid="switch-sync-activities"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="syncTasks"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Sync DD Tasks</FormLabel>
                          <FormDescription>
                            Sync due diligence tasks with due dates
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch("syncEnabled")}
                            data-testid="switch-sync-tasks"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reminderMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Reminder</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                          disabled={!form.watch("syncEnabled")}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-reminder-minutes">
                              <SelectValue placeholder="Select reminder time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">No reminder</SelectItem>
                            <SelectItem value="5">5 minutes before</SelectItem>
                            <SelectItem value="15">15 minutes before</SelectItem>
                            <SelectItem value="30">30 minutes before</SelectItem>
                            <SelectItem value="60">1 hour before</SelectItem>
                            <SelectItem value="1440">1 day before</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Set default reminder time for synced events
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    data-testid="button-save-settings"
                  >
                    {updateSettingsMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Settings
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* ICS Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export to ICS
              </CardTitle>
              <CardDescription>
                Download ICS files for importing into Outlook, Apple Calendar, or other calendar apps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={handleExportActivities}
                  className="flex-1"
                  data-testid="button-export-activities"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CRM Activities
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportTasks}
                  className="flex-1"
                  data-testid="button-export-tasks"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export DD Tasks
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                ICS files can be imported into most calendar applications. After downloading, use your calendar app's import feature to add these events.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
