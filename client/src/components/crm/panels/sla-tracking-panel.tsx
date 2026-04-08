import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Timer,
  Users,
  Settings,
  TrendingUp,
  Plus,
  ArrowUp,
  RefreshCw,
  UserPlus,
  Check,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow, format, differenceInHours } from 'date-fns';

interface SlaConfig {
  id: string;
  name: string;
  description?: string;
  targetType: string;
  matchCriteria: {
    taskTypes?: string[];
    priorities?: string[];
    categories?: string[];
    dealStages?: string[];
  };
  warningThresholdHours: number;
  criticalThresholdHours: number;
  breachThresholdHours: number;
  escalationChain: string[];
  escalationDelayHours: number;
  autoAssignEnabled: boolean;
  autoAssignRules: {
    roundRobin?: boolean;
    assigneePool?: string[];
    assignByWorkload?: boolean;
  };
  status: string;
  createdAt: string;
  creator?: { firstName?: string; lastName?: string };
}

interface SlaTracking {
  id: string;
  slaConfigId: string;
  entityType: string;
  entityId: string;
  slaStartTime: string;
  slaDueTime: string;
  warningTime?: string;
  criticalTime?: string;
  currentStatus: string;
  currentEscalationLevel: number;
  currentAssigneeId?: string;
  escalationCount: number;
  reassignmentCount: number;
  resolvedAt?: string;
  config?: { id: string; name: string; targetType: string };
  currentAssignee?: { firstName?: string; lastName?: string; email?: string };
}

interface SlaSummary {
  total: number;
  byStatus: {
    on_track: number;
    warning: number;
    critical: number;
    breached: number;
  };
  byEntityType: Record<string, number>;
  upcomingDeadlines: (SlaTracking & { hoursUntilDue: number })[];
  breached: SlaTracking[];
}

interface SlaMetrics {
  totalResolved: number;
  avgResolutionTime: number;
  avgFirstResponseTime: number;
  slaComplianceRate: number;
  avgEscalations: number;
  avgReassignments: number;
  byStatus: {
    on_time: number;
    breached: number;
  };
}

