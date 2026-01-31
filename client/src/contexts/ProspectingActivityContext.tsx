import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface PendingProspectingActivity {
  contactId: string;
  contactName: string;
  activityType?: 'call' | 'text' | 'linkedin' | 'email' | 'meeting' | 'site_visit';
  notes?: string;
  dealId?: string;
  companyId?: string;
  companyName?: string;
}

interface ProspectingActivityContextType {
  pendingActivity: PendingProspectingActivity | null;
  setPendingActivity: (activity: PendingProspectingActivity | null) => void;
  clearPendingActivity: () => void;
  hasPendingActivity: boolean;
}

const ProspectingActivityContext = createContext<ProspectingActivityContextType | null>(null);

export function ProspectingActivityProvider({ children }: { children: ReactNode }) {
  const [pendingActivity, setPendingActivityState] = useState<PendingProspectingActivity | null>(null);

  const setPendingActivity = useCallback((activity: PendingProspectingActivity | null) => {
    setPendingActivityState(activity);
  }, []);

  const clearPendingActivity = useCallback(() => {
    setPendingActivityState(null);
  }, []);

  return (
    <ProspectingActivityContext.Provider
      value={{
        pendingActivity,
        setPendingActivity,
        clearPendingActivity,
        hasPendingActivity: pendingActivity !== null,
      }}
    >
      {children}
    </ProspectingActivityContext.Provider>
  );
}

export function useProspectingActivity() {
  const context = useContext(ProspectingActivityContext);
  if (!context) {
    throw new Error('useProspectingActivity must be used within ProspectingActivityProvider');
  }
  return context;
}
