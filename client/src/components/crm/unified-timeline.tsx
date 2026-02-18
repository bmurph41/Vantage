import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, Mail, MessageSquare, Calendar, FileText, 
  Clock, PhoneIncoming, PhoneOutgoing, StickyNote, 
  Upload, Filter, Image, File, Paperclip, Pin, Building2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface UnifiedTimelineProps {
  entityType: 'contact' | 'deal' | 'property' | 'company' | 'lead';
  entityId: string;
  maxHeight?: string;
  showHeader?: boolean;
  compact?: boolean;
}

type TimelineItem = {
  id: string;
  type: 'activity' | 'note' | 'file';
  subType: string;
  title: string;
  description: string | null;
  timestamp: string;
  metadata: Record<string, any>;
  sourceEntity?: { type: string; id: string; name?: string };
};

type TimelineResponse = {
  items: TimelineItem[];
  counts: {
    activities: number;
    notes: number;
    files: number;
    total: number;
  };
  linkedCompanies?: number;
};

export default function UnifiedTimeline({ 
  entityType, 
  entityId, 
  maxHeight = "400px",
  showHeader = true,
  compact = false
}: UnifiedTimelineProps) {
  const [filter, setFilter] = useState<string>('all');

  const { data, isLoading } = useQuery<TimelineResponse>({
    queryKey: [`/api/crm/timeline/${entityType}/${entityId}`],
  });

  const getItemIcon = (item: TimelineItem) => {
    if (item.type === 'note') {
      return item.metadata?.isPinned ? Pin : StickyNote;
    }
    if (item.type === 'file') {
      const mimeType = item.metadata?.mimeType || '';
      if (mimeType.startsWith('image/')) return Image;
      if (mimeType.includes('pdf')) return FileText;
      return File;
    }
    switch (item.subType) {
      case 'call':
        if (item.metadata?.direction === 'incoming') return PhoneIncoming;
        if (item.metadata?.direction === 'outgoing') return PhoneOutgoing;
        return Phone;
      case 'email':
        return Mail;
      case 'sms':
        return MessageSquare;
      case 'meeting':
      case 'showing':
        return Calendar;
      default:
        return FileText;
    }
  };

  const getItemColor = (item: TimelineItem) => {
    if (item.type === 'note') {
      return item.metadata?.isPinned 
        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' 
        : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
    if (item.type === 'file') {
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    }
    switch (item.subType) {
      case 'call':
        return item.metadata?.direction === 'incoming' 
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
          : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'email':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'sms':
        return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
      case 'meeting':
      case 'showing':
        return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getTypeLabel = (item: TimelineItem) => {
    if (item.type === 'note') return 'Note';
    if (item.type === 'file') return 'File';
    return item.subType.charAt(0).toUpperCase() + item.subType.slice(1);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const filteredItems = data?.items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'notes') return item.type === 'note';
    if (filter === 'files') return item.type === 'file';
    if (filter === 'activities') return item.type === 'activity';
    return item.subType === filter;
  }) || [];

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'activities', label: 'Activities' },
    { value: 'notes', label: 'Notes' },
    { value: 'files', label: 'Files' },
  ];

  if (isLoading) {
    return (
      <Card>
        {showHeader && (
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4" />
              Timeline
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                  <div className="h-2 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <>
      {filteredItems.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          {filter === 'all' 
            ? 'No activity history yet' 
            : `No ${filter} found`}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item, index) => {
            const Icon = getItemIcon(item);
            const iconColor = getItemColor(item);
            
            return (
              <div key={item.id} className="flex items-start gap-3 relative" data-testid={`timeline-item-${item.id}`}>
                {index < filteredItems.length - 1 && (
                  <div className="absolute left-4 top-10 bottom-0 w-px bg-border"></div>
                )}
                
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className={`font-medium ${compact ? 'text-sm' : ''}`}>
                          {item.title}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(item)}
                        </Badge>
                        {item.type === 'note' && item.metadata?.isPinned && (
                          <Badge variant="secondary" className="text-xs">
                            Pinned
                          </Badge>
                        )}
                        {item.sourceEntity && (
                          <Badge 
                            variant="outline" 
                            className="text-[9px] px-1.5 py-0 h-4 gap-1 mt-1 cursor-pointer hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Building2 className="h-2.5 w-2.5" />
                            via {item.sourceEntity.name || item.sourceEntity.type}
                          </Badge>
                        )}
                        {item.type === 'file' && item.metadata?.size && (
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(item.metadata.size)}
                          </span>
                        )}
                      </div>
                      
                      {item.description && (
                        <p className={`text-muted-foreground ${compact ? 'text-xs line-clamp-2' : 'text-sm line-clamp-3'}`}>
                          {item.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                        {item.metadata?.duration && (
                          <>
                            <span>•</span>
                            <span>{item.metadata.duration} min</span>
                          </>
                        )}
                        {item.metadata?.outcome && (
                          <>
                            <span>•</span>
                            <Badge 
                              variant={item.metadata.outcome === 'successful' || item.metadata.outcome === 'connected' ? 'default' : 'secondary'}
                              className="text-xs py-0"
                            >
                              {item.metadata.outcome}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {!compact && (
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.timestamp), 'MMM d')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (!showHeader) {
    return (
      <ScrollArea style={{ maxHeight }} className="pr-3">
        {content}
      </ScrollArea>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4" />
            Timeline
            {data?.counts.total ? (
              <Badge variant="secondary" className="text-xs">
                {data.counts.total}
              </Badge>
            ) : null}
          </CardTitle>
        </div>
        
        <div className="flex items-center gap-1.5 flex-wrap pt-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(option.value)}
              className="h-7 text-xs px-2"
              data-testid={`timeline-filter-${option.value}`}
            >
              {option.label}
              {option.value !== 'all' && data?.counts && (
                <span className="ml-1 opacity-70">
                  ({option.value === 'activities' ? data.counts.activities :
                    option.value === 'notes' ? data.counts.notes :
                    option.value === 'files' ? data.counts.files : 0})
                </span>
              )}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea style={{ maxHeight }} className="pr-3">
          {content}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
