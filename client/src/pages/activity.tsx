import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Phone, Mail, Calendar, FileText, Search, 
  ArrowUpRight, ArrowDownRight, Clock, User, Building, Home, Handshake, Loader2,
  Activity, MessageSquare, CheckCircle2, Plus, X, TrendingUp, BarChart3, Zap
} from "lucide-react";
import { format, subDays, isAfter, startOfDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Activity = {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'task_created' | 'stage_change' | 'deal_created' | 'lead_activity';
  lead?: { id: string; name: string; status?: string };
  direction: 'inbound' | 'outbound' | 'internal';
  subject: string;
  description?: string;
  date: string;
  user: string;
  contact?: { id: string; name: string };
  company?: { id: string; name: string };
  property?: { id: string; name: string };
  deal?: { id: string; name: string };
};

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export default function ActivityLog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all'); // all | deal | lead | contact | company
  const [showLogForm, setShowLogForm] = useState(false);
  const [newActivity, setNewActivity] = useState({
    subject: '',
    type: 'call' as 'call' | 'email' | 'meeting' | 'note',
    direction: 'outbound' as 'inbound' | 'outbound' | 'internal',
    description: '',
  });

  const { toast } = useToast();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['/api/activities'],
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: typeof newActivity) => {
      return apiRequest('POST', '/api/activities', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: "Activity logged", description: "Your activity has been recorded successfully." });
      setShowLogForm(false);
      setNewActivity({ subject: '', type: 'call', direction: 'outbound', description: '' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log activity. Please try again.", variant: "destructive" });
    },
  });

  const displayActivities = (activities as Activity[]) || [];

  const filteredActivities = displayActivities.filter(activity => {
    const matchesSearch = !searchQuery || 
                         activity.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activity.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activity.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activity.company?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || activity.type === typeFilter;
    const matchesDirection = directionFilter === 'all' || activity.direction === directionFilter;

    let matchesDate = true;
    if (dateRangeFilter !== 'all') {
      const activityDate = new Date(activity.date);
      const now = new Date();
      if (dateRangeFilter === 'today') {
        matchesDate = isAfter(activityDate, startOfDay(now));
      } else if (dateRangeFilter === 'week') {
        matchesDate = isAfter(activityDate, subDays(now, 7));
      } else if (dateRangeFilter === 'month') {
        matchesDate = isAfter(activityDate, subDays(now, 30));
      }
    }

    // Entity filter: all | deal | lead | contact | company
    let matchesEntity = true;
    if (entityFilter === 'deal') matchesEntity = !!activity.deal;
    else if (entityFilter === 'lead') matchesEntity = !!(activity as any).lead;
    else if (entityFilter === 'contact') matchesEntity = !!activity.contact && !activity.deal;
    else if (entityFilter === 'company') matchesEntity = !!activity.company && !activity.deal;

    return matchesSearch && matchesType && matchesDirection && matchesDate && matchesEntity;
  });

  const kpiStats = useMemo(() => {
    const total = displayActivities.length;
    const calls = displayActivities.filter(a => a.type === 'call').length;
    const emails = displayActivities.filter(a => a.type === 'email').length;
    const meetings = displayActivities.filter(a => a.type === 'meeting').length;
    const notes = displayActivities.filter(a => a.type === 'note' || a.type === 'task_created').length;
    return { total, calls, emails, meetings, notes };
  }, [displayActivities]);

  const trendStats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const thisWeekCount = displayActivities.filter(a => isAfter(new Date(a.date), sevenDaysAgo)).length;

    const total = displayActivities.length;
    const inboundCount = displayActivities.filter(a => a.direction === 'inbound').length;
    const responseRate = total > 0 ? Math.round((inboundCount / total) * 100) : 0;

    const typeCounts: Record<string, number> = {};
    displayActivities.forEach(a => {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    });
    let mostActiveType = 'None';
    let maxCount = 0;
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveType = type;
      }
    });

    return { thisWeekCount, responseRate, mostActiveType };
  }, [displayActivities]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      case 'task_created': return <CheckCircle2 className="w-4 h-4" />;
      case 'stage_change': return <ArrowUpRight className="w-4 h-4" />;
      case 'deal_created': return <Handshake className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-100 text-blue-600';
      case 'email': return 'bg-green-100 text-green-600';
      case 'meeting': return 'bg-purple-100 text-purple-600';
      case 'note': return 'bg-yellow-100 text-yellow-600';
      case 'task_created': return 'bg-indigo-100 text-indigo-600';
      case 'stage_change': return 'bg-orange-100 text-orange-600';
      case 'deal_created': return 'bg-teal-100 text-teal-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'outbound': return <ArrowUpRight className="w-3 h-3 text-blue-500" />;
      case 'inbound': return <ArrowDownRight className="w-3 h-3 text-green-500" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'task_created': return 'Task';
      case 'stage_change': return 'Stage Change';
      case 'deal_created': return 'Deal Created';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const handleSubmitActivity = () => {
    if (!newActivity.subject.trim()) {
      toast({ title: "Required", description: "Subject is required.", variant: "destructive" });
      return;
    }
    createActivityMutation.mutate(newActivity);
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Activity Log</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track all interactions across contacts, deals, and properties</p>
            </div>
          </div>
          <Button data-testid="button-log-activity" onClick={() => setShowLogForm(!showLogForm)}>
            {showLogForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showLogForm ? 'Cancel' : 'Log Activity'}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => <KpiSkeleton key={i} />)}
            </div>
            <Card><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{kpiStats.total}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{kpiStats.calls}</div>
                      <div className="text-xs text-gray-500">Calls</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{kpiStats.emails}</div>
                      <div className="text-xs text-gray-500">Emails</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{kpiStats.meetings}</div>
                      <div className="text-xs text-gray-500">Meetings</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{kpiStats.notes}</div>
                      <div className="text-xs text-gray-500">Notes</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{trendStats.thisWeekCount}</div>
                      <div className="text-xs text-gray-500">This Week</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{trendStats.responseRate}%</div>
                      <div className="text-xs text-gray-500">Response Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{getTypeLabel(trendStats.mostActiveType)}</div>
                      <div className="text-xs text-gray-500">Most Active Type</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white mb-6">
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search activities..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-activities"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-36" data-testid="select-type-filter">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="call">Calls</SelectItem>
                      <SelectItem value="email">Emails</SelectItem>
                      <SelectItem value="meeting">Meetings</SelectItem>
                      <SelectItem value="note">Notes</SelectItem>
                      <SelectItem value="task_created">Tasks</SelectItem>
                      <SelectItem value="stage_change">Stage Changes</SelectItem>
                      <SelectItem value="deal_created">Deals Created</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={directionFilter} onValueChange={setDirectionFilter}>
                    <SelectTrigger className="w-36" data-testid="select-direction-filter">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                    <SelectTrigger className="w-36" data-testid="select-date-filter">
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {showLogForm && (
                <Card className="bg-white border-2 border-indigo-200 shadow-md">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Log New Activity
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="activity-subject">Subject *</Label>
                        <Input
                          id="activity-subject"
                          placeholder="Enter activity subject..."
                          value={newActivity.subject}
                          onChange={(e) => setNewActivity(prev => ({ ...prev, subject: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="activity-type">Type</Label>
                        <Select value={newActivity.type} onValueChange={(val) => setNewActivity(prev => ({ ...prev, type: val as any }))}>
                          <SelectTrigger className="mt-1" id="activity-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call">Call</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="meeting">Meeting</SelectItem>
                            <SelectItem value="note">Note</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="activity-direction">Direction</Label>
                        <Select value={newActivity.direction} onValueChange={(val) => setNewActivity(prev => ({ ...prev, direction: val as any }))}>
                          <SelectTrigger className="mt-1" id="activity-direction">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inbound">Inbound</SelectItem>
                            <SelectItem value="outbound">Outbound</SelectItem>
                            <SelectItem value="internal">Internal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="activity-description">Description</Label>
                        <Textarea
                          id="activity-description"
                          placeholder="Optional description..."
                          value={newActivity.description}
                          onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowLogForm(false)}>Cancel</Button>
                        <Button onClick={handleSubmitActivity} disabled={createActivityMutation.isPending}>
                          {createActivityMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Log Activity
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {filteredActivities.map((activity) => (
                <Card key={activity.id} className="bg-white hover:shadow-md transition-shadow" data-testid={`activity-card-${activity.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getTypeColor(activity.type)}`}>
                        {getTypeIcon(activity.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">{activity.subject}</h3>
                          {getDirectionIcon(activity.direction)}
                        </div>
                        
                        {activity.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{activity.description}</p>
                        )}
                        
                        <div className="flex items-center flex-wrap gap-2 text-xs">
                          <span className="text-gray-500">
                            {format(new Date(activity.date), 'MM/dd/yyyy h:mm a')}
                          </span>
                          <span className="text-gray-300">&bull;</span>
                          <span className="text-gray-500">{activity.user}</span>
                          
                          {activity.contact && (
                            <>
                              <span className="text-gray-300">&bull;</span>
                              <Link href={`/crm/contacts/${activity.contact.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors">
                                  <User className="w-3 h-3 mr-1" />
                                  {activity.contact.name}
                                </Badge>
                              </Link>
                            </>
                          )}
                          
                          {activity.company && (
                            <Link href={`/crm/companies/${activity.company.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors">
                                <Building className="w-3 h-3 mr-1" />
                                {activity.company.name}
                              </Badge>
                            </Link>
                          )}
                          
                          {activity.property && (
                            <Link href={`/crm/properties/${activity.property.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors">
                                <Home className="w-3 h-3 mr-1" />
                                {activity.property.name}
                              </Badge>
                            </Link>
                          )}
                          
                          {(activity as any).lead && (
                            <Link href={`/crm/leads/${(activity as any).lead.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 hover:bg-purple-50 cursor-pointer gap-1">
                                <TrendingUp className="h-2.5 w-2.5 text-purple-600" />
                                Lead: {(activity as any).lead.name}
                              </Badge>
                            </Link>
                          )}
                          {activity.deal && (
                            <Link href={`/crm/deals/${activity.deal.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors">
                                <Handshake className="w-3 h-3 mr-1" />
                                {activity.deal.name}
                              </Badge>
                            </Link>
                          )}
                        </div>
                      </div>
                      
                      <Badge className={`flex-shrink-0 ${getTypeColor(activity.type)}`}>
                        {getTypeLabel(activity.type)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredActivities.length === 0 && (
              <Card className="mt-6">
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No activities found</h3>
                    <p className="text-gray-500 mt-1">
                      {searchQuery || typeFilter !== 'all' || directionFilter !== 'all' || dateRangeFilter !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'Activities from deals, contacts, and pipeline changes will appear here'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
