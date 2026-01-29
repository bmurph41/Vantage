import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuditLog } from '@/hooks/use-settings';
import {
  Settings2,
  Users,
  Building2,
  FileText,
  ExternalLink,
  Clock,
  Loader2,
  Shield,
  Activity,
} from 'lucide-react';
import type { UserSettings, UserProfile, Organization, AuditLogEntry } from '@/types/settings';

interface AdminSettingsProps {
  settings: UserSettings;
  profile: UserProfile;
  organization: Organization | null;
  onChange: (updates: Partial<UserSettings>) => void;
}

function formatAction(action: string): string {
  return action
    .replace(/\./g, ' → ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getActionColor(category: string): string {
  switch (category) {
    case 'security':
      return 'text-red-500';
    case 'settings':
      return 'text-blue-500';
    case 'token':
      return 'text-amber-500';
    case 'account':
      return 'text-purple-500';
    default:
      return 'text-muted-foreground';
  }
}

export function AdminSettings({
  settings,
  profile,
  organization,
}: AdminSettingsProps) {
  const { data: auditLog, isLoading: auditLoading } = useAuditLog(20);

  return (
    <div className="space-y-6">
      {/* Admin Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Admin Dashboard
          </CardTitle>
          <CardDescription>
            Organization management and administrative tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <a
              href="/admin/users"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <Users className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-medium text-sm">User Management</h4>
                <p className="text-xs text-muted-foreground">
                  Manage team members and permissions
                </p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </a>

            <a
              href="/admin/organization"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-medium text-sm">Organization Settings</h4>
                <p className="text-xs text-muted-foreground">
                  Company profile and billing
                </p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </a>

            <a
              href="/admin/security"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-medium text-sm">Security Policies</h4>
                <p className="text-xs text-muted-foreground">
                  SSO, MFA requirements, and more
                </p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </a>

            <a
              href="/admin/audit"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-medium text-sm">Full Audit Logs</h4>
                <p className="text-xs text-muted-foreground">
                  Complete activity history
                </p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Organization Info */}
      {organization && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="font-medium">{organization.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">ID</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {organization.id}
                </code>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Your Role</span>
                <Badge variant="secondary" className="capitalize">
                  {profile.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Audit Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Your recent account activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/audit">View All</a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : auditLog?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          ) : (
            <div className="space-y-2">
              {auditLog?.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getActionColor(entry.category)}`}>
                        {formatAction(entry.action)}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {entry.category}
                      </Badge>
                    </div>
                    {entry.ipAddress && (
                      <p className="text-xs text-muted-foreground">
                        IP: {entry.ipAddress}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">--</div>
              <div className="text-xs text-muted-foreground">Team Members</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">--</div>
              <div className="text-xs text-muted-foreground">Active Deals</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">--</div>
              <div className="text-xs text-muted-foreground">Documents</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">--</div>
              <div className="text-xs text-muted-foreground">Integrations</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}