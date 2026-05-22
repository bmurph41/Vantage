import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award, Star, TrendingUp, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface LeaderboardEntry {
  userId: string;
  userName: string;
  orgName: string;
  verifiedCount: number;
  totalCount: number;
  pendingCount: number;
  rank: number;
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">1st Place</Badge>;
  if (rank === 2) return <Badge className="bg-gray-100 text-gray-700 border-gray-300">2nd Place</Badge>;
  if (rank === 3) return <Badge className="bg-amber-100 text-amber-800 border-amber-300">3rd Place</Badge>;
  return null;
}

export default function Leaderboard() {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/sales-comps/leaderboard"],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/analysis/sales-comps")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Comps
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          Comp Contributor Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Top contributors ranked by verified comp submissions. Opt-in to appear on this list via your account settings.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{isLoading ? "—" : (data?.length ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Contributors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Star className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
            <p className="text-2xl font-bold">
              {isLoading ? "—" : data?.reduce((s, e) => s + e.verifiedCount, 0) ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Verified Comps</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
            <p className="text-2xl font-bold">
              {isLoading ? "—" : data?.reduce((s, e) => s + e.totalCount, 0) ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Total Submissions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Failed to load leaderboard data.</p>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Trophy className="h-10 w-10 mx-auto text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No contributors yet.</p>
              <p className="text-xs text-muted-foreground">
                Submit verified comps and opt-in to appear on the leaderboard.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 py-3 ${entry.rank <= 3 ? "bg-muted/30 -mx-4 px-4 rounded" : ""}`}
                >
                  <div className="flex items-center justify-center w-8">
                    <RankIcon rank={entry.rank} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{entry.userName}</p>
                      <RankBadge rank={entry.rank} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.orgName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">{entry.verifiedCount}</p>
                    <p className="text-xs text-muted-foreground">verified</p>
                  </div>
                  <div className="text-right shrink-0 min-w-[48px]">
                    <p className="text-sm text-muted-foreground">{entry.totalCount}</p>
                    <p className="text-xs text-muted-foreground">total</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="py-4 text-center space-y-1">
          <p className="text-sm font-medium">Want to appear on the leaderboard?</p>
          <p className="text-xs text-muted-foreground">
            Submit verified comps and enable leaderboard opt-in in your account settings under Data &amp; Privacy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
