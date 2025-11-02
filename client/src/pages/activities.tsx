import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Calendar, Clock, CheckCircle2, XCircle, Phone, Mail, MessageSquare, Video, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertActivitySchema, type Activity, type ActivityTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, isToday, isPast, isFuture, startOfDay } from "date-fns";

const activityFormSchema = insertActivitySchema.extend({
  scheduledAt: z.string().optional(),
  entityId: z.string().nullable().optional(), // Make entityId nullable for standalone activities
});

type ActivityFormValues = z.infer<typeof activityFormSchema>;

const activityTypeIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: Video,
  note: FileText,
  showing: Calendar,
};

function ActivityComposerModal({ 
  templates, 
  onClose 
}: { 
  templates: ActivityTemplate[]; 
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: "call",
      subject: "",
      description: "",
      status: "completed",
      direction: "outbound",
      entityType: "general",
      entityId: undefined, // Standalone activities don't need an entity
      scheduledAt: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ActivityFormValues) => {
      const data = {
        ...values,
        entityId: values.entityId || null, // Ensure null instead of undefined
        scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
      };
      return apiRequest('/api/activities', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: "Activity created successfully" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create activity", description: error.message, variant: "destructive" });
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      form.setValue("type", template.type);
      form.setValue("subject", template.subjectTemplate || "");
      form.setValue("description", template.descriptionTemplate || "");
      if (template.defaultDuration) {
        form.setValue("duration", template.defaultDuration);
      }
      if (template.defaultDirection) {
        form.setValue("direction", template.defaultDirection);
      }
    }
  };

  const onSubmit = (values: ActivityFormValues) => {
    createMutation.mutate(values);
  };

  return (
    <DialogContent className="max-w-2xl" data-testid="modal-activity-composer">
      <DialogHeader>
        <DialogTitle>Create Activity</DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Template (Optional)</label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger data-testid="select-activity-template">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Activity Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger data-testid="select-activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="showing">Property Showing</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="Activity subject" data-testid="input-activity-subject" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    placeholder="Activity details..." 
                    rows={4}
                    data-testid="textarea-activity-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value || "completed"} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-activity-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="direction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direction</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-activity-direction">
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="scheduledAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scheduled Date/Time</FormLabel>
                <FormControl>
                  <Input 
                    type="datetime-local" 
                    {...field} 
                    value={field.value || ""}
                    data-testid="input-activity-scheduled"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-activity">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-activity">
              {createMutation.isPending ? "Creating..." : "Create Activity"}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  const Icon = activityTypeIcons[activity.type] || FileText;
  
  return (
    <Card className="mb-2" data-testid={`card-activity-${activity.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium" data-testid={`text-activity-subject-${activity.id}`}>
                {activity.subject || activity.type}
              </h4>
              {activity.status === "completed" && (
                <CheckCircle2 className="h-4 w-4 text-green-600" data-testid={`icon-completed-${activity.id}`} />
              )}
              {activity.status === "cancelled" && (
                <XCircle className="h-4 w-4 text-red-600" data-testid={`icon-cancelled-${activity.id}`} />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-activity-description-${activity.id}`}>
              {activity.description}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {activity.scheduledAt && (
                <span className="flex items-center gap-1" data-testid={`text-scheduled-${activity.id}`}>
                  <Clock className="h-3 w-3" />
                  {format(new Date(activity.scheduledAt), "MMM d, yyyy h:mm a")}
                </span>
              )}
              {activity.direction && (
                <span className="capitalize" data-testid={`text-direction-${activity.id}`}>
                  {activity.direction}
                </span>
              )}
              {activity.duration && (
                <span data-testid={`text-duration-${activity.id}`}>{activity.duration} min</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ActivitiesPage() {
  const [showComposer, setShowComposer] = useState(false);

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ['/api/activities'],
  });

  const { data: templates = [] } = useQuery<ActivityTemplate[]>({
    queryKey: ['/api/activity-templates'],
  });

  const now = startOfDay(new Date());

  const overdueActivities = activities.filter(a => 
    a.status === "scheduled" && 
    a.scheduledAt && 
    isPast(new Date(a.scheduledAt)) && 
    !isToday(new Date(a.scheduledAt))
  );

  const todayActivities = activities.filter(a => 
    a.scheduledAt && isToday(new Date(a.scheduledAt))
  );

  const upcomingActivities = activities.filter(a => 
    a.status === "scheduled" && 
    a.scheduledAt && 
    isFuture(new Date(a.scheduledAt)) && 
    !isToday(new Date(a.scheduledAt))
  );

  const completedActivities = activities.filter(a => 
    a.status === "completed" && (!a.scheduledAt || isToday(new Date(a.scheduledAt)))
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="page-activities">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-activities">Activities</h1>
          <p className="text-muted-foreground mt-1">
            Manage your calls, emails, meetings, and more
          </p>
        </div>
        <Dialog open={showComposer} onOpenChange={setShowComposer}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-activity">
              <Plus className="h-4 w-4 mr-2" />
              Create Activity
            </Button>
          </DialogTrigger>
          <ActivityComposerModal templates={templates} onClose={() => setShowComposer(false)} />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue */}
        {overdueActivities.length > 0 && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="h-5 w-5" />
                Overdue ({overdueActivities.length})
              </CardTitle>
            </CardHeader>
            <CardContent data-testid="section-overdue-activities">
              {overdueActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Today */}
        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Calendar className="h-5 w-5" />
              Today ({todayActivities.length})
            </CardTitle>
          </CardHeader>
          <CardContent data-testid="section-today-activities">
            {todayActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activities scheduled for today
              </p>
            ) : (
              todayActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Clock className="h-5 w-5" />
              Upcoming ({upcomingActivities.length})
            </CardTitle>
          </CardHeader>
          <CardContent data-testid="section-upcoming-activities">
            {upcomingActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming activities
              </p>
            ) : (
              upcomingActivities.slice(0, 10).map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Recently Completed */}
        <Card className="border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Recently Completed ({completedActivities.length})
            </CardTitle>
          </CardHeader>
          <CardContent data-testid="section-completed-activities">
            {completedActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No completed activities today
              </p>
            ) : (
              completedActivities.slice(0, 10).map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
