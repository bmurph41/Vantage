import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  CalendarDays, 
  List, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  User,
  Ship,
  DollarSign,
  Bell,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, differenceInDays, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface ExpiringLease {
  id: string;
  tenantName: string;
  slipId: string;
  slipLabel?: string;
  monthlyRent: number;
  expirationDate: string;
  daysUntilExpiration: number;
  contactEmail?: string;
  contactPhone?: string;
  storageType?: string;
  loa?: number;
  hasReminderSet?: boolean;
}

interface LeaseExpirationCalendarProps {
  locationId?: string | null;
  onViewLease?: (leaseId: string) => void;
}

type UrgencyLevel = 'critical' | 'warning' | 'normal';

function getUrgencyLevel(daysUntilExpiration: number): UrgencyLevel {
  if (daysUntilExpiration < 30) return 'critical';
  if (daysUntilExpiration <= 90) return 'warning';
  return 'normal';
}

function getUrgencyColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical': return 'bg-red-500';
    case 'warning': return 'bg-yellow-500';
    case 'normal': return 'bg-green-500';
  }
}

function getUrgencyBadge(urgency: UrgencyLevel) {
  switch (urgency) {
    case 'critical': 
      return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Critical</Badge>;
    case 'warning': 
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock className="h-3 w-3" /> Soon</Badge>;
    case 'normal': 
      return <Badge variant="outline" className="text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> OK</Badge>;
  }
}

