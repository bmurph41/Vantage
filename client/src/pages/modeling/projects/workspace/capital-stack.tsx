import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/formatUtils';
import {
  Plus,
  Trash2,
  Edit,
  Building2,
  DollarSign,
  Percent,
  Layers,
  PieChart,
  TrendingUp,
  Calculator,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import type { CapitalStack, DebtTranche, EquityLayer, CapitalStackProjection } from '@shared/schema';

interface CapitalStackWorkspaceProps {
  projectId: string;
}

const DEBT_TRANCHE_TYPES = [
  { value: 'senior', label: 'Senior Debt' },
  { value: 'mezzanine', label: 'Mezzanine' },
  { value: 'bridge', label: 'Bridge Loan' },
  { value: 'construction', label: 'Construction Loan' },
  { value: 'sba', label: 'SBA Loan' },
  { value: 'cmbs', label: 'CMBS' },
  { value: 'credit_union', label: 'Credit Union' },
  { value: 'other', label: 'Other' },
];

const EQUITY_LAYER_TYPES = [
  { value: 'common', label: 'Common Equity' },
  { value: 'preferred', label: 'Preferred Equity' },
  { value: 'promote', label: 'GP Promote' },
  { value: 'co_invest', label: 'Co-Invest' },
];

function formatDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '0' : num.toFixed(2);
}

