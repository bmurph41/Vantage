import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../store/editor-store';
import { apiRequest } from '@/lib/queryClient';

const AUTOSAVE_DELAY = 3000;

interface UseAutosaveOptions {
  omId: string | null;
  enabled?: boolean;
}

export function useAutosave({ omId, enabled = true }: UseAutosaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlocksRef = useRef<string>('');
  
  const {
    blocks,
    pages,
    autosave,
    setAutosaveState,
    markSaved,
  } = useEditorStore();

  const performSave = useCallback(async () => {
    if (!omId || !enabled) return;
    
    const blocksJson = JSON.stringify(blocks);
    if (blocksJson === lastBlocksRef.current) {
      return;
    }
    
    setAutosaveState({ isSaving: true, error: null });
    
    try {
      const snapshot = {
        schemaVersion: 1,
        meta: {
          title: 'Untitled',
          projectId: 0,
          format: 'letter-portrait',
          bleed: { top: 9, right: 9, bottom: 9, left: 9 },
          safetyMargin: { top: 36, right: 36, bottom: 36, left: 36 },
        },
        pages: pages.map((p, i) => ({
          id: p.id,
          index: i,
          name: p.title,
          blocks: blocks.filter(b => true).map(b => b.id),
        })),
        blocks: blocks.reduce((acc, b) => {
          acc[b.id] = b;
          return acc;
        }, {} as Record<string, any>),
        bindings: {
          projectId: 0,
          keysUsed: [],
        },
      };

      await apiRequest(`/api/om-builder/oms/${omId}/autosave`, {
        method: 'POST',
        body: JSON.stringify({ snapshot }),
      });
      
      lastBlocksRef.current = blocksJson;
      markSaved();
    } catch (error: any) {
      console.error('Autosave failed:', error);
      setAutosaveState({ 
        isSaving: false, 
        error: error.message || 'Autosave failed' 
      });
    }
  }, [omId, enabled, blocks, pages, setAutosaveState, markSaved]);

  useEffect(() => {
    if (!enabled || !omId || !autosave.hasUnsavedChanges) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      performSave();
    }, AUTOSAVE_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, omId, autosave.hasUnsavedChanges, blocks, performSave]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autosave.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autosave.hasUnsavedChanges]);

  return {
    isSaving: autosave.isSaving,
    lastSavedAt: autosave.lastSavedAt,
    hasUnsavedChanges: autosave.hasUnsavedChanges,
    error: autosave.error,
    saveNow: performSave,
  };
}
