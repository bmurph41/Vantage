import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient as docketQueryClient } from "../lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  MoreHorizontal, 
  ThumbsUp, 
  ThumbsDown, 
  Copy, 
  AlertTriangle, 
  Tags,
  Check,
  X,
  Loader2
} from "lucide-react";

interface ArticleFeedbackProps {
  articleId: number;
  variant?: "dropdown" | "buttons";
}

interface UserTag {
  id: number;
  name: string;
  color: string;
}

interface ArticleTagAssignment {
  id: number;
  tagId: number;
  tagName?: string;
  tagColor?: string;
}

type FeedbackType = "helpful" | "irrelevant" | "duplicate" | "low_quality" | "wrong_category" | "spam";

export function ArticleFeedback({ articleId, variant = "dropdown" }: ArticleFeedbackProps) {
  const { toast } = useToast();
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState<FeedbackType | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");

  const { data: tags = [] } = useQuery<UserTag[]>({
    queryKey: ["/api/docket/tags"],
  });

  const { data: articleTags = [] } = useQuery<ArticleTagAssignment[]>({
    queryKey: ["/api/docket/articles", articleId, "tags"],
    queryFn: async () => {
      const res = await fetch(`/api/docket/articles/${articleId}/tags`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: articleFeedback } = useQuery<{ feedbackType: string }[]>({
    queryKey: ["/api/docket/articles", articleId, "feedback"],
    queryFn: async () => {
      const res = await fetch(`/api/docket/articles/${articleId}/feedback`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const assignTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const res = await fetch(`/api/docket/articles/${articleId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tagId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to assign tag");
      }
      return res.json();
    },
    onSuccess: () => {
      docketQueryClient.invalidateQueries({ queryKey: ["/api/docket/articles", articleId, "tags"] });
      docketQueryClient.invalidateQueries({ queryKey: ["/api/docket/tags"] });
      toast({
        title: "Tag Added",
        description: "Article has been tagged successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to tag article",
        variant: "destructive",
      });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const res = await fetch(`/api/docket/articles/${articleId}/tags/${tagId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove tag");
      }
      return res.json();
    },
    onSuccess: () => {
      docketQueryClient.invalidateQueries({ queryKey: ["/api/docket/articles", articleId, "tags"] });
      docketQueryClient.invalidateQueries({ queryKey: ["/api/docket/tags"] });
      toast({
        title: "Tag Removed",
        description: "Tag has been removed from this article.",
      });
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ feedbackType, reason }: { feedbackType: FeedbackType; reason?: string }) => {
      const res = await fetch(`/api/docket/articles/${articleId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ feedbackType, reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit feedback");
      }
      return res.json();
    },
    onSuccess: (_, { feedbackType }) => {
      docketQueryClient.invalidateQueries({ queryKey: ["/api/docket/articles", articleId, "feedback"] });
      docketQueryClient.invalidateQueries({ queryKey: ["/api/docket/feedback/stats"] });
      setFeedbackDialogOpen(false);
      setPendingFeedback(null);
      setFeedbackReason("");
      
      const messages: Record<FeedbackType, string> = {
        helpful: "Thanks! This helps improve recommendations.",
        irrelevant: "Article marked as irrelevant. Thanks for the feedback!",
        duplicate: "Marked as duplicate. We'll work on reducing these.",
        low_quality: "Thanks for flagging. This helps us filter better content.",
        wrong_category: "Category feedback recorded. Thanks!",
        spam: "Spam reported. We'll review this content.",
      };
      
      toast({
        title: "Feedback Submitted",
        description: messages[feedbackType],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  const handleFeedback = (type: FeedbackType, needsReason = false) => {
    if (needsReason) {
      setPendingFeedback(type);
      setFeedbackDialogOpen(true);
    } else {
      submitFeedbackMutation.mutate({ feedbackType: type });
    }
  };

  const hasFeedback = (type: FeedbackType) => {
    return articleFeedback?.some(f => f.feedbackType === type);
  };

  const assignedTagIds = articleTags.map(t => t.tagId);
  const availableTags = tags.filter(t => !assignedTagIds.includes(t.id));

  if (variant === "buttons") {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant={hasFeedback("helpful") ? "default" : "ghost"}
          size="sm"
          onClick={() => handleFeedback("helpful")}
          disabled={submitFeedbackMutation.isPending || hasFeedback("helpful")}
          className="h-7 px-2"
          data-testid={`feedback-helpful-${articleId}`}
        >
          {submitFeedbackMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ThumbsUp className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant={hasFeedback("irrelevant") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleFeedback("irrelevant", true)}
          disabled={submitFeedbackMutation.isPending || hasFeedback("irrelevant")}
          className="h-7 px-2"
          data-testid={`feedback-irrelevant-${articleId}`}
        >
          <ThumbsDown className="h-3 w-3" />
        </Button>
        
        {articleTags.length > 0 && (
          <div className="flex gap-1 ml-2">
            {articleTags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs h-5 cursor-pointer hover:opacity-75"
                style={{ backgroundColor: tag.tagColor, color: "white" }}
                onClick={() => removeTagMutation.mutate(tag.tagId)}
                data-testid={`article-tag-${tag.id}`}
              >
                {tag.tagName}
                <X className="h-2 w-2 ml-1" />
              </Badge>
            ))}
            {articleTags.length > 2 && (
              <Badge variant="outline" className="text-xs h-5">
                +{articleTags.length - 2}
              </Badge>
            )}
          </div>
        )}

        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Provide Feedback</DialogTitle>
              <DialogDescription>
                Why is this article {pendingFeedback === "irrelevant" ? "not relevant" : "problematic"}?
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Optional: Describe why (helps improve AI)"
              value={feedbackReason}
              onChange={(e) => setFeedbackReason(e.target.value)}
              data-testid="input-feedback-reason"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => pendingFeedback && submitFeedbackMutation.mutate({ 
                  feedbackType: pendingFeedback, 
                  reason: feedbackReason || undefined 
                })}
                disabled={submitFeedbackMutation.isPending}
                data-testid="button-submit-feedback"
              >
                {submitFeedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`feedback-menu-${articleId}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={() => handleFeedback("helpful")}
            disabled={hasFeedback("helpful")}
          >
            <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />
            {hasFeedback("helpful") ? "Marked Helpful" : "Helpful"}
            {hasFeedback("helpful") && <Check className="h-3 w-3 ml-auto" />}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => handleFeedback("irrelevant", true)}
            disabled={hasFeedback("irrelevant")}
          >
            <ThumbsDown className="h-4 w-4 mr-2 text-orange-500" />
            {hasFeedback("irrelevant") ? "Marked Irrelevant" : "Not Relevant"}
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleFeedback("duplicate")}
            disabled={hasFeedback("duplicate")}
          >
            <Copy className="h-4 w-4 mr-2 text-blue-500" />
            {hasFeedback("duplicate") ? "Marked Duplicate" : "Duplicate"}
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleFeedback("low_quality", true)}
            disabled={hasFeedback("low_quality")}
          >
            <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
            {hasFeedback("low_quality") ? "Marked Low Quality" : "Low Quality"}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {tags.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tags className="h-4 w-4 mr-2 text-purple-500" />
                Add Tag
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {availableTags.length > 0 ? (
                  availableTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      onClick={() => assignTagMutation.mutate(tag.id)}
                    >
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    All tags assigned
                  </div>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          
          {articleTags.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <X className="h-4 w-4 mr-2 text-red-500" />
                Remove Tag
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {articleTags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    onClick={() => removeTagMutation.mutate(tag.tagId)}
                  >
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: tag.tagColor }}
                    />
                    {tag.tagName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Feedback</DialogTitle>
            <DialogDescription>
              {pendingFeedback === "irrelevant" && "Why is this article not relevant to marina industry?"}
              {pendingFeedback === "low_quality" && "What's wrong with this article?"}
              {pendingFeedback === "wrong_category" && "What category should this article be in?"}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional: Provide more details (helps improve AI)"
            value={feedbackReason}
            onChange={(e) => setFeedbackReason(e.target.value)}
            data-testid="input-feedback-reason-dialog"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => pendingFeedback && submitFeedbackMutation.mutate({ 
                feedbackType: pendingFeedback, 
                reason: feedbackReason || undefined 
              })}
              disabled={submitFeedbackMutation.isPending}
              data-testid="button-submit-feedback-dialog"
            >
              {submitFeedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
