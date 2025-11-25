import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { 
  Waves, 
  Sun, 
  Snowflake, 
  TrendingUp, 
  Calendar,
  MapPin,
  Activity,
  AlertTriangle,
  Target,
  Thermometer
} from "lucide-react";

interface SeasonalData {
  currentSeason: {
    name: string;
    factor: number;
    description: string;
    marketConditions: string;
    recommendations: string[];
  };
  monthlyTrends: {
    month: string;
    salesVolume: number;
    avgPrice: number;
    leadCount: number;
    showActivity: number;
    factor: number;
  }[];
  seasonalForecasts: {
    season: string;
    period: string;
    expectedSales: number;
    expectedLeads: number;
    confidence: number;
    keyFactors: string[];
  }[];
  weatherImpact: {
    currentWeatherFactor: number;
    upcomingForecast: string;
    impactLevel: 'low' | 'medium' | 'high';
    marketAdjustments: string[];
  };
  boatShows: {
    upcoming: {
      name: string;
      date: string;
      location: string;
      expectedLeads: number;
      type: string;
    }[];
    recent: {
      name: string;
      date: string;
      leadsGenerated: number;
      conversionRate: number;
      revenue: number;
    }[];
  };
}

const SEASON_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

const seasonIcons = {
  'Spring': Sun,
  'Summer': Waves,
  'Fall': Calendar,
  'Winter': Snowflake
};

