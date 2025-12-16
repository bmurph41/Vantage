export interface FeatureFlags {
  INTEGRATIONS_PLATFORM_ENABLED: boolean;
  CONNECTOR_QBO_ENABLED: boolean;
  CONNECTOR_INTACCT_ENABLED: boolean;
  CONNECTOR_NETSUITE_ENABLED: boolean;
  FINANCIAL_KERNEL_UI_ENABLED: boolean;
}

function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export const featureFlags: FeatureFlags = {
  INTEGRATIONS_PLATFORM_ENABLED: parseBoolean(process.env.INTEGRATIONS_PLATFORM_ENABLED, false),
  CONNECTOR_QBO_ENABLED: parseBoolean(process.env.CONNECTOR_QBO_ENABLED, false),
  CONNECTOR_INTACCT_ENABLED: parseBoolean(process.env.CONNECTOR_INTACCT_ENABLED, false),
  CONNECTOR_NETSUITE_ENABLED: parseBoolean(process.env.CONNECTOR_NETSUITE_ENABLED, false),
  FINANCIAL_KERNEL_UI_ENABLED: parseBoolean(process.env.FINANCIAL_KERNEL_UI_ENABLED, false),
};

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}

export function requireFeatureFlag(flag: keyof FeatureFlags) {
  return (req: any, res: any, next: any) => {
    if (!isFeatureEnabled(flag)) {
      return res.status(404).json({
        message: 'Feature not enabled',
        code: 'FEATURE_NOT_ENABLED',
      });
    }
    next();
  };
}

export function getPublicFeatureFlags(): Partial<FeatureFlags> {
  return {
    INTEGRATIONS_PLATFORM_ENABLED: featureFlags.INTEGRATIONS_PLATFORM_ENABLED,
    FINANCIAL_KERNEL_UI_ENABLED: featureFlags.FINANCIAL_KERNEL_UI_ENABLED,
  };
}
