import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, TrendingDown, Minus, Phone, Mail, Calendar, 
  Target, Handshake, Users, DollarSign, Download, RefreshCcw
} from "lucide-react";
import { useState } from "react";

type MetricCardProps = {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  color: string;
};

function MetricCard({ title, value, change, changeLabel, icon: Icon, color }: MetricCardProps) {
  const getTrendIcon = () => {
    if (change === undefined) return null;
    if (change > 0) return <TrendingUp className="w-3 h-3" />;
    if (change < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (change === undefined) return "text-gray-500";
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-500";
  };

  return (
    <Card className="bg-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center mt-1 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="ml-1">{change > 0 ? '+' : ''}{change}% {changeLabel || 'vs last period'}</span>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FunnelStage = {
  name: string;
  value: number;
  percentage: number;
  color: string;
};

const funnelData: FunnelStage[] = [
  { name: 'Total Touches', value: 1250, percentage: 100, color: 'bg-blue-500' },
  { name: 'Conversations', value: 312, percentage: 25, color: 'bg-green-500' },
  { name: 'Qualified Leads', value: 156, percentage: 12.5, color: 'bg-yellow-500' },
  { name: 'Deals Created', value: 42, percentage: 3.4, color: 'bg-purple-500' },
  { name: 'Deals Closed', value: 8, percentage: 0.6, color: 'bg-orange-500' },
];

const sourceData = [
  { source: 'Cold Call', leads: 85, deals: 12, conversion: '14.1%' },
  { source: 'Email Campaign', leads: 120, deals: 8, conversion: '6.7%' },
  { source: 'LoopNet', leads: 45, deals: 6, conversion: '13.3%' },
  { source: 'Crexi', leads: 38, deals: 5, conversion: '13.2%' },
  { source: 'Broker Referral', leads: 28, deals: 8, conversion: '28.6%' },
  { source: 'Direct Owner', leads: 22, deals: 3, conversion: '13.6%' },
];

export default function DealSourcingAnalytics() {
  const [timeRange, setTimeRange] = useState('month');

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Deal Sourcing Analytics</h1>
            <p className="text-gray-500 mt-1">Track your prospecting performance and conversion metrics</p>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" data-testid="button-refresh">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Touches"
            value="1,250"
            change={15}
            icon={Phone}
            color="bg-blue-500"
          />
          <MetricCard
            title="Conversations"
            value="312"
            change={8}
            icon={Users}
            color="bg-green-500"
          />
          <MetricCard
            title="Deals Created"
            value="42"
            change={-5}
            icon={Target}
            color="bg-purple-500"
          />
          <MetricCard
            title="Pipeline Value"
            value="$18.5M"
            change={22}
            icon={DollarSign}
            color="bg-orange-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Conversion Funnel</CardTitle>
              <CardDescription>Track leads through your pipeline stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {funnelData.map((stage, index) => (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{stage.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{stage.value.toLocaleString()}</span>
                        <Badge variant="secondary" className="text-xs">{stage.percentage}%</Badge>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${stage.color} rounded-full transition-all duration-500`}
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                    {index < funnelData.length - 1 && (
                      <div className="flex justify-center my-1">
                        <div className="text-xs text-gray-400">
                          {Math.round((funnelData[index + 1].value / stage.value) * 100)}% conversion
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Activity Breakdown</CardTitle>
              <CardDescription>Distribution of prospecting activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Phone className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="font-medium">Calls Made</span>
                  </div>
                  <span className="text-xl font-bold text-blue-600">428</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 text-green-600 mr-3" />
                    <span className="font-medium">Emails Sent</span>
                  </div>
                  <span className="text-xl font-bold text-green-600">822</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 text-purple-600 mr-3" />
                    <span className="font-medium">Meetings Held</span>
                  </div>
                  <span className="text-xl font-bold text-purple-600">67</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center">
                    <Handshake className="w-5 h-5 text-orange-600 mr-3" />
                    <span className="font-medium">LOIs Submitted</span>
                  </div>
                  <span className="text-xl font-bold text-orange-600">12</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Lead Source Performance</CardTitle>
            <CardDescription>Compare conversion rates by lead source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Source</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Leads</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Deals</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Conversion</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceData.map((row, index) => (
                    <tr key={row.source} className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{row.source}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">{row.leads}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{row.deals}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant={parseFloat(row.conversion) > 15 ? "default" : "secondary"}>
                          {row.conversion}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              parseFloat(row.conversion) > 20 ? 'bg-green-500' :
                              parseFloat(row.conversion) > 10 ? 'bg-blue-500' :
                              'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(parseFloat(row.conversion) * 3, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
