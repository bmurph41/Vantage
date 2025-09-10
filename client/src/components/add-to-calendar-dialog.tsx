import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, MapPin, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Project, Task, ProjectSettings } from "@shared/schema";
import { effectiveStart, effectiveDue } from "@/lib/date-utils";

interface AddToCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  tasks: Task[];
  settings?: ProjectSettings | null;
}

interface CalendarEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  type: 'project-milestone' | 'task-start' | 'task-due';
}

export function AddToCalendarDialog({ open, onOpenChange, project, tasks, settings }: AddToCalendarDialogProps) {
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<"google" | "outlook" | "">(""); 
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Generate all calendar events from project and tasks
  const generateCalendarEvents = (): CalendarEvent[] => {
    const allEvents: CalendarEvent[] = [];

    // Project milestone events
    if (project.psaSignedDate) {
      allEvents.push({
        title: `${project.name} - PSA Signed`,
        description: `Purchase and Sale Agreement signed for ${project.name}`,
        startDate: parseISO(project.psaSignedDate),
        type: 'project-milestone'
      });
    }

    if (project.ddExpirationDate) {
      allEvents.push({
        title: `${project.name} - Due Diligence Deadline`,
        description: `Due diligence period expires for ${project.name}`,
        startDate: parseISO(project.ddExpirationDate),
        type: 'project-milestone'
      });
    }

    if (project.closingDate) {
      allEvents.push({
        title: `${project.name} - Closing Date`,
        description: `Target closing date for ${project.name}`,
        startDate: parseISO(project.closingDate),
        type: 'project-milestone'
      });
    }

    // Task events
    tasks.forEach(task => {
      const projectWithSettings = { ...project, settings };
      const taskStart = effectiveStart(task, projectWithSettings);
      const taskDue = effectiveDue(task, projectWithSettings);

      // Task start event
      if (taskStart) {
        allEvents.push({
          title: `Start: ${task.title}`,
          description: `Begin work on ${task.title}${task.description ? `\n\nDescription: ${task.description}` : ''}${task.assignee ? `\nAssigned to: ${task.assignee}` : ''}${task.companyHired ? `\nCompany: ${task.companyHired}` : ''}`,
          startDate: taskStart,
          location: task.companyHired || undefined,
          type: 'task-start'
        });
      }

      // Task due event
      if (taskDue) {
        allEvents.push({
          title: `Due: ${task.title}`,
          description: `Due date for ${task.title}${task.description ? `\n\nDescription: ${task.description}` : ''}${task.assignee ? `\nAssigned to: ${task.assignee}` : ''}${task.companyHired ? `\nCompany: ${task.companyHired}` : ''}`,
          startDate: taskDue,
          endDate: addDays(taskDue, 1), // All-day event
          location: task.companyHired || undefined,
          type: 'task-due'
        });
      }
    });

    return allEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  };

  // Initialize events when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen) {
      setEvents(generateCalendarEvents());
    }
  };

  // Generate Google Calendar URL
  const generateGoogleCalendarUrl = (event: CalendarEvent): string => {
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      details: event.description,
      dates: event.endDate 
        ? `${formatDate(event.startDate)}/${formatDate(event.endDate)}`
        : `${formatDate(event.startDate)}/${formatDate(addDays(event.startDate, 0))}`,
    });

    if (event.location) {
      params.append('location', event.location);
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Generate Outlook Calendar URL  
  const generateOutlookCalendarUrl = (event: CalendarEvent): string => {
    const formatDate = (date: Date) => {
      return date.toISOString();
    };

    const params = new URLSearchParams({
      subject: event.title,
      body: event.description,
      startdt: formatDate(event.startDate),
      enddt: formatDate(event.endDate || addDays(event.startDate, 0)),
      allday: event.endDate ? 'true' : 'false',
    });

    if (event.location) {
      params.append('location', event.location);
    }

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  };

  const addAllToCalendar = async () => {
    if (!selectedProvider) {
      toast({
        title: "Select a calendar provider",
        description: "Please choose Google Calendar or Outlook before adding events.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Open calendar URLs for each event
      events.forEach((event, index) => {
        setTimeout(() => {
          const url = selectedProvider === "google" 
            ? generateGoogleCalendarUrl(event)
            : generateOutlookCalendarUrl(event);
          
          window.open(url, '_blank');
        }, index * 500); // Stagger the window opens to avoid popup blocking
      });

      toast({
        title: "Calendar events opened",
        description: `${events.length} calendar events have been opened in new tabs. You may need to allow popups.`,
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open calendar events. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSingleEvent = (event: CalendarEvent) => {
    if (!selectedProvider) {
      toast({
        title: "Select a calendar provider",
        description: "Please choose Google Calendar or Outlook before adding events.",
        variant: "destructive",
      });
      return;
    }

    const url = selectedProvider === "google" 
      ? generateGoogleCalendarUrl(event)
      : generateOutlookCalendarUrl(event);
    
    window.open(url, '_blank');
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'project-milestone': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'task-start': return <Clock className="h-4 w-4 text-green-600" />;
      case 'task-due': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'project-milestone': return <Badge variant="default" className="bg-blue-100 text-blue-800">Milestone</Badge>;
      case 'task-start': return <Badge variant="default" className="bg-green-100 text-green-800">Start</Badge>;
      case 'task-due': return <Badge variant="default" className="bg-orange-100 text-orange-800">Due</Badge>;
      default: return <Badge variant="secondary">Event</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-add-to-calendar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Add to Calendar: {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Calendar Provider Selection */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Choose Calendar Provider</h3>
            <Select value={selectedProvider} onValueChange={(value: "google" | "outlook") => setSelectedProvider(value)}>
              <SelectTrigger className="w-full" data-testid="select-calendar-provider">
                <SelectValue placeholder="Select your calendar provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    Google Calendar
                  </div>
                </SelectItem>
                <SelectItem value="outlook">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                    Outlook Calendar
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Events Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Events to Add ({events.length})</h3>
              <Button 
                onClick={addAllToCalendar} 
                disabled={loading || !selectedProvider}
                data-testid="button-add-all-events"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {loading ? "Adding..." : "Add All Events"}
              </Button>
            </div>

            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No calendar events found. Make sure your project has dates and tasks configured.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {events.map((event, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                    data-testid={`event-item-${index}`}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getEventIcon(event.type)}
                        <h4 className="font-medium">{event.title}</h4>
                        {getEventBadge(event.type)}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(event.startDate, 'MMM d, yyyy')}
                          {event.endDate && event.endDate.getTime() !== event.startDate.getTime() && 
                            ` - ${format(event.endDate, 'MMM d, yyyy')}`
                          }
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </div>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addSingleEvent(event)}
                      disabled={!selectedProvider}
                      data-testid={`button-add-single-${index}`}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Select your calendar provider (Google Calendar or Outlook)</li>
              <li>• Click "Add All Events" to open all calendar events at once</li>
              <li>• Or click "Add" next to individual events to add them one by one</li>
              <li>• Your browser will open new tabs for each calendar event</li>
              <li>• You may need to allow popups in your browser</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}