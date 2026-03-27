import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  History,
  Search,
  Filter,
  Eye,
  User,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Edit3,
  Plus,
  Trash2,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface AuditTrailViewerProps {
  projectId: string;
}

interface AuditLogEntry {
  id: string;
  orgId: string;
  modelingProjectId: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  previousValue?: any;
  newValue?: any;
  changedFields?: string[];
  userId: string;
  userEmail?: string;
  createdAt: string;
}

const eventTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  scenario_created: { label: 'Scenario Created', icon: Plus, color: 'text-green-500' },
  scenario_updated: { label: 'Scenario Updated', icon: Edit3, color: 'text-blue-500' },
  scenario_version_created: { label: 'New Version', icon: RefreshCw, color: 'text-purple-500' },
  scenario_submitted: { label: 'Submitted for Approval', icon: Clock, color: 'text-amber-500' },
  scenario_approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-500' },
  scenario_rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-500' },
  scenario_deleted: { label: 'Scenario Deleted', icon: Trash2, color: 'text-red-500' },
  project_updated: { label: 'Project Updated', icon: Edit3, color: 'text-blue-500' },
  assumptions_updated: { label: 'Assumptions Updated', icon: Edit3, color: 'text-blue-500' },
  config_updated: { label: 'Config Updated', icon: Edit3, color: 'text-blue-500' },
  revenue_source_toggled: { label: 'Revenue Source Changed', icon: RefreshCw, color: 'text-indigo-500' },
  document_purged: { label: 'Document Purged', icon: Trash2, color: 'text-red-500' },
  actuals_reimported: { label: 'Actuals Re-imported', icon: RefreshCw, color: 'text-green-500' },
};

const entityTypeLabels: Record<string, string> = {
  scenario: 'Scenario',
  project: 'Project',
  assumptions: 'Assumptions',
  config: 'Configuration',
  project_config: 'Project Config',
  document: 'Document',
  actuals: 'Actuals',
};

