import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Download, 
  AlertCircle, 
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  Send
} from "lucide-react";
import { format, isAfter, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { tzNow } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Project, ProjectSettings, CalendarEvent, UserEmail } from "@shared/schema";

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
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
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

  // Fetch user emails for calendar sync
  const { 
    data: userEmails = [], 
    isLoading: emailsLoading, 
  } = useQuery<UserEmail[]>({
    queryKey: ['/api/user/emails'],
    enabled: open,
  });

  // Sync project events mutation
  const syncEventsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/dd/projects/${project.id}/calendar-events/sync`);
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
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
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
          description: "Calendar file ready to import into Outlook, Gmail, or Apple Calendar.",
        });
        onOpenChange(false);
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

  // Direct sync mutation
  const directSyncMutation = useMutation({
    mutationFn: async ({ eventIds, emailIds }: { eventIds: string[], emailIds: string[] }) => {
      const response = await apiRequest('POST', '/api/dd/calendar/sync-direct', {
        eventIds,
        emailIds,
        projectId: project.id
      });
      return response.json();
    },
    onSuccess: (data) => {
      const { summary } = data;
      toast({
        title: "Calendar Sync Successful",
        description: `Synced ${summary.successful} of ${summary.totalEvents} events to ${summary.emailAddresses} calendar(s).`,
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Direct sync failed:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync events to calendar. Please try again.",
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

    // Apply date filter
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
      setSelectedEmailIds(new Set());
      setSearchQuery('');
    }
  }, [open]);

  // Auto-select primary email when emails are available
  useEffect(() => {
    if (open && userEmails.length > 0 && selectedEmailIds.size === 0) {
      const primaryEmail = userEmails.find(email => email.emailType === 'primary');
      if (primaryEmail) {
        setSelectedEmailIds(new Set([primaryEmail.id]));
      }
    }
  }, [open, userEmails, selectedEmailIds.size]);

  // Auto-select all events when dialog opens and events are available
  useEffect(() => {
    if (open && events.length > 0 && selectedEventIds.size === 0) {
      setSelectedEventIds(new Set(events.map((event: CalendarEvent) => event.id)));
    }
  }, [open, events, selectedEventIds.size]);

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

  const handleEmailToggle = (emailId: string) => {
    const newSelection = new Set(selectedEmailIds);
    if (newSelection.has(emailId)) {
      newSelection.delete(emailId);
    } else {
      newSelection.add(emailId);
    }
    setSelectedEmailIds(newSelection);
  };

  const handleDownloadICS = () => {
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

  const handleDirectSync = () => {
    if (selectedEventIds.size === 0) {
      toast({
        title: "No Events Selected",
        description: "Please select at least one event to sync.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedEmailIds.size === 0) {
      toast({
        title: "No Emails Selected",
        description: "Please select at least one email address to sync to.",
        variant: "destructive",
      });
      return;
    }
    
    directSyncMutation.mutate({
      eventIds: Array.from(selectedEventIds),
      emailIds: Array.from(selectedEmailIds)
    });
  };

  const handleSyncTasks = () => {
    syncEventsMutation.mutate();
  };

  // Helper functions
  const getEventBadge = (type: string) => {
    switch (type) {
      case 'dd_expiration': return <Badge variant="destructive">DD Expiration</Badge>;
      case 'closing': return <Badge className="bg-green-600 hover:bg-green-700 text-white">Closing</Badge>;
      case 'task_deadline': return <Badge className="bg-orange-600 hover:bg-orange-700 text-white">Task Deadline</Badge>;
      case 'milestone': return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Milestone</Badge>;
      case 'custom': return <Badge className="bg-purple-600 hover:bg-purple-700 text-white">Custom</Badge>;
      default: return <Badge variant="secondary">Event</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" data-testid="dialog-add-to-calendar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Export to Calendar
          </DialogTitle>
          <DialogDescription>
            Sync your project tasks to calendar events, then export to your preferred calendar app.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="download" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
            <TabsTrigger value="download" data-testid="tab-download">
              <Download className="h-4 w-4 mr-2" />
              Download ICS File
            </TabsTrigger>
            <TabsTrigger value="direct" data-testid="tab-direct">
              <Send className="h-4 w-4 mr-2" />
              Direct Sync
            </TabsTrigger>
          </TabsList>

          <TabsContent value="download" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Download an ICS file to import into Outlook, Gmail, or Apple Calendar
                </span>
              </div>
              <Button
                onClick={handleSyncTasks}
                disabled={syncEventsMutation.isPending}
                variant="outline"
                size="sm"
                data-testid="button-sync-tasks-download"
              >
                {syncEventsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {syncEventsMutation.isPending ? "Syncing..." : "Sync Tasks"}
              </Button>
            </div>

            {renderEventsList()}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleDownloadICS}
                disabled={selectedEventIds.size === 0 || downloadICSMutation.isPending}
                data-testid="button-download-ics"
              >
                {downloadICSMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download {selectedEventIds.size > 0 ? `(${selectedEventIds.size})` : ''} Events
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="direct" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Directly sync events to connected calendar accounts
                </span>
              </div>
              <Button
                onClick={handleSyncTasks}
                disabled={syncEventsMutation.isPending}
                variant="outline"
                size="sm"
                data-testid="button-sync-tasks-direct"
              >
                {syncEventsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {syncEventsMutation.isPending ? "Syncing..." : "Sync Tasks"}
              </Button>
            </div>

            {/* Email Selection */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-medium mb-3">Select Calendar Accounts</h4>
                {emailsLoading ? (
                  <div className="space-y-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-3">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    ))}
                  </div>
                ) : userEmails.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 bg-muted rounded-md">
                    No calendar accounts configured. Add accounts in your user settings to use direct sync.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userEmails.map((email) => (
                      <div
                        key={email.id}
                        className="flex items-center space-x-3 p-2 rounded hover:bg-muted"
                        data-testid={`email-item-${email.id}`}
                      >
                        <Checkbox
                          checked={selectedEmailIds.has(email.id)}
                          onCheckedChange={() => handleEmailToggle(email.id)}
                          data-testid={`checkbox-email-${email.id}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{email.email}</span>
                            {email.emailType === 'primary' && (
                              <Badge variant="default" className="text-xs">Primary</Badge>
                            )}
                            {email.calendarProvider && (
                              <Badge variant="outline" className="text-xs">{email.calendarProvider}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {renderEventsList()}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-direct">
                Cancel
              </Button>
              <Button
                onClick={handleDirectSync}
                disabled={selectedEventIds.size === 0 || selectedEmailIds.size === 0 || directSyncMutation.isPending}
                data-testid="button-direct-sync"
              >
                {directSyncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Sync {selectedEventIds.size > 0 ? `(${selectedEventIds.size})` : ''} Events
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );

  function renderEventsList() {
    return (
      <div className="space-y-4">
        {/* Filters and Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-events"
          />
          
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger data-testid="select-filter-type">
              <SelectValue placeholder="Event Type" />
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

          <Select value={filterDate} onValueChange={(v) => setFilterDate(v as FilterDate)}>
            <SelectTrigger data-testid="select-filter-date">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger data-testid="select-sort">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_asc">Date (Earliest)</SelectItem>
              <SelectItem value="date_desc">Date (Latest)</SelectItem>
              <SelectItem value="type">Event Type</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Select All Button */}
        <div className="flex items-center justify-between">
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

        <Separator />

        {/* Events List */}
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {eventsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-4" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
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
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Events Found</h3>
              <p className="text-muted-foreground mb-4">
                {events.length === 0 
                  ? "No calendar events yet. Click 'Sync Tasks' to create events from your project tasks."
                  : "No events match your current filters."
                }
              </p>
            </div>
          ) : (
            filteredAndSortedEvents.map((event) => (
              <Card 
                key={event.id} 
                className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${getPriorityColor(event.priority)} ${
                  selectedEventIds.has(event.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                }`}
                onClick={() => handleEventToggle(event.id)}
                data-testid={`event-card-${event.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedEventIds.has(event.id)}
                      onCheckedChange={() => handleEventToggle(event.id)}
                      className="mt-1"
                      data-testid={`checkbox-event-${event.id}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium truncate">{event.title}</h4>
                        {getEventBadge(event.eventType)}
                        {getStatusBadge(event.status)}
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(event.startDate), 'MM/dd/yyyy h:mm a')}
                          {event.isAllDay && ' (All Day)'}
                        </span>
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                    
                    <Badge 
                      variant={event.priority === 'high' ? 'destructive' : event.priority === 'med' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {event.priority.toUpperCase()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }
}
