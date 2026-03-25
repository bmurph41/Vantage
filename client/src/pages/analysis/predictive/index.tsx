import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, AlertTriangle, BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function PredictiveAnalyticsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("closure");

  // Deal closure predictions (batch)
  const { data: closureData, isLoading: closureLoading } = useQuery<any>({
    queryKey: ["/api/predictive/deal-closure"],
  });

  // Asset risk overview
  const { data: riskData, isLoading: riskLoading } = useQuery<any>({
    queryKey: ["/api/predictive/asset-risk"],
  });

  // Hold/sell portfolio summary
  const { data: holdSellData, isLoading: holdSellLoading } = useQuery<any>({
    queryKey: ["/api/predictive/hold-sell"],
  });

  const runBatchPredictions = useMutation({
    mutationFn: async () => {
      // Trigger individual predictions via the batch endpoint
      const res = await apiRequest("GET", "/api/predictive/deal-closure");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/predictive"] });
      toast({ title: "Predictions refreshed" });
    },
  });

  const tierColor = (tier: string) => {
    switch (tier) {
      case "A": return "bg-green-100 text-green-800";
      case "B": return "bg-blue-100 text-blue-800";
      case "C": return "bg-yellow-100 text-yellow-800";
      case "D": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const alertColor = (level: string) => {
    switch (level) {
      case "critical": return "destructive";
      case "warning": return "outline";
      case "watch": return "secondary";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Predictive Analytics</h1>
          <p className="text-muted-foreground">AI-powered deal closure predictions, asset risk scoring, and hold/sell optimization</p>
        </div>
        <Button onClick={() => runBatchPredictions.mutate()} disabled={runBatchPredictions.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${runBatchPredictions.isPending ? "animate-spin" : ""}`} />
          Refresh All
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <span className="text-sm text-muted-foreground">Total Deals Scored</span>
            </div>
            <p className="text-2xl font-bold mt-1">{closureData?.totalDeals || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm text-muted-foreground">High Probability</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{closureData?.highProbability || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-sm text-muted-foreground">At Risk</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{closureData?.atRisk || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-600" />
              <span className="text-sm text-muted-foreground">Assets Assessed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{riskData?.totalAssessed || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="closure">Deal Closure Probability</TabsTrigger>
          <TabsTrigger value="risk">Asset Risk Scores</TabsTrigger>
          <TabsTrigger value="holdsell">Hold / Sell Optimizer</TabsTrigger>
        </TabsList>

        {/* Deal Closure Tab */}
        <TabsContent value="closure">
          <Card>
            <CardHeader>
              <CardTitle>Deal Closure Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              {closureLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Top Factor</TableHead>
                      <TableHead>Recommendation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(closureData?.predictions || []).map((p: any) => (
                      <TableRow key={p.dealId}>
                        <TableCell className="font-medium">{p.dealTitle}</TableCell>
                        <TableCell><Badge variant="outline">{p.stage || "—"}</Badge></TableCell>
                        <TableCell>{p.value ? `$${Number(p.value).toLocaleString()}` : "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{ width: `${p.probability}%`, backgroundColor: p.probability >= 70 ? "#16a34a" : p.probability >= 40 ? "#eab308" : "#dc2626" }} />
                            </div>
                            <span className="text-sm font-medium">{p.probability}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.topFactor || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{p.recommendation}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Asset Risk Tab */}
        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Risk Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {riskLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{riskData?.critical || 0}</p>
                      <p className="text-xs text-muted-foreground">Critical</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{riskData?.warning || 0}</p>
                      <p className="text-xs text-muted-foreground">Warning</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{riskData?.watch || 0}</p>
                      <p className="text-xs text-muted-foreground">Watch</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{riskData?.normal || 0}</p>
                      <p className="text-xs text-muted-foreground">Normal</p>
                    </div>
                  </div>
                  {(riskData?.alerts || []).length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Deal</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Alert Level</TableHead>
                          <TableHead>Recommendation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(riskData?.alerts || []).map((a: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{a.dealId}</TableCell>
                            <TableCell>{a.compositeScore}</TableCell>
                            <TableCell><Badge variant={alertColor(a.alertLevel) as any}>{a.alertLevel}</Badge></TableCell>
                            <TableCell className="text-sm">{a.recommendation}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {(riskData?.alerts || []).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No risk alerts. Run asset risk assessments on individual deals to populate this view.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hold/Sell Tab */}
        <TabsContent value="holdsell">
          <Card>
            <CardHeader>
              <CardTitle>Hold / Sell Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {holdSellLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{holdSellData?.holdCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Hold</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{holdSellData?.sellCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Sell</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{holdSellData?.refinanceCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Refinance</p>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deal</TableHead>
                        <TableHead>Recommendation</TableHead>
                        <TableHead>Optimal Exit Year</TableHead>
                        <TableHead>Hold IRR</TableHead>
                        <TableHead>Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(holdSellData?.analyses || []).map((a: any) => (
                        <TableRow key={a.dealId}>
                          <TableCell className="font-medium">{a.dealId}</TableCell>
                          <TableCell>
                            <Badge variant={a.recommendation === "hold" ? "default" : a.recommendation === "sell" ? "destructive" : "secondary"}>
                              {a.recommendation === "hold" ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                              {a.recommendation}
                            </Badge>
                          </TableCell>
                          <TableCell>Year {a.optimalExitYear}</TableCell>
                          <TableCell>{a.holdIrr}%</TableCell>
                          <TableCell>{a.confidenceScore}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