export function LeaseExpirationCalendar({ 
  locationId,
  onViewLease,
}: LeaseExpirationCalendarProps) {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<'calendar' | 'list'>('calendar');

  const { data: apiData, isLoading } = useQuery<{
    leases: ExpiringLease[];
    summary: {
      critical: { count: number; revenue: number };
      warning: { count: number; revenue: number };
      normal: { count: number; revenue: number };
      upcoming: { count: number; revenue: number };
      total: { count: number; revenue: number };
    };
  }>({
    queryKey: ['/api/rent-roll/leases/expiring', { locationId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (locationId) params.set('locationId', locationId);
      params.set('days', '180');
      const response = await fetch(`/api/rent-roll/leases/expiring?${params}`);
      if (!response.ok) throw new Error('Failed to fetch expiring leases');
      return response.json();
    },
  });

  const scheduleReminderMutation = useMutation({
    mutationFn: async ({ leaseId, daysBeforeExpiration }: { leaseId: string; daysBeforeExpiration: number }) => {
      return apiRequest(`/api/rent-roll/leases/${leaseId}/schedule-reminder`, {
        method: 'POST',
        body: JSON.stringify({ daysBeforeExpiration }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/renewal-reminders'] });
      toast({ title: 'Success', description: 'Reminder scheduled successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const defaultLeases: ExpiringLease[] = useMemo(() => {
    const today = new Date();
    return [
      { id: '1', tenantName: 'John Smith', slipId: 'A-12', slipLabel: 'Dock A, Slip 12', monthlyRent: 1250, expirationDate: format(addMonths(today, 0.5), 'yyyy-MM-dd'), daysUntilExpiration: 15, storageType: 'Wet Slip', loa: 35 },
      { id: '2', tenantName: 'Sarah Johnson', slipId: 'B-05', slipLabel: 'Dock B, Slip 5', monthlyRent: 1800, expirationDate: format(addMonths(today, 0.7), 'yyyy-MM-dd'), daysUntilExpiration: 21, storageType: 'Wet Slip', loa: 42 },
      { id: '3', tenantName: 'Mike Davis', slipId: 'C-22', slipLabel: 'Dock C, Slip 22', monthlyRent: 950, expirationDate: format(addMonths(today, 1.2), 'yyyy-MM-dd'), daysUntilExpiration: 36, storageType: 'Dry Storage', loa: 28 },
      { id: '4', tenantName: 'Emily Brown', slipId: 'A-08', slipLabel: 'Dock A, Slip 8', monthlyRent: 2100, expirationDate: format(addMonths(today, 1.5), 'yyyy-MM-dd'), daysUntilExpiration: 45, storageType: 'Wet Slip', loa: 50 },
      { id: '5', tenantName: 'Robert Wilson', slipId: 'D-15', slipLabel: 'Dock D, Slip 15', monthlyRent: 1450, expirationDate: format(addMonths(today, 2), 'yyyy-MM-dd'), daysUntilExpiration: 60, storageType: 'Mooring', loa: 38 },
      { id: '6', tenantName: 'Lisa Anderson', slipId: 'B-18', slipLabel: 'Dock B, Slip 18', monthlyRent: 1100, expirationDate: format(addMonths(today, 2.5), 'yyyy-MM-dd'), daysUntilExpiration: 75, storageType: 'Wet Slip', loa: 32 },
      { id: '7', tenantName: 'James Taylor', slipId: 'E-03', slipLabel: 'Rack E, Unit 3', monthlyRent: 650, expirationDate: format(addMonths(today, 3), 'yyyy-MM-dd'), daysUntilExpiration: 90, storageType: 'Dry Rack', loa: 24 },
      { id: '8', tenantName: 'Patricia Martinez', slipId: 'A-25', slipLabel: 'Dock A, Slip 25', monthlyRent: 2500, expirationDate: format(addMonths(today, 4), 'yyyy-MM-dd'), daysUntilExpiration: 120, storageType: 'Wet Slip', loa: 55 },
    ];
  }, []);

  const leases = apiData?.leases && apiData.leases.length > 0 ? apiData.leases : defaultLeases;

  const leasesByDate = useMemo(() => {
    const map: Record<string, ExpiringLease[]> = {};
    leases.forEach(lease => {
      const dateKey = lease.expirationDate.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(lease);
    });
    return map;
  }, [leases]);

  const summary = useMemo(() => {
    const critical = leases.filter(l => l.daysUntilExpiration < 30);
    const warning = leases.filter(l => l.daysUntilExpiration >= 30 && l.daysUntilExpiration <= 90);
    const normal = leases.filter(l => l.daysUntilExpiration > 90);
    
    return {
      critical: { count: critical.length, revenue: critical.reduce((sum, l) => sum + l.monthlyRent, 0) },
      warning: { count: warning.length, revenue: warning.reduce((sum, l) => sum + l.monthlyRent, 0) },
      normal: { count: normal.length, revenue: normal.reduce((sum, l) => sum + l.monthlyRent, 0) },
      total: { count: leases.length, revenue: leases.reduce((sum, l) => sum + l.monthlyRent, 0) },
    };
  }, [leases]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOffset = useMemo(() => {
    return startOfMonth(currentMonth).getDay();
  }, [currentMonth]);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="pt-6 h-[500px] bg-muted/50" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Lease Expiration Calendar
            </CardTitle>
            <CardDescription>
              Track upcoming lease expirations and set renewal reminders
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={activeView === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('calendar')}
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Calendar
            </Button>
            <Button
              variant={activeView === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('list')}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-4 mb-6">
          <div className="p-4 rounded-lg border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Critical (&lt;30 days)</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{summary.critical.count}</p>
            <p className="text-sm text-muted-foreground">{formatCurrency(summary.critical.revenue)}/mo at risk</p>
          </div>
          <div className="p-4 rounded-lg border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Soon (30-90 days)</span>
              <Clock className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">{summary.warning.count}</p>
            <p className="text-sm text-muted-foreground">{formatCurrency(summary.warning.revenue)}/mo</p>
          </div>
          <div className="p-4 rounded-lg border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">On Track (90+ days)</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{summary.normal.count}</p>
            <p className="text-sm text-muted-foreground">{formatCurrency(summary.normal.revenue)}/mo</p>
          </div>
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Expiring</span>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{summary.total.count}</p>
            <p className="text-sm text-muted-foreground">{formatCurrency(summary.total.revenue)}/mo total</p>
          </div>
        </div>

        {activeView === 'calendar' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] bg-muted/20 rounded" />
              ))}
              {calendarDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayLeases = leasesByDate[dateKey] || [];
                const hasLeases = dayLeases.length > 0;
                
                return (
                  <div
                    key={dateKey}
                    className={`min-h-[80px] p-1 rounded border ${
                      isToday(day) ? 'border-primary bg-primary/5' : 'border-muted'
                    } ${hasLeases ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayLeases.slice(0, 2).map(lease => {
                        const urgency = getUrgencyLevel(lease.daysUntilExpiration);
                        return (
                          <div
                            key={lease.id}
                            className={`text-[10px] px-1 py-0.5 rounded truncate ${getUrgencyColor(urgency)} text-white`}
                            title={`${lease.tenantName} - ${lease.slipLabel || lease.slipId}`}
                            onClick={() => onViewLease?.(lease.id)}
                          >
                            {lease.tenantName.split(' ')[0]}
                          </div>
                        );
                      })}
                      {dayLeases.length > 2 && (
                        <div className="text-[10px] text-muted-foreground text-center">
                          +{dayLeases.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Slip/Unit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Monthly Rent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration).map(lease => {
                  const urgency = getUrgencyLevel(lease.daysUntilExpiration);
                  return (
                    <TableRow key={lease.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewLease?.(lease.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{lease.tenantName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Ship className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{lease.slipLabel || lease.slipId}</p>
                            {lease.loa && <p className="text-xs text-muted-foreground">{lease.loa}ft</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lease.storageType || 'Wet Slip'}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(lease.monthlyRent)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{format(parseISO(lease.expirationDate), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-muted-foreground">{lease.daysUntilExpiration} days</p>
                        </div>
                      </TableCell>
                      <TableCell>{getUrgencyBadge(urgency)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled={scheduleReminderMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            scheduleReminderMutation.mutate({ leaseId: lease.id, daysBeforeExpiration: 30 });
                          }}
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default LeaseExpirationCalendar;
