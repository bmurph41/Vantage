import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useOmEditorStore } from '@/stores/om-editor-store';
import { useToast } from '@/hooks/use-toast';
import debounce from 'lodash.debounce';

interface UseAutosaveOptions {
  enabled?: boolean;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

export function useAutosave(omId: string | null, userId: string, options: UseAutosaveOptions = {}) {
  const {
    enabled = true,
    debounceMs = 3000,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  } = options;

  const { toast } = useToast();
  const { isDirty, getSnapshot, markSaved } = useOmEditorStore();
  const lastSavedSnapshotRef = useRef<string | null>(null);
  
  const saveMutation = useMutation({
    mutationFn: async (snapshot: any) => {
      if (!omId) throw new Error('No document ID');
      return apiRequest(`/api/om-builder/oms/${omId}/autosave`, {
        method: 'POST',
        body: JSON.stringify({ snapshot, userId }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onMutate: () => {
      onSaveStart?.();
    },
    onSuccess: () => {
      markSaved();
      onSaveSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Autosave failed:', error);
      onSaveError?.(error);
      toast({
        title: 'Autosave failed',
        description: 'Your changes could not be saved automatically.',
        variant: 'destructive',
      });
    },
  });

  const saveNow = useCallback(() => {
    if (!omId || !enabled) return;
    
    const snapshot = getSnapshot();
    const snapshotStr = JSON.stringify(snapshot);
    
    if (snapshotStr === lastSavedSnapshotRef.current) {
      return;
    }
    
    lastSavedSnapshotRef.current = snapshotStr;
    saveMutation.mutate(snapshot);
  }, [omId, enabled, getSnapshot, saveMutation]);

  const debouncedSave = useRef(
    debounce(() => {
      saveNow();
    }, debounceMs)
  ).current;

  useEffect(() => {
    if (isDirty && enabled && omId) {
      debouncedSave();
    }
    
    return () => {
      debouncedSave.cancel();
    };
  }, [isDirty, enabled, omId, debouncedSave]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && saveMutation.isPending) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saveMutation.isPending]);

  return {
    isSaving: saveMutation.isPending,
    lastSaveError: saveMutation.error,
    saveNow,
    forceSave: () => {
      debouncedSave.cancel();
      saveNow();
    },
  };
}
