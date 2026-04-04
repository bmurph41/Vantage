import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  FileCheck, Clock, DollarSign, AlertTriangle, CheckCircle2,
  Calendar, MapPin, ArrowRight, TrendingUp, Shield,
  ChevronRight, Building2, Anchor, Timer, CircleDot,
  ExternalLink, BarChart3,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ─── Helpers ────────────────────────────────────────────────────────

function fmtCurrency(val: number | string | null | undefined): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtFullCurrency(val: number | string | null | undefined): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (!n && n !== 0) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function urgencyColor(urgency: string | null): string {
  switch (urgency) {
    case "expired":
    case "past_due":
    case "critical":
      return "text-red-600 font-bold";
    case "warning":
      return "text-amber-600 font-semibold";
    default:
      return "text-gray-700";
  }
}

function urgencyBg(urgency: string | null): string {
  switch (urgency) {
    case "expired":
    case "past_due":
    case "critical":
      return "bg-red-50 border-red-200";
    case "warning":
      return "bg-amber-50 border-amber-200";
    default:
      return "bg-white";
  }
}

// ─── Types ──────────────────────────────────────────────────────────

interface DDDeal {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  stage: string;
  stageName: string | null;
  value: string | null;
  assetClass: string | null;
  propertyDetails: any;
  psaSignedDate: string | null;
  ddExpirationDate: string | null;
  closingDate: string | null;
  ddPeriodDays: number | null;
  ddGroup: string;
  ddDaysLeft: number | null;
  closingDaysLeft: number | null;
  timeInDeal: number;
  ddUrgency: string | null;
  closingUrgency: string | null;
  deposits: any[];
  extensions: any[];
  totalDeposit: number;
  checklistStats: {
    totalItems: number;
    completedItems: number;
    openItems: number;
    waitingOnSeller: number;
    waitingOnThirdParty: number;
    completionPct: number;
  } | null;
  titleInsuranceCompany: string | null;
  lender: string | null;
}

interface DDGroup {
  key: string;
  label: string;
  deals: DDDeal[];
  totalValue: number;
  totalSlips: number;
  dealCount: number;
}

interface DDDashboardData {
  deals: DDDeal[];
  groups: DDGroup[];
  depositSummary: {
    underContract: { deposit1Total: number; deposit2Total: number; totalDeposits: number };
    underLOI: { deposit1Total: number; deposit2Total: number; totalDeposits: number };
  };
  countdownDeals: DDDeal[];
  generatedAt: string;
}

// ─── Main Component ────────────────────────────────────────────────

