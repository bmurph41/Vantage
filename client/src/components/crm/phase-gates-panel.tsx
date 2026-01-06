import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  Shield,
  Loader2,
  User,
  Calendar
} from 'lucide-react';
import { useState } from 'react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PhaseGateApproval {
  id: string;
  dealId: string;
  fromStageId: string | null;
  toStageId: string;
  status: 'pending' | 'approved' | 'rejected' | 'bypassed';
  requestedById: string;
  requestedAt: string;
  reviewedById?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  requiredApproverRole?: string;
  requiredApproverId?: string;
}

interface PendingApproval {
  approval: PhaseGateApproval;
  deal: {
    id: string;
    title: string;
    value: string | null;
    stage: string;
  };
  fromStage: {
    id: string;
    name: string;
  } | null;
  toStage: {
    id: string;
    name: string;
  };
  requester: {
    id: string;
    username: string;
  };
}

interface RequirementsCheck {
  canProgress: boolean;
  missingFields: string[];
  requiresApproval: boolean;
  approvalStatus: 'approved' | 'required' | 'not_required';
  stageName: string;
}

const formatCurrency = (value: string | number | null) => {
  if (!value) return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
};

const statusConfig = {
  pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
  approved: { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Approved' },
  rejected: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Rejected' },
  bypassed: { icon: AlertTriangle, color: 'bg-gray-100 text-gray-800', label: 'Bypassed' },
};

interface PhaseGatesPanelProps {
  dealId?: string;
  showPendingApprovals?: boolean;
}

export function PhaseGatesPanel({ dealId, showPendingApprovals = false }: PhaseGatesPanelProps) {
  const { toast } = useToast();
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const { data: pendingApprovals, isLoading: pendingLoading } = useQuery<PendingApproval[]>({
    queryKey: ['/api/crm/phase-gates/pending'],
    enabled: showPendingApprovals,
  });

  const { data: dealApprovals, isLoading: dealLoading } = useQuery<PhaseGateApproval[]>({
    queryKey: ['/api/crm/phase-gates/deal', dealId],
    enabled: !!dealId,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ approvalId, notes }: { approvalId: string; notes?: string }) => {
      return apiRequest(`/api/crm/phase-gates/${approvalId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ reviewNotes: notes }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: 'Approved', description: 'Stage transition has been approved.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/phase-gates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/deals'] });
      setSelectedApproval(null);
      setReviewNotes('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to approve', 
        variant: 'destructive' 
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ approvalId, reason, notes }: { approvalId: string; reason: string; notes?: string }) => {
      return apiRequest(`/api/crm/phase-gates/${approvalId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ rejectionReason: reason, reviewNotes: notes }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: 'Rejected', description: 'Stage transition has been rejected.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/phase-gates'] });
      setSelectedApproval(null);
      setRejectionReason('');
      setReviewNotes('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to reject', 
        variant: 'destructive' 
      });
    },
  });

  const handleApprove = (approval: PendingApproval) => {
    setIsApproving(true);
    setSelectedApproval(approval);
  };

  const handleReject = (approval: PendingApproval) => {
    setIsApproving(false);
    setSelectedApproval(approval);
  };

  const confirmAction = () => {
    if (!selectedApproval) return;
    
    if (isApproving) {
      approveMutation.mutate({ 
        approvalId: selectedApproval.approval.id, 
        notes: reviewNotes 
      });
    } else {
      if (!rejectionReason.trim()) {
        toast({ 
          title: 'Required', 
          description: 'Please provide a rejection reason', 
          variant: 'destructive' 
        });
        return;
      }
      rejectMutation.mutate({ 
        approvalId: selectedApproval.approval.id, 
        reason: rejectionReason,
        notes: reviewNotes 
      });
    }
  };

  if (showPendingApprovals) {
    if (pendingLoading) {
      return (
        <div className="flex items-center justify-center h-32" data-testid="phase-gates-loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="space-y-4" data-testid="pending-approvals-panel">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Pending Approvals
          </h3>
          {pendingApprovals && pendingApprovals.length > 0 && (
            <Badge>{pendingApprovals.length} pending</Badge>
          )}
        </div>

        {(!pendingApprovals || pendingApprovals.length === 0) ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p>No pending approvals</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((item) => (
              <Card key={item.approval.id} data-testid={`approval-card-${item.approval.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{item.deal?.title || 'Unknown Deal'}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="flex items-center">
                          {item.fromStage?.name || 'Start'}
                          <ChevronRight className="h-4 w-4 mx-1" />
                          {item.toStage?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {item.requester?.username || 'Unknown'}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(item.approval.requestedAt), 'MMM d, yyyy')}
                        </span>
                        {item.deal?.value && (
                          <Badge variant="outline">{formatCurrency(item.deal.value)}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(item)}
                        data-testid={`reject-btn-${item.approval.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(item)}
                        data-testid={`approve-btn-${item.approval.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isApproving ? 'Approve Stage Transition' : 'Reject Stage Transition'}
              </DialogTitle>
              <DialogDescription>
                {selectedApproval && (
                  <>
                    {selectedApproval.deal?.title}: {selectedApproval.fromStage?.name || 'Start'} → {selectedApproval.toStage?.name}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!isApproving && (
                <div>
                  <label className="text-sm font-medium">Rejection Reason (required)</label>
                  <Textarea
                    placeholder="Explain why this transition is being rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="mt-1"
                    data-testid="rejection-reason-input"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="Add any additional notes..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-1"
                  data-testid="review-notes-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedApproval(null)}>
                Cancel
              </Button>
              <Button
                onClick={confirmAction}
                variant={isApproving ? 'default' : 'destructive'}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                data-testid="confirm-action-btn"
              >
                {(approveMutation.isPending || rejectMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isApproving ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (dealLoading) {
    return (
      <div className="flex items-center justify-center h-32" data-testid="phase-gates-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card data-testid="deal-approvals-panel">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Shield className="h-5 w-5 mr-2" />
          Stage Approvals
        </CardTitle>
        <CardDescription>History of gate approvals for this deal</CardDescription>
      </CardHeader>
      <CardContent>
        {(!dealApprovals || dealApprovals.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No stage approvals yet
          </p>
        ) : (
          <div className="space-y-3">
            {dealApprovals.map((approval) => {
              const config = statusConfig[approval.status];
              const StatusIcon = config.icon;
              return (
                <div 
                  key={approval.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`deal-approval-${approval.id}`}
                >
                  <div className="flex items-center">
                    <StatusIcon className={`h-5 w-5 mr-3 ${
                      approval.status === 'approved' ? 'text-green-500' :
                      approval.status === 'rejected' ? 'text-red-500' :
                      approval.status === 'pending' ? 'text-yellow-500' :
                      'text-gray-500'
                    }`} />
                    <div>
                      <div className="text-sm font-medium">
                        Stage transition requested
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(approval.requestedAt), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                  <Badge className={config.color}>{config.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PhaseGatesPanel;
