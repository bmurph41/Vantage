import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  UserPlus,
  Clock,
  TrendingUp,
  Send,
  CheckCircle2,
  XCircle,
  Timer,
  ChevronRight,
  Anchor,
} from 'lucide-react';

interface WaitlistPanelProps {
  propertyId: string;
}

const BAND_LABELS: Record<string, string> = {
  '0-25': '0–25 ft',
  '26-35': '26–35 ft',
  '36-45': '36–45 ft',
  '46-60': '46–60 ft',
  '61+': '61+ ft',
  'all': 'All Sizes',
};

const STATUS_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  waiting: { variant: 'outline', label: 'Waiting' },
  offered: { variant: 'default', label: 'Offered' },
  accepted: { variant: 'default', label: 'Accepted' },
  declined: { variant: 'destructive', label: 'Declined' },
  expired: { variant: 'secondary', label: 'Expired' },
  cancelled: { variant: 'secondary', label: 'Cancelled' },
  pending: { variant: 'default', label: 'Pending' },
};

export default function WaitlistPanel({ propertyId }: WaitlistPanelProps) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [selectedWaitlistId, setSelectedWaitlistId] = useState<string | null>(null);
  const [entriesDrawerOpen, setEntriesDrawerOpen] = useState(false);
  const [offerDrawerOpen, setOfferDrawerOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [newWl, setNewWl] = useState({ name: '', unitType: 'wet_slip', bandKey: '' });
  const [newEntry, setNewEntry] = useState({
    contactName: '', contactEmail: '', contactPhone: '',
    boatName: '', boatLengthFt: '', notes: '',
  });
  const [offerUnit, setOfferUnit] = useState({ unitId: '', unitCode: '', notes: '' });

  const { data: waitlistsData, isLoading: wlLoading } = useQuery({
    queryKey: ['/api/waitlist/property', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/waitlist/property/${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch waitlists');
      return res.json();
    },
    enabled: !!propertyId,
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/waitlist/metrics', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/waitlist/metrics/${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    enabled: !!propertyId,
  });

  const { data: entriesData } = useQuery({
    queryKey: ['/api/waitlist', selectedWaitlistId, 'entries'],
    queryFn: async () => {
      const res = await fetch(`/api/waitlist/${selectedWaitlistId}/entries`);
      if (!res.ok) throw new Error('Failed to fetch entries');
      return res.json();
    },
    enabled: !!selectedWaitlistId && entriesDrawerOpen,
  });

  const { data: offersData } = useQuery({
    queryKey: ['/api/waitlist', selectedWaitlistId, 'entries', selectedEntryId, 'offers'],
    queryFn: async () => {
      const res = await fetch(`/api/waitlist/${selectedWaitlistId}/entries/${selectedEntryId}/offers`);
      if (!res.ok) throw new Error('Failed to fetch offers');
      return res.json();
    },
    enabled: !!selectedWaitlistId && !!selectedEntryId && offerDrawerOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/waitlist', {
        ...data,
        propertyId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist/property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist/metrics', propertyId] });
      setCreateOpen(false);
      setNewWl({ name: '', unitType: 'wet_slip', bandKey: '' });
      toast({ title: 'Waitlist created' });
    },
    onError: () => toast({ title: 'Failed to create waitlist', variant: 'destructive' }),
  });

  const addEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/waitlist/${selectedWaitlistId}/entries`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist', selectedWaitlistId, 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist/metrics', propertyId] });
      setAddEntryOpen(false);
      setNewEntry({ contactName: '', contactEmail: '', contactPhone: '', boatName: '', boatLengthFt: '', notes: '' });
      toast({ title: 'Added to waitlist' });
    },
    onError: () => toast({ title: 'Failed to add entry', variant: 'destructive' }),
  });

  const sendOfferMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/waitlist/${selectedWaitlistId}/entries/${selectedEntryId}/offer`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist', selectedWaitlistId, 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist', selectedWaitlistId, 'entries', selectedEntryId, 'offers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist/metrics', propertyId] });
      setOfferDrawerOpen(false);
      setOfferUnit({ unitId: '', unitCode: '', notes: '' });
      toast({ title: 'Offer sent' });
    },
    onError: () => toast({ title: 'Failed to send offer', variant: 'destructive' }),
  });

  const offerActionMutation = useMutation({
    mutationFn: async ({ offerId, action }: { offerId: string; action: 'accept' | 'decline' | 'expire' }) => {
      const res = await apiRequest('POST', `/api/waitlist/offers/${offerId}/${action}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist', selectedWaitlistId, 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist', selectedWaitlistId, 'entries', selectedEntryId, 'offers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist/metrics', propertyId] });
      toast({ title: 'Offer updated' });
    },
    onError: () => toast({ title: 'Failed to update offer', variant: 'destructive' }),
  });

  const openEntries = (wlId: string) => {
    setSelectedWaitlistId(wlId);
    setEntriesDrawerOpen(true);
  };

  const openOfferDrawer = (entryId: string) => {
    setSelectedEntryId(entryId);
    setOfferDrawerOpen(true);
  };

  const waitlistsList = waitlistsData ?? [];
  const metrics = metricsData ?? {};
  const entries = entriesData ?? [];
  const offers = offersData ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Waitlist & Demand Signals
          </CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <UserPlus className="h-3.5 w-3.5" />
                New Waitlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Waitlist</DialogTitle>
                <DialogDescription>
                  Create a new waitlist for a specific slip type and size band.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={newWl.name}
                    onChange={e => setNewWl(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Wet Slip 36-45ft Waitlist"
                  />
                </div>
                <div>
                  <Label>Unit Type</Label>
                  <Select value={newWl.unitType} onValueChange={v => setNewWl(p => ({ ...p, unitType: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wet_slip">Wet Slip</SelectItem>
                      <SelectItem value="dry_rack">Dry Rack</SelectItem>
                      <SelectItem value="mooring">Mooring</SelectItem>
                      <SelectItem value="lift_slip">Lift Slip</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Size Band (optional)</Label>
                  <Select value={newWl.bandKey || 'none'} onValueChange={v => setNewWl(p => ({ ...p, bandKey: v === 'none' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All Sizes</SelectItem>
                      <SelectItem value="0-25">0–25 ft</SelectItem>
                      <SelectItem value="26-35">26–35 ft</SelectItem>
                      <SelectItem value="36-45">36–45 ft</SelectItem>
                      <SelectItem value="46-60">46–60 ft</SelectItem>
                      <SelectItem value="61+">61+ ft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMutation.mutate({
                    name: newWl.name,
                    unitType: newWl.unitType,
                    bandKey: newWl.bandKey || null,
                  })}
                  disabled={!newWl.name || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Waitlist'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {metricsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{metrics.waitlistCount ?? 0}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Users className="h-3 w-3" /> Waiting
              </div>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">
                {metrics.avgTimeToOfferDays != null ? `${metrics.avgTimeToOfferDays}d` : '—'}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> Avg Time to Offer
              </div>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">
                {metrics.conversionRate != null ? `${metrics.conversionRate}%` : '—'}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3" /> Conversion Rate
              </div>
            </div>
          </div>
        )}

        {metrics.byBand && metrics.byBand.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Demand by Band</div>
            <div className="flex flex-wrap gap-2">
              {metrics.byBand.map((b: any) => (
                <Badge key={b.bandKey} variant="outline" className="text-xs">
                  {BAND_LABELS[b.bandKey] ?? b.bandKey}: {b.waitingCount} waiting
                </Badge>
              ))}
            </div>
          </div>
        )}

        {wlLoading ? (
          <Skeleton className="h-24" />
        ) : waitlistsList.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Anchor className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No waitlists yet. Create one to start tracking demand.
          </div>
        ) : (
          <div className="space-y-2">
            {waitlistsList.map((wl: any) => (
              <div
                key={wl.id}
                className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => openEntries(wl.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{wl.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {wl.unitType.replace('_', ' ')} {wl.bandKey ? `/ ${BAND_LABELS[wl.bandKey] ?? wl.bandKey}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={wl.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {wl.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Sheet open={entriesDrawerOpen} onOpenChange={setEntriesDrawerOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Waitlist Entries</SheetTitle>
            <SheetDescription>
              Manage people on this waitlist. Send offers when units become available.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Button
              size="sm"
              className="gap-1"
              onClick={() => setAddEntryOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add to Waitlist
            </Button>

            {entries.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No entries yet. Add someone to the waitlist.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Boat</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: any) => {
                    const sb = STATUS_BADGES[entry.status] || { variant: 'outline' as const, label: entry.status };
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs">{entry.position}</TableCell>
                        <TableCell className="text-xs font-medium">{entry.contactName}</TableCell>
                        <TableCell className="text-xs">
                          {entry.boatName || '—'}
                          {entry.boatLengthFt ? ` (${entry.boatLengthFt}ft)` : ''}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sb.variant} className="text-xs">{sb.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {entry.status === 'waiting' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() => openOfferDrawer(entry.id)}
                            >
                              <Send className="h-3 w-3" /> Offer
                            </Button>
                          )}
                          {entry.status === 'offered' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() => openOfferDrawer(entry.id)}
                            >
                              View Offers
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Waitlist</DialogTitle>
            <DialogDescription>Add a new person to this waitlist.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Contact Name *</Label>
              <Input
                value={newEntry.contactName}
                onChange={e => setNewEntry(p => ({ ...p, contactName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  value={newEntry.contactEmail}
                  onChange={e => setNewEntry(p => ({ ...p, contactEmail: e.target.value }))}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={newEntry.contactPhone}
                  onChange={e => setNewEntry(p => ({ ...p, contactPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Boat Name</Label>
                <Input
                  value={newEntry.boatName}
                  onChange={e => setNewEntry(p => ({ ...p, boatName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Boat Length (ft)</Label>
                <Input
                  type="number"
                  value={newEntry.boatLengthFt}
                  onChange={e => setNewEntry(p => ({ ...p, boatLengthFt: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newEntry.notes}
                onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addEntryMutation.mutate({
                contactName: newEntry.contactName,
                contactEmail: newEntry.contactEmail || null,
                contactPhone: newEntry.contactPhone || null,
                boatName: newEntry.boatName || null,
                boatLengthFt: newEntry.boatLengthFt || null,
                notes: newEntry.notes || null,
              })}
              disabled={!newEntry.contactName || addEntryMutation.isPending}
            >
              {addEntryMutation.isPending ? 'Adding...' : 'Add to Waitlist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={offerDrawerOpen} onOpenChange={setOfferDrawerOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Manage Offer</SheetTitle>
            <SheetDescription>
              Send a slip offer or manage existing offers for this entry.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-3 border rounded-lg p-3">
              <div className="text-sm font-medium">Send New Offer</div>
              <div>
                <Label>Unit ID</Label>
                <Input
                  value={offerUnit.unitId}
                  onChange={e => setOfferUnit(p => ({ ...p, unitId: e.target.value }))}
                  placeholder="Enter unit ID"
                />
              </div>
              <div>
                <Label>Unit Code (optional)</Label>
                <Input
                  value={offerUnit.unitCode}
                  onChange={e => setOfferUnit(p => ({ ...p, unitCode: e.target.value }))}
                  placeholder="e.g. A-12"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={offerUnit.notes}
                  onChange={e => setOfferUnit(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                />
              </div>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => sendOfferMutation.mutate({
                  unitId: offerUnit.unitId,
                  unitCode: offerUnit.unitCode || null,
                  notes: offerUnit.notes || null,
                })}
                disabled={!offerUnit.unitId || sendOfferMutation.isPending}
              >
                <Send className="h-3.5 w-3.5" />
                {sendOfferMutation.isPending ? 'Sending...' : 'Send Offer'}
              </Button>
            </div>

            {offers.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Offer History</div>
                {offers.map((offer: any) => {
                  const sb = STATUS_BADGES[offer.status] || { variant: 'outline' as const, label: offer.status };
                  return (
                    <div key={offer.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Unit: {offer.unitCode || offer.unitId}
                        </span>
                        <Badge variant={sb.variant} className="text-xs">{sb.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Offered: {new Date(offer.offeredAt).toLocaleDateString()}
                      </div>
                      {offer.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs gap-1"
                            onClick={() => offerActionMutation.mutate({ offerId: offer.id, action: 'accept' })}
                            disabled={offerActionMutation.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => offerActionMutation.mutate({ offerId: offer.id, action: 'decline' })}
                            disabled={offerActionMutation.isPending}
                          >
                            <XCircle className="h-3 w-3" /> Decline
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => offerActionMutation.mutate({ offerId: offer.id, action: 'expire' })}
                            disabled={offerActionMutation.isPending}
                          >
                            <Timer className="h-3 w-3" /> Expire
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
