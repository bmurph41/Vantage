import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import BrokerDashboardLayout from "./BrokerDashboardLayout";
import {
  useBrokerSubscribers,
  useGrantAdvisoryAccess,
  useRevokeSubscriber,
  type BrokerSubscriber,
} from "@/hooks/use-broker-dashboard";

export default function BrokerSubscribersList() {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBrokerSubscribers({
    status: status === "all" ? undefined : status,
    tier: tier === "all" ? undefined : tier,
    page,
  });
  const grantMut = useGrantAdvisoryAccess();
  const revokeMut = useRevokeSubscriber();

  const [grantTarget, setGrantTarget] = useState<BrokerSubscriber | null>(null);
  const [paymentRef, setPaymentRef] = useState("");

  const handleGrant = async () => {
    if (!grantTarget) return;
    try {
      await grantMut.mutateAsync({
        subscriptionId: grantTarget.id,
        paymentReference: paymentRef || undefined,
      });
      toast({ title: "Access granted" });
      setGrantTarget(null);
      setPaymentRef("");
    } catch (e: any) {
      toast({ title: "Grant failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handleRevoke = async (sub: BrokerSubscriber) => {
    if (!confirm(`Revoke access for this subscriber?`)) return;
    try {
      await revokeMut.mutateAsync(sub.id);
      toast({ title: "Subscriber revoked" });
    } catch (e: any) {
      toast({ title: "Revoke failed", description: e?.message || "", variant: "destructive" });
    }
  };

  return (
    <BrokerDashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Subscribers</h1>

        <div className="flex gap-2">
          <Select value={tier} onValueChange={(v) => { setTier(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="follow">Follow</SelectItem>
              <SelectItem value="advisory">Advisory</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending_payment">Pending Payment</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {data?.total != null ? `${data.total} subscribers` : "Loading..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !data?.items.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No subscribers found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.userId.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.tier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.status === "active"
                              ? "default"
                              : s.status === "pending_payment"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(s.subscribedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {s.status === "pending_payment" && s.tier === "advisory" && (
                          <Button size="sm" onClick={() => setGrantTarget(s)}>
                            Grant Access
                          </Button>
                        )}
                        {s.status === "active" && s.tier === "advisory" && (
                          <Button size="sm" variant="outline" onClick={() => handleRevoke(s)}>
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {data && data.totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 text-sm">
                <div>Page {data.page} of {data.totalPages}</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!grantTarget} onOpenChange={(o) => !o && setGrantTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Advisory Access</DialogTitle>
            <DialogDescription>
              Confirm you've received payment from this subscriber outside the platform.
              Optionally record a reference for your records.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Payment Reference (optional)</Label>
            <Input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. Stripe invoice ID, check number..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleGrant} disabled={grantMut.isPending}>
              {grantMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BrokerDashboardLayout>
  );
}
