import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Bell, 
  BellOff, 
  Clock, 
  Mail, 
  Settings, 
  Check,
  AlertTriangle,
  Calendar,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO, addDays } from 'date-fns';

interface RenewalReminder {
  id: string;
  leaseId: string;
  reminderDate: string;
  daysBeforeExpiration: number;
  status: 'pending' | 'sent' | 'dismissed' | 'converted';
  sentAt?: string;
  notificationMethod?: string;
  recipientEmail?: string;
  notes?: string;
  lease?: {
    id: string;
    tenantName: string;
    slipLabel: string;
    leaseExpiration: string;
    monthlyRent: number;
  };
}

interface ReminderPreferences {
  enableReminders: boolean;
  defaultDaysBefore: number[];
  notificationMethod: 'email' | 'in_app' | 'both';
  defaultRecipient?: string;
}

interface RenewalRemindersPanelProps {
  locationId?: string;
  onCreateReminder?: (leaseId: string, daysBefore: number) => void;
}

export function RenewalRemindersPanel({ locationId }: RenewalRemindersPanelProps) {
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>('');
  const [selectedDaysBefore, setSelectedDaysBefore] = useState<string>('30');
  
  const [preferences, setPreferences] = useState<ReminderPreferences>({
    enableReminders: true,
    defaultDaysBefore: [30, 60, 90],
    notificationMethod: 'email',
    defaultRecipient: '',
  });

  const { data: reminders = [], isLoading, refetch } = useQuery<RenewalReminder[]>({
    queryKey: ['/api/rent-roll/renewal-reminders', locationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (locationId) params.set('locationId', locationId);
      const response = await fetch(`/api/rent-roll/renewal-reminders?${params}`);
      if (!response.ok) throw new Error('Failed to fetch reminders');
      return response.json();
    },
  });

  const { data: expiringLeases = [] } = useQuery<any[]>({
    queryKey: ['/api/rent-roll/expiring-leases', locationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (locationId) params.set('locationId', locationId);
      params.set('daysAhead', '180');
      const response = await fetch(`/api/rent-roll/expiring-leases?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: async (data: { leaseId: string; daysBeforeExpiration: number }) => {
      return apiRequest('/api/rent-roll/renewal-reminders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/renewal-reminders'] });
      toast({ title: 'Success', description: 'Reminder created successfully' });
      setIsAddReminderOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/rent-roll/renewal-reminders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/renewal-reminders'] });
      toast({ title: 'Success', description: 'Reminder updated' });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/rent-roll/renewal-reminders/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/renewal-reminders'] });
      toast({ title: 'Success', description: 'Reminder deleted' });
    },
  });

  const pendingReminders = reminders.filter(r => r.status === 'pending');
  const sentReminders = reminders.filter(r => r.status === 'sent');
  const completedReminders = reminders.filter(r => ['dismissed', 'converted'].includes(r.status));

  const handleCreateReminder = () => {
    if (!selectedLeaseId) {
      toast({ title: 'Error', description: 'Please select a lease', variant: 'destructive' });
      return;
    }
    createReminderMutation.mutate({
      leaseId: selectedLeaseId,
      daysBeforeExpiration: parseInt(selectedDaysBefore),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'sent':
        return <Badge variant="default" className="flex items-center gap-1"><Mail className="h-3 w-3" /> Sent</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="flex items-center gap-1"><BellOff className="h-3 w-3" /> Dismissed</Badge>;
      case 'converted':
        return <Badge className="bg-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Renewed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="pt-6 h-[400px] bg-muted/50" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Renewal Reminders
            </CardTitle>
            <CardDescription>
              Automate lease renewal notifications and tracking
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Dialog open={isAddReminderOpen} onOpenChange={setIsAddReminderOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Reminder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Renewal Reminder</DialogTitle>
                  <DialogDescription>
                    Set up an automated reminder for lease renewal
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Lease</Label>
                    <Select value={selectedLeaseId} onValueChange={setSelectedLeaseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a lease..." />
                      </SelectTrigger>
                      <SelectContent>
                        {expiringLeases.map((lease: any) => (
                          <SelectItem key={lease.id} value={lease.id}>
                            {lease.tenantName} - {lease.slipLabel || lease.unitNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Days Before Expiration</Label>
                    <Select value={selectedDaysBefore} onValueChange={setSelectedDaysBefore}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="45">45 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="120">120 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddReminderOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateReminder} disabled={createReminderMutation.isPending}>
                    {createReminderMutation.isPending ? 'Creating...' : 'Create Reminder'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reminder Settings</DialogTitle>
                  <DialogDescription>
                    Configure default reminder preferences
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically send renewal reminders
                      </p>
                    </div>
                    <Switch
                      checked={preferences.enableReminders}
                      onCheckedChange={(checked) => 
                        setPreferences({ ...preferences, enableReminders: checked })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Reminder Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {[30, 60, 90].map((days) => (
                        <Button
                          key={days}
                          variant={preferences.defaultDaysBefore.includes(days) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            const newDays = preferences.defaultDaysBefore.includes(days)
                              ? preferences.defaultDaysBefore.filter(d => d !== days)
                              : [...preferences.defaultDaysBefore, days].sort((a, b) => a - b);
                            setPreferences({ ...preferences, defaultDaysBefore: newDays });
                          }}
                        >
                          {days} days
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notification Method</Label>
                    <Select
                      value={preferences.notificationMethod}
                      onValueChange={(value: any) =>
                        setPreferences({ ...preferences, notificationMethod: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email Only</SelectItem>
                        <SelectItem value="in_app">In-App Only</SelectItem>
                        <SelectItem value="both">Email & In-App</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default Recipient Email</Label>
                    <Input
                      type="email"
                      placeholder="manager@marina.com"
                      value={preferences.defaultRecipient || ''}
                      onChange={(e) =>
                        setPreferences({ ...preferences, defaultRecipient: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsSettingsOpen(false)}>Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3 mb-6">
          <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-950/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Pending</span>
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">{pendingReminders.length}</p>
          </div>
          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Sent</span>
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{sentReminders.length}</p>
          </div>
          <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Completed</span>
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{completedReminders.length}</p>
          </div>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pendingReminders.length})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({sentReminders.length})</TabsTrigger>
            <TabsTrigger value="all">All ({reminders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <ScrollArea className="h-[300px]">
              {pendingReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Bell className="h-10 w-10 mb-2 opacity-50" />
                  <p>No pending reminders</p>
                  <Button variant="link" size="sm" onClick={() => setIsAddReminderOpen(true)}>
                    Create one now
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lease</TableHead>
                      <TableHead>Reminder Date</TableHead>
                      <TableHead>Days Before</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingReminders.map((reminder) => (
                      <TableRow key={reminder.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{reminder.lease?.tenantName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{reminder.lease?.slipLabel}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(reminder.reminderDate), 'MM/dd/yyyy')}
                        </TableCell>
                        <TableCell>{reminder.daysBeforeExpiration} days</TableCell>
                        <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateReminderMutation.mutate({ id: reminder.id, status: 'dismissed' })}
                          >
                            <BellOff className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteReminderMutation.mutate(reminder.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sent">
            <ScrollArea className="h-[300px]">
              {sentReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Mail className="h-10 w-10 mb-2 opacity-50" />
                  <p>No sent reminders yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lease</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentReminders.map((reminder) => (
                      <TableRow key={reminder.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{reminder.lease?.tenantName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{reminder.lease?.slipLabel}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {reminder.sentAt ? format(parseISO(reminder.sentAt), 'MM/dd/yyyy h:mm a') : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateReminderMutation.mutate({ id: reminder.id, status: 'converted' })}
                          >
                            <Check className="h-4 w-4 text-green-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="all">
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lease</TableHead>
                    <TableHead>Reminder Date</TableHead>
                    <TableHead>Days Before</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{reminder.lease?.tenantName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{reminder.lease?.slipLabel}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(reminder.reminderDate), 'MM/dd/yyyy')}
                      </TableCell>
                      <TableCell>{reminder.daysBeforeExpiration} days</TableCell>
                      <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReminderMutation.mutate(reminder.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="mt-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>
              <strong>Scheduled Job:</strong> Reminders are processed daily at 8:00 AM. 
              Configure notification preferences in settings.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default RenewalRemindersPanel;
