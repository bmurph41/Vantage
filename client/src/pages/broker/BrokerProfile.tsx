import { useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  useBrokerProfile,
  useFollowBroker,
  useUnfollowBroker,
  useRequestAdvisory,
  useMyBrokerEntitlement,
  parseApiError,
  type BrokerAdvisoryPackage,
  type BrokerAdvisoryContent,
  type MarinaListing,
} from "@/hooks/use-broker-subscriptions";
import { UpgradePrompt } from "@/components/broker/UpgradePrompt";

function initialsFrom(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function specialtiesFrom(s: any): string[] {
  if (!s) return [];
  if (Array.isArray(s)) return s.filter((x) => typeof x === "string");
  if (typeof s === "object") {
    if (Array.isArray(s.asset_classes)) return s.asset_classes;
    if (Array.isArray(s.assetClasses)) return s.assetClasses;
  }
  return [];
}

function deliverablesFrom(d: any): string[] {
  if (!d) return [];
  if (Array.isArray(d)) return d.map(String);
  if (typeof d === "object" && Array.isArray(d.items)) return d.items.map(String);
  return [];
}

function ListingCard({ listing }: { listing: MarinaListing }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="font-semibold text-slate-900 line-clamp-2">{listing.title}</div>
        <div className="text-sm text-slate-500">
          {[listing.city, listing.state].filter(Boolean).join(", ") || "—"}
        </div>
        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <span className="text-slate-500">Asking</span>
          <span className="font-semibold">{formatMoney(listing.askingPrice)}</span>
        </div>
        {listing.capRate != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Cap Rate</span>
            <span className="font-semibold">{(listing.capRate * 100).toFixed(2)}%</span>
          </div>
        )}
        {listing.annualRevenue != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Annual Revenue</span>
            <span className="font-semibold">{formatMoney(listing.annualRevenue)}</span>
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full mt-2" asChild>
          <a href={`/marketplace/listings/${listing.id}`}>View</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function ContentCard({ item }: { item: BrokerAdvisoryContent }) {
  return (
    <Card className="relative">
      <CardContent className="p-4 space-y-2">
        <div className="font-semibold text-slate-900">{item.title}</div>
        <div className="text-sm text-slate-500 line-clamp-3">{item.excerpt || "—"}</div>
        {item.publishedAt && (
          <div className="text-xs text-slate-400">
            {new Date(item.publishedAt).toLocaleDateString()}
          </div>
        )}
        {item.isLocked && (
          <div className="mt-2 text-xs font-medium text-teal-700 bg-teal-50 rounded px-2 py-1 inline-block">
            Locked — subscribe to advisory to unlock
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdvisoryPackageCard({
  pkg,
  onSubscribe,
}: {
  pkg: BrokerAdvisoryPackage;
  onSubscribe: () => void;
}) {
  const deliverables = deliverablesFrom(pkg.deliverables);
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">{pkg.name}</div>
          {pkg.tagline && <div className="text-sm text-slate-500">{pkg.tagline}</div>}
        </div>
        {pkg.description && <p className="text-sm text-slate-700">{pkg.description}</p>}
        <div className="flex items-baseline gap-2 pt-2 border-t">
          <span className="text-2xl font-semibold">${pkg.monthlyPrice ?? 0}</span>
          <span className="text-sm text-slate-500">/month</span>
          {pkg.annualPrice && (
            <span className="text-xs text-teal-700 ml-auto">
              or ${pkg.annualPrice}/yr (save{" "}
              {pkg.monthlyPrice
                ? Math.round(
                    ((pkg.monthlyPrice * 12 - pkg.annualPrice) / (pkg.monthlyPrice * 12)) * 100,
                  )
                : 0}
              %)
            </span>
          )}
        </div>
        {deliverables.length > 0 && (
          <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
            {deliverables.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
        <Button className="w-full" onClick={onSubscribe}>
          Subscribe
        </Button>
      </CardContent>
    </Card>
  );
}

export default function BrokerProfile() {
  const [, params] = useRoute<{ profileId: string }>("/brokers/:profileId");
  const profileId = params?.profileId;
  const { data, isLoading, isError } = useBrokerProfile(profileId);
  const entitlement = useMyBrokerEntitlement();
  const follow = useFollowBroker();
  const unfollow = useUnfollowBroker();
  const requestAdvisory = useRequestAdvisory();
  const { toast } = useToast();

  const [advisoryOpen, setAdvisoryOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<BrokerAdvisoryPackage | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [acknowledged, setAcknowledged] = useState(false);
  const [capError, setCapError] = useState<{
    reason: string;
    tier?: string;
    upgradeUrl?: string;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            Failed to load broker profile.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, packages, listings, content, viewerContext } = data;
  const specialties = specialtiesFrom(profile.specialties);
  const canMessage =
    entitlement.data?.allowBrokerMessaging && viewerContext.isAdvisorySubscriber;

  const handleFollow = () => {
    setCapError(null);
    follow.mutate(profile.id, {
      onError: (err) => {
        const parsed = parseApiError(err);
        if (parsed.status === 403 && parsed.body?.error === "follow_cap_reached") {
          setCapError({
            reason: "You've hit your follow limit — upgrade to Marketplace+",
            tier: parsed.body.tier,
            upgradeUrl: parsed.body.upgradeUrl,
          });
        }
        toast({
          title: "Follow failed",
          description: parsed.body?.error || parsed.message,
          variant: "destructive",
        });
      },
      onSuccess: () => toast({ title: "Following", description: "Added to your broker feed." }),
    });
  };

  const handleUnfollow = () => {
    unfollow.mutate(profile.id, {
      onSuccess: () => toast({ title: "Unfollowed" }),
    });
  };

  const openAdvisoryDialog = (pkg: BrokerAdvisoryPackage) => {
    setSelectedPackage(pkg);
    setBillingCycle("monthly");
    setAcknowledged(false);
    setAdvisoryOpen(true);
  };

  const handleAdvisorySubmit = () => {
    if (!selectedPackage) return;
    requestAdvisory.mutate(
      { profileId: profile.id, packageId: selectedPackage.id },
      {
        onSuccess: (res: any) => {
          setAdvisoryOpen(false);
          if (res?.externalPaymentUrl) {
            window.open(res.externalPaymentUrl, "_blank");
          }
          toast({
            title: "Request sent",
            description:
              "Complete payment on the broker's page — they'll grant you access after.",
          });
        },
        onError: (err) => {
          const parsed = parseApiError(err);
          setAdvisoryOpen(false);
          if (
            parsed.status === 403 &&
            (parsed.body?.error === "tier_required" || parsed.body?.error === "cap_reached")
          ) {
            toast({
              title: "Upgrade required",
              description: `Marketplace+ is required to subscribe to advisory. ${parsed.body?.upgradeUrl || ""}`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Request failed",
              description: parsed.message,
              variant: "destructive",
            });
          }
        },
      },
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="overflow-hidden">
        <div
          className="h-40 w-full"
          style={{
            backgroundImage: profile.coverImageUrl
              ? `url(${profile.coverImageUrl})`
              : "linear-gradient(135deg, #0b3954, #087e8b)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16">
            <Avatar className="h-24 w-24 border-4 border-white shadow-md">
              {profile.headshotUrl ? <AvatarImage src={profile.headshotUrl} /> : null}
              <AvatarFallback className="text-xl">
                {initialsFrom(profile.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 pt-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">{profile.displayName}</h1>
                {profile.licenseNumber && (
                  <Badge variant="secondary" className="text-xs">
                    Verified
                  </Badge>
                )}
              </div>
              <div className="text-slate-500">{profile.companyName}</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewerContext.isFollowing ? "outline" : "default"}
                onClick={viewerContext.isFollowing ? handleUnfollow : handleFollow}
                disabled={follow.isPending || unfollow.isPending}
              >
                {viewerContext.isFollowing ? "Following" : "Follow"}
              </Button>
              {canMessage && (
                <Button variant="outline" asChild>
                  <a href="/settings/broker-subscriptions">Message</a>
                </Button>
              )}
              {packages.length > 0 && (
                <Button onClick={() => openAdvisoryDialog(packages[0])}>
                  Subscribe to Advisory
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t text-sm">
            <div>
              <div className="text-slate-500">Followers</div>
              <div className="font-semibold text-slate-900">{profile.followerCount ?? 0}</div>
            </div>
            <div>
              <div className="text-slate-500">Listings Published</div>
              <div className="font-semibold text-slate-900">
                {profile.totalListingsPublished ?? 0}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Years Experience</div>
              <div className="font-semibold text-slate-900">{profile.yearsExperience ?? 0}</div>
            </div>
            <div>
              <div className="text-slate-500">Avg Response</div>
              <div className="font-semibold text-slate-900">
                {profile.avgResponseHours != null ? `${profile.avgResponseHours}h` : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {capError && (
        <UpgradePrompt
          reason={capError.reason}
          tier={capError.tier}
          upgradeUrl={capError.upgradeUrl}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="advisory">Advisory Package</TabsTrigger>
          <TabsTrigger value="insights">Recent Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="pt-4">
          {listings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                No listings yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="about" className="pt-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              {profile.bio ? (
                <p className="text-slate-700 whitespace-pre-wrap">{profile.bio}</p>
              ) : (
                <p className="text-slate-500">No bio provided.</p>
              )}
              {specialties.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">Specialties</div>
                  <div className="flex flex-wrap gap-1">
                    {specialties.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.licenseNumber && (
                <div className="text-sm">
                  <span className="text-slate-500">License:</span>{" "}
                  <span className="font-medium">
                    {profile.licenseNumber}
                    {profile.licenseState ? ` (${profile.licenseState})` : ""}
                  </span>
                </div>
              )}
              <div className="flex gap-4 text-sm">
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 hover:underline"
                  >
                    Website
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 hover:underline"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advisory" className="pt-4">
          {packages.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                No advisory package available.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((p) => (
                <AdvisoryPackageCard key={p.id} pkg={p} onSubscribe={() => openAdvisoryDialog(p)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="pt-4">
          {content.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                No insights published yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.map((c) => (
                <ContentCard key={c.id} item={c} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Advisory Dialog */}
      <Dialog open={advisoryOpen} onOpenChange={setAdvisoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscribe to {selectedPackage?.name}</DialogTitle>
            <DialogDescription>
              {selectedPackage?.tagline || "Advisory subscription details"}
            </DialogDescription>
          </DialogHeader>

          {selectedPackage && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={billingCycle === "monthly" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setBillingCycle("monthly")}
                >
                  Monthly · ${selectedPackage.monthlyPrice}
                </Button>
                <Button
                  variant={billingCycle === "annual" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setBillingCycle("annual")}
                  disabled={!selectedPackage.annualPrice}
                >
                  Annual · ${selectedPackage.annualPrice ?? "—"}
                </Button>
              </div>

              <div>
                <div className="text-sm font-semibold mb-1">Deliverables</div>
                <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
                  {deliverablesFrom(selectedPackage.deliverables).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                />
                <span>
                  I understand the broker will contact me after payment to grant access.
                </span>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvisoryOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdvisorySubmit}
              disabled={!acknowledged || requestAdvisory.isPending}
            >
              Continue to Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
