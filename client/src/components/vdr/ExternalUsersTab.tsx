import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ExternalUser, ExternalUserProjectAccess, InsertExternalUser, insertExternalUserSchema } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, Building, Briefcase, Calendar, FolderOpen, FileText, Clock, Shield } from 'lucide-react';
import { format } from 'date-fns';

type ProjectExternalUser = ExternalUser & { access: ExternalUserProjectAccess };

interface ExternalUsersTabProps {
  projectId: string;
}

const formSchema = insertExternalUserSchema.extend({
  accessLevel: z.enum(['view_only', 'view_download', 'view_download_print', 'full_access']).default('view_only'),
});

export function ExternalUsersTab({ projectId }: ExternalUsersTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: externalUsers = [], isLoading } = useQuery<ProjectExternalUser[]>({
    queryKey: ['/api/vdr/projects', projectId, 'external-users'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest(`/api/vdr/projects/${projectId}/external-users`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'external-users'] });
      toast({ title: 'External user invited successfully' });
      setDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Failed to invite user', variant: 'destructive' });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      name: '',
      company: '',
      role: 'consultant',
      accessLevel: 'view_only',
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data);
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      consultant: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      auditor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      legal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      investor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      broker: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    };
    return colors[role] || colors.other;
  };

  const getAccessStatusBadge = (status: string) => {
    const styles: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string }> = {
      active: { variant: 'default', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
      revoked: { variant: 'destructive', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
      expired: { variant: 'secondary', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
    };
    return styles[status] || styles.active;
  };

  const isAccessExpiringSoon = (expiresAt: string | Date | null): boolean => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const msUntilExpiry = expiryDate.getTime() - Date.now();
    const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading external users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">External Users</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage external stakeholder access to the data room
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-invite-external-user">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite External User</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="user@example.com"
                          data-testid="input-external-user-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="John Doe"
                          data-testid="input-external-user-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          placeholder="ACME Corp"
                          data-testid="input-external-user-company"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-external-user-role">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="consultant">Consultant</SelectItem>
                          <SelectItem value="auditor">Auditor</SelectItem>
                          <SelectItem value="legal">Legal</SelectItem>
                          <SelectItem value="investor">Investor</SelectItem>
                          <SelectItem value="broker">Broker</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accessLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-external-user-access-level">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="view_only">View Only (Metadata)</SelectItem>
                          <SelectItem value="view_download">View & Download</SelectItem>
                          <SelectItem value="view_download_print">View, Download & Print</SelectItem>
                          <SelectItem value="full_access">Full Access (Manage)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    data-testid="button-cancel-invite"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-invite"
                  >
                    {createMutation.isPending ? 'Inviting...' : 'Send Invitation'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {externalUsers.length === 0 ? (
        <Card className="p-12 text-center">
          <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No External Users</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Invite consultants, auditors, and other stakeholders to access specific documents
          </p>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-invite-first-user">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite First User
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {externalUsers.map((user) => (
            <Card key={user.id} className="p-4" data-testid={`card-external-user-${user.id}`}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-lg" data-testid={`text-user-name-${user.id}`}>
                        {user.name}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                      <Badge 
                        variant={getAccessStatusBadge(user.access.status).variant}
                        className={getAccessStatusBadge(user.access.status).className}
                        data-testid={`badge-access-status-${user.id}`}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {user.access.status.charAt(0).toUpperCase() + user.access.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-4 w-4" />
                        <span data-testid={`text-user-email-${user.id}`}>{user.email}</span>
                      </div>
                      {user.company && (
                        <div className="flex items-center gap-1.5">
                          <Building className="h-4 w-4" />
                          <span>{user.company}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {user.invitedAt && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          <span>Invited {format(new Date(user.invitedAt), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {user.access.expiresAt && (
                        <div className={`flex items-center gap-1.5 ${isAccessExpiringSoon(user.access.expiresAt) ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}`}>
                          <Clock className="h-3 w-3" />
                          <span>
                            Expires {format(new Date(user.access.expiresAt), 'MMM d, yyyy')}
                            {isAccessExpiringSoon(user.access.expiresAt) && ' (Soon)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user.access.canViewFolders?.length || 0}</span>
                    <span className="text-muted-foreground">
                      {user.access.canViewFolders?.length === 1 ? 'Folder' : 'Folders'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user.access.canViewRequests?.length || 0}</span>
                    <span className="text-muted-foreground">
                      {user.access.canViewRequests?.length === 1 ? 'Request' : 'Requests'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
