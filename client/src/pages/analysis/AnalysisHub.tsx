import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Landmark,
  Users,
  Anchor,
  ChevronRight,
  PieChart,
  Activity,
  Scale,
  LineChart,
  ArrowUpRight,
  Building2,
  Zap,
} from "lucide-react";

// ─── Tool definitions ────────────────────────────────────────────────────────

interface Tool {
  title: string;
  description: string;
  href: string;
  icon: typeof BarChart3;
  accent: string;       // Tailwind bg class for icon chip
  accentText: string;   // Tailwind text class for icon chip
  accentBorder: string; // Tailwind border-l class
  tag?: string;
}

const TOOLS: Tool[] = [
  {
    title: "Sales Comps",
    description: "Marina sales comparables and transaction data across all markets",
    href: "/analysis/sales-comps",
    icon: DollarSign,
    accent: "bg-emerald-50",
    accentText: "text-emerald-600",
    accentBorder: "border-l-emerald-400",
    tag: "Core",
  },
  {
    title: "Rate Comps",
    description: "Slip rate benchmarking across regions, markets, and marina types",
    href: "/analysis/rate-comps",
    icon: Scale,
    accent: "bg-blue-50",
    accentText: "text-blue-600",
    accentBorder: "border-l-blue-400",
    tag: "Core",
  },
  {
    title: "Financial Analysis",
    description: "Revenue, expense, and NOI trend analysis across your portfolio",
    href: "/analysis/financial-analysis",
    icon: PieChart,
    accent: "bg-orange-50",
    accentText: "text-orange-600",
    accentBorder: "border-l-orange-400",
  },
  {
    title: "Capital Markets",
    description: "Live SOFR, Treasury yields, prime rate, and forward curves",
    href: "/analysis/benchmarks",
    icon: Landmark,
    accent: "bg-purple-50",
    accentText: "text-purple-600",
    accentBorder: "border-l-purple-400",
    tag: "Live",
  },
  {
    title: "Portfolio Analytics",
    description: "Cross-property performance, KPIs, and cohort benchmarking",
    href: "/analysis/marinalytics",
    icon: BarChart3,
    accent: "bg-indigo-50",
    accentText: "text-indigo-600",
    accentBorder: "border-l-indigo-400",
  },
  {
    title: "Demographics",
    description: "Census data, population trends, and household income analysis",
    href: "/analysis/demographics",
    icon: Users,
    accent: "bg-cyan-50",
    accentText: "text-cyan-600",
    accentBorder: "border-l-cyan-400",
  },
  {
    title: "M&A Spotlight",
    description: "Industry transaction intelligence, deal tracking, and alerts",
    href: "/docket",
    icon: Anchor,
    accent: "bg-sky-50",
    accentText: "text-sky-600",
    accentBorder: "border-l-sky-400",
    tag: "New",
  },
  {
    title: "Valuation Timeline",
    description: "Track and compare property valuations and cap rates over time",
    href: "/analysis/valuation-timeline",
    icon: LineChart,
    accent: "bg-teal-50",
    accentText: "text-teal-600",
    accentBorder: "border-l-teal-400",
  },
  {
    title: "Industry Standards",
    description: "Curated benchmarks, KPI ranges, and performance reference data",
    href: "/analysis/industry-standards",
    icon: Activity,
    accent: "bg-rose-50",
    accentText: "text-rose-600",
    accentBorder: "border-l-rose-400",
  },
];

// ─── Stat card component ─────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: typeof BarChart3;
  isLoading?: boolean;
  accent: string;
  accentText: string;
}

function StatCard({ label, value, sub, icon: Icon, isLoading, accent, accentText }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-start gap-4">
      <div className={`w-9 h-9 rounded-lg ${accent} ${accentText} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
        {isLoading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-slate-900 leading-none">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        )}
        <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Tool card component ─────────────────────────────────────────────────────

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <Link href={tool.href}>
      <div className={`
        group relative bg-white rounded-xl border border-slate-200 border-l-[3px] ${tool.accentBorder}
        shadow-sm hover:shadow-md hover:-translate-y-0.5
        transition-all duration-200 cursor-pointer overflow-hidden
        flex flex-col p-5 h-full
      `}>
        {/* Tag badge */}
        {tool.tag && (
          <span className={`
            absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
            ${tool.tag === "New" ? "bg-emerald-100 text-emerald-700" :
              tool.tag === "Live" ? "bg-amber-100 text-amber-700" :
              "bg-slate-100 text-slate-500"}
          `}>
            {tool.tag}
          </span>
        )}

        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg ${tool.accent} ${tool.accentText} flex items-center justify-center mb-3 flex-shrink-0`}>
          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="font-semibold text-[14px] text-slate-800 group-hover:text-slate-900 leading-tight mb-1">
            {tool.title}
          </h3>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            {tool.description}
          </p>
        </div>

        {/* Arrow */}
        <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-slate-700 transition-colors">
          <span>Open</span>
          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalysisHub() {
  const { data: hubStats, isLoading } = useQuery<{
    salesCompsCount: number;
    rateCompsCount: number;
    dealsCount: number;
    marketRatesCount: number;
  }>({
    queryKey: ["/api/analysis/hub-stats"],
    staleTime: 1000 * 60 * 5,
  });

  const stats: StatCardProps[] = [
    {
      label: "Sales Comps",
      value: hubStats?.salesCompsCount ?? 0,
      sub: "transaction records",
      icon: DollarSign,
      accent: "bg-emerald-50",
      accentText: "text-emerald-600",
    },
    {
      label: "Rate Comps",
      value: hubStats?.rateCompsCount ?? 0,
      sub: "rate surveys",
      icon: Scale,
      accent: "bg-blue-50",
      accentText: "text-blue-600",
    },
    {
      label: "M&A Deals",
      value: hubStats?.dealsCount ?? 0,
      sub: "deal records tracked",
      icon: Anchor,
      accent: "bg-sky-50",
      accentText: "text-sky-600",
    },
    {
      label: "Market Rates",
      value: hubStats?.marketRatesCount ?? 0,
      sub: "FRED observations",
      icon: TrendingUp,
      accent: "bg-purple-50",
      accentText: "text-purple-600",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden border-b border-slate-200"
        style={{
          background: "linear-gradient(135deg, hsl(221,83%,18%) 0%, hsl(221,83%,30%) 60%, hsl(221,60%,40%) 100%)",
        }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(hsl(0,0%,100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0,0%,100%) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-300/10 rounded-full blur-2xl translate-y-1/2" />

        <div className="relative px-6 py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-white/15 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-blue-200">
                  Market Intelligence
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
                Analysis Hub
              </h1>
              <p className="text-blue-200 text-sm mt-1.5 max-w-lg leading-relaxed">
                Institutional-grade analytics, comparables, and market intelligence — all in one place.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start mt-1">
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
                <Zap className="w-3 h-3 text-amber-300" />
                <span className="text-[11px] font-semibold text-white">Live Data</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
            {stats.map((s) => (
              <StatCard key={s.label} {...s} isLoading={isLoading} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Tool grid ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[15px] font-bold text-slate-800">Analysis Tools</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">{TOOLS.length} modules available</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Building2 className="w-3.5 h-3.5" />
            <span>Marina Investment Platform</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.href} tool={tool} />
          ))}
        </div>

        {/* Bottom CTA strip */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-slate-700">Need a custom analysis?</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Use the Portfolio Analytics workbench to build ad-hoc views across any dataset.</p>
          </div>
          <Link href="/analysis/marinalytics">
            <div className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 transition-colors text-white text-[12px] font-semibold px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap">
              Open Workbench
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
