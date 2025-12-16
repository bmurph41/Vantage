export interface FeatureFlags {
  INTEGRATIONS_PLATFORM_ENABLED: boolean;
  FINANCIAL_KERNEL_UI_ENABLED: boolean;
}

let cachedFlags: FeatureFlags | null = null;

export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  if (cachedFlags) return cachedFlags;
  
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      cachedFlags = data.featureFlags || {
        INTEGRATIONS_PLATFORM_ENABLED: false,
        FINANCIAL_KERNEL_UI_ENABLED: false,
      };
      return cachedFlags;
    }
  } catch (error) {
    console.warn('Failed to fetch feature flags, using defaults');
  }
  
  return {
    INTEGRATIONS_PLATFORM_ENABLED: false,
    FINANCIAL_KERNEL_UI_ENABLED: false,
  };
}

export function getDefaultFlags(): FeatureFlags {
  return {
    INTEGRATIONS_PLATFORM_ENABLED: false,
    FINANCIAL_KERNEL_UI_ENABLED: false,
  };
}

export function isFeatureEnabled(flags: FeatureFlags, flag: keyof FeatureFlags): boolean {
  return flags[flag] ?? false;
}
