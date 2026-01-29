import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, Building, DollarSign, TrendingUp, Phone, Mail, Calendar, 
  ArrowRight, Sparkles, Home, Clock, CheckCircle2, AlertCircle,
  Layers, Activity, MapPin, MessageSquare, StickyNote, Info
} from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { FeatureChecklist } from "@/components/ui/_primitives/feature-highlight";
import { formatDistanceToNow, isToday, parseISO, isBefore, startOfDay } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PIPELINE_STAGES = [
  { key: "initial_contact", label: "Initial Contact", color: "bg-slate-500" },
  { key: "qualification", label: "Qualification", color: "bg-blue-500" },
  { key: "proposal", label: "Proposal", color: "bg-purple-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-amber-500" },
  { key: "due_diligence", label: "Due Diligence", color: "bg-cyan-500" },
  { key: "closed_won", label: "Closed Won", color: "bg-green-500" },
  { key: "closed_lost", label: "Closed Lost", color: "bg-red-500" },
];

const AVATAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", 
  "bg-teal-500", "bg-pink-500", "bg-indigo-500", "bg-amber-500"
];

const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (name: string): string => {
  if (!name) return AVATAR_COLORS[0];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};

export default function CRMDashboard() {
  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ['/api/crm/deals'],
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/crm/leads'],
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/crm/contacts'],
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['/api/crm/companies'],
  });

  const { data: propertiesData, isLoading: propertiesLoading } = useQuery({
    queryKey: ['/api/crm/properties'],
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/crm/activities'],
  });

  const deals = Array.isArray(dealsData) ? dealsData : (dealsData?.deals || dealsData?.data || []);
  const leads = Array.isArray(leadsData) ? leadsData : (leadsData?.leads || leadsData?.data || []);
  const contacts = Array.isArray(contactsData) ? contactsData : (contactsData?.contacts || contactsData?.data || []);
  const companies = Array.isArray(companiesData) ? companiesData : (companiesData?.companies || companiesData?.data || []);
  const properties = Array.isArray(propertiesData) ? propertiesData : (propertiesData?.properties || propertiesData?.data || []);
  const activities = Array.isArray(activitiesData) ? activitiesData : (activitiesData?.activities || activitiesData?.data || []);

  const safeDeals = Array.isArray(deals) ? deals : [];
  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeActivities = Array.isArray(activities) ? activities : [];

  const totalDealValue = safeDeals.reduce((sum: number, deal: any) => {
    const value = parseFloat(deal.value || deal.amount || '0');
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const pipelineByStage = PIPELINE_STAGES.map(stage => {
    const stageDeals = safeDeals.filter((d: any) => d.stage === stage.key);
    const stageValue = stageDeals.reduce((sum: number, d: any) => {
      const value = parseFloat(d.value || d.amount || '0');
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    return {
      ...stage,
      count: stageDeals.length,
      value: stageValue,
    };
  }).filter(s => s.key !== 'closed_lost');

  const activeDealsValue = safeDeals
    .filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .reduce((sum: number, deal: any) => {
      const value = parseFloat(deal.value || deal.amount || '0');
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

  const stats = [
    {
      title: "Total Deals",
      value: safeDeals.length,
      icon: DollarSign,
      description: `${formatCurrency(totalDealValue)} total value`,
      link: "/crm/deals",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Active Leads",
      value: safeLeads.filter((l: any) => l.leadStatus !== 'converted' && l.leadStatus !== 'unqualified').length,
      icon: TrendingUp,
      description: `${safeLeads.length} total leads`,
      link: "/crm/leads",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Contacts",
      value: safeContacts.length,
      icon: Users,
      description: "Active contacts",
      link: "/crm/contacts",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Companies",
      value: safeCompanies.length,
      icon: Building,
      description: "Active companies",
      link: "/crm/companies",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Properties",
      value: safeProperties.length,
      icon: Home,
      description: "Marina properties tracked",
      link: "/crm/properties",
      color: "text-teal-600",
      bgColor: "bg-teal-100",
    },
  ];

  const recentActivities = safeActivities
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 6);

  // Today's follow-ups - activities due today or with type 'follow_up' scheduled for today
  const todaysFollowUps = safeActivities.filter((a: any) => {
    if (!a.dueDate) return false;
    try {
      const dueDate = new Date(a.dueDate);
      return isToday(dueDate) && a.type !== 'meeting';
    } catch { return false; }
  });

  // Today's meetings
  const todaysMeetings = safeActivities.filter((a: any) => {
    if (!a.dueDate && !a.scheduledAt) return false;
    try {
      const date = new Date(a.scheduledAt || a.dueDate);
      return isToday(date) && a.type === 'meeting';
    } catch { return false; }
  });

  // Overdue items - activities past due
  const overdueItems = safeActivities.filter((a: any) => {
    if (!a.dueDate || a.completed) return false;
    try {
      const dueDate = new Date(a.dueDate);
      return isBefore(dueDate, startOfDay(new Date()));
    } catch { return false; }
  });

  // Deals needing attention - stale deals (no activity in 7+ days) or deals in negotiation stage
  const needsAttentionDeals = safeDeals.filter((d: any) => {
    if (d.stage === 'closed_won' || d.stage === 'closed_lost') return false;
    // Check for stale deals
    if (d.updatedAt) {
      const daysSinceUpdate = Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate >= 7) return true;
    }
    // Deals in negotiation or due_diligence stages
    return d.stage === 'negotiation' || d.stage === 'due_diligence';
  }).slice(0, 5);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4 text-blue-600" />;
      case 'email': return <Mail className="w-4 h-4 text-purple-600" />;
      case 'meeting': return <Calendar className="w-4 h-4 text-green-600" />;
      case 'task': return <CheckCircle2 className="w-4 h-4 text-amber-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your marina acquisition pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm/deals">
            <Button data-testid="button-new-deal">
              <DollarSign className="w-4 h-4 mr-2" />
              New Deal
            </Button>
          </Link>
          <Link href="/crm/leads">
            <Button variant="outline" data-testid="button-new-lead">
              <TrendingUp className="w-4 h-4 mr-2" />
              New Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isLoading = dealsLoading || leadsLoading || contactsLoading || companiesLoading || propertiesLoading;
          return (
            <Link key={stat.title} href={stat.link}>
              <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group border-2 hover:border-primary/20" data-testid={`card-stat-${stat.title.toLowerCase().replace(' ', '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid={`text-${stat.title.toLowerCase().replace(' ', '-')}-count`}>
                    {isLoading ? "..." : stat.value}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Today's Activity Cards - Hostaway Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Follow-ups */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Today's Follow-ups
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Activities and tasks due today</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </div>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Current
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-1">{todaysFollowUps.length}</div>
            <p className="text-sm text-muted-foreground mb-4">Follow-ups due today</p>
            
            {activitiesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : todaysFollowUps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No follow-ups scheduled for today</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {todaysFollowUps.slice(0, 5).map((activity: any) => (
                  <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(activity.contactName || activity.subject || '')} flex items-center justify-center text-white text-xs font-medium`}>
                      {getInitials(activity.contactName || activity.subject || 'Task')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.subject || activity.type}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.contactName || 'No contact assigned'}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Phone className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Mail className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Meetings */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Today's Meetings
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Meetings scheduled for today</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Current
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-1">{todaysMeetings.length}</div>
            <p className="text-sm text-muted-foreground mb-4">Meetings today</p>
            
            {activitiesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : todaysMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No meetings scheduled for today</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {todaysMeetings.slice(0, 5).map((meeting: any) => (
                  <div key={meeting.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(meeting.contactName || meeting.subject || '')} flex items-center justify-center text-white text-xs font-medium`}>
                      {getInitials(meeting.contactName || meeting.subject || 'M')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{meeting.subject || 'Meeting'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {meeting.dueDate ? new Date(meeting.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} 
                        {meeting.contactName ? ` • ${meeting.contactName}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Calendar className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Needs Attention Section */}
      {(needsAttentionDeals.length > 0 || overdueItems.length > 0) && (
        <Card className="border-2 border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-base">Needs Attention</CardTitle>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  {needsAttentionDeals.length + overdueItems.length}
                </Badge>
              </div>
              <Link href="/crm/deals">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Overdue Activities */}
              {overdueItems.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-2">Overdue Tasks ({overdueItems.length})</p>
                  <div className="space-y-2">
                    {overdueItems.slice(0, 3).map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm p-2 bg-white dark:bg-gray-900 rounded border">
                        <div className={`w-6 h-6 rounded-full ${getAvatarColor(item.contactName || '')} flex items-center justify-center text-white text-xs`}>
                          {getInitials(item.contactName || 'T')}
                        </div>
                        <span className="truncate flex-1">{item.subject || item.type}</span>
                        <Badge variant="destructive" className="text-xs">Overdue</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Stale Deals */}
              {needsAttentionDeals.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-2">Deals Requiring Action ({needsAttentionDeals.length})</p>
                  <div className="space-y-2">
                    {needsAttentionDeals.slice(0, 3).map((deal: any) => {
                      const stageInfo = PIPELINE_STAGES.find(s => s.key === deal.stage);
                      return (
                        <div key={deal.id} className="flex items-center gap-2 text-sm p-2 bg-white dark:bg-gray-900 rounded border">
                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(deal.title)} flex items-center justify-center text-white text-xs`}>
                            {getInitials(deal.title)}
                          </div>
                          <span className="truncate flex-1">{deal.title}</span>
                          <Badge variant="secondary" className={`text-xs text-white ${stageInfo?.color || 'bg-gray-500'}`}>
                            {stageInfo?.label || deal.stage}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Summary */}
      <Card data-testid="card-pipeline-summary">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Pipeline Summary
              </CardTitle>
              <CardDescription>
                {formatCurrency(activeDealsValue)} in active pipeline
              </CardDescription>
            </div>
            <Link href="/crm/pipeline">
              <Button variant="ghost" size="sm" data-testid="button-view-pipeline">
                View Pipeline
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {dealsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {pipelineByStage.map((stage) => {
                const percentage = totalDealValue > 0 ? (stage.value / totalDealValue) * 100 : 0;
                return (
                  <div key={stage.key} className="flex items-center gap-4">
                    <div className="w-28 flex-shrink-0">
                      <span className="text-sm font-medium">{stage.label}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${stage.color} transition-all duration-500`}
                            style={{ width: `${Math.max(percentage, stage.count > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="min-w-[40px] justify-center">
                          {stage.count}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm text-muted-foreground">
                      {formatCurrency(stage.value)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deals */}
        <Card data-testid="card-recent-deals">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Recent Deals</CardTitle>
                <CardDescription>Latest opportunities in your pipeline</CardDescription>
              </div>
              <Link href="/crm/deals">
                <Button variant="ghost" size="sm" data-testid="button-view-all-deals">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {dealsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : safeDeals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No deals yet. Create your first deal to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {safeDeals.slice(0, 4).map((deal: any) => {
                  const stageInfo = PIPELINE_STAGES.find(s => s.key === deal.stage);
                  return (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                      data-testid={`row-deal-${deal.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate" data-testid={`text-deal-title-${deal.id}`}>
                          {deal.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs text-white ${stageInfo?.color || 'bg-gray-500'}`}
                          >
                            {stageInfo?.label || deal.stage}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold" data-testid={`text-deal-value-${deal.id}`}>
                          {formatCurrency(parseFloat(deal.value || deal.amount || 0))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card data-testid="card-recent-activity">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest CRM interactions</CardDescription>
              </div>
              <Link href="/crm/activities">
                <Button variant="ghost" size="sm" data-testid="button-view-all-activities">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No activities recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity: any) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-full ${getAvatarColor(activity.contactName || activity.subject || '')} flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}>
                      {getInitials(activity.contactName || activity.subject || 'A')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.subject || activity.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.createdAt 
                          ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })
                          : 'Recently'}
                        {activity.contactName ? ` • ${activity.contactName}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Call">
                        <Phone className="w-3.5 h-3.5 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Email">
                        <Mail className="w-3.5 h-3.5 text-purple-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Add Note">
                        <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Properties Overview */}
      <Card data-testid="card-properties-overview">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5 text-teal-600" />
                Properties Overview
              </CardTitle>
              <CardDescription>Marina properties in your portfolio</CardDescription>
            </div>
            <Link href="/crm/properties">
              <Button variant="ghost" size="sm" data-testid="button-view-all-properties">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {propertiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : safeProperties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Home className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No properties tracked yet</p>
              <Link href="/crm/properties">
                <Button variant="link" size="sm" className="mt-2">
                  Add your first property
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {safeProperties.slice(0, 6).map((property: any) => (
                <div
                  key={property.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <h4 className="font-medium truncate">{property.title}</h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">
                      {property.address || property.city || 'No address'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {property.status?.replace('_', ' ') || 'Available'}
                    </Badge>
                    {property.listingPrice && (
                      <span className="text-sm font-medium text-green-600">
                        {formatCurrency(parseFloat(property.listingPrice))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card data-testid="card-quick-actions" className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common CRM tasks</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30 transition-all group" data-testid="button-log-call">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 mr-3 group-hover:scale-110 transition-transform">
                  <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Log a Call</div>
                  <div className="text-xs text-muted-foreground">Track conversations</div>
                </div>
              </Button>
            </Link>
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30 transition-all group" data-testid="button-send-email">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 mr-3 group-hover:scale-110 transition-transform">
                  <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Send Email</div>
                  <div className="text-xs text-muted-foreground">Compose message</div>
                </div>
              </Button>
            </Link>
            <Link href="/crm/activities">
              <Button variant="outline" className="w-full justify-start h-auto py-4 hover:bg-primary/5 hover:border-primary/30 transition-all group" data-testid="button-schedule-meeting">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 mr-3 group-hover:scale-110 transition-transform">
                  <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Schedule Meeting</div>
                  <div className="text-xs text-muted-foreground">Set up a call</div>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Platform Capabilities */}
      <Card className="bg-gradient-to-br from-primary/5 via-white to-teal-50/30 dark:from-primary/10 dark:via-gray-900 dark:to-teal-950/20 border-2 border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg">MarinaMatch CRM Includes:</CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureChecklist
            items={[
              { text: "Deal Pipeline Management" },
              { text: "Lead Tracking & Qualification" },
              { text: "Contact & Company Database" },
              { text: "Activity Logging & History" },
              { text: "Email Sequence Automation" },
              { text: "Due Diligence Integration" },
            ]}
            columns={3}
            variant="accent"
          />
        </CardContent>
      </Card>
    </div>
  );
}
