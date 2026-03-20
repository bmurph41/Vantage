import { useState, useMemo, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Edit, DollarSign, TrendingUp, Download,
  Wrench, ArrowUpDown, BarChart3, PieChart, CalendarClock,
  AlertTriangle, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, CartesianGrid, Legend, PieChart as RechartsPie,
  Pie, Cell,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────

type Category = 'deferred_maintenance' | 'value_add' | 'recurring' | 'reserves' | 'environmental';
type Priority = 'critical' | 'high' | 'medium' | 'low';

interface CapExItem {
  id: string;
  name: string;
  category: Category;
  estimatedCost: number;
  yearPlanned: number;
  priority: Priority;
  noiImpact: number;
  completionMonths: number;
}

interface CapExAnalysis {
  totalCapex: number;
  deferredMaintenance: number;
  valueAdd: number;
  capexPerUnit: number;
  returnOnCapex: number;
  impliedValueCreation: number;
}

interface CapExBudgetProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'deferred_maintenance', label: 'Deferred Maintenance', color: '#ef4444' },
  { value: 'value_add', label: 'Value-Add', color: '#3b82f6' },
  { value: 'recurring', label: 'Recurring', color: '#8b5cf6' },
  { value: 'reserves', label: 'Reserves', color: '#6b7280' },
  { value: 'environmental', label: 'Environmental', color: '#10b981' },
];

const PRIORITIES: { value: Priority; label: string; variant: string }[] = [
  { value: 'critical', label: 'Critical', variant: 'destructive' },
  { value: 'high', label: 'High', variant: 'warning' },
  { value: 'medium', label: 'Medium', variant: 'secondary' },
  { value: 'low', label: 'Low', variant: 'outline' },
];

const YEAR_OPTIONS = [
  { value: 0, label: 'Year 0 (Closing)' },
  { value: 1, label: 'Year 1' },
  { value: 2, label: 'Year 2' },
  { value: 3, label: 'Year 3' },
  { value: 4, label: 'Year 4' },
  { value: 5, label: 'Year 5' },
];

const categoryColor = (cat: Category) =>
  CATEGORIES.find(c => c.value === cat)?.color ?? '#6b7280';

const categoryLabel = (cat: Category) =>
  CATEGORIES.find(c => c.value === cat)?.label ?? cat;

const priorityBadge = (p: Priority) => {
  const map: Record<Priority, string> = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-gray-100 text-gray-600 border-gray-300',
  };
  return map[p];
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const emptyItem = (): Partial<CapExItem> => ({
  name: '',
  category: 'deferred_maintenance',
  estimatedCost: 0,
  yearPlanned: 1,
  priority: 'medium',
  noiImpact: 0,
  completionMonths: 3,
});

// ── Component ──────────────────────────────────────────────────────────

