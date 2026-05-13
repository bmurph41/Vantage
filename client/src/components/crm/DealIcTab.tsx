/**
 * Investment Committee tab content for the deal record page.
 *
 * Surfaces the 14 endpoints in `server/routes/ic-routes.ts` under a single
 * deal-scoped tab. IC memos are keyed on `modelingProjectId`, not on the deal
 * directly — so we resolve the deal's first linked modeling project and route
 * memo CRUD through it.
 *
 * Scope (MVP — frontend wiring of existing endpoints only):
 *   - List memos for the deal's modeling project
 *   - Select a memo to view detail (votes + comments inline)
 *   - Create a new memo (title + executive summary minimum)
 *   - Submit a draft memo for review
 *   - Cast a vote on a memo that is pending_review or under_review
 *   - Add a comment to any memo
 *
 * Deferred:
 *   - Committee member management UI (members endpoint exists; today we surface
 *     only the votes/comments path)
 *   - Conditional-approval `conditions[]` capture (one-line vote-comment only)
 *   - Memo PDF generation (Document Studio path is separate)
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Gavel,
  PlusCircle,
  Send,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

interface Memo {
  id: string;
  title: string;
  memoNumber?: string | null;
  status: 'draft' | 'pending_review' | 'under_review' | 'approved' | 'rejected' | 'revision_requested';
  executiveSummary?: string | null;
  investmentThesis?: string | null;
  recommendation?: string | null;
  approvalsRequired?: number | null;
  quorumRequired?: number | null;
  submittedAt?: string | null;
  reviewDeadline?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Vote {
  id: string;
  vote: 'approve' | 'conditional_approve' | 'reject' | 'abstain';
  comments?: string | null;
  votedAt: string;
  userId: string;
}

interface Comment {
  id: string;
  body?: string;
  content?: string;
  createdAt: string;
  userId: string;
  resolved?: boolean;
}

interface MemoDetail extends Memo {
  votes: Vote[];
  comments: Comment[];
}

const STATUS_BADGE: Record<Memo['status'], { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-700' },
  pending_review: { label: 'Pending Review', cls: 'bg-amber-100 text-amber-800' },
  under_review: { label: 'Under Review', cls: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-800' },
  revision_requested: { label: 'Revision Requested', cls: 'bg-purple-100 text-purple-800' },
};

function resolveModelingProjectId(allProjects: any[], dealId: string): string | null {
  // Match DealModelsTab's filter: any modeling_project linked back to this deal.
  const matched = allProjects.find((p) => p.dealId === dealId);
  return matched?.id ?? null;
}

export function DealIcTab({ dealId }: { dealId: string }) {
  const { toast } = useToast();
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Resolve the deal's first linked modeling project (IC memos hang off projects).
  const { data: allProjects = [], isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ['modeling-projects-deal', dealId],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/modeling/projects');
      const all = await res.json();
      return Array.isArray(all) ? all : [];
    },
  });

  const modelingProjectId = useMemo(
    () => resolveModelingProjectId(allProjects, dealId),
    [allProjects, dealId],
  );

  const memosQuery = useQuery<Memo[]>({
    queryKey: ['ic-memos', modelingProjectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/ic/memos?projectId=${modelingProjectId}`);
      return res.json();
    },
    enabled: !!modelingProjectId,
  });

  const memoDetailQuery = useQuery<MemoDetail>({
    queryKey: ['ic-memo', selectedMemoId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/ic/memos/${selectedMemoId}`);
      return res.json();
    },
    enabled: !!selectedMemoId,
  });

  const createMemo = useMutation({
    mutationFn: async (data: { title: string; executiveSummary?: string }) => {
      const res = await apiRequest('POST', '/api/ic/memos', {
        ...data,
        modelingProjectId,
      });
      return res.json();
    },
    onSuccess: (memo: Memo) => {
      queryClient.invalidateQueries({ queryKey: ['ic-memos', modelingProjectId] });
      setSelectedMemoId(memo.id);
      setShowCreate(false);
      toast({ title: 'Memo created', description: `Draft saved as ${memo.memoNumber ?? memo.id.slice(0, 8)}.` });
    },
    onError: (e: any) => {
      toast({ title: 'Create failed', description: e.message || 'Could not create memo.', variant: 'destructive' });
    },
  });

  const submitMemo = useMutation({
    mutationFn: async (memoId: string) => {
      const res = await apiRequest('POST', `/api/ic/memos/${memoId}/submit`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ic-memos', modelingProjectId] });
      queryClient.invalidateQueries({ queryKey: ['ic-memo', selectedMemoId] });
      toast({ title: 'Submitted for review', description: 'Reviewers can now cast votes.' });
    },
    onError: (e: any) => {
      toast({ title: 'Submit failed', description: e.message || 'Could not submit memo.', variant: 'destructive' });
    },
  });

  const castVote = useMutation({
    mutationFn: async (args: { memoId: string; vote: Vote['vote']; comments?: string }) => {
      const res = await apiRequest('POST', `/api/ic/memos/${args.memoId}/votes`, {
        vote: args.vote,
        comments: args.comments,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ic-memos', modelingProjectId] });
      queryClient.invalidateQueries({ queryKey: ['ic-memo', selectedMemoId] });
      toast({ title: 'Vote recorded' });
    },
    onError: (e: any) => {
      toast({ title: 'Vote failed', description: e.message || 'Could not cast vote.', variant: 'destructive' });
    },
  });

  const addComment = useMutation({
    mutationFn: async (args: { memoId: string; body: string }) => {
      const res = await apiRequest('POST', `/api/ic/memos/${args.memoId}/comments`, {
        body: args.body,
        content: args.body, // legacy field, in case the route expects either
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ic-memo', selectedMemoId] });
      toast({ title: 'Comment added' });
    },
    onError: (e: any) => {
      toast({ title: 'Comment failed', description: e.message || 'Could not add comment.', variant: 'destructive' });
    },
  });

  if (projectsLoading) {
    return (
      <div className="space-y-3" data-testid="ic-tab-loading">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!modelingProjectId) {
    return (
      <Card className="border-dashed" data-testid="ic-tab-empty-no-project">
        <CardContent className="flex flex-col items-center justify-center text-center py-12 px-6 space-y-4">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
            <Gavel className="h-7 w-7 text-indigo-600" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-semibold">No financial model yet</h3>
            <p className="text-sm text-muted-foreground">
              Investment committee memos are linked to a financial model. Convert this
              deal to a DD project (or create one) before authoring an IC memo.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedMemoId && memoDetailQuery.data) {
    return (
      <MemoDetailView
        memo={memoDetailQuery.data}
        onBack={() => setSelectedMemoId(null)}
        onSubmit={() => submitMemo.mutate(selectedMemoId)}
        onVote={(vote, comments) => castVote.mutate({ memoId: selectedMemoId, vote, comments })}
        onComment={(body) => addComment.mutate({ memoId: selectedMemoId, body })}
        isSubmitting={submitMemo.isPending}
        isVoting={castVote.isPending}
        isCommenting={addComment.isPending}
      />
    );
  }

  const memos = memosQuery.data ?? [];

  return (
    <div className="space-y-4" data-testid="ic-tab-list">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Gavel className="h-4 w-4 text-indigo-600" />
            Investment Committee
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Memos, votes, and comments tied to this deal's financial model.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="ic-create-memo">
          <PlusCircle className="h-4 w-4 mr-2" />
          New Memo
        </Button>
      </div>

      {memosQuery.isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : memos.length === 0 ? (
        <Card className="border-dashed" data-testid="ic-tab-empty">
          <CardContent className="text-center py-10 px-6 space-y-3">
            <Gavel className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No IC memos yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create the first memo to start the IC review workflow.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {memos.map((m) => {
            const badge = STATUS_BADGE[m.status];
            return (
              <Card
                key={m.id}
                className="hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => setSelectedMemoId(m.id)}
                data-testid={`ic-memo-row-${m.id}`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{m.title}</span>
                        {m.memoNumber && (
                          <Badge variant="outline" className="text-[10px]">{m.memoNumber}</Badge>
                        )}
                      </div>
                      {m.executiveSummary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.executiveSummary}</p>
                      )}
                    </div>
                    <Badge className={`${badge.cls} text-[10px] shrink-0`}>{badge.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>Created {new Date(m.createdAt).toLocaleDateString()}</span>
                    {m.submittedAt && <span>· Submitted {new Date(m.submittedAt).toLocaleDateString()}</span>}
                    {m.reviewDeadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due {new Date(m.reviewDeadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateMemoDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={(data) => createMemo.mutate(data)}
        isPending={createMemo.isPending}
      />
    </div>
  );
}

function CreateMemoDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; executiveSummary?: string }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    props.onSubmit({ title: title.trim(), executiveSummary: summary.trim() || undefined });
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => {
      props.onOpenChange(o);
      if (!o) { setTitle(''); setSummary(''); }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New IC Memo</DialogTitle>
          <DialogDescription>
            Draft a new investment committee memo. You can fill in the rest of the
            structured fields before submitting for review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ic-memo-title">Title</Label>
            <Input
              id="ic-memo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sunset Ridge Apartments — Acquisition Memo"
              data-testid="ic-memo-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ic-memo-summary">Executive summary <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="ic-memo-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Short narrative of the investment thesis."
              data-testid="ic-memo-summary"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || props.isPending} data-testid="ic-memo-create-submit">
            {props.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemoDetailView(props: {
  memo: MemoDetail;
  onBack: () => void;
  onSubmit: () => void;
  onVote: (vote: Vote['vote'], comments?: string) => void;
  onComment: (body: string) => void;
  isSubmitting: boolean;
  isVoting: boolean;
  isCommenting: boolean;
}) {
  const { memo } = props;
  const [voteChoice, setVoteChoice] = useState<Vote['vote']>('approve');
  const [voteNote, setVoteNote] = useState('');
  const [commentBody, setCommentBody] = useState('');

  const badge = STATUS_BADGE[memo.status];
  const canSubmit = memo.status === 'draft' || memo.status === 'revision_requested';
  const canVote = memo.status === 'pending_review' || memo.status === 'under_review';

  const approvals = memo.votes.filter((v) => v.vote === 'approve' || v.vote === 'conditional_approve').length;
  const rejections = memo.votes.filter((v) => v.vote === 'reject').length;

  return (
    <div className="space-y-4" data-testid="ic-memo-detail">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={props.onBack} data-testid="ic-memo-back">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to memos
        </Button>
        <Badge className={`${badge.cls}`}>{badge.label}</Badge>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{memo.title}</h3>
              {memo.memoNumber && (
                <p className="text-xs text-muted-foreground mt-0.5">{memo.memoNumber}</p>
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Quorum: {memo.quorumRequired ?? 3}</div>
              <div>Required: {memo.approvalsRequired ?? 2}</div>
            </div>
          </div>

          {memo.executiveSummary && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Executive Summary
              </h4>
              <p className="text-sm whitespace-pre-wrap">{memo.executiveSummary}</p>
            </div>
          )}

          {memo.investmentThesis && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Investment Thesis
              </h4>
              <p className="text-sm whitespace-pre-wrap">{memo.investmentThesis}</p>
            </div>
          )}

          {memo.recommendation && (
            <div>
              <Badge variant="outline" className="text-xs">
                Recommendation: {memo.recommendation}
              </Badge>
            </div>
          )}

          {canSubmit && (
            <div className="pt-2">
              <Button size="sm" onClick={props.onSubmit} disabled={props.isSubmitting} data-testid="ic-memo-submit">
                {props.isSubmitting ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Send className="h-3 w-3 mr-2" />}
                Submit for review
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Votes</h4>
            <div className="text-xs text-muted-foreground">
              {approvals} approve · {rejections} reject · {memo.votes.length} total
            </div>
          </div>

          {memo.votes.length > 0 ? (
            <div className="space-y-2">
              {memo.votes.map((v) => (
                <div key={v.id} className="flex items-start justify-between gap-3 border-b last:border-0 pb-2 last:pb-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <VoteIcon vote={v.vote} />
                      <span className="text-sm font-medium">{voteLabel(v.vote)}</span>
                    </div>
                    {v.comments && (
                      <p className="text-xs text-muted-foreground mt-1 ml-6">{v.comments}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(v.votedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No votes recorded.</p>
          )}

          {canVote && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Cast your vote</Label>
                <div className="flex flex-wrap items-end gap-2">
                  <Select value={voteChoice} onValueChange={(v) => setVoteChoice(v as Vote['vote'])}>
                    <SelectTrigger className="w-44 h-9" data-testid="ic-vote-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approve">Approve</SelectItem>
                      <SelectItem value="conditional_approve">Conditional approve</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                      <SelectItem value="abstain">Abstain</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={voteNote}
                    onChange={(e) => setVoteNote(e.target.value)}
                    placeholder="Optional note"
                    className="flex-1 min-w-[200px] h-9"
                    data-testid="ic-vote-note"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      props.onVote(voteChoice, voteNote.trim() || undefined);
                      setVoteNote('');
                    }}
                    disabled={props.isVoting}
                    data-testid="ic-vote-submit"
                  >
                    {props.isVoting && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    Record vote
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Discussion ({memo.comments.length})
          </h4>

          {memo.comments.length > 0 ? (
            <div className="space-y-3">
              {memo.comments.map((c) => (
                <div key={c.id} className="border-l-2 border-muted pl-3 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                    {c.resolved && <Badge variant="outline" className="text-[10px]">Resolved</Badge>}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{c.body || c.content || ''}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          )}

          <Separator />
          <div className="space-y-2">
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              data-testid="ic-comment-body"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  if (!commentBody.trim()) return;
                  props.onComment(commentBody.trim());
                  setCommentBody('');
                }}
                disabled={!commentBody.trim() || props.isCommenting}
                data-testid="ic-comment-submit"
              >
                {props.isCommenting && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                Add comment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VoteIcon({ vote }: { vote: Vote['vote'] }) {
  switch (vote) {
    case 'approve':
      return <ThumbsUp className="h-4 w-4 text-emerald-600" />;
    case 'conditional_approve':
      return <CheckCircle2 className="h-4 w-4 text-amber-600" />;
    case 'reject':
      return <ThumbsDown className="h-4 w-4 text-rose-600" />;
    case 'abstain':
      return <XCircle className="h-4 w-4 text-slate-400" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
}

function voteLabel(vote: Vote['vote']): string {
  switch (vote) {
    case 'approve': return 'Approve';
    case 'conditional_approve': return 'Conditional approve';
    case 'reject': return 'Reject';
    case 'abstain': return 'Abstain';
    default: return vote;
  }
}
