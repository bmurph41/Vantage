export interface FeatureFlags {
  INTEGRATIONS_PLATFORM_ENABLED: boolean;
  CONNECTOR_QBO_ENABLED: boolean;
  CONNECTOR_INTACCT_ENABLED: boolean;
  CONNECTOR_NETSUITE_ENABLED: boolean;
  FINANCIAL_KERNEL_UI_ENABLED: boolean;
  transientRentRoll: {
    enabled: boolean;
    ui: boolean;
  };
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
  transientRentRoll: {
    enabled: parseBoolean(process.env.TRANSIENT_RENT_ROLL_ENABLED, false),
    ui: parseBoolean(process.env.TRANSIENT_RENT_ROLL_UI_ENABLED, false),
  },
};

type BooleanKeys<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T];
export type FlagPath =
  | BooleanKeys<FeatureFlags>
  | `transientRentRoll.${keyof FeatureFlags['transientRentRoll']}`;

export function isFeatureEnabled(flag: FlagPath): boolean {
  if (flag === 'transientRentRoll.enabled') return featureFlags.transientRentRoll.enabled;
  if (flag === 'transientRentRoll.ui') return featureFlags.transientRentRoll.ui;
  const v = featureFlags[flag as BooleanKeys<FeatureFlags>];
  return typeof v === 'boolean' ? v : false;
}

export function requireFeatureFlag(flag: FlagPath) {
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

export function getPublicFeatureFlags() {
  return {
    INTEGRATIONS_PLATFORM_ENABLED: featureFlags.INTEGRATIONS_PLATFORM_ENABLED,
    FINANCIAL_KERNEL_UI_ENABLED: featureFlags.FINANCIAL_KERNEL_UI_ENABLED,
    transientRentRoll: { ui: featureFlags.transientRentRoll.ui },
  };
}
