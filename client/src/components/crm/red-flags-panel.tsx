import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  AlertTriangle,
  AlertCircle,
  Flag,
  CheckCircle2,
  XCircle,
  Clock,
  Bell,
  Loader2,
  Plus,
  TrendingUp,
  FileWarning,
  MessageSquare,
  Shield,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface RedFlag {
  id: string;
  dealId: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  title: string;
  description?: string;
  triggeredBy: string;
  triggerCondition?: any;
  raisedById?: string;
  raisedAt: string;
  acknowledgedById?: string;
  acknowledgedAt?: string;
  resolvedById?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  dismissedById?: string;
  dismissedAt?: string;
  dismissReason?: string;
  dueDate?: string;
  autoEscalateAfterDays?: number;
}

interface RedFlagWithUser {
  flag: RedFlag;
  raisedBy: {
    id: string;
    username: string;
  } | null;
}

interface EscalationWithDetails {
  escalation: {
    id: string;
    redFlagId: string;
    escalationLevel: number;
    escalatedToId: string;
    escalatedToRole?: string;
    notificationMethod: string;
    notificationSent: boolean;
    responseStatus: string;
  };
  redFlag: RedFlag;
  deal: {
    id: string;
    title: string;
    value: string | null;
  };
}

interface RedFlagSummary {
  openCount: number;
  myEscalationsCount: number;
  bySeverity: { severity: string; count: number }[];
  byCategory: { category: string; count: number }[];
}

const severityConfig = {
  low: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Flag },
  medium: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertTriangle },
  high: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
  critical: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
};

const statusConfig = {
  open: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Open' },
  acknowledged: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Acknowledged' },
  resolved: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Resolved' },
  dismissed: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400', label: 'Dismissed' },
};

const categoryConfig: Record<string, { label: string; icon: typeof Flag }> = {
  stale_deal: { label: 'Stale Deal', icon: Clock },
  deadline_missed: { label: 'Deadline', icon: AlertTriangle },
  value_discrepancy: { label: 'Value Issue', icon: TrendingUp },
  missing_documents: { label: 'Missing Docs', icon: FileWarning },
  approval_blocked: { label: 'Approval Blocked', icon: Shield },
  communication_gap: { label: 'Communication Gap', icon: MessageSquare },
  risk_identified: { label: 'Risk Identified', icon: AlertCircle },
  compliance_issue: { label: 'Compliance', icon: Shield },
  custom: { label: 'Custom', icon: Flag },
};

interface RedFlagsPanelProps {
  dealId?: string;
  showMyEscalations?: boolean;
}

