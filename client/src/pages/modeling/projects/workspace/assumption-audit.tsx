import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import {
  Download,
  Filter,
  Search,
  Clock,
  User,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
} from 'lucide-react';

interface AssumptionAuditProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

type Category = 'Revenue' | 'Expenses' | 'Debt' | 'Exit' | 'General';

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  fieldName: string;
  category: Category;
  oldValue: string;
  newValue: string;
  source: string;
  impact: 'favorable' | 'unfavorable' | 'neutral';
}

const CATEGORIES: Category[] = ['Revenue', 'Expenses', 'Debt', 'Exit', 'General'];

const CATEGORY_COLORS: Record<Category, string> = {
  Revenue: 'bg-blue-100 text-blue-700',
  Expenses: 'bg-orange-100 text-orange-700',
  Debt: 'bg-purple-100 text-purple-700',
  Exit: 'bg-emerald-100 text-emerald-700',
  General: 'bg-gray-100 text-gray-700',
};

const IMPACT_CONFIG = {
  favorable: { color: 'text-green-600', bg: 'bg-green-50', icon: ArrowUpRight, label: 'Favorable' },
  unfavorable: { color: 'text-red-600', bg: 'bg-red-50', icon: ArrowDownRight, label: 'Unfavorable' },
  neutral: { color: 'text-gray-500', bg: 'bg-gray-50', icon: Minus, label: 'Neutral' },
};

function AssumptionAudit({ projectId, onTabChange }: AssumptionAuditProps) {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: auditEntries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['/api/modeling/projects', projectId, 'assumption-audit'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/projects/${projectId}/assumption-audit`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const uniqueUsers = useMemo(() => {
    const users = new Set(auditEntries.map((e) => e.user));
    return Array.from(users).sort();
  }, [auditEntries]);

  const filteredEntries = useMemo(() => {
    return auditEntries.filter((entry) => {
      if (searchTerm && !entry.fieldName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (categoryFilter !== 'All' && entry.category !== categoryFilter) {
        return false;
      }
      if (userFilter !== 'All' && entry.user !== userFilter) {
        return false;
      }
      if (dateFrom) {
        const entryDate = new Date(entry.timestamp);
        const fromDate = new Date(dateFrom);
        if (entryDate < fromDate) return false;
      }
      if (dateTo) {
        const entryDate = new Date(entry.timestamp);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (entryDate > toDate) return false;
      }
      return true;
    });
  }, [auditEntries, searchTerm, categoryFilter, userFilter, dateFrom, dateTo]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const changesThisWeek = auditEntries.filter(
      (e) => new Date(e.timestamp) >= weekAgo
    ).length;

    const fieldCounts: Record<string, number> = {};
    for (const entry of auditEntries) {
      fieldCounts[entry.fieldName] = (fieldCounts[entry.fieldName] || 0) + 1;
    }
    const mostChanged = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalChanges: auditEntries.length,
      changesThisWeek,
      mostChangedField: mostChanged ? mostChanged[0] : 'N/A',
      mostChangedCount: mostChanged ? mostChanged[1] : 0,
      favorableCount: auditEntries.filter((e) => e.impact === 'favorable').length,
      unfavorableCount: auditEntries.filter((e) => e.impact === 'unfavorable').length,
    };
  }, [auditEntries]);

  // Category breakdown for chart
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, { favorable: number; unfavorable: number; neutral: number }> = {};
    for (const cat of CATEGORIES) {
      counts[cat] = { favorable: 0, unfavorable: 0, neutral: 0 };
    }
    for (const entry of auditEntries) {
      counts[entry.category][entry.impact]++;
    }
    return CATEGORIES.map((cat) => ({
      category: cat,
      favorable: counts[cat].favorable,
      unfavorable: counts[cat].unfavorable,
      neutral: counts[cat].neutral,
    }));
  }, [auditEntries]);

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'User', 'Field', 'Category', 'Old Value', 'New Value', 'Source', 'Impact'];
    const rows = filteredEntries.map((e) => [
      e.timestamp,
      e.user,
      e.fieldName,
      e.category,
      e.oldValue,
      e.newValue,
      e.source,
      e.impact,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assumption-audit-${projectId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assumption Audit Trail</h2>
          <p className="text-muted-foreground">
            Track all assumption changes with full attribution, impact analysis, and source documentation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filteredEntries.length === 0}>
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Changes</p>
                <p className="text-2xl font-bold">{summaryStats.totalChanges}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{summaryStats.changesThisWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Most Changed</p>
                <p className="text-lg font-bold truncate">{summaryStats.mostChangedField}</p>
                <p className="text-xs text-muted-foreground">{summaryStats.mostChangedCount} changes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Impact Split</p>
                <p className="text-sm">
                  <span className="text-green-600 font-semibold">{summaryStats.favorableCount}</span>
                  {' / '}
                  <span className="text-red-600 font-semibold">{summaryStats.unfavorableCount}</span>
                </p>
                <p className="text-xs text-muted-foreground">favorable / unfavorable</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Changes by Category Chart */}
      {auditEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Changes by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="favorable" stackId="a" fill="#22c55e" name="Favorable" />
                  <Bar dataKey="unfavorable" stackId="a" fill="#ef4444" name="Unfavorable" />
                  <Bar dataKey="neutral" stackId="a" fill="#9ca3af" name="Neutral" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Field</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Field name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as Category | 'All')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <select
                id="user"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="All">All Users</option>
                {uniqueUsers.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          {(searchTerm || categoryFilter !== 'All' || userFilter !== 'All' || dateFrom || dateTo) && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {filteredEntries.length} of {auditEntries.length} changes
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('All');
                  setUserFilter('All');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Change Log
            <Badge variant="secondary" className="ml-2">{filteredEntries.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading audit trail...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {auditEntries.length === 0
                  ? 'No assumption changes recorded yet.'
                  : 'No changes match the current filters.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Old Value</TableHead>
                    <TableHead className="text-right">New Value</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-center">Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const impactCfg = IMPACT_CONFIG[entry.impact];
                    const ImpactIcon = impactCfg.icon;
                    return (
                      <TableRow key={entry.id} className={impactCfg.bg}>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            {formatTimestamp(entry.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            {entry.user}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{entry.fieldName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[entry.category]}`}>
                            {entry.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{entry.oldValue}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {entry.newValue}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.source}</TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center gap-1 ${impactCfg.color}`}>
                            <ImpactIcon className="h-4 w-4" />
                            <span className="text-xs font-medium">{impactCfg.label}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AssumptionAudit;
