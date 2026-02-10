/**
 * DdChecklistProjectWrapper
 * 
 * Wraps DdChecklistPanel for use in the DD Tracker project page.
 * Auto-resolves or creates a workspace for the given projectId.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DdChecklistPanel from './DdChecklistPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ClipboardList } from 'lucide-react';

interface Props {
  projectId: string;
  projectName?: string;
}

export default function DdChecklistProjectWrapper({ projectId, projectName }: Props) {
  const qc = useQueryClient();

  // Try to find existing workspace linked to this project
  const { data: workspace, isLoading, error } = useQuery({
    queryKey: ['workspace-link', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/workspace-link`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  // Auto-create workspace for this project
  const createWorkspace = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/workspaces', {
        name: projectName || 'DD Workspace',
        description: `Auto-created for project ${projectId}`,
        ddProjectId: projectId,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-link', projectId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No workspace linked yet — offer to create one
  if (!workspace?.id) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">DD Request Checklist</h3>
            <p className="text-muted-foreground mb-6">
              Set up the DD Request List to track all due diligence items, assign owners, and share with sellers.
            </p>
            <Button
              onClick={() => createWorkspace.mutate()}
              disabled={createWorkspace.isPending}
            >
              {createWorkspace.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <ClipboardList className="h-4 w-4 mr-2" />
              Set Up DD Request List
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <DdChecklistPanel workspaceId={workspace.id} />;
}
