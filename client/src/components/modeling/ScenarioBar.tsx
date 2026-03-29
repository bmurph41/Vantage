import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Save, ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  description?: string;
  isBase?: boolean;
  isDefault?: boolean;
  updatedAt?: string;
}

interface CaseAssumption {
  id: string;
  caseId: string;
  category: string;
  key: string;
  value: string;
  label?: string | null;
  notes?: string | null;
}

interface ScenarioBarProps {
  projectId: string;
}

const SESSION_KEY_PREFIX = 'scenarioBar_active_';

export default function ScenarioBar({ projectId }: ScenarioBarProps) {
  const queryClient = useQueryClient();
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(() => {
    // Restore from sessionStorage on mount
    try {
      return sessionStorage.getItem(`${SESSION_KEY_PREFIX}${projectId}`) || null;
    } catch {
      return null;
    }
  });
  const [editedName, setEditedName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const casesQueryKey = [`/api/modeling/projects/${projectId}/cases`];

  const {
    data: scenarios = [],
    isLoading,
    isError,
  } = useQuery<Scenario[]>({
    queryKey: casesQueryKey,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/projects/${projectId}/cases`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0] ?? null;

  // Persist activeScenarioId to sessionStorage whenever it changes
  useEffect(() => {
    const id = activeScenario?.id;
    if (id) {
      try {
        sessionStorage.setItem(`${SESSION_KEY_PREFIX}${projectId}`, id);
      } catch {
        // sessionStorage unavailable
      }
    }
  }, [activeScenario?.id, projectId]);

  // If the restored ID doesn't match any scenario, fall back to first
  useEffect(() => {
    if (scenarios.length > 0 && activeScenarioId && !scenarios.find((s) => s.id === activeScenarioId)) {
      setActiveScenarioId(scenarios[0].id);
    }
  }, [scenarios, activeScenarioId]);

  // Fetch assumptions for the active scenario so SAVE can persist them
  const activeId = activeScenario?.id;
  const assumptionsQueryKey = [`/api/modeling/cases/${activeId}/assumptions`];

  const { data: currentAssumptions = [] } = useQuery<CaseAssumption[]>({
    queryKey: assumptionsQueryKey,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/cases/${activeId}/assumptions`);
      return res.json();
    },
    enabled: !!activeId,
  });

  const displayName = isEditing ? editedName : (activeScenario?.name ?? '');
  const quickSwitchScenarios = scenarios.slice(0, 3);

  // --- Mutations ---

  // Rename a case
  const renameMutation = useMutation({
    mutationFn: async ({ caseId, name }: { caseId: string; name: string }) => {
      const res = await apiRequest('PATCH', `/api/modeling/cases/${caseId}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: casesQueryKey });
    },
    onError: (error: Error) => {
      toast({ title: 'Rename failed', description: error.message, variant: 'destructive' });
    },
  });

  // Save assumptions for a case
  const saveAssumptionsMutation = useMutation({
    mutationFn: async ({ caseId, assumptions }: { caseId: string; assumptions: Omit<CaseAssumption, 'id' | 'caseId'>[] }) => {
      const res = await apiRequest('PUT', `/api/modeling/cases/${caseId}/assumptions`, { assumptions });
      return res.json();
    },
    onSuccess: () => {
      if (activeId) {
        queryClient.invalidateQueries({ queryKey: assumptionsQueryKey });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });

  // Create a new case
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/cases`, { name });
      return res.json();
    },
    onSuccess: (newCase: Scenario) => {
      queryClient.invalidateQueries({ queryKey: casesQueryKey });
      setActiveScenarioId(newCase.id);
      dispatchScenarioSwitch(newCase.id, newCase.name);
      toast({ title: 'Scenario created', description: `"${newCase.name}" has been added.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
    },
  });

  // Delete a case
  const deleteMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const res = await apiRequest('DELETE', `/api/modeling/cases/${caseId}`);
      return res.json();
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: casesQueryKey });
      setDeleteConfirmId(null);
      // If we deleted the active scenario, switch to first available
      if (deletedId === activeScenario?.id) {
        const remaining = scenarios.filter((s) => s.id !== deletedId);
        if (remaining.length > 0) {
          setActiveScenarioId(remaining[0].id);
          dispatchScenarioSwitch(remaining[0].id, remaining[0].name);
        } else {
          setActiveScenarioId(null);
        }
      }
      toast({ title: 'Scenario deleted', description: 'The scenario has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      setDeleteConfirmId(null);
    },
  });

  // --- Helpers ---

  function dispatchScenarioSwitch(scenarioId: string, scenarioName?: string) {
    window.dispatchEvent(
      new CustomEvent('scenario-switch', {
        detail: { projectId, scenarioId, scenarioName },
      }),
    );
    // Invalidate pro-forma and returns data so they reload with new assumptions
    queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/pro-forma`] });
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
    queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/returns`] });
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'returns'] });
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'assumptions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/cases', scenarioId, 'assumptions'] });
  }

  function handleSwitchScenario(scenarioId: string) {
    setActiveScenarioId(scenarioId);
    setIsEditing(false);
    setLoadOpen(false);
    setDeleteConfirmId(null);

    const scenario = scenarios.find((s) => s.id === scenarioId);
    dispatchScenarioSwitch(scenarioId, scenario?.name);
  }

  function handleNameFocus() {
    setIsEditing(true);
    setEditedName(activeScenario?.name ?? '');
  }

  function handleNameBlur() {
    if (editedName === activeScenario?.name) {
      setIsEditing(false);
    }
  }

  function handleSave() {
    if (!activeScenario) return;

    const isSaving = saveAssumptionsMutation.isPending || renameMutation.isPending;
    if (isSaving) return;

    // 1. Dispatch event so workspace can flush any pending dirty state
    window.dispatchEvent(
      new CustomEvent('scenario-save', {
        detail: { projectId, scenarioId: activeScenario.id },
      }),
    );

    // 2. Save assumptions (current state from server, which the workspace may have just flushed)
    const strippedAssumptions = currentAssumptions.map(({ category, key, value, label, notes }) => ({
      category,
      key,
      value,
      label,
      notes,
    }));

    saveAssumptionsMutation.mutate(
      { caseId: activeScenario.id, assumptions: strippedAssumptions },
      {
        onSuccess: () => {
          toast({ title: 'Scenario saved', description: 'Assumptions have been saved.' });
        },
      },
    );

    // 3. If the name was edited, also rename
    const trimmedName = editedName.trim();
    if (isEditing && trimmedName && trimmedName !== activeScenario.name) {
      renameMutation.mutate({ caseId: activeScenario.id, name: trimmedName });
    }

    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedName(activeScenario?.name ?? '');
    }
  }

  function handleNewScenario() {
    const nextNumber = scenarios.length + 1;
    createMutation.mutate(`Scenario ${nextNumber}`);
  }

  function handleDeleteScenario(scenarioId: string) {
    if (deleteConfirmId === scenarioId) {
      deleteMutation.mutate(scenarioId);
    } else {
      setDeleteConfirmId(scenarioId);
    }
  }

  const isSaving = saveAssumptionsMutation.isPending || renameMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex h-9 items-center justify-center border-b bg-white px-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading scenarios...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-9 items-center border-b bg-white px-4">
        <span className="text-sm text-destructive">Failed to load scenarios</span>
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center gap-2 border-b bg-white px-4">
      {/* Editable scenario name */}
      <Input
        value={displayName}
        onChange={(e) => setEditedName(e.target.value)}
        onFocus={handleNameFocus}
        onBlur={handleNameBlur}
        onKeyDown={handleKeyDown}
        placeholder="Scenario name"
        className="h-7 w-48 text-sm font-medium"
        disabled={!activeScenario}
      />

      {/* Save button */}
      <Button
        size="sm"
        variant="default"
        className="h-7 bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700"
        onClick={handleSave}
        disabled={!activeScenario || isSaving}
      >
        {isSaving ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Save className="mr-1 h-3 w-3" />
        )}
        SAVE
      </Button>

      {/* Load dropdown */}
      <Popover open={loadOpen} onOpenChange={(open) => { setLoadOpen(open); if (!open) setDeleteConfirmId(null); }}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs font-semibold"
            disabled={scenarios.length === 0}
          >
            LOAD
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          {scenarios.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No saved scenarios</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {scenarios.map((scenario) => (
                <li key={scenario.id} className="flex items-center">
                  <button
                    type="button"
                    className={`flex flex-1 items-center justify-between rounded-sm px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
                      scenario.id === activeScenario?.id
                        ? 'bg-accent font-medium'
                        : ''
                    }`}
                    onClick={() => handleSwitchScenario(scenario.id)}
                  >
                    <span className="truncate">{scenario.name}</span>
                    {(scenario.isBase || scenario.isDefault) && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Base
                      </Badge>
                    )}
                  </button>
                  {/* Delete button */}
                  <button
                    type="button"
                    className={`ml-1 flex-shrink-0 rounded p-1 transition-colors hover:bg-destructive/10 ${
                      deleteConfirmId === scenario.id
                        ? 'text-destructive'
                        : 'text-muted-foreground hover:text-destructive'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteScenario(scenario.id);
                    }}
                    title={deleteConfirmId === scenario.id ? 'Click again to confirm delete' : 'Delete scenario'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      {/* New Scenario button */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={handleNewScenario}
        disabled={createMutation.isPending}
        title="New scenario"
      >
        {createMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick-switch pills */}
      <div className="flex items-center gap-1">
        {quickSwitchScenarios.map((scenario) => (
          <Button
            key={scenario.id}
            size="sm"
            variant={scenario.id === activeScenario?.id ? 'default' : 'outline'}
            className={`h-6 rounded-full px-3 text-xs ${
              scenario.id === activeScenario?.id
                ? 'border-primary bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => handleSwitchScenario(scenario.id)}
          >
            {scenario.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
