import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Users, CheckCircle2, XCircle, Plus, Trash2, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Contact, NotificationSubscription } from "@shared/schema";

const subscriptionSchema = z.object({
  recipientType: z.enum(["user", "contact"]),
  recipientId: z.string().min(1, "Please select a recipient"),
  channels: z.array(z.enum(["email", "sms"])).min(1, "Please select at least one channel"),
  events: z.array(z.enum(["task_status", "note_added", "deadline_upcoming", "deadline_today", "overdue"])).min(1, "Please select at least one event type"),
  leadTimesDays: z.array(z.number()).min(1, "Please select at least one lead time"),
});

type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

interface SubscriptionManagerProps {
  projectId: string;
  contacts: Contact[];
  subscriptions: NotificationSubscription[];
  isLoading: boolean;
}

const eventTypes = [
  { value: "task_status", label: "Task Status Changes", description: "When tasks change status (not started → in progress → completed)" },
  { value: "note_added", label: "Note Additions", description: "When new notes are added to tasks" },
  { value: "deadline_upcoming", label: "Deadline Alerts", description: "Advance warnings before task deadlines" },
  { value: "deadline_today", label: "Due Today", description: "Tasks that are due today" },
  { value: "overdue", label: "Overdue Tasks", description: "Tasks that have passed their deadline" },
];

const leadTimes = [
  { value: 7, label: "7 days before" },
  { value: 3, label: "3 days before" },
  { value: 1, label: "1 day before" },
  { value: 0, label: "Day of deadline" },
  { value: -1, label: "1 day after (overdue)" },
];

const channels = [
  { value: "email", label: "Email", icon: Bell },
  { value: "sms", label: "SMS", icon: Bell },
];

