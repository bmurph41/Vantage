import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Phone, Mail, Calendar, FileText, Search, Filter,
  ArrowUpRight, ArrowDownRight, Clock, User, Building, Home, Handshake, Loader2
} from "lucide-react";
import { format } from "date-fns";

type Activity = {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
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


export default function ActivityLog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  const { data: activities, isLoading } = useQuery({
    queryKey: ['/api/activities'],
  });

  const displayActivities = (activities as Activity[]) || [];

  const filteredActivities = displayActivities.filter(activity => {
    const matchesSearch = activity.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activity.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activity.contact?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activity.company?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || activity.type === typeFilter;
    const matchesDirection = directionFilter === 'all' || activity.direction === directionFilter;
    return matchesSearch && matchesType && matchesDirection;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-100 text-blue-600';
      case 'email': return 'bg-green-100 text-green-600';
      case 'meeting': return 'bg-purple-100 text-purple-600';
      case 'note': return 'bg-yellow-100 text-yellow-600';
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

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Activity Log</h1>
            <p className="text-gray-500 mt-1">Track all interactions across contacts, deals, and properties</p>
          </div>
          <Button data-testid="button-log-activity">
            Log Activity
          </Button>
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

        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-gray-500">Loading activities...</span>
            </div>
          )}
          {!isLoading && filteredActivities.map((activity) => (
            <Card key={activity.id} className="bg-white" data-testid={`activity-card-${activity.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTypeColor(activity.type)}`}>
                    {getTypeIcon(activity.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-gray-900">{activity.subject}</h3>
                      {getDirectionIcon(activity.direction)}
                    </div>
                    
                    {activity.description && (
                      <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                    )}
                    
                    <div className="flex items-center flex-wrap gap-2 text-xs">
                      <span className="text-gray-500">
                        {format(new Date(activity.date), 'MMM d, yyyy h:mm a')}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500">{activity.user}</span>
                      
                      {activity.contact && (
                        <>
                          <span className="text-gray-300">•</span>
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
                  
                  <Badge className={getTypeColor(activity.type)}>
                    {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isLoading && filteredActivities.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No activities found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
