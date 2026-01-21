import { useEffect, useRef, useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { apiRequest } from '@/lib/queryClient';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseFormAutosaveOptions<T extends FieldValues> {
  form: UseFormReturn<T>;
  entityId: string | null | undefined;
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  enabled?: boolean;
  debounceMs?: number;
  invalidateQueries?: string[];
  transformData?: (data: T) => any;
  watchFields?: Path<T>[];
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

export function useFormAutosave<T extends FieldValues>({
  form,
  entityId,
  endpoint,
  method = 'PATCH',
  enabled = true,
  debounceMs = 2000,
  invalidateQueries = [],
  transformData,
  watchFields,
  onSaveSuccess,
  onSaveError,
}: UseFormAutosaveOptions<T>) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string | null>(null);
  const pendingSaveRef = useRef<T | null>(null);

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
        queryClient.invalidateQueries({ queryKey: [queryKey] });
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

  const debouncedSave = useCallback((data: T) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    pendingSaveRef.current = data;
    
    debounceTimerRef.current = setTimeout(() => {
      if (pendingSaveRef.current) {
        saveNow(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    }, debounceMs);
  }, [saveNow, debounceMs]);

  const forceSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    const currentData = form.getValues();
    saveNow(currentData);
  }, [form, saveNow]);

  const flushPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    if (pendingSaveRef.current) {
      saveNow(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
  }, [saveNow]);

  useEffect(() => {
    if (!enabled || !entityId) return;

    const watchedValues = watchFields 
      ? form.watch(watchFields as any)
      : form.watch();

    const subscription = form.watch((data) => {
      if (form.formState.isDirty) {
        debouncedSave(data as T);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [form, enabled, entityId, debouncedSave, watchFields]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSaveRef.current || saveMutation.isPending) {
        flushPendingSave();
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && pendingSaveRef.current) {
        flushPendingSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushPendingSave, saveMutation.isPending]);

  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        const data = pendingSaveRef.current;
        pendingSaveRef.current = null;
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
    forceSave,
    flushPendingSave,
    error: saveMutation.error,
  };
}