export default function MarinaSeasonalAnalytics() {
  const { data: seasonalData, isLoading } = useQuery<SeasonalData>({
    queryKey: ['/api/analytics/seasonal'],
    refetchInterval: 3600000, // Refresh every hour
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getSeasonColor = (season: string) => {
    const colors = {
      'Spring': 'text-green-600 bg-green-50 border-green-200',
      'Summer': 'text-blue-600 bg-blue-50 border-blue-200',
      'Fall': 'text-orange-600 bg-orange-50 border-orange-200',
      'Winter': 'text-gray-600 bg-gray-50 border-gray-200'
    };
    return colors[season as keyof typeof colors] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getImpactColor = (level: string) => {
    const colors = {
      'low': 'text-green-600',
      'medium': 'text-yellow-600',
      'high': 'text-red-600'
    };
    return colors[level as keyof typeof colors] || 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-blue-600" />
              Marina Seasonal Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
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

  if (!seasonalData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waves className="w-5 h-5 text-blue-600" />
            Marina Seasonal Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Waves className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No seasonal data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CurrentSeasonIcon = seasonIcons[seasonalData.currentSeason.name as keyof typeof seasonIcons] || Waves;

  return (
    <div className="space-y-6" data-testid="marina-seasonal-analytics">
      {/* Current Season Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-blue-600" />
              Marina Seasonal Analytics
            </CardTitle>
            <Badge variant="outline" className={getSeasonColor(seasonalData.currentSeason.name)}>
              <CurrentSeasonIcon className="w-3 h-3 mr-1" />
              {seasonalData.currentSeason.name} Season
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {seasonalData.currentSeason.factor.toFixed(2)}x
              </div>
              <div className="text-sm text-blue-700">Seasonal Factor</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-center mb-2">
                <Thermometer className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-900">
                {(seasonalData.weatherImpact.currentWeatherFactor * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-green-700">Weather Impact</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-center mb-2">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-900 capitalize">
                {seasonalData.currentSeason.marketConditions}
              </div>
              <div className="text-sm text-purple-700">Market Conditions</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Current Season Analysis</h4>
              <p className="text-sm text-gray-600">{seasonalData.currentSeason.description}</p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Seasonal Recommendations</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {seasonalData.currentSeason.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <Target className="w-3 h-3 text-blue-600 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="trends" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="trends">Monthly Trends</TabsTrigger>
              <TabsTrigger value="forecasts">Seasonal Forecasts</TabsTrigger>
              <TabsTrigger value="weather">Weather Impact</TabsTrigger>
              <TabsTrigger value="events">Boat Shows</TabsTrigger>
            </TabsList>
            
            <TabsContent value="trends" className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">12-Month Seasonal Trends</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={seasonalData.monthlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          formatter={(value, name) => [
                            name === 'avgPrice' ? formatCurrency(Number(value)) : value,
                            String(name).replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase())
                          ]}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="salesVolume" 
                          stroke="#3B82F6" 
                          strokeWidth={2}
                          name="Sales Volume"
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="avgPrice" 
                          stroke="#10B981" 
                          strokeWidth={2}
                          name="Average Price"
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="leadCount" 
                          stroke="#F59E0B" 
                          strokeWidth={2}
                          name="Lead Count"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {seasonalData.monthlyTrends.slice(-4).map((month, index) => (
                    <div key={month.month} className="p-3 border rounded-lg">
                      <div className="font-medium text-sm">{month.month}</div>
                      <div className="text-lg font-bold text-blue-600">
                        {month.factor.toFixed(2)}x
                      </div>
                      <div className="text-xs text-gray-500">{month.salesVolume} sales</div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="forecasts" className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Seasonal Forecasts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {seasonalData.seasonalForecasts.map((forecast, index) => (
                    <div key={forecast.season} className={`p-4 rounded-lg border ${getSeasonColor(forecast.season)}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{forecast.season} {forecast.period}</h4>
                        <Badge variant="outline" className="text-xs">
                          {forecast.confidence}% confidence
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div className="text-lg font-bold">{forecast.expectedSales}</div>
                          <div className="text-xs text-gray-600">Expected Sales</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{forecast.expectedLeads}</div>
                          <div className="text-xs text-gray-600">Expected Leads</div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm font-medium mb-1">Key Factors:</div>
                        <div className="space-y-1">
                          {forecast.keyFactors.slice(0, 3).map((factor, idx) => (
                            <div key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                              <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                              {factor}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="weather" className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Weather Impact Analysis</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Thermometer className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">Current Weather Impact</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-900 mb-1">
                        {(seasonalData.weatherImpact.currentWeatherFactor * 100).toFixed(0)}%
                      </div>
                      <div className={`text-sm font-medium ${getImpactColor(seasonalData.weatherImpact.impactLevel)}`}>
                        {seasonalData.weatherImpact.impactLevel.toUpperCase()} impact level
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Sun className="w-4 h-4 text-yellow-600" />
                        <span className="font-medium">Upcoming Forecast</span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {seasonalData.weatherImpact.upcomingForecast}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Market Adjustments</h4>
                    <div className="space-y-2">
                      {seasonalData.weatherImpact.marketAdjustments.map((adjustment, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{adjustment}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="events" className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Boat Shows & Events</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Upcoming Shows
                    </h4>
                    <div className="space-y-3">
                      {seasonalData.boatShows.upcoming.map((show, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-medium text-sm">{show.name}</h5>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDate(show.date)}</span>
                                <MapPin className="w-3 h-3 ml-2" />
                                <span>{show.location}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {show.type}
                            </Badge>
                          </div>
                          <div className="text-sm text-blue-600 font-medium">
                            {show.expectedLeads} expected leads
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Recent Performance
                    </h4>
                    <div className="space-y-3">
                      {seasonalData.boatShows.recent.map((show, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-medium text-sm">{show.name}</h5>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatDate(show.date)}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="font-medium">{show.leadsGenerated}</div>
                              <div className="text-gray-500">Leads</div>
                            </div>
                            <div>
                              <div className="font-medium">{(show.conversionRate * 100).toFixed(2)}%</div>
                              <div className="text-gray-500">Conv. Rate</div>
                            </div>
                            <div>
                              <div className="font-medium">{formatCurrency(show.revenue)}</div>
                              <div className="text-gray-500">Revenue</div>
                            </div>
                          </div>
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