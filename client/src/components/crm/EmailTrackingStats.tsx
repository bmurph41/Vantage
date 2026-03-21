import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Mail,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface EmailTrackingStatsData {
  summary: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    clickToOpenRate: number;
    uniqueContacts: number;
    uniqueDeals: number;
  };
  trend: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
  }>;
  recentEmails: Array<{
    id: string;
    subject: string;
    contactId: string | null;
    entityType: string | null;
    entityId: string | null;
    sentAt: string;
    opened: boolean;
    clicked: boolean;
    openedAt: string | null;
    clickedAt: string | null;
  }>;
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = "text-primary",
  trend
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: typeof Mail;
  color?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="p-4 rounded-lg border bg-muted/30 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
        {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}

export function EmailTrackingStats() {
  const { data, isLoading } = useQuery<EmailTrackingStatsData>({
    queryKey: ["/api/crm/emails/tracking-stats"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No email tracking data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Tracking Overview
        </CardTitle>
        <CardDescription>Last 90 days email engagement metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Emails Sent"
            value={data.summary.totalSent}
            icon={Mail}
            color="text-blue-500"
          />
          <StatCard
            title="Open Rate"
            value={`${data.summary.openRate}%`}
            subtitle={`${data.summary.totalOpened} opened`}
            icon={MailOpen}
            color="text-green-500"
            trend={data.summary.openRate > 25 ? "up" : data.summary.openRate < 15 ? "down" : "neutral"}
          />
          <StatCard
            title="Click Rate"
            value={`${data.summary.clickRate}%`}
            subtitle={`${data.summary.totalClicked} clicked`}
            icon={MousePointerClick}
            color="text-purple-500"
            trend={data.summary.clickRate > 5 ? "up" : data.summary.clickRate < 2 ? "down" : "neutral"}
          />
          <StatCard
            title="Bounce Rate"
            value={`${data.summary.bounceRate}%`}
            subtitle={`${data.summary.totalBounced} bounced`}
            icon={AlertTriangle}
            color="text-red-500"
            trend={data.summary.bounceRate < 2 ? "up" : data.summary.bounceRate > 5 ? "down" : "neutral"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">{data.summary.uniqueContacts}</div>
              <div className="text-xs text-muted-foreground">Unique Contacts Reached</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">{data.summary.uniqueDeals}</div>
              <div className="text-xs text-muted-foreground">Deals with Email Activity</div>
            </div>
          </div>
        </div>

        {data.summary.clickToOpenRate > 0 && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Click-to-Open Rate</span>
              <span className="font-medium">{data.summary.clickToOpenRate}%</span>
            </div>
            <Progress value={data.summary.clickToOpenRate} className="h-2" />
          </div>
        )}

        {data.trend && data.trend.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Email Activity Trend</h4>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value.slice(-5)}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sent" 
                    name="Sent"
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="opened" 
                    name="Opened"
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicked" 
                    name="Clicked"
                    stroke="#a855f7" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {data.recentEmails && data.recentEmails.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Recent Emails</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {data.recentEmails.slice(0, 10).map((email) => (
                <div key={email.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 truncate">
                    {email.subject}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {email.opened ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                        <MailOpen className="h-3 w-3 mr-1" />
                        Opened
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Sent</Badge>
                    )}
                    {email.clicked && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                        <MousePointerClick className="h-3 w-3 mr-1" />
                        Clicked
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
