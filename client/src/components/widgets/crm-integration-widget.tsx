import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Link2, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  RotateCcw,
  Clock,
  Database,
  Settings,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useState } from "react";

interface CrmConnection {
  id: string;
  crmType: string;
  name: string;
  status: 'connected' | 'error' | 'syncing' | 'disconnected';
  lastSync: string;
  syncStatus: {
    contacts: { synced: number; total: number; errors: number };
    companies: { synced: number; total: number; errors: number };
    deals: { synced: number; total: number; errors: number };
  };
  isActive: boolean;
}

interface CrmIntegrationData {
  connections: CrmConnection[];
  summary: {
    totalConnections: number;
    activeConnections: number;
    lastSyncTime: string;
    totalRecordsSynced: number;
  };
}

const statusColors = {
  connected: 'text-green-600 bg-green-50 border-green-200',
  error: 'text-red-600 bg-red-50 border-red-200',
  syncing: 'text-blue-600 bg-blue-50 border-blue-200',
  disconnected: 'text-gray-600 bg-gray-50 border-gray-200'
};

const statusIcons = {
  connected: CheckCircle,
  error: XCircle,
  syncing: RotateCcw,
  disconnected: AlertCircle
};

const statusLabels = {
  connected: 'Connected',
  error: 'Error',
  syncing: 'Syncing',
  disconnected: 'Disconnected'
};

const crmLogos = {
  salesforce: '🏢',
  hubspot: '🔶',
  pipedrive: '📊',
  zoho: '📋'
};

export default function CrmIntegrationWidget() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: crmData, isLoading, refetch } = useQuery<CrmIntegrationData>({
    queryKey: ['/api/crm/status'],
    refetchInterval: 60000, // Refresh every minute
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getTotalSyncedRecords = (connection: CrmConnection) => {
    return connection.syncStatus.contacts.synced + 
           connection.syncStatus.companies.synced + 
           connection.syncStatus.deals.synced;
  };

  const getTotalErrors = (connection: CrmConnection) => {
    return connection.syncStatus.contacts.errors + 
           connection.syncStatus.companies.errors + 
           connection.syncStatus.deals.errors;
  };

  if (isLoading) {
    return (
      <Card className="h-full" data-testid="crm-integration-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            CRM Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!crmData || crmData.connections.length === 0) {
    return (
      <Card className="h-full" data-testid="crm-integration-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            CRM Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Link2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No CRM integrations</p>
            <p className="text-sm">Connect your CRM to sync data automatically</p>
            <Button variant="outline" size="sm" className="mt-3" data-testid="add-crm-integration">
              <ExternalLink className="w-4 h-4 mr-1" />
              Add Integration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full" data-testid="crm-integration-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            CRM Integrations
            <Badge variant="outline" className="ml-2">
              {crmData.summary.activeConnections} / {crmData.summary.totalConnections} active
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="refresh-crm-status"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" data-testid="manage-integrations">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {crmData.summary.totalRecordsSynced.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Records Synced</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {crmData.summary.lastSyncTime ? formatTimeAgo(crmData.summary.lastSyncTime) : 'Never'}
            </div>
            <div className="text-xs text-gray-500">Last Sync</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {crmData.connections.map((connection, index) => {
            const StatusIcon = statusIcons[connection.status];
            const totalSynced = getTotalSyncedRecords(connection);
            const totalErrors = getTotalErrors(connection);
            
            return (
              <div key={connection.id}>
                <div 
                  className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  data-testid={`crm-connection-${index}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="text-xl">
                        {crmLogos[connection.crmType as keyof typeof crmLogos] || '🔗'}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-gray-900">
                          {connection.name}
                        </h4>
                        <div className="text-xs text-gray-500 capitalize">
                          {connection.crmType}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className={`px-2 py-1 rounded text-xs border ${statusColors[connection.status]}`}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusLabels[connection.status]}
                      </div>
                      {!connection.isActive && (
                        <Badge variant="outline" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Sync Statistics */}
                  <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                    <div className="text-center">
                      <div className="font-medium text-gray-900">
                        {connection.syncStatus.contacts.synced}
                      </div>
                      <div className="text-gray-500">Contacts</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-gray-900">
                        {connection.syncStatus.companies.synced}
                      </div>
                      <div className="text-gray-500">Companies</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-gray-900">
                        {connection.syncStatus.deals.synced}
                      </div>
                      <div className="text-gray-500">Deals</div>
                    </div>
                  </div>
                  
                  {/* Status Information */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Database className="w-3 h-3" />
                      <span>{totalSynced.toLocaleString()} total synced</span>
                      {totalErrors > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600">{totalErrors} errors</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(connection.lastSync)}</span>
                    </div>
                  </div>
                </div>
                {index < crmData.connections.length - 1 && <Separator className="my-2" />}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-600" />
            <div className="text-sm text-blue-800">
              <span className="font-medium">Sync Status:</span> All integrations are monitored 
              for data consistency and automatically sync changes.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}