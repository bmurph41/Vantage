import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GitCompare, ArrowRight, Plus, Minus, Equal } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface ScenarioVersionDiffProps {
  projectId: string;
  versionA?: string;
  versionB?: string;
}

interface DiffField {
  fieldName: string;
  valueA: any;
  valueB: any;
  changed: boolean;
  added: boolean;
  removed: boolean;
}

const FIELDS_TO_COMPARE = [
  'noiGrowthRate',
  'capRate',
  'discountRate',
  'holdPeriod',
  'exitCapRate',
  'managementFee',
  'reserves',
  'yearlyGrowthRates',
  'belowTheLine',
];

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[Array: ${value.length} items]`;
    }
    return '[Object]';
  }
  if (typeof value === 'number') {
    // Check if it's a percentage field
    if (Math.abs(value) < 1 && value !== 0) {
      return `${(value * 100).toFixed(2)}%`;
    }
    return value.toFixed(2);
  }
  return String(value);
}

function getValueSummary(value: any): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `${value.length} items`;
    }
    if (typeof value === 'object') {
      return `${Object.keys(value).length} keys`;
    }
  }
  return formatValue(value);
}

function calculateDelta(valueA: any, valueB: any): { delta: string; percentage: string } | null {
  if (valueA === null || valueB === null || valueA === undefined || valueB === undefined) {
    return null;
  }

  if (typeof valueA === 'number' && typeof valueB === 'number') {
    const diff = valueB - valueA;
    const delta = diff === 0 ? '0' : (diff > 0 ? '+' : '') + diff.toFixed(2);
    let percentage = '';
    if (valueA !== 0) {
      const pct = ((diff / Math.abs(valueA)) * 100).toFixed(1);
      percentage = ` (${pct > 0 ? '+' : ''}${pct}%)`;
    }
    return { delta, percentage };
  }

  return null;
}

export function ScenarioVersionDiff({
  projectId,
  versionA: initialVersionA,
  versionB: initialVersionB,
}: ScenarioVersionDiffProps) {
  const [versionA, setVersionA] = useState<string | undefined>(initialVersionA);
  const [versionB, setVersionB] = useState<string | undefined>(initialVersionB);

  // Fetch scenarios
  const { data: scenarios = [], isLoading } = useQuery<Scenario[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
    queryFn: () =>
      apiRequest('GET', `/api/modeling/projects/${projectId}/scenarios`),
  });

  // Get selected scenario objects
  const scenarioAObj = useMemo(
    () => scenarios.find((s) => s.id === versionA),
    [scenarios, versionA]
  );
  const scenarioBObj = useMemo(
    () => scenarios.find((s) => s.id === versionB),
    [scenarios, versionB]
  );

  // Calculate diff
  const diffData = useMemo(() => {
    if (!scenarioAObj || !scenarioBObj) {
      return { diffs: [], summary: { changed: 0, unchanged: 0, added: 0, removed: 0 } };
    }

    const configA = scenarioAObj.config || {};
    const configB = scenarioBObj.config || {};
    const allFields = new Set([
      ...FIELDS_TO_COMPARE,
      ...Object.keys(configA),
      ...Object.keys(configB),
    ]);

    const diffs: DiffField[] = [];
    let changed = 0;
    let unchanged = 0;
    let added = 0;
    let removed = 0;

    Array.from(allFields).forEach((fieldName) => {
      const valueA = configA[fieldName];
      const valueB = configB[fieldName];
      const aExists = fieldName in configA;
      const bExists = fieldName in configB;

      let isChanged = false;
      let isAdded = false;
      let isRemoved = false;

      if (aExists && bExists) {
        isChanged = JSON.stringify(valueA) !== JSON.stringify(valueB);
        if (isChanged) {
          changed++;
        } else {
          unchanged++;
        }
      } else if (!aExists && bExists) {
        isAdded = true;
        added++;
      } else if (aExists && !bExists) {
        isRemoved = true;
        removed++;
      }

      diffs.push({
        fieldName,
        valueA,
        valueB,
        changed: isChanged,
        added: isAdded,
        removed: isRemoved,
      });
    });

    return {
      diffs: diffs.sort((a, b) => {
        // Sort by: changed first, then added, then removed, then unchanged
        const priority = (d: DiffField) => {
          if (d.changed) return 0;
          if (d.added) return 1;
          if (d.removed) return 2;
          return 3;
        };
        const pA = priority(a);
        const pB = priority(b);
        if (pA !== pB) return pA - pB;
        return a.fieldName.localeCompare(b.fieldName);
      }),
      summary: { changed, unchanged, added, removed },
    };
  }, [scenarioAObj, scenarioBObj]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scenarios.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <GitCompare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No scenarios available for this project</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasSelection = versionA && versionB && versionA !== versionB;

  return (
    <div className="space-y-6">
      {/* Version Selectors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            Compare Scenarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Version A Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Version A</label>
              <Select value={versionA || ''} onValueChange={setVersionA}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scenario..." />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name || `Scenario (${scenario.id.slice(0, 8)})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scenarioAObj && (
                <p className="text-xs text-gray-500">
                  Updated: {new Date(scenarioAObj.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>

            {/* Version B Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Version B</label>
              <Select value={versionB || ''} onValueChange={setVersionB}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scenario..." />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name || `Scenario (${scenario.id.slice(0, 8)})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scenarioBObj && (
                <p className="text-xs text-gray-500">
                  Updated: {new Date(scenarioBObj.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasSelection && (
        <>
          {/* Summary Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Minus className="w-4 h-4 text-blue-500" />
                    Changed
                  </p>
                  <p className="text-2xl font-bold">{diffData.summary.changed}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Equal className="w-4 h-4 text-gray-500" />
                    Unchanged
                  </p>
                  <p className="text-2xl font-bold">{diffData.summary.unchanged}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Plus className="w-4 h-4 text-green-500" />
                    Added
                  </p>
                  <p className="text-2xl font-bold">{diffData.summary.added}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Minus className="w-4 h-4 text-red-500" />
                    Removed
                  </p>
                  <p className="text-2xl font-bold">{diffData.summary.removed}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Diff Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Field</TableHead>
                      <TableHead className="text-center">Version A</TableHead>
                      <TableHead className="text-center">Version B</TableHead>
                      <TableHead className="text-center w-24">Change</TableHead>
                      <TableHead className="text-center w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diffData.diffs.map((diff) => {
                      const delta =
                        !diff.added && !diff.removed
                          ? calculateDelta(diff.valueA, diff.valueB)
                          : null;

                      return (
                        <TableRow
                          key={diff.fieldName}
                          className={
                            diff.changed
                              ? 'bg-yellow-50'
                              : diff.added
                                ? 'bg-green-50'
                                : diff.removed
                                  ? 'bg-red-50'
                                  : ''
                          }
                        >
                          <TableCell className="font-medium">{diff.fieldName}</TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {formatValue(diff.valueA)}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {formatValue(diff.valueB)}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {delta ? (
                              <span
                                className={
                                  delta.delta.startsWith('+') && !delta.delta.startsWith('+0')
                                    ? 'text-green-600'
                                    : delta.delta.startsWith('-')
                                      ? 'text-red-600'
                                      : 'text-gray-600'
                                }
                              >
                                {delta.delta}
                                {delta.percentage}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {diff.changed && (
                              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                Changed
                              </Badge>
                            )}
                            {diff.added && (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                <Plus className="w-3 h-3 mr-1" />
                                Added
                              </Badge>
                            )}
                            {diff.removed && (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                <Minus className="w-3 h-3 mr-1" />
                                Removed
                              </Badge>
                            )}
                            {!diff.changed && !diff.added && !diff.removed && (
                              <Badge variant="outline">
                                <Equal className="w-3 h-3 mr-1" />
                                Unchanged
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
            </CardContent>
          </Card>

          {/* Field Details Section */}
          {diffData.diffs.some((d) => d.fieldName === 'yearlyGrowthRates') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Yearly Growth Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Version A</h4>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {scenarioAObj?.config?.yearlyGrowthRates
                        ? getValueSummary(scenarioAObj.config.yearlyGrowthRates)
                        : 'N/A'}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm mb-2">Version B</h4>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {scenarioBObj?.config?.yearlyGrowthRates
                        ? getValueSummary(scenarioBObj.config.yearlyGrowthRates)
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Below the Line Details Section */}
          {diffData.diffs.some((d) => d.fieldName === 'belowTheLine') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Below the Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Version A</h4>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {scenarioAObj?.config?.belowTheLine
                        ? getValueSummary(scenarioAObj.config.belowTheLine)
                        : 'N/A'}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm mb-2">Version B</h4>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {scenarioBObj?.config?.belowTheLine
                        ? getValueSummary(scenarioBObj.config.belowTheLine)
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {hasSelection === false && scenarios.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-600">
              <p>Select two different scenarios to compare</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
