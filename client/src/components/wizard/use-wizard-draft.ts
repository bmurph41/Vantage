/**
 * USE WIZARD DRAFT HOOK
 * Enterprise-grade wizard state persistence
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// ============================================
// TYPES
// ============================================

export type WizardType = "modeling" | "valuator" | "newProject";

export interface WizardDraft<T = Record<string, any>> {
  version: string;
  wizardType: WizardType;
  userId: string;
  createdAt: string;
  updatedAt: string;
  currentStepId: string;
  completedStepIds: string[];
  payload: T;
}

interface ServerDraftResponse {
  id: string;
  wizardType: WizardType;
  currentStepId: string;
  completedStepIds: string[];
  payload: Record<string, any>;
  version: string;
  createdAt: string;
  updatedAt: string;
}

interface UseWizardDraftOptions<T> {
  defaultPayload: T;
  defaultStepId?: string;
  onRestored?: (draft: WizardDraft<T>) => void;
  onSyncError?: (error: Error) => void;
  autoSync?: boolean;
  syncDebounceMs?: number;
}

interface UseWizardDraftReturn<T> {
  draft: WizardDraft<T> | null;
  isLoading: boolean;
  isInitialized: boolean;
  isSyncing: boolean;
  isOffline: boolean;
  hasExistingDraft: boolean;
  needsVersionMigration: boolean;
  payload: T;
  currentStepId: string;
  completedStepIds: string[];
  initializeDraft: (initialPayload?: Partial<T>) => void;
  updatePayload: <K extends keyof T>(key: K, value: T[K]) => void;
  updateNestedPayload: (path: string, value: any) => void;
  setPayload: (payload: T) => void;
  setCurrentStep: (stepId: string) => void;
  markStepComplete: (stepId: string) => void;
  clearDraft: () => Promise<void>;
  forceSyncToServer: () => Promise<void>;
  showResumeModal: boolean;
  pendingDraft: WizardDraft<T> | null;
  resumeDraft: () => void;
  startOver: () => Promise<void>;
  dismissResumeModal: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const CURRENT_VERSION = "1";
const DRAFT_EXPIRATION_DAYS = 14;
const DEFAULT_SYNC_DEBOUNCE_MS = 800;

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

function getLocalStorageKey(userId: string | null, wizardType: WizardType): string {
  const userPart = userId || "anonymous";
  return `mm_wizard_draft:${userPart}:${wizardType}`;
}

function getLocalDraft<T>(userId: string | null, wizardType: WizardType): WizardDraft<T> | null {
  try {
    const key = getLocalStorageKey(userId, wizardType);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const draft = JSON.parse(stored) as WizardDraft<T>;

    const updatedAt = new Date(draft.updatedAt);
    const expirationMs = DRAFT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

    if (Date.now() - updatedAt.getTime() > expirationMs) {
      localStorage.removeItem(key);
      console.log("[WIZARD_DRAFT] Local draft expired, removing");
      return null;
    }

    return draft;
  } catch (error) {
    console.error("[WIZARD_DRAFT] Failed to read from localStorage:", error);
    return null;
  }
}

function setLocalDraft<T>(userId: string | null, wizardType: WizardType, draft: WizardDraft<T>): void {
  try {
    const key = getLocalStorageKey(userId, wizardType);
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.error("[WIZARD_DRAFT] Failed to save to localStorage:", error);
  }
}

function clearLocalDraft(userId: string | null, wizardType: WizardType): void {
  try {
    const key = getLocalStorageKey(userId, wizardType);
    localStorage.removeItem(key);

    if (userId) {
      const anonymousKey = getLocalStorageKey(null, wizardType);
      localStorage.removeItem(anonymousKey);
    }
  } catch (error) {
    console.error("[WIZARD_DRAFT] Failed to clear localStorage:", error);
  }
}

function migrateAnonymousDraft<T>(userId: string, wizardType: WizardType): WizardDraft<T> | null {
  const anonymousDraft = getLocalDraft<T>(null, wizardType);
  if (anonymousDraft) {
    console.log("[WIZARD_DRAFT] Migrating anonymous draft to user");
    const migratedDraft: WizardDraft<T> = {
      ...anonymousDraft,
      userId,
      updatedAt: new Date().toISOString(),
    };
    setLocalDraft(userId, wizardType, migratedDraft);
    clearLocalDraft(null, wizardType);
    return migratedDraft;
  }
  return null;
}

// ============================================
// SERVER API HELPERS
// ============================================

async function fetchServerDraft(wizardType: WizardType): Promise<ServerDraftResponse | null> {
  try {
    const response = await fetch(`/api/wizard-drafts/${wizardType}`, {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) return null;
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    return data.ok ? data.draft : null;
  } catch (error) {
    console.error("[WIZARD_DRAFT] Failed to fetch server draft:", error);
    throw error;
  }
}

async function upsertServerDraft(
  wizardType: WizardType,
  draft: {
    currentStepId: string;
    completedStepIds: string[];
    payload: Record<string, any>;
    version: string;
  }
): Promise<ServerDraftResponse | null> {
  try {
    const response = await fetch(`/api/wizard-drafts/${wizardType}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    return data.ok ? data.draft : null;
  } catch (error) {
    console.error("[WIZARD_DRAFT] Failed to sync to server:", error);
    throw error;
  }
}

async function deleteServerDraft(wizardType: WizardType): Promise<boolean> {
  try {
    const response = await fetch(`/api/wizard-drafts/${wizardType}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error("[WIZARD_DRAFT] Failed to delete server draft:", error);
    return false;
  }
}

async function submitServerDraft(wizardType: WizardType): Promise<boolean> {
  try {
    const response = await fetch(`/api/wizard-drafts/${wizardType}/submit`, {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json();
    return data.ok;
  } catch {
    return false;
  }
}

// ============================================
// DEEP SET HELPER
// ============================================

function deepSet(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  const result = { ...obj };

  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    current[key] = current[key] !== undefined ? { ...current[key] } : {};
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

// ============================================
// MAIN HOOK
// ============================================

export function useWizardDraft<T extends Record<string, any>>(
  wizardType: WizardType,
  options: UseWizardDraftOptions<T>
): UseWizardDraftReturn<T> {
  const {
    defaultPayload,
    defaultStepId = "welcome",
    onRestored,
    onSyncError,
    autoSync = true,
    syncDebounceMs = DEFAULT_SYNC_DEBOUNCE_MS,
  } = options;

  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || null;

  // State
  const [draft, setDraft] = useState<WizardDraft<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<WizardDraft<T> | null>(null);
  const [needsVersionMigration, setNeedsVersionMigration] = useState(false);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);

  // Refs
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedHashRef = useRef<string | null>(null);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setIsLoading(true);

      try {
        if (userId) {
          migrateAnonymousDraft<T>(userId, wizardType);
        }

        const localDraft = getLocalDraft<T>(userId, wizardType);

        let serverDraft: ServerDraftResponse | null = null;
        if (userId) {
          try {
            serverDraft = await fetchServerDraft(wizardType);
          } catch {
            setIsOffline(true);
            console.log("[WIZARD_DRAFT] Server unreachable, using local only");
          }
        }

        if (!mounted) return;

        let draftToUse: WizardDraft<T> | null = null;

        if (localDraft && serverDraft) {
          const localTime = new Date(localDraft.updatedAt).getTime();
          const serverTime = new Date(serverDraft.updatedAt).getTime();

          if (localTime > serverTime) {
            draftToUse = localDraft;
            console.log("[WIZARD_DRAFT] Using local draft (newer)");
          } else {
            draftToUse = {
              version: serverDraft.version,
              wizardType: serverDraft.wizardType as WizardType,
              userId: userId!,
              createdAt: serverDraft.createdAt,
              updatedAt: serverDraft.updatedAt,
              currentStepId: serverDraft.currentStepId,
              completedStepIds: serverDraft.completedStepIds || [],
              payload: serverDraft.payload as T,
            };
            console.log("[WIZARD_DRAFT] Using server draft (newer)");
          }
        } else if (serverDraft) {
          draftToUse = {
            version: serverDraft.version,
            wizardType: serverDraft.wizardType as WizardType,
            userId: userId!,
            createdAt: serverDraft.createdAt,
            updatedAt: serverDraft.updatedAt,
            currentStepId: serverDraft.currentStepId,
            completedStepIds: serverDraft.completedStepIds || [],
            payload: serverDraft.payload as T,
          };
          console.log("[WIZARD_DRAFT] Using server draft (only)");
        } else if (localDraft) {
          draftToUse = localDraft;
          console.log("[WIZARD_DRAFT] Using local draft (only)");
        }

        if (draftToUse && draftToUse.version !== CURRENT_VERSION) {
          setNeedsVersionMigration(true);
          console.log("[WIZARD_DRAFT] Version mismatch, migration may be needed");
        }

        if (draftToUse) {
          setPendingDraft(draftToUse);
          setShowResumeModal(true);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("[WIZARD_DRAFT] Initialization error:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [userId, wizardType]);

  // ============================================
  // AUTO-SYNC TO SERVER (Debounced)
  // ============================================

  useEffect(() => {
    if (!autoSync || !draft || !userId || isOffline) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const draftHash = JSON.stringify({
      currentStepId: draft.currentStepId,
      completedStepIds: draft.completedStepIds,
      payload: draft.payload,
    });

    if (lastSyncedHashRef.current === draftHash) return;

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSyncing(true);
        await upsertServerDraft(wizardType, {
          currentStepId: draft.currentStepId,
          completedStepIds: draft.completedStepIds,
          payload: draft.payload,
          version: draft.version,
        });
        lastSyncedHashRef.current = draftHash;
        setIsOffline(false);
        setHasShownOfflineToast(false);
      } catch (error) {
        setIsOffline(true);
        onSyncError?.(error as Error);

        if (!hasShownOfflineToast) {
          toast({
            title: "Working Offline",
            description: "Progress saved locally. Will sync when connection is restored.",
            variant: "default",
          });
          setHasShownOfflineToast(true);
        }
      } finally {
        setIsSyncing(false);
      }
    }, syncDebounceMs);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [draft, userId, wizardType, autoSync, syncDebounceMs, isOffline, hasShownOfflineToast, onSyncError, toast]);

  // ============================================
  // ACTIONS
  // ============================================

  const createNewDraft = useCallback((initialPayload?: Partial<T>): WizardDraft<T> => {
    const now = new Date().toISOString();
    return {
      version: CURRENT_VERSION,
      wizardType,
      userId: userId || "anonymous",
      createdAt: now,
      updatedAt: now,
      currentStepId: defaultStepId,
      completedStepIds: [],
      payload: { ...defaultPayload, ...initialPayload } as T,
    };
  }, [wizardType, userId, defaultStepId, defaultPayload]);

  const initializeDraft = useCallback((initialPayload?: Partial<T>) => {
    const newDraft = createNewDraft(initialPayload);
    setDraft(newDraft);
    setLocalDraft(userId, wizardType, newDraft);
    console.log("[WIZARD_DRAFT] Initialized new draft");
  }, [createNewDraft, userId, wizardType]);

  const updateDraft = useCallback((updater: (prev: WizardDraft<T>) => WizardDraft<T>) => {
    setDraft((prev) => {
      if (!prev) return prev;

      const updated = updater({
        ...prev,
        updatedAt: new Date().toISOString(),
      });

      setLocalDraft(userId, wizardType, updated);

      return updated;
    });
  }, [userId, wizardType]);

  const updatePayload = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    updateDraft((prev) => ({
      ...prev,
      payload: { ...prev.payload, [key]: value },
    }));
  }, [updateDraft]);

  const updateNestedPayload = useCallback((path: string, value: any) => {
    updateDraft((prev) => ({
      ...prev,
      payload: deepSet(prev.payload, path, value),
    }));
  }, [updateDraft]);

  const setPayload = useCallback((payload: T) => {
    updateDraft((prev) => ({ ...prev, payload }));
  }, [updateDraft]);

  const setCurrentStep = useCallback((stepId: string) => {
    updateDraft((prev) => ({ ...prev, currentStepId: stepId }));
  }, [updateDraft]);

  const markStepComplete = useCallback((stepId: string) => {
    updateDraft((prev) => {
      if (prev.completedStepIds.includes(stepId)) return prev;
      return {
        ...prev,
        completedStepIds: [...prev.completedStepIds, stepId],
      };
    });
  }, [updateDraft]);

  const clearDraft = useCallback(async () => {
    clearLocalDraft(userId, wizardType);
    setDraft(null);
    lastSyncedHashRef.current = null;

    if (userId) {
      try {
        await deleteServerDraft(wizardType);
      } catch {
        // Ignore errors
      }
    }

    console.log("[WIZARD_DRAFT] Draft cleared");
  }, [userId, wizardType]);

  const forceSyncToServer = useCallback(async () => {
    if (!draft || !userId) return;

    try {
      setIsSyncing(true);
      await upsertServerDraft(wizardType, {
        currentStepId: draft.currentStepId,
        completedStepIds: draft.completedStepIds,
        payload: draft.payload,
        version: draft.version,
      });
      setIsOffline(false);
    } catch (error) {
      setIsOffline(true);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [draft, userId, wizardType]);

  // ============================================
  // RESUME FLOW
  // ============================================

  const resumeDraft = useCallback(() => {
    if (pendingDraft) {
      setDraft(pendingDraft);
      setLocalDraft(userId, wizardType, pendingDraft);
      onRestored?.(pendingDraft);
      console.log("[WIZARD_DRAFT] Draft resumed");
    }
    setShowResumeModal(false);
    setPendingDraft(null);
  }, [pendingDraft, userId, wizardType, onRestored]);

  const startOver = useCallback(async () => {
    await clearDraft();
    initializeDraft();
    setShowResumeModal(false);
    setPendingDraft(null);
    setNeedsVersionMigration(false);
    console.log("[WIZARD_DRAFT] Started over with fresh draft");
  }, [clearDraft, initializeDraft]);

  const dismissResumeModal = useCallback(() => {
    setShowResumeModal(false);
    if (!draft) {
      initializeDraft();
    }
  }, [draft, initializeDraft]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const hasExistingDraft = useMemo(() => {
    return !!pendingDraft || !!draft;
  }, [pendingDraft, draft]);

  const payload = useMemo(() => {
    return draft?.payload ?? defaultPayload;
  }, [draft, defaultPayload]);

  const currentStepId = useMemo(() => {
    return draft?.currentStepId ?? defaultStepId;
  }, [draft, defaultStepId]);

  const completedStepIds = useMemo(() => {
    return draft?.completedStepIds ?? [];
  }, [draft]);

  // ============================================
  // RETURN
  // ============================================

  return {
    draft,
    isLoading,
    isInitialized,
    isSyncing,
    isOffline,
    hasExistingDraft,
    needsVersionMigration,
    payload,
    currentStepId,
    completedStepIds,
    initializeDraft,
    updatePayload,
    updateNestedPayload,
    setPayload,
    setCurrentStep,
    markStepComplete,
    clearDraft,
    forceSyncToServer,
    showResumeModal,
    pendingDraft,
    resumeDraft,
    startOver,
    dismissResumeModal,
  };
}

// ============================================
// SUBMISSION HELPER
// ============================================

export async function onWizardSubmitSuccess(
  wizardType: WizardType,
  userId: string | null
): Promise<void> {
  clearLocalDraft(userId, wizardType);

  if (userId) {
    await submitServerDraft(wizardType);
  }

  if (userId) {
    try {
      localStorage.setItem(
        `mm_wizard_last_completed_at:${userId}`,
        new Date().toISOString()
      );
    } catch {
      // Ignore
    }
  }

  console.log("[WIZARD_DRAFT] Submit success, draft cleared");
}