import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, CheckCircle, XCircle, Search, Shield, Users, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

export default function MasterCompsAdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("comps");
  const [compType, setCompType] = useState("sales");
  const [search, setSearch] = useState("");
  const [verified, setVerified] = useState<string>("");

  // Stats
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/master-comps/admin/stats"],
  });

  // Global comps list
  const { data: compsData, isLoading } = useQuery<any>({
    queryKey: ["/api/master-comps/admin/global-comps", compType, verified, search],
    queryFn: async () => {
      const params = new URLSearchParams({ compType });
      if (verified) params.set("verified", verified);
      if (search) params.set("search", search);
      const res = await apiRequest("GET", `/api/master-comps/admin/global-comps?${params}`);
      return res.json();
    },
  });

  // Contributions
  const { data: contributions = [] } = useQuery<any[]>({
    queryKey: ["/api/master-comps/contributions", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-comps/contributions?all=true&status=submitted");
      return res.json();
    },
  });

  const verifyComp = useMutation({
    mutationFn: async ({ compId, status, score }: { compId: string; status: string; score: number }) => {
      const res = await apiRequest("PATCH", `/api/master-comps/admin/verify/${compId}`, {
        compType,
        verificationStatus: status,
        dataQualityScore: score,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/master-comps"] });
      toast({ title: "Comp verified" });
    },
  });

  const reviewContribution = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/master-comps/contributions/${id}/review`, { status, reviewNotes: notes });
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/master-comps"] });
      toast({ title: vars.status === "approved" ? "Contribution approved & promoted" : "Contribution rejected" });
    },
  });

  const demoteComp = useMutation({
    mutationFn: async (compId: string) => {
      const res = await apiRequest("POST", "/api/master-comps/admin/demote", { compId, compType });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/master-comps"] });
      toast({ title: "Comp removed from master database" });
    },
  });

  const comps = compsData?.comps || [];
  const sc = stats?.salesComps || {};
  const rc = stats?.rateComps || {};
  const contrib = stats?.contributions || {};

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6" />Master Comps Administration</h1>
        <p className="text-muted-foreground">Curate the global comps database, review contributions, and manage quality</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{sc.total || 0}</p>
            <p className="text-xs text-muted-foreground">Sales Comps</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{rc.total || 0}</p>
            <p className="text-xs text-muted-foreground">Rate Comps</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-green-600">{(sc.verified || 0) + (rc.verified || 0)}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-orange-600">{contrib.submitted || 0}</p>
            <p className="text-xs text-muted-foreground">Pending Contributions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats?.subscribers || 0}</p>
            <p className="text-xs text-muted-foreground">Subscribers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="comps">Global Comps</TabsTrigger>
          <TabsTrigger value="contributions">
            Contributions
            {(contrib.submitted || 0) > 0 && <Badge variant="destructive" className="ml-2 text-xs">{contrib.submitted}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Global Comps */}
        <TabsContent value="comps">
          <div className="flex items-center gap-3 mb-4">
            <Select value={compType} onValueChange={setCompType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="rate">Rate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verified} onValueChange={setVerified}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="true">Verified</SelectItem>
                <SelectItem value="false">Unverified</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search marina name..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marina</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Sale Year</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comps.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.marina || "—"}</TableCell>
                        <TableCell>{c.city}, {c.state}</TableCell>
                        <TableCell>{c.saleYear || "—"}</TableCell>
                        <TableCell>{c.salePrice ? `$${Number(c.salePrice).toLocaleString()}` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.verificationStatus === "verified" ? "default" : "outline"}>
                            {c.verificationStatus || "unverified"}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.dataQualityScore || "—"}/100</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.verificationStatus !== "verified" && (
                              <Button size="sm" variant="outline" onClick={() => verifyComp.mutate({ compId: c.id, status: "verified", score: 80 })}>
                                <CheckCircle className="h-3 w-3 mr-1" />Verify
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => demoteComp.mutate(c.id)}>
                              <ArrowDownCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contributions */}
        <TabsContent value="contributions">
          <Card>
            <CardHeader>
              <CardTitle>Pending Contributions</CardTitle>
              <CardDescription>User-submitted comps awaiting review for master database inclusion</CardDescription>
            </CardHeader>
            <CardContent>
              {contributions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No pending contributions</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comp ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contributions.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.compId?.slice(0, 8)}...</TableCell>
                        <TableCell><Badge variant="outline">{c.compType}</Badge></TableCell>
                        <TableCell>{c.dataSource}</TableCell>
                        <TableCell><Badge variant="secondary">{c.confidenceLevel}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{c.submitterNotes || "—"}</TableCell>
                        <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => reviewContribution.mutate({ id: c.id, status: "approved" })}>
                              <CheckCircle className="h-3 w-3 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => reviewContribution.mutate({ id: c.id, status: "rejected" })}>
                              <XCircle className="h-3 w-3 mr-1" />Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
