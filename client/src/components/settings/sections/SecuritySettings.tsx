import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useSessions,
  useTokens,
  useRevokeSession,
  useRevokeAllSessions,
  useCreateToken,
  useRevokeToken,
} from '@/hooks/use-settings';
import {
  Shield,
  Key,
  Smartphone,
  Monitor,
  Tablet,
  LogOut,
  Plus,
  Copy,
  Trash2,
  AlertTriangle,
  Clock,
  Check,
  Loader2,
} from 'lucide-react';
import type { UserSettings, UserProfile, Organization } from '@/types/settings';

interface SecuritySettingsProps {
  settings: UserSettings;
  profile: UserProfile;
  organization: Organization | null;
  onChange: (updates: Partial<UserSettings>) => void;
}

function getDeviceIcon(deviceType: string) {
  switch (deviceType?.toLowerCase()) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return Tablet;
    default:
      return Monitor;
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

export function SecuritySettings({
  settings,
  profile,
}: SecuritySettingsProps) {
  const { toast } = useToast();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: tokens, isLoading: tokensLoading } = useTokens();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();
  const createToken = useCreateToken();
  const revokeToken = useRevokeToken();

  const [showCreateToken, setShowCreateToken] = useState(false);
  const [showTokenResult, setShowTokenResult] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenValue, setNewTokenValue] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) return;

    try {
      const result = await createToken.mutateAsync({ name: newTokenName });
      setNewTokenValue(result.token);
      setShowCreateToken(false);
      setShowTokenResult(true);
      setNewTokenName('');
    } catch (error: any) {
      toast({
        title: 'Failed to create token',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(newTokenValue);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleRevokeAll = async () => {
    try {
      await revokeAllSessions.mutateAsync();
      setShowRevokeAllConfirm(false);
      toast({
        title: 'Sessions revoked',
        description: 'All other sessions have been signed out.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to revoke sessions',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* MFA Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Two-Factor Authentication (2FA)</Label>
              <p className="text-sm text-muted-foreground">
                {profile.mfaEnabled
                  ? 'Your account is protected with 2FA'
                  : 'Protect your account with an authenticator app'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {profile.mfaEnabled ? (
                <Badge variant="secondary" className="text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
              <Button variant="outline" size="sm">
                {profile.mfaEnabled ? 'Manage' : 'Enable'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Devices where you're currently signed in
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRevokeAllConfirm(true)}
              disabled={revokeAllSessions.isPending}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out All Others
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active sessions
            </p>
          ) : (
            <div className="space-y-3">
              {sessions?.map((session) => {
                const DeviceIcon = getDeviceIcon(session.deviceType);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-muted">
                        <DeviceIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {session.browser} on {session.os}
                          </span>
                          {session.isCurrent && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Last active: {formatDate(session.lastActivityAt)}
                          {session.ipAddress && (
                            <span>• {session.ipAddress}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeSession.mutate(session.id)}
                        disabled={revokeSession.isPending}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Tokens */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Personal Access Tokens
              </CardTitle>
              <CardDescription>
                Tokens for API access and integrations
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateToken(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tokensLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tokens?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No access tokens created
            </p>
          ) : (
            <div className="space-y-3">
              {tokens?.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div>
                    <div className="font-medium text-sm">{token.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        {token.tokenPrefix}...
                      </code>
                      <span>Created {formatDate(token.createdAt)}</span>
                      {token.lastUsedAt && (
                        <span>• Last used {formatDate(token.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeToken.mutate(token.id)}
                    disabled={revokeToken.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Token Dialog */}
      <Dialog open={showCreateToken} onOpenChange={setShowCreateToken}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Personal Access Token</DialogTitle>
            <DialogDescription>
              This token will have full access to your account via the API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tokenName">Token Name</Label>
              <Input
                id="tokenName"
                placeholder="e.g., CI/CD Pipeline"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateToken(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateToken}
              disabled={!newTokenName.trim() || createToken.isPending}
            >
              {createToken.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Token'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Created Result Dialog */}
      <Dialog open={showTokenResult} onOpenChange={setShowTokenResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token Created</DialogTitle>
            <DialogDescription>
              <span className="text-amber-500 flex items-center gap-2 mt-2">
                <AlertTriangle className="h-4 w-4" />
                Copy this token now. You won't be able to see it again!
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input
                value={newTokenValue}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyToken}
              >
                {tokenCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setShowTokenResult(false);
              setNewTokenValue('');
            }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke All Confirmation */}
      <AlertDialog open={showRevokeAllConfirm} onOpenChange={setShowRevokeAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out all other sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out of all other devices and browsers. Your current
              session will remain active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign Out All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}