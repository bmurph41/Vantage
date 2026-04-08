import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, CreditCard, BarChart3, Activity, Shield, TrendingUp } from "lucide-react";

export default function PlatformDashboardPage() {
  const [funnelPeriod, setFunnelPeriod] = useState("daily");
  const [funnelDays, setFunnelDays] = useState("90");

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/customers/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/customers/dashboard");
      return res.json();
    },
  });

  const { data: funnel } = useQuery<any>({
    queryKey: ["/api/admin/customers/signup-funnel", funnelPeriod, funnelDays],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/customers/signup-funnel?period=${funnelPeriod}&days=${funnelDays}`);
      return res.json();
    },
  });

  const { data: loginActivity } = useQuery<any>({
    queryKey: ["/api/admin/customers/login-activity"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/customers/login-activity?days=7");
      return res.json();
    },
  });

  const { data: sessions } = useQuery<any>({
    queryKey: ["/api/admin/customers/active-sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/customers/active-sessions?pageSize=20");
      return res.json();
    },
  });

  const u = dashboard?.users || {};
  const o = dashboard?.organizations || {};
  const s = dashboard?.subscriptions || {};

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Real-time platform health, signup funnel, and user activity</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          {/* Top-line KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-blue-600" /><span className="text-sm text-muted-foreground">Total Users</span></div>
                <p className="text-2xl font-bold">{u.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">{u.newLast30d || 0} new in 30d</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1"><Building2 className="h-4 w-4 text-purple-600" /><span className="text-sm text-muted-foreground">Organizations</span></div>
                <p className="text-2xl font-bold">{o.totalOrgs || 0}</p>
                <p className="text-xs text-muted-foreground">{o.newOrgsLast30d || 0} new in 30d</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-green-600" /><span className="text-sm text-muted-foreground">MRR</span></div>
                <p className="text-2xl font-bold text-green-600">${s.mrrDollars || "0"}</p>
                <p className="text-xs text-muted-foreground">ARR: ${s.arrDollars || "0"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-orange-600" /><span className="text-sm text-muted-foreground">Active in 30d</span></div>
                <p className="text-2xl font-bold">{u.activeInLast30d || 0}</p>
                <p className="text-xs text-muted-foreground">{u.neverLoggedIn || 0} never logged in</p>
              </CardContent>
            </Card>
          </div>

          {/* Second row KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card><CardContent className="pt-4 text-center"><p className="text-lg font-bold text-green-600">{u.activeUsers || 0}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-lg font-bold text-red-600">{u.disabledUsers || 0}</p><p className="text-xs text-muted-foreground">Disabled</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-lg font-bold">{u.verifiedUsers || 0}</p><p className="text-xs text-muted-foreground">Email Verified</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-lg font-bold">{u.mfaEnabled || 0}</p><p className="text-xs text-muted-foreground">MFA Enabled</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-lg font-bold">{s.activeSubs || 0} / {s.trialingSubs || 0}</p><p className="text-xs text-muted-foreground">Active / Trial Subs</p></CardContent></Card>
          </div>

          {/* Pack Adoption */}
          {dashboard?.packAdoption && (dashboard.packAdoption as any[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Pack Adoption</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {(dashboard.packAdoption as any[]).map((p: any) => (
                    <div key={p.packType} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Badge variant="secondary">{p.packType}</Badge>
                      <span className="font-bold">{p.activeCount}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Tabs defaultValue="funnel">
        <TabsList>
          <TabsTrigger value="funnel">Signup Funnel</TabsTrigger>
          <TabsTrigger value="login">Login Activity</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
        </TabsList>

        {/* Signup Funnel */}
        <TabsContent value="funnel">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Signup Funnel</CardTitle>
                <div className="flex gap-2">
                  <Select value={funnelPeriod} onValueChange={setFunnelPeriod}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={funnelDays} onValueChange={setFunnelDays}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {funnel?.totals && (
                <CardDescription>
                  {funnel.totals.signups} signups, {funnel.totals.verificationRate}% verified, {funnel.totals.activationRate}% activated
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Signups</TableHead>
                    <TableHead className="text-right">Verified</TableHead>
                    <TableHead className="text-right">Activated</TableHead>
                    <TableHead className="text-right">Verification %</TableHead>
                    <TableHead className="text-right">Activation %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(funnel?.data || []).map((row: any) => (
                    <TableRow key={row.period}>
                      <TableCell>{new Date(row.period).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-medium">{row.signups}</TableCell>
                      <TableCell className="text-right">{row.verified}</TableCell>
                      <TableCell className="text-right">{row.activated}</TableCell>
                      <TableCell className="text-right">{row.verificationRate}%</TableCell>
                      <TableCell className="text-right">{row.activationRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Login Activity */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Login Activity (Last 7 Days)</CardTitle>
              {loginActivity?.stats && (
                <CardDescription>
                  {loginActivity.stats.successCount} successes, {loginActivity.stats.failureCount} failures, {loginActivity.stats.uniqueUsers} unique users
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(loginActivity?.events || []).slice(0, 50).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{new Date(e.created_at).toLocaleString()}</TableCell>
                      <TableCell>{e.user_name || e.user_email || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant={e.event_type === "login_success" ? "default" : "destructive"}>
                          {e.event_type === "login_success" ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.ip_address}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Sessions */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions ({sessions?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sessions?.sessions || []).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.user_name || s.user_email}</TableCell>
                      <TableCell><Badge variant="outline">{s.device_type}</Badge></TableCell>
                      <TableCell className="text-sm">{s.browser} / {s.os}</TableCell>
                      <TableCell className="font-mono text-xs">{s.ip_address}</TableCell>
                      <TableCell className="text-sm">{s.location || "—"}</TableCell>
                      <TableCell className="text-sm">{s.last_activity_at ? new Date(s.last_activity_at).toLocaleString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
