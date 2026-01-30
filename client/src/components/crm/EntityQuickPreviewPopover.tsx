import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Plus, FileText, Calendar } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { CrmActionComposerModal } from './CrmActionComposerModal';
import { Link } from 'wouter';

interface EntityQuickPreviewPopoverProps {
  entityType: 'deal' | 'lead';
  entityId: string;
  children?: React.ReactNode;
}

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function EntityQuickPreviewPopover({
  entityType,
  entityId,
  children,
}: EntityQuickPreviewPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerTab, setComposerTab] = useState<'note' | 'activity'>('activity');
  
  const { data: preview, isLoading } = useQuery({
    queryKey: [`crm${entityType}Preview`, entityId],
    queryFn: () => apiRequest(`/api/crm/${entityType}s/${entityId}/preview`),
    enabled: isOpen,
    staleTime: 30000,
  });
  
  const handleAddActivity = () => {
    setComposerTab('activity');
    setShowComposer(true);
    setIsOpen(false);
  };
  
  const handleAddNote = () => {
    setComposerTab('note');
    setShowComposer(true);
    setIsOpen(false);
  };
  
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {children || (
            <Button variant="link" className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              {isLoading ? <Skeleton className="h-4 w-24" /> : preview?.name || 'Loading...'}
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : preview ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-sm">{preview.name}</h4>
                  {preview.value && (
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(preview.value)}
                    </p>
                  )}
                </div>
                <Badge variant="outline">{preview.stage || preview.status}</Badge>
              </div>
              
              {preview.owner && (
                <p className="text-sm text-muted-foreground">
                  Owner: {preview.owner.name}
                </p>
              )}
              
              {preview.nextActivity ? (
                <div className="bg-muted rounded-lg p-2 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3" />
                    <span>Next Activity</span>
                  </div>
                  <p className="font-medium">{preview.nextActivity.subject || preview.nextActivity.description?.substring(0, 50)}</p>
                  {preview.nextActivity.scheduledAt && (
                    <p className="text-muted-foreground text-xs">
                      {new Date(preview.nextActivity.scheduledAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No upcoming activities</p>
              )}
              
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/crm/${entityType}s/${entityId}`}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddActivity}>
                  <Plus className="h-3 w-3 mr-1" />
                  Activity
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddNote}>
                  <FileText className="h-3 w-3 mr-1" />
                  Note
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load preview</p>
          )}
        </PopoverContent>
      </Popover>
      
      {showComposer && preview && (
        <CrmActionComposerModal
          open={showComposer}
          onOpenChange={setShowComposer}
          context={{
            entityType,
            entityId,
            entityName: preview.name,
          }}
          defaultTab={composerTab}
        />
      )}
    </>
  );
}
