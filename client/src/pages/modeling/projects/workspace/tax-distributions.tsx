import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/formatUtils';
import {
  Settings2, Users, Layers, Calculator, Play, Plus, Trash2, Edit,
  ChevronDown, ChevronUp, Info, AlertCircle, AlertTriangle,
  DollarSign, Percent, TrendingUp, ArrowUpDown, Loader2, Save,
  Receipt, X,
} from 'lucide-react';

interface Props {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const BASE = '/api/tax-waterfall';

function useTaxSettings(projectId: string) {
  return useQuery<any>({ queryKey: [BASE, 'settings', projectId], queryFn: () => fetch(`${BASE}/projects/${projectId}/settings`, { credentials: 'include' }).then(r => r.json()) });
}
function useTaxProfiles() {
  return useQuery<any[]>({ queryKey: [BASE, 'tax-profiles'], queryFn: () => fetch(`${BASE}/tax-profiles`, { credentials: 'include' }).then(r => r.json()) });
}
function usePartners(projectId: string) {
  return useQuery<any[]>({ queryKey: [BASE, 'partners', projectId], queryFn: () => fetch(`${BASE}/projects/${projectId}/partners`, { credentials: 'include' }).then(r => r.json()) });
}
function useWaterfall(projectId: string) {
  return useQuery<any[]>({ queryKey: [BASE, 'waterfall', projectId], queryFn: () => fetch(`${BASE}/projects/${projectId}/waterfall`, { credentials: 'include' }).then(r => r.json()) });
}
function useTaxInputs(projectId: string) {
  return useQuery<any>({ queryKey: [BASE, 'tax-inputs', projectId], queryFn: () => fetch(`${BASE}/projects/${projectId}/tax-inputs`, { credentials: 'include' }).then(r => r.json()) });
}
function useEquityContributions(projectId: string) {
  return useQuery<any[]>({ queryKey: [BASE, 'equity', projectId], queryFn: () => fetch(`${BASE}/projects/${projectId}/equity-contributions`, { credentials: 'include' }).then(r => r.json()) });
}

function fmtDollars(cents: string | number | null | undefined): string {
  if (cents === null || cents === undefined || cents === '') return '\u2014';
  const n = typeof cents === 'string' ? parseFloat(cents) : cents;
  if (isNaN(n)) return '\u2014';
  return formatCurrency(n / 100);
}

function fmtPct(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '\u2014';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '\u2014';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtIrr(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return '\u2014';
  return `${(v * 100).toFixed(2)}%`;
}

// ─── Settings Panel ─────────────────────────────────────────────────────────

function TaxSettingsPanel({ projectId }: { projectId: string }) {
  const { data: settings, isLoading } = useTaxSettings(projectId);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: (body: any) => apiRequest('PUT', `${BASE}/projects/${projectId}/settings`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'settings', projectId] });
      queryClient.invalidateQueries({ queryKey: [BASE, 'waterfall', projectId] });
      toast({ title: 'Settings saved' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' }),
  });

