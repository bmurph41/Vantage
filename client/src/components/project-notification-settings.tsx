import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Clock, Mail, Bell, BellOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectSettings } from "@shared/schema";

const settingsSchema = z.object({
  notificationsEnabled: z.boolean(),
  defaultChannels: z.array(z.enum(["email", "sms"])).min(1, "Please select at least one channel"),
  defaultEvents: z.array(z.enum(["task_status", "note_added", "deadline_upcoming", "deadline_today", "overdue"])).min(1, "Please select at least one event"),
  defaultLeadTimesDays: z.array(z.number()).min(1, "Please select at least one lead time"),
  quietHoursStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)"),
  quietHoursEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)"),
  weekendNotifications: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface ProjectNotificationSettingsProps {
  projectId: string;
  settings?: ProjectSettings | null;
}

const eventTypes = [
  { value: "task_status", label: "Task Status Changes", description: "When tasks change status" },
  { value: "note_added", label: "Note Additions", description: "When new notes are added to tasks" },
  { value: "deadline_upcoming", label: "Deadline Alerts", description: "Advance warnings before task deadlines" },
  { value: "deadline_today", label: "Due Today", description: "Tasks that are due today" },
  { value: "overdue", label: "Overdue Tasks", description: "Tasks that have passed their deadline" },
];

const leadTimes = [
  { value: 7, label: "7 days before deadline" },
  { value: 3, label: "3 days before deadline" },
  { value: 1, label: "1 day before deadline" },
  { value: 0, label: "Day of deadline" },
  { value: -1, label: "1 day after deadline (overdue)" },
];

const channels = [
  { value: "email", label: "Email", description: "Send notifications via email" },
  { value: "sms", label: "SMS", description: "Send notifications via text message" },
];

export function ProjectNotificationSettings({ projectId, settings }: ProjectNotificationSettingsProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      notificationsEnabled: settings?.notificationsEnabled ?? true,
      defaultChannels: settings?.defaultChannels || ["email"],
      defaultEvents: settings?.defaultEvents || ["deadline_upcoming", "deadline_today", "overdue"],
      defaultLeadTimesDays: settings?.defaultLeadTimesDays || [7, 3, 1, 0, -1],
      quietHoursStart: settings?.quietHoursStart || "22:00",
      quietHoursEnd: settings?.quietHoursEnd || "08:00",
      weekendNotifications: settings?.weekendNotifications ?? false,
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const response = await apiRequest("PATCH", `/api/dd/projects/${projectId}/settings`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId] });
      setHasUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Notification settings updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const handleFormChange = () => {
    if (!hasUnsavedChanges) {
      setHasUnsavedChanges(true);
    }
  };

  const notificationsEnabled = form.watch("notificationsEnabled");

  return (
    <div className="space-y-6" data-testid="project-notification-settings">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} onChange={handleFormChange} className="space-y-8">
          {/* Master Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Global Settings</span>
              </CardTitle>
              <CardDescription>
                Configure the overall notification behavior for this project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="notificationsEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center space-x-2">
                        {field.value ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                        <span>Enable Notifications</span>
                      </FormLabel>
                      <FormDescription>
                        Turn notifications on or off for this entire project
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-notifications-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Default Preferences */}
          <Card className={!notificationsEnabled ? "opacity-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Default Notification Preferences</span>
              </CardTitle>
              <CardDescription>
                These settings will be used as defaults when creating new notification subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="defaultChannels"
                render={() => (
                  <FormItem>
                    <FormLabel>Default Notification Channels</FormLabel>
                    <div className="space-y-3">
                      {channels.map((channel) => (
                        <FormField
                          key={channel.value}
                          control={form.control}
                          name="defaultChannels"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(channel.value as any)}
                                  onCheckedChange={(checked) => {
                                    const currentChannels = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentChannels, channel.value]);
                                    } else {
                                      field.onChange(currentChannels.filter((c) => c !== channel.value));
                                    }
                                  }}
                                  disabled={!notificationsEnabled}
                                  data-testid={`checkbox-default-channel-${channel.value}`}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-normal">
                                  {channel.label}
                                </FormLabel>
                                <FormDescription className="text-xs">
                                  {channel.description}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="defaultEvents"
                render={() => (
                  <FormItem>
                    <FormLabel>Default Event Types</FormLabel>
                    <div className="space-y-3">
                      {eventTypes.map((eventType) => (
                        <FormField
                          key={eventType.value}
                          control={form.control}
                          name="defaultEvents"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(eventType.value as any)}
                                  onCheckedChange={(checked) => {
                                    const currentEvents = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentEvents, eventType.value]);
                                    } else {
                                      field.onChange(currentEvents.filter((e) => e !== eventType.value));
                                    }
                                  }}
                                  disabled={!notificationsEnabled}
                                  data-testid={`checkbox-default-event-${eventType.value}`}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-normal">
                                  {eventType.label}
                                </FormLabel>
                                <FormDescription className="text-xs">
                                  {eventType.description}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="defaultLeadTimesDays"
                render={() => (
                  <FormItem>
                    <FormLabel>Default Lead Times</FormLabel>
                    <FormDescription className="text-sm text-muted-foreground mb-3">
                      When to send deadline notifications relative to the due date
                    </FormDescription>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {leadTimes.map((leadTime) => (
                        <FormField
                          key={leadTime.value}
                          control={form.control}
                          name="defaultLeadTimesDays"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(leadTime.value)}
                                  onCheckedChange={(checked) => {
                                    const currentLeadTimes = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentLeadTimes, leadTime.value]);
                                    } else {
                                      field.onChange(currentLeadTimes.filter((lt) => lt !== leadTime.value));
                                    }
                                  }}
                                  disabled={!notificationsEnabled}
                                  data-testid={`checkbox-default-lead-time-${leadTime.value}`}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-normal">
                                  {leadTime.label}
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Timing Settings */}
          <Card className={!notificationsEnabled ? "opacity-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Timing & Scheduling</span>
              </CardTitle>
              <CardDescription>
                Control when notifications are sent to respect recipients' schedules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quietHoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quiet Hours Start</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field} 
                          disabled={!notificationsEnabled}
                          data-testid="input-quiet-hours-start"
                        />
                      </FormControl>
                      <FormDescription>
                        Notifications won't be sent after this time
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quietHoursEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quiet Hours End</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field} 
                          disabled={!notificationsEnabled}
                          data-testid="input-quiet-hours-end"
                        />
                      </FormControl>
                      <FormDescription>
                        Notifications resume after this time
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weekendNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Weekend Notifications
                      </FormLabel>
                      <FormDescription>
                        Allow notifications to be sent on weekends (Saturday and Sunday)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!notificationsEnabled}
                        data-testid="switch-weekend-notifications"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end space-x-3">
            {hasUnsavedChanges && (
              <div className="flex items-center text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                You have unsaved changes
              </div>
            )}
            <Button 
              type="submit" 
              disabled={updateSettingsMutation.isPending || !notificationsEnabled}
              data-testid="button-save-settings"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}