import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  useBrokerRegistrations,
  useBrokerRegistrationDetail,
  useBrokerCredentialAudit,
  useApproveRegistration,
  useRejectRegistration,
  useSuspendRegistration,
  useReverifyRegistration,
  useRequestRereview,
  type BrokerRegistrationStatus,
} from "@/hooks/use-broker-admin";
import { Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, AlertCircle, Clock, ShieldQuestion, RefreshCw, History } from "lucide-react";

const TABS: { label: string; value: BrokerRegistrationStatus }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

const PAGE_SIZE = 25;

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

function formatRelative(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

interface LicenseCheckBadgeProps {
  status: string | null | undefined;
  compact?: boolean;
}

function LicenseCheckBadge({ status, compact = false }: LicenseCheckBadgeProps) {
  if (!status || status === "unverified") {
    return compact ? (
      <span className="text-gray-400 text-xs">—</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <ShieldQuestion className="h-3 w-3" />
        Unverified
      </span>
    );
  }

  const configs: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    verified: {
      label: "Verified",
      icon: CheckCircle2,
      className: "text-emerald-600 dark:text-emerald-400",
    },
    manual_review_required: {
      label: "Manual Review",
      icon: Clock,
      className: "text-yellow-600 dark:text-yellow-400",
    },
    not_found: {
      label: "Not Found",
      icon: AlertCircle,
      className: "text-red-500 dark:text-red-400",
    },
    expired: {
      label: "Expired",
      icon: AlertCircle,
      className: "text-orange-500 dark:text-orange-400",
    },
    revoked: {
      label: "Revoked",
      icon: AlertCircle,
      className: "text-red-600 dark:text-red-500",
    },
    error: {
      label: "Check Failed",
      icon: AlertCircle,
      className: "text-gray-500",
    },
  };

  const cfg = configs[status] ?? {
    label: status,
    icon: ShieldQuestion,
    className: "text-gray-500",
  };

  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.className}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </span>
  );
}