export default function CapitalStackWorkspace({ projectId }: CapitalStackWorkspaceProps) {
  const { toast } = useToast();
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [showCreateStack, setShowCreateStack] = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddEquity, setShowAddEquity] = useState(false);
  const [noi, setNoi] = useState('1000000');
  const [noiGrowthRate, setNoiGrowthRate] = useState('0.02');

  const { data: stacks, isLoading: stacksLoading } = useQuery<CapitalStack[]>({
    queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'],
  });

  const { data: stackDetails, isLoading: detailsLoading } = useQuery<{
    stack: CapitalStack;
    debtTranches: DebtTranche[];
    equityLayers: EquityLayer[];
    projections: CapitalStackProjection[];
  }>({
    queryKey: ['/api/modeling/capital-stacks', selectedStackId],
    enabled: !!selectedStackId,
  });

  const createStackMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/modeling/projects/${projectId}/capital-stacks`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'] });
      setShowCreateStack(false);
      toast({ title: 'Capital stack created' });
    },
  });

  const deleteStackMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/modeling/capital-stacks/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'] });
      setSelectedStackId(null);
      toast({ title: 'Capital stack deleted' });
    },
  });

  const createDebtMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/modeling/capital-stacks/${selectedStackId}/debt-tranches`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      setShowAddDebt(false);
      toast({ title: 'Debt tranche added' });
    },
  });

  const deleteDebtMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/modeling/debt-tranches/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      toast({ title: 'Debt tranche deleted' });
    },
  });

  const createEquityMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/modeling/capital-stacks/${selectedStackId}/equity-layers`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      setShowAddEquity(false);
      toast({ title: 'Equity layer added' });
    },
  });

  const deleteEquityMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/modeling/equity-layers/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      toast({ title: 'Equity layer deleted' });
    },
  });

  const generateProjectionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/modeling/capital-stacks/${selectedStackId}/projections/generate`, {
        method: 'POST',
        body: JSON.stringify({ noi: parseFloat(noi), noiGrowthRate: parseFloat(noiGrowthRate) }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      toast({ title: 'Projections generated' });
    },
  });

  if (stacksLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const stack = stackDetails?.stack;
  const debtTranches = stackDetails?.debtTranches || [];
  const equityLayers = stackDetails?.equityLayers || [];
  const projections = stackDetails?.projections || [];

  const totalDebt = debtTranches.reduce((sum, t) => sum + parseFloat(t.principal?.toString() || '0'), 0);
  const totalEquity = equityLayers.reduce((sum, l) => sum + parseFloat(l.commitmentAmount?.toString() || '0'), 0);
  const totalCap = totalDebt + totalEquity;
  const ltv = totalCap > 0 ? (totalDebt / totalCap) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Capital Stack Builder</h2>
          <p className="text-muted-foreground">Configure debt tranches, equity layers, and waterfall distributions</p>
        </div>
        <Dialog open={showCreateStack} onOpenChange={setShowCreateStack}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-capital-stack">
              <Plus className="h-4 w-4 mr-2" />
              New Capital Stack
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Capital Stack</DialogTitle>
              <DialogDescription>Define the capital structure for this deal</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              createStackMutation.mutate({
                name: formData.get('name'),
                purchasePrice: formData.get('purchasePrice'),
                totalCapitalization: formData.get('purchasePrice'),
                closingCosts: formData.get('closingCosts') || '0',
                capexReserves: formData.get('capexReserves') || '0',
                holdPeriodYears: parseInt(formData.get('holdPeriodYears') as string) || 5,
                exitCapRate: formData.get('exitCapRate') || '0.07',
              });
            }}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Stack Name</Label>
                  <Input id="name" name="name" placeholder="Base Case" required />
                </div>
                <div>
                  <Label htmlFor="purchasePrice">Purchase Price</Label>
                  <Input id="purchasePrice" name="purchasePrice" type="number" placeholder="10000000" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="closingCosts">Closing Costs</Label>
                    <Input id="closingCosts" name="closingCosts" type="number" placeholder="100000" />
                  </div>
                  <div>
                    <Label htmlFor="capexReserves">CapEx Reserves</Label>
                    <Input id="capexReserves" name="capexReserves" type="number" placeholder="200000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="holdPeriodYears">Hold Period (Years)</Label>
                    <Input id="holdPeriodYears" name="holdPeriodYears" type="number" placeholder="5" defaultValue="5" />
                  </div>
                  <div>
                    <Label htmlFor="exitCapRate">Exit Cap Rate</Label>
                    <Input id="exitCapRate" name="exitCapRate" type="number" step="0.001" placeholder="0.07" defaultValue="0.07" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createStackMutation.isPending}>
                  {createStackMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(!stacks || stacks.length === 0) ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Capital Stacks</h3>
          <p className="text-muted-foreground mb-4">Create a capital stack to model debt and equity structure</p>
          <Button onClick={() => setShowCreateStack(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Capital Stack
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Capital Stacks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stacks.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedStackId === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedStackId(s.id)}
                    data-testid={`stack-item-${s.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.name}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <div className="text-sm opacity-80">
                      {formatCurrency(parseFloat(s.purchasePrice?.toString() || '0'))}
                    </div>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-9">
            {!selectedStackId ? (
              <Card className="p-8 text-center">
                <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Capital Stack</h3>
                <p className="text-muted-foreground">Choose a capital stack from the left to view and edit</p>
              </Card>
            ) : detailsLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{formatCurrency(parseFloat(stack?.purchasePrice?.toString() || '0'))}</div>
                      <div className="text-sm text-muted-foreground">Purchase Price</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{formatCurrency(totalDebt)}</div>
                      <div className="text-sm text-muted-foreground">Total Debt</div>
                      <Progress value={ltv} className="mt-2 h-2" />
                      <div className="text-xs text-muted-foreground mt-1">{ltv.toFixed(1)}% LTV</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{formatCurrency(totalEquity)}</div>
                      <div className="text-sm text-muted-foreground">Total Equity</div>
                      <Progress value={100 - ltv} className="mt-2 h-2" />
                      <div className="text-xs text-muted-foreground mt-1">{(100 - ltv).toFixed(1)}% Equity</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{stack?.holdPeriodYears || 5} Years</div>
                      <div className="text-sm text-muted-foreground">Hold Period</div>
                      <div className="text-xs text-muted-foreground mt-1">Exit @ {formatPercent(parseFloat(stack?.exitCapRate?.toString() || '0.07') * 100)} Cap</div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="debt" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="debt" className="gap-2">
                      <DollarSign className="h-4 w-4" />
                      Debt Tranches
                    </TabsTrigger>
                    <TabsTrigger value="equity" className="gap-2">
                      <PieChart className="h-4 w-4" />
                      Equity Layers
                    </TabsTrigger>
                    <TabsTrigger value="projections" className="gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Projections
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="debt" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Debt Tranches</h3>
                      <Dialog open={showAddDebt} onOpenChange={setShowAddDebt}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-add-debt">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Tranche
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Debt Tranche</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target as HTMLFormElement);
                            createDebtMutation.mutate({
                              name: formData.get('name'),
                              trancheType: formData.get('trancheType'),
                              lenderName: formData.get('lenderName'),
                              principal: formData.get('principal'),
                              interestRate: formData.get('interestRate'),
                              termYears: parseInt(formData.get('termYears') as string),
                              amortizationYears: parseInt(formData.get('amortizationYears') as string) || null,
                              interestOnlyMonths: parseInt(formData.get('interestOnlyMonths') as string) || 0,
                              priority: debtTranches.length + 1,
                            });
                          }}>
                            <div className="space-y-4 py-4">
                              <div>
                                <Label htmlFor="debtName">Tranche Name</Label>
                                <Input id="debtName" name="name" placeholder="Senior Loan" required />
                              </div>
                              <div>
                                <Label htmlFor="trancheType">Type</Label>
                                <Select name="trancheType" defaultValue="senior">
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DEBT_TRANCHE_TYPES.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="lenderName">Lender</Label>
                                <Input id="lenderName" name="lenderName" placeholder="First National Bank" />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="principal">Principal</Label>
                                  <Input id="principal" name="principal" type="number" placeholder="5000000" required />
                                </div>
                                <div>
                                  <Label htmlFor="interestRate">Interest Rate</Label>
                                  <Input id="interestRate" name="interestRate" type="number" step="0.0001" placeholder="0.065" required />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <Label htmlFor="termYears">Term (Years)</Label>
                                  <Input id="termYears" name="termYears" type="number" placeholder="10" required />
                                </div>
                                <div>
                                  <Label htmlFor="amortizationYears">Amort (Years)</Label>
                                  <Input id="amortizationYears" name="amortizationYears" type="number" placeholder="30" />
                                </div>
                                <div>
                                  <Label htmlFor="interestOnlyMonths">I/O (Months)</Label>
                                  <Input id="interestOnlyMonths" name="interestOnlyMonths" type="number" placeholder="24" />
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={createDebtMutation.isPending}>
                                {createDebtMutation.isPending ? 'Adding...' : 'Add Tranche'}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {debtTranches.length === 0 ? (
                      <Card className="p-6 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No debt tranches configured</p>
                      </Card>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Priority</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Principal</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Term</TableHead>
                            <TableHead>Annual D/S</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debtTranches.map((tranche) => (
                            <TableRow key={tranche.id}>
                              <TableCell>
                                <Badge variant="outline">{tranche.priority}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{tranche.name}</TableCell>
                              <TableCell>
                                <Badge>{DEBT_TRANCHE_TYPES.find(t => t.value === tranche.trancheType)?.label || tranche.trancheType}</Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(parseFloat(tranche.principal?.toString() || '0'))}</TableCell>
                              <TableCell>{formatPercent(parseFloat(tranche.interestRate?.toString() || '0') * 100)}</TableCell>
                              <TableCell>{tranche.termYears}y / {tranche.amortizationYears || 'I/O'}y</TableCell>
                              <TableCell>{formatCurrency(parseFloat(tranche.annualDebtService?.toString() || '0'))}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteDebtMutation.mutate(tranche.id)}
                                  data-testid={`button-delete-debt-${tranche.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="equity" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Equity Layers</h3>
                      <Dialog open={showAddEquity} onOpenChange={setShowAddEquity}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-add-equity">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Layer
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Equity Layer</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target as HTMLFormElement);
                            createEquityMutation.mutate({
                              name: formData.get('name'),
                              layerType: formData.get('layerType'),
                              investorName: formData.get('investorName'),
                              commitmentAmount: formData.get('commitmentAmount'),
                              ownershipPct: formData.get('ownershipPct'),
                              preferredReturn: formData.get('preferredReturn') || null,
                              waterfallPriority: equityLayers.length + 1,
                            });
                          }}>
                            <div className="space-y-4 py-4">
                              <div>
                                <Label htmlFor="equityName">Layer Name</Label>
                                <Input id="equityName" name="name" placeholder="LP Equity" required />
                              </div>
                              <div>
                                <Label htmlFor="layerType">Type</Label>
                                <Select name="layerType" defaultValue="common">
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EQUITY_LAYER_TYPES.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="investorName">Investor Name</Label>
                                <Input id="investorName" name="investorName" placeholder="ABC Partners" />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="commitmentAmount">Commitment</Label>
                                  <Input id="commitmentAmount" name="commitmentAmount" type="number" placeholder="5000000" required />
                                </div>
                                <div>
                                  <Label htmlFor="ownershipPct">Ownership %</Label>
                                  <Input id="ownershipPct" name="ownershipPct" type="number" step="0.0001" placeholder="0.90" required />
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="preferredReturn">Preferred Return</Label>
                                <Input id="preferredReturn" name="preferredReturn" type="number" step="0.01" placeholder="0.08" />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={createEquityMutation.isPending}>
                                {createEquityMutation.isPending ? 'Adding...' : 'Add Layer'}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {equityLayers.length === 0 ? (
                      <Card className="p-6 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No equity layers configured</p>
                      </Card>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Priority</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Commitment</TableHead>
                            <TableHead>Ownership</TableHead>
                            <TableHead>Pref Return</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {equityLayers.map((layer) => (
                            <TableRow key={layer.id}>
                              <TableCell>
                                <Badge variant="outline">{layer.waterfallPriority}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{layer.name}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{EQUITY_LAYER_TYPES.find(t => t.value === layer.layerType)?.label || layer.layerType}</Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(parseFloat(layer.commitmentAmount?.toString() || '0'))}</TableCell>
                              <TableCell>{formatPercent(parseFloat(layer.ownershipPct?.toString() || '0') * 100)}</TableCell>
                              <TableCell>{layer.preferredReturn ? formatPercent(parseFloat(layer.preferredReturn.toString()) * 100) : '-'}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteEquityMutation.mutate(layer.id)}
                                  data-testid={`button-delete-equity-${layer.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="projections" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Generate Projections</CardTitle>
                        <CardDescription>Calculate cash flows and returns based on NOI assumptions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 items-end">
                          <div>
                            <Label htmlFor="noi">Starting NOI</Label>
                            <Input
                              id="noi"
                              type="number"
                              value={noi}
                              onChange={(e) => setNoi(e.target.value)}
                              placeholder="1000000"
                            />
                          </div>
                          <div>
                            <Label htmlFor="noiGrowth">Annual Growth Rate</Label>
                            <Input
                              id="noiGrowth"
                              type="number"
                              step="0.01"
                              value={noiGrowthRate}
                              onChange={(e) => setNoiGrowthRate(e.target.value)}
                              placeholder="0.02"
                            />
                          </div>
                          <Button
                            onClick={() => generateProjectionsMutation.mutate()}
                            disabled={generateProjectionsMutation.isPending}
                            data-testid="button-generate-projections"
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${generateProjectionsMutation.isPending ? 'animate-spin' : ''}`} />
                            Generate
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {projections.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Cash Flow Projections
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Year</TableHead>
                                <TableHead>NOI</TableHead>
                                <TableHead>Debt Service</TableHead>
                                <TableHead>Cash Flow</TableHead>
                                <TableHead>DSCR</TableHead>
                                <TableHead>Cash on Cash</TableHead>
                                <TableHead>Exit Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {projections.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium">Year {p.year}</TableCell>
                                  <TableCell>{formatCurrency(parseFloat(p.noi?.toString() || '0'))}</TableCell>
                                  <TableCell>{formatCurrency(parseFloat(p.totalDebtService?.toString() || '0'))}</TableCell>
                                  <TableCell className={parseFloat(p.cashFlowAfterDebt?.toString() || '0') < 0 ? 'text-destructive' : ''}>
                                    {formatCurrency(parseFloat(p.cashFlowAfterDebt?.toString() || '0'))}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={parseFloat(p.dscr?.toString() || '0') >= 1.25 ? 'default' : 'destructive'}>
                                      {formatDecimal(p.dscr)}x
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{formatPercent(parseFloat(p.cashOnCash?.toString() || '0') * 100)}</TableCell>
                                  <TableCell>{p.exitValue ? formatCurrency(parseFloat(p.exitValue.toString())) : '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          {projections.length > 0 && projections[projections.length - 1].irr && (
                            <div className="mt-6 grid grid-cols-3 gap-4">
                              <Card className="bg-primary/5">
                                <CardContent className="pt-4 text-center">
                                  <div className="text-3xl font-bold text-primary">
                                    {formatPercent(parseFloat(projections[projections.length - 1].irr?.toString() || '0') * 100)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Levered IRR</div>
                                </CardContent>
                              </Card>
                              <Card className="bg-primary/5">
                                <CardContent className="pt-4 text-center">
                                  <div className="text-3xl font-bold text-primary">
                                    {formatDecimal(projections[projections.length - 1].equityMultiple)}x
                                  </div>
                                  <div className="text-sm text-muted-foreground">Equity Multiple</div>
                                </CardContent>
                              </Card>
                              <Card className="bg-primary/5">
                                <CardContent className="pt-4 text-center">
                                  <div className="text-3xl font-bold text-primary">
                                    {formatCurrency(parseFloat(projections[projections.length - 1].netSaleProceeds?.toString() || '0'))}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Net Proceeds</div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Delete this capital stack?')) {
                        deleteStackMutation.mutate(selectedStackId);
                      }
                    }}
                    data-testid="button-delete-stack"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Stack
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
