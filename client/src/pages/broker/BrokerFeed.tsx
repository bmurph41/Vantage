import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBrokerFeed,
  useMyBrokerEntitlement,
  useMyBrokerSubscriptions,
  type MarinaListing,
  type BrokerAdvisoryContent,
} from "@/hooks/use-broker-subscriptions";

type FeedItem =
  | { kind: "listing"; publishedAt: string; data: MarinaListing }
  | { kind: "content"; publishedAt: string; data: BrokerAdvisoryContent };

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "just now";
    return `${hours}h ago`;
  }
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function FeedListingItem({ item }: { item: MarinaListing }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">New Listing</Badge>
          {item.assetClass && (
            <span className="text-xs text-slate-500">{item.assetClass}</span>
          )}
        </div>
        <div className="font-semibold text-slate-900">{item.title}</div>
        <div className="text-sm text-slate-500">
          {[item.city, item.state].filter(Boolean).join(", ") || "—"}
        </div>
        <div className="flex items-center gap-4 text-sm pt-2 border-t">
          <span className="text-slate-900 font-semibold">{formatMoney(item.askingPrice)}</span>
          {item.capRate != null && (
            <span className="text-slate-600">{(item.capRate * 100).toFixed(2)}% cap</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedContentItem({ item }: { item: BrokerAdvisoryContent }) {
  return (
    <Card className="relative">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Insight</Badge>
        </div>
        <div className="font-semibold text-slate-900">{item.title}</div>
        <div className="text-sm text-slate-600 line-clamp-3">{item.excerpt || "—"}</div>
        {item.isLocked && (
          <div className="text-xs font-medium text-teal-700 bg-teal-50 rounded px-2 py-1 inline-block mt-1">
            Locked — subscribe to advisory to unlock
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BrokerFeed() {
  const { listings, content, isLoading, isError } = useBrokerFeed();
  const entitlement = useMyBrokerEntitlement();
  const mySubs = useMyBrokerSubscriptions();

  const merged: FeedItem[] = [];
  (listings.data?.items || []).forEach((l) => {
    merged.push({
      kind: "listing",
      publishedAt: l.publishedAt || new Date().toISOString(),
      data: l,
    });
  });
  (content.data?.items || []).forEach((c) => {
    merged.push({
      kind: "content",
      publishedAt: c.publishedAt || new Date().toISOString(),
      data: c,
    });
  });
  merged.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));

  const followCount = (mySubs.data?.subscriptions || []).filter(
    (s) => s.tier === "follow" && s.status === "active",
  ).length;
  const ent = entitlement.data;
  const followLimit = ent?.brokerFollowLimit ?? 2;
  const fmtLimit = (n: number) => (n === -1 ? "Unlimited" : n);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New from Your Brokers</h1>
        <p className="text-slate-500 mt-1">
          Listings and insights from brokers you follow and subscribe to.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : isError ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                Failed to load your feed.
              </CardContent>
            </Card>
          ) : merged.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center space-y-3">
                <div className="text-lg font-medium text-slate-900">
                  You're not following any brokers yet
                </div>
                <Button asChild>
                  <Link href="/brokers">Browse the Directory</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            merged.map((item) => (
              <div key={`${item.kind}-${item.data.id}`} className="space-y-1">
                <div className="text-xs text-slate-500">{timeAgo(item.publishedAt)}</div>
                {item.kind === "listing" ? (
                  <FeedListingItem item={item.data} />
                ) : (
                  <FeedContentItem item={item.data} />
                )}
              </div>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="text-sm font-semibold text-slate-900">
                {ent?.label || "Free tier"}
              </div>
              <div className="text-sm text-slate-600">
                Following {followCount}/{fmtLimit(followLimit)}
              </div>
              {ent?.tier === "free" && (
                <Button asChild size="sm" className="w-full mt-2">
                  <a href="/settings/billing">Upgrade</a>
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="text-sm font-semibold text-slate-900">Quick Links</div>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/brokers">
                  <span className="text-teal-700 hover:underline cursor-pointer">
                    Broker Directory
                  </span>
                </Link>
                <Link href="/settings/broker-subscriptions">
                  <span className="text-teal-700 hover:underline cursor-pointer">
                    Manage Subscriptions
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