export default function CapExBudget({ projectId, onTabChange }: CapExBudgetProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<CapExItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CapExItem>>(emptyItem());
  const [activeTab, setActiveTab] = useState('timeline');
  const [sortKey, setSortKey] = useState<'yearPlanned' | 'priority' | 'estimatedCost'>('yearPlanned');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── API mutation ───────────────────────────────────────────────────

  const analysisMutation = useMutation({
    mutationFn: async (capexItems: CapExItem[]) => {
      const res = await apiRequest('POST', '/api/institutional-analysis/capex-budget', {
        projectId,
        items: capexItems,
      });
      return res.json() as Promise<CapExAnalysis>;
    },
  });

  const analysis: CapExAnalysis = useMemo(() => {
    if (analysisMutation.data) return analysisMutation.data;
    const totalCapex = items.reduce((s, i) => s + i.estimatedCost, 0);
    const deferredMaintenance = items
      .filter(i => i.category === 'deferred_maintenance')
      .reduce((s, i) => s + i.estimatedCost, 0);
    const valueAdd = items
      .filter(i => i.category === 'value_add')
      .reduce((s, i) => s + i.estimatedCost, 0);
    const totalNoi = items.reduce((s, i) => s + i.noiImpact, 0);
    return {
      totalCapex,
      deferredMaintenance,
      valueAdd,
      capexPerUnit: 0,
      returnOnCapex: totalCapex > 0 ? totalNoi / totalCapex : 0,
      impliedValueCreation: totalCapex > 0 ? (totalNoi / 0.065) : 0,
    };
  }, [items, analysisMutation.data]);

  // ── Refresh analysis ──────────────────────────────────────────────

  const refreshAnalysis = useCallback(() => {
    if (items.length === 0) return;
    analysisMutation.mutate(items);
  }, [items]);

  // ── Dialog handlers ───────────────────────────────────────────────

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyItem());
    setDialogOpen(true);
  };

  const openEditDialog = (item: CapExItem) => {
    setEditingId(item.id);
    setForm({ ...item });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.estimatedCost) {
      toast({ title: 'Validation', description: 'Name and estimated cost are required.', variant: 'destructive' });
      return;
    }
    if (editingId) {
      setItems(prev => prev.map(i => (i.id === editingId ? { ...i, ...form } as CapExItem : i)));
    } else {
      const newItem: CapExItem = {
        id: uid(),
        name: form.name!,
        category: form.category as Category,
        estimatedCost: Number(form.estimatedCost),
        yearPlanned: Number(form.yearPlanned ?? 1),
        priority: form.priority as Priority,
        noiImpact: Number(form.noiImpact ?? 0),
        completionMonths: Number(form.completionMonths ?? 3),
      };
      setItems(prev => [...prev, newItem]);
    }
    setDialogOpen(false);
    toast({ title: editingId ? 'Item updated' : 'Item added' });
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // ── Sorting ───────────────────────────────────────────────────────

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const priorityOrd: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'priority') {
        cmp = priorityOrd[a.priority] - priorityOrd[b.priority];
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  // ── Chart data ────────────────────────────────────────────────────

  const timelineData = useMemo(() => {
    const byYear: Record<number, Record<Category, number>> = {};
    for (const yr of [0, 1, 2, 3, 4, 5]) byYear[yr] = {} as Record<Category, number>;
    items.forEach(i => {
      const yr = i.yearPlanned;
      if (!byYear[yr]) byYear[yr] = {} as Record<Category, number>;
      byYear[yr][i.category] = (byYear[yr][i.category] || 0) + i.estimatedCost;
    });
    return Object.entries(byYear).map(([yr, cats]) => ({
      year: Number(yr) === 0 ? 'Closing' : `Year ${yr}`,
      ...cats,
    }));
  }, [items]);

  const noiWaterfallData = useMemo(() => {
    const preNoi = 500000; // placeholder pre-CapEx NOI
    let running = preNoi;
    const data: { name: string; value: number; fill: string; isTotal?: boolean }[] = [
      { name: 'Pre-CapEx NOI', value: preNoi, fill: '#6b7280', isTotal: true },
    ];
    const grouped = new Map<string, number>();
    items.forEach(i => {
      if (i.noiImpact !== 0) {
        const key = i.name.length > 18 ? i.name.slice(0, 18) + '...' : i.name;
        grouped.set(key, (grouped.get(key) || 0) + i.noiImpact);
      }
    });
    grouped.forEach((val, name) => {
      running += val;
      data.push({ name, value: val, fill: val >= 0 ? '#22c55e' : '#ef4444' });
    });
    data.push({ name: 'Post-CapEx NOI', value: running, fill: '#3b82f6', isTotal: true });
    return data;
  }, [items]);

  const categoryPieData = useMemo(() => {
    const map = new Map<Category, number>();
    items.forEach(i => map.set(i.category, (map.get(i.category) || 0) + i.estimatedCost));
    return Array.from(map.entries()).map(([cat, value]) => ({
      name: categoryLabel(cat),
      value,
      color: categoryColor(cat),
    }));
  }, [items]);

  // ── Excel export ──────────────────────────────────────────────────

  const exportExcel = () => {
    const header = ['Name', 'Category', 'Estimated Cost', 'Year Planned', 'Priority', 'NOI Impact', 'Completion (Mo.)'];
    const rows = items.map(i => [
      i.name,
      categoryLabel(i.category),
      i.estimatedCost,
      i.yearPlanned === 0 ? 'Closing' : `Year ${i.yearPlanned}`,
      i.priority,
      i.noiImpact,
      i.completionMonths,
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capex-budget-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'CapEx budget exported to CSV.' });
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">CapEx Budget &amp; Deferred Maintenance</h2>
          <p className="text-muted-foreground text-sm">
            Model capital expenditure items, timeline, and NOI impact analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAnalysis} disabled={items.length === 0 || analysisMutation.isPending}>
            {analysisMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-1" />}
            Analyze
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total CapEx</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(analysis.totalCapex)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Deferred Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(analysis.deferredMaintenance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Value-Add</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(analysis.valueAdd)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">CapEx / Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(analysis.capexPerUnit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Return on CapEx</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatPercent(analysis.returnOnCapex)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Implied Value Creation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(analysis.impliedValueCreation)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="timeline"><CalendarClock className="h-4 w-4 mr-1" /> Timeline</TabsTrigger>
          <TabsTrigger value="impact"><BarChart3 className="h-4 w-4 mr-1" /> Impact</TabsTrigger>
          <TabsTrigger value="detail"><Wrench className="h-4 w-4 mr-1" /> Detail</TabsTrigger>
          <TabsTrigger value="categories"><PieChart className="h-4 w-4 mr-1" /> Categories</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CapEx Timeline by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mb-2" />
                  <p>No CapEx items yet. Add items to see the timeline chart.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    {CATEGORIES.map(cat => (
                      <Bar
                        key={cat.value}
                        dataKey={cat.value}
                        stackId="a"
                        fill={cat.color}
                        name={cat.label}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Impact Tab */}
        <TabsContent value="impact" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">NOI Bridge Waterfall</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 || noiWaterfallData.length <= 2 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mb-2" />
                  <p>Add items with NOI impact to see the waterfall chart.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={noiWaterfallData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {noiWaterfallData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detail Tab */}
        <TabsContent value="detail" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">All CapEx Items</CardTitle>
              <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Wrench className="h-8 w-8 mb-2" />
                  <p>No items. Click "Add Item" to begin building your CapEx budget.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('estimatedCost')}>
                          <span className="flex items-center gap-1">Cost <ArrowUpDown className="h-3 w-3" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('yearPlanned')}>
                          <span className="flex items-center gap-1">Year <ArrowUpDown className="h-3 w-3" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('priority')}>
                          <span className="flex items-center gap-1">Priority <ArrowUpDown className="h-3 w-3" /></span>
                        </TableHead>
                        <TableHead>NOI Impact</TableHead>
                        <TableHead>Months</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" style={{ borderColor: categoryColor(item.category) }}>
                              {categoryLabel(item.category)}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(item.estimatedCost)}</TableCell>
                          <TableCell>{item.yearPlanned === 0 ? 'Closing' : `Year ${item.yearPlanned}`}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs', priorityBadge(item.priority))}>
                              {item.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className={item.noiImpact >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {item.noiImpact > 0 ? '+' : ''}{formatCurrency(item.noiImpact)}
                          </TableCell>
                          <TableCell>{item.completionMonths}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(item)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spend by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryPieData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <PieChart className="h-8 w-8 mb-2" />
                    <p>Add items to see category breakdown.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={categoryPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {categoryPieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartTooltip formatter={(v: number) => formatCurrency(v)} />
                    </RechartsPie>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CATEGORIES.map(cat => {
                      const catItems = items.filter(i => i.category === cat.value);
                      const total = catItems.reduce((s, i) => s + i.estimatedCost, 0);
                      const pct = analysis.totalCapex > 0 ? total / analysis.totalCapex : 0;
                      return (
                        <TableRow key={cat.value}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.label}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                          <TableCell className="text-right">{catItems.length}</TableCell>
                          <TableCell className="text-right">{formatPercent(pct)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit CapEx Item' : 'Add CapEx Item'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the capital expenditure line item details.'
                : 'Enter details for a new capital expenditure line item.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="capex-name">Name</Label>
              <Input
                id="capex-name"
                placeholder="e.g. Roof replacement"
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Category + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={form.category ?? 'deferred_maintenance'}
                  onValueChange={v => setForm(f => ({ ...f, category: v as Category }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority ?? 'medium'}
                  onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estimated Cost + Year Planned */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="capex-cost">Estimated Cost ($)</Label>
                <Input
                  id="capex-cost"
                  type="number"
                  min={0}
                  value={form.estimatedCost ?? 0}
                  onChange={e => setForm(f => ({ ...f, estimatedCost: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Year Planned</Label>
                <Select
                  value={String(form.yearPlanned ?? 1)}
                  onValueChange={v => setForm(f => ({ ...f, yearPlanned: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map(y => (
                      <SelectItem key={y.value} value={String(y.value)}>{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* NOI Impact + Completion Months */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="capex-noi">Annual NOI Impact ($)</Label>
                <Input
                  id="capex-noi"
                  type="number"
                  value={form.noiImpact ?? 0}
                  onChange={e => setForm(f => ({ ...f, noiImpact: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="capex-months">Completion (months)</Label>
                <Input
                  id="capex-months"
                  type="number"
                  min={1}
                  max={60}
                  value={form.completionMonths ?? 3}
                  onChange={e => setForm(f => ({ ...f, completionMonths: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? 'Update' : 'Add Item'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