export default function DDReviewDashboard() {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<DDDashboardData>({
    queryKey: ["/api/dd-review/dashboard"],
    queryFn: () => apiRequest("GET", "/api/dd-review/dashboard").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const totalValue = useMemo(() => {
    if (!data?.deals) return 0;
    return data.deals.reduce((s, d) => s + parseFloat(d.value || "0"), 0);
  }, [data]);

  const totalDeals = data?.deals?.length || 0;
  const urgentDeals = data?.countdownDeals?.filter(
    (d) => d.ddUrgency === "critical" || d.closingUrgency === "critical"
  ).length || 0;

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center text-red-600">
            Failed to load DD Review dashboard. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50/50">
        {/* Header */}
        <div className="bg-[#1B365D] text-white px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Due Diligence Review</h1>
              <p className="text-blue-200 text-sm mt-0.5">
                Portfolio DD Status — {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-blue-200 uppercase tracking-wider">Active Deals</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : totalDeals}</p>
              </div>
              <Separator orientation="vertical" className="h-10 bg-blue-400/30" />
              <div className="text-right">
                <p className="text-xs text-blue-200 uppercase tracking-wider">Total Value</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : fmtCurrency(totalValue)}</p>
              </div>
              {urgentDeals > 0 && (
                <>
                  <Separator orientation="vertical" className="h-10 bg-blue-400/30" />
                  <div className="text-right">
                    <p className="text-xs text-red-300 uppercase tracking-wider">Urgent</p>
                    <p className="text-2xl font-bold text-red-300">{urgentDeals}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              {/* Countdown Bar */}
              {data?.countdownDeals && data.countdownDeals.length > 0 && (
                <CountdownBar deals={data.countdownDeals} onNavigate={navigate} />
              )}

              {/* Deal Groups */}
              {data?.groups?.map((group) => (
                <DealGroupSection key={group.key} group={group} onNavigate={navigate} />
              ))}

              {/* Deposit Summary */}
              {data?.depositSummary && <DepositSummary data={data} />}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Countdown Bar ─────────────────────────────────────────────────

function CountdownBar({ deals, onNavigate }: { deals: DDDeal[]; onNavigate: (path: string) => void }) {
  return (
    <Card className="border-l-4 border-l-[#1B365D]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Timer className="h-4 w-4 text-[#1B365D]" />
          DD & Closing Countdown
          <span className="text-xs font-normal text-gray-400 ml-1">as of {new Date().toLocaleDateString()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-semibold text-gray-600 text-xs uppercase">Deal</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-600 text-xs uppercase" colSpan={2}>Due Diligence</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-600 text-xs uppercase" colSpan={2}>Closing</th>
              </tr>
              <tr className="border-b bg-gray-50/50">
                <th className="text-left py-1 px-3 text-xs text-gray-500"></th>
                <th className="text-center py-1 px-3 text-xs text-gray-500">Days Left</th>
                <th className="text-center py-1 px-3 text-xs text-gray-500">Deadline</th>
                <th className="text-center py-1 px-3 text-xs text-gray-500">Days Left</th>
                <th className="text-center py-1 px-3 text-xs text-gray-500">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr
                  key={deal.id}
                  className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${urgencyBg(deal.ddUrgency || deal.closingUrgency)}`}
                  onClick={() => onNavigate(`/deals/${deal.id}`)}
                >
                  <td className="py-2.5 px-3 font-medium text-gray-900">{deal.title}</td>
                  <td className={`py-2.5 px-3 text-center tabular-nums ${urgencyColor(deal.ddUrgency)}`}>
                    {deal.ddDaysLeft !== null ? deal.ddDaysLeft : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-center text-gray-600 tabular-nums">
                    {deal.ddExpirationDate ? (
                      <span className={deal.ddUrgency === "critical" || deal.ddUrgency === "expired" ? "font-bold text-red-600" : ""}>
                        {fmtDate(deal.ddExpirationDate)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className={`py-2.5 px-3 text-center tabular-nums ${urgencyColor(deal.closingUrgency)}`}>
                    {deal.closingDaysLeft !== null ? deal.closingDaysLeft : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-center text-gray-600 tabular-nums">
                    {deal.closingDate ? (
                      <span className={deal.closingUrgency === "critical" || deal.closingUrgency === "past_due" ? "font-bold text-red-600" : ""}>
                        {fmtDate(deal.closingDate)}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Deal Group Section ────────────────────────────────────────────

function DealGroupSection({ group, onNavigate }: { group: DDGroup; onNavigate: (path: string) => void }) {
  const groupColors: Record<string, string> = {
    under_contract: "bg-emerald-600",
    under_loi: "bg-blue-600",
    prospecting: "bg-gray-500",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={`${groupColors[group.key] || "bg-gray-500"} text-white px-3 py-1`}>
              {group.label}
            </Badge>
            <span className="text-sm text-gray-500">{group.dealCount} deal{group.dealCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              Total: <span className="font-semibold text-gray-900">{fmtCurrency(group.totalValue)}</span>
            </span>
            {group.totalSlips > 0 && (
              <span className="text-gray-500">
                Slips: <span className="font-semibold text-gray-900">{group.totalSlips.toLocaleString()}</span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1B365D] text-white text-xs">
                <th className="text-left py-2 px-3 font-medium">Property Name</th>
                <th className="text-left py-2 px-3 font-medium">City</th>
                <th className="text-left py-2 px-3 font-medium">State</th>
                <th className="text-left py-2 px-3 font-medium">Stage</th>
                <th className="text-right py-2 px-3 font-medium">Purchase Price</th>
                <th className="text-left py-2 px-3 font-medium">Property Type</th>
                <th className="text-right py-2 px-3 font-medium">Est Occ%</th>
                <th className="text-center py-2 px-3 font-medium">DD Progress</th>
                <th className="text-right py-2 px-3 font-medium">Time in Deal</th>
              </tr>
            </thead>
            <tbody>
              {group.deals.map((deal, idx) => (
                <DealRow key={deal.id} deal={deal} isAlt={idx % 2 === 1} onNavigate={onNavigate} />
              ))}
            </tbody>
          </table>
        </div>

        {/* DD Timeline details for each deal in this group */}
        <div className="mt-4 space-y-3">
          {group.deals.map((deal) => (
            <DealTimelineCard key={deal.id} deal={deal} onNavigate={onNavigate} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Deal Row ──────────────────────────────────────────────────────

function DealRow({ deal, isAlt, onNavigate }: { deal: DDDeal; isAlt: boolean; onNavigate: (path: string) => void }) {
  const pd = deal.propertyDetails as any;
  const estOcc = pd?.estOccupancy || pd?.est_occupancy || pd?.occupancy;
  const propType = deal.assetClass || deal.propertyDetails?.propertyType || "—";

  return (
    <tr
      className={`border-b hover:bg-blue-50/50 cursor-pointer transition-colors ${isAlt ? "bg-gray-50/50" : ""}`}
      onClick={() => onNavigate(`/deals/${deal.id}`)}
    >
      <td className="py-2.5 px-3 font-medium text-gray-900">{deal.title}</td>
      <td className="py-2.5 px-3 text-gray-600">{deal.city || "—"}</td>
      <td className="py-2.5 px-3 text-gray-600">{deal.state || "—"}</td>
      <td className="py-2.5 px-3">
        <Badge variant="outline" className="text-xs capitalize">
          {deal.stageName || deal.stage}
        </Badge>
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-gray-900 tabular-nums">
        {fmtFullCurrency(deal.value)}
      </td>
      <td className="py-2.5 px-3 text-gray-600 capitalize">{propType}</td>
      <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">
        {estOcc ? `${estOcc}%` : "—"}
      </td>
      <td className="py-2.5 px-3">
        {deal.checklistStats ? (
          <DDProgressBar stats={deal.checklistStats} />
        ) : (
          <span className="text-xs text-gray-400">No checklist</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">
        {deal.timeInDeal}d
      </td>
    </tr>
  );
}

// ─── DD Progress Bar ───────────────────────────────────────────────

function DDProgressBar({ stats }: { stats: DDDeal["checklistStats"] }) {
  if (!stats) return null;
  const pct = stats.completionPct;
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct >= 25 ? "bg-amber-500" : "bg-red-500";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-gray-600 whitespace-nowrap">{pct}%</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {stats.completedItems}/{stats.totalItems} items complete
          {stats.waitingOnSeller > 0 && ` | ${stats.waitingOnSeller} waiting on seller`}
          {stats.waitingOnThirdParty > 0 && ` | ${stats.waitingOnThirdParty} waiting on 3rd party`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Deal Timeline Card ────────────────────────────────────────────

function DealTimelineCard({ deal, onNavigate }: { deal: DDDeal; onNavigate: (path: string) => void }) {
  const hasTimeline = deal.psaSignedDate || deal.ddExpirationDate || deal.closingDate;
  const hasDeposits = deal.deposits && deal.deposits.length > 0;

  if (!hasTimeline && !hasDeposits) return null;

  return (
    <div className="border rounded-lg bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h4
          className="font-semibold text-sm text-gray-900 flex items-center gap-2 cursor-pointer hover:text-[#1B365D]"
          onClick={() => onNavigate(`/deals/${deal.id}`)}
        >
          {deal.title}
          {deal.city && deal.state && (
            <span className="text-gray-400 font-normal">
              | {deal.city}, {deal.state}
            </span>
          )}
          {deal.closingDate && (
            <span className="text-xs font-normal ml-2">
              <span className="text-red-500 uppercase font-semibold">Closing Target: {fmtDate(deal.closingDate)}</span>
            </span>
          )}
        </h4>
        <Button variant="ghost" size="sm" onClick={() => onNavigate(`/deals/${deal.id}`)}>
          View Deal <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DD Timeline */}
        {hasTimeline && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">DD Timeline</h5>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <TimelineRow label="PSA Signed" value={fmtDate(deal.psaSignedDate)} />
              <TimelineRow label="DD Period" value={deal.ddPeriodDays ? `${deal.ddPeriodDays} days` : "—"} />
              <TimelineRow
                label="DD Expiration"
                value={fmtDate(deal.ddExpirationDate)}
                urgent={deal.ddUrgency === "critical" || deal.ddUrgency === "expired"}
              />
              <TimelineRow
                label="DD Days Left"
                value={deal.ddDaysLeft !== null ? `${deal.ddDaysLeft}` : "—"}
                urgent={deal.ddUrgency === "critical" || deal.ddUrgency === "expired"}
              />
              <TimelineRow label="Closing Date" value={fmtDate(deal.closingDate)} />
              <TimelineRow
                label="Days to Close"
                value={deal.closingDaysLeft !== null ? `${deal.closingDaysLeft}` : "—"}
                urgent={deal.closingUrgency === "critical" || deal.closingUrgency === "past_due"}
              />
              <TimelineRow label="Time in Deal" value={`${deal.timeInDeal} days`} />
              {deal.extensions.length > 0 && (
                <TimelineRow
                  label="Extensions"
                  value={`${deal.extensions.filter((e: any) => e.executed).length}/${deal.extensions.length} executed`}
                />
              )}
            </div>
          </div>
        )}

        {/* Deposits */}
        {hasDeposits && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Deposits</h5>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="text-left py-1">#</th>
                  <th className="text-right py-1">Amount</th>
                  <th className="text-left py-1">Trigger</th>
                  <th className="text-right py-1">Offset</th>
                </tr>
              </thead>
              <tbody>
                {deal.deposits.map((dep: any, i: number) => (
                  <tr key={dep.id || i} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-600">#{dep.depositNumber || i + 1}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{fmtFullCurrency(dep.amount)}</td>
                    <td className="py-1.5 text-gray-600 capitalize text-xs">
                      {(dep.anchorEvent || "").replace(/_/g, " ")}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">
                      {dep.daysOffset ? `+${dep.daysOffset}d` : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{fmtFullCurrency(deal.totalDeposit)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DD Checklist Progress */}
      {deal.checklistStats && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-500">DD Checklist:</span>
            <span className="font-mono tabular-nums">
              {deal.checklistStats.completedItems}/{deal.checklistStats.totalItems} items
            </span>
            {deal.checklistStats.openItems > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                {deal.checklistStats.openItems} open
              </Badge>
            )}
            {deal.checklistStats.waitingOnSeller > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {deal.checklistStats.waitingOnSeller} waiting on seller
              </Badge>
            )}
            {deal.checklistStats.waitingOnThirdParty > 0 && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                {deal.checklistStats.waitingOnThirdParty} waiting on 3rd party
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline Row ──────────────────────────────────────────────────

function TimelineRow({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono tabular-nums ${urgent ? "text-red-600 font-bold" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Deposit Summary ───────────────────────────────────────────────

function DepositSummary({ data }: { data: DDDashboardData }) {
  const { underContract, underLOI } = data.depositSummary;
  const grandTotal = underContract.totalDeposits + underLOI.totalDeposits;

  if (grandTotal === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[#1B365D]" />
          Deposit Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1B365D] text-white text-xs">
                <th className="text-left py-2 px-3 font-medium">Group</th>
                <th className="text-right py-2 px-3 font-medium">Deposit #1</th>
                <th className="text-right py-2 px-3 font-medium">Deposit #2</th>
                <th className="text-right py-2 px-3 font-medium">Total Deposits</th>
              </tr>
            </thead>
            <tbody>
              {underContract.totalDeposits > 0 && (
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium">Under Contract</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtFullCurrency(underContract.deposit1Total)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtFullCurrency(underContract.deposit2Total)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">{fmtFullCurrency(underContract.totalDeposits)}</td>
                </tr>
              )}
              {underLOI.totalDeposits > 0 && (
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium">Under LOI</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtFullCurrency(underLOI.deposit1Total)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtFullCurrency(underLOI.deposit2Total)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">{fmtFullCurrency(underLOI.totalDeposits)}</td>
                </tr>
              )}
              <tr className="bg-gray-50 font-bold">
                <td className="py-2 px-3">Grand Total</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {fmtFullCurrency(underContract.deposit1Total + underLOI.deposit1Total)}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {fmtFullCurrency(underContract.deposit2Total + underLOI.deposit2Total)}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtFullCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
