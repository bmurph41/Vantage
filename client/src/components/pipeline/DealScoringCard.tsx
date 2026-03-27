import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Award, Star, Loader2, TrendingUp, History } from "lucide-react";
import { format } from "date-fns";

interface DealScoringCardProps {
  dealId: string;
  dealTitle?: string;
}

interface ScoringModel {
  id: string;
  name: string;
  criteria: Array<{
    name: string;
    weight: number;
    type: string;
    maxScore: number;
    options?: string[];
  }>;
  isDefault: boolean;
}

interface DealScoreData {
  currentScore: {
    id: string;
    totalScore: string;
    grade: string;
    scores: Record<string, number>;
    scoredAt: string;
  } | null;
  history: Array<{
    id: string;
    totalScore: string;
    grade: string;
    scoredAt: string;
  }>;
  model: ScoringModel | null;
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-500",
  B: "bg-blue-500",
  C: "bg-yellow-500",
  D: "bg-orange-500",
  F: "bg-red-500",
};

export default function DealScoringCard({ dealId, dealTitle }: DealScoringCardProps) {
  const { toast } = useToast();
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});

  const { data: scoreData, isLoading: scoreLoading } = useQuery<DealScoreData>({
    queryKey: [`/api/pipeline/scoring/deals/${dealId}/score`],
  });

  const { data: models = [] } = useQuery<ScoringModel[]>({
    queryKey: ["/api/pipeline/scoring/models"],
  });

  const scoreMutation = useMutation({
    mutationFn: async (data: { modelId: string; scores: Record<string, number> }) => {
      const res = await apiRequest("POST", `/api/pipeline/scoring/deals/${dealId}/score`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline/scoring/deals/${dealId}/score`] });
      toast({ title: "Deal scored successfully" });
      setShowScoreDialog(false);
      setCriteriaScores({});
    },
    onError: () => toast({ title: "Failed to score deal", variant: "destructive" }),
  });

  const currentScore = scoreData?.currentScore;
  const totalScore = currentScore ? Number(currentScore.totalScore) : 0;
  const grade = currentScore?.grade || "--";

  function openScoring() {
    const defaultModel = models.find(m => m.isDefault) || models[0];
    if (defaultModel) {
      setSelectedModelId(defaultModel.id);
      // Pre-fill with existing scores if available
      if (currentScore?.scores) {
        setCriteriaScores(currentScore.scores);
      }
    }
    setShowScoreDialog(true);
  }

  function handleScore() {
    if (!selectedModelId) {
      toast({ title: "Please select a scoring model", variant: "destructive" });
      return;
    }
    scoreMutation.mutate({ modelId: selectedModelId, scores: criteriaScores });
  }

  const selectedModel = models.find(m => m.id === selectedModelId);
  const criteria = (selectedModel?.criteria as any[]) || [];

  if (scoreLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Deal Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentScore ? (
            <div className="space-y-4">
              {/* Score gauge */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={totalScore >= 80 ? "#22c55e" : totalScore >= 60 ? "#3b82f6" : totalScore >= 40 ? "#f59e0b" : "#ef4444"}
                      strokeWidth="3"
                      strokeDasharray={`${totalScore}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold">{totalScore.toFixed(0)}</span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`${GRADE_COLORS[grade] || "bg-gray-500"} text-white text-lg px-3 py-1`}>
                      {grade}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      scored {format(new Date(currentScore.scoredAt), "MM/dd/yyyy")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Criteria breakdown */}
              {scoreData?.model && currentScore.scores && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase">Criteria Breakdown</h4>
                  {((scoreData.model.criteria as any[]) || []).map((criterion: any) => {
                    const score = currentScore.scores[criterion.name] || 0;
                    const maxScore = criterion.maxScore || 10;
                    const pct = (score / maxScore) * 100;
                    return (
                      <div key={criterion.name} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-28 truncate">{criterion.name}</span>
                        <Progress value={pct} className="flex-1 h-2" />
                        <span className="text-xs font-medium w-12 text-right">{score}/{maxScore}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={openScoring}>
                  <Star className="h-3.5 w-3.5 mr-1" />
                  Re-score
                </Button>
                {(scoreData?.history?.length || 0) > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => setShowHistory(true)}>
                    <History className="h-3.5 w-3.5 mr-1" />
                    History ({scoreData!.history.length})
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500 mb-3">No score yet</p>
              <Button size="sm" onClick={openScoring} disabled={models.length === 0}>
                <Star className="h-3.5 w-3.5 mr-1" />
                Score Deal
              </Button>
              {models.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">Create a scoring model first</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scoring Dialog */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Score Deal{dealTitle ? `: ${dealTitle}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Scoring Model</Label>
              <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.isDefault ? "(Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {criteria.length > 0 && (
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-gray-500 uppercase">Score each criterion</Label>
                {criteria.map((c: any) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <Label className="text-sm w-32 truncate flex-shrink-0">{c.name}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={c.maxScore || 10}
                      value={criteriaScores[c.name] ?? ""}
                      onChange={(e) => setCriteriaScores({ ...criteriaScores, [c.name]: Number(e.target.value) })}
                      className="w-20"
                      placeholder={`0-${c.maxScore || 10}`}
                    />
                    <span className="text-xs text-gray-400">/ {c.maxScore || 10}</span>
                    <Badge variant="outline" className="text-[10px]">
                      w:{c.weight || 1}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {criteria.length === 0 && selectedModelId && (
              <p className="text-sm text-gray-500 text-center py-4">
                This model has no criteria defined. Edit the model to add scoring criteria.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScoreDialog(false)}>Cancel</Button>
            <Button onClick={handleScore} disabled={scoreMutation.isPending || criteria.length === 0}>
              {scoreMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Score History</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[300px] overflow-y-auto">
            {scoreData?.history?.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge className={`${GRADE_COLORS[entry.grade] || "bg-gray-500"} text-white text-xs`}>
                    {entry.grade}
                  </Badge>
                  <span className="text-sm font-medium">{Number(entry.totalScore).toFixed(1)}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {format(new Date(entry.scoredAt), "MM/dd/yyyy h:mm a")}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
