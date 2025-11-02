import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { websocketManager } from '@/lib/websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Flame, 
  Snowflake, 
  Thermometer,
  Settings,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Target,
  Activity,
  BarChart3,
  Crown,
  Ship,
  Clock,
  DollarSign
} from 'lucide-react';

const COLORS = {
  hot: '#ef4444',
  warm: '#f97316', 
  cold: '#6b7280'
};

const scoringRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  triggerEvent: z.string().min(1, 'Trigger event is required'),
  points: z.number().min(-100).max(100),
  conditions: z.any().optional(),
  isActive: z.boolean().default(true),
});

type ScoringRuleForm = z.infer<typeof scoringRuleSchema>;

export default function ScoringDashboard() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    const handleScoreUpdate = (data: any) => {
      toast({
        title: 'Lead Score Updated',
        description: `Lead score changed by ${data.scoreChange > 0 ? '+' : ''}${data.scoreChange} points (${data.temperature})`,
        duration: 3000,
      });
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/leads/scoring/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads/scoring/top-leads'] });
    };

    const handleMarinaDataUpdate = (data: any) => {
      toast({
        title: 'Marina Data Updated',
        description: `Lead data updated - new score: ${data.newScore} (${data.temperature})`,
        duration: 3000,
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/leads/scoring/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads/scoring/top-leads'] });
    };

    const handleScoringRuleUpdates = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads/scoring/rules'] });
    };

    // Subscribe to WebSocket events
    websocketManager.subscribe('lead_score_updated', handleScoreUpdate);
    websocketManager.subscribe('marina_data_updated', handleMarinaDataUpdate);
    websocketManager.subscribe('scoring_rule_created', handleScoringRuleUpdates);
    websocketManager.subscribe('scoring_rule_updated', handleScoringRuleUpdates);
    websocketManager.subscribe('scoring_rule_deleted', handleScoringRuleUpdates);

    // Cleanup on unmount
    return () => {
      websocketManager.unsubscribe('lead_score_updated', handleScoreUpdate);
      websocketManager.unsubscribe('marina_data_updated', handleMarinaDataUpdate);
      websocketManager.unsubscribe('scoring_rule_created', handleScoringRuleUpdates);
      websocketManager.unsubscribe('scoring_rule_updated', handleScoringRuleUpdates);
      websocketManager.unsubscribe('scoring_rule_deleted', handleScoringRuleUpdates);
    };
  }, [toast]);

  // Fetch scoring analytics
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['/api/leads/scoring/analytics'],
  });

  // Fetch top leads
  const { data: topLeads, isLoading: topLeadsLoading } = useQuery({
    queryKey: ['/api/leads/scoring/top-leads'],
  });

  // Fetch scoring rules
  const { data: scoringRules, isLoading: rulesLoading } = useQuery({
    queryKey: ['/api/leads/scoring/rules'],
  });

  // Create scoring rule mutation
  const createRuleMutation = useMutation({
    mutationFn: (data: ScoringRuleForm) => apiRequest('POST', '/api/leads/scoring/rules', data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scoring rule created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/leads/scoring/rules'] });
      setIsRuleDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update scoring rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<ScoringRuleForm> }) => 
      apiRequest('PUT', `/api/leads/scoring/rules/${id}`, data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scoring rule updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/leads/scoring/rules'] });
      setIsRuleDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete scoring rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/leads/scoring/rules/${id}`),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scoring rule deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/leads/scoring/rules'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Apply score decay mutation
  const applyDecayMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/leads/scoring/decay'),
    onSuccess: (data) => {
      toast({ 
        title: 'Score Decay Applied', 
        description: `Updated ${data.updated} leads with total decay of ${data.totalDecayApplied} points` 
      });
      refetchAnalytics();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const form = useForm<ScoringRuleForm>({
    resolver: zodResolver(scoringRuleSchema),
    defaultValues: {
      name: '',
      description: '',
      triggerEvent: '',
      points: 5,
      isActive: true,
    },
  });

  const onSubmit = (data: ScoringRuleForm) => {
    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, data });
    } else {
      createRuleMutation.mutate(data);
    }
  };

  const openEditDialog = (rule: any) => {
    setEditingRule(rule);
    form.reset({
      name: rule.name,
      description: rule.description || '',
      triggerEvent: rule.triggerEvent,
      points: rule.points,
      isActive: rule.isActive,
    });
    setIsRuleDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    form.reset({
      name: '',
      description: '',
      triggerEvent: '',
      points: 5,
      isActive: true,
    });
    setIsRuleDialogOpen(true);
  };

  // Prepare chart data
  const temperatureData = analytics?.distribution ? [
    { name: 'Hot Leads', value: analytics.distribution.hot, color: COLORS.hot },
    { name: 'Warm Leads', value: analytics.distribution.warm, color: COLORS.warm },
    { name: 'Cold Leads', value: analytics.distribution.cold, color: COLORS.cold },
  ] : [];

  const scoreDistributionData = [
    { range: '0-20', count: 0 },
    { range: '21-40', count: 0 },
    { range: '41-60', count: 0 },
    { range: '61-80', count: 0 },
    { range: '81-100', count: 0 },
  ];

  // Simulate score distribution for visualization
  if (topLeads) {
    topLeads.forEach((lead: any) => {
      const score = lead.score || 0;
      if (score <= 20) scoreDistributionData[0].count++;
      else if (score <= 40) scoreDistributionData[1].count++;
      else if (score <= 60) scoreDistributionData[2].count++;
      else if (score <= 80) scoreDistributionData[3].count++;
      else scoreDistributionData[4].count++;
    });
  }

  if (analyticsLoading || topLeadsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading scoring analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 bg-gray-50" data-testid="scoring-dashboard">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="text-dashboard-title">Lead Scoring Dashboard</h1>
          <p className="text-gray-600">Monitor and optimize your lead scoring system</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => applyDecayMutation.mutate()}
            disabled={applyDecayMutation.isPending}
            data-testid="button-apply-decay"
          >
            <Clock className="h-4 w-4 mr-2" />
            Apply Decay
          </Button>
          <Button 
            onClick={refetchAnalytics}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="top-leads" data-testid="tab-top-leads">Top Leads</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Scoring Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1">
          <div className="grid gap-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card data-testid="card-total-leads">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-leads">
                    {analytics?.distribution?.totalLeads || 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-hot-leads">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
                  <Flame className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-hot-leads">
                    {analytics?.distribution?.hot || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Score ≥ 80
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-warm-leads">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Warm Leads</CardTitle>
                  <Thermometer className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600" data-testid="text-warm-leads">
                    {analytics?.distribution?.warm || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Score 50-79
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-average-score">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <Target className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-average-score">
                    {Math.round(analytics?.distribution?.averageScore || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Out of 100
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-temperature-distribution">
                <CardHeader>
                  <CardTitle>Lead Temperature Distribution</CardTitle>
                  <CardDescription>Breakdown of leads by temperature</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={temperatureData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {temperatureData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card data-testid="card-score-distribution">
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                  <CardDescription>Number of leads in each score range</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={scoreDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="top-leads" className="flex-1">
          <Card data-testid="card-top-leads">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Crown className="h-5 w-5 mr-2 text-yellow-500" />
                Top Scoring Leads
              </CardTitle>
              <CardDescription>Highest priority leads for immediate follow-up</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topLeads?.slice(0, 10).map((lead: any, index: number) => (
                  <div key={lead.id} className="flex items-center space-x-4 p-4 border rounded-lg" data-testid={`row-lead-${lead.id}`}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium" data-testid={`text-lead-name-${lead.id}`}>
                          {lead.firstName} {lead.lastName}
                        </h3>
                        <Badge 
                          variant={lead.temperature === 'hot' ? 'destructive' : lead.temperature === 'warm' ? 'default' : 'secondary'}
                          data-testid={`badge-temperature-${lead.id}`}
                        >
                          {lead.temperature}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600" data-testid={`text-lead-email-${lead.id}`}>{lead.email}</p>
                      {lead.company && (
                        <p className="text-sm text-gray-500" data-testid={`text-lead-company-${lead.id}`}>{lead.company}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" data-testid={`text-lead-score-${lead.id}`}>{lead.score || 0}</div>
                      <div className="text-sm text-gray-500">points</div>
                    </div>
                    <div className="w-32">
                      <Progress value={Math.min((lead.score || 0), 100)} className="h-2" />
                    </div>
                    {lead.engagementMetrics && (
                      <div className="text-xs text-gray-500">
                        <div>Activity: {lead.engagementMetrics.activityLevel}</div>
                        <div>Last: {lead.engagementMetrics.daysSinceLastActivity}d ago</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="flex-1">
          <div className="grid gap-6">
            <Card data-testid="card-marina-insights">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Ship className="h-5 w-5 mr-2 text-blue-500" />
                  Marina Industry Insights
                </CardTitle>
                <CardDescription>Industry-specific scoring analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {topLeads?.filter((lead: any) => lead.score > 70).length || 0}
                    </div>
                    <div className="text-sm text-gray-600">High Purchase Intent</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {topLeads?.filter((lead: any) => lead.engagementMetrics?.activityLevel === 'high').length || 0}
                    </div>
                    <div className="text-sm text-gray-600">High Activity Leads</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {topLeads?.filter((lead: any) => lead.score > 50 && lead.temperature !== 'cold').length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Ready for Contact</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-scoring-configuration">
              <CardHeader>
                <CardTitle>Scoring Configuration</CardTitle>
                <CardDescription>Current scoring thresholds and settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Temperature Thresholds</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Hot Leads:</span>
                        <span className="font-medium text-red-600">≥ 80 points</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Warm Leads:</span>
                        <span className="font-medium text-orange-600">50-79 points</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cold Leads:</span>
                        <span className="font-medium text-gray-600">&lt; 50 points</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Decay Settings</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Decay Rate:</span>
                        <span className="font-medium">2 points/week</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Trigger After:</span>
                        <span className="font-medium">30 days inactive</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="font-medium text-green-600">Enabled</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="flex-1">
          <Card data-testid="card-scoring-rules">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Scoring Rules
                  </CardTitle>
                  <CardDescription>Configure and manage lead scoring rules</CardDescription>
                </div>
                <Button onClick={openCreateDialog} data-testid="button-create-rule">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scoringRules?.map((rule: any) => (
                  <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`row-rule-${rule.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</h3>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'} data-testid={`badge-rule-status-${rule.id}`}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600" data-testid={`text-rule-description-${rule.id}`}>
                        {rule.description || 'No description'}
                      </p>
                      <div className="text-xs text-gray-500 mt-1">
                        Trigger: {rule.triggerEvent} | Points: {rule.points > 0 ? '+' : ''}{rule.points}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(rule)}
                        data-testid={`button-edit-rule-${rule.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                        disabled={deleteRuleMutation.isPending}
                        data-testid={`button-delete-rule-${rule.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Scoring Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" data-testid="dialog-scoring-rule">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingRule ? 'Edit Scoring Rule' : 'Create Scoring Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure a rule that automatically assigns points based on lead behavior.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Email Opened" {...field} data-testid="input-rule-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional description" {...field} data-testid="input-rule-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="triggerEvent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger Event</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-trigger-event">
                          <SelectValue placeholder="Select trigger event" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email_opened">Email Opened</SelectItem>
                        <SelectItem value="email_clicked">Email Clicked</SelectItem>
                        <SelectItem value="page_visited">Page Visited</SelectItem>
                        <SelectItem value="form_submitted">Form Submitted</SelectItem>
                        <SelectItem value="boat_interest">Boat Interest Expressed</SelectItem>
                        <SelectItem value="marina_service_inquiry">Marina Service Inquiry</SelectItem>
                        <SelectItem value="price_quote_requested">Price Quote Requested</SelectItem>
                        <SelectItem value="demo_scheduled">Demo Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Points</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="-100" 
                        max="100" 
                        placeholder="5" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-rule-points"
                      />
                    </FormControl>
                    <FormDescription>
                      Positive points increase score, negative points decrease it
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active Rule</FormLabel>
                      <FormDescription>
                        When enabled, this rule will automatically score leads
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-rule-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsRuleDialogOpen(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
                  data-testid="button-save-rule"
                >
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}