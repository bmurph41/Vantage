// EntitlementsContext.tsx
// Place this file in: src/contexts/EntitlementsContext.tsx
// Manages user's subscription and module access

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FEATURE_MODULES, 
  FeatureModule, 
  SUBSCRIPTION_PACKAGES, 
  SubscriptionPackage,
  MODULE_INFO,
  ModuleInfo,
  getPackageBySlug,
} from '@/config/featureModules';
import { sidebarConfig, filterSidebarByModules, SidebarGroup } from '@/config/sidebarConfig';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface UserSubscription {
  packageSlug: string | null;
  packageName: string | null;
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'none';
  trialEndsAt?: Date;
  currentPeriodEndsAt?: Date;
  addOnModules: FeatureModule[];
}

export interface EntitlementsContextValue {
  // Subscription info
  subscription: UserSubscription;
  currentPackage: SubscriptionPackage | null;
  
  // Module access
  userModules: Set<FeatureModule>;
  hasModule: (module: FeatureModule) => boolean;
  hasAnyModule: (modules: FeatureModule[]) => boolean;
  hasAllModules: (modules: FeatureModule[]) => boolean;
  
  // Filtered sidebar
  visibleSidebar: SidebarGroup[];
  
  // Module info helpers
  getModuleInfo: (module: FeatureModule) => ModuleInfo | undefined;
  getMissingModules: (requiredModules: FeatureModule[]) => FeatureModule[];
  
  // Actions
  setSubscription: (sub: UserSubscription) => void;
  addModule: (module: FeatureModule) => void;
  removeModule: (module: FeatureModule) => void;
  upgradeToPackage: (packageSlug: string) => void;
  