export default function AuditTrailViewer({ projectId }: AuditTrailViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const { data: auditLog = [], isLoading, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ['/api/modeling/projects', projectId, 'audit-log'],
  });

  const filteredLog = auditLog.filter(entry => {
    if (entityTypeFilter !== 'all' && entry.entityType !== entityTypeFilter) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const eventLabel = eventTypeConfig[entry.eventType]?.label.toLowerCase() || entry.eventType.toLowerCase();
      const entityLabel = entityTypeLabels[entry.entityType]?.toLowerCase() || entry.entityType.toLowerCase();
      const userEmail = entry.userEmail?.toLowerCase() || '';
      return eventLabel.includes(query) || entityLabel.includes(query) || userEmail.includes(query);
    }
    return true;
  });

  const toggleExpanded = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatValue = (value: any, field?: string): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'number') {
      if (field?.toLowerCase().includes('rate') || field?.toLowerCase().includes('percent')) {
        return `${value.toFixed(2)}%`;
      }
      return value.toLocaleString();
    }
    return String(value);
  };

  const getChangeSummary = (entry: AuditLogEntry): string => {
    if (entry.changedFields && entry.changedFields.length > 0) {
      return `Changed: ${entry.changedFields.join(', ')}`;
    }
    if (entry.eventType === 'scenario_created') {
      return `Created "${entry.newValue?.name || 'scenario'}"`;
    }
    if (entry.eventType === 'scenario_approved') {
      return `Approved "${entry.newValue?.name || 'scenario'}"`;
    }
    if (entry.eventType === 'scenario_rejected') {
      return `Rejected "${entry.newValue?.name || 'scenario'}"`;
    }
    return '';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Trail
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete history of all changes for compliance and IC review
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-audit">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events, users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-audit-search"
                />
              </div>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-entity-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="scenario">Scenarios</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="assumptions">Assumptions</SelectItem>
                  <SelectItem value="config">Configuration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              {filteredLog.length} events
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLog.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Audit Events</h3>
              <p className="text-muted-foreground">
                {searchQuery || entityTypeFilter !== 'all' 
                  ? 'No events match your search criteria.'
                  : 'No changes have been recorded for this project yet.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredLog.map((entry) => {
                  const config = eventTypeConfig[entry.eventType] || { 
                    label: entry.eventType, 
                    icon: FileText, 
                    color: 'text-muted-foreground' 
                  };
                  const Icon = config.icon;
                  const isExpanded = expandedEntries.has(entry.id);
                  const hasDetails = entry.previousValue || entry.newValue || (entry.changedFields && entry.changedFields.length > 0);

                  return (
                    <div 
                      key={entry.id} 
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2 rounded-full bg-muted ${config.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{config.label}</span>
                              <Badge variant="outline" className="text-xs">
                                {entityTypeLabels[entry.entityType] || entry.entityType}
                              </Badge>
                              {entry.newValue?.status && (
                                <Badge 
                                  variant={entry.newValue.status === 'approved' ? 'default' : 
                                           entry.newValue.status === 'rejected' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {entry.newValue.status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {getChangeSummary(entry)}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {entry.userEmail || entry.userId}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(entry.createdAt), 'MM/dd/yyyy h:mm a')}
                              </span>
                              <span className="text-muted-foreground/70">
                                ({formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })})
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasDetails && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => toggleExpanded(entry.id)}
                              data-testid={`button-expand-${entry.id}`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedEntry(entry)}
                                data-testid={`button-view-details-${entry.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <Icon className={`h-5 w-5 ${config.color}`} />
                                  {config.label}
                                </DialogTitle>
                                <DialogDescription>
                                  {format(new Date(entry.createdAt), 'MMMM d, yyyy h:mm:ss a')} by {entry.userEmail || entry.userId}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                {entry.changedFields && entry.changedFields.length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-2">Changed Fields</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {entry.changedFields.map(field => (
                                        <Badge key={field} variant="outline">{field}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {(entry.previousValue || entry.newValue) && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="font-medium mb-2 text-muted-foreground">Previous Value</h4>
                                      <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-[300px]">
                                        {entry.previousValue 
                                          ? JSON.stringify(entry.previousValue, null, 2) 
                                          : '(none)'}
                                      </pre>
                                    </div>
                                    <div>
                                      <h4 className="font-medium mb-2 text-green-600">New Value</h4>
                                      <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-[300px]">
                                        {entry.newValue 
                                          ? JSON.stringify(entry.newValue, null, 2) 
                                          : '(none)'}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>

                      {isExpanded && hasDetails && (
                        <div className="mt-4 pt-4 border-t">
                          {entry.changedFields && entry.changedFields.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium mb-2">Changed Fields</h5>
                              <div className="flex flex-wrap gap-2">
                                {entry.changedFields.map(field => (
                                  <Badge key={field} variant="outline" className="text-xs">{field}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-sm font-medium mb-2 text-muted-foreground">Before</h5>
                              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-[200px]">
                                {entry.previousValue 
                                  ? JSON.stringify(entry.previousValue, null, 2).substring(0, 500) 
                                  : '(none)'}
                                {entry.previousValue && JSON.stringify(entry.previousValue).length > 500 && '...'}
                              </pre>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium mb-2 text-green-600">After</h5>
                              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-[200px]">
                                {entry.newValue 
                                  ? JSON.stringify(entry.newValue, null, 2).substring(0, 500) 
                                  : '(none)'}
                                {entry.newValue && JSON.stringify(entry.newValue).length > 500 && '...'}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Summary</CardTitle>
          <CardDescription>Overview of activity types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(
              auditLog.reduce((acc, entry) => {
                const key = entry.eventType;
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).slice(0, 8).map(([eventType, count]) => {
              const config = eventTypeConfig[eventType] || { label: eventType, icon: FileText, color: 'text-muted-foreground' };
              const Icon = config.icon;
              return (
                <div key={eventType} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={`p-2 rounded-full bg-background ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
