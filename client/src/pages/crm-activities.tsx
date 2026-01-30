import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { ActivitiesTable } from '@/components/crm/ActivitiesTable';
import { ActivitiesFilterBar } from '@/components/crm/ActivitiesFilterBar';

export default function CrmActivitiesPage() {
  const [timeWindow, setTimeWindow] = useState('all');
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  
  const queryParams = new URLSearchParams();
  if (timeWindow !== 'all') queryParams.set('timeWindow', timeWindow);
  if (status !== 'all') queryParams.set('status', status);
  if (type !== 'all') queryParams.set('type', type);
  if (search) queryParams.set('q', search);
  
  const { data, isLoading } = useQuery({
    queryKey: ['crmActivities', timeWindow, status, type, search],
    queryFn: () => apiRequest(`/api/crm/activities?${queryParams.toString()}`),
  });
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activities</h1>
          <p className="text-muted-foreground">
            Manage your scheduled calls, meetings, tasks, and follow-ups
          </p>
        </div>
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
    </div>
  );
}
