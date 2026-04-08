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
  Save,
  History,
  GitBranch,
  RotateCcw,
  Eye,
  Diff,
  ChevronRight,
  Clock,
  User,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';

interface ModelVersioningProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface ModelSnapshot {
  id: string;
  version: string;
  label: string;
  description: string;
  author: string;
  createdAt: string;
  metrics: {
    noi: number;
    irr: number;
    equityMultiple: number;
  };
  changes: string[];
  state: Record<string, unknown>;
}

interface FieldDelta {
  field: string;
  category: string;
  oldValue: string | number;
  newValue: string | number;
  direction: 'up' | 'down' | 'changed';
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function generateNextVersion(snapshots: ModelSnapshot[]): string {
  if (snapshots.length === 0) return 'v1.0';
  const latest = snapshots[0];
  const parts = latest.version.replace('v', '').split('.');
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  return `v${major}.${minor + 1}`;
}

function computeDeltas(a: ModelSnapshot, b: ModelSnapshot): FieldDelta[] {
  const deltas: FieldDelta[] = [];
  const metricsFields: Array<{ key: keyof ModelSnapshot['metrics']; label: string; category: string }> = [
    { key: 'noi', label: 'Net Operating Income', category: 'Revenue' },
    { key: 'irr', label: 'IRR', category: 'Returns' },
    { key: 'equityMultiple', label: 'Equity Multiple', category: 'Returns' },
  ];

  for (const f of metricsFields) {
    const oldVal = a.metrics[f.key];
    const newVal = b.metrics[f.key];
    if (oldVal !== newVal) {
      deltas.push({
        field: f.label,
        category: f.category,
        oldValue: f.key === 'noi' ? formatCurrency(oldVal) : f.key === 'irr' ? formatPct(oldVal) : `${oldVal.toFixed(2)}x`,
        newValue: f.key === 'noi' ? formatCurrency(newVal) : f.key === 'irr' ? formatPct(newVal) : `${newVal.toFixed(2)}x`,
        direction: newVal > oldVal ? 'up' : 'down',
      });
    }
  }
  return deltas;
}

function ModelVersioning({ projectId, onTabChange }: ModelVersioningProps) {
  const queryClient = useQueryClient();

  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [compareLeft, setCompareLeft] = useState<string | null>(null);
  const [compareRight, setCompareRight] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: snapshots = [], isLoading } = useQuery<ModelSnapshot[]>({
    queryKey: ['/api/modeling/projects', projectId, 'snapshots'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/projects/${projectId}/snapshots`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const saveSnapshot = useMutation({
    mutationFn: async (payload: { label: string; description: string }) => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/snapshots`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'snapshots'] });
      setSnapshotLabel('');
      setSnapshotDescription('');
      setIsSaving(false);
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  const restoreSnapshot = useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/snapshots/${snapshotId}/restore`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
    },
  });

  const nextVersion = useMemo(() => generateNextVersion(snapshots), [snapshots]);

  const comparisonDeltas = useMemo(() => {
    if (!compareLeft || !compareRight) return [];
    const leftSnap = snapshots.find((s) => s.id === compareLeft);
    const rightSnap = snapshots.find((s) => s.id === compareRight);
    if (!leftSnap || !rightSnap) return [];
    return computeDeltas(leftSnap, rightSnap);
  }, [compareLeft, compareRight, snapshots]);

  const leftSnap = snapshots.find((s) => s.id === compareLeft);
  const rightSnap = snapshots.find((s) => s.id === compareRight);

  const timelineData = useMemo(() => {
    return [...snapshots].reverse().map((s) => ({
      version: s.version,
      noi: s.metrics.noi,
      irr: s.metrics.irr,
      equityMultiple: s.metrics.equityMultiple,
    }));
  }, [snapshots]);

  const handleSave = () => {
    setIsSaving(true);
    saveSnapshot.mutate({
      label: snapshotLabel || nextVersion,
      description: snapshotDescription || 'Manual snapshot',
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Model Versioning</h2>
          <p className="text-muted-foreground">
            Save, compare, and restore model snapshots to track changes over time.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Save Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="versionLabel">Version Label</Label>
              <Input
                id="versionLabel"
                placeholder={nextVersion}
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="What changed in this version..."
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Snapshot
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Version Timeline */}
      {timelineData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Version Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="version" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'noi') return [formatCurrency(value), 'NOI'];
                      if (name === 'irr') return [formatPct(value), 'IRR'];
                      return [`${(value as number).toFixed(2)}x`, 'Equity Multiple'];
                    }}
                  />
                  <Legend formatter={(value) => {
                    if (value === 'noi') return 'NOI';
                    if (value === 'irr') return 'IRR';
                    return 'Equity Multiple';
                  }} />
                  <Line yAxisId="left" type="monotone" dataKey="noi" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="irr" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snapshot List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Snapshot History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading snapshots...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No snapshots yet. Save your first snapshot above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Version</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">NOI</TableHead>
                    <TableHead className="text-right">IRR</TableHead>
                    <TableHead className="text-right">EM</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((snapshot, idx) => (
                    <TableRow key={snapshot.id}>
                      <TableCell>
                        <Badge variant={idx === 0 ? 'default' : 'secondary'}>
                          {snapshot.version}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDate(snapshot.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {snapshot.author}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {snapshot.description}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(snapshot.metrics.noi)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPct(snapshot.metrics.irr)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {snapshot.metrics.equityMultiple.toFixed(2)}x
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (!compareLeft) {
                                setCompareLeft(snapshot.id);
                              } else if (!compareRight) {
                                setCompareRight(snapshot.id);
                                setShowCompare(true);
                              } else {
                                setCompareLeft(snapshot.id);
                                setCompareRight(null);
                                setShowCompare(false);
                              }
                            }}
                            title="Select for comparison"
                          >
                            <Diff className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restoreSnapshot.mutate(snapshot.id)}
                            title="Restore this snapshot"
                            disabled={idx === 0}
                          >
                            <RotateCcw className="h-4 w-4" />
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

      {/* Side-by-Side Comparison */}
      {showCompare && leftSnap && rightSnap && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Comparison: {leftSnap.version} vs {rightSnap.version}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCompareLeft(null);
                  setCompareRight(null);
                  setShowCompare(false);
                }}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary metrics side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground mb-2">
                  {leftSnap.version} - {formatDate(leftSnap.createdAt)}
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>NOI</span>
                    <span className="font-mono">{formatCurrency(leftSnap.metrics.noi)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IRR</span>
                    <span className="font-mono">{formatPct(leftSnap.metrics.irr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>EM</span>
                    <span className="font-mono">{leftSnap.metrics.equityMultiple.toFixed(2)}x</span>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground mb-2">
                  {rightSnap.version} - {formatDate(rightSnap.createdAt)}
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>NOI</span>
                    <span className="font-mono">{formatCurrency(rightSnap.metrics.noi)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IRR</span>
                    <span className="font-mono">{formatPct(rightSnap.metrics.irr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>EM</span>
                    <span className="font-mono">{rightSnap.metrics.equityMultiple.toFixed(2)}x</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delta table */}
            {comparisonDeltas.length > 0 ? (
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">{leftSnap.version}</TableHead>
                    <TableHead className="text-right">{rightSnap.version}</TableHead>
                    <TableHead className="text-center">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonDeltas.map((delta, idx) => (
                    <TableRow key={idx} className={delta.direction === 'up' ? 'bg-green-50/50' : 'bg-red-50/50'}>
                      <TableCell className="font-medium">{delta.field}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {delta.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{String(delta.oldValue)}</TableCell>
                      <TableCell className="text-right font-mono">{String(delta.newValue)}</TableCell>
                      <TableCell className="text-center">
                        {delta.direction === 'up' ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Increased</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Decreased</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              
            </Table>
            </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-500" />
                No differences found between these versions.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ModelVersioning;
