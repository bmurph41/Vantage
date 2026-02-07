import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayrollPlans, useDepartments, usePayrollCalc } from "@/hooks/use-payroll";
import {
  DollarSign,
  Users,
  TrendingUp,
  Building2,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const DEPT_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#c026d3", "#d97706",
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: plans, isLoading: plansLoading } = usePayrollPlans({});
  const { data: departments, isLoading: deptsLoading } = useDepartments();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const activePlan = selectedPlanId
    ? plans?.find((p: any) => p.id === selectedPlanId)
    : plans?.[0];

  const { data: calcData, isLoading: calcLoading } = usePayrollCalc(
    activePlan?.id || "",
    { granularity: "monthly" },
  );

  const isLoading = plansLoading || deptsLoading;

  // Build department chart data from calc results
  const deptChartData = calcData?.departmentRollups
    ? Object.entries(calcData.departmentRollups).map(([deptId, totals]: [string, any], i) => {
        const dept = departments?.find((d: any) => d.id === deptId);
        return {
          name: dept?.name || "Unknown",
          total: Math.round((totals.totalCost || 0) / 100) / 10, // in $K
          color: DEPT_COLORS[i % DEPT_COLORS.length],
        };
      })
    : [];

  // W2 vs 1099 pie chart
  const workerTypeData = calcData?.workerTypeRollups
    ? Object.entries(calcData.workerTypeRollups).map(([type, totals]: [string, any]) => ({
        name: type === "W2" ? "W-2 Employees" : "1099 Contractors",
        value: Math.round(totals.totalCost || 0),
      }))
    : [];

  const grandTotal = calcData?.grandTotals?.totalCost || 0;
  const headcount = calcData?.grandTotals?.headcount || plans?.reduce((sum: number, p: any) => sum + (p.lineCount || 0), 0) || 0;

  return (
    <div className="space-y-6 p-6">
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {plans && plans.length > 0 && (
            <Select
              value={activePlan?.id || ""}
              onValueChange={setSelectedPlanId}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan: any) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.planName} ({plan.planType.replace(/_/g, " ")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={() => setLocation("/operations/payroll?tab=plans")}>
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
            <ClipboardIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{plans?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Across all assets
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {calcLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  ${grandTotal > 0 ? (grandTotal / 1000).toFixed(1) + "K" : "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Loaded cost (base + burden)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Headcount</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{headcount}</div>
                <p className="text-xs text-muted-foreground">
                  Active positions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {deptsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{departments?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Active departments
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      {plans && plans.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department Breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Payroll by Department</CardTitle>
              <CardDescription>Annual loaded cost per department ($K)</CardDescription>
            </CardHeader>
            <CardContent>
              {calcLoading ? (
                <Skeleton className="h-64" />
              ) : deptChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      angle={-30}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toFixed(1)}K`, "Total Cost"]}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {deptChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No calculation data available. Add lines to a plan to see department breakdown.
                </div>
              )}
            </CardContent>
          </Card>

          {/* W2 vs 1099 Pie */}
          <Card>
            <CardHeader>
              <CardTitle>Worker Type Mix</CardTitle>
              <CardDescription>W-2 vs 1099 breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {calcLoading ? (
                <Skeleton className="h-64" />
              ) : workerTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={workerTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      <Cell fill="#2563eb" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Legend />
                    <Tooltip
                      formatter={(value: number) => [`$${(value / 1000).toFixed(1)}K`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No worker type data yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">No Payroll Plans Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Create your first payroll plan to start tracking staffing costs, 
                burden rates, and departmental labor allocation.
              </p>
            </div>
            <Button onClick={() => setLocation("/operations/payroll?tab=plans")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Plans Table */}
      {plans && plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payroll Plans</CardTitle>
            <CardDescription>All plans across your portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Plan Name</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Lines</th>
                    <th className="text-right py-3 px-4 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan: any) => (
                    <tr
                      key={plan.id}
                      className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/operations/payroll?tab=plans&planId=${plan.id}`)}
                    >
                      <td className="py-3 px-4 font-medium">{plan.planName}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="capitalize">
                          {plan.planType?.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={plan.status === "ACTIVE" ? "default" : "secondary"}
                        >
                          {plan.status || "DRAFT"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">{plan.lineCount || 0}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {plan.createdAt
                          ? new Date(plan.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}
