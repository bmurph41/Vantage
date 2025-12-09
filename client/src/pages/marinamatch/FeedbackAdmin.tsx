import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { 
  Check, X, MessageSquareWarning, ExternalLink, Clock, 
  AlertTriangle, Filter, Brain, Loader2, ChevronRight,
  Globe, Trash2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ListingFeedback {
  id: string;
  listingId: string;
  userId?: string;
  orgId?: string;
  reason: string;
  customReason?: string;
  details?: string;
  listingTitle?: string;
  listingSource?: string;
  listingUrl?: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  aiPatternApplied: boolean;
  createdAt: string;
}

interface FeedbackStats {
  totals: {
    total: number;
    pending: number;
    approved: number;
    dismissed: number;
  };
  byReason: Array<{ reason: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  patterns: {
    totalPatterns: number;
    activePatterns: number;
  };
}

interface AiPattern {
  id: string;
  patternType: string;
  pattern: string;
  reason: string;
  source?: string;
  feedbackCount: number;
  isActive: boolean;
  confidence: string;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  sold_closed: "Sold / Closed",
  under_contract: "Under Contract",
  off_market: "Off Market",
  duplicate_listing: "Duplicate",
  not_a_marina: "Not a Marina",
  incorrect_information: "Incorrect Info",
  spam_or_fake: "Spam / Fake",
  broken_link: "Broken Link",
  other: "Other",
};

export function FeedbackAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<ListingFeedback | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [createPattern, setCreatePattern] = useState(true);
  const [showPatterns, setShowPatterns] = useState(false);

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery<{
    feedback: ListingFeedback[];
    pagination: { page: number; limit: number; total: number; pages: number };
    stats: { pending: number };
  }>({
    queryKey: ["/api/marinamatch/intel/feedback", statusFilter, reasonFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (reasonFilter !== "all") params.set("reason", reasonFilter);
      const res = await fetch(`/api/marinamatch/intel/feedback?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return res.json();
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<FeedbackStats>({
    queryKey: ["/api/marinamatch/intel/feedback/stats"],
  });

  const { data: patterns, isLoading: patternsLoading } = useQuery<AiPattern[]>({
    queryKey: ["/api/marinamatch/intel/ai-patterns"],
    enabled: showPatterns,
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { id: string; status: "approved" | "dismissed"; reviewNotes?: string; createPattern?: boolean }) => {
      return apiRequest("PATCH", `/api/marinamatch/intel/feedback/${data.id}`, {
        status: data.status,
        reviewNotes: data.reviewNotes,
        createPattern: data.createPattern,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/feedback/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/ai-patterns"] });
      setSelectedFeedback(null);
      setReviewNotes("");
      toast({
        title: variables.status === "approved" ? "Feedback approved" : "Feedback dismissed",
        description: variables.status === "approved" 
          ? "Listing marked as removed. Pattern created for AI training." 
          : "Feedback has been dismissed.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to review feedback.", variant: "destructive" });
    },
  });

  const togglePatternMutation = useMutation({
    mutationFn: async (data: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/marinamatch/intel/ai-patterns/${data.id}`, { isActive: data.isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/ai-patterns"] });
      toast({ title: "Pattern updated" });
    },
  });

  const deletePatternMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/marinamatch/intel/ai-patterns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/ai-patterns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/feedback/stats"] });
      toast({ title: "Pattern deleted" });
    },
  });

  const getReasonBadgeStyle = (reason: string) => {
    switch (reason) {
      case "sold_closed":
      case "under_contract":
      case "off_market":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "duplicate_listing":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "not_a_marina":
      case "spam_or_fake":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "incorrect_information":
      case "broken_link":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case "dismissed":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-amber-500" />
            Feedback Review
          </h2>
          <p className="text-sm text-muted-foreground">Review user reports and train AI to filter bad listings</p>
        </div>
        <Button
          variant={showPatterns ? "default" : "outline"}
          onClick={() => setShowPatterns(!showPatterns)}
          className="gap-2"
          data-testid="button-toggle-patterns"
        >
          <Brain className="h-4 w-4" />
          AI Patterns ({stats?.patterns?.activePatterns || 0})
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardDescription className="text-xs">Pending Review</CardDescription>
            <CardTitle className="text-2xl text-amber-600" data-testid="stat-pending">
              {statsLoading ? <Skeleton className="h-7 w-12" /> : stats?.totals?.pending || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardDescription className="text-xs">Approved</CardDescription>
            <CardTitle className="text-2xl text-green-600" data-testid="stat-approved">
              {statsLoading ? <Skeleton className="h-7 w-12" /> : stats?.totals?.approved || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardDescription className="text-xs">Dismissed</CardDescription>
            <CardTitle className="text-2xl text-gray-600" data-testid="stat-dismissed">
              {statsLoading ? <Skeleton className="h-7 w-12" /> : stats?.totals?.dismissed || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardDescription className="text-xs">AI Patterns</CardDescription>
            <CardTitle className="text-2xl text-purple-600" data-testid="stat-patterns">
              {statsLoading ? <Skeleton className="h-7 w-12" /> : stats?.patterns?.activePatterns || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* AI Patterns Panel */}
      {showPatterns && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Learned AI Patterns
            </CardTitle>
            <CardDescription>Patterns learned from user feedback that filter future listings</CardDescription>
          </CardHeader>
          <CardContent>
            {patternsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !patterns?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No patterns learned yet. Approve feedback with "Train AI" enabled to create patterns.
              </p>
            ) : (
              <div className="space-y-2">
                {patterns.map(pattern => (
                  <div key={pattern.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-0.5 rounded">{pattern.pattern}</code>
                        <Badge variant="outline" className={getReasonBadgeStyle(pattern.reason)}>
                          {REASON_LABELS[pattern.reason] || pattern.reason}
                        </Badge>
                        {pattern.source && (
                          <Badge variant="secondary" className="text-xs">{pattern.source}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Type: {pattern.patternType} • Confidence: {parseFloat(pattern.confidence) * 100}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={pattern.isActive}
                        onCheckedChange={(checked) => togglePatternMutation.mutate({ id: pattern.id, isActive: checked })}
                        data-testid={`switch-pattern-${pattern.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this pattern?")) {
                            deletePatternMutation.mutate(pattern.id);
                          }
                        }}
                        data-testid={`button-delete-pattern-${pattern.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">User Reports</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-8" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger className="w-[150px] h-8" data-testid="select-reason-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  {Object.entries(REASON_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {feedbackLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !feedbackData?.feedback?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No feedback reports found.
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {feedbackData.feedback.map(fb => (
                  <div 
                    key={fb.id} 
                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedFeedback(fb);
                      setReviewNotes("");
                      setCreatePattern(true);
                    }}
                    data-testid={`feedback-item-${fb.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{fb.listingTitle || "Unknown Listing"}</p>
                          {getStatusBadge(fb.status)}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className={getReasonBadgeStyle(fb.reason)}>
                            {REASON_LABELS[fb.reason] || fb.reason}
                          </Badge>
                          {fb.listingSource && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {fb.listingSource}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(fb.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {fb.details && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{fb.details}</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Feedback Review Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Feedback</DialogTitle>
            <DialogDescription>
              Approve to remove listing and optionally train AI. Dismiss to keep listing.
            </DialogDescription>
          </DialogHeader>
          
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{selectedFeedback.listingTitle}</p>
                <div className="flex items-center gap-2 mt-1">
                  {selectedFeedback.listingSource && (
                    <Badge variant="secondary" className="text-xs">{selectedFeedback.listingSource}</Badge>
                  )}
                  {selectedFeedback.listingUrl && (
                    <a 
                      href={selectedFeedback.listingUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View Original <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Reported Issue</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getReasonBadgeStyle(selectedFeedback.reason)}>
                    {REASON_LABELS[selectedFeedback.reason] || selectedFeedback.reason}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(selectedFeedback.createdAt), { addSuffix: true })}
                  </span>
                </div>
                {selectedFeedback.details && (
                  <p className="text-sm mt-2 p-2 bg-muted rounded">{selectedFeedback.details}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Train AI on this feedback</Label>
                    <p className="text-xs text-muted-foreground">Creates a filter pattern from listing keywords</p>
                  </div>
                  <Switch 
                    checked={createPattern} 
                    onCheckedChange={setCreatePattern}
                    data-testid="switch-create-pattern"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Review Notes (optional)</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this review..."
                    className="resize-none"
                    rows={2}
                    data-testid="textarea-review-notes"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    reviewMutation.mutate({
                      id: selectedFeedback.id,
                      status: "dismissed",
                      reviewNotes,
                    });
                  }}
                  disabled={reviewMutation.isPending}
                  data-testid="button-dismiss-feedback"
                >
                  <X className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
                <Button
                  onClick={() => {
                    reviewMutation.mutate({
                      id: selectedFeedback.id,
                      status: "approved",
                      reviewNotes,
                      createPattern,
                    });
                  }}
                  disabled={reviewMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-approve-feedback"
                >
                  {reviewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Approve & Remove
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
