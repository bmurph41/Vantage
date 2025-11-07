import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  X, 
  Plus, 
  Lightbulb, 
  TrendingUp, 
  MapPin,
  Building,
  DollarSign,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Star
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBulkAddCompsToProject } from '@/hooks/ratecomps/useProjects';
import type { RcProject, RateComp } from "@shared/schema";
import { formatCurrency } from '@/lib/ratecomps/format';

interface RecommendationWithScore {
  comp: RateComp;
  score: number;
  reasons: string[];
  breakdown: {
    capacity: number;
    financial: number;
    profitCenters: number;
    regional: number;
    geo: number;
  };
}

interface RecommendationsDialogProps {
  open: boolean;
  onClose: () => void;
  project: RcProject;
  existingCompIds: string[];
  onSuccess?: () => void;
}

export default function RecommendationsDialog({ 
  open, 
  onClose, 
  project,
  existingCompIds,
  onSuccess 
}: RecommendationsDialogProps) {
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const bulkAddMutation = useBulkAddCompsToProject();

  const { data: recommendationsResponse, isLoading, error, refetch } = useQuery<{
    items: RecommendationWithScore[];
    total: number;
    projectProfile: any;
    weights: any;
  }>({
    queryKey: ['/api/projects', project.id, 'recommendations'],
    enabled: open && !!project.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const recommendations = recommendationsResponse?.items || [];

  // Reset selected comps when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCompIds([]);
    }
  }, [open]);

  const handleSubmitFeedback = async (compId: string, action: 'liked' | 'rejected') => {
    const recommendation = recommendations.find(r => r.comp.id === compId);
    if (!recommendation) return;

    try {
      await apiRequest('POST', '/api/recommendations/feedback', {
        projectId: project.id,
        salesCompId: compId,
        action,
        score: recommendation.score,
        breakdown: recommendation.breakdown
      });
      
      // Refresh recommendations to get updated ML weights
      refetch();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleAddSelected = async () => {
    if (selectedCompIds.length === 0) return;

    // Submit positive feedback for selected comps
    await Promise.all(
      selectedCompIds.map(compId => handleSubmitFeedback(compId, 'liked'))
    );

    // Add comps to project
    bulkAddMutation.mutate(
      { projectId: project.id, compIds: selectedCompIds },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
          setSelectedCompIds([]);
        },
      }
    );
  };

  const handleClose = () => {
    if (!bulkAddMutation.isPending) {
      onClose();
      setSelectedCompIds([]);
    }
  };

  const toggleSelection = (compId: string) => {
    setSelectedCompIds(prev => 
      prev.includes(compId) 
        ? prev.filter(id => id !== compId)
        : [...prev, compId]
    );
  };

  const filteredRecommendations = recommendations.filter(rec => 
    !existingCompIds.includes(rec.comp.id)
  );

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600 dark:text-green-400";
    if (score >= 0.6) return "text-blue-600 dark:text-blue-400";
    if (score >= 0.4) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 0.8) return "Excellent";
    if (score >= 0.6) return "Good";
    if (score >= 0.4) return "Fair";
    return "Poor";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Recommended Rate Comps for {project.name}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={bulkAddMutation.isPending}
              data-testid="button-close-recommendations"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Finding the best matches...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-destructive mb-4">Failed to load recommendations</p>
              <Button variant="outline" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          )}

          {!isLoading && !error && filteredRecommendations.length === 0 && (
            <div className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No new recommendations found</p>
              <p className="text-sm text-muted-foreground">
                Try updating your project profile or add more rate comps to improve recommendations.
              </p>
            </div>
          )}

          {filteredRecommendations.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredRecommendations.length} recommendations based on your project profile
                </p>
                {selectedCompIds.length > 0 && (
                  <Badge variant="secondary">
                    {selectedCompIds.length} selected
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                {filteredRecommendations.map(recommendation => {
                  const comp = recommendation.comp;
                  const isSelected = selectedCompIds.includes(comp.id);
                  const totalCapacity = (comp.wetSlips || 0) + (comp.dryRacks || 0);

                  return (
                    <Card key={comp.id} className={`transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(comp.id)}
                            data-testid={`checkbox-recommendation-${comp.id}`}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium text-foreground truncate">
                                    {comp.marina}
                                  </h3>
                                  <Badge 
                                    variant="secondary" 
                                    className={getScoreColor(recommendation.score)}
                                  >
                                    <Star className="h-3 w-3 mr-1" />
                                    {Math.round(recommendation.score * 100)}% match
                                  </Badge>
                                  <Badge variant="outline">
                                    {getScoreBadge(recommendation.score)}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {comp.market && comp.state ? `${comp.market}, ${comp.state}` : comp.state || comp.market || 'Unknown'}
                                  </div>
                                  {totalCapacity > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Building className="h-3 w-3" />
                                      {totalCapacity} slips
                                    </div>
                                  )}
                                  {comp.noi && (
                                    <div className="flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      {formatCurrency(Number(comp.noi))} NOI
                                    </div>
                                  )}
                                  {comp.salePrice && (
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      {formatCurrency(Number(comp.salePrice))}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-1 mb-2">
                                  {comp.profitCenters?.map(pc => (
                                    <Badge key={pc} variant="secondary" className="text-xs">
                                      {pc}
                                    </Badge>
                                  ))}
                                </div>

                                <div className="text-sm text-muted-foreground">
                                  <strong>Why recommended:</strong> {recommendation.reasons.join(', ')}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSubmitFeedback(comp.id, 'liked')}
                                      data-testid={`button-like-${comp.id}`}
                                    >
                                      <ThumbsUp className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>This helps improve future recommendations</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSubmitFeedback(comp.id, 'rejected')}
                                      data-testid={`button-dislike-${comp.id}`}
                                    >
                                      <ThumbsDown className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>This helps improve future recommendations</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {filteredRecommendations.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Select recommendations to add to your project
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={bulkAddMutation.isPending}
                  data-testid="button-cancel-recommendations"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddSelected}
                  disabled={selectedCompIds.length === 0 || bulkAddMutation.isPending}
                  data-testid="button-add-selected-recommendations"
                >
                  {bulkAddMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding to Project...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add {selectedCompIds.length} Selected
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}