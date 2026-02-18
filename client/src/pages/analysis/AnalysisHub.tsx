import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
} from "lucide-react";

interface QuickLink {
  title: string;
  description: string;
  href: string;
  icon: typeof BarChart3;
  color: string;
}

const quickLinks: QuickLink[] = [
  {
    title: "Sales Comps",
    description: "Marina sales comparables and transaction data",
    href: "/analysis/sales-comps",
    icon: DollarSign,
    color: "text-green-600",
  },
  {
    title: "Rate Comps",
    description: "Slip rate benchmarking across regions",
    href: "/analysis/rate-comps",
    icon: Scale,
    color: "text-blue-600",
  },
  {
    title: "Capital Markets",
    description: "Live SOFR, Treasury yields, and forward curves",
    href: "/analysis/benchmarks",
    icon: Landmark,
    color: "text-purple-600",
  },
  {
    title: "Financial Analysis",
    description: "Revenue, expense, and NOI trend analysis",
    href: "/analysis/financial-analysis",
    icon: PieChart,
    color: "text-orange-600",
  },
  {
    title: "Demographics",
    description: "Census data, population, and income analysis",
    href: "/analysis/demographics",
    icon: Users,
    color: "text-cyan-600",
  },
  {
    title: "Portfolio Analytics",
    description: "Cross-property performance and KPIs",
    href: "/analysis/marinalytics",
    icon: BarChart3,
    color: "text-indigo-600",
  },
  {
    title: "M&A Spotlight",
    description: "Industry transaction intelligence and deal tracking",
    href: "/docktalk",
    icon: Anchor,
    color: "text-sky-600",
  },
  {
    title: "Valuation Timeline",
    description: "Track property valuations over time",
    href: "/analysis/valuation-timeline",
    icon: LineChart,
    color: "text-emerald-600",
  },
  {
    title: "Industry Standards",
    description: "Curated benchmarks and performance metrics",
    href: "/analysis/industry-standards",
    icon: Activity,
    color: "text-rose-600",
  },
];

export default function AnalysisHub() {
  const { data: hubStats, isLoading: statsLoading } = useQuery<{
    salesCompsCount: number;
    rateCompsCount: number;
    dealsCount: number;
    marketRatesCount: number;
  }>({
    queryKey: ["/api/analysis/hub-stats"],
    staleTime: 1000 * 60 * 5,
  });

  const compsCount = hubStats?.salesCompsCount ?? 0;
  const rateCompsCount = hubStats?.rateCompsCount ?? 0;
  const dealsCount = hubStats?.dealsCount ?? 0;
  const rateObs = hubStats?.marketRatesCount ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Market Intelligence</h1>
        <p className="text-muted-foreground mt-1">
          Your central hub for marina industry analytics, comparables, and market data
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sales Comps</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{compsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">transactions tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rate Comps</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{rateCompsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">rate surveys</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">M&A Deals</CardTitle>
            <Anchor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dealsCount}</div>
            <p className="text-xs text-muted-foreground">deal records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Market Rates</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rateObs.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">FRED observations</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Analysis Tools</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow group h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-muted ${link.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-base">{link.title}</CardTitle>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{link.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
