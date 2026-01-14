import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  TrendingUp, 
  Users, 
  BarChart3, 
  Search, 
  Plus, 
  Filter, 
  ChevronRight,
  Anchor,
  DollarSign,
  Percent,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Ship,
  Fuel
} from "lucide-react";
import type { Company } from "@shared/schema";

type PortfolioCompany = Company & {
  propertyCount?: number;
  totalSlips?: number;
  avgOccupancy?: number;
  latestMetrics?: Record<string, number>;
};

type CapitalPartnerGroup = {
  name: string;
  companies: PortfolioCompany[];
  totalMarinas: number;
  totalSlips: number;
};

export default function MarinalyticsPage() {
  const [activeTab, setActiveTab] = useState("operators");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCapitalPartner, setSelectedCapitalPartner] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  const portfolioCompanies = useMemo(() => {
    return companies.filter(c => c.isPortfolioCompany);
  }, [companies]);

  const capitalPartnerGroups = useMemo(() => {
    const groups: Record<string, CapitalPartnerGroup> = {};
    
    portfolioCompanies.forEach(company => {
      const partner = company.capitalPartner || "Independent";
      if (!groups[partner]) {
        groups[partner] = {
          name: partner,
          companies: [],
          totalMarinas: 0,
          totalSlips: 0,
        };
      }
      groups[partner].companies.push(company as PortfolioCompany);
      groups[partner].totalMarinas += 1;
    });
    
    return Object.values(groups).sort((a, b) => b.companies.length - a.companies.length);
  }, [portfolioCompanies]);

  const filteredCompanies = useMemo(() => {
    let filtered = portfolioCompanies;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(query) ||
        c.capitalPartner?.toLowerCase().includes(query)
      );
    }
    
    if (selectedCapitalPartner && selectedCapitalPartner !== "all") {
      filtered = filtered.filter(c => 
        (c.capitalPartner || "Independent") === selectedCapitalPartner
      );
    }
    
    return filtered;
  }, [portfolioCompanies, searchQuery, selectedCapitalPartner]);

  const uniqueCapitalPartners = useMemo(() => {
    const partners = new Set<string>();
    portfolioCompanies.forEach(c => {
      partners.add(c.capitalPartner || "Independent");
    });
    return Array.from(partners).sort();
  }, [portfolioCompanies]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Marinalytics
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Portfolio company analytics and marina operating benchmarks
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Operator
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Portfolio Companies</p>
                  <p className="text-2xl font-bold">{portfolioCompanies.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Capital Partners</p>
                  <p className="text-2xl font-bold">{uniqueCapitalPartners.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Occupancy</p>
                  <p className="text-2xl font-bold">87.3%</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Percent className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
                <ArrowUpRight className="h-3 w-3" />
                <span>+2.1% vs benchmark</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. $/LF/Yr</p>
                  <p className="text-2xl font-bold">$42.50</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
                <ArrowUpRight className="h-3 w-3" />
                <span>+5.8% YoY</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="operators">Portfolio Operators</TabsTrigger>
            <TabsTrigger value="metrics">Operating Metrics</TabsTrigger>
            <TabsTrigger value="benchmarks">Benchmark Library</TabsTrigger>
            <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="operators" className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search operators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCapitalPartner} onValueChange={setSelectedCapitalPartner}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Capital Partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  {uniqueCapitalPartners.map(partner => (
                    <SelectItem key={partner} value={partner}>{partner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCapitalPartner === "all" ? (
              <div className="space-y-6">
                {capitalPartnerGroups.map(group => (
                  <Card key={group.name}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{group.name}</CardTitle>
                          <Badge variant="secondary">{group.companies.length} operators</Badge>
                        </div>
                        <Button variant="ghost" size="sm">
                          View All <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.companies.slice(0, 6).map(company => (
                          <OperatorCard key={company.id} company={company} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompanies.map(company => (
                  <OperatorCard key={company.id} company={company as PortfolioCompany} />
                ))}
              </div>
            )}

            {filteredCompanies.length === 0 && !loadingCompanies && (
              <Card className="py-12">
                <CardContent className="text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Portfolio Companies Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Mark companies as "Portfolio Company" in the CRM to track them here.
                  </p>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Portfolio Company
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <MetricsPanel />
          </TabsContent>

          <TabsContent value="benchmarks" className="space-y-4">
            <BenchmarksPanel />
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <TrendsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OperatorCard({ company }: { company: PortfolioCompany }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-sm">{company.name}</h4>
            <p className="text-xs text-muted-foreground">
              {company.capitalPartner || "Independent"}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            <Anchor className="h-3 w-3 mr-1" />
            Marina Operator
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded p-2">
            <p className="text-xs text-muted-foreground">Marinas</p>
            <p className="font-semibold">--</p>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <p className="text-xs text-muted-foreground">Slips</p>
            <p className="font-semibold">--</p>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <p className="text-xs text-muted-foreground">Occ %</p>
            <p className="font-semibold">--</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricsPanel() {
  const metricCategories = [
    {
      name: "Revenue Metrics",
      icon: DollarSign,
      color: "text-green-500",
      metrics: [
        { key: "slip_revenue_per_foot", name: "Slip Revenue/LF", value: "$42.50", benchmark: "$38.00", delta: "+11.8%" },
        { key: "ancillary_revenue_share", name: "Ancillary Revenue %", value: "24.5%", benchmark: "22.0%", delta: "+2.5pts" },
        { key: "transient_mix", name: "Transient Mix", value: "18.2%", benchmark: "15.0%", delta: "+3.2pts" },
      ]
    },
    {
      name: "Occupancy & Utilization",
      icon: Activity,
      color: "text-blue-500",
      metrics: [
        { key: "occupancy_rate", name: "Occupancy Rate", value: "87.3%", benchmark: "85.0%", delta: "+2.3pts" },
        { key: "customer_retention", name: "Customer Retention", value: "91.2%", benchmark: "88.0%", delta: "+3.2pts" },
      ]
    },
    {
      name: "Fuel Operations",
      icon: Fuel,
      color: "text-amber-500",
      metrics: [
        { key: "fuel_gross_margin", name: "Fuel Gross Margin", value: "18.5%", benchmark: "15.0%", delta: "+3.5pts" },
        { key: "fuel_gallons_per_slip", name: "Gallons/Slip/Year", value: "485", benchmark: "400", delta: "+21.3%" },
      ]
    },
    {
      name: "Operating Efficiency",
      icon: TrendingUp,
      color: "text-purple-500",
      metrics: [
        { key: "labor_to_revenue", name: "Labor/Revenue", value: "28.5%", benchmark: "32.0%", delta: "-3.5pts", positive: true },
        { key: "opex_per_slip", name: "OpEx/Slip", value: "$2,450", benchmark: "$2,800", delta: "-12.5%", positive: true },
        { key: "ebitda_margin", name: "EBITDA Margin", value: "35.2%", benchmark: "30.0%", delta: "+5.2pts" },
      ]
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Operating Metrics Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Key performance indicators across your portfolio vs. industry benchmarks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="2024">
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2022">2022</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Metric
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metricCategories.map(category => (
          <Card key={category.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <category.icon className={`h-5 w-5 ${category.color}`} />
                {category.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.metrics.map(metric => (
                <div key={metric.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{metric.name}</p>
                    <p className="text-xs text-muted-foreground">Benchmark: {metric.benchmark}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{metric.value}</p>
                    <p className={`text-xs ${metric.delta.startsWith('+') ? 'text-green-600' : metric.delta.startsWith('-') && metric.positive ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.delta} vs benchmark
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BenchmarksPanel() {
  const benchmarkCohorts = [
    { name: "All Marinas", count: 450, region: "National" },
    { name: "Southeast Region", count: 125, region: "FL, GA, SC, NC" },
    { name: "Northeast Region", count: 98, region: "NY, NJ, CT, MA" },
    { name: "Large Marinas (>200 slips)", count: 85, region: "National" },
    { name: "Small Marinas (<100 slips)", count: 220, region: "National" },
    { name: "Yacht Clubs", count: 45, region: "National" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Benchmark Library</h3>
          <p className="text-sm text-muted-foreground">
            Industry benchmarks by cohort for comparative analysis
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Custom Cohort
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {benchmarkCohorts.map(cohort => (
          <Card key={cohort.name} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold">{cohort.name}</h4>
                  <p className="text-sm text-muted-foreground">{cohort.region}</p>
                </div>
                <Badge variant="secondary">{cohort.count} marinas</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Median $/LF</span>
                  <span className="font-medium">$38.50</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Median Occupancy</span>
                  <span className="font-medium">85.0%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Median EBITDA</span>
                  <span className="font-medium">30.0%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TrendsPanel() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Trend Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Historical performance trends across key metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="3y">
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1y">1 Year</SelectItem>
              <SelectItem value="3y">3 Years</SelectItem>
              <SelectItem value="5y">5 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue per Linear Foot Trend</CardTitle>
          <CardDescription>Portfolio average vs. industry benchmark over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-lg">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-2" />
              <p>Chart visualization will display here</p>
              <p className="text-sm">Connect P&L data to populate trend analysis</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-lg">
              <p className="text-sm text-muted-foreground">Occupancy chart</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">EBITDA Margin Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-lg">
              <p className="text-sm text-muted-foreground">EBITDA margin chart</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