export function RedFlagsPanel({ dealId, showMyEscalations = false }: RedFlagsPanelProps) {
  const { toast } = useToast();
  const [selectedFlag, setSelectedFlag] = useState<RedFlagWithUser | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isCreatingFlag, setIsCreatingFlag] = useState(false);
  const [newFlagData, setNewFlagData] = useState({
    category: 'custom',
    severity: 'medium',
    title: '',
    description: '',
  });

  const summaryQuery = useQuery<RedFlagSummary>({
    queryKey: ['/api/crm/red-flags/summary'],
    enabled: !dealId,
  });

  const dealFlagsQuery = useQuery<RedFlagWithUser[]>({
    queryKey: ['/api/crm/red-flags/deal', dealId],
    enabled: !!dealId,
  });

  const myEscalationsQuery = useQuery<EscalationWithDetails[]>({
    queryKey: ['/api/crm/red-flags/my-escalations'],
    enabled: showMyEscalations,
  });

  const invalidateAllRedFlagQueries = () => {
    if (dealId) {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/red-flags/deal', dealId] });
    }
    queryClient.invalidateQueries({ queryKey: ['/api/crm/red-flags/summary'] });
    queryClient.invalidateQueries({ queryKey: ['/api/crm/red-flags/my-escalations'] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: async (flagId: string) => {
      return apiRequest(`/api/crm/red-flags/${flagId}/acknowledge`, { method: 'PATCH' });
    },
    onSuccess: () => {
      invalidateAllRedFlagQueries();
      toast({ title: 'Red flag acknowledged' });
      setSelectedFlag(null);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ flagId, resolutionNotes }: { flagId: string; resolutionNotes: string }) => {
      return apiRequest(`/api/crm/red-flags/${flagId}/resolve`, {
        method: 'PATCH',
        body: { resolutionNotes },
      });
    },
    onSuccess: () => {
      invalidateAllRedFlagQueries();
      toast({ title: 'Red flag resolved' });
      setSelectedFlag(null);
      setActionNotes('');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ flagId, dismissReason }: { flagId: string; dismissReason: string }) => {
      return apiRequest(`/api/crm/red-flags/${flagId}/dismiss`, {
        method: 'PATCH',
        body: { dismissReason },
      });
    },
    onSuccess: () => {
      invalidateAllRedFlagQueries();
      toast({ title: 'Red flag dismissed' });
      setSelectedFlag(null);
      setActionNotes('');
    },
  });

  const createFlagMutation = useMutation({
    mutationFn: async (data: { dealId: string; category: string; severity: string; title: string; description: string }) => {
      return apiRequest('/api/crm/red-flags', { method: 'POST', body: data });
    },
    onSuccess: () => {
      invalidateAllRedFlagQueries();
      toast({ title: 'Red flag created' });
      setIsCreatingFlag(false);
      setNewFlagData({ category: 'custom', severity: 'medium', title: '', description: '' });
    },
  });

  const respondToEscalationMutation = useMutation({
    mutationFn: async ({ escalationId, responseNotes }: { escalationId: string; responseNotes: string }) => {
      return apiRequest(`/api/crm/red-flags/escalations/${escalationId}/respond`, {
        method: 'PATCH',
        body: { responseNotes },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/red-flags/my-escalations'] });
      toast({ title: 'Response submitted' });
    },
  });

  if (dealId) {
    const flags = dealFlagsQuery.data || [];
    const openFlags = flags.filter(f => f.flag.status === 'open' || f.flag.status === 'acknowledged');
    
    return (
      <Card data-testid="card-red-flags-deal">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Red Flags
                {openFlags.length > 0 && (
                  <Badge variant="destructive" className="ml-2" data-testid="badge-open-flags-count">
                    {openFlags.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Issues and blockers requiring attention</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsCreatingFlag(true)}
              data-testid="button-create-flag"
            >
              <Plus className="h-4 w-4 mr-1" />
              Raise Flag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dealFlagsQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : flags.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Flag className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No red flags for this deal</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flags.map(({ flag, raisedBy }) => {
                const SeverityIcon = severityConfig[flag.severity]?.icon || Flag;
                const CategoryInfo = categoryConfig[flag.category] || categoryConfig.custom;
                
                return (
                  <div
                    key={flag.id}
                    className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedFlag({ flag, raisedBy })}
                    data-testid={`card-red-flag-${flag.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <SeverityIcon className={`h-5 w-5 mt-0.5 ${
                          flag.severity === 'critical' ? 'text-red-500' :
                          flag.severity === 'high' ? 'text-orange-500' :
                          flag.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                        <div>
                          <p className="font-medium">{flag.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {CategoryInfo.label}
                            </Badge>
                            <Badge className={`text-xs ${severityConfig[flag.severity].color}`}>
                              {flag.severity}
                            </Badge>
                            <Badge className={`text-xs ${statusConfig[flag.status].color}`}>
                              {statusConfig[flag.status].label}
                            </Badge>
                          </div>
                          {flag.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {flag.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Raised {format(new Date(flag.raisedAt), 'MMM d, yyyy')}
                            {raisedBy && ` by ${raisedBy.username}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        <Dialog open={isCreatingFlag} onOpenChange={setIsCreatingFlag}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Raise Red Flag</DialogTitle>
              <DialogDescription>
                Flag an issue that needs attention on this deal
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newFlagData.category}
                  onValueChange={(value) => setNewFlagData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger data-testid="select-flag-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={newFlagData.severity}
                  onValueChange={(value) => setNewFlagData(prev => ({ ...prev, severity: value }))}
                >
                  <SelectTrigger data-testid="select-flag-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newFlagData.title}
                  onChange={(e) => setNewFlagData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief description of the issue"
                  data-testid="input-flag-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newFlagData.description}
                  onChange={(e) => setNewFlagData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide additional context..."
                  data-testid="input-flag-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreatingFlag(false)}>Cancel</Button>
              <Button
                onClick={() => createFlagMutation.mutate({ ...newFlagData, dealId })}
                disabled={!newFlagData.title || createFlagMutation.isPending}
                data-testid="button-submit-flag"
              >
                {createFlagMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Raise Flag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedFlag} onOpenChange={() => setSelectedFlag(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {selectedFlag?.flag.title}
              </DialogTitle>
              <DialogDescription>
                {selectedFlag?.flag.description || 'No additional details provided'}
              </DialogDescription>
            </DialogHeader>
            {selectedFlag && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <Badge className={severityConfig[selectedFlag.flag.severity].color}>
                    {selectedFlag.flag.severity}
                  </Badge>
                  <Badge className={statusConfig[selectedFlag.flag.status].color}>
                    {statusConfig[selectedFlag.flag.status].label}
                  </Badge>
                </div>
                
                {selectedFlag.flag.status === 'open' && (
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="Add notes about your action..."
                      data-testid="input-action-notes"
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2">
              {selectedFlag?.flag.status === 'open' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => acknowledgeMutation.mutate(selectedFlag.flag.id)}
                    disabled={acknowledgeMutation.isPending}
                    data-testid="button-acknowledge-flag"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Acknowledge
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => dismissMutation.mutate({ flagId: selectedFlag.flag.id, dismissReason: actionNotes })}
                    disabled={dismissMutation.isPending}
                    data-testid="button-dismiss-flag"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                  <Button
                    onClick={() => resolveMutation.mutate({ flagId: selectedFlag.flag.id, resolutionNotes: actionNotes })}
                    disabled={resolveMutation.isPending}
                    data-testid="button-resolve-flag"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Resolve
                  </Button>
                </>
              )}
              {selectedFlag?.flag.status === 'acknowledged' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => dismissMutation.mutate({ flagId: selectedFlag.flag.id, dismissReason: actionNotes })}
                    disabled={dismissMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                  <Button
                    onClick={() => resolveMutation.mutate({ flagId: selectedFlag.flag.id, resolutionNotes: actionNotes })}
                    disabled={resolveMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Resolve
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  const summary = summaryQuery.data;
  const myEscalations = myEscalationsQuery.data || [];

  return (
    <Card data-testid="card-red-flags-overview">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Red Flag Center
        </CardTitle>
        <CardDescription>Monitor and manage deal health alerts</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="escalations" data-testid="tab-my-escalations">
              My Escalations
              {myEscalations.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {myEscalations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {summaryQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3 text-center" data-testid="stat-open-flags">
                    <p className="text-2xl font-bold text-red-500">{summary?.openCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Open Flags</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center" data-testid="stat-my-escalations">
                    <p className="text-2xl font-bold text-orange-500">{summary?.myEscalationsCount || 0}</p>
                    <p className="text-sm text-muted-foreground">My Escalations</p>
                  </div>
                </div>

                {summary?.bySeverity && summary.bySeverity.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">By Severity</p>
                    <div className="flex flex-wrap gap-2">
                      {summary.bySeverity.map(({ severity, count }) => (
                        <Badge
                          key={severity}
                          className={severityConfig[severity as keyof typeof severityConfig]?.color || 'bg-gray-100'}
                        >
                          {severity}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {summary?.byCategory && summary.byCategory.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">By Category</p>
                    <div className="flex flex-wrap gap-2">
                      {summary.byCategory.map(({ category, count }) => (
                        <Badge key={category} variant="outline">
                          {categoryConfig[category]?.label || category}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="escalations" className="mt-4">
            {myEscalationsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : myEscalations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No pending escalations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myEscalations.map(({ escalation, redFlag, deal }) => (
                  <div
                    key={escalation.id}
                    className="border rounded-lg p-3"
                    data-testid={`card-escalation-${escalation.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{redFlag.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Deal: {deal.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={severityConfig[redFlag.severity].color}>
                            {redFlag.severity}
                          </Badge>
                          <Badge variant="outline">Level {escalation.escalationLevel}</Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => respondToEscalationMutation.mutate({
                          escalationId: escalation.id,
                          responseNotes: 'Viewed and acknowledged',
                        })}
                        disabled={respondToEscalationMutation.isPending}
                        data-testid={`button-respond-escalation-${escalation.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Respond
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
