import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient as dockTalkQueryClient } from "../lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Tags, 
  Plus, 
  Edit, 
  Trash2, 
  Brain, 
  ThumbsDown, 
  Copy, 
  AlertTriangle,
  Sparkles,
  MoreHorizontal,
  ThumbsUp,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Target,
  Zap,
  ListChecks,
  PieChart,
  Activity
} from "lucide-react";

interface UserTag {
  id: number;
  userId: string;
  orgId: string;
  name: string;
  description: string | null;
  color: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackStats {
  totalFeedback: number;
  irrelevantCount: number;
  duplicateCount: number;
  lowQualityCount: number;
  helpfulCount: number;
}

interface TrainingAnalytics {
  totalArticles: number;
  totalFeedback: number;
  manuallyReviewedCount: number;
  correctedCategoriesCount: number;
  feedbackByType: Record<string, number>;
  categoryDistribution: Record<string, number>;
  categoryAccuracy: Record<string, { total: number; correct: number; accuracy: number }>;
  confidenceRanges: { low: number; medium: number; high: number };
  weeklyFeedback: Array<{ week: string; count: number; helpful: number; negative: number }>;
  modelRefinement: {
    unprocessedFeedbackCount: number;
    threshold: number;
    readyForRefinement: boolean;
    estimatedAccuracyImprovement: string;
  };
  generatedAt: string;
}

interface ReviewQueueArticle {
  id: number;
  title: string;
  category: string | null;
  categories: string[] | null;
  aiConfidence: number | null;
  source: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface CategorySuggestion {
  category: string;
  usageCount: number;
  isDefault: boolean;
}

const tagFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
});

