import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Activity, Clock, CheckCircle, XCircle, 
  AlertTriangle, Zap, TrendingUp, BarChart3,
  RefreshCw, Filter, Download, Eye
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";

interface AutomationExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  triggeredBy: {
    type: string;
    entityId: string;
    entityType: string;
    entityName: string;
  };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: {
    stepId: string;
    action: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    result?: any;
    error?: string;
  }[];
  startedAt: string;
  completedAt?: string;
  duration?: number;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface AutomationStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  topTriggers: {
    workflowName: string;
    count: number;
    successRate: number;
  }[];
  recentActivity: {
    date: string;
    executions: number;
    successes: number;
    failures: number;
  }[];
}

export default function AutomationMonitor() {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: stats, isLoading: statsLoading } = useQuery<AutomationStats>({
    queryKey: ['/api/automation/stats', timeframe],
  });

  const { data: executions = [], isLoading: executionsLoading } = useQuery<AutomationExecution[]>({
    queryKey: ['/api/automation/executions', timeframe, statusFilter],
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'failed': return XCircle;
      case 'running': return RefreshCw;
      case 'pending': return Clock;
      case 'cancelled': return XCircle;
      default: return Activity;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.round(duration / 60)}m`;
    return `${Math.round(duration / 3600)}h`;
  };

  if (statsLoading || executionsLoading) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Automation Monitor
          </h2>
          <p className="text-gray-600">
            Track workflow executions, performance, and troubleshoot issues.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Log
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Executions</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalExecutions}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-100">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.totalExecutions > 0 
                      ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Executions</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failedExecutions}</p>
                </div>
                <div className="p-3 rounded-full bg-red-100">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDuration(stats.averageDuration)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-yellow-100">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="executions" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="executions">Recent Executions</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            {/* Timeframe Filter */}
            <div className="flex border rounded-lg">
              {(['day', 'week', 'month'] as const).map((period) => (
                <Button
                  key={period}
                  variant={timeframe === period ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTimeframe(period)}
                  className="capitalize"
                >
                  {period}
                </Button>
              ))}
            </div>
            
            {/* Status Filter */}
            <div className="flex border rounded-lg">
              {(['all', 'completed', 'failed', 'running'] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <TabsContent value="executions" className="space-y-4">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No executions found</h3>
                <p className="text-gray-600">
                  No automation executions match your current filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {executions.map((execution) => (
                <ExecutionCard key={execution.id} execution={execution} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performing Workflows */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Top Performing Workflows
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topTriggers.map((trigger, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{trigger.workflowName}</div>
                          <div className="text-sm text-gray-600">
                            {trigger.count} executions
                          </div>
                        </div>
                        <Badge 
                          className={
                            trigger.successRate >= 90 
                              ? 'bg-green-100 text-green-800'
                              : trigger.successRate >= 70
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {Math.round(trigger.successRate)}% success
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Activity Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.recentActivity.map((day, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          {format(new Date(day.date), 'MMM d')}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600">{day.successes} ✓</span>
                          <span className="text-red-600">{day.failures} ✗</span>
                          <span className="text-gray-600">{day.executions} total</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="font-medium text-yellow-800">Optimize Email Workflows</div>
                    <div className="text-sm text-yellow-700">
                      Email workflows have a 23% failure rate. Consider reviewing email templates and delivery settings.
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="font-medium text-blue-800">Peak Usage Times</div>
                    <div className="text-sm text-blue-700">
                      Most workflows trigger between 9-11 AM. Consider load balancing for better performance.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Common Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Email delivery failed</span>
                    <Badge variant="destructive">12 occurrences</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Task assignment failed</span>
                    <Badge variant="destructive">8 occurrences</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">API timeout</span>
                    <Badge variant="destructive">5 occurrences</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ExecutionCardProps {
  execution: AutomationExecution;
}

function ExecutionCard({ execution }: ExecutionCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const StatusIcon = getStatusIcon(execution.status);
  const statusColor = getStatusColor(execution.status);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${statusColor}`}>
              <StatusIcon className="w-4 h-4" />
            </div>
            
            <div>
              <div className="font-medium">{execution.workflowName}</div>
              <div className="text-sm text-gray-600">
                Triggered by {execution.triggeredBy.type} on {execution.triggeredBy.entityName}
              </div>
              <div className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {execution.duration && (
              <span className="text-sm text-gray-600">
                {formatDuration(execution.duration)}
              </span>
            )}
            
            {execution.user && (
              <Avatar className="w-6 h-6">
                <AvatarImage src={execution.user.avatar} />
                <AvatarFallback className="text-xs">
                  {execution.user.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t">
            <div className="space-y-2">
              {execution.steps.map((step, index) => {
                const StepIcon = getStatusIcon(step.status);
                const stepColor = getStatusColor(step.status);
                
                return (
                  <div key={step.stepId} className="flex items-center gap-3 text-sm">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${stepColor}`}>
                      <StepIcon className="w-3 h-3" />
                    </div>
                    <span className="flex-1">{step.action}</span>
                    {step.error && (
                      <span className="text-red-600 text-xs">{step.error}</span>
                    )}
                    {step.completedAt && step.startedAt && (
                      <span className="text-gray-500 text-xs">
                        {formatDuration(
                          (new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
