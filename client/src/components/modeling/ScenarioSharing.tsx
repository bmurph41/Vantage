import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Share2, UserPlus, X, Clock, Eye, Edit, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ScenarioSharingProps {
  scenarioId: string;
  projectId: string;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-green-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-red-500',
];

function getPermissionIcon(permission: string) {
  switch (permission) {
    case 'view-only': return <Eye className="h-3 w-3" />;
    case 'can-edit':  return <Edit className="h-3 w-3" />;
    case 'full-access': return <Shield className="h-3 w-3" />;
    default: return <Eye className="h-3 w-3" />;
  }
}

function getPermissionLabel(permission: string): string {
  switch (permission) {
    case 'view-only':   return 'View Only';
    case 'can-edit':    return 'Can Edit';
    case 'full-access': return 'Full Access';
    default:            return 'View Only';
  }
}

function permissionToRole(permission: string): string {
  switch (permission) {
    case 'full-access': return 'owner';
    case 'can-edit':    return 'editor';
    default:            return 'viewer';
  }
}

export function ScenarioSharing({ scenarioId, projectId }: ScenarioSharingProps) {
  const { toast } = useToast();
  const [emailInput, setEmailInput]         = useState('');
  const [permissionInput, setPermissionInput] = useState<'view-only' | 'can-edit' | 'full-access'>('can-edit');

  // ── Collaborators query ────────────────────────────────────────────────────
  const {
    data: collaborators = [],
    isLoading: collabLoading,
  } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'collaborators'],
    queryFn: () => fetch(`/api/modeling/projects/${projectId}/collaborators`).then(r => r.json()),
    enabled: !!projectId,
  });

  // ── Activity query ─────────────────────────────────────────────────────────
  const {
    data: activityLog = [],
    isLoading: activityLoading,
  } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'activity'],
    queryFn: () => fetch(`/api/modeling/projects/${projectId}/activity`).then(r => r.json()),
    enabled: !!projectId,
  });

  // ── Add collaborator mutation ──────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      apiRequest('POST', `/api/modeling/projects/${projectId}/collaborators`, { email, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'collaborators'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'activity'] });
      setEmailInput('');
      setPermissionInput('can-edit');
      toast({ title: 'Collaborator added' });
    },
    onError: async (err: any) => {
      let msg = 'Failed to add collaborator';
      try { const j = await err.json?.(); if (j?.error) msg = j.error; } catch {}
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  // ── Update role mutation ───────────────────────────────────────────────────
  const updateRoleMutation = useMutation({
    mutationFn: ({ collaboratorId, role }: { collaboratorId: string; role: string }) =>
      apiRequest('PATCH', `/api/modeling/projects/${projectId}/collaborators/${collaboratorId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'collaborators'] });
    },
  });

  // ── Remove collaborator mutation ───────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: (collaboratorId: string) =>
      apiRequest('DELETE', `/api/modeling/projects/${projectId}/collaborators/${collaboratorId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'collaborators'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'activity'] });
      toast({ title: 'Collaborator removed' });
    },
  });

  const handleAddCollaborator = () => {
    if (!emailInput.trim()) return;
    addMutation.mutate({ email: emailInput.trim(), role: permissionToRole(permissionInput) });
  };

  const lastActivity = activityLog[0];

  return (
    <div className="space-y-6">
      {/* Share Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share Scenario
          </CardTitle>
          <CardDescription>
            Invite team members to collaborate on this scenario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCollaborator(); }}
              className="flex-1"
            />
            <Select value={permissionInput} onValueChange={(v: any) => setPermissionInput(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view-only">View Only</SelectItem>
                <SelectItem value="can-edit">Can Edit</SelectItem>
                <SelectItem value="full-access">Full Access</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddCollaborator}
              disabled={!emailInput.trim() || addMutation.isPending}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {addMutation.isPending ? 'Adding…' : 'Share'}
            </Button>
          </div>

          {/* Collaborators List */}
          <div className="space-y-2 mt-4">
            <div className="text-sm font-medium">Current Collaborators</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {collabLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : collaborators.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No collaborators yet — share this scenario to get started.
                </div>
              ) : (
                collaborators.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className={`h-8 w-8 ${AVATAR_COLORS[c.colorIndex ?? 0]}`}>
                        <AvatarFallback className={`${AVATAR_COLORS[c.colorIndex ?? 0]} text-white font-semibold text-xs`}>
                          {c.name?.charAt(0).toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-2">
                      <Select
                        value={c.permission}
                        onValueChange={(v: any) =>
                          updateRoleMutation.mutate({ collaboratorId: c.id, role: permissionToRole(v) })
                        }
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view-only">View Only</SelectItem>
                          <SelectItem value="can-edit">Can Edit</SelectItem>
                          <SelectItem value="full-access">Full Access</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMutation.mutate(c.id)}
                        disabled={removeMutation.isPending}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Collaborators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Active Collaborators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-3">Team Members with Access</div>
            {collabLoading ? (
              <div className="flex gap-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-12 w-32 rounded-lg" />)}
              </div>
            ) : collaborators.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No collaborators yet
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {collaborators.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Avatar className={`h-10 w-10 ${AVATAR_COLORS[c.colorIndex ?? 0]}`}>
                      <AvatarFallback className={`${AVATAR_COLORS[c.colorIndex ?? 0]} text-white font-semibold`}>
                        {c.name?.charAt(0).toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {getPermissionIcon(c.permission)}
                        {getPermissionLabel(c.permission)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {lastActivity && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Last activity:{' '}
                <span className="font-medium text-foreground">{lastActivity.userName ?? 'Unknown'}</span>
                {' '}{lastActivity.action}{' '}
                {formatDistanceToNow(new Date(lastActivity.createdAt), { addSuffix: true })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
          <CardDescription>Last 50 changes to this project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : activityLog.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No activity yet — changes to this project will appear here.
              </div>
            ) : (
              activityLog.map((entry: any, index: number) => (
                <div key={entry.id} className="flex items-start gap-3 py-2 text-sm">
                  <div className="flex flex-col items-center mt-1">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    {index < activityLog.length - 1 && (
                      <div className="h-6 w-0.5 bg-border my-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground">
                      <span className="font-medium">{entry.userName ?? 'Unknown user'}</span>
                      {' '}
                      <span className="text-muted-foreground">{entry.action}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
