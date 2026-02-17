import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Users, Share2, UserPlus, X, Clock, Eye, Edit, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  permission: 'view-only' | 'can-edit' | 'full-access';
  status: 'active' | 'idle' | 'offline' | 'invited';
  lastActivityAt: Date;
  color: string;
}

interface ActivityLogEntry {
  id: string;
  name: string;
  action: string;
  field: string;
  timestamp: Date;
}

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

const MOCK_COLLABORATORS: Collaborator[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    permission: 'can-edit',
    status: 'active',
    lastActivityAt: new Date(Date.now() - 5 * 60000),
    color: AVATAR_COLORS[0],
  },
  {
    id: '2',
    name: 'Michael Chen',
    email: 'michael@example.com',
    permission: 'view-only',
    status: 'idle',
    lastActivityAt: new Date(Date.now() - 30 * 60000),
    color: AVATAR_COLORS[1],
  },
  {
    id: '3',
    name: 'Emma Rodriguez',
    email: 'emma@example.com',
    permission: 'full-access',
    status: 'active',
    lastActivityAt: new Date(Date.now() - 2 * 60000),
    color: AVATAR_COLORS[2],
  },
];

const MOCK_ACTIVITY_LOG: ActivityLogEntry[] = [
  {
    id: '1',
    name: 'Emma Rodriguez',
    action: 'modified',
    field: 'Exit Strategy',
    timestamp: new Date(Date.now() - 2 * 60000),
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    action: 'updated',
    field: 'Hold Period Assumptions',
    timestamp: new Date(Date.now() - 15 * 60000),
  },
  {
    id: '3',
    name: 'Emma Rodriguez',
    action: 'modified',
    field: 'Cap Rate',
    timestamp: new Date(Date.now() - 28 * 60000),
  },
  {
    id: '4',
    name: 'Michael Chen',
    action: 'viewed',
    field: 'Returns Summary',
    timestamp: new Date(Date.now() - 45 * 60000),
  },
  {
    id: '5',
    name: 'Sarah Johnson',
    action: 'modified',
    field: 'Loan Terms',
    timestamp: new Date(Date.now() - 1.5 * 3600000),
  },
];

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'idle':
      return 'bg-yellow-500';
    case 'offline':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'idle':
      return 'Idle';
    case 'offline':
      return 'Offline';
    default:
      return 'Offline';
  }
}

function getPermissionIcon(permission: string) {
  switch (permission) {
    case 'view-only':
      return <Eye className="h-3 w-3" />;
    case 'can-edit':
      return <Edit className="h-3 w-3" />;
    case 'full-access':
      return <Shield className="h-3 w-3" />;
    default:
      return <Eye className="h-3 w-3" />;
  }
}

function getPermissionLabel(permission: string): string {
  switch (permission) {
    case 'view-only':
      return 'View Only';
    case 'can-edit':
      return 'Can Edit';
    case 'full-access':
      return 'Full Access';
    default:
      return 'View Only';
  }
}