  // Loading state
  isLoading: boolean;
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════

const defaultSubscription: UserSubscription = {
  packageSlug: 'owner-operator',
  packageName: 'Owner/Operator',
  status: 'active',
  addOnModules: [],
};

// ═══════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════

interface EntitlementsProviderProps {
  children: React.ReactNode;
  initialSubscription?: UserSubscription;
}

export function EntitlementsProvider({ 
  children, 
  initialSubscription 
}: EntitlementsProviderProps) {
  const [subscription, setSubscriptionState] = useState<UserSubscription>(
    initialSubscription || defaultSubscription
  );
  const [isLoading, setIsLoading] = useState(true);

  // ─────────────────────────────────────────────────────────────
  // Load subscription from API/storage on mount
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadSubscription() {
      try {
        // Fetch from real API first, fall back to localStorage
        const response = await fetch('/api/billing/subscription', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.tier) {
            // Map billing tier to package slug
            const tierToSlug: Record<string, string> = {
              starter: 'owner-operator',
              growth: 'growth',
              institutional: 'institutional',
              enterprise: 'enterprise',
            };
            setSubscriptionState({
              packageSlug: tierToSlug[data.tier] || data.tier,
              status: data.status || 'active',
              trialEndsAt: data.trialEndsAt || null,
              addons: data.addons || [],
            });
            // Sync to localStorage as cache
            localStorage.setItem('user-subscription', JSON.stringify({
              packageSlug: tierToSlug[data.tier] || data.tier,
              status: data.status || 'active',
            }));
          }
        } else {
          // API not available — fall back to localStorage cache
          const stored = localStorage.getItem('user-subscription');
          if (stored) {
            const parsed = JSON.parse(stored);
            setSubscriptionState(parsed);
          }
        }
      } catch (error) {
        console.error('Failed to load subscription from API, using cache:', error);
        const stored = localStorage.getItem('user-subscription');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSubscriptionState(parsed);
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSubscription();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Persist subscription changes
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('user-subscription', JSON.stringify(subscription));
      // Sync subscription changes to API
      fetch('/api/billing/subscription', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      }).catch(() => { /* API sync is best-effort */ });
    }
  }, [subscription, isLoading]);

  // ─────────────────────────────────────────────────────────────
  // Computed: Current package
  // ─────────────────────────────────────────────────────────────
  const currentPackage = useMemo(() => {
    if (!subscription.packageSlug) return null;
    return getPackageBySlug(subscription.packageSlug) || null;
  }, [subscription.packageSlug]);

  // ─────────────────────────────────────────────────────────────
  // Computed: All user modules (package + add-ons)
  // ─────────────────────────────────────────────────────────────
  const userModules = useMemo(() => {
    const modules = new Set<FeatureModule>();
    
    // Always include dashboard
    modules.add(FEATURE_MODULES.DASHBOARD);
    modules.add(FEATURE_MODULES.OPS_PAYROLL);
    modules.add(FEATURE_MODULES.OPS_PORTFOLIO);
    
    // Add package modules
    if (currentPackage && subscription.status !== 'expired' && subscription.status !== 'cancelled') {
      currentPackage.modules.forEach(m => modules.add(m));
    }
    
    // Add add-on modules
    subscription.addOnModules.forEach(m => modules.add(m));
    
    return modules;
  }, [currentPackage, subscription.status, subscription.addOnModules]);

  // ─────────────────────────────────────────────────────────────
  // Computed: Filtered sidebar
  // ─────────────────────────────────────────────────────────────
  const visibleSidebar = useMemo(() => {
    return filterSidebarByModules(sidebarConfig, userModules);
  }, [userModules]);

  // ─────────────────────────────────────────────────────────────
  // Module access checks
  // ─────────────────────────────────────────────────────────────
  const hasModule = useCallback((module: FeatureModule) => {
    return userModules.has(module);
  }, [userModules]);

  const hasAnyModule = useCallback((modules: FeatureModule[]) => {
    return modules.some(m => userModules.has(m));
  }, [userModules]);

  const hasAllModules = useCallback((modules: FeatureModule[]) => {
    return modules.every(m => userModules.has(m));
  }, [userModules]);

  const getMissingModules = useCallback((requiredModules: FeatureModule[]) => {
    return requiredModules.filter(m => !userModules.has(m));
  }, [userModules]);

  // ─────────────────────────────────────────────────────────────
  // Module info helper
  // ─────────────────────────────────────────────────────────────
  const getModuleInfo = useCallback((module: FeatureModule) => {
    return MODULE_INFO[module];
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────
  const setSubscription = useCallback((sub: UserSubscription) => {
    setSubscriptionState(sub);
  }, []);

  const addModule = useCallback((module: FeatureModule) => {
    setSubscriptionState(prev => ({
      ...prev,
      addOnModules: [...prev.addOnModules.filter(m => m !== module), module],
    }));
  }, []);

  const removeModule = useCallback((module: FeatureModule) => {
    setSubscriptionState(prev => ({
      ...prev,
      addOnModules: prev.addOnModules.filter(m => m !== module),
    }));
  }, []);

  const upgradeToPackage = useCallback((packageSlug: string) => {
    const pkg = getPackageBySlug(packageSlug);
    if (!pkg) {
      console.error(`Package not found: ${packageSlug}`);
      return;
    }
    
    setSubscriptionState(prev => ({
      ...prev,
      packageSlug: pkg.slug,
      packageName: pkg.name,
      status: 'active',
      // Clear add-ons that are now included in the package
      addOnModules: prev.addOnModules.filter(m => !pkg.modules.includes(m)),
    }));
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────────
  const value: EntitlementsContextValue = {
    subscription,
    currentPackage,
    userModules,
    hasModule,
    hasAnyModule,
    hasAllModules,
    visibleSidebar,
    getModuleInfo,
    getMissingModules,
    setSubscription,
    addModule,
    removeModule,
    upgradeToPackage,
    isLoading,
  };

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useEntitlements(): EntitlementsContextValue {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Hook to check if user can access a specific feature
 */
export function useCanAccess(requiredModules: FeatureModule[]): boolean {
  const { hasAnyModule } = useEntitlements();
  return hasAnyModule(requiredModules);
}

/**
 * Hook to get upgrade prompt info when user lacks access
 */
export function useUpgradePrompt(requiredModules: FeatureModule[]) {
  const { getMissingModules, getModuleInfo } = useEntitlements();
  
  const missingModules = getMissingModules(requiredModules);
  const hasAccess = missingModules.length === 0;
  
  const missingModuleInfo = missingModules.map(m => getModuleInfo(m)).filter(Boolean);
  
  // Find cheapest package that includes all missing modules
  const suggestedPackage = SUBSCRIPTION_PACKAGES.find(pkg => 
    missingModules.every(m => pkg.modules.includes(m))
  );
  
  return {
    hasAccess,
    missingModules,
    missingModuleInfo,
    suggestedPackage,
  };
}