const statusConfig = {
  on_track: { label: 'On Track', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  warning: { label: 'Warning', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertTriangle },
  critical: { label: 'Critical', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
  breached: { label: 'Breached', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
};

const entityTypeLabels: Record<string, string> = {
  dd_task: 'DD Task',
  crm_task: 'CRM Task',
  activity: 'Activity',
  all: 'All Tasks',
};

interface SlaTrackingPanelProps {
  entityType?: string;
  entityId?: string;
}

export function SlaTrackingPanel({ entityType, entityId }: SlaTrackingPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [selectedTracking, setSelectedTracking] = useState<SlaTracking | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [newConfig, setNewConfig] = useState({
    name: '',
    description: '',
    targetType: 'all',
    warningThresholdHours: 24,
    criticalThresholdHours: 48,
    breachThresholdHours: 72,
    escalationDelayHours: 4,
    autoAssignEnabled: false,
  });

  const invalidateAllSlaQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/sla/configs'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sla/tracking'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sla/tracking/my-slas'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sla/summary'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sla/metrics'] });
  };

  const configsQuery = useQuery<SlaConfig[]>({
    queryKey: ['/api/sla/configs'],
  });

  const trackingQuery = useQuery<SlaTracking[]>({
    queryKey: ['/api/sla/tracking'],
  });

  const mySlaQuery = useQuery<SlaTracking[]>({
    queryKey: ['/api/sla/tracking/my-slas'],
  });

  const summaryQuery = useQuery<SlaSummary>({
    queryKey: ['/api/sla/summary'],
  });

  const metricsQuery = useQuery<SlaMetrics>({
    queryKey: ['/api/sla/metrics'],
  });

  const createConfigMutation = useMutation({
    mutationFn: async (data: typeof newConfig) => {
      return apiRequest('/api/sla/configs', { method: 'POST', body: data });
    },
    onSuccess: () => {
      invalidateAllSlaQueries();
      toast({ title: 'SLA config created' });
      setIsCreatingConfig(false);
      setNewConfig({
        name: '',
        description: '',
        targetType: 'all',
        warningThresholdHours: 24,
        criticalThresholdHours: 48,
        breachThresholdHours: 72,
        escalationDelayHours: 4,
        autoAssignEnabled: false,
      });
    },
    onError: () => {
      toast({ title: 'Failed to create config', variant: 'destructive' });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ trackingId, toUserId }: { trackingId: string; toUserId: string }) => {
      return apiRequest(`/api/sla/tracking/${trackingId}/assign`, {
        method: 'POST',
        body: { toUserId, reason: 'manual' },
      });
    },
    onSuccess: () => {
      invalidateAllSlaQueries();
      toast({ title: 'Task assigned' });
      setSelectedTracking(null);
      setAssigneeId('');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ trackingId, notes }: { trackingId: string; notes: string }) => {
      return apiRequest(`/api/sla/tracking/${trackingId}/resolve`, {
        method: 'POST',
        body: { resolutionNotes: notes },
      });
    },
    onSuccess: () => {
      invalidateAllSlaQueries();
      toast({ title: 'SLA resolved' });
      setSelectedTracking(null);
      setResolutionNotes('');
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ trackingId, escalateToId }: { trackingId: string; escalateToId: string }) => {
      return apiRequest(`/api/sla/tracking/${trackingId}/escalate`, {
        method: 'POST',
        body: { escalateToId, reason: 'Manual escalation' },
      });
    },
    onSuccess: () => {
      invalidateAllSlaQueries();
      toast({ title: 'SLA escalated' });
    },
  });

  const checkSlaMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/sla/check-slas', { method: 'POST' });
    },
    onSuccess: (data: any) => {
      invalidateAllSlaQueries();
      toast({ title: `Checked ${data.checked} SLAs, updated ${data.updated}, escalated ${data.escalated}` });
    },
  });

  const summary = summaryQuery.data;
  const metrics = metricsQuery.data;
  const trackings = trackingQuery.data || [];
  const mySlas = mySlaQuery.data || [];
  const configs = configsQuery.data || [];

  const getTimeRemaining = (dueTime: string) => {
    const now = new Date();
    const due = new Date(dueTime);
    const hoursRemaining = differenceInHours(due, now);
    
    if (hoursRemaining < 0) {
      return { text: `${Math.abs(hoursRemaining)}h overdue`, isOverdue: true };
    }
    return { text: `${hoursRemaining}h remaining`, isOverdue: false };
  };

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.on_track;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderTrackingCard = (tracking: SlaTracking) => {
    const timeInfo = getTimeRemaining(tracking.slaDueTime);
    
    return (
      <Card
        key={tracking.id}
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setSelectedTracking(tracking)}
        data-testid={`sla-tracking-card-${tracking.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {renderStatusBadge(tracking.currentStatus)}
                <Badge variant="outline">{entityTypeLabels[tracking.entityType] || tracking.entityType}</Badge>
              </div>
              <p className="text-sm font-medium">{tracking.config?.name || 'Unknown SLA'}</p>
              <p className="text-xs text-muted-foreground">
                Entity: {tracking.entityId.slice(0, 8)}...
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${timeInfo.isOverdue ? 'text-red-600' : ''}`}>
                {timeInfo.text}
              </p>
              <p className="text-xs text-muted-foreground">
                Due: {format(new Date(tracking.slaDueTime), 'MMM d, h:mm a')}
              </p>
              {tracking.currentAssignee && (
                <p className="text-xs text-muted-foreground mt-1">
                  {tracking.currentAssignee.firstName} {tracking.currentAssignee.lastName}
                </p>
              )}
            </div>
          </div>
          {(tracking.escalationCount > 0 || tracking.reassignmentCount > 0) && (
            <div className="flex items-center gap-4 mt-2 pt-2 border-t">
              {tracking.escalationCount > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  {tracking.escalationCount} escalation(s)
                </span>
              )}
              {tracking.reassignmentCount > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {tracking.reassignmentCount} reassignment(s)
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="h-6 w-6" />
            SLA Tracking
          </h2>
          <p className="text-muted-foreground">Monitor deadlines and task routing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkSlaMutation.mutate()}
            disabled={checkSlaMutation.isPending}
            data-testid="button-check-slas"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checkSlaMutation.isPending ? 'animate-spin' : ''}`} />
            Check SLAs
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreatingConfig(true)}
            data-testid="button-create-sla-config"
          >
            <Plus className="h-4 w-4 mr-2" />
            New SLA Config
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">Active SLAs</TabsTrigger>
          <TabsTrigger value="my-slas" data-testid="tab-my-slas">My SLAs</TabsTrigger>
          <TabsTrigger value="configs" data-testid="tab-configs">Configurations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">On Track</p>
                        <p className="text-2xl font-bold text-green-600">{summary.byStatus.on_track}</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Warning</p>
                        <p className="text-2xl font-bold text-yellow-600">{summary.byStatus.warning}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Critical</p>
                        <p className="text-2xl font-bold text-orange-600">{summary.byStatus.critical}</p>
                      </div>
                      <AlertCircle className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Breached</p>
                        <p className="text-2xl font-bold text-red-600">{summary.byStatus.breached}</p>
                      </div>
                      <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {metrics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{metrics.slaComplianceRate}%</p>
                        <p className="text-xs text-muted-foreground">Compliance Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{Math.round(metrics.avgResolutionTime / 60)}h</p>
                        <p className="text-xs text-muted-foreground">Avg Resolution</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{Math.round(metrics.avgFirstResponseTime / 60)}h</p>
                        <p className="text-xs text-muted-foreground">Avg First Response</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{metrics.totalResolved}</p>
                        <p className="text-xs text-muted-foreground">Total Resolved</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{metrics.avgEscalations}</p>
                        <p className="text-xs text-muted-foreground">Avg Escalations</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{metrics.avgReassignments}</p>
                        <p className="text-xs text-muted-foreground">Avg Reassignments</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {summary.upcomingDeadlines.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Upcoming Deadlines (24h)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summary.upcomingDeadlines.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(item.currentStatus)}
                            <span className="text-sm">{item.config?.name || 'Unknown'}</span>
                          </div>
                          <span className="text-sm font-medium text-orange-600">
                            {item.hoursUntilDue}h remaining
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="active">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3 pr-4">
              {trackings.filter(t => !t.resolvedAt).map(renderTrackingCard)}
              {trackings.filter(t => !t.resolvedAt).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Timer className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No active SLA trackings</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="my-slas">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3 pr-4">
              {mySlas.map(renderTrackingCard)}
              {mySlas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No SLAs assigned to you</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="configs">
          <div className="space-y-3">
            {configs.map((config) => (
              <Card key={config.id} data-testid={`sla-config-card-${config.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{config.name}</h3>
                        <Badge variant={config.status === 'active' ? 'default' : 'secondary'}>
                          {config.status}
                        </Badge>
                      </div>
                      {config.description && (
                        <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Target: {entityTypeLabels[config.targetType]}</span>
                        <span>Warning: {config.warningThresholdHours}h</span>
                        <span>Critical: {config.criticalThresholdHours}h</span>
                        <span>Breach: {config.breachThresholdHours}h</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.autoAssignEnabled && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <UserPlus className="h-3 w-3" />
                          Auto-assign
                        </Badge>
                      )}
                      <Settings className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {configs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No SLA configurations yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setIsCreatingConfig(true)}
                >
                  Create First Config
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreatingConfig} onOpenChange={setIsCreatingConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create SLA Configuration</DialogTitle>
            <DialogDescription>
              Define thresholds and escalation rules for task SLAs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="config-name">Name</Label>
              <Input
                id="config-name"
                value={newConfig.name}
                onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                placeholder="e.g., High Priority DD Tasks"
                data-testid="input-config-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-description">Description</Label>
              <Textarea
                id="config-description"
                value={newConfig.description}
                onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                placeholder="Describe when this SLA applies..."
                data-testid="input-config-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Type</Label>
              <Select
                value={newConfig.targetType}
                onValueChange={(value) => setNewConfig({ ...newConfig, targetType: value })}
              >
                <SelectTrigger data-testid="select-target-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="dd_task">DD Tasks</SelectItem>
                  <SelectItem value="crm_task">CRM Tasks</SelectItem>
                  <SelectItem value="activity">Activities</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Warning (hrs)</Label>
                <Input
                  type="number"
                  value={newConfig.warningThresholdHours}
                  onChange={(e) => setNewConfig({ ...newConfig, warningThresholdHours: parseInt(e.target.value) || 24 })}
                  data-testid="input-warning-hours"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Critical (hrs)</Label>
                <Input
                  type="number"
                  value={newConfig.criticalThresholdHours}
                  onChange={(e) => setNewConfig({ ...newConfig, criticalThresholdHours: parseInt(e.target.value) || 48 })}
                  data-testid="input-critical-hours"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Breach (hrs)</Label>
                <Input
                  type="number"
                  value={newConfig.breachThresholdHours}
                  onChange={(e) => setNewConfig({ ...newConfig, breachThresholdHours: parseInt(e.target.value) || 72 })}
                  data-testid="input-breach-hours"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingConfig(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createConfigMutation.mutate(newConfig)}
              disabled={!newConfig.name || createConfigMutation.isPending}
              data-testid="button-submit-config"
            >
              Create Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTracking} onOpenChange={(open) => !open && setSelectedTracking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>SLA Details</DialogTitle>
          </DialogHeader>
          {selectedTracking && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {renderStatusBadge(selectedTracking.currentStatus)}
                <Badge variant="outline">
                  {entityTypeLabels[selectedTracking.entityType] || selectedTracking.entityType}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Due Time</p>
                  <p className="font-medium">{format(new Date(selectedTracking.slaDueTime), 'PPp')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p className="font-medium">{formatDistanceToNow(new Date(selectedTracking.slaStartTime))} ago</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Escalation Level</p>
                  <p className="font-medium">{selectedTracking.currentEscalationLevel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reassignments</p>
                  <p className="font-medium">{selectedTracking.reassignmentCount}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Resolution Notes</Label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add resolution notes..."
                  data-testid="input-resolution-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => escalateMutation.mutate({
                trackingId: selectedTracking!.id,
                escalateToId: 'system', // Would normally select a user
              })}
              disabled={escalateMutation.isPending}
              className="flex items-center gap-1"
              data-testid="button-escalate"
            >
              <ArrowUp className="h-4 w-4" />
              Escalate
            </Button>
            <Button
              onClick={() => resolveMutation.mutate({
                trackingId: selectedTracking!.id,
                notes: resolutionNotes,
              })}
              disabled={resolveMutation.isPending}
              className="flex items-center gap-1"
              data-testid="button-resolve"
            >
              <Check className="h-4 w-4" />
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