type TagFormData = z.infer<typeof tagFormSchema>;

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function TrainingAnalyticsDashboard() {
  const { toast } = useToast();
  const [selectedArticles, setSelectedArticles] = useState<number[]>([]);
  const [reviewFilter, setReviewFilter] = useState<string>('all');
  const [bulkCategory, setBulkCategory] = useState<string>('');

  const handleFilterChange = (newFilter: string) => {
    setSelectedArticles([]);
    setBulkCategory('');
    setReviewFilter(newFilter);
  };

  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<TrainingAnalytics>({
    queryKey: ["/api/docktalk/training/analytics"],
    refetchInterval: 60000,
  });

  const { data: reviewQueue, isLoading: queueLoading, refetch: refetchQueue } = useQuery<{ articles: ReviewQueueArticle[]; filter: string; count: number }>({
    queryKey: ["/api/docktalk/training/review-queue", reviewFilter],
  });

  const { data: categorySuggestions } = useQuery<{ categories: CategorySuggestion[]; totalReviewedArticles: number }>({
    queryKey: ["/api/docktalk/training/category-suggestions"],
  });

  const triggerRefinementMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/docktalk/training/trigger-refinement", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to trigger refinement");
      return res.json();
    },
    onSuccess: (data) => {
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/training/analytics"] });
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/training/review-queue"] });
      toast({
        title: "Model Refinement Complete",
        description: `Processed ${data.processedCount} feedback items`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to trigger model refinement",
        variant: "destructive",
      });
    },
  });

  const bulkReviewMutation = useMutation({
    mutationFn: async ({ articleIds, category, action }: { articleIds: number[]; category?: string; action: 'approve' | 'correct' }) => {
      const payload: { articleIds: number[]; action: string; category?: string } = { articleIds, action };
      if (action === 'correct' && category) {
        payload.category = category;
      }
      const res = await fetch("/api/docktalk/training/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to bulk review");
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedArticles([]);
      setBulkCategory('');
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/training/review-queue"] });
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/training/analytics"] });
      toast({
        title: "Bulk Review Complete",
        description: `Updated ${data.updatedCount} articles`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to bulk review articles",
        variant: "destructive",
      });
    },
  });

  const toggleArticleSelection = (id: number) => {
    setSelectedArticles(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const selectAllArticles = () => {
    if (reviewQueue?.articles) {
      setSelectedArticles(reviewQueue.articles.map(a => a.id));
    }
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  if (analyticsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totalConfidence = analytics 
    ? analytics.confidenceRanges.low + analytics.confidenceRanges.medium + analytics.confidenceRanges.high
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Training Analytics Dashboard
          </h3>
          <p className="text-sm text-muted-foreground">
            AI model performance and training pipeline status
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetchAnalytics()}
          data-testid="button-refresh-analytics"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {analytics?.totalArticles || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Articles</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {analytics?.manuallyReviewedCount || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Manually Reviewed</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {analytics?.totalFeedback || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Feedback</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">
                {analytics?.correctedCategoriesCount || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Category Corrections</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Model Refinement Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Unprocessed Feedback</span>
                <span className="font-medium">
                  {analytics?.modelRefinement.unprocessedFeedbackCount || 0} / {analytics?.modelRefinement.threshold || 50}
                </span>
              </div>
              <Progress 
                value={((analytics?.modelRefinement.unprocessedFeedbackCount || 0) / (analytics?.modelRefinement.threshold || 50)) * 100}
                className="h-2"
              />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                {analytics?.modelRefinement.readyForRefinement ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Ready for Refinement
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Collecting Feedback
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Est. Accuracy Improvement</span>
                <span className="font-medium text-green-600">
                  +{analytics?.modelRefinement.estimatedAccuracyImprovement || 0}%
                </span>
              </div>

              <Button 
                className="w-full"
                disabled={!analytics?.modelRefinement.readyForRefinement || triggerRefinementMutation.isPending}
                onClick={() => triggerRefinementMutation.mutate()}
                data-testid="button-trigger-refinement"
              >
                {triggerRefinementMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Trigger Model Refinement
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              AI Confidence Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">High Confidence (≥80%)</span>
                </div>
                <span className="font-medium">
                  {analytics?.confidenceRanges.high || 0}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({totalConfidence > 0 ? formatPercent((analytics?.confidenceRanges.high || 0) / totalConfidence * 100) : '0%'})
                  </span>
                </span>
              </div>
              <Progress 
                value={totalConfidence > 0 ? ((analytics?.confidenceRanges.high || 0) / totalConfidence) * 100 : 0}
                className="h-2 bg-green-100"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm">Medium Confidence (50-80%)</span>
                </div>
                <span className="font-medium">
                  {analytics?.confidenceRanges.medium || 0}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({totalConfidence > 0 ? formatPercent((analytics?.confidenceRanges.medium || 0) / totalConfidence * 100) : '0%'})
                  </span>
                </span>
              </div>
              <Progress 
                value={totalConfidence > 0 ? ((analytics?.confidenceRanges.medium || 0) / totalConfidence) * 100 : 0}
                className="h-2 bg-amber-100"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm">Low Confidence (&lt;50%)</span>
                </div>
                <span className="font-medium">
                  {analytics?.confidenceRanges.low || 0}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({totalConfidence > 0 ? formatPercent((analytics?.confidenceRanges.low || 0) / totalConfidence * 100) : '0%'})
                  </span>
                </span>
              </div>
              <Progress 
                value={totalConfidence > 0 ? ((analytics?.confidenceRanges.low || 0) / totalConfidence) * 100 : 0}
                className="h-2 bg-red-100"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500" />
            Feedback Trends (Last 4 Weeks)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {analytics?.weeklyFeedback.map((week, idx) => (
              <div key={idx} className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-sm font-medium mb-2">{week.week}</div>
                <div className="text-2xl font-bold">{week.count}</div>
                <div className="flex items-center justify-center gap-2 mt-2 text-xs">
                  <span className="flex items-center text-green-600">
                    <ThumbsUp className="h-3 w-3 mr-0.5" />
                    {week.helpful}
                  </span>
                  <span className="flex items-center text-red-600">
                    <ThumbsDown className="h-3 w-3 mr-0.5" />
                    {week.negative}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-orange-500" />
              Review Queue ({reviewQueue?.count || 0} articles)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={reviewFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-40" data-testid="select-review-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pending</SelectItem>
                  <SelectItem value="low_confidence">Low Confidence</SelectItem>
                  <SelectItem value="flagged">Flagged by Users</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetchQueue()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedArticles.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedArticles.length} article{selectedArticles.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Select value={bulkCategory} onValueChange={setBulkCategory}>
                    <SelectTrigger className="w-40" data-testid="select-bulk-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorySuggestions?.categories.map(cat => (
                        <SelectItem key={cat.category} value={cat.category}>
                          {cat.category} ({cat.usageCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={bulkReviewMutation.isPending}
                    onClick={() => bulkReviewMutation.mutate({
                      articleIds: selectedArticles,
                      action: 'approve'
                    })}
                    data-testid="button-bulk-approve"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve Current
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!bulkCategory || bulkReviewMutation.isPending}
                    onClick={() => bulkReviewMutation.mutate({
                      articleIds: selectedArticles,
                      category: bulkCategory,
                      action: 'correct'
                    })}
                    data-testid="button-bulk-correct"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Correct
                  </Button>
                </div>
              </div>
            </div>
          )}

          {queueLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : reviewQueue?.articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No articles pending review</p>
              <p className="text-xs">All articles have been reviewed or have high confidence</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Button variant="ghost" size="sm" onClick={selectAllArticles}>
                  Select All
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedArticles([])}
                  disabled={selectedArticles.length === 0}
                >
                  Clear Selection
                </Button>
              </div>
              {reviewQueue?.articles.map(article => (
                <div 
                  key={article.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedArticles.includes(article.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedArticles.includes(article.id)}
                    onCheckedChange={() => toggleArticleSelection(article.id)}
                    data-testid={`checkbox-article-${article.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{article.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {article.category || 'Uncategorized'}
                      </Badge>
                      <span>{article.source}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      (article.aiConfidence || 0) >= 0.8 ? 'text-green-600' :
                      (article.aiConfidence || 0) >= 0.5 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {((article.aiConfidence || 0) * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">confidence</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {analytics?.categoryAccuracy && Object.keys(analytics.categoryAccuracy).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-indigo-500" />
              Category Accuracy (Based on Manual Reviews)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(analytics.categoryAccuracy)
                .filter(([cat]) => cat !== 'Unknown')
                .sort(([,a], [,b]) => b.total - a.total)
                .slice(0, 8)
                .map(([category, data]) => (
                  <div key={category} className="p-3 rounded-lg bg-muted/50">
                    <div className="font-medium text-sm truncate" title={category}>
                      {category}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-lg font-bold ${
                        data.accuracy >= 80 ? 'text-green-600' :
                        data.accuracy >= 60 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {data.accuracy.toFixed(0)}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {data.correct}/{data.total}
                      </span>
                    </div>
                    <Progress 
                      value={data.accuracy} 
                      className={`h-1 mt-1 ${
                        data.accuracy >= 80 ? 'bg-green-100' :
                        data.accuracy >= 60 ? 'bg-amber-100' : 'bg-red-100'
                      }`}
                    />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AITraining() {
  const { toast } = useToast();
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [isEditTagOpen, setIsEditTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<UserTag | null>(null);
  const [deleteTagId, setDeleteTagId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

  const form = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#6366f1",
    },
  });

  const editForm = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
  });

  const { data: tags = [], isLoading: tagsLoading } = useQuery<UserTag[]>({
    queryKey: ["/api/docktalk/tags"],
  });

  const { data: feedbackStats } = useQuery<FeedbackStats>({
    queryKey: ["/api/docktalk/feedback/stats"],
  });

  const createTagMutation = useMutation({
    mutationFn: async (data: TagFormData) => {
      const res = await fetch("/api/docktalk/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create tag");
      }
      return res.json();
    },
    onSuccess: () => {
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/tags"] });
      setIsAddTagOpen(false);
      form.reset();
      toast({
        title: "Tag Created",
        description: "Your tag has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TagFormData> }) => {
      const res = await fetch(`/api/docktalk/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update tag");
      }
      return res.json();
    },
    onSuccess: () => {
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/tags"] });
      setIsEditTagOpen(false);
      setEditingTag(null);
      toast({
        title: "Tag Updated",
        description: "Your tag has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tag",
        variant: "destructive",
      });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/docktalk/tags/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete tag");
      }
      return res.json();
    },
    onSuccess: () => {
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/tags"] });
      setDeleteTagId(null);
      toast({
        title: "Tag Deleted",
        description: "Your tag has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete tag",
        variant: "destructive",
      });
    },
  });

  const handleEditTag = (tag: UserTag) => {
    setEditingTag(tag);
    editForm.reset({
      name: tag.name,
      description: tag.description || "",
      color: tag.color,
    });
    setIsEditTagOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-ai-training">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Training Center
          </CardTitle>
          <CardDescription>
            Train DockTalk's AI with feedback, tags, and manual reviews to improve content relevance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
                <Sparkles className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex items-center gap-2" data-testid="tab-tags">
                <Tags className="h-4 w-4" />
                Tags
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2" data-testid="tab-analytics">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Your AI Training Stats
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Your contributions help improve content relevance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-purple-600">
                          {feedbackStats?.totalFeedback || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Feedback</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-green-600">
                          {feedbackStats?.helpfulCount || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Helpful Articles</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-orange-600">
                          {feedbackStats?.irrelevantCount || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Marked Irrelevant</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-blue-600">
                          {feedbackStats?.duplicateCount || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Duplicates Found</div>
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-start gap-2">
                        <Brain className="h-4 w-4 mt-0.5 text-primary" />
                        <div className="text-xs">
                          <p className="font-medium text-primary">How to Train the AI</p>
                          <p className="text-muted-foreground mt-1">
                            When viewing articles, use the feedback buttons to:
                          </p>
                          <ul className="mt-1 space-y-0.5 text-muted-foreground">
                            <li className="flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3 text-green-500" /> Mark helpful content
                            </li>
                            <li className="flex items-center gap-1">
                              <ThumbsDown className="h-3 w-3 text-orange-500" /> Flag irrelevant articles
                            </li>
                            <li className="flex items-center gap-1">
                              <Copy className="h-3 w-3 text-blue-500" /> Report duplicates
                            </li>
                            <li className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-yellow-500" /> Flag low-quality content
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tags className="h-4 w-4" />
                      Quick Tag Overview
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Your custom tags for organizing articles
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tagsLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {tags.slice(0, 8).map((tag) => (
                          <Badge
                            key={tag.id}
                            style={{ backgroundColor: tag.color }}
                            className="text-white"
                          >
                            {tag.name}
                            {tag.usageCount > 0 && (
                              <span className="ml-1 opacity-75">({tag.usageCount})</span>
                            )}
                          </Badge>
                        ))}
                        {tags.length > 8 && (
                          <Badge variant="outline">+{tags.length - 8} more</Badge>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        <Tags className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No tags yet</p>
                      </div>
                    )}
                    <Button 
                      variant="outline" 
                      className="w-full mt-4"
                      onClick={() => setActiveTab("tags")}
                    >
                      Manage Tags
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tags" className="mt-6">
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Your Tag Library ({tags.length}/20)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Create custom tags to organize and train the AI on content categories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tagsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-3/4" />
                    </div>
                  ) : tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tags.map((tag) => (
                        <div key={tag.id} className="group relative">
                          <Badge
                            style={{ backgroundColor: tag.color }}
                            className="text-white pr-8 cursor-default"
                            data-testid={`tag-${tag.id}`}
                          >
                            {tag.name}
                            {tag.usageCount > 0 && (
                              <span className="ml-1 opacity-75">({tag.usageCount})</span>
                            )}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                data-testid={`tag-menu-${tag.id}`}
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTag(tag)}>
                                <Edit className="h-3 w-3 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTagId(tag.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <Tags className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No tags yet</p>
                      <p className="text-xs">Create tags to organize articles</p>
                    </div>
                  )}

                  <Dialog open={isAddTagOpen} onOpenChange={setIsAddTagOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={tags.length >= 20}
                        data-testid="button-add-tag"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Tag
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Tag</DialogTitle>
                        <DialogDescription>
                          Create a custom tag to categorize articles
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit((data) => createTagMutation.mutate(data))} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tag Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., M&A Deals" {...field} data-testid="input-tag-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Brief description of what this tag covers" 
                                    {...field} 
                                    data-testid="input-tag-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="color"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Color</FormLabel>
                                <FormControl>
                                  <div className="flex gap-2 flex-wrap">
                                    {PRESET_COLORS.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                                          field.value === color ? "border-foreground scale-110" : "border-transparent"
                                        }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => field.onChange(color)}
                                        data-testid={`color-${color}`}
                                      />
                                    ))}
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  Selected: <span style={{ color: field.value }}>{field.value}</span>
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddTagOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createTagMutation.isPending} data-testid="button-create-tag">
                              {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <TrainingAnalyticsDashboard />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isEditTagOpen} onOpenChange={setIsEditTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update your tag settings
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => 
              editingTag && updateTagMutation.mutate({ id: editingTag.id, data })
            )} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-tag-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-edit-tag-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex gap-2 flex-wrap">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                              field.value === color ? "border-foreground scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditTagOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTagMutation.isPending} data-testid="button-update-tag">
                  {updateTagMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTagId} onOpenChange={() => setDeleteTagId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tag? This will remove it from all articles you've tagged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTagId && deleteTagMutation.mutate(deleteTagId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-tag"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
