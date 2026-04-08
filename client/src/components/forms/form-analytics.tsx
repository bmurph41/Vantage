import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, TrendingUp, Users, MousePointer, Eye, Smartphone, 
  Monitor, Tablet, Globe, Calendar, ArrowUp, ArrowDown, Clock,
  MapPin, Zap, ChevronDown, Filter, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import type { Form } from "@shared/schema";

interface FormAnalyticsProps {
  form: Form;
  onClose: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function FormAnalytics({ form, onClose }: FormAnalyticsProps) {
  const [dateRange, setDateRange] = useState<string>("30");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch form performance metrics
  const { data: performanceMetrics = {
    totalSubmissions: 0,
    completionRate: 0,
    conversionRate: 0,
    averageTime: 0,
    topSources: [],
    deviceBreakdown: {},
    fieldAnalytics: {}
  }} = useQuery({
    queryKey: ['/api/forms', form.id, 'performance'],
  });

  // Fetch form analytics data
  const { data: analyticsData = [] } = useQuery({
    queryKey: ['/api/forms', form.id, 'analytics'],
  });

  // Fetch conversion funnel
  const { data: conversionFunnel = [] } = useQuery({
    queryKey: ['/api/forms', form.id, 'conversion-funnel'],
  });

  // Mock data for demonstration (would be replaced with real data)
  const mockTimeSeriesData = [
    { date: '2024-01-01', views: 120, submissions: 24, conversions: 18 },
    { date: '2024-01-02', views: 85, submissions: 19, conversions: 15 },
    { date: '2024-01-03', views: 140, submissions: 32, conversions: 28 },
    { date: '2024-01-04', views: 95, submissions: 18, conversions: 12 },
    { date: '2024-01-05', views: 160, submissions: 41, conversions: 35 },
    { date: '2024-01-06', views: 110, submissions: 25, conversions: 22 },
    { date: '2024-01-07', views: 180, submissions: 48, conversions: 42 },
  ];

  const mockFieldAnalytics = [
    { field: 'Email Address', dropoffRate: 5.2, avgTime: 8.5, errorRate: 2.1 },
    { field: 'Phone Number', dropoffRate: 12.8, avgTime: 15.2, errorRate: 8.3 },
    { field: 'Company Name', dropoffRate: 7.9, avgTime: 12.1, errorRate: 3.2 },
    { field: 'Message', dropoffRate: 18.5, avgTime: 45.3, errorRate: 1.8 },
  ];

  const deviceData = Object.entries(performanceMetrics.deviceBreakdown || {}).map(([device, count]) => ({
    name: device,
    value: count,
    percentage: Math.round((count / performanceMetrics.totalSubmissions) * 100)
  }));

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'desktop':
        return <Monitor className="w-4 h-4" />;
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      default:
        return <Globe className="w-4 h-4" />;
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Form Performance Analytics</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Detailed insights and metrics for {form.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger data-testid="select-date-range" className="w-32">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" data-testid="button-export">
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger data-testid="tab-overview" value="overview">Overview</TabsTrigger>
          <TabsTrigger data-testid="tab-funnel" value="funnel">Conversion Funnel</TabsTrigger>
          <TabsTrigger data-testid="tab-fields" value="fields">Field Analysis</TabsTrigger>
          <TabsTrigger data-testid="tab-sources" value="sources">Traffic Sources</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-submissions">
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Submissions</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {performanceMetrics.totalSubmissions?.toLocaleString() || '0'}
                    </p>
                    <div className="flex items-center mt-1">
                      <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                      <span className="text-xs text-green-600">+12.5%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-completion-rate">
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <MousePointer className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completion Rate</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {Math.round(performanceMetrics.completionRate || 0)}%
                    </p>
                    <div className="flex items-center mt-1">
                      <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                      <span className="text-xs text-green-600">+3.2%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-conversion-rate">
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Conversion Rate</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {Math.round(performanceMetrics.conversionRate || 0)}%
                    </p>
                    <div className="flex items-center mt-1">
                      <ArrowDown className="h-3 w-3 text-red-500 mr-1" />
                      <span className="text-xs text-red-600">-1.8%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-avg-time">
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Completion Time</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatTime(performanceMetrics.averageTime || 0)}
                    </p>
                    <div className="flex items-center mt-1">
                      <ArrowDown className="h-3 w-3 text-green-500 mr-1" />
                      <span className="text-xs text-green-600">-8.3%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Performance Over Time
              </CardTitle>
              <CardDescription>
                Track form views, submissions, and conversions over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockTimeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="views" 
                      stackId="1" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="submissions" 
                      stackId="2" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.3}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="conversions" 
                      stackId="3" 
                      stroke="#f59e0b" 
                      fill="#f59e0b" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Device Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
                <CardDescription>
                  Form submissions by device type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deviceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percentage }) => `${name} ${percentage}%`}
                      >
                        {deviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Traffic Sources</CardTitle>
                <CardDescription>
                  Sources driving the most submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceMetrics.topSources?.slice(0, 5).map((source, index) => (
                    <div key={index} className="flex items-center justify-between" data-testid={`source-${index}`}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          <Globe className="w-4 h-4 text-gray-600" />
                        </div>
                        <span className="ml-3 font-medium">
                          {source.source || 'Direct'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{source.count}</div>
                        <div className="text-sm text-gray-500">
                          {Math.round((source.count / performanceMetrics.totalSubmissions) * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Conversion Funnel Tab */}
        <TabsContent value="funnel" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
              <CardDescription>
                See where visitors drop off in your form
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conversionFunnel.map((step, index) => {
                  const conversionRate = step.visitors > 0 ? (step.conversions / step.visitors) * 100 : 0;
                  const dropoffRate = index > 0 ? 
                    ((conversionFunnel[index - 1].conversions - step.conversions) / conversionFunnel[index - 1].conversions) * 100 : 0;
                  
                  return (
                    <div key={index} className="space-y-2" data-testid={`funnel-step-${index}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {index + 1}
                            </span>
                          </div>
                          <span className="ml-3 font-medium">{step.step}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{step.conversions.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">
                            {Math.round(conversionRate)}% conversion
                          </div>
                        </div>
                      </div>
                      <Progress value={conversionRate} className="h-2" />
                      {index > 0 && dropoffRate > 0 && (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          {Math.round(dropoffRate)}% drop-off from previous step
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Field Analysis Tab */}
        <TabsContent value="fields" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Field Performance Analysis</CardTitle>
              <CardDescription>
                Analyze how each form field performs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {mockFieldAnalytics.map((field, index) => (
                  <div key={index} className="space-y-3" data-testid={`field-analysis-${index}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{field.field}</h4>
                      <Badge variant={field.dropoffRate > 15 ? "destructive" : field.dropoffRate > 10 ? "secondary" : "default"}>
                        {field.dropoffRate}% drop-off
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Drop-off Rate</p>
                        <div className="flex items-center">
                          <Progress value={field.dropoffRate} className="flex-1 h-2 mr-2" />
                          <span className="font-semibold">{field.dropoffRate}%</span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Avg. Time</p>
                        <p className="font-semibold">{formatTime(field.avgTime)}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Error Rate</p>
                        <p className="font-semibold">{field.errorRate}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Traffic Sources Tab */}
        <TabsContent value="sources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Source Analysis</CardTitle>
              <CardDescription>
                Detailed breakdown of traffic sources and their performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceMetrics.topSources?.slice(0, 10) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Source</th>
                      <th className="text-right py-2">Submissions</th>
                      <th className="text-right py-2">Conversion Rate</th>
                      <th className="text-right py-2">Quality Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceMetrics.topSources?.map((source, index) => (
                      <tr key={index} className="border-b" data-testid={`source-row-${index}`}>
                        <td className="py-2 font-medium">{source.source || 'Direct'}</td>
                        <td className="py-2 text-right">{source.count}</td>
                        <td className="py-2 text-right">
                          {Math.round((source.count / performanceMetrics.totalSubmissions) * 100)}%
                        </td>
                        <td className="py-2 text-right">
                          <Badge variant="default">High</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}