export default function BrokerRegistrationsQueue() {
  const { toast } = useToast();
  const [status, setStatus] = useState<BrokerRegistrationStatus>("pending");
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [tier, setTier] = useState<string>("starter");
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useBrokerRegistrations({ status, page, pageSize: PAGE_SIZE });
  const { data: detail, isLoading: loadingDetail } = useBrokerRegistrationDetail(reviewId);
  const { data: auditData } = useBrokerCredentialAudit(reviewId);

  const approveMut = useApproveRegistration();
  const rejectMut = useRejectRegistration();
  const suspendMut = useSuspendRegistration();
  const reverifyMut = useReverifyRegistration();
  const rereviewMut = useRequestRereview();

  const items = data?.items || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const closeReview = () => {
    setReviewId(null);
    setRejectReason("");
    setTier("starter");
  };

  const handleApprove = async () => {
    if (!reviewId) return;
    try {
      await approveMut.mutateAsync({ id: reviewId, brokerTier: tier });
      toast({
        title: "Broker approved",
        description: "Profile created. Broker can now subscribe to a plan.",
      });
      closeReview();
    } catch (e: any) {
      toast({ title: "Approve failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!reviewId) return;
    if (!rejectReason.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    try {
      await rejectMut.mutateAsync({ id: reviewId, reason: rejectReason.trim() });
      toast({ title: "Registration rejected" });
      closeReview();
    } catch (e: any) {
      toast({ title: "Reject failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handleSuspend = async () => {
    if (!reviewId) return;
    if (!rejectReason.trim()) {
      toast({ title: "Reason required for suspension", variant: "destructive" });
      return;
    }
    try {
      await suspendMut.mutateAsync({ id: reviewId, reason: rejectReason.trim() });
      toast({ title: "Broker suspended" });
      closeReview();
    } catch (e: any) {
      toast({ title: "Suspend failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handleReverify = async () => {
    if (!reviewId) return;
    try {
      const result = await reverifyMut.mutateAsync({ id: reviewId });
      const vs = result?.registration?.licenseVerificationStatus ?? result?.verificationResult?.status ?? "unknown";
      toast({
        title: "License re-checked",
        description: `Result: ${vs}`,
      });
    } catch (e: any) {
      toast({ title: "Re-verify failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handleRequestRereview = async () => {
    if (!reviewId) return;
    try {
      await rereviewMut.mutateAsync({ id: reviewId });
      toast({
        title: "Re-review requested",
        description: "Registration set to pending and profile unpublished until re-approved.",
      });
      closeReview();
    } catch (e: any) {
      toast({ title: "Re-review request failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const reg = detail?.registration;
  const specialties: string[] = Array.isArray(reg?.specialties) ? (reg!.specialties as any) : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Broker Registration Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve broker registration requests.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            variant={status === t.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatus(t.value);
              setPage(1);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {pagination ? `${pagination.total} registrations` : "Loading..."}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No registrations in this state.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>License State</TableHead>
                  <TableHead>License Check</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.companyName}</TableCell>
                    <TableCell>{r.legalName}</TableCell>
                    <TableCell>{r.licenseState || "—"}</TableCell>
                    <TableCell>
                      <LicenseCheckBadge status={r.licenseVerificationStatus} compact />
                    </TableCell>
                    <TableCell>{r.yearsExperience != null ? `${r.yearsExperience}y` : "—"}</TableCell>
                    <TableCell>{formatRelative(r.submittedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setReviewId(r.id)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pagination && pagination.total > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {totalPages}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(1)}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewId} onOpenChange={(open) => !open && closeReview()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Broker Registration</DialogTitle>
            <DialogDescription>
              {reg ? `${reg.companyName} — ${reg.legalName}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>

          {loadingDetail || !reg ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="text-sm font-semibold mb-2">Personal</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Legal Name</div>
                    <div>{reg.legalName}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Email</div>
                    <div>{reg.email}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Phone</div>
                    <div>{reg.phone || "—"}</div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">Company</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Company Name</div>
                    <div>{reg.companyName}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Website</div>
                    <div>{reg.website || "—"}</div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">License</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Number</div>
                    <div>{reg.licenseNumber || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">State</div>
                    <div>{reg.licenseState || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Expires</div>
                    <div>
                      {reg.licenseExpiresAt
                        ? new Date(reg.licenseExpiresAt).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Document</div>
                    <div>
                      {reg.licenseDocumentUrl ? (
                        <a
                          href={reg.licenseDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          View License
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 rounded-md border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Automated License Check</div>
                      <LicenseCheckBadge status={reg.licenseVerificationStatus} />
                      {reg.licenseVerificationProvider && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          via {reg.licenseVerificationProvider}
                          {reg.licenseLastVerifiedAt
                            ? ` · ${formatRelative(reg.licenseLastVerifiedAt)}`
                            : ""}
                        </div>
                      )}
                      {reg.licenseVerificationNotes && (
                        <div className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                          {reg.licenseVerificationNotes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">Experience</h3>
                <div className="text-sm">
                  <div className="text-muted-foreground">Years in Industry</div>
                  <div>{reg.yearsExperience != null ? `${reg.yearsExperience} years` : "—"}</div>
                </div>
                {specialties.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm text-muted-foreground mb-1">Specialties</div>
                    <div className="flex flex-wrap gap-1">
                      {specialties.map((s, i) => (
                        <Badge key={i} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {reg.bio && (
                  <div className="mt-2">
                    <div className="text-sm text-muted-foreground mb-1">Bio</div>
                    <div className="text-sm whitespace-pre-wrap border rounded p-2 bg-muted/30">
                      {reg.bio}
                    </div>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">Links</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Website</div>
                    <div>{reg.website || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">LinkedIn</div>
                    <div>{reg.linkedinUrl || "—"}</div>
                  </div>
                </div>
              </section>

              {reg.status === "rejected" && reg.rejectionReason && (
                <section>
                  <h3 className="text-sm font-semibold mb-1">Rejection Reason</h3>
                  <div className="text-sm border rounded p-2 bg-destructive/10">
                    {reg.rejectionReason}
                  </div>
                </section>
              )}

              {auditData && auditData.audit.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    Credential Change History
                  </h3>
                  <div className="border rounded overflow-hidden text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Field</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Old Value</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">New Value</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Changed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditData.audit.map((entry) => (
                          <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{entry.fieldName}</td>
                            <td className="px-3 py-1.5 max-w-[120px] truncate" title={entry.oldValue ?? "—"}>
                              {entry.oldValue ?? <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-1.5 max-w-[120px] truncate font-medium" title={entry.newValue ?? "—"}>
                              {entry.newValue ?? <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                              {formatRelative(entry.changedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {reg.status === "approved" &&
                reg.updatedAt &&
                reg.reviewedAt &&
                new Date(reg.updatedAt) > new Date(reg.reviewedAt) && (
                  <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 p-3 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-yellow-800 dark:text-yellow-300">Credentials updated since last review.</span>
                      <span className="text-yellow-700 dark:text-yellow-400 ml-1">
                        Use "Request Re-review" to revert to pending and pause the profile until re-approved.
                      </span>
                    </div>
                  </div>
                )}

              {reg.status === "pending" && (
                <>
                  <section>
                    <h3 className="text-sm font-semibold mb-2">Approval</h3>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">Broker Tier:</div>
                      <Select value={tier} onValueChange={setTier}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold mb-2">Reject / Suspend Reason</h3>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Required for reject or suspend..."
                      rows={3}
                    />
                  </section>
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReverify}
              disabled={reverifyMut.isPending || !reg?.licenseNumber}
              className="mr-auto"
            >
              {reverifyMut.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ShieldQuestion className="h-3 w-3 mr-1" />
              )}
              Re-verify License
            </Button>
            <Button variant="outline" onClick={closeReview}>
              Cancel
            </Button>
            {reg?.status === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejectMut.isPending}
                >
                  Reject
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSuspend}
                  disabled={suspendMut.isPending}
                >
                  Suspend
                </Button>
                <Button onClick={handleApprove} disabled={approveMut.isPending}>
                  {approveMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Approve"
                  )}
                </Button>
              </>
            )}
            {reg?.status === "approved" && (
              <>
                {reg.updatedAt && reg.reviewedAt && new Date(reg.updatedAt) > new Date(reg.reviewedAt) && (
                  <Button
                    variant="outline"
                    onClick={handleRequestRereview}
                    disabled={rereviewMut.isPending}
                    className="text-yellow-700 border-yellow-400 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-600 dark:hover:bg-yellow-950/30"
                  >
                    {rereviewMut.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Request Re-review
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleSuspend}
                  disabled={suspendMut.isPending || !rejectReason.trim()}
                >
                  Suspend
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
