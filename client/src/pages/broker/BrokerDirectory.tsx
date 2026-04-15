import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useBrokerDirectory,
  useFollowBroker,
  useUnfollowBroker,
  useMyBrokerEntitlement,
  useMyBrokerSubscriptions,
  parseApiError,
  type BrokerProfile,
  type DirectoryFilters,
} from "@/hooks/use-broker-subscriptions";
import { UpgradePrompt } from "@/components/broker/UpgradePrompt";

const SPECIALTIES = [
  "Marina",
  "Hotel",
  "Multifamily",
  "Retail",
  "Industrial",
  "Office",
  "Self-Storage",
  "Operating Business",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const TIERS = [
  { value: "all", label: "All tiers" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

function initialsFrom(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function specialtiesFrom(profile: BrokerProfile): string[] {
  const s = profile.specialties;
  if (!s) return [];
  if (Array.isArray(s)) return s.filter((x) => typeof x === "string");
  if (typeof s === "object") {
    if (Array.isArray(s.asset_classes)) return s.asset_classes;
    if (Array.isArray(s.assetClasses)) return s.assetClasses;
  }
  return [];
}

function BrokerCard({
  profile,
  isFollowing,
  onFollow,
  onUnfollow,
  isBusy,
}: {
  profile: BrokerProfile;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  isBusy: boolean;
}) {
  const specialties = specialtiesFrom(profile);
  return (
    <Card className="flex flex-col">
      <CardContent className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14">
            {profile.headshotUrl ? <AvatarImage src={profile.headshotUrl} /> : null}
            <AvatarFallback>{initialsFrom(profile.displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 truncate">{profile.displayName}</div>
            <div className="text-sm text-slate-500 truncate">{profile.companyName}</div>
          </div>
        </div>

        {specialties.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {specialties.slice(0, 4).map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 border-t pt-3">
          <div>
            <div className="font-semibold text-slate-900">{profile.followerCount ?? 0}</div>
            <div>Followers</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">{profile.totalListingsPublished ?? 0}</div>
            <div>Listings</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">{profile.yearsExperience ?? 0}y</div>
            <div>Experience</div>
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <Button
            variant={isFollowing ? "outline" : "default"}
            className="flex-1"
            onClick={isFollowing ? onUnfollow : onFollow}
            disabled={isBusy}
          >
            {isFollowing ? "Following" : "Follow"}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/brokers/${profile.id}`}>View Profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BrokerDirectory() {
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState<string>("all");
  const [state, setState] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const filters = useMemo<DirectoryFilters>(
    () => ({
      q: q || undefined,
      specialty: specialty !== "all" ? specialty : undefined,
      state: state !== "all" ? state : undefined,
      tier: tier !== "all" ? tier : undefined,
      page,
      pageSize,
    }),
    [q, specialty, state, tier, page],
  );

  const { data, isLoading, isError } = useBrokerDirectory(filters);
  const entitlement = useMyBrokerEntitlement();
  const mySubs = useMyBrokerSubscriptions();
  const follow = useFollowBroker();
  const unfollow = useUnfollowBroker();
  const { toast } = useToast();
  const [capError, setCapError] = useState<{
    reason: string;
    tier?: string;
    upgradeUrl?: string;
    currentLimit?: number;
  } | null>(null);

  const followingIds = new Set(
    (mySubs.data?.subscriptions || [])
      .filter((s) => s.tier === "follow" && s.status === "active")
      .map((s) => s.profileId),
  );
  const followCount = followingIds.size;
  const followLimit = entitlement.data?.brokerFollowLimit ?? 2;

  const handleFollow = (profileId: string) => {
    setCapError(null);
    follow.mutate(profileId, {
      onError: (err) => {
        const parsed = parseApiError(err);
        if (parsed.status === 403 && parsed.body?.error === "follow_cap_reached") {
          setCapError({
            reason: "You've hit your follow limit — upgrade to Marketplace+",
            tier: parsed.body.tier,
            upgradeUrl: parsed.body.upgradeUrl,
            currentLimit: parsed.body.limit,
          });
          toast({
            title: "Follow limit reached",
            description: "Upgrade to Marketplace+ to follow more brokers.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Follow failed",
            description: parsed.body?.error || parsed.message,
            variant: "destructive",
          });
        }
      },
      onSuccess: () => {
        toast({ title: "Following", description: "Added to your broker feed." });
      },
    });
  };

  const handleUnfollow = (profileId: string) => {
    unfollow.mutate(profileId, {
      onSuccess: () => toast({ title: "Unfollowed" }),
      onError: (err) => {
        const parsed = parseApiError(err);
        toast({
          title: "Unfollow failed",
          description: parsed.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Broker Directory</h1>
        <p className="text-slate-500 mt-1">
          Follow brokers to get their listings and insights in your feed
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold text-slate-900">
              {entitlement.data?.label || "Free tier"}:
            </span>{" "}
            <span className="text-slate-600">
              {followCount}/{followLimit === -1 ? "Unlimited" : followLimit} brokers followed
            </span>
          </div>
          {followLimit !== -1 && followCount >= followLimit && (
            <Button asChild variant="outline" size="sm">
              <a href="/settings/billing">Upgrade</a>
            </Button>
          )}
        </CardContent>
      </Card>

      {capError && (
        <UpgradePrompt
          reason={capError.reason}
          tier={capError.tier}
          upgradeUrl={capError.upgradeUrl}
          currentLimit={capError.currentLimit}
        />
      )}

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="Search brokers..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={specialty}
            onValueChange={(v) => {
              setSpecialty(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All specialties</SelectItem>
              {SPECIALTIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={state}
            onValueChange={(v) => {
              setState(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {US_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={tier}
            onValueChange={(v) => {
              setTier(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-center text-slate-500">
            Failed to load broker directory. Please try again.
          </CardContent>
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-lg font-medium text-slate-900">No brokers found</div>
            <div className="text-sm text-slate-500 mt-2">
              Try adjusting your filters or search.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((p) => (
              <BrokerCard
                key={p.id}
                profile={p}
                isFollowing={followingIds.has(p.id)}
                onFollow={() => handleFollow(p.id)}
                onUnfollow={() => handleUnfollow(p.id)}
                isBusy={follow.isPending || unfollow.isPending}
              />
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span className="text-sm text-slate-600 px-3">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(data.totalPages)}
                disabled={page >= data.totalPages}
              >
                Last
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
