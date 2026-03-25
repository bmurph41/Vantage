import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Sparkles, Trophy, RefreshCw, Zap, CheckCircle, XCircle } from "lucide-react";

export default function DealSourcingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("leaderboard");

  const { data: profiles = [] } = useQuery<any[]>({
    queryKey: ["/api/deal-sourcing/buy-box"],
  });

  const { data: leaderboard } = useQuery<any>({
    queryKey: ["/api/deal-sourcing/leaderboard"],
  });

  const generateBuyBox = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deal-sourcing/buy-box/generate");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/deal-sourcing"] });
      toast({ title: "Buy Box generated", description: `Analyzed ${data.dealsAnalyzed} closed deals` });
    },
  });

  const scoreBatch = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deal-sourcing/score-batch");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/deal-sourcing"] });
      toast({ title: "Deals scored", description: `${data.totalScored} deals scored — ${data.tierCounts.A} A-tier` });
    },
  });

  const defaultProfile = profiles.find((p: any) => p.isDefault) || profiles[0];
  const leaderboardData = leaderboard?.leaderboard || [];

  const tierColor = (tier: string) => {
    switch (tier) {
      case "A": return "bg-green-100 text-green-800 border-green-300";
      case "B": return "bg-blue-100 text-blue-800 border-blue-300";
      case "C": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "D": return "bg-red-100 text-red-800 border-red-300";
      default: return "";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deal Sourcing & Buy Box</h1>
          <p className="text-muted-foreground">AI-generated acquisition profile, deal scoring, and tier rankings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generateBuyBox.mutate()} disabled={generateBuyBox.isPending}>
            <Sparkles className={`h-4 w-4 mr-2 ${generateBuyBox.isPending ? "animate-pulse" : ""}`} />
            {generateBuyBox.isPending ? "Analyzing..." : "Generate Buy Box"}
          </Button>
          <Button onClick={() => scoreBatch.mutate()} disabled={scoreBatch.isPending}>
            <Zap className={`h-4 w-4 mr-2 ${scoreBatch.isPending ? "animate-spin" : ""}`} />
            Score All Deals
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leaderboard">Deal Leaderboard</TabsTrigger>
          <TabsTrigger value="buybox">Buy Box Profile</TabsTrigger>
        </TabsList>

        {/* Leaderboard */}
        <TabsContent value="leaderboard">
          {/* Tier summary */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {["A", "B", "C", "D"].map((tier) => {
              const count = leaderboardData.filter((d: any) => d.tier === tier).length;
              return (
                <Card key={tier} className={tierColor(tier)}>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold">{count}</p>
                    <p className="text-sm font-medium">Tier {tier}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardContent className="pt-6">
              {leaderboardData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No deals scored yet. Generate a Buy Box first, then score your deals.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Deal</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Matches</TableHead>
                      <TableHead>Misses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboardData.map((d: any, i: number) => (
                      <TableRow key={d.dealId}>
                        <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{d.dealId}</TableCell>
                        <TableCell>
                          <Badge className={tierColor(d.tier)}>{d.tier}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div className="h-2 rounded-full bg-blue-600" style={{ width: `${d.score}%` }} />
                            </div>
                            <span className="text-sm">{d.score}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {((d.matches || []) as string[]).slice(0, 2).map((m: string, j: number) => (
                            <div key={j} className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="h-3 w-3" /> {m}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {((d.misses || []) as string[]).slice(0, 2).map((m: string, j: number) => (
                            <div key={j} className="flex items-center gap-1 text-xs text-red-600">
                              <XCircle className="h-3 w-3" /> {m}
                            </div>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buy Box Profile */}
        <TabsContent value="buybox">
          {!defaultProfile ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground mb-4">No Buy Box profile yet. Generate one from your closed deal history.</p>
                <Button onClick={() => generateBuyBox.mutate()} disabled={generateBuyBox.isPending}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Buy Box from Deal History
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {defaultProfile.name}
                  </CardTitle>
                  <CardDescription>
                    Based on {defaultProfile.dataPointCount || 0} closed deals
                    {defaultProfile.confidence && ` (${defaultProfile.confidence}% confidence)`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Preferred Asset Classes</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {((defaultProfile.preferredAssetClasses || []) as string[]).map((ac: string) => (
                        <Badge key={ac} variant="secondary">{ac}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Preferred Markets</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {((defaultProfile.preferredMarkets || []) as string[]).map((m: string) => (
                        <Badge key={m} variant="outline">{m}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Price Range</p>
                      <p className="font-medium">${Number(defaultProfile.priceMin || 0).toLocaleString()} — ${Number(defaultProfile.priceMax || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cap Rate Range</p>
                      <p className="font-medium">{(Number(defaultProfile.capRateMin || 0) * 100).toFixed(1)}% — {(Number(defaultProfile.capRateMax || 0) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Strategy & Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {defaultProfile.preferredStrategies && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Preferred Strategies</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {((defaultProfile.preferredStrategies || []) as string[]).map((s: string) => (
                          <Badge key={s} variant="secondary">{s.replace(/_/g, " ")}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {defaultProfile.avoidCharacteristics && (defaultProfile.avoidCharacteristics as string[]).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avoid</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {((defaultProfile.avoidCharacteristics || []) as string[]).map((a: string) => (
                          <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {defaultProfile.aiGeneratedProfile?.pattern_insights && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">AI Insights</p>
                      <p className="text-sm mt-1">{defaultProfile.aiGeneratedProfile.pattern_insights}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Last generated: {defaultProfile.lastGeneratedAt ? new Date(defaultProfile.lastGeneratedAt).toLocaleDateString() : "Never"}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