export function SubscriptionManager({ projectId, contacts, subscriptions, isLoading }: SubscriptionManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRecipientType, setSelectedRecipientType] = useState<"user" | "contact">("contact");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      recipientType: "contact",
      recipientId: "",
      channels: ["email"],
      events: ["deadline_upcoming", "deadline_today", "overdue"],
      leadTimesDays: [7, 3, 1, 0, -1],
    },
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: SubscriptionFormData) => {
      const response = await apiRequest("POST", "/api/dd/subscriptions", {
        projectId,
        ...data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'subscriptions'] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Notification subscription created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create subscription",
        variant: "destructive",
      });
    },
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NotificationSubscription> }) => {
      const response = await apiRequest("PUT", `/api/dd/subscriptions/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'subscriptions'] });
      toast({
        title: "Success",
        description: "Subscription updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update subscription",
        variant: "destructive",
      });
    },
  });

  // Delete subscription mutation
  const deleteSubscriptionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/dd/subscriptions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'subscriptions'] });
      toast({
        title: "Success",
        description: "Subscription deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete subscription",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: SubscriptionFormData) => {
    createSubscriptionMutation.mutate(data);
  };

  const handleToggleActive = (subscription: NotificationSubscription) => {
    updateSubscriptionMutation.mutate({
      id: subscription.id,
      updates: { active: !subscription.active },
    });
  };

  const handleDeleteSubscription = (subscriptionId: string) => {
    deleteSubscriptionMutation.mutate(subscriptionId);
  };

  const getContactName = (recipientType: string, recipientId: string) => {
    if (recipientType === "contact") {
      const contact = contacts.find(c => c.id === recipientId);
      return contact?.name || "Unknown Contact";
    }
    return "Team Member"; // For users
  };

  const getContactEmail = (recipientType: string, recipientId: string) => {
    if (recipientType === "contact") {
      const contact = contacts.find(c => c.id === recipientId);
      return contact?.email || "";
    }
    return ""; // For users
  };

  const activeSubscriptions = subscriptions.filter(sub => sub.active);
  const inactiveSubscriptions = subscriptions.filter(sub => !sub.active);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse"></div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="subscription-manager">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Bell className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <span className="text-lg font-semibold">Active Subscriptions</span>
              <Badge variant="secondary" className="ml-3 bg-green-50 text-green-700 border-green-200" data-testid="badge-active-count">
                {activeSubscriptions.length} active
              </Badge>
            </div>
          </div>
          {inactiveSubscriptions.length > 0 && (
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <BellOff className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <span className="text-sm text-muted-foreground font-medium">Inactive</span>
                <Badge variant="outline" className="ml-2 text-gray-500" data-testid="badge-inactive-count">
                  {inactiveSubscriptions.length}
                </Badge>
              </div>
            </div>
          )}
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 shadow-sm" data-testid="button-add-subscription">
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl" data-testid="dialog-add-subscription">
            <DialogHeader>
              <DialogTitle>Create Notification Subscription</DialogTitle>
              <DialogDescription>
                Set up notifications for a contact or team member for this project.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="recipientType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient Type</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedRecipientType(value as "user" | "contact");
                            form.setValue("recipientId", "");
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-recipient-type">
                              <SelectValue placeholder="Select recipient type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="contact">External Contact</SelectItem>
                            <SelectItem value="user">Team Member</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recipientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {selectedRecipientType === "contact" ? "Contact" : "Team Member"}
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-recipient">
                              <SelectValue placeholder={`Select ${selectedRecipientType}`} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedRecipientType === "contact" ? (
                              contacts.map((contact) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.name} ({contact.email})
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="user-1">Team Member (Demo)</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="channels"
                  render={() => (
                    <FormItem>
                      <FormLabel>Notification Channels</FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {channels.map((channel) => (
                          <FormField
                            key={channel.value}
                            control={form.control}
                            name="channels"
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
                                    data-testid={`checkbox-channel-${channel.value}`}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-normal">
                                    {channel.label}
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

                <FormField
                  control={form.control}
                  name="events"
                  render={() => (
                    <FormItem>
                      <FormLabel>Event Types</FormLabel>
                      <div className="space-y-3">
                        {eventTypes.map((eventType) => (
                          <FormField
                            key={eventType.value}
                            control={form.control}
                            name="events"
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
                                    data-testid={`checkbox-event-${eventType.value}`}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-normal">
                                    {eventType.label}
                                  </FormLabel>
                                  <p className="text-xs text-muted-foreground">
                                    {eventType.description}
                                  </p>
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

                <FormField
                  control={form.control}
                  name="leadTimesDays"
                  render={() => (
                    <FormItem>
                      <FormLabel>Lead Times</FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {leadTimes.map((leadTime) => (
                          <FormField
                            key={leadTime.value}
                            control={form.control}
                            name="leadTimesDays"
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
                                    data-testid={`checkbox-lead-time-${leadTime.value}`}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-xs font-normal">
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

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createSubscriptionMutation.isPending}
                    data-testid="button-create-subscription"
                  >
                    {createSubscriptionMutation.isPending ? "Creating..." : "Create Subscription"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Active Subscriptions</h3>
          </div>
          <div className="grid gap-4" data-testid="active-subscriptions-list">
            {activeSubscriptions.map((subscription) => (
              <Card key={subscription.id} className="hover:shadow-md transition-all duration-200 border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/30 to-white" data-testid={`subscription-card-${subscription.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <span className="font-semibold text-lg" data-testid={`subscription-recipient-${subscription.id}`}>
                              {getContactName(subscription.recipientType, subscription.recipientId)}
                            </span>
                            <Badge variant="outline" className="ml-3 text-xs font-medium">
                              {subscription.recipientType === 'contact' ? 'External Contact' : 'Team Member'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-foreground">Channels</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {subscription.channels.map((channel) => (
                              <Badge key={channel} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                {channel.toUpperCase()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Bell className="h-4 w-4 text-purple-500" />
                            <span className="font-medium text-foreground">Events</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {subscription.events.map((event) => (
                              <Badge key={event} variant="outline" className="text-xs border-purple-200 text-purple-700">
                                {eventTypes.find(et => et.value === event)?.label || event}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            <span className="font-medium text-foreground">Lead Times</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {subscription.leadTimesDays.map((days) => (
                              <Badge key={days} variant="outline" className="text-xs border-orange-200 text-orange-700">
                                {leadTimes.find(lt => lt.value === days)?.label || `${days}d`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      {getContactEmail(subscription.recipientType, subscription.recipientId) && (
                        <div className="text-sm text-muted-foreground mt-4 p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4" />
                            <span className="font-medium">Email:</span>
                            <span>{getContactEmail(subscription.recipientType, subscription.recipientId)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-3 ml-6">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-muted-foreground">Active</span>
                        <Switch
                          checked={subscription.active}
                          onCheckedChange={() => handleToggleActive(subscription)}
                          data-testid={`switch-active-${subscription.id}`}
                        />
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-subscription-${subscription.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this notification subscription? 
                              {getContactName(subscription.recipientType, subscription.recipientId)} will no longer receive these notifications.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSubscription(subscription.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Subscription
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Subscriptions */}
      {inactiveSubscriptions.length > 0 && (
        <>
          <Separator className="my-8" />
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <XCircle className="h-5 w-5 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-muted-foreground">Inactive Subscriptions</h3>
            </div>
            <div className="grid gap-4" data-testid="inactive-subscriptions-list">
              {inactiveSubscriptions.map((subscription) => (
                <Card key={subscription.id} className="opacity-70 hover:opacity-90 transition-all duration-200 border-l-4 border-l-gray-400 bg-gradient-to-r from-gray-50/30 to-white" data-testid={`inactive-subscription-card-${subscription.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <Users className="h-4 w-4 text-gray-500" />
                            </div>
                            <div>
                              <span className="font-semibold text-lg text-muted-foreground">
                                {getContactName(subscription.recipientType, subscription.recipientId)}
                              </span>
                              <Badge variant="outline" className="ml-3 text-xs font-medium border-gray-300">
                                {subscription.recipientType === 'contact' ? 'External Contact' : 'Team Member'}
                              </Badge>
                              <Badge variant="secondary" className="ml-2 text-xs bg-gray-100 text-gray-600">
                                Inactive
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-3 ml-6">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-muted-foreground">Active</span>
                          <Switch
                            checked={subscription.active}
                            onCheckedChange={() => handleToggleActive(subscription)}
                            data-testid={`switch-inactive-${subscription.id}`}
                          />
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-inactive-${subscription.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this notification subscription?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSubscription(subscription.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Subscription
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {subscriptions.length === 0 && (
        <div className="text-center py-16" data-testid="empty-subscriptions">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
            <Bell className="h-10 w-10 text-blue-600" />
          </div>
          <h3 className="text-2xl font-semibold mb-3 text-foreground">No Notification Subscriptions</h3>
          <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
            Set up your first notification subscription to keep stakeholders informed about project progress and deadlines.
          </p>
          <Button 
            onClick={() => setIsAddDialogOpen(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg shadow-sm"
            data-testid="button-add-first-subscription"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Your First Subscription
          </Button>
        </div>
      )}
    </div>
  );
}