  const update = (field: string, value: any) => {
    saveMutation.mutate({ ...settings, [field]: value });
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Tax & Distribution Settings</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="tax-enabled" className="text-sm">Enable</Label>
            <Switch
              id="tax-enabled"
              checked={settings?.enabled ?? false}
              onCheckedChange={(v) => update('enabled', v)}
            />
          </div>
        </div>
        <CardDescription>Configure how taxes and distributions are calculated for this project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1">
              Tax Mode
              <TooltipProvider><Tooltip><TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-xs"><p><strong>Flat:</strong> Single effective rate. <strong>Split:</strong> Separate rates for ordinary, capital gains, recapture.</p></TooltipContent></Tooltip></TooltipProvider>
            </Label>
            <Select value={settings?.taxMode ?? 'flat'} onValueChange={(v) => update('taxMode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat Effective Rate</SelectItem>
                <SelectItem value="split">Split Buckets</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1">
              Interaction Mode
              <TooltipProvider><Tooltip><TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-xs"><p><strong>Pre-Tax:</strong> Distribute first, taxes from distributions. <strong>After-Tax:</strong> Pay taxes first, distribute remainder. <strong>Tax Distribution Layer:</strong> Auto-insert tax tier (recommended).</p></TooltipContent></Tooltip></TooltipProvider>
            </Label>
            <Select value={settings?.taxInteractionMode ?? 'waterfall_pre_tax'} onValueChange={(v) => update('taxInteractionMode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="waterfall_pre_tax">Pre-Tax Waterfall</SelectItem>
                <SelectItem value="waterfall_after_tax">After-Tax Waterfall</SelectItem>
                <SelectItem value="tax_distribution_layer">Tax Distribution Layer (Recommended)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tax Timing</Label>
            <Select value={settings?.taxTiming ?? 'annual'} onValueChange={(v) => update('taxTiming', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tax Profile Manager ────────────────────────────────────────────────────

function TaxProfileManager({ projectId }: { projectId: string }) {
  const { data: profiles, isLoading } = useTaxProfiles();
  const { data: settings } = useTaxSettings(projectId);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const resetForm = () => setForm({ name: '', filingType: 'individual', effectiveTaxRate: '', ordinaryRate: '', ltcgRate: '', recaptureRate: '', niitRate: '', stateRate: '', localRate: '', notes: '' });

  const saveMutation = useMutation({
    mutationFn: (body: any) => {
      if (editing) return apiRequest('PUT', `${BASE}/tax-profiles/${editing.id}`, body);
      return apiRequest('POST', `${BASE}/tax-profiles`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'tax-profiles'] });
      setDialogOpen(false);
      setEditing(null);
      toast({ title: editing ? 'Profile updated' : 'Profile created' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save profile', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `${BASE}/tax-profiles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'tax-profiles'] });
      toast({ title: 'Profile deleted' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (profileId: string | null) => apiRequest('PUT', `${BASE}/projects/${projectId}/settings`, { defaultTaxProfileId: profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'settings', projectId] });
      toast({ title: 'Default profile updated' });
    },
  });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, filingType: p.filingType, effectiveTaxRate: p.effectiveTaxRate ?? '', ordinaryRate: p.ordinaryRate ?? '', ltcgRate: p.ltcgRate ?? '', recaptureRate: p.recaptureRate ?? '', niitRate: p.niitRate ?? '', stateRate: p.stateRate ?? '', localRate: p.localRate ?? '', notes: p.notes ?? '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const clean = (v: string) => v === '' ? null : v;
    saveMutation.mutate({ name: form.name, filingType: form.filingType, effectiveTaxRate: clean(form.effectiveTaxRate), ordinaryRate: clean(form.ordinaryRate), ltcgRate: clean(form.ltcgRate), recaptureRate: clean(form.recaptureRate), niitRate: clean(form.niitRate), stateRate: clean(form.stateRate), localRate: clean(form.localRate), notes: clean(form.notes) });
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Tax Profiles</CardTitle>
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New Profile</Button>
        </div>
        <CardDescription>Manage tax rate profiles that can be assigned to partners</CardDescription>
      </CardHeader>
      <CardContent>
        {!profiles?.length ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No tax profiles yet. Create one to get started.</div>
        ) : (
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Filing Type</TableHead>
                <TableHead>Effective Rate</TableHead>
                <TableHead>Ordinary</TableHead>
                <TableHead>LTCG</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.name}
                    {settings?.defaultTaxProfileId === p.id && <Badge variant="outline" className="ml-2 text-xs">Default</Badge>}
                  </TableCell>
                  <TableCell className="capitalize">{p.filingType}</TableCell>
                  <TableCell>{fmtPct(p.effectiveTaxRate)}</TableCell>
                  <TableCell>{fmtPct(p.ordinaryRate)}</TableCell>
                  <TableCell>{fmtPct(p.ltcgRate)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {settings?.defaultTaxProfileId !== p.id ? (
                        <Button variant="ghost" size="sm" onClick={() => setDefaultMutation.mutate(p.id)}>Set Default</Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setDefaultMutation.mutate(null)}>Unset</Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tax Profile' : 'New Tax Profile'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Individual - High Income" />
              </div>
              <div className="space-y-1.5">
                <Label>Filing Type</Label>
                <Select value={form.filingType} onValueChange={(v) => setForm({ ...form, filingType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="corporation">Corporation</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="trust">Trust</SelectItem>
                    <SelectItem value="reit">REIT</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">Effective Tax Rate (for flat mode) <TooltipProvider><Tooltip><TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Enter as decimal (e.g. 0.25 for 25%)</p></TooltipContent></Tooltip></TooltipProvider></Label>
              <Input type="number" step="0.01" min="0" max="1" value={form.effectiveTaxRate} onChange={(e) => setForm({ ...form, effectiveTaxRate: e.target.value })} placeholder="0.25" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Ordinary Rate</Label>
                <Input type="number" step="0.01" min="0" max="1" value={form.ordinaryRate} onChange={(e) => setForm({ ...form, ordinaryRate: e.target.value })} placeholder="0.37" />
              </div>
              <div className="space-y-1.5">
                <Label>LTCG Rate</Label>
                <Input type="number" step="0.01" min="0" max="1" value={form.ltcgRate} onChange={(e) => setForm({ ...form, ltcgRate: e.target.value })} placeholder="0.20" />
              </div>
              <div className="space-y-1.5">
                <Label>Recapture Rate</Label>
                <Input type="number" step="0.01" min="0" max="1" value={form.recaptureRate} onChange={(e) => setForm({ ...form, recaptureRate: e.target.value })} placeholder="0.25" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>NIIT Rate</Label>
                <Input type="number" step="0.01" min="0" max="1" value={form.niitRate} onChange={(e) => setForm({ ...form, niitRate: e.target.value })} placeholder="0.038" />
              </div>
              <div className="space-y-1.5">
                <Label>State Rate</Label>
                <Input type="number" step="0.01" min="0" max="1" value={form.stateRate} onChange={(e) => setForm({ ...form, stateRate: e.target.value })} placeholder="0.05" />
              </div>
              <div className="space-y-1.5">
                <Label>Local Rate</Label>
                <Input type="number" step="0.01" min="0" max="1" value={form.localRate} onChange={(e) => setForm({ ...form, localRate: e.target.value })} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Partners Cap Table ─────────────────────────────────────────────────────

function PartnersCapTable({ projectId }: { projectId: string }) {
  const { data: partners, isLoading } = usePartners(projectId);
  const { data: profiles } = useTaxProfiles();
  const { data: contributions } = useEquityContributions(projectId);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [contribForm, setContribForm] = useState({ partnerId: '', amountCents: '', date: '', label: '' });
  const [contribDialogOpen, setContribDialogOpen] = useState(false);

  const resetForm = () => setForm({ name: '', role: 'lp', entityType: 'individual', taxProfileId: '', ownershipPercent: '' });

  const saveMutation = useMutation({
    mutationFn: (body: any) => {
      if (editing) return apiRequest('PUT', `${BASE}/projects/${projectId}/partners/${editing.id}`, body);
      return apiRequest('POST', `${BASE}/projects/${projectId}/partners`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'partners', projectId] });
      setDialogOpen(false); setEditing(null);
      toast({ title: editing ? 'Partner updated' : 'Partner added' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save partner', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `${BASE}/projects/${projectId}/partners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'partners', projectId] });
      toast({ title: 'Partner removed' });
    },
  });

  const addContribMutation = useMutation({
    mutationFn: (body: any) => apiRequest('POST', `${BASE}/projects/${projectId}/equity-contributions`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'equity', projectId] });
      setContribDialogOpen(false);
      toast({ title: 'Contribution added' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to add contribution', variant: 'destructive' }),
  });

  const openCreate = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, role: p.role, entityType: p.entityType, taxProfileId: p.taxProfileId ?? '', ownershipPercent: p.ownershipPercent ?? '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const clean = (v: string) => v === '' ? null : v;
    saveMutation.mutate({ name: form.name, role: form.role, entityType: form.entityType, taxProfileId: clean(form.taxProfileId), ownershipPercent: clean(form.ownershipPercent) });
  };

  const totalOwnership = (partners ?? []).reduce((s: number, p: any) => s + (parseFloat(p.ownershipPercent ?? '0') || 0), 0);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Partners & Cap Table</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setContribDialogOpen(true)}><DollarSign className="h-4 w-4 mr-1" />Add Contribution</Button>
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Partner</Button>
          </div>
        </div>
        <CardDescription>Define the capital structure and partner roles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {totalOwnership > 0 && Math.abs(totalOwnership - 100) > 0.01 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Ownership percentages sum to {totalOwnership.toFixed(1)}% — should be 100%.</AlertDescription>
          </Alert>
        )}
        {!partners?.length ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No partners configured. Add LP and GP partners.</div>
        ) : (
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Ownership %</TableHead>
                <TableHead>Tax Profile</TableHead>
                <TableHead>Equity Contributed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p: any) => {
                const contribs = (contributions ?? []).filter((c: any) => c.partnerId === p.id);
                const totalContrib = contribs.reduce((s: number, c: any) => s + (parseFloat(c.amountCents ?? '0') || 0), 0);
                const profile = (profiles ?? []).find((pr: any) => pr.id === p.taxProfileId);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-xs">{p.role}</Badge></TableCell>
                    <TableCell>{p.ownershipPercent ? `${p.ownershipPercent}%` : '\u2014'}</TableCell>
                    <TableCell>{profile?.name ?? <span className="text-muted-foreground text-xs">None</span>}</TableCell>
                    <TableCell>{totalContrib > 0 ? fmtDollars(String(totalContrib)) : '\u2014'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Partner' : 'Add Partner'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Partner name" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lp">LP</SelectItem>
                    <SelectItem value="gp">GP</SelectItem>
                    <SelectItem value="co_gp">Co-GP</SelectItem>
                    <SelectItem value="mezz">Mezzanine</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ownership %</Label>
                <Input type="number" step="0.1" min="0" max="100" value={form.ownershipPercent} onChange={(e) => setForm({ ...form, ownershipPercent: e.target.value })} placeholder="90" />
              </div>
              <div className="space-y-1.5">
                <Label>Tax Profile</Label>
                <Select value={form.taxProfileId || 'none'} onValueChange={(v) => setForm({ ...form, taxProfileId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Profile</SelectItem>
                    {(profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contribDialogOpen} onOpenChange={setContribDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Equity Contribution</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Partner</Label>
              <Select value={contribForm.partnerId || 'none'} onValueChange={(v) => setContribForm({ ...contribForm, partnerId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select partner</SelectItem>
                  {(partners ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input type="number" step="1" min="0" value={contribForm.amountCents} onChange={(e) => setContribForm({ ...contribForm, amountCents: e.target.value })} placeholder="5000000" />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={contribForm.date} onChange={(e) => setContribForm({ ...contribForm, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Label (optional)</Label>
              <Input value={contribForm.label} onChange={(e) => setContribForm({ ...contribForm, label: e.target.value })} placeholder="Initial equity" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContribDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!contribForm.partnerId || !contribForm.amountCents) return;
              addContribMutation.mutate({
                partnerId: contribForm.partnerId,
                amountCents: String(Math.round(parseFloat(contribForm.amountCents) * 100)),
                date: contribForm.date || new Date().toISOString().split('T')[0],
                label: contribForm.label || null,
              });
            }} disabled={!contribForm.partnerId || !contribForm.amountCents || addContribMutation.isPending}>
              {addContribMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Waterfall Configurator ─────────────────────────────────────────────────

const TIER_TYPES = [
  { value: 'return_of_capital', label: 'Return of Capital' },
  { value: 'preferred_return', label: 'Preferred Return' },
  { value: 'catch_up', label: 'Catch-Up' },
  { value: 'split', label: 'Profit Split' },
  { value: 'tax_distribution', label: 'Tax Distribution' },
] as const;

const TEMPLATES = [
  { value: 'straight_split', label: 'Straight Split', desc: '90/10 LP/GP split' },
  { value: 'pref_catchup', label: 'Pref + Catch-Up', desc: '8% pref, GP catch-up, 80/20 split' },
  { value: 'irr_hurdles', label: 'IRR Hurdles', desc: 'Tiered waterfall with IRR and equity multiple hurdles' },
];

function WaterfallConfigurator({ projectId }: { projectId: string }) {
  const { data: waterfalls, isLoading } = useWaterfall(projectId);
  const { toast } = useToast();
  const [localTiers, setLocalTiers] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);
  const activeConfig = (waterfalls ?? []).find((w: any) => w.isActive) ?? (waterfalls ?? [])[0];

  const createConfigMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest('POST', `${BASE}/projects/${projectId}/waterfall`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'waterfall', projectId] });
      toast({ title: 'Waterfall created' });
    },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const saveTiersMutation = useMutation({
    mutationFn: ({ tiers, configId }: { tiers: any[]; configId?: string }) => {
      const id = configId ?? activeConfig?.id;
      if (!id) throw new Error('No config');
      return apiRequest('PUT', `${BASE}/projects/${projectId}/waterfall/${id}/tiers`, tiers);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'waterfall', projectId] });
      setDirty(false);
      toast({ title: 'Tiers saved' });
    },
    onError: (e: any) => toast({ title: 'Error', description: String(e?.message ?? 'Failed to save tiers'), variant: 'destructive' }),
  });

  const IRR_HURDLE_TIERS = [
    { tierOrder: 1, tierType: 'return_of_capital', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: null, gpSplit: null, notes: 'Return of contributed capital' },
    { tierOrder: 2, tierType: 'preferred_return', prefRate: '0.08', catchUpTargetGpShare: null, irrHurdle: '0.08', equityMultipleHurdle: '1.0', lpSplit: '100', gpSplit: '0', notes: '8% IRR hurdle — LP preferred return' },
    { tierOrder: 3, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: '0.12', equityMultipleHurdle: '1.5', lpSplit: '80', gpSplit: '20', notes: '12% IRR hurdle — 80/20 split' },
    { tierOrder: 4, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: '0.18', equityMultipleHurdle: '2.0', lpSplit: '70', gpSplit: '30', notes: '18% IRR hurdle — 70/30 split' },
    { tierOrder: 5, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: '60', gpSplit: '40', notes: 'Above 18% IRR — 60/40 split' },
  ];

  const handleTemplateSelect = (templateType: string) => {
    const name = TEMPLATES.find(t => t.value === templateType)?.label ?? 'Custom';
    createConfigMutation.mutate({ name, templateType, isActive: true }, {
      onSuccess: (data: any) => {
        if (templateType === 'irr_hurdles' && data?.id) {
          saveTiersMutation.mutate({ tiers: IRR_HURDLE_TIERS, configId: data.id });
        }
      },
    });
  };

  const updateTier = (idx: number, field: string, value: any) => {
    const next = [...localTiers];
    next[idx] = { ...next[idx], [field]: value };
    setLocalTiers(next);
    setDirty(true);
  };

  const addTier = () => {
    setLocalTiers([...localTiers, { tierOrder: localTiers.length + 1, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: '80', gpSplit: '20', notes: null }]);
    setDirty(true);
  };

  const removeTier = (idx: number) => {
    const next = localTiers.filter((_, i) => i !== idx).map((t, i) => ({ ...t, tierOrder: i + 1 }));
    setLocalTiers(next);
    setDirty(true);
  };

  const moveTier = (idx: number, dir: -1 | 1) => {
    const next = [...localTiers];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setLocalTiers(next.map((t, i) => ({ ...t, tierOrder: i + 1 })));
    setDirty(true);
  };

  const handleSaveTiers = () => {
    saveTiersMutation.mutate({ tiers: localTiers.map(t => ({
      tierOrder: t.tierOrder,
      tierType: t.tierType,
      prefRate: t.prefRate || null,
      catchUpTargetGpShare: t.catchUpTargetGpShare || null,
      irrHurdle: t.irrHurdle || null,
      equityMultipleHurdle: t.equityMultipleHurdle || null,
      lpSplit: t.lpSplit || null,
      gpSplit: t.gpSplit || null,
      notes: t.notes || null,
    })) });
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  if (!activeConfig) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Waterfall Structure</CardTitle>
          </div>
          <CardDescription>Select a template to start</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TEMPLATES.map(t => (
              <Card key={t.value} className={`cursor-pointer hover:border-primary transition-colors`} onClick={() => handleTemplateSelect(t.value)}>
                <CardContent className="pt-4 pb-4">
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (localTiers.length === 0 && activeConfig.tiers?.length > 0) {
    setTimeout(() => setLocalTiers(activeConfig.tiers.map((t: any) => ({ ...t }))), 0);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Waterfall Structure</CardTitle>
            <Badge variant="outline" className="text-xs">{activeConfig.templateType?.replace('_', ' ')}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={addTier}><Plus className="h-4 w-4 mr-1" />Add Tier</Button>
            <Button size="sm" onClick={handleSaveTiers} disabled={!dirty || saveTiersMutation.isPending}>
              {saveTiersMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Tiers
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {localTiers.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No tiers configured.</div>
        ) : (
          <div className="space-y-2">
            {localTiers.map((tier, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 border rounded-md bg-muted/30">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveTier(idx, -1)} disabled={idx === 0}><ChevronUp className="h-3 w-3" /></Button>
                  <span className="text-xs font-mono text-muted-foreground">{tier.tierOrder}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveTier(idx, 1)} disabled={idx === localTiers.length - 1}><ChevronDown className="h-3 w-3" /></Button>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tier Type</Label>
                    <Select value={tier.tierType} onValueChange={(v) => updateTier(idx, 'tierType', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIER_TYPES.map(tt => <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {tier.tierType === 'preferred_return' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Pref Rate</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={tier.prefRate ?? ''} onChange={(e) => updateTier(idx, 'prefRate', e.target.value)} placeholder="0.08" />
                    </div>
                  )}
                  {tier.tierType === 'catch_up' && (
                    <div className="space-y-1">
                      <Label className="text-xs">GP Target Share (%)</Label>
                      <Input className="h-8 text-xs" type="number" step="1" value={tier.catchUpTargetGpShare ?? ''} onChange={(e) => updateTier(idx, 'catchUpTargetGpShare', e.target.value)} placeholder="20" />
                    </div>
                  )}
                  {tier.tierType === 'split' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">LP Split (%)</Label>
                        <Input className="h-8 text-xs" type="number" step="1" value={tier.lpSplit ?? ''} onChange={(e) => updateTier(idx, 'lpSplit', e.target.value)} placeholder="80" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">GP Split (%)</Label>
                        <Input className="h-8 text-xs" type="number" step="1" value={tier.gpSplit ?? ''} onChange={(e) => updateTier(idx, 'gpSplit', e.target.value)} placeholder="20" />
                      </div>
                    </>
                  )}
                  {tier.tierType === 'tax_distribution' && (
                    <div className="col-span-2 flex items-center text-xs text-muted-foreground pt-5">Automatic tax distributions — no splits needed</div>
                  )}
                  {tier.tierType === 'return_of_capital' && (
                    <div className="col-span-2 flex items-center text-xs text-muted-foreground pt-5">Returns contributed capital first</div>
                  )}
                  {(activeConfig?.templateType === 'irr_hurdles' || tier.irrHurdle || tier.equityMultipleHurdle) && tier.tierType !== 'return_of_capital' && tier.tierType !== 'tax_distribution' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">IRR Hurdle</Label>
                        <Input className="h-8 text-xs" type="number" step="0.01" value={tier.irrHurdle ?? ''} onChange={(e) => updateTier(idx, 'irrHurdle', e.target.value)} placeholder="0.12" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Equity Multiple</Label>
                        <Input className="h-8 text-xs" type="number" step="0.1" value={tier.equityMultipleHurdle ?? ''} onChange={(e) => updateTier(idx, 'equityMultipleHurdle', e.target.value)} placeholder="1.5" />
                      </div>
                    </>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive mt-4" onClick={() => removeTier(idx)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tax Inputs Editor ──────────────────────────────────────────────────────

function TaxInputsEditor({ projectId }: { projectId: string }) {
  const { data: taxInputs, isLoading } = useTaxInputs(projectId);
  const { toast } = useToast();
  const [form, setForm] = useState<any>(null);

  const saveMutation = useMutation({
    mutationFn: (body: any) => apiRequest('PUT', `${BASE}/projects/${projectId}/tax-inputs`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE, 'tax-inputs', projectId] });
      toast({ title: 'Tax inputs saved' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' }),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const current = form ?? taxInputs ?? {};
  const depMethod = current.depreciationMethod ?? 'manual';
  const update = (field: string, value: any) => setForm({ ...current, [field]: value });

  const handleSave = () => {
    const toCentsStr = (dollars: string | null) => {
      if (!dollars || dollars === '') return null;
      return String(Math.round(parseFloat(dollars) * 100));
    };
    saveMutation.mutate({
      depreciationMethod: current.depreciationMethod ?? 'manual',
      annualDepreciationCents: toCentsStr(current.annualDepreciationDollars),
      buildingBasisCents: toCentsStr(current.buildingBasisDollars),
      buildingLifeYears: current.buildingLifeYears ? parseInt(current.buildingLifeYears) : null,
      bonusDepreciationPercent: current.bonusDepreciationPercent || null,
      amortizationAnnualCents: toCentsStr(current.amortizationDollars),
      interestDeductible: current.interestDeductible ?? true,
      saleCostBasisCents: toCentsStr(current.saleCostBasisDollars),
      accumulatedDepreciationCents: toCentsStr(current.accumulatedDepreciationDollars),
    });
  };

  const fromCentsToInput = (v: string | null | undefined) => {
    if (!v || v === '' || v === '0') return '';
    return String(parseFloat(v) / 100);
  };

  if (form === null && taxInputs) {
    setTimeout(() => setForm({
      ...taxInputs,
      annualDepreciationDollars: fromCentsToInput(taxInputs.annualDepreciationCents),
      buildingBasisDollars: fromCentsToInput(taxInputs.buildingBasisCents),
      amortizationDollars: fromCentsToInput(taxInputs.amortizationAnnualCents),
      saleCostBasisDollars: fromCentsToInput(taxInputs.saleCostBasisCents),
      accumulatedDepreciationDollars: fromCentsToInput(taxInputs.accumulatedDepreciationCents),
    }), 0);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Tax Inputs</CardTitle>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
        <CardDescription>Depreciation, basis, and sale-related tax inputs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Depreciation Method</Label>
            <Select value={depMethod} onValueChange={(v) => update('depreciationMethod', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Entry</SelectItem>
                <SelectItem value="simple_building_life">Simple Building Life</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={current.interestDeductible ?? true} onCheckedChange={(v) => update('interestDeductible', v)} />
            <Label>Interest is deductible</Label>
          </div>
        </div>

        {depMethod === 'manual' && (
          <div className="space-y-1.5">
            <Label>Annual Depreciation ($)</Label>
            <Input type="number" step="1" value={current.annualDepreciationDollars ?? ''} onChange={(e) => update('annualDepreciationDollars', e.target.value)} placeholder="300000" />
          </div>
        )}

        {depMethod === 'simple_building_life' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Building Basis ($)</Label>
              <Input type="number" step="1" value={current.buildingBasisDollars ?? ''} onChange={(e) => update('buildingBasisDollars', e.target.value)} placeholder="10000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Building Life (years)</Label>
              <Input type="number" step="1" value={current.buildingLifeYears ?? ''} onChange={(e) => update('buildingLifeYears', e.target.value)} placeholder="39" />
            </div>
            <div className="space-y-1.5">
              <Label>Bonus Depreciation %</Label>
              <Input type="number" step="0.01" min="0" max="1" value={current.bonusDepreciationPercent ?? ''} onChange={(e) => update('bonusDepreciationPercent', e.target.value)} placeholder="0.80" />
            </div>
          </div>
        )}

        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Annual Amortization ($)</Label>
            <Input type="number" step="1" value={current.amortizationDollars ?? ''} onChange={(e) => update('amortizationDollars', e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Sale Cost Basis ($)</Label>
            <Input type="number" step="1" value={current.saleCostBasisDollars ?? ''} onChange={(e) => update('saleCostBasisDollars', e.target.value)} placeholder="10000000" />
          </div>
          <div className="space-y-1.5">
            <Label>Accumulated Depreciation ($) <TooltipProvider><Tooltip><TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground inline" /></TooltipTrigger><TooltipContent><p>Override for total accumulated depreciation at sale</p></TooltipContent></Tooltip></TooltipProvider></Label>
            <Input type="number" step="1" value={current.accumulatedDepreciationDollars ?? ''} onChange={(e) => update('accumulatedDepreciationDollars', e.target.value)} placeholder="1000000" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Results Display ────────────────────────────────────────────────────────

function TaxWaterfallResults({ projectId }: { projectId: string }) {
  const { data: settings } = useTaxSettings(projectId);
  const { toast } = useToast();
  const [results, setResults] = useState<any>(null);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<number>>(new Set());

  const calculateMutation = useMutation({
    mutationFn: () => apiRequest('POST', `${BASE}/projects/${projectId}/calculate`),
    onSuccess: (data: any) => {
      setResults(data);
      toast({ title: 'Calculation complete' });
    },
    onError: (e: any) => toast({ title: 'Calculation failed', description: String(e?.message ?? 'Unknown error'), variant: 'destructive' }),
  });

  const togglePeriod = (idx: number) => {
    const next = new Set(expandedPeriods);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setExpandedPeriods(next);
  };

  if (!settings?.enabled) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Enable Tax & Distributions above to run calculations.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          Calculation Results
        </h3>
        <Button onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending} size="sm">
          {calculateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Run Tax + Waterfall Calculation
        </Button>
      </div>

      {!results && !calculateMutation.isPending && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calculator className="h-8 w-8 mx-auto mb-2" />
            <p>Click "Run Calculation" to compute tax-adjusted distributions and returns.</p>
          </CardContent>
        </Card>
      )}

      {results && !results.ok && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{results.error ?? 'Calculation failed'}</AlertDescription>
        </Alert>
      )}

      {results?.ok && (
        <>
          {results.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(results.summary.preTaxIRRByPartner ?? {}).map(([pid, irr]: any) => {
                const afterTax = results.summary.afterTaxIRRByPartner?.[pid];
                const preTaxMoic = results.summary.preTaxMOICByPartner?.[pid];
                const afterTaxMoic = results.summary.afterTaxMOICByPartner?.[pid];
                const taxDrag = results.summary.taxDragByPartner?.[pid];
                return (
                  <Card key={pid}>
                    <CardContent className="pt-4 pb-3 space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">{pid}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        <span className="text-muted-foreground">Pre-Tax IRR</span>
                        <span className="font-medium text-right">{fmtIrr(irr)}</span>
                        <span className="text-muted-foreground">After-Tax IRR</span>
                        <span className="font-medium text-right">{fmtIrr(afterTax)}</span>
                        <span className="text-muted-foreground">Pre-Tax MOIC</span>
                        <span className="font-medium text-right">{preTaxMoic != null ? `${preTaxMoic.toFixed(2)}x` : '\u2014'}</span>
                        <span className="text-muted-foreground">After-Tax MOIC</span>
                        <span className="font-medium text-right">{afterTaxMoic != null ? `${afterTaxMoic.toFixed(2)}x` : '\u2014'}</span>
                        <span className="text-muted-foreground">Tax Drag</span>
                        <span className="font-medium text-right">{taxDrag != null ? `${(taxDrag * 100).toFixed(0)} bps` : '\u2014'}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {results.periodResults?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Period-by-Period Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Cash Available</TableHead>
                      <TableHead className="text-right">Total Tax</TableHead>
                      <TableHead className="text-right">Total Distributed (Pre-Tax)</TableHead>
                      <TableHead className="text-right">Total Distributed (After-Tax)</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.periodResults.map((pr: any, idx: number) => {
                      const totalTax = (pr.taxesByPartner ?? []).reduce((s: number, t: any) => s + Number(BigInt(t.taxDueCents ?? '0')), 0);
                      const totalPreTax = (pr.distributionsPreTaxByPartner ?? []).reduce((s: number, d: any) => s + Number(BigInt(d.amountCents ?? '0')), 0);
                      const totalAfterTax = (pr.distributionsAfterTaxByPartner ?? []).reduce((s: number, d: any) => s + Number(BigInt(d.amountCents ?? '0')), 0);
                      const periodLabel = pr.periodStart ? `${new Date(pr.periodStart).toLocaleDateString()} - ${new Date(pr.periodEnd).toLocaleDateString()}` : `Period ${pr.periodIndex + 1}`;
                      const isExpanded = expandedPeriods.has(idx);

                      return (
                        <Collapsible key={idx} open={isExpanded} onOpenChange={() => togglePeriod(idx)} asChild>
                          <>
                            <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => togglePeriod(idx)}>
                              <TableCell className="font-mono text-xs">{pr.periodIndex + 1}</TableCell>
                              <TableCell className="text-sm">{periodLabel}</TableCell>
                              <TableCell className="text-right font-medium">{fmtDollars(pr.cashAvailableCents)}</TableCell>
                              <TableCell className="text-right">{fmtDollars(String(totalTax))}</TableCell>
                              <TableCell className="text-right">{fmtDollars(String(totalPreTax))}</TableCell>
                              <TableCell className="text-right">{fmtDollars(String(totalAfterTax))}</TableCell>
                              <TableCell>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </Button>
                                </CollapsibleTrigger>
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                              <TableRow>
                                <TableCell colSpan={7} className="bg-muted/20 p-4">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground mb-1">Taxable Buckets</p>
                                      <div className="flex gap-4 text-xs">
                                        <span>Ordinary: {fmtDollars(pr.taxableBucketsCents?.ordinary)}</span>
                                        <span>Capital Gain: {fmtDollars(pr.taxableBucketsCents?.capGain)}</span>
                                        <span>Recapture: {fmtDollars(pr.taxableBucketsCents?.recapture)}</span>
                                      </div>
                                    </div>

                                    {pr.taxesByPartner?.length > 0 && (
                                      <div>
                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Taxes by Partner</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                          {pr.taxesByPartner.map((t: any) => (
                                            <div key={t.partnerId} className="text-xs border rounded p-2">
                                              <span className="font-medium">{t.partnerId}</span>
                                              <div className="text-muted-foreground mt-1">
                                                Tax Due: {fmtDollars(t.taxDueCents)}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {pr.waterfallBreakdown?.length > 0 && (
                                      <div>
                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Waterfall Breakdown</p>
                                        <div className="space-y-1">
                                          {pr.waterfallBreakdown.map((wb: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                              <Badge variant="outline" className="text-xs">{wb.tierType}</Badge>
                                              <span className="text-muted-foreground">Distributed: {fmtDollars(wb.distributedCents)}</span>
                                              {wb.remaining != null && <span className="text-muted-foreground">Remaining: {fmtDollars(wb.remainingCents)}</span>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {pr.warnings?.length > 0 && (
                                      <div>
                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Warnings</p>
                                        {pr.warnings.map((w: string, i: number) => (
                                          <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />{w}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TaxAndDistributionsPage({ projectId, onTabChange }: Props) {
  const { data: settings, isLoading } = useTaxSettings(projectId);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['settings']));

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedSections(next);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isEnabled = settings?.enabled ?? false;

  const sections = [
    { id: 'settings', label: 'Settings', icon: Settings2, alwaysShow: true },
    { id: 'profiles', label: 'Tax Profiles', icon: Receipt },
    { id: 'partners', label: 'Partners & Cap Table', icon: Users },
    { id: 'waterfall', label: 'Waterfall Structure', icon: Layers },
    { id: 'tax-inputs', label: 'Tax Inputs', icon: Calculator },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Tax & Distributions
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Configure tax calculations, partner distributions, and waterfall structures</p>
      </div>

      <TaxSettingsPanel projectId={projectId} />

      {!isEnabled && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Tax & Distributions is disabled. Enable it above to configure and run calculations. You can still set up profiles, partners, and waterfall tiers.</AlertDescription>
        </Alert>
      )}

      {sections.filter(s => s.id !== 'settings').map(section => {
        const Icon = section.icon;
        const isOpen = expandedSections.has(section.id);
        return (
          <Collapsible key={section.id} open={isOpen} onOpenChange={() => toggleSection(section.id)}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-3 h-auto border rounded-md hover:bg-muted/50">
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {section.label}
                </span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {section.id === 'profiles' && <TaxProfileManager projectId={projectId} />}
              {section.id === 'partners' && <PartnersCapTable projectId={projectId} />}
              {section.id === 'waterfall' && <WaterfallConfigurator projectId={projectId} />}
              {section.id === 'tax-inputs' && <TaxInputsEditor projectId={projectId} />}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <Separator className="my-4" />

      <TaxWaterfallResults projectId={projectId} />
    </div>
  );
}
