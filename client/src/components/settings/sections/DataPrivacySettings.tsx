import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { apiRequest, queryClient } from '@/lib/queryClient';
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
  Info,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: benchmarkSettings, isLoading: isLoadingBenchmark } = useQuery<{
    benchmarkOptIn: boolean;
    benchmarkingOptOut: boolean;
    dataBenchmarkingConsent: boolean;
    consentTimestamp: string | null;
    consentVersion: string | null;
  }>({
    queryKey: ['/api/benchmarking/settings'],
  });

  const updateBenchmarkMutation = useMutation({
    mutationFn: async (body: { benchmarkOptIn?: boolean; benchmarkingOptOut?: boolean }) => {
      const response = await apiRequest('PATCH', '/api/benchmarking/settings', body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/benchmarking/settings'] });
    },
  });

  const isOptedIn = benchmarkSettings ? benchmarkSettings.benchmarkOptIn && !benchmarkSettings.benchmarkingOptOut : true;

  const handleToggleBenchmark = (checked: boolean) => {
    if (!checked) {
      setShowOptOutConfirm(true);
      return;
    }
    updateBenchmarkMutation.mutate(
      { benchmarkOptIn: true, benchmarkingOptOut: false },
      {
        onSuccess: () => {
          toast({
            title: 'Opted in',
            description: 'Thank you for contributing to industry benchmarks.',
          });
        },
      }
    );
  };

  const confirmOptOut = () => {
    updateBenchmarkMutation.mutate(
      { benchmarkOptIn: false, benchmarkingOptOut: true },
      {
        onSuccess: () => {
          toast({
            title: 'Opted out',
            description: 'Your data will no longer contribute to benchmarks.',
          });
          setShowOptOutConfirm(false);
        },
      }
    );
  };

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

      {/* Benchmarking Opt-in */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Contribute De-Identified Data to Benchmarks
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>We only use de-identified, aggregated stats (e.g., averages, ranges) and enforce minimum cohort sizes to prevent identifying any one marina.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>
            Help improve MarinaMatch benchmarks by contributing de-identified, aggregated statistics derived from your data. Your marina's identity is never disclosed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Included in benchmark cohorts</Label>
              <p className="text-xs text-muted-foreground">
                This setting does not affect your own dashboards, reports, or modeling outputs — only whether your data contributes to aggregated benchmarks.
              </p>
            </div>
            <Switch
              checked={isOptedIn}
              onCheckedChange={handleToggleBenchmark}
              disabled={isLoadingBenchmark || updateBenchmarkMutation.isPending}
            />
          </div>

          <Separator />

          <Link href="/benchmarking" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            Learn how benchmarking works
            <ExternalLink className="h-3 w-3" />
          </Link>
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
            { name: 'Terms of Service', url: '/terms' },
            { name: 'Privacy Policy', url: '/privacy' },
            { name: 'Benchmarking Policy', url: '/benchmarking' },
          ].map((doc) => (
            <Link
              key={doc.name}
              href={doc.url}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium">{doc.name}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
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

      {/* Opt-out Confirmation Modal */}
      <AlertDialog open={showOptOutConfirm} onOpenChange={setShowOptOutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opt out of benchmarks?</AlertDialogTitle>
            <AlertDialogDescription>
              You can still use all analytics features. Your data just won't contribute to aggregated industry benchmarks. You can opt back in at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmOptOut}
              disabled={updateBenchmarkMutation.isPending}
            >
              {updateBenchmarkMutation.isPending ? 'Updating...' : 'Opt Out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
