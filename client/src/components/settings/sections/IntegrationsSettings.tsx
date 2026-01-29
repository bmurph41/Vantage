import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plug,
  Link2,
  Unlink,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { UserSettings, UserProfile, Organization } from '@/types/settings';

interface IntegrationsSettingsProps {
  settings: UserSettings;
  profile: UserProfile;
  organization: Organization | null;
  onChange: (updates: Partial<UserSettings>) => void;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  category: 'accounting' | 'marina' | 'communication' | 'storage';
}

// Mock integration data - in real app this would come from API
const INTEGRATIONS: Integration[] = [
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync financial data and invoices',
    icon: '📊',
    status: 'disconnected',
    category: 'accounting',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Accounting software integration',
    icon: '📈',
    status: 'disconnected',
    category: 'accounting',
  },
  {
    id: 'dockwa',
    name: 'Dockwa',
    description: 'Marina management and reservations',
    icon: '⚓',
    status: 'disconnected',
    category: 'marina',
  },
  {
    id: 'molo',
    name: 'Molo',
    description: 'Marina operations platform',
    icon: '🚤',
    status: 'disconnected',
    category: 'marina',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email sync and tracking',
    icon: '✉️',
    status: 'disconnected',
    category: 'communication',
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    description: 'Email and calendar sync',
    icon: '📧',
    status: 'disconnected',
    category: 'communication',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Cloud file storage',
    icon: '📁',
    status: 'disconnected',
    category: 'storage',
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    description: 'Cloud file storage',
    icon: '☁️',
    status: 'disconnected',
    category: 'storage',
  },
];

function getStatusIcon(status: Integration['status']) {
  switch (status) {
    case 'connected':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status: Integration['status']) {
  switch (status) {
    case 'connected':
      return <Badge variant="secondary" className="text-green-600">Connected</Badge>;
    case 'error':
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">Not Connected</Badge>;
  }
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const isConnected = integration.status === 'connected';

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-4">
        <div className="text-2xl">{integration.icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{integration.name}</h4>
            {getStatusBadge(integration.status)}
          </div>
          <p className="text-sm text-muted-foreground">{integration.description}</p>
          {integration.lastSync && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last synced: {new Date(integration.lastSync).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </Button>
            <Button variant="ghost" size="sm">
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm">
            <Link2 className="h-4 w-4 mr-2" />
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

export function IntegrationsSettings({
  settings,
  profile,
  organization,
}: IntegrationsSettingsProps) {
  const accountingIntegrations = INTEGRATIONS.filter((i) => i.category === 'accounting');
  const marinaIntegrations = INTEGRATIONS.filter((i) => i.category === 'marina');
  const communicationIntegrations = INTEGRATIONS.filter((i) => i.category === 'communication');
  const storageIntegrations = INTEGRATIONS.filter((i) => i.category === 'storage');

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Connected Integrations
          </CardTitle>
          <CardDescription>
            Connect your favorite tools to streamline your workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">
                <strong>0</strong> connected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">
                <strong>{INTEGRATIONS.length}</strong> available
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounting */}
      <Card>
        <CardHeader>
          <CardTitle>Accounting Software</CardTitle>
          <CardDescription>Sync financial data with your accounting system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accountingIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </CardContent>
      </Card>

      {/* Marina Management */}
      <Card>
        <CardHeader>
          <CardTitle>Marina Management</CardTitle>
          <CardDescription>Connect marina operations and reservation systems</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {marinaIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </CardContent>
      </Card>

      {/* Communication */}
      <Card>
        <CardHeader>
          <CardTitle>Communication</CardTitle>
          <CardDescription>Email and calendar integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {communicationIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader>
          <CardTitle>Cloud Storage</CardTitle>
          <CardDescription>Connect file storage services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {storageIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </CardContent>
      </Card>

      {/* API / Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Developer Options</CardTitle>
          <CardDescription>Advanced integration options for developers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <h4 className="font-medium text-sm">API Documentation</h4>
              <p className="text-sm text-muted-foreground">
                Build custom integrations with our REST API
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Docs
              </a>
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <h4 className="font-medium text-sm">Webhooks</h4>
              <p className="text-sm text-muted-foreground">
                Receive real-time notifications for events
              </p>
            </div>
            <Badge variant="outline">Coming Soon</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}