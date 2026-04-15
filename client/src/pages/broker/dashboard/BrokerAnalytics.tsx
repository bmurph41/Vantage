import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import BrokerDashboardLayout from "./BrokerDashboardLayout";
import {
  useAnalyticsOverview,
  useFollowersOverTime,
} from "@/hooks/use-broker-dashboard";

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase">{label}</div>
        <div className="text-2xl font-mono font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function BrokerAnalytics() {
  const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview();
  const { data: followers, isLoading: loadingFollowers } = useFollowersOverTime(30);

  return (
    <BrokerDashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>

        {loadingOverview ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : overview ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Total Followers" value={overview.totalFollowers} />
            <Kpi label="Advisory Subs" value={overview.totalAdvisorySubscribers} />
            <Kpi label="New (30d)" value={overview.newFollowersLast30Days} />
            <Kpi label="Content Published" value={overview.contentPublished} />
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Followers — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFollowers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !followers?.series.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No follower activity in the selected period.
              </div>
            ) : (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={followers.series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BrokerDashboardLayout>
  );
}
