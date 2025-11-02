import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, Mail, MessageSquare, Calendar, 
  TrendingUp, Clock, Target, BarChart3 
} from "lucide-react";

interface CommunicationStatsProps {
  entityType?: 'contact' | 'deal' | 'property' | 'company';
  entityId?: string;
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
  userId?: string;
}

interface CommunicationMetrics {
  totalActivities: number;
  callsCount: number;
  emailsCount: number;
  smsCount: number;
  meetingsCount: number;
  responseRate: number;
  avgResponseTime: number; // in hours
  touchesThisPeriod: number;
  lastActivityDate?: string;
  trends: {
    calls: { current: number; previous: number; change: number };
    emails: { current: number; previous: number; change: number };
    sms: { current: number; previous: number; change: number };
    meetings: { current: number; previous: number; change: number };
  };
}

export default function CommunicationStats({ 
  entityType, 
  entityId, 
  timeframe = 'month',
  userId 
}: CommunicationStatsProps) {
  
  const queryKey = entityType && entityId 
    ? [`/api/${entityType}/${entityId}/communication-stats`] 
    : [`/api/users/${userId}/communication-stats`];
    
  const { data: metrics, isLoading } = useQuery<CommunicationMetrics>({
    queryKey: [...queryKey, timeframe],
    enabled: Boolean(entityType && entityId) || Boolean(userId),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const formatChangePercent = (change: number) => {
    const isPositive = change >= 0;
    return (
      <span className={`text-sm flex items-center gap-1 ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        <TrendingUp className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} />
        {Math.abs(change)}%
      </span>
    );
  };

  const formatResponseTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
      return `${Math.round(hours)}h`;
    } else {
      return `${Math.round(hours / 24)}d`;
    }
  };

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      default: return 'This Period';
    }
  };

  const stats = [
    {
      title: 'Phone Calls',
      value: metrics.callsCount,
      icon: Phone,
      trend: metrics.trends.calls,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Emails',
      value: metrics.emailsCount,
      icon: Mail,
      trend: metrics.trends.emails,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Text Messages',
      value: metrics.smsCount,
      icon: MessageSquare,
      trend: metrics.trends.sms,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Meetings',
      value: metrics.meetingsCount,
      icon: Calendar,
      trend: metrics.trends.meetings,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Communication Stats - {getTimeframeLabel()}
        </h3>
        {metrics.lastActivityDate && (
          <Badge variant="outline">
            Last activity: {new Date(metrics.lastActivityDate).toLocaleDateString()}
          </Badge>
        )}
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    vs last {timeframe}
                  </span>
                  {formatChangePercent(stat.trend.change)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100">
                <Target className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Response Rate</p>
                <p className="text-xl font-bold text-gray-900">
                  {Math.round(metrics.responseRate)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatResponseTime(metrics.avgResponseTime)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-indigo-100">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Touches</p>
                <p className="text-xl font-bold text-gray-900">
                  {metrics.touchesThisPeriod}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Communication breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Communication Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.map((stat) => {
              const percentage = metrics.totalActivities > 0 
                ? Math.round((stat.value / metrics.totalActivities) * 100)
                : 0;
              
              return (
                <div key={stat.title} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${stat.bgColor.replace('bg-', 'bg-opacity-60 bg-')}`}></div>
                    <span className="text-sm font-medium">{stat.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{stat.value}</span>
                    <Badge variant="secondary" className="text-xs">
                      {percentage}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
