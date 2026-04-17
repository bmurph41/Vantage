import { db } from "../db";
import { billingFeatureFlags } from "../../shared/schema";
import { and, eq } from "drizzle-orm";

export const BROKER_FEATURE_FLAGS = {
  AI_DRAFTS: "broker_ai_drafts",
  RATINGS: "broker_ratings",
  LICENSE_VERIFY_API: "broker_license_verify_api",
} as const;

export type BrokerFeatureFlag = (typeof BROKER_FEATURE_FLAGS)[keyof typeof BROKER_FEATURE_FLAGS];

export interface BrokerFeatureFlagState {
  flag: BrokerFeatureFlag;
  enabled: boolean;
  source: "env_force_off" | "env_force_on" | "org_override" | "default_off";
}

function envKey(flag: string): string {
  return `FEATURE_${flag.toUpperCase()}`;
}

function parseEnv(value: string | undefined): boolean | null {
  if (value == null) return null;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "on") return true;
  if (v === "false" || v === "0" || v === "off") return false;
  return null;
}

export async function isBrokerFeatureEnabled(
  orgId: string | null | undefined,
  flag: BrokerFeatureFlag,
): Promise<BrokerFeatureFlagState> {
  const env = parseEnv(process.env[envKey(flag)]);
  if (env === false) return { flag, enabled: false, source: "env_force_off" };
  if (env === true) return { flag, enabled: true, source: "env_force_on" };

  if (!orgId) return { flag, enabled: false, source: "default_off" };

  const [row] = await db
    .select()
    .from(billingFeatureFlags)
    .where(
      and(
        eq(billingFeatureFlags.orgId, orgId),
        eq(billingFeatureFlags.feature, flag),
        eq(billingFeatureFlags.isEnabled, true),
      ),
    );

  if (!row) return { flag, enabled: false, source: "default_off" };

  if (row.isOverride && row.overrideExpiresAt && new Date(row.overrideExpiresAt) < new Date()) {
    return { flag, enabled: false, source: "default_off" };
  }

  return { flag, enabled: true, source: "org_override" };
}

export async function getAllBrokerFeatureFlags(
  orgId: string | null | undefined,
): Promise<Record<BrokerFeatureFlag, BrokerFeatureFlagState>> {
  const entries = await Promise.all(
    Object.values(BROKER_FEATURE_FLAGS).map(async (flag) => {
      const state = await isBrokerFeatureEnabled(orgId, flag);
      return [flag, state] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<BrokerFeatureFlag, BrokerFeatureFlagState>;
}
