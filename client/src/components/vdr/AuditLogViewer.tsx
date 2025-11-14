import { useQuery } from '@tanstack/react-query';
import { VdrAuditLog } from '@shared/schema';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Activity, 
  FileText, 
  Folder, 
  User, 
  Upload, 
  Download, 
  Trash2,
  Eye,
  Edit,
  UserPlus,
  Shield,
  Calendar,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface AuditLogViewerProps {
  projectId: string;
}

export function AuditLogViewer({ projectId }: AuditLogViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: logs = [], isLoading } = useQuery<VdrAuditLog[]>({
    queryKey: ['/api/vdr/projects', projectId, 'audit'],
  });

  const getEventIcon = (eventType: string) => {
    const iconMap: Record<string, any> = {
      document_uploaded: Upload,
      document_viewed: Eye,
      document_downloaded: Download,
      document_deleted: Trash2,
      document_moved: Edit,
      folder_created: Folder,
      folder_renamed: Edit,
      folder_deleted: Trash2,
      folder_moved: Edit,
      permission_granted: Shield,
      permission_revoked: Shield,
      external_user_invited: UserPlus,
      external_user_accessed: User,
    };
    return iconMap[eventType] || Activity;
  };

  const getEventColor = (eventType: string) => {
    if (eventType.includes('deleted') || eventType.includes('revoked')) {
      return 'text-red-600 dark:text-red-400';
    }
    if (eventType.includes('created') || eventType.includes('granted') || eventType.includes('uploaded')) {
      return 'text-green-600 dark:text-green-400';
    }
    if (eventType.includes('viewed') || eventType.includes('accessed')) {
      return 'text-blue-600 dark:text-blue-400';
    }
    if (eventType.includes('downloaded')) {
      return 'text-purple-600 dark:text-purple-400';
    }
    return 'text-gray-600 dark:text-gray-400';
  };

  const getEventDescription = (log: VdrAuditLog) => {
    const actor = log.userId ? 'User' : 'External User';
    const actorId = log.userId || log.externalUserId || 'Unknown';
    
    const eventDescriptions: Record<string, string> = {
      document_uploaded: `uploaded a document`,
      document_viewed: `viewed a document`,
      document_downloaded: `downloaded a document`,
      document_deleted: `deleted a document`,
      document_moved: `moved a document`,
      folder_created: `created a folder`,
      folder_renamed: `renamed a folder`,
      folder_deleted: `deleted a folder`,
      folder_moved: `moved a folder`,
      permission_granted: `granted permissions`,
      permission_revoked: `revoked permissions`,
      external_user_invited: `invited an external user`,
      external_user_accessed: `accessed the data room`,
    };

    const action = eventDescriptions[log.eventType] || log.eventType.replace(/_/g, ' ');
    return { actor, actorId, action };
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const { action, actorId } = getEventDescription(log);
    const searchLower = searchTerm.toLowerCase();
    return (
      action.toLowerCase().includes(searchLower) ||
      actorId.toLowerCase().includes(searchLower) ||
      log.eventType.toLowerCase().includes(searchLower) ||
      log.ipAddress?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading audit logs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Audit Trail</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive activity log for compliance and security
          </p>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by action, user, or IP address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
            data-testid="input-search-audit-logs"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filteredLogs.length} of {logs.length} events
          </span>
        </div>
      )}

      {logs.length === 0 ? (
        <Card className="p-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
          <p className="text-sm text-muted-foreground">
            All document activities will appear here automatically
          </p>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card className="p-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Matching Events</h3>
          <p className="text-sm text-muted-foreground">
            Try a different search term
          </p>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const { actor, actorId, action } = getEventDescription(log);
              const Icon = getEventIcon(log.eventType);
              const iconColor = getEventColor(log.eventType);

              return (
                <div
                  key={log.id}
                  className="relative pl-14 pb-4"
                  data-testid={`audit-log-${log.id}`}
                >
                  <div className={`absolute left-4 top-1 p-1.5 rounded-full bg-background border-2 ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <Card className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium" data-testid={`audit-log-actor-${log.id}`}>
                              {actor} {actorId.substring(0, 8)}
                            </span>
                            <span className="text-muted-foreground">{action}</span>
                          </div>
                          {log.metadata && typeof log.metadata === 'object' && (
                            <div className="text-sm text-muted-foreground pl-6">
                              {Object.entries(log.metadata as Record<string, any>).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span> {String(value)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <time dateTime={log.timestamp}>
                              {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                            </time>
                          </div>
                          {log.ipAddress && (
                            <div className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              <span>{log.ipAddress}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {(log.documentId || log.folderId) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6 pt-1 border-t">
                          {log.documentId && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              <span>Document ID: {log.documentId.substring(0, 8)}</span>
                            </div>
                          )}
                          {log.folderId && (
                            <div className="flex items-center gap-1">
                              <Folder className="h-3 w-3" />
                              <span>Folder ID: {log.folderId.substring(0, 8)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
