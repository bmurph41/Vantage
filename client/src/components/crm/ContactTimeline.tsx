import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  MailOpen,
  Phone,
  Calendar,
  StickyNote,
  DollarSign,
  ArrowRight,
  FileText,
  Eye,
  Clock,
  Activity,
  MessageSquare,
  RefreshCcw,
  Filter,
} from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────

interface TimelineEvent {
  type: string;
  timestamp: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

interface ContactTimelineProps {
  contactId: string;
  compact?: boolean;
}

// ── Event Styling ──────────────────────────────────────────────────────

function getEventIcon(type: string) {
  switch (type) {
    case "email_sent":
      return <Mail className="w-4 h-4 text-blue-600" />;
    case "email_received":
      return <MailOpen className="w-4 h-4 text-indigo-600" />;
    case "call":
      return <Phone className="w-4 h-4 text-green-600" />;
    case "meeting":
      return <Calendar className="w-4 h-4 text-purple-600" />;
    case "note_added":
      return <StickyNote className="w-4 h-4 text-yellow-600" />;
    case "deal_created":
      return <DollarSign className="w-4 h-4 text-emerald-600" />;
    case "deal_stage_changed":
      return <ArrowRight className="w-4 h-4 text-orange-600" />;
    case "document_shared":
      return <FileText className="w-4 h-4 text-cyan-600" />;
    case "property_viewed":
      return <Eye className="w-4 h-4 text-teal-600" />;
    case "task_completed":
      return <Activity className="w-4 h-4 text-green-500" />;
    case "comment":
      return <MessageSquare className="w-4 h-4 text-gray-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function getEventColor(type: string): string {
  switch (type) {
    case "email_sent":
    case "email_received":
      return "bg-blue-100 border-blue-300";
    case "call":
      return "bg-green-100 border-green-300";
    case "meeting":
      return "bg-purple-100 border-purple-300";
    case "note_added":
      return "bg-yellow-100 border-yellow-300";
    case "deal_created":
    case "deal_stage_changed":
      return "bg-orange-100 border-orange-300";
    case "document_shared":
      return "bg-cyan-100 border-cyan-300";
    case "property_viewed":
      return "bg-teal-100 border-teal-300";
    default:
      return "bg-gray-100 border-gray-300";
  }
}

function getEventBadgeVariant(type: string): string {
  const map: Record<string, string> = {
    email_sent: "bg-blue-50 text-blue-700 border-blue-200",
    email_received: "bg-indigo-50 text-indigo-700 border-indigo-200",
    call: "bg-green-50 text-green-700 border-green-200",
    meeting: "bg-purple-50 text-purple-700 border-purple-200",
    note_added: "bg-yellow-50 text-yellow-700 border-yellow-200",
    deal_created: "bg-emerald-50 text-emerald-700 border-emerald-200",
    deal_stage_changed: "bg-orange-50 text-orange-700 border-orange-200",
    document_shared: "bg-cyan-50 text-cyan-700 border-cyan-200",
    property_viewed: "bg-teal-50 text-teal-700 border-teal-200",
  };
  return map[type] || "bg-gray-50 text-gray-700 border-gray-200";
}

function formatEventType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Filter Options ─────────────────────────────────────────────────────

const EVENT_TYPE_FILTERS = [
  { value: "all", label: "All Events" },
  { value: "email_sent", label: "Emails Sent" },
  { value: "email_received", label: "Emails Received" },
  { value: "call", label: "Calls" },
  { value: "meeting", label: "Meetings" },
  { value: "note_added", label: "Notes" },
  { value: "deal_created", label: "Deals" },
  { value: "deal_stage_changed", label: "Stage Changes" },
  { value: "document_shared", label: "Documents" },
];

// ── Component ──────────────────────────────────────────────────────────

export function ContactTimeline({ contactId, compact = false }: ContactTimelineProps) {
  const [filter, setFilter] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery<{ events: TimelineEvent[] }>({
    queryKey: [`/api/crm/contacts/${contactId}/timeline`, filter],
    enabled: !!contactId,
  });

  const events = data?.events || [];
  const filteredEvents =
    filter === "all" ? events : events.filter((e) => e.type === filter);

  // Group events by date
  const groupedEvents = filteredEvents.reduce<Record<string, TimelineEvent[]>>(
    (groups, event) => {
      const dateKey = format(new Date(event.timestamp), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
      return groups;
    },
    {}
  );

  const dateKeys = Object.keys(groupedEvents).sort((a, b) => b.localeCompare(a));

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" /> Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-gray-500 mb-3">Failed to load timeline</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" /> Activity Timeline
            {filteredEvents.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filteredEvents.length}
              </Badge>
            )}
          </CardTitle>
          {!compact && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_FILTERS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No activity recorded yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Activities, emails, calls, and other interactions will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {dateKeys.map((dateKey) => (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {format(new Date(dateKey), "MMM d, yyyy")}
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <Badge variant="outline" className="text-[10px]">
                    {groupedEvents[dateKey].length}
                  </Badge>
                </div>

                {/* Events for this date */}
                <div className="relative pl-6 space-y-3">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />

                  {groupedEvents[dateKey].map((event, idx) => (
                    <div key={`${dateKey}-${idx}`} className="relative flex gap-3 group">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 mt-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center bg-white z-10 ${getEventColor(event.type)}`}
                      >
                        {getEventIcon(event.type)}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {event.title}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${getEventBadgeVariant(event.type)}`}
                              >
                                {formatEventType(event.type)}
                              </Badge>
                            </div>
                            {event.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                            {/* Metadata display */}
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {event.metadata.dealTitle && (
                                  <Badge variant="outline" className="text-[10px] bg-gray-50">
                                    Deal: {event.metadata.dealTitle}
                                  </Badge>
                                )}
                                {event.metadata.fromStage && event.metadata.toStage && (
                                  <Badge variant="outline" className="text-[10px] bg-gray-50">
                                    {event.metadata.fromStage} &rarr; {event.metadata.toStage}
                                  </Badge>
                                )}
                                {event.metadata.duration && (
                                  <Badge variant="outline" className="text-[10px] bg-gray-50">
                                    {event.metadata.duration} min
                                  </Badge>
                                )}
                                {event.metadata.outcome && (
                                  <Badge variant="outline" className="text-[10px] bg-gray-50">
                                    {event.metadata.outcome}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                            {formatDistanceToNow(new Date(event.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
