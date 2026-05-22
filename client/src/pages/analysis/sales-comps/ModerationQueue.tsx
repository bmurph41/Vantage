import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ShieldCheck, ShieldX, Clock, DollarSign, MapPin, User, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CompConfidenceBadge from "@/components/salescomps/sales-comps/CompConfidenceBadge";

interface ModerationComp {
  id: string;
  marina: string;
  city: string | null;
  state: string | null;
  salePrice: number | null;
  saleYear: number | null;
  verificationStatus: string | null;
  dataQualityScore: number | null;
  sourceConfidence: number | null;
  dataSource: string | null;
  createdByName: string | null;
  createdAt: string;
  sourceNotes: string | null;
  notes: string | null;
  duplicateFlags: number;
}

function QueueItem({
  comp,
  onVerify,
  onReject,
}: {
  comp: ModerationComp;
  onVerify: (comp: ModerationComp) => void;
  onReject: (comp: ModerationComp) => void;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-sm truncate">{comp.marina}</h3>
              <CompConfidenceBadge
                verificationStatus={comp.verificationStatus}
                dataQualityScore={comp.dataQualityScore}
                sourceConfidence={comp.sourceConfidence}
                dataSource={comp.dataSource}
                size="sm"
              />
              {comp.duplicateFlags > 0 && (
                <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {comp.duplicateFlags} possible duplicate{comp.duplicateFlags > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {(comp.city || comp.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[comp.city, comp.state].filter(Boolean).join(", ")}
                </span>
              )}
              {comp.salePrice && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${Number(comp.salePrice).toLocaleString()}
                  {comp.saleYear && ` (${comp.saleYear})`}
                </span>
              )}
              {comp.createdByName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {comp.createdByName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(comp.createdAt).toLocaleDateString()}
              </span>
            </div>
            {comp.sourceNotes && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">"{comp.sourceNotes}"</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
              onClick={() => onReject(comp)}
            >
              <ShieldX className="h-3 w-3 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
              onClick={() => onVerify(comp)}
            >
              <ShieldCheck className="h-3 w-3 mr-1" />
              Verify
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ModerationQueue() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [actionComp, setActionComp] = useState<ModerationComp | null>(null);
  const [actionType, setActionType] = useState<"verify" | "reject" | null>(null);
  const [moderationNotes, setModerationNotes] = useState("");

  const { data, isLoading, error } = useQuery<ModerationComp[]>({
    queryKey: ["/api/sales-comps/moderation-queue"],
    staleTime: 2 * 60 * 1000,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: "verify" | "reject"; notes: string }) =>
      apiRequest("PATCH", `/api/sales-comps/${id}/verify`, { action, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-comps/moderation-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-comps"] });
      toast({
        title: actionType === "verify" ? "Comp verified" : "Comp rejected",
        description:
          actionType === "verify"
            ? "The submission has been marked as document-verified."
            : "The submission has been rejected and flagged.",
      });
      setActionComp(null);
      setActionType(null);
      setModerationNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update verification status.", variant: "destructive" });
    },
  });

  const handleVerify = (comp: ModerationComp) => {
    setActionComp(comp);
    setActionType("verify");
    setModerationNotes("");
  };

  const handleReject = (comp: ModerationComp) => {
    setActionComp(comp);
    setActionType("reject");
    setModerationNotes("");
  };

  const handleConfirm = () => {
    if (!actionComp || !actionType) return;
    verifyMutation.mutate({ id: actionComp.id, action: actionType, notes: moderationNotes });
  };

  const queue = data || [];
  const highPriority = queue.filter((c) => c.salePrice && c.salePrice >= 5_000_000);
  const standard = queue.filter((c) => !c.salePrice || c.salePrice < 5_000_000);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/analysis/sales-comps")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Comps
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            Moderation Queue
          </h1>
          <p className="text-muted-foreground text-sm">
            Review and verify high-value comp submissions to elevate their confidence score.
          </p>
        </div>
        {!isLoading && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {queue.length} pending
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load moderation queue.
          </CardContent>
        </Card>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
            <p className="font-medium">Queue is clear</p>
            <p className="text-sm text-muted-foreground">All comp submissions have been reviewed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {highPriority.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                High-Value Submissions ($5M+)
              </h2>
              {highPriority.map((comp) => (
                <QueueItem key={comp.id} comp={comp} onVerify={handleVerify} onReject={handleReject} />
              ))}
            </div>
          )}

          {standard.length > 0 && (
            <div className="space-y-3">
              {highPriority.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground">Standard Submissions</h2>
              )}
              {standard.map((comp) => (
                <QueueItem key={comp.id} comp={comp} onVerify={handleVerify} onReject={handleReject} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!actionComp} onOpenChange={(open) => !open && setActionComp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "verify" ? "Verify Comp Submission" : "Reject Comp Submission"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {actionComp && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{actionComp.marina}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {[actionComp.city, actionComp.state].filter(Boolean).join(", ")}
                  {actionComp.salePrice && ` · $${Number(actionComp.salePrice).toLocaleString()}`}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {actionType === "verify" ? "Verification notes (optional)" : "Rejection reason"}
              </Label>
              <Textarea
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
                placeholder={
                  actionType === "verify"
                    ? "Note any documents reviewed or special considerations..."
                    : "Explain why this submission is being rejected..."
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionComp(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={verifyMutation.isPending || (actionType === "reject" && !moderationNotes.trim())}
              className={actionType === "verify" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
            >
              {verifyMutation.isPending
                ? "Saving..."
                : actionType === "verify"
                ? "Confirm Verify"
                : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
