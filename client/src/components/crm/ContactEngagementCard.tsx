import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  MousePointerClick,
  Calendar,
  Phone,
  Briefcase,
  Clock,
  RefreshCw,
  TrendingUp,
  MailOpen,
  Activity,
  Flame,
  ThermometerSun,
  Snowflake
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ContactEngagementScore {
  id: string;
  contactId: string;
  engagementScore: number;
  emailScore: number;
  meetingScore: number;
  callScore: number;
  dealInvolvementScore: number;
  recencyScore: number;
  responseScore: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsSent: number;
  totalMeetings: number;
  totalCalls: number;
  dealsInvolved: number;
  lastEmailOpen: string | null;
  lastEmailClick: string | null;
  lastMeeting: string | null;
  lastCall: string | null;
  lastInteraction: string | null;
  factors: Record<string, unknown>;
  lastCalculatedAt: string;
}

interface EmailActivity {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
  lastEmailOpen: string | null;
  lastEmailClick: string | null;
  recentActivity: Array<{
    type: string;
    date: string;
    subject?: string;
  }>;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function getScoreBackground(score: number): string {
  if (score >= 70) return "bg-green-50 border-green-200";
  if (score >= 40) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export function ContactEngagementCard({ contactId }: { contactId: string }) {
  const { data: engagement, isLoading: engagementLoading } = useQuery<ContactEngagementScore>({
    queryKey: ["/api/crm/contacts", contactId, "engagement-score"],
  });

  const { data: emailActivity, isLoading: emailLoading } = useQuery<EmailActivity>({
    queryKey: ["/api/crm/contacts", contactId, "email-activity"],
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/crm/contacts/${contactId}/recalculate-engagement`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", contactId, "engagement-score"] });
    },
  });

  if (engagementLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Engagement Score
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => recalculateMutation.mutate()}
              disabled={recalculateMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {engagement ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border text-center ${getScoreBackground(engagement.engagementScore)}`}>
                <div className={`text-4xl font-bold ${getScoreColor(engagement.engagementScore)}`}>
                  {engagement.engagementScore}
                </div>
                <div className="text-sm text-muted-foreground">out of 100</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span>Email: {engagement.emailScore}/25</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span>Meetings: {engagement.meetingScore}/25</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-green-500" />
                  <span>Calls: {engagement.callScore}/15</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-amber-500" />
                  <span>Deals: {engagement.dealInvolvementScore}/15</span>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Interaction</span>
                  <span className="font-medium">{formatDate(engagement.lastInteraction)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Deals Involved</span>
                  <Badge variant="secondary">{engagement.dealsInvolved}</Badge>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">
              No engagement data available
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MailOpen className="h-4 w-4" />
            Email Activity
          </CardTitle>
          <CardDescription>Last 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          {emailLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : emailActivity ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted/50">
                  <Mail className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                  <div className="text-xl font-bold">{emailActivity.totalSent}</div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <MailOpen className="h-4 w-4 mx-auto mb-1 text-green-500" />
                  <div className="text-xl font-bold">{emailActivity.openRate}%</div>
                  <div className="text-xs text-muted-foreground">Open Rate</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <MousePointerClick className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                  <div className="text-xl font-bold">{emailActivity.clickRate}%</div>
                  <div className="text-xs text-muted-foreground">Click Rate</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Email Open</span>
                  <span className="font-medium">{formatDate(emailActivity.lastEmailOpen)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Click</span>
                  <span className="font-medium">{formatDate(emailActivity.lastEmailClick)}</span>
                </div>
              </div>

              {emailActivity.recentActivity && emailActivity.recentActivity.length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
                  <div className="space-y-2">
                    {emailActivity.recentActivity.slice(0, 5).map((activity, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {activity.type === "click" ? (
                          <MousePointerClick className="h-3 w-3 text-purple-500" />
                        ) : activity.type === "open" ? (
                          <MailOpen className="h-3 w-3 text-green-500" />
                        ) : (
                          <Mail className="h-3 w-3 text-blue-500" />
                        )}
                        <span className="flex-1 truncate">{activity.subject || "Email"}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(activity.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">
              No email activity recorded
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getEngagementLevel(score: number): { label: string; color: string; bg: string; Icon: typeof Flame } {
  if (score >= 70) return { label: "Hot", color: "text-red-600", bg: "bg-red-50 border-red-200", Icon: Flame };
  if (score >= 40) return { label: "Warm", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", Icon: ThermometerSun };
  return { label: "Cold", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", Icon: Snowflake };
}

export function ContactEngagementBadge({ score, showScore = true }: { score: number; showScore?: boolean }) {
  const level = getEngagementLevel(score);
  const { Icon } = level;
  return (
    <Badge variant="outline" className={`${level.bg} ${level.color}`}>
      <Icon className="h-3 w-3 mr-1" />
      {level.label}
      {showScore && <span className="ml-1 opacity-75">({score})</span>}
    </Badge>
  );
}

export function ContactEngagementScoreBadge({ score }: { score: number }) {
  return (
    <Badge variant="outline" className={`${getScoreBackground(score)} ${getScoreColor(score)}`}>
      <TrendingUp className="h-3 w-3 mr-1" />
      {score}
    </Badge>
  );
}
