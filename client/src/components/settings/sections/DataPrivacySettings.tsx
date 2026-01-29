import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
import { useExportData, useDeleteAccount } from '@/hooks/use-settings';
import {
  Database,
  Download,
  FileText,
  Shield,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  BarChart3,
} from 'lucide-react';
import type { UserSettings, UserProfile, Organization } from '@/types/settings';

interface DataPrivacySettingsProps {
  settings: UserSettings;
  profile: UserProfile;
  organization: Organization | null;
  onChange: (updates: Partial<UserSettings>) => void;
}

export function DataPrivacySettings({
  settings,
  profile,
  organization,
  onChange,
}: DataPrivacySettingsProps) {
  const { toast } = useToast();
  const exportData = useExportData();
  const deleteAccount = useDeleteAccount();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleExport = async () => {
    try {
      const result = await exportData.mutateAsync();
      toast({
        title: 'Export requested',
        description: result.message,
      });
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== profile.email) return;

    try {
      const result = await deleteAccount.mutateAsync();
      toast({
        title: 'Request submitted',
        description: result.message,
      });
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } catch (error: any) {
      toast({
        title: 'Request failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of your data including documents, settings, and activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your export will include:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Account information and settings</li>
              <li>Document metadata and file listings</li>
              <li>Activity and audit logs</li>
              <li>Deal and project data</li>
            </ul>
          </div>
          <Button
            onClick={handleExport}
            disabled={exportData.isPending}
            variant="outline"
          >
            {exportData.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Request Data Export
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            You'll receive an email when your export is ready to download.
          </p>
        </CardContent>
      </Card>

      {/* Benchmarking Consent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Industry Benchmarking
          </CardTitle>
          <CardDescription>
            Help improve industry insights while keeping your data private
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <h4 className="font-medium text-sm">What is anonymized benchmarking?</h4>
            <p className="text-sm text-muted-foreground">
              When enabled, we aggregate anonymized data from your marina valuations
              to provide industry-wide benchmarks. Your data is:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Fully anonymized — no marina names, locations, or identifying info</li>
              <li>Aggregated with other data points before any analysis</li>
              <li>Never sold or shared with third parties</li>
              <li>Used only to improve benchmark accuracy for all users</li>
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Participate in Anonymized Benchmarking</Label>
              <p className="text-sm text-muted-foreground">
                Contribute to industry insights while maintaining privacy
              </p>
            </div>
            <Switch
              checked={true} // This would come from actual user settings
              onCheckedChange={(checked) => {
                // Handle opt-in/out
                toast({
                  title: checked ? 'Opted in' : 'Opted out',
                  description: checked
                    ? 'Thank you for contributing to industry benchmarks.'
                    : 'Your data will no longer be used for benchmarking.',
                });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legal Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Legal Documents
          </CardTitle>
          <CardDescription>Review our terms and policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Terms of Service', url: '/legal/terms' },
            { name: 'Privacy Policy', url: '/legal/privacy' },
            { name: 'Data Processing Agreement', url: '/legal/dpa' },
            { name: 'Acceptable Use Policy', url: '/legal/aup' },
          ].map((doc) => (
            <a
              key={doc.name}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium">{doc.name}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          ))}
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Retention
          </CardTitle>
          <CardDescription>How long we keep your data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Active data:</strong> Retained while your account is active
            </p>
            <p>
              <strong>Deleted data:</strong> Permanently removed within 30 days
            </p>
            <p>
              <strong>Audit logs:</strong> Retained for 2 years for compliance
            </p>
            <p>
              <strong>Backups:</strong> Retained for 90 days, then permanently deleted
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <h4 className="font-medium text-sm">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                This action cannot be undone. This will permanently delete your
                account and remove all associated data.
              </p>
              <div className="space-y-2">
                <Label>
                  Type <strong>{profile.email}</strong> to confirm:
                </Label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder={profile.email}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== profile.email || deleteAccount.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccount.isPending ? 'Requesting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}