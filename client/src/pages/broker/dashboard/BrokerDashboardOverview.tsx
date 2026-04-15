import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import BrokerDashboardLayout from "./BrokerDashboardLayout";
import {
  useAnalyticsOverview,
  useMyBrokerProfile,
  usePublishMyProfile,
} from "@/hooks/use-broker-dashboard";

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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : overview ? (
          <>
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
          </>
        ) : null}
      </div>
    </BrokerDashboardLayout>
  );
}
