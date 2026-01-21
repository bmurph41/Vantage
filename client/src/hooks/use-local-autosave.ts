import { useEffect, useRef, useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseLocalAutosaveOptions<T> {
  entityId: string | null | undefined;
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  enabled?: boolean;
  debounceMs?: number;
  invalidateQueries?: string[][];
  transformData?: (data: T) => any;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

export function useLocalAutosave<T>({
  entityId,
  endpoint,
  method = 'POST',
  enabled = true,
  debounceMs = 2000,
  invalidateQueries = [],
  transformData,
  onSaveSuccess,
  onSaveError,
}: UseLocalAutosaveOptions<T>) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string | null>(null);
  const pendingDataRef = useRef<T | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (data: T) => {
      if (!entityId) throw new Error('No entity ID');
      const fullEndpoint = endpoint.includes('{id}') 
        ? endpoint.replace('{id}', entityId) 
        : `${endpoint}/${entityId}`;
      
      const payload = transformData ? transformData(data) : data;
      
      const response = await apiRequest(method, fullEndpoint, payload);
      return response.json();
    },
    onMutate: () => {
      setStatus('saving');
    },
    onSuccess: () => {
      setStatus('saved');
      setLastSavedAt(new Date());
      onSaveSuccess?.();
      
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });

      setTimeout(() => {
        setStatus(prev => prev === 'saved' ? 'idle' : prev);
      }, 3000);
    },
    onError: (error: Error) => {
      console.error('Autosave failed:', error);
      setStatus('error');
      onSaveError?.(error);
      
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    },
  });

  const saveNow = useCallback((data: T) => {
    if (!entityId || !enabled) return;
    
    const dataStr = JSON.stringify(data);
    if (dataStr === lastSavedDataRef.current) {
      return;
    }
    
    lastSavedDataRef.current = dataStr;
    saveMutation.mutate(data);
  }, [entityId, enabled, saveMutation]);

  const triggerAutosave = useCallback((data: T) => {
    if (!enabled || !entityId) return;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    pendingDataRef.current = data;
    
    debounceTimerRef.current = setTimeout(() => {
      if (pendingDataRef.current) {
        saveNow(pendingDataRef.current);
        pendingDataRef.current = null;
      }
    }, debounceMs);
  }, [saveNow, debounceMs, enabled, entityId]);

  const forceSave = useCallback((data: T) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingDataRef.current = null;
    saveNow(data);
  }, [saveNow]);

  const flushPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    if (pendingDataRef.current) {
      saveNow(pendingDataRef.current);
      pendingDataRef.current = null;
    }
  }, [saveNow]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingDataRef.current || saveMutation.isPending) {
        flushPendingSave();
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && pendingDataRef.current) {
        flushPendingSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [flushPendingSave, saveMutation.isPending]);

  useEffect(() => {
    return () => {
      if (pendingDataRef.current) {
        const data = pendingDataRef.current;
        pendingDataRef.current = null;
        saveNow(data);
      }
    };
  }, []);

  return {
    status,
    isSaving: status === 'saving',
    isSaved: status === 'saved',
    hasError: status === 'error',
    lastSavedAt,
    triggerAutosave,
    forceSave,
    flushPendingSave,
    error: saveMutation.error,
  };
}
