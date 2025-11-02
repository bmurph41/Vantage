import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Building, Anchor, TrendingUp, TrendingDown, 
  MapPin, DollarSign, Calendar, Users,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface PropertyMetrics {
  totalProperties: number;
  activeListings: number;
  averageDaysOnMarket: number;
  averageListingPrice: number;
  totalPropertyValue: number;
  
  // By property type
  propertyTypes: {
    type: 'marina' | 'boat' | 'slip' | 'dry_storage';
    count: number;
    averagePrice: number;
    averageDaysOnMarket: number;
    totalValue: number;
  }[];
  
  // Geographic distribution
  topLocations: {
    location: string;
    count: number;
    averagePrice: number;
    priceChange: number;
  }[];
  
  // Market trends
  priceHistory: {
    month: string;
    averagePrice: number;
    soldCount: number;
    listingCount: number;
  }[];
  
  // Performance metrics
  conversionRates: {
    inquiryToShowing: number;
    showingToOffer: number;
    offerToSale: number;
    overallConversion: number;
  };
  
  // Seasonal trends
  seasonalData: {
    season: string;
    activity: number;
    averagePrice: number;
    averageDaysOnMarket: number;
  }[];
}

interface PropertyAnalyticsProps {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export default function PropertyAnalytics({ dateRange }: PropertyAnalyticsProps) {
  const [selectedMetric, setSelectedMetric] = useState<'price' | 'volume' | 'time'>('price');

  const { data: metrics, isLoading } = useQuery<PropertyMetrics>({
    queryKey: ['/api/analytics/property-metrics', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/property-metrics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch property metrics');
      return response.json();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getPropertyIcon = (type: string) => {
    switch (type) {
      case 'marina': return Building;
      case 'boat': return Anchor;
      case 'slip': return MapPin;
      case 'dry_storage': return Building;
      default: return Building;
    }
  };

  const getTrendIcon = (change: number) => {
    return change >= 0 ? ArrowUpRight : ArrowDownRight;
  };

  const getTrendColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building className="w-6 h-6" />
            Property Analytics
          </h2>
          <p className="text-gray-600">
            Comprehensive insights into property listings, market trends, and performance.
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Properties</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalProperties}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Listings</p>
                <p className="text-2xl font-bold text-green-600">{metrics.activeListings}</p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Days on Market</p>
                <p className="text-2xl font-bold text-orange-600">{metrics.averageDaysOnMarket}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-100">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Listing Price</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(metrics.averageListingPrice)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Portfolio Value</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(metrics.totalPropertyValue)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-indigo-100">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList>
          <TabsTrigger value="breakdown">Property Breakdown</TabsTrigger>
          <TabsTrigger value="geography">Geographic Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Property Types Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.propertyTypes.map((type) => {
                  const Icon = getPropertyIcon(type.type);
                  const marketShare = (type.count / metrics.totalProperties) * 100;
                  
                  return (
                    <div key={type.type} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-gray-100">
                          <Icon className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium capitalize">{type.type.replace('_', ' ')}</div>
                          <div className="text-sm text-gray-600">
                            {type.count} properties • {marketShare.toFixed(1)}% of portfolio
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(type.averagePrice)}</div>
                        <div className="text-sm text-gray-600">
                          {type.averageDaysOnMarket} days avg
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.topLocations.map((location, index) => {
                  const TrendIcon = getTrendIcon(location.priceChange);
                  const trendColor = getTrendColor(location.priceChange);
                  
                  return (
                    <div key={location.location} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium">{location.location}</div>
                          <div className="text-sm text-gray-600">
                            {location.count} properties
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(location.averagePrice)}</div>
                        <div className={`text-sm flex items-center gap-1 ${trendColor}`}>
                          <TrendIcon className="w-3 h-3" />
                          {formatPercent(location.priceChange)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Inquiry to Showing</span>
                      <span className="font-medium">{metrics.conversionRates.inquiryToShowing}%</span>
                    </div>
                    <Progress value={metrics.conversionRates.inquiryToShowing} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Showing to Offer</span>
                      <span className="font-medium">{metrics.conversionRates.showingToOffer}%</span>
                    </div>
                    <Progress value={metrics.conversionRates.showingToOffer} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Offer to Sale</span>
                      <span className="font-medium">{metrics.conversionRates.offerToSale}%</span>
                    </div>
                    <Progress value={metrics.conversionRates.offerToSale} className="h-2" />
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between">
                      <span className="font-medium">Overall Conversion</span>
                      <span className="text-lg font-bold text-green-600">
                        {metrics.conversionRates.overallConversion}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Seasonal Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.seasonalData.map((season) => (
                    <div key={season.season} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{season.season}</div>
                        <div className="text-sm text-gray-600">
                          {season.averageDaysOnMarket} days avg
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(season.averagePrice)}</div>
                        <div className="text-sm text-gray-600">
                          Activity: {season.activity}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Market Trends</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={selectedMetric === 'price' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedMetric('price')}
                  >
                    Price
                  </Button>
                  <Button
                    variant={selectedMetric === 'volume' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedMetric('volume')}
                  >
                    Volume
                  </Button>
                  <Button
                    variant={selectedMetric === 'time' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedMetric('time')}
                  >
                    Time on Market
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.priceHistory.map((period) => (
                  <div key={period.month} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="font-medium">
                      {format(new Date(period.month), 'MMM yyyy')}
                    </div>
                    <div className="flex items-center gap-4">
                      {selectedMetric === 'price' && (
                        <span className="font-medium">{formatCurrency(period.averagePrice)}</span>
                      )}
                      {selectedMetric === 'volume' && (
                        <div className="text-right">
                          <div className="font-medium">{period.soldCount} sold</div>
                          <div className="text-sm text-gray-600">{period.listingCount} listed</div>
                        </div>
                      )}
                      {selectedMetric === 'time' && (
                        <Badge variant="secondary">
                          Coming soon
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
