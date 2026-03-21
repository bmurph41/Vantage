import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Scale, Trophy, Plus, Trash2, BarChart3 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
  propertyName?: string;
}

interface ScoringCriterion {
  id: string;
  name: string;
  weight: number;
}

interface DealScore {
  dealId: string;
  scores: Record<string, number>; // criterionId -> score (1-10)
}

interface DealComparisonProps {
  dealIds?: string[];
}

const DEFAULT_CRITERIA: ScoringCriterion[] = [
  { id: 'deal-size', name: 'Deal Size', weight: 20 },
  { id: 'market-potential', name: 'Market Potential', weight: 20 },
  { id: 'location-quality', name: 'Location Quality', weight: 15 },
  { id: 'condition-assessment', name: 'Condition Assessment', weight: 15 },
  { id: 'seller-motivation', name: 'Seller Motivation', weight: 10 },
  { id: 'regulatory-risk', name: 'Regulatory Risk', weight: 10 },
  { id: 'financing-availability', name: 'Financing Availability', weight: 10 },
];

export function DealComparison({ dealIds: initialDealIds }: DealComparisonProps) {
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>(
    initialDealIds || []
  );
  const [criteria, setCriteria] = useState<ScoringCriterion[]>(DEFAULT_CRITERIA);
  const [dealScores, setDealScores] = useState<DealScore[]>([]);
  const [newCriterionName, setNewCriterionName] = useState('');

  // Fetch all deals
  const { data: allDeals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ['/api/crm/deals'],
  });

  // Get selected deals
  const selectedDeals = useMemo(
    () => allDeals.filter((d) => selectedDealIds.includes(d.id)),
    [allDeals, selectedDealIds]
  );

  // Initialize deal scores for newly selected deals
  const initializeDealScores = (dealIds: string[]) => {
    const newScores: DealScore[] = [];
    for (const dealId of dealIds) {
      const existing = dealScores.find((ds) => ds.dealId === dealId);
      if (existing) {
        newScores.push(existing);
      } else {
        const scores: Record<string, number> = {};
        criteria.forEach((c) => {
          scores[c.id] = 5; // Default to 5
        });
        newScores.push({ dealId, scores });
      }
    }
    setDealScores(newScores);
  };

  // Handle deal selection
  const handleDealSelect = (dealId: string) => {
    const newIds = selectedDealIds.includes(dealId)
      ? selectedDealIds.filter((id) => id !== dealId)
      : [...selectedDealIds, dealId];
    setSelectedDealIds(newIds);
    initializeDealScores(newIds);
  };

  // Calculate weighted score for a deal
  const calculateWeightedScore = (dealId: string): number => {
    const dealScore = dealScores.find((ds) => ds.dealId === dealId);
    if (!dealScore) return 0;

    let total = 0;
    criteria.forEach((criterion) => {
      const score = dealScore.scores[criterion.id] || 0;
      total += (score * criterion.weight) / 100;
    });
    return total;
  };

  // Get ranked deals
  const rankedDeals = useMemo(() => {
    return selectedDeals
      .map((deal) => ({
        deal,
        score: calculateWeightedScore(deal.id),
      }))
      .sort((a, b) => b.score - a.score);
  }, [selectedDeals, dealScores, criteria]);

  // Update score for a deal/criterion
  const updateScore = (dealId: string, criterionId: string, score: number) => {
    setDealScores((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((ds) => ds.dealId === dealId);
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          scores: {
            ...updated[idx].scores,
            [criterionId]: Math.max(1, Math.min(10, score)),
          },
        };
      }
      return updated;
    });
  };

  // Update criterion weight
  const updateWeight = (criterionId: string, newWeight: number) => {
    setCriteria((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((c) => c.id === criterionId);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], weight: newWeight };
      }
      return updated;
    });
  };

  // Update criterion name
  const updateCriterionName = (criterionId: string, newName: string) => {
    setCriteria((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((c) => c.id === criterionId);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], name: newName };
      }
      return updated;
    });
  };

  // Add custom criterion
  const addCriterion = () => {
    if (!newCriterionName.trim()) return;
    const newId = `custom-${Date.now()}`;
    setCriteria((prev) => [
      ...prev,
      { id: newId, name: newCriterionName, weight: 0 },
    ]);
    setNewCriterionName('');
    // Initialize scores for all selected deals
    setDealScores((prev) => {
      return prev.map((ds) => ({
        ...ds,
        scores: { ...ds.scores, [newId]: 5 },
      }));
    });
  };

  // Remove criterion
  const removeCriterion = (criterionId: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== criterionId));
    setDealScores((prev) => {
      return prev.map((ds) => {
        const { [criterionId]: _, ...rest } = ds.scores;
        return { ...ds, scores: rest };
      });
    });
  };

  // Calculate total weight
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  // Prepare radar chart data
  const radarData = criteria.map((criterion) => {
    const entry: Record<string, any> = {
      criterion: criterion.name,
    };
    rankedDeals.forEach(({ deal }) => {
      const dealScore = dealScores.find((ds) => ds.dealId === deal.id);
      entry[deal.name] = dealScore?.scores[criterion.id] || 0;
    });
    return entry;
  });

  // Colors for radar chart
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="w-full space-y-6">
      {/* Deal Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Deal Selection
          </CardTitle>
          <CardDescription>
            Select multiple deals to compare side-by-side
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dealsLoading ? (
            <div className="text-sm text-muted-foreground">Loading deals...</div>
          ) : allDeals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No deals available
            </div>
          ) : (
            <div className="space-y-2">
              {allDeals.map((deal) => (
                <div key={deal.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`deal-${deal.id}`}
                    checked={selectedDealIds.includes(deal.id)}
                    onChange={() => handleDealSelect(deal.id)}
                    className="rounded"
                  />
                  <label
                    htmlFor={`deal-${deal.id}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    <span className="font-medium">{deal.name}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      ${deal.value?.toLocaleString() || 0} • {deal.stage}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDeals.length > 0 && (
        <>
          {/* Scoring Criteria Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Scoring Criteria
              </CardTitle>
              <CardDescription>
                Configure weighted criteria (total weight: {totalWeight}/100)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {criteria.map((criterion) => (
                <div key={criterion.id} className="flex items-center gap-3 pb-3 border-b last:border-b-0">
                  <input
                    type="text"
                    value={criterion.name}
                    onChange={(e) => updateCriterionName(criterion.id, e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={criterion.weight}
                      onChange={(e) =>
                        updateWeight(criterion.id, parseInt(e.target.value) || 0)
                      }
                      className="w-16 h-9"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  {criterion.id.startsWith('custom-') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCriterion(criterion.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {/* Add Custom Criterion */}
              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="New criterion name"
                  value={newCriterionName}
                  onChange={(e) => setNewCriterionName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') addCriterion();
                  }}
                  className="flex-1"
                />
                <Button size="sm" onClick={addCriterion}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Comparison Table</CardTitle>
              <CardDescription>
                Enter scores (1-10) for each deal and criterion
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] sm:min-w-[200px]">Criterion</TableHead>
                    <TableHead className="w-20">Weight</TableHead>
                    {selectedDeals.map((deal) => (
                      <TableHead
                        key={deal.id}
                        className="text-center min-w-[120px]"
                      >
                        <div className="text-xs font-semibold">{deal.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ${deal.value?.toLocaleString() || 0}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((criterion) => {
                    // Find max score for this criterion
                    const maxScore = Math.max(
                      ...selectedDeals.map((deal) => {
                        const ds = dealScores.find((d) => d.dealId === deal.id);
                        return ds?.scores[criterion.id] || 0;
                      })
                    );

                    return (
                      <TableRow key={criterion.id}>
                        <TableCell className="font-medium">
                          {criterion.name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {criterion.weight}%
                        </TableCell>
                        {selectedDeals.map((deal) => {
                          const ds = dealScores.find(
                            (d) => d.dealId === deal.id
                          );
                          const score = ds?.scores[criterion.id] || 5;
                          const isMaxScore = score === maxScore && maxScore > 0;

                          return (
                            <TableCell
                              key={deal.id}
                              className={`text-center p-2 ${
                                isMaxScore ? 'bg-green-50 dark:bg-green-950' : ''
                              }`}
                            >
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={score}
                                onChange={(e) =>
                                  updateScore(
                                    deal.id,
                                    criterion.id,
                                    parseInt(e.target.value) || 5
                                  )
                                }
                                className="w-16 px-2 py-1 border rounded text-center text-sm"
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}

                  {/* Weighted Total Row */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>Weighted Total Score</TableCell>
                    <TableCell>100%</TableCell>
                    {selectedDeals.map((deal) => {
                      const score = calculateWeightedScore(deal.id);
                      return (
                        <TableCell key={deal.id} className="text-center">
                          <div className="text-lg font-bold">
                            {score.toFixed(1)}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Rankings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                Deal Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rankedDeals.map(({ deal, score }, index) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-transparent to-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          index === 0
                            ? 'default'
                            : index === 1
                              ? 'secondary'
                              : 'outline'
                        }
                        className="min-w-fit"
                      >
                        {index === 0
                          ? '🥇 1st'
                          : index === 1
                            ? '🥈 2nd'
                            : index === 2
                              ? '🥉 3rd'
                              : `${index + 1}th`}
                      </Badge>
                      <div>
                        <div className="font-semibold">{deal.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {deal.propertyName || deal.stage}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{score.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">
                        out of 10
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Radar Chart */}
          {radarData.length > 0 && rankedDeals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Multi-Dimensional Comparison</CardTitle>
                <CardDescription>
                  Radar chart showing all deals across all criteria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={radarData}>
                    <PolarGrid strokeDasharray="3 3" />
                    <PolarAngleAxis
                      dataKey="criterion"
                      tick={{ fontSize: 12 }}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, 10]} />
                    {rankedDeals.map(({ deal }, index) => (
                      <Radar
                        key={deal.id}
                        name={deal.name}
                        dataKey={deal.name}
                        stroke={colors[index % colors.length]}
                        fill={colors[index % colors.length]}
                        fillOpacity={0.25}
                      />
                    ))}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
