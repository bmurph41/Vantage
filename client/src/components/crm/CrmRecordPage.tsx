import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, ExternalLink, MoreHorizontal, Phone, Mail, Plus, 
  Building2, User, MapPin, DollarSign, Calendar
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FocusHistoryTimeline } from './FocusHistoryTimeline';
import { CrmActionComposerModal } from './CrmActionComposerModal';
import UnifiedTimeline from './unified-timeline';
import { cn } from '@/lib/utils';

interface CrmRecordPageProps {
  entityType: 'company' | 'contact' | 'property' | 'deal';
  entityId: string;
  entityName: string;
  entitySubtitle?: string;
  status?: string;
  statusColor?: string;
  owner?: { id: string; name: string } | null;
  isLoading?: boolean;
  onBack?: () => void;
  backUrl?: string;
  headerActions?: React.ReactNode;
  overviewLeft: React.ReactNode;
  overviewRight?: React.ReactNode;
  associationsContent?: React.ReactNode;
  notesContent?: React.ReactNode;
  filesContent?: React.ReactNode;
  analyticsContent?: React.ReactNode;
  customTabs?: { value: string; label: string; content: React.ReactNode }[];
}

const entityTypeConfig = {
  company: { icon: Building2, label: 'Company', backLabel: 'Companies', backUrl: '/companies' },
  contact: { icon: User, label: 'Contact', backLabel: 'Contacts', backUrl: '/contacts' },
  property: { icon: MapPin, label: 'Property', backLabel: 'Properties', backUrl: '/properties' },
  deal: { icon: DollarSign, label: 'Deal', backLabel: 'Deals', backUrl: '/deals' },
};

export function CrmRecordPage({
  entityType,
  entityId,
  entityName,
  entitySubtitle,
  status,
  statusColor = 'bg-gray-100 text-gray-700',
  owner,
  isLoading,
  onBack,
  backUrl,
  headerActions,
  overviewLeft,
  overviewRight,
  associationsContent,
  notesContent,
  filesContent,
  analyticsContent,
  customTabs,
}: CrmRecordPageProps) {
  const [, setLocation] = useLocation();
  const [showComposer, setShowComposer] = useState(false);
  const [composerDefaultTab, setComposerDefaultTab] = useState<'note' | 'activity'>('activity');
  const [activeTab, setActiveTab] = useState('overview');
  
  const config = entityTypeConfig[entityType];
  const EntityIcon = config.icon;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backUrl) {
      setLocation(backUrl);
    } else {
      setLocation(config.backUrl);
    }
  };

  const openComposer = (tab: 'note' | 'activity') => {
    setComposerDefaultTab(tab);
    setShowComposer(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="border-b bg-white dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sticky top-0 z-10 border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBack}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {config.backLabel}
              </Button>
              
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <EntityIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {entityName}
                    </h1>
                    {status && (
                      <Badge variant="secondary" className={cn("text-xs", statusColor)}>
                        {status}
                      </Badge>
                    )}
                  </div>
                  {entitySubtitle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {entitySubtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {owner && (
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-xs text-gray-500">Owner:</span>
                  <Badge variant="outline" className="font-normal">
                    {owner.name}
                  </Badge>
                </div>
              )}
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => openComposer('note')}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Note
              </Button>
              
              <Button 
                size="sm" 
                onClick={() => openComposer('activity')}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Activity
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Phone className="h-4 w-4 mr-2" />
                    Log Call
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {headerActions}
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white dark:bg-gray-800 border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {notesContent && <TabsTrigger value="notes">Notes</TabsTrigger>}
            {filesContent && <TabsTrigger value="files">Files</TabsTrigger>}
            {associationsContent && <TabsTrigger value="associations">Associations</TabsTrigger>}
            {analyticsContent && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
            {customTabs?.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="overview" className="space-y-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {overviewLeft}
              </div>
              <div className="space-y-6">
                {overviewRight || (
                  <FocusHistoryTimeline
                    entityType={entityType}
                    entityId={entityId}
                    entityName={entityName}
                  />
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="timeline">
            <Card>
              <CardContent className="p-6">
                <UnifiedTimeline
                  entityType={entityType}
                  entityId={entityId}
                  maxHeight="600px"
                  showHeader={false}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          {notesContent && (
            <TabsContent value="notes">
              {notesContent}
            </TabsContent>
          )}
          
          {filesContent && (
            <TabsContent value="files">
              {filesContent}
            </TabsContent>
          )}
          
          {associationsContent && (
            <TabsContent value="associations">
              {associationsContent}
            </TabsContent>
          )}
          
          {analyticsContent && (
            <TabsContent value="analytics">
              {analyticsContent}
            </TabsContent>
          )}
          
          {customTabs?.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      <CrmActionComposerModal
        open={showComposer}
        onOpenChange={setShowComposer}
        context={{
          entityType,
          entityId,
          entityName,
        }}
        defaultTab={composerDefaultTab}
      />
    </div>
  );
}

export function RecordFieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
      </CardContent>
    </Card>
  );
}

export function RecordField({ 
  label, 
  value, 
  icon: Icon,
  href,
  emptyText = '-',
}: { 
  label: string; 
  value: React.ReactNode; 
  icon?: React.ComponentType<any>;
  href?: string;
  emptyText?: string;
}) {
  const content = value || emptyText;
  
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <Icon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        {href && value ? (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate block"
          >
            {content}
          </a>
        ) : (
          <p className="text-sm text-gray-900 dark:text-white truncate">{content}</p>
        )}
      </div>
    </div>
  );
}

export function AssociationCard({
  type,
  items,
  onViewAll,
  onAdd,
  renderItem,
}: {
  type: string;
  items: any[];
  onViewAll?: () => void;
  onAdd?: () => void;
  renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium capitalize">{type}</CardTitle>
          <div className="flex items-center gap-2">
            {items.length > 3 && onViewAll && (
              <Button variant="ghost" size="sm" onClick={onViewAll}>
                View all ({items.length})
              </Button>
            )}
            {onAdd && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}>
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No {type} linked
          </p>
        ) : (
          items.slice(0, 3).map(renderItem)
        )}
      </CardContent>
    </Card>
  );
}
