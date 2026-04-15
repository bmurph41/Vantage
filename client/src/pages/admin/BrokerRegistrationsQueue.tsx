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
  useApproveRegistration,
  useRejectRegistration,
  useSuspendRegistration,
  type BrokerRegistrationStatus,
} from "@/hooks/use-broker-admin";
import { Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

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

export default function BrokerRegistrationsQueue() {
  const { toast } = useToast();
  const [status, setStatus] = useState<BrokerRegistrationStatus>("pending");
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [tier, setTier] = useState<string>("starter");
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useBrokerRegistrations({ status, page, pageSize: PAGE_SIZE });
  const { data: detail, isLoading: loadingDetail } = useBrokerRegistrationDetail(reviewId);

  const approveMut = useApproveRegistration();
  const rejectMut = useRejectRegistration();
  const suspendMut = useSuspendRegistration();

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

          <DialogFooter className="gap-2">
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
              <Button
                variant="secondary"
                onClick={handleSuspend}
                disabled={suspendMut.isPending || !rejectReason.trim()}
              >
                Suspend
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
