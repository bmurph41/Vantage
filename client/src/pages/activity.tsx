import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Phone, Mail, Calendar, FileText, Search, 
  ArrowUpRight, ArrowDownRight, Clock, User, Building, Home, Handshake, Loader2,
  Activity, MessageSquare, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";

type Activity = {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'task_created' | 'stage_change' | 'deal_created';
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

  const { data: activities, isLoading } = useQuery({
    queryKey: ['/api/activities'],
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
    return matchesSearch && matchesType && matchesDirection;
  });

  const kpiStats = useMemo(() => {
    const total = displayActivities.length;
    const calls = displayActivities.filter(a => a.type === 'call').length;
    const emails = displayActivities.filter(a => a.type === 'email').length;
    const meetings = displayActivities.filter(a => a.type === 'meeting').length;
    const notes = displayActivities.filter(a => a.type === 'note' || a.type === 'task_created').length;
    return { total, calls, emails, meetings, notes };
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
          <Button data-testid="button-log-activity">
            Log Activity
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
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
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
                            {format(new Date(activity.date), 'MMM d, yyyy h:mm a')}
                          </span>
                          <span className="text-gray-300">&bull;</span>
                          <span className="text-gray-500">{activity.user}</span>
                          
                          {activity.contact && (
                            <>
                              <span className="text-gray-300">&bull;</span>
                              <Badge variant="outline" className="text-xs">
                                <User className="w-3 h-3 mr-1" />
                                {activity.contact.name}
                              </Badge>
                            </>
                          )}
                          
                          {activity.company && (
                            <Badge variant="outline" className="text-xs">
                              <Building className="w-3 h-3 mr-1" />
                              {activity.company.name}
                            </Badge>
                          )}
                          
                          {activity.property && (
                            <Badge variant="outline" className="text-xs">
                              <Home className="w-3 h-3 mr-1" />
                              {activity.property.name}
                            </Badge>
                          )}
                          
                          {activity.deal && (
                            <Badge variant="outline" className="text-xs">
                              <Handshake className="w-3 h-3 mr-1" />
                              {activity.deal.name}
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

            {filteredActivities.length === 0 && (
              <Card className="mt-6">
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No activities found</h3>
                    <p className="text-gray-500 mt-1">
                      {searchQuery || typeFilter !== 'all' || directionFilter !== 'all'
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
