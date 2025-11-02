import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Anchor, 
  TrendingUp, 
  DollarSign, 
  Users,
  Calendar,
  MapPin,
  Award,
  Target,
  Activity,
  Waves,
  Boat,
  Building,
  Clock
} from "lucide-react";

interface MarinaKPIData {
  overview: {
    totalSlipsSold: number;
    totalBoatsSold: number;
    totalRevenue: number;
    avgSalePrice: number;
    seasonalGrowth: number;
    marketShare: number;
  };
  performance: {
    slipUtilization: number;
    customerRetention: number;
    referralRate: number;
    boatShowConversion: number;
    seasonalEfficiency: number;
    listingTurnover: number;
  };
  inventory: {
    availableSlips: {
      total: number;
      bySize: { category: string; count: number; avgPrice: number }[];
      premiumSlips: number;
    };
    boatListings: {
      total: number;
      byType: { type: string; count: number; avgPrice: number }[];
      newListings: number;
    };
    turnoverMetrics: {
      avgDaysOnMarket: number;
      quickSales: number; // < 30 days
      staleListing: number; // > 90 days
    };
  };
  regionalData: {
    topMarinas: {
      name: string;
      location: string;
      revenue: number;
      slipsSold: number;
      marketShare: number;
    }[];
    boatShows: {
      upcoming: number;
      thisMonthLeads: number;
      conversionRate: number;
      avgLeadValue: number;
    };
  };
  seasonalMetrics: {
    currentSeason: string;
    seasonalRevenue: number;
    yearOverYear: number;
    peakMonthProjection: number;
    offSeasonStrategy: string[];
  };
}

