import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserSettings, SettingsResponse } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

// ============================================================================
// CONTEXT TYPE
// ============================================================================
interface SettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<UserSettings>) => void;
  isSettingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ============================================================================
// API FUNCTIONS
// ============================================================================
async function fetchSettings(): Promise<SettingsResponse> {
  const response = await fetch('/api/settings/me', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch settings');
  }
  return response.json();
}

async function updateSettingsApi(updates: Partial<UserSettings>): Promise<void> {
  const response = await fetch('/api/settings/me', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error('Failed to update settings');
  }
}

// ============================================================================
// PROVIDER
// ============================================================================
interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const queryClient = useQueryClient();
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Fetch settings
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const settings = data?.settings ?? DEFAULT_SETTINGS;

  // Update mutation
  const mutation = useMutation({
    mutationFn: updateSettingsApi,
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previous = queryClient.getQueryData<SettingsResponse>(['settings']);
      if (previous) {
        queryClient.setQueryData<SettingsResponse>(['settings'], {
          ...previous,
          settings: { ...previous.settings, ...updates },
        });
      }
      return { previous };
    },
    onError: (_err, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['settings'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const updateSettings = useCallback(
    (updates: Partial<UserSettings>) => {
      mutation.mutate(updates);
    },
    [mutation]
  );

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.theme;

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [settings.theme]);

  // Apply density
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-density', settings.density);
  }, [settings.density]);

  // Apply reduced motion
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', settings.reducedMotion);
  }, [settings.reducedMotion]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  const openSettingsModal = useCallback(() => setIsSettingsModalOpen(true), []);
  const closeSettingsModal = useCallback(() => setIsSettingsModalOpen(false), []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        error: error as Error | null,
        updateSettings,
        isSettingsModalOpen,
        openSettingsModal,
        closeSettingsModal,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================
export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}

// ============================================================================
// NUMBER FORMATTING UTILITY
// ============================================================================
export function useNumberFormat() {
  const { settings } = useSettingsContext();

  return useCallback(
    (value: number, options?: { precision?: number; currency?: boolean }) => {
      const precision = options?.precision ?? settings.decimalPrecision;

      if (options?.currency) {
        return new Intl.NumberFormat(settings.locale, {
          style: 'currency',
          currency: settings.currency,
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value);
      }

      // Apply thousands separator based on setting
      const formatted = value.toFixed(precision);
      const [integer, decimal] = formatted.split('.');

      let formattedInteger = integer;
      if (settings.numberFormat === 'comma') {
        formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      } else if (settings.numberFormat === 'space') {
        formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      }

      return decimal ? `${formattedInteger}.${decimal}` : formattedInteger;
    },
    [settings]
  );
}

// ============================================================================
// DATE/TIME FORMATTING UTILITY
// ============================================================================
export function useDateFormat() {
  const { settings } = useSettingsContext();

  return useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat(settings.locale, {
        timeZone: settings.timezone,
        ...options,
      }).format(d);
    },
    [settings]
  );
}