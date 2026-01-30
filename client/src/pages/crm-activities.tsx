import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { ActivitiesTable } from '@/components/crm/ActivitiesTable';
import { ActivitiesFilterBar } from '@/components/crm/ActivitiesFilterBar';
import { CrmActionComposerModal } from '@/components/crm/CrmActionComposerModal';

export default function CrmActivitiesPage() {
  const [timeWindow, setTimeWindow] = useState('all');
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('all');
  const [showComposer, setShowComposer] = useState(false);
  
  const { data: teamMembers } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/bootstrap').then((data: any) => data?.teamMembers || []);
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });
  
  const queryParams = new URLSearchParams();
  if (timeWindow !== 'all') queryParams.set('timeWindow', timeWindow);
  if (status !== 'all') queryParams.set('status', status);
  if (type !== 'all') queryParams.set('type', type);
  if (search) queryParams.set('q', search);
  if (ownerId && ownerId !== 'all') queryParams.set('ownerId', ownerId === 'me' ? 'current' : ownerId);
  
  const { data, isLoading } = useQuery({
    queryKey: ['crmActivities', timeWindow, status, type, search, ownerId],
    queryFn: () => apiRequest(`/api/crm/activities?${queryParams.toString()}`),
  });
  
  const formattedTeamMembers = (teamMembers || []).map((u: any) => ({
    id: u.id,
    name: u.displayName || u.email || 'Unknown',
  }));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activities</h1>
          <p className="text-muted-foreground">
            Manage your scheduled calls, meetings, tasks, and follow-ups
          </p>
        </div>
        <Button onClick={() => setShowComposer(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Activity
        </Button>
      </div>
      
      <Card>
        <CardHeader className="pb-4">
          <ActivitiesFilterBar
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
            status={status}
            onStatusChange={setStatus}
            type={type}
            onTypeChange={setType}
            search={search}
            onSearchChange={setSearch}
            ownerId={ownerId}
            onOwnerChange={setOwnerId}
            teamMembers={formattedTeamMembers}
            counts={data?.counts}
          />
        </CardHeader>
        <CardContent>
          <ActivitiesTable
            activities={data?.items || []}
            isLoading={isLoading}
            showEntityLinks={true}
          />
        </CardContent>
      </Card>
      
      <CrmActionComposerModal
        open={showComposer}
        onOpenChange={setShowComposer}
        context={{
          entityType: 'deal',
          entityId: '',
          entityName: 'General',
        }}
        defaultTab="activity"
      />
    </div>
  );
}
