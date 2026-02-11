import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Smartphone, 
  Key, 
  LogOut, 
  AlertTriangle, 
  Check, 
  Copy, 
  Monitor, 
  Clock,
  MapPin,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface UserSession {
  id: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  location?: string;
  lastActivityAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface MfaSetupData {
  qrCode: string;
  backupCodes: string[];
}

export default function SecuritySettings() {
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<{ mfaEnabled: boolean; email: string }>({
    queryKey: ['/api/auth/me'],
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<UserSession[]>({
    queryKey: ['/api/auth/sessions'],
  });

  const setupMfaMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/mfa/setup');
      return res.json();
    },
    onSuccess: (data) => {
      setMfaSetupData(data);
      setShowMfaSetup(true);
    },
    onError: () => {
      toast({ title: "Failed to start MFA setup", variant: "destructive" });
    },
  });

  const enableMfaMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest('POST', '/api/auth/mfa/enable', { token });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setShowMfaSetup(false);
      setShowBackupCodes(true);
      toast({ title: "Two-factor authentication enabled" });
    },
    onError: () => {
      toast({ title: "Invalid verification code", variant: "destructive" });
    },
  });

  const disableMfaMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/auth/mfa/disable');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: "Two-factor authentication disabled" });
    },
    onError: () => {
      toast({ title: "Failed to disable MFA", variant: "destructive" });
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest('POST', `/api/auth/sessions/${sessionId}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      toast({ title: "Session revoked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to revoke session", variant: "destructive" });
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/auth/sessions/revoke-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      toast({ title: "All other sessions revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke sessions", variant: "destructive" });
    },
  });

  const copyBackupCodes = () => {
    if (mfaSetupData?.backupCodes) {
      navigator.clipboard.writeText(mfaSetupData.backupCodes.join('\n'));
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
      toast({ title: "Backup codes copied to clipboard" });
    }
  };

  const handleEnableMfa = () => {
    if (verificationCode.length === 6) {
      enableMfaMutation.mutate(verificationCode);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Security Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account security and active sessions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using a TOTP authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${user?.mfaEnabled ? 'bg-green-100 dark:bg-green-900' : 'bg-yellow-100 dark:bg-yellow-900'}`}>
                {user?.mfaEnabled ? (
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {user?.mfaEnabled ? 'Two-factor authentication is enabled' : 'Two-factor authentication is not enabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {user?.mfaEnabled 
                    ? 'Your account is protected with an authenticator app'
                    : 'Enable 2FA to add an extra layer of security'}
                </p>
              </div>
            </div>
            {user?.mfaEnabled ? (
              <Button 
                variant="destructive" 
                onClick={() => disableMfaMutation.mutate()}
                disabled={disableMfaMutation.isPending}
                data-testid="button-disable-mfa"
              >
                {disableMfaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Disable 2FA
              </Button>
            ) : (
              <Button 
                onClick={() => setupMfaMutation.mutate()}
                disabled={setupMfaMutation.isPending}
                data-testid="button-enable-mfa"
              >
                {setupMfaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enable 2FA
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Manage devices where you're currently logged in
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => revokeAllSessionsMutation.mutate()}
                disabled={revokeAllSessionsMutation.isPending}
                data-testid="button-revoke-all-sessions"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out all other devices
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(session.deviceType)}
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {session.browser} on {session.os}
                            {session.isCurrent && (
                              <Badge variant="secondary" className="text-xs">Current</Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{session.deviceType}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {session.ipAddress || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.lastActivityAt), 'MMM d, h:mm a')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeSessionMutation.mutate(session.id)}
                          disabled={revokeSessionMutation.isPending}
                          data-testid={`button-revoke-session-${session.id}`}
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showMfaSetup} onOpenChange={setShowMfaSetup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>
          
          {mfaSetupData && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={mfaSetupData.qrCode} alt="MFA QR Code" className="w-48 h-48" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  data-testid="input-mfa-code"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the code from your authenticator app to verify setup
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMfaSetup(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEnableMfa}
              disabled={verificationCode.length !== 6 || enableMfaMutation.isPending}
              data-testid="button-verify-mfa"
            >
              {enableMfaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Your Backup Codes</DialogTitle>
            <DialogDescription>
              Store these codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </DialogDescription>
          </DialogHeader>
          
          {mfaSetupData && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Each code can only be used once. Keep them secure and don't share them.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                {mfaSetupData.backupCodes.map((code, index) => (
                  <div key={index} className="p-2 bg-background rounded">
                    {code}
                  </div>
                ))}
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={copyBackupCodes}
                data-testid="button-copy-backup-codes"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copiedBackupCodes ? 'Copied!' : 'Copy All Codes'}
              </Button>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowBackupCodes(false)} data-testid="button-close-backup-codes">
              I've Saved These Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
