import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import {
  useMyBrokerSubscriptions,
  useMyBrokerEntitlement,
  useUnfollowBroker,
  useUpdateSubscriptionNotifications,
  type BrokerSubscription,
} from "@/hooks/use-broker-subscriptions";

function initialsFrom(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "pending_payment") return "secondary";
  if (status === "canceled") return "destructive";
  return "outline";
}

function SubscriptionRow({
  sub,
  onToggleNotif,
  onCancel,
  allowMessaging,
  cancelLabel,
}: {
  sub: BrokerSubscription;
  onToggleNotif: (
    id: string,
    field: "notifyNewListings" | "notifyAdvisoryContent" | "notifyMarketUpdates",
    value: boolean,
  ) => void;
  onCancel: (sub: BrokerSubscription) => void;
  allowMessaging: boolean;
  cancelLabel: string;
}) {
  const name = sub.brokerProfile?.displayName || "Unknown";
  return (
    <Card>
      <CardContent className="p-4 flex flex-col md:flex-row gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-12 w-12">
            {sub.brokerProfile?.headshotUrl ? (
              <AvatarImage src={sub.brokerProfile.headshotUrl} />
            ) : null}
            <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link href={`/brokers/${sub.profileId}`}>
                <span className="font-semibold text-slate-900 hover:underline cursor-pointer">
                  {name}
                </span>
              </Link>
              <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
            </div>
            <div className="text-sm text-slate-500 truncate">
              {sub.brokerProfile?.companyName || ""}
            </div>
            <div className="text-xs text-slate-400">
              Subscribed {new Date(sub.subscribedAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm min-w-[220px]">
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-600">New listings</span>
            <Switch
              checked={sub.notifyNewListings ?? true}
              onCheckedChange={(v) => onToggleNotif(sub.id, "notifyNewListings", v)}
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-600">Advisory content</span>
            <Switch
              checked={sub.notifyAdvisoryContent ?? true}
              onCheckedChange={(v) => onToggleNotif(sub.id, "notifyAdvisoryContent", v)}
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-600">Market updates</span>
            <Switch
              checked={sub.notifyMarketUpdates ?? true}
              onCheckedChange={(v) => onToggleNotif(sub.id, "notifyMarketUpdates", v)}
            />
          </label>
        </div>

        <div className="flex md:flex-col gap-2 md:min-w-[120px]">
          {allowMessaging && sub.tier === "advisory" && (
            <Button variant="outline" size="sm">
              Message
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onCancel(sub)}>
            {cancelLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyBrokerSubscriptions() {
  const { data, isLoading, isError } = useMyBrokerSubscriptions();
  const entitlement = useMyBrokerEntitlement();
  const unfollow = useUnfollowBroker();
  const updateNotif = useUpdateSubscriptionNotifications();
  const { toast } = useToast();

  const [unfollowTarget, setUnfollowTarget] = useState<BrokerSubscription | null>(null);

  const handleToggleNotif = (
    id: string,
    field: "notifyNewListings" | "notifyAdvisoryContent" | "notifyMarketUpdates",
    value: boolean,
  ) => {
    updateNotif.mutate(
      { id, [field]: value },
      {
        onError: (err) =>
          toast({
            title: "Update failed",
            description: (err as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const handleConfirmUnfollow = () => {
    if (!unfollowTarget) return;
    unfollow.mutate(unfollowTarget.profileId, {
      onSuccess: () => {
        toast({ title: "Unfollowed" });
        setUnfollowTarget(null);
      },
      onError: (err) => {
        toast({
          title: "Unfollow failed",
          description: (err as Error).message,
          variant: "destructive",
        });
        setUnfollowTarget(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            Failed to load your subscriptions.
          </CardContent>
        </Card>
      </div>
    );
  }

  const subs = data.subscriptions || [];
  const advisorySubs = subs.filter((s) => s.tier === "advisory");
  const follows = subs.filter((s) => s.tier === "follow" && s.status === "active");
  const ent = entitlement.data;
  const followLimit = ent?.brokerFollowLimit ?? 2;
  const advisoryLimit = ent?.brokerAdvisoryLimit ?? 0;

  const fmtLimit = (n: number) => (n === -1 ? "Unlimited" : n);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Broker Subscriptions</h1>
        <p className="text-slate-500 mt-1">Manage brokers you follow and advisory subscriptions.</p>
      </div>

      <Card>
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {ent?.label || "Free tier"}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Following {follows.length}/{fmtLimit(followLimit)} · Advisory{" "}
              {advisorySubs.length}/{fmtLimit(advisoryLimit)}
            </div>
          </div>
          {ent?.tier === "free" && (
            <Button asChild>
              <a href="/settings/billing">Upgrade to Marketplace+</a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Advisory */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Advisory Subscriptions</h2>
        {advisorySubs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              You have no advisory subscriptions.{" "}
              <Link href="/brokers">
                <span className="text-teal-700 hover:underline cursor-pointer">
                  Browse the directory
                </span>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {advisorySubs.map((s) => (
              <SubscriptionRow
                key={s.id}
                sub={s}
                onToggleNotif={handleToggleNotif}
                onCancel={(sub) => setUnfollowTarget(sub)}
                allowMessaging={!!ent?.allowBrokerMessaging}
                cancelLabel="Cancel"
              />
            ))}
          </div>
        )}
      </section>

      {/* Following */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Following</h2>
        {follows.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              You're not following any brokers yet.{" "}
              <Link href="/brokers">
                <span className="text-teal-700 hover:underline cursor-pointer">
                  Browse the directory
                </span>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {follows.map((s) => (
              <SubscriptionRow
                key={s.id}
                sub={s}
                onToggleNotif={handleToggleNotif}
                onCancel={(sub) => setUnfollowTarget(sub)}
                allowMessaging={false}
                cancelLabel="Unfollow"
              />
            ))}
          </div>
        )}
      </section>

      <AlertDialog
        open={!!unfollowTarget}
        onOpenChange={(open) => !open && setUnfollowTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow this broker?</AlertDialogTitle>
            <AlertDialogDescription>
              Unfollowing won't free up your follow slot — the cap counts brokers you've ever
              followed, not currently active follows. Upgrade Marketplace+ for more slots.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnfollow}>Unfollow</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
