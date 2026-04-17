import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import BrokerDashboardLayout from "./BrokerDashboardLayout";
import {
  useAnalyticsOverview,
  useMyBrokerProfile,
  usePublishMyProfile,
} from "@/hooks/use-broker-dashboard";

function formatCurrencyK(n: number): string {
  if (!n) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase">{label}</div>
        <div className="text-2xl font-semibold mt-1 font-mono">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function BrokerDashboardOverview() {
  const { toast } = useToast();
  const { data: profileData } = useMyBrokerProfile();
  const { data: overview, isLoading } = useAnalyticsOverview();
  const publishMut = usePublishMyProfile();

  const handlePublish = async () => {
    try {
      const res = await publishMut.mutateAsync();
      toast({
        title: "Profile published",
        description: `Auto-claimed ${res?.backfill?.claimed || 0} matching listings.`,
      });
    } catch (e: any) {
      toast({ title: "Publish failed", description: e?.message || "", variant: "destructive" });
    }
  };

  return (
    <BrokerDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Overview</h1>
            <p className="text-sm text-muted-foreground">
              Your broker profile at a glance.
            </p>
          </div>
          {profileData && !profileData.profile.isPublishable && (
            <Button onClick={handlePublish} disabled={publishMut.isPending}>
              {publishMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Publish Profile"
              )}
            </Button>
          )}
        </div>

        {profileData?.licenseStatus &&
          (profileData.licenseStatus.level === "critical" ||
            profileData.licenseStatus.level === "warning" ||
            profileData.licenseStatus.level === "expired") && (
            <Card
              className={
                profileData.licenseStatus.level === "expired" ||
                profileData.licenseStatus.level === "critical"
                  ? "border-rose-200 bg-rose-50"
                  : "border-amber-200 bg-amber-50"
              }
              data-testid="license-warning-banner"
            >
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle
                  className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                    profileData.licenseStatus.level === "expired" ||
                    profileData.licenseStatus.level === "critical"
                      ? "text-rose-600"
                      : "text-amber-600"
                  }`}
                />
                <div className="text-sm flex-1">
                  <div className="font-semibold text-slate-900">
                    {profileData.licenseStatus.level === "expired"
                      ? "License expired — profile auto-unpublished"
                      : profileData.licenseStatus.level === "critical"
                      ? `License expires in ${profileData.licenseStatus.daysUntilExpiry} days`
                      : `License expires in ${profileData.licenseStatus.daysUntilExpiry} days`}
                  </div>
                  <div className="text-slate-600">
                    {profileData.licenseStatus.state
                      ? `${profileData.licenseStatus.state} license · `
                      : ""}
                    Expires{" "}
                    {profileData.licenseStatus.expiresAt
                      ? new Date(profileData.licenseStatus.expiresAt).toLocaleDateString()
                      : "—"}
                    . Update your license to keep your profile published.
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/broker/dashboard/profile">Update License</a>
                </Button>
              </CardContent>
            </Card>
          )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : overview ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="Verified Closed" value={profileData?.stats.verifiedClosedDealsCount ?? 0} />
              <Kpi
                label="Closed Volume"
                value={formatCurrencyK(profileData?.stats.verifiedClosedDealsVolume ?? 0)}
              />
              <Kpi
                label="Response Time"
                value={formatHours(profileData?.stats.medianResponseHours ?? null)}
              />
              <Kpi
                label="Reply Rate (30d)"
                value={
                  profileData?.stats.responseRate30d != null &&
                  (profileData?.stats.responseSamples30d ?? 0) >= 3
                    ? `${Math.round(profileData.stats.responseRate30d)}%`
                    : "—"
                }
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="Followers" value={overview.totalFollowers} />
              <Kpi label="Advisory Subs" value={overview.totalAdvisorySubscribers} />
              <Kpi label="Listings Published" value={overview.listingsPublished} />
              <Kpi label="Pending Requests" value={overview.pendingAdvisoryRequests} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Subscriber Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.recentActivity.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No recent activity.</div>
                ) : (
                  <div className="space-y-2">
                    {overview.recentActivity.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2"
                      >
                        <div>
                          <div className="font-medium">{a.tier === "advisory" ? "Advisory" : "Follow"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(a.subscribedAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant={a.status === "active" ? "default" : "secondary"}>
                          {a.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {profileData?.recentVerifiedDeals && profileData.recentVerifiedDeals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Verified Closed Deals</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-2">Closed</th>
                        <th className="text-left px-4 py-2">Asset class</th>
                        <th className="text-left px-4 py-2">Location</th>
                        <th className="text-right px-4 py-2">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profileData.recentVerifiedDeals.map((d) => (
                        <tr key={d.id}>
                          <td className="px-4 py-2 text-slate-700">
                            {new Date(d.closedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-slate-700">{d.assetClass || "—"}</td>
                          <td className="px-4 py-2 text-slate-500">
                            {[d.city, d.state].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-900">
                            {formatCurrencyK(d.volume ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Phase 2/3 scaffolding — gated behind feature flags */}
            {profileData?.featureFlags && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PhaseCard
                  title="AI Advisory Drafts"
                  flag={profileData.featureFlags.broker_ai_drafts}
                  description="Train a knowledge base on your playbook and let MarinaMatch draft subscriber replies for you to approve before sending. Compliance gate: requires counsel review before turning on."
                />
                <PhaseCard
                  title="Subscriber Ratings & Credibility Score"
                  flag={profileData.featureFlags.broker_ratings}
                  description="Reviews, responsiveness scores, and weighted directory ranking. Opens once the platform reaches ~50 brokers / ~500 subscribers so ratings are statistically meaningful."
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </BrokerDashboardLayout>
  );
}

function PhaseCard({
  title,
  flag,
  description,
}: {
  title: string;
  flag: { flag: string; enabled: boolean; source: string } | undefined;
  description: string;
}) {
  const enabled = flag?.enabled ?? false;
  return (
    <Card className={enabled ? "" : "opacity-60"} data-testid={`phase-card-${flag?.flag}`}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-2">
          {!enabled && <Lock className="h-4 w-4 text-slate-400" />}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <Badge variant={enabled ? "default" : "secondary"}>
          {enabled ? "Live" : "Coming soon"}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}
