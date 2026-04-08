import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Phone, Mail, Calendar, FileText, Search,
  ArrowUpRight, ArrowDownRight, Clock, User, Building, Home, Handshake, Loader2,
  Activity, CheckCircle2, Plus, X, TrendingUp, BarChart3, Zap,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ActivityItem = {
  id: string;
  type: string;
  direction: string;
  subject: string;
  description?: string;
  date: string;
  user: string;
  userId?: string;
  entityType?: string;
  lead?: { id: string; name: string };
  contact?: { id: string; name: string };
  company?: { id: string; name: string };
  property?: { id: string; name: string };
  deal?: { id: string; name: string };
};

type ActorOption = { id: string; name: string };

type ActivitiesResponse = {
  items: ActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  actors: ActorOption[];
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

function RelativeTimestamp({ date }: { date: string }) {
  const d = new Date(date);
  const absolute = format(d, 'MMM d, yyyy h:mm a');

  let relative: string;
  if (isToday(d)) {
    relative = formatDistanceToNow(d, { addSuffix: true });
  } else if (isYesterday(d)) {
    relative = `Yesterday at ${format(d, 'h:mm a')}`;
  } else {
    relative = format(d, 'MMM d, yyyy');
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-gray-500 cursor-default">{relative}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{absolute}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


export default function ActivityLog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showLogForm, setShowLogForm] = useState(false);
  const [newActivity, setNewActivity] = useState({
    subject: '',
    type: 'call' as 'call' | 'email' | 'meeting' | 'note',
    direction: 'outbound' as 'inbound' | 'outbound' | 'internal',
    description: '',
  });

  const { toast } = useToast();

  // Debounce search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '25');
  if (typeFilter !== 'all') queryParams.set('type', typeFilter);
  if (entityFilter !== 'all') queryParams.set('entityType', entityFilter);
  if (actorFilter !== 'all') queryParams.set('actorId', actorFilter);
  if (dateRangeFilter !== 'all') queryParams.set('dateRange', dateRangeFilter);
  if (debouncedSearch) queryParams.set('q', debouncedSearch);

  const { data, isLoading } = useQuery<ActivitiesResponse>({
    queryKey: ['/api/activities', page, typeFilter, entityFilter, actorFilter, dateRangeFilter, debouncedSearch],
    queryFn: () => fetch(`/api/activities?${queryParams.toString()}`, { credentials: 'include' }).then(r => r.json()),
  });

  const items = data?.items || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;
  const actors = data?.actors || [];

  const createActivityMutation = useMutation({
    mutationFn: async (actData: typeof newActivity) => {
      return apiRequest('POST', '/api/activities', actData);
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

  const kpiStats = useMemo(() => {
    const calls = items.filter(a => a.type === 'call').length;
    const emails = items.filter(a => a.type === 'email').length;
    const meetings = items.filter(a => a.type === 'meeting').length;
    const notes = items.filter(a => a.type === 'note' || a.type === 'task_created').length;
    return { total, calls, emails, meetings, notes };
  }, [items, total]);

  const trendStats = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    items.forEach(a => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });
    let mostActiveType = 'None';
    let maxCount = 0;
    Object.entries(typeCounts).forEach(([t, count]) => {
      if (count > maxCount) { maxCount = count; mostActiveType = t; }
    });
    return { mostActiveType };
  }, [items]);

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
      case 'site_visit': return 'Site Visit';
      case 'follow_up': return 'Follow Up';
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

  const resetFilters = () => {
    setTypeFilter('all');
    setEntityFilter('all');
    setActorFilter('all');
    setDateRangeFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
  };

  const hasActiveFilters = typeFilter !== 'all' || entityFilter !== 'all' || actorFilter !== 'all' || dateRangeFilter !== 'all' || debouncedSearch;

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

        {isLoading && !data ? (
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
            {/* KPI Row */}
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

            {/* Trend Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{total}</div>
                      <div className="text-xs text-gray-500">{hasActiveFilters ? 'Matching' : 'All Time'}</div>
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
                      <div className="text-lg font-semibold text-gray-900">{totalPages}</div>
                      <div className="text-xs text-gray-500">Pages</div>
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

            {/* Filters */}
            <Card className="bg-white mb-6">
              <CardContent className="p-4">
                <div className="flex items-center flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search activities..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      data-testid="input-search-activities"
                    />
                  </div>
                  <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-36" data-testid="select-entity-filter">
                      <SelectValue placeholder="Entity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entities</SelectItem>
                      <SelectItem value="deal">Deals</SelectItem>
                      <SelectItem value="contact">Contacts</SelectItem>
                      <SelectItem value="company">Companies</SelectItem>
                      <SelectItem value="lead">Leads</SelectItem>
                      <SelectItem value="property">Properties</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-36" data-testid="select-type-filter">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="call">Calls</SelectItem>
                      <SelectItem value="email">Emails</SelectItem>
                      <SelectItem value="meeting">Meetings</SelectItem>
                      <SelectItem value="note">Notes</SelectItem>
                      <SelectItem value="task">Tasks</SelectItem>
                      <SelectItem value="site_visit">Site Visits</SelectItem>
                      <SelectItem value="follow_up">Follow Ups</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={actorFilter} onValueChange={(v) => { setActorFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-40" data-testid="select-actor-filter">
                      <SelectValue placeholder="Actor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Team Members</SelectItem>
                      {actors.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={dateRangeFilter} onValueChange={(v) => { setDateRangeFilter(v); setPage(1); }}>
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
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500 hover:text-gray-700">
                      <X className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Log Form */}
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

              {/* Activity Cards */}
              {items.map((activity) => (
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
                          <RelativeTimestamp date={activity.date} />
                          <span className="text-gray-300">&bull;</span>
                          <span className="text-gray-600 font-medium">{activity.user}</span>

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

                          {activity.lead && (
                            <Link href={`/crm/leads/${activity.lead.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 hover:bg-purple-50 cursor-pointer gap-1">
                                <TrendingUp className="h-2.5 w-2.5 text-purple-600" />
                                Lead: {activity.lead.name}
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

                          {activity.entityType && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-500">
                              {activity.entityType}
                            </Badge>
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

            {/* Empty state */}
            {items.length === 0 && !isLoading && (
              <Card className="mt-6">
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No activities found</h3>
                    <p className="text-gray-500 mt-1">
                      {hasActiveFilters
                        ? 'Try adjusting your search or filters'
                        : 'Activities from deals, contacts, and pipeline changes will appear here'}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>
                        Clear all filters
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">
                  Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, total)} of {total} activities
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1 mx-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
