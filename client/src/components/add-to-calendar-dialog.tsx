import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Filter,
  SortAsc,
  Users,
  FileText,
  Milestone,
  Target,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { tzNow } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Project, ProjectSettings, CalendarEvent } from "@shared/schema";

interface AddToCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  settings?: ProjectSettings | null;
}

type FilterType = 'all' | 'dd_expiration' | 'closing' | 'task_deadline' | 'milestone' | 'custom';
type FilterStatus = 'all' | 'not_started' | 'in_progress' | 'completed';
type FilterDate = 'all' | 'upcoming' | 'this_week' | 'this_month';
type SortOption = 'date_asc' | 'date_desc' | 'type' | 'priority' | 'status';

export function AddToCalendarDialog({ open, onOpenChange, project, settings }: AddToCalendarDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for selections and filters
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterDate, setFilterDate] = useState<FilterDate>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch calendar events
  const { 
    data: events = [], 
    isLoading: eventsLoading, 
    error: eventsError,
    refetch: refetchEvents
  } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/dd/projects', project.id, 'calendar-events'],
    enabled: open && !!project.id,
  });

  // Sync project events mutation
  const syncEventsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/dd/projects/${project.id}/calendar-events/sync`);
      // Handle response if needed, or just return success
      return response.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', project.id, 'calendar-events'] });
      toast({
        title: "Events Synced",
        description: "Calendar events have been synchronized successfully.",
      });
    },
    onError: (error) => {
      console.error('Sync failed:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync calendar events. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Download ICS mutation
  const downloadICSMutation = useMutation({
    mutationFn: async (eventIds: string[]) => {
      try {
        const response = await apiRequest('POST', '/api/dd/calendar/generate-ics', {
          eventIds,
          projectId: project.id
        });
        
        // Ensure we have a valid response before calling blob()
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        // Validate blob content type
        if (!blob.type.includes('calendar') && !blob.type.includes('text')) {
          console.warn('Unexpected blob type:', blob.type);
        }
        
        return blob;
      } catch (error) {
        console.error('ICS download error:', error);
        throw error;
      }
    },
    onSuccess: (blob) => {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}-calendar-events.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Download Complete",
          description: "Calendar events have been downloaded as an ICS file.",
        });
      } catch (error) {
        console.error('File download error:', error);
        toast({
          title: "Download Failed",
          description: "Failed to save the calendar file. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error('Download mutation error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download calendar events. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Filter and sort events
  const filteredAndSortedEvents = useMemo(() => {
    let filtered = [...events];

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(event => event.eventType === filterType);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(event => event.status === filterStatus);
    }

    // Apply date filter (timezone-aware)
    if (filterDate !== 'all') {
      const now = tzNow('America/New_York');
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.startDate);
        switch (filterDate) {
          case 'upcoming':
            return isAfter(eventDate, now);
          case 'this_week':
            return eventDate >= startOfWeek(now) && eventDate <= endOfWeek(now);
          case 'this_month':
            return eventDate >= startOfMonth(now) && eventDate <= endOfMonth(now);
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        case 'date_desc':
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        case 'type':
          return a.eventType.localeCompare(b.eventType);
        case 'priority':
          const priorityOrder: Record<string, number> = { high: 3, med: 2, low: 1 };
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  }, [events, filterType, filterStatus, filterDate, searchQuery, sortBy]);

  // Reset selections when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedEventIds(new Set());
      setSearchQuery('');
    }
  }, [open]);

  // Event handlers
  const handleSelectAll = () => {
    if (selectedEventIds.size === filteredAndSortedEvents.length) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(filteredAndSortedEvents.map((event: CalendarEvent) => event.id)));
    }
  };

  const handleEventToggle = (eventId: string) => {
    const newSelection = new Set(selectedEventIds);
    if (newSelection.has(eventId)) {
      newSelection.delete(eventId);
    } else {
      newSelection.add(eventId);
    }
    setSelectedEventIds(newSelection);
  };

  const handleDownloadSelected = () => {
    if (selectedEventIds.size === 0) {
      toast({
        title: "No Events Selected",
        description: "Please select at least one event to download.",
        variant: "destructive",
      });
      return;
    }
    downloadICSMutation.mutate(Array.from(selectedEventIds));
  };

  const handleDownloadAll = () => {
    if (events.length === 0) {
      toast({
        title: "No Events Available",
        description: "There are no calendar events to download.",
        variant: "destructive",
      });
      return;
    }
    downloadICSMutation.mutate(events.map((event: CalendarEvent) => event.id));
  };

  const handleSyncEvents = () => {
    syncEventsMutation.mutate();
  };

  // Helper functions
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'dd_expiration': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'closing': return <Target className="h-4 w-4 text-green-600" />;
      case 'task_deadline': return <Clock className="h-4 w-4 text-orange-600" />;
      case 'milestone': return <Milestone className="h-4 w-4 text-blue-600" />;
      case 'custom': return <Calendar className="h-4 w-4 text-purple-600" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'dd_expiration': return <Badge variant="destructive">DD Expiration</Badge>;
      case 'closing': return <Badge variant="default" className="bg-green-100 text-green-800">Closing</Badge>;
      case 'task_deadline': return <Badge variant="default" className="bg-orange-100 text-orange-800">Task Deadline</Badge>;
      case 'milestone': return <Badge variant="default" className="bg-blue-100 text-blue-800">Milestone</Badge>;
      case 'custom': return <Badge variant="default" className="bg-purple-100 text-purple-800">Custom</Badge>;
      default: return <Badge variant="secondary">Event</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress': return <Badge variant="default" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'not_started': return <Badge variant="outline">Not Started</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'med': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" data-testid="dialog-enhanced-add-to-calendar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Events: {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[80vh]">
          {/* Controls Section */}
          <div className="space-y-4 pb-4">
            {/* Search and Sync */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="w-full"
                  data-testid="input-search-events"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncEvents}
                disabled={syncEventsMutation.isPending}
                data-testid="button-sync-events"
              >
                {syncEventsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync
              </Button>
            </div>

            {/* Filters and Sorting */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={filterType} onValueChange={(value: FilterType) => setFilterType(value)}>
                <SelectTrigger data-testid="select-filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="dd_expiration">DD Expiration</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                  <SelectItem value="task_deadline">Task Deadline</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={(value: FilterStatus) => setFilterStatus(value)}>
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterDate} onValueChange={(value: FilterDate) => setFilterDate(value)}>
                <SelectTrigger data-testid="select-filter-date">
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger data-testid="select-sort-by">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_asc">Date (Earliest First)</SelectItem>
                  <SelectItem value="date_desc">Date (Latest First)</SelectItem>
                  <SelectItem value="type">Event Type</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={filteredAndSortedEvents.length === 0}
                  data-testid="button-select-all"
                >
                  {selectedEventIds.size === filteredAndSortedEvents.length && filteredAndSortedEvents.length > 0 ? (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  ) : (
                    <Circle className="h-4 w-4 mr-2" />
                  )}
                  {selectedEventIds.size === filteredAndSortedEvents.length && filteredAndSortedEvents.length > 0 ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedEventIds.size} of {filteredAndSortedEvents.length} selected
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadSelected}
                  disabled={selectedEventIds.size === 0 || downloadICSMutation.isPending}
                  data-testid="button-download-selected"
                >
                  {downloadICSMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download Selected
                </Button>
                <Button
                  onClick={handleDownloadAll}
                  disabled={events.length === 0 || downloadICSMutation.isPending}
                  data-testid="button-download-all"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Events List */}
          <div className="flex-1 overflow-y-auto mt-4">
            {eventsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <Skeleton className="h-4 w-4" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : eventsError ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to Load Events</h3>
                <p className="text-muted-foreground mb-4">There was an error loading calendar events.</p>
                <Button onClick={() => refetchEvents()} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : filteredAndSortedEvents.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Events Found</h3>
                <p className="text-muted-foreground">
                  {events.length === 0 
                    ? "No calendar events are available for this project."
                    : "No events match your current filters."
                  }
                </p>
                {events.length === 0 && (
                  <Button onClick={handleSyncEvents} variant="outline" className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Events
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAndSortedEvents.map((event) => (
                  <Card 
                    key={event.id} 
                    className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${getPriorityColor(event.priority)} ${
                      selectedEventIds.has(event.id) ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''
                    }`}
                    onClick={() => handleEventToggle(event.id)}
                    data-testid={`event-card-${event.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <Checkbox
                          checked={selectedEventIds.has(event.id)}
                          onCheckedChange={() => handleEventToggle(event.id)}
                          className="mt-1"
                          data-testid={`checkbox-event-${event.id}`}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getEventIcon(event.eventType)}
                            <h4 className="font-medium text-foreground truncate">{event.title}</h4>
                            {getEventBadge(event.eventType)}
                            {getStatusBadge(event.status)}
                          </div>
                          
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {format(new Date(event.startDate), 'MMM d, yyyy h:mm a')}
                                {event.endDate && event.endDate !== event.startDate && 
                                  ` - ${format(new Date(event.endDate), event.isAllDay ? 'MMM d, yyyy' : 'h:mm a')}`
                                }
                                {event.isAllDay && ' (All Day)'}
                              </span>
                            </div>
                            
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                            
                            {event.description && (
                              <p className="text-xs line-clamp-2 mt-2">{event.description}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                          <Badge 
                            variant={event.priority === 'high' ? 'destructive' : event.priority === 'med' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {event.priority.toUpperCase()}
                          </Badge>
                          {event.timezone && event.timezone !== 'America/New_York' && (
                            <span className="text-xs text-muted-foreground">{event.timezone}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}