export default function MarinaKpiDashboard() {
  const { data: kpiData, isLoading } = useQuery<MarinaKPIData>({
    queryKey: ['/api/analytics/marina-kpis'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getPerformanceColor = (value: number, threshold: number = 80) => {
    if (value >= threshold) return 'text-green-600';
    if (value >= threshold * 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Anchor className="w-5 h-5 text-blue-600" />
              Marina Performance Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kpiData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-blue-600" />
            Marina Performance Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Anchor className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No marina KPI data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="marina-kpi-dashboard">
      {/* Overview KPIs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Anchor className="w-5 h-5 text-blue-600" />
              Marina Performance Dashboard
            </CardTitle>
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              Season: {kpiData.seasonalMetrics.currentSeason}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center mb-2">
                <Anchor className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {kpiData.overview.totalSlipsSold}
              </div>
              <div className="text-sm text-blue-700">Slips Sold</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-center mb-2">
                <Boat className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-900">
                {kpiData.overview.totalBoatsSold}
              </div>
              <div className="text-sm text-green-700">Boats Sold</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-center mb-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {formatCurrency(kpiData.overview.totalRevenue)}
              </div>
              <div className="text-sm text-purple-700">Total Revenue</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {formatPercentage(kpiData.overview.seasonalGrowth)}
              </div>
              <div className="text-sm text-orange-700">Seasonal Growth</div>
            </div>
          </div>
          
          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Avg Sale Price</div>
                <div className="font-bold">{formatCurrency(kpiData.overview.avgSalePrice)}</div>
              </div>
              <Target className="w-5 h-5 text-gray-600" />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Market Share</div>
                <div className="font-bold">{formatPercentage(kpiData.overview.marketShare)}</div>
              </div>
              <Activity className="w-5 h-5 text-gray-600" />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Slip Utilization</div>
                <div className="font-bold">{formatPercentage(kpiData.performance.slipUtilization)}</div>
              </div>
              <Building className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="regional">Regional</TabsTrigger>
              <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="performance" className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Performance Metrics</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Customer Retention</span>
                        <span className={`font-bold ${getPerformanceColor(kpiData.performance.customerRetention)}`}>
                          {formatPercentage(kpiData.performance.customerRetention)}
                        </span>
                      </div>
                      <Progress value={kpiData.performance.customerRetention} className="h-2" />
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Referral Rate</span>
                        <span className={`font-bold ${getPerformanceColor(kpiData.performance.referralRate, 30)}`}>
                          {formatPercentage(kpiData.performance.referralRate)}
                        </span>
                      </div>
                      <Progress value={kpiData.performance.referralRate} className="h-2" />
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Boat Show Conversion</span>
                        <span className={`font-bold ${getPerformanceColor(kpiData.performance.boatShowConversion, 25)}`}>
                          {formatPercentage(kpiData.performance.boatShowConversion)}
                        </span>
                      </div>
                      <Progress value={kpiData.performance.boatShowConversion} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Seasonal Efficiency</span>
                        <span className={`font-bold ${getPerformanceColor(kpiData.performance.seasonalEfficiency)}`}>
                          {formatPercentage(kpiData.performance.seasonalEfficiency)}
                        </span>
                      </div>
                      <Progress value={kpiData.performance.seasonalEfficiency} className="h-2" />
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Listing Turnover</span>
                        <span className={`font-bold ${getPerformanceColor(kpiData.performance.listingTurnover, 60)}`}>
                          {formatPercentage(kpiData.performance.listingTurnover)}
                        </span>
                      </div>
                      <Progress value={kpiData.performance.listingTurnover} className="h-2" />
                    </div>
                    
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Avg Days on Market</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-900">
                        {kpiData.inventory.turnoverMetrics.avgDaysOnMarket}
                      </div>
                      <div className="text-sm text-blue-700">days average</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="inventory" className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Inventory Overview</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Anchor className="w-4 h-4 text-blue-600" />
                      Available Slips
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <span className="font-medium">Total Available</span>
                        <span className="text-xl font-bold text-blue-900">
                          {kpiData.inventory.availableSlips.total}
                        </span>
                      </div>
                      
                      {kpiData.inventory.availableSlips.bySize.map((category, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium text-sm">{category.category}</div>
                            <div className="text-xs text-gray-600">
                              Avg: {formatCurrency(category.avgPrice)}
                            </div>
                          </div>
                          <div className="font-bold">{category.count}</div>
                        </div>
                      ))}
                      
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-yellow-900">Premium Slips</span>
                          <span className="font-bold text-yellow-900">
                            {kpiData.inventory.availableSlips.premiumSlips}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Boat className="w-4 h-4 text-green-600" />
                      Boat Listings
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <span className="font-medium">Total Listings</span>
                        <span className="text-xl font-bold text-green-900">
                          {kpiData.inventory.boatListings.total}
                        </span>
                      </div>
                      
                      {kpiData.inventory.boatListings.byType.map((type, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium text-sm capitalize">{type.type}</div>
                            <div className="text-xs text-gray-600">
                              Avg: {formatCurrency(type.avgPrice)}
                            </div>
                          </div>
                          <div className="font-bold">{type.count}</div>
                        </div>
                      ))}
                      
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-purple-900">New This Month</span>
                          <span className="font-bold text-purple-900">
                            {kpiData.inventory.boatListings.newListings}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-900">
                      {kpiData.inventory.turnoverMetrics.quickSales}
                    </div>
                    <div className="text-sm text-green-700">Quick Sales (&lt;30 days)</div>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-900">
                      {kpiData.inventory.turnoverMetrics.avgDaysOnMarket}
                    </div>
                    <div className="text-sm text-yellow-700">Avg Days on Market</div>
                  </div>
                  
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-900">
                      {kpiData.inventory.turnoverMetrics.staleListing}
                    </div>
                    <div className="text-sm text-red-700">Stale Listings (&gt;90 days)</div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="regional" className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Regional Performance</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-600" />
                      Top Performing Marinas
                    </h4>
                    <div className="space-y-3">
                      {kpiData.regionalData.topMarinas.map((marina, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-medium">{marina.name}</h5>
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <MapPin className="w-3 h-3" />
                                {marina.location}
                              </div>
                            </div>
                            <Badge variant="outline">
                              #{index + 1}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <div className="font-medium">{formatCurrency(marina.revenue)}</div>
                              <div className="text-gray-500">Revenue</div>
                            </div>
                            <div>
                              <div className="font-medium">{marina.slipsSold}</div>
                              <div className="text-gray-500">Slips Sold</div>
                            </div>
                            <div>
                              <div className="font-medium">{formatPercentage(marina.marketShare)}</div>
                              <div className="text-gray-500">Market Share</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-600" />
                      Boat Show Analytics
                    </h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                          <div className="text-2xl font-bold text-blue-900">
                            {kpiData.regionalData.boatShows.upcoming}
                          </div>
                          <div className="text-sm text-blue-700">Upcoming Shows</div>
                        </div>
                        
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                          <div className="text-2xl font-bold text-green-900">
                            {kpiData.regionalData.boatShows.thisMonthLeads}
                          </div>
                          <div className="text-sm text-green-700">Month Leads</div>
                        </div>
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Show Conversion Rate</span>
                          <span className={`font-bold ${getPerformanceColor(kpiData.regionalData.boatShows.conversionRate, 25)}`}>
                            {formatPercentage(kpiData.regionalData.boatShows.conversionRate)}
                          </span>
                        </div>
                        <Progress value={kpiData.regionalData.boatShows.conversionRate} className="h-2" />
                      </div>
                      
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-purple-900">Avg Lead Value</span>
                          <span className="font-bold text-purple-900">
                            {formatCurrency(kpiData.regionalData.boatShows.avgLeadValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="seasonal" className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Seasonal Analysis</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Waves className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Current Season Revenue</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-900 mb-1">
                        {formatCurrency(kpiData.seasonalMetrics.seasonalRevenue)}
                      </div>
                      <div className="text-sm text-blue-700">
                        {kpiData.seasonalMetrics.currentSeason} Performance
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Year-over-Year Growth</span>
                        <span className={`font-bold ${kpiData.seasonalMetrics.yearOverYear >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {kpiData.seasonalMetrics.yearOverYear >= 0 ? '+' : ''}{formatPercentage(kpiData.seasonalMetrics.yearOverYear)}
                        </span>
                      </div>
                      <Progress 
                        value={Math.abs(kpiData.seasonalMetrics.yearOverYear)} 
                        className="h-2" 
                      />
                    </div>
                    
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-900">Peak Month Projection</span>
                      </div>
                      <div className="text-2xl font-bold text-green-900">
                        {formatCurrency(kpiData.seasonalMetrics.peakMonthProjection)}
                      </div>
                      <div className="text-sm text-green-700">Expected peak revenue</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Off-Season Strategy</h4>
                    <div className="space-y-3">
                      {kpiData.seasonalMetrics.offSeasonStrategy.map((strategy, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <Award className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-amber-800">{strategy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}