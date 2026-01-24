import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, BellRing, Check, Clock, Plus, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadlineDays: number | null;
}

interface NotificationRule {
  id: string;
  name: string;
  triggerType: string;
  triggerCondition: Record<string, any>;
  actionConfig: Record<string, any>;
  isActive: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface MilestoneSettingsResponse {
  milestones: Milestone[];
  notificationRules: NotificationRule[];
}

interface DDMilestoneNotificationSettingsProps {
  projectId: string;
}

export function DDMilestoneNotificationSettings({ projectId }: DDMilestoneNotificationSettingsProps) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [daysBefore, setDaysBefore] = useState<number>(3);
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<MilestoneSettingsResponse>({
    queryKey: ["/api/dd/automation/projects", projectId, "milestone-settings"],
  });

  const { data: assignees = [] } = useQuery<User[]>({
    queryKey: ["/api/dd/automation/assignees"],
  });

  const configureMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/dd/automation/projects/${projectId}/milestone-settings`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/automation/projects", projectId, "milestone-settings"] });
      setIsConfiguring(false);
      setSelectedMilestone(null);
      toast({
        title: "Notification Settings Saved",
        description: `Created ${data.rulesCreated} notification rules`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ milestoneId, userIds, message }: { milestoneId: string; userIds?: string[]; message?: string }) => {
      return await apiRequest(`/api/dd/automation/projects/${projectId}/milestones/${milestoneId}/notify`, {
        method: "POST",
        body: JSON.stringify({ userIds, message }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Notifications Sent",
        description: `Sent ${data.notificationsSent} notifications`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send notifications",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfigureSubmit = () => {
    if (!selectedMilestone) return;
    
    configureMutation.mutate({
      milestoneId: selectedMilestone.id,
      notifyUserIds: selectedUserIds,
      notifyOnComplete,
      daysBefore: daysBefore > 0 ? daysBefore : null,
    });
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getMilestoneRules = (milestoneId: string) => {
    return settings?.notificationRules.filter(
      rule => rule.triggerCondition?.milestoneId === milestoneId
    ) || [];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Milestone Notifications
            </CardTitle>
            <CardDescription>
              Configure notifications for milestone events
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading milestones...</div>
        ) : !settings?.milestones || settings.milestones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No milestones found in this project.</p>
            <p className="text-sm mt-2">Apply a checklist template to add milestones.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {settings.milestones.map((milestone) => {
              const rules = getMilestoneRules(milestone.id);
              const hasNotifications = rules.length > 0;
              
              return (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{milestone.title}</span>
                      {milestone.status === "completed" && (
                        <Badge variant="default" className="text-xs bg-green-500">
                          <Check className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                      {hasNotifications && (
                        <Badge variant="secondary" className="text-xs">
                          <Bell className="h-3 w-3 mr-1" />
                          {rules.length} rules
                        </Badge>
                      )}
                    </div>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {milestone.description}
                      </p>
                    )}
                    {milestone.deadlineDays && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {milestone.deadlineDays} days from start
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={isConfiguring && selectedMilestone?.id === milestone.id} onOpenChange={(open) => {
                      if (!open) {
                        setIsConfiguring(false);
                        setSelectedMilestone(null);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedMilestone(milestone);
                            setIsConfiguring(true);
                          }}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Configure Notifications</DialogTitle>
                          <DialogDescription>
                            Set up notifications for "{milestone.title}"
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-3">
                            <Label>Notify These Users</Label>
                            <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-3">
                              {assignees.map((user) => (
                                <div key={user.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`user-${user.id}`}
                                    checked={selectedUserIds.includes(user.id)}
                                    onCheckedChange={() => handleUserToggle(user.id)}
                                  />
                                  <label
                                    htmlFor={`user-${user.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {user.name} <span className="text-muted-foreground">({user.email})</span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Label htmlFor="notify-complete">Notify when completed</Label>
                            <Switch
                              id="notify-complete"
                              checked={notifyOnComplete}
                              onCheckedChange={setNotifyOnComplete}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="days-before">Notify days before deadline</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="days-before"
                                type="number"
                                min="0"
                                max="30"
                                value={daysBefore}
                                onChange={(e) => setDaysBefore(parseInt(e.target.value) || 0)}
                                className="w-20"
                              />
                              <span className="text-sm text-muted-foreground">days before deadline</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Set to 0 to disable deadline reminders
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsConfiguring(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleConfigureSubmit}
                            disabled={configureMutation.isPending || selectedUserIds.length === 0}
                          >
                            {configureMutation.isPending ? "Saving..." : "Save Settings"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendNotificationMutation.mutate({ milestoneId: milestone.id })}
                      disabled={sendNotificationMutation.isPending}
                      title="Send notification now"
                    >
                      <Bell className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