export function ScenarioSharing({ scenarioId, projectId }: ScenarioSharingProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>(MOCK_COLLABORATORS);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(MOCK_ACTIVITY_LOG);
  const [emailInput, setEmailInput] = useState('');
  const [permissionInput, setPermissionInput] = useState<'view-only' | 'can-edit' | 'full-access'>('can-edit');

  // Get the last edited collaborator
  const lastEdited = useMemo(() => {
    if (activityLog.length === 0) return null;
    const lastEntry = activityLog[0];
    const collaborator = collaborators.find((c) => c.name === lastEntry.name);
    return {
      name: lastEntry.name,
      time: lastEntry.timestamp,
      collaborator,
    };
  }, [activityLog, collaborators]);

  // Get active collaborators
  const activeCollaborators = useMemo(() => {
    return collaborators.filter((c) => c.status === 'active' || c.status === 'idle');
  }, [collaborators]);

  // Handle adding a collaborator
  const handleAddCollaborator = () => {
    if (!emailInput.trim()) return;

    const newCollaborator: Collaborator = {
      id: Date.now().toString(),
      name: emailInput.split('@')[0],
      email: emailInput,
      permission: permissionInput,
      status: 'invited',
      lastActivityAt: new Date(),
      color: AVATAR_COLORS[collaborators.length % AVATAR_COLORS.length],
    };

    setCollaborators([...collaborators, newCollaborator]);
    setEmailInput('');
    setPermissionInput('can-edit');
  };

  // Handle removing a collaborator
  const handleRemoveCollaborator = (id: string) => {
    setCollaborators(collaborators.filter((c) => c.id !== id));
  };

  // Handle permission change
  const handlePermissionChange = (id: string, newPermission: 'view-only' | 'can-edit' | 'full-access') => {
    setCollaborators(
      collaborators.map((c) =>
        c.id === id ? { ...c, permission: newPermission } : c
      )
    );
  };

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
          {/* Share Input Section */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter email or username"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCollaborator();
                }
              }}
              className="flex-1"
            />
            <Select value={permissionInput} onValueChange={(value: any) => setPermissionInput(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view-only">View Only</SelectItem>
                <SelectItem value="can-edit">Can Edit</SelectItem>
                <SelectItem value="full-access">Full Access</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddCollaborator} disabled={!emailInput.trim()}>
              <UserPlus className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>

          {/* Collaborators List */}
          <div className="space-y-2 mt-4">
            <div className="text-sm font-medium">Current Collaborators</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {collaborators.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No collaborators yet. Share this scenario to get started.
                </div>
              ) : (
                collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative">
                        <Avatar className={`h-8 w-8 ${collaborator.color}`}>
                          <AvatarFallback className={`${collaborator.color} text-white font-semibold text-xs`}>
                            {collaborator.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(
                            collaborator.status
                          )}`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{collaborator.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{collaborator.email}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {collaborator.status === 'invited' ? (
                          <Badge variant="outline" className="text-xs">
                            Invited
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {getStatusLabel(collaborator.status)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-2">
                      <Select value={collaborator.permission} onValueChange={(value: any) => handlePermissionChange(collaborator.id, value)}>
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
                        onClick={() => handleRemoveCollaborator(collaborator.id)}
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

      {/* Collaboration Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Active Collaborators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Online Collaborators Display */}
          <div>
            <div className="text-sm font-medium mb-3">Currently Viewing/Editing</div>
            {activeCollaborators.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No active collaborators at the moment
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {activeCollaborators.map((collaborator) => (
                  <div key={collaborator.id} className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar className={`h-10 w-10 ${collaborator.color}`}>
                        <AvatarFallback className={`${collaborator.color} text-white font-semibold`}>
                          {collaborator.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(
                          collaborator.status
                        )}`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{collaborator.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {getPermissionIcon(collaborator.permission)}
                        {getPermissionLabel(collaborator.permission)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Last Edited Footer */}
          {lastEdited && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Last edited by <span className="font-medium text-foreground">{lastEdited.name}</span> {formatDistanceToNow(lastEdited.time, { addSuffix: true })}
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
          <CardDescription>
            Last 10 changes to this scenario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {activityLog.slice(0, 10).map((entry, index) => (
              <div key={entry.id} className="flex items-start gap-3 py-2 text-sm">
                {/* Timeline dot */}
                <div className="flex flex-col items-center mt-1">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  {index < activityLog.slice(0, 10).length - 1 && (
                    <div className="h-6 w-0.5 bg-border my-1" />
                  )}
                </div>

                {/* Activity content */}
                <div className="flex-1 min-w-0">
                  <div className="text-foreground">
                    <span className="font-medium">{entry.name}</span>
                    {' '}
                    <span className="text-muted-foreground">{entry.action}</span>
                    {' '}
                    <span className="font-medium text-foreground">{entry.field}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
            {activityLog.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No activity yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
