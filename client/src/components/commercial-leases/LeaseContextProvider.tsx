/**
 * LeaseContextProvider
 * ====================
 * Provides mode (operations | valuator) and derived config
 * to all child lease components.
 */

import React, { createContext, useContext, useMemo } from "react";
import type {
  LeaseContextMode,
  LeaseContextFeatures,
} from "@shared/lease-context-types";
import { getContextFeatures } from "@shared/lease-context-types";

interface LeaseContextValue {
  mode: LeaseContextMode;
  orgId: string;
  projectId?: string;
  propertyId?: string;
  features: LeaseContextFeatures;
  /** API base path: either /api/commercial-leases/operations or /api/commercial-leases/projects/:id */
  apiBase: string;
}

const LeaseContext = createContext<LeaseContextValue | null>(null);

interface LeaseContextProviderProps {
  mode: LeaseContextMode;
  orgId: string;
  projectId?: string;
  propertyId?: string;
  children: React.ReactNode;
}

export function LeaseContextProvider({
  mode,
  orgId,
  projectId,
  propertyId,
  children,
}: LeaseContextProviderProps) {
  const value = useMemo<LeaseContextValue>(() => {
    const features = getContextFeatures(mode);
    const apiBase =
      mode === "operations"
        ? "/api/commercial-leases/operations"
        : `/api/commercial-leases/projects/${projectId}`;

    return { mode, orgId, projectId, propertyId, features, apiBase };
  }, [mode, orgId, projectId, propertyId]);

  return (
    <LeaseContext.Provider value={value}>{children}</LeaseContext.Provider>
  );
}

export function useLeaseContext(): LeaseContextValue {
  const ctx = useContext(LeaseContext);
  if (!ctx) {
    throw new Error("useLeaseContext must be used within LeaseContextProvider");
  }
  return ctx;
}

export { LeaseContext };
