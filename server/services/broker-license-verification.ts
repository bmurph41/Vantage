import { db } from "../db";
import { brokerRegistrations } from "../../shared/schema";
import { eq } from "drizzle-orm";

interface QueryPool {
  query<R = any>(text: string, params?: unknown[]): Promise<{ rows: R[]; rowCount?: number | null }>;
}

export type LicenseVerificationStatus =
  | "unverified"
  | "verified"
  | "expired"
  | "revoked"
  | "not_found"
  | "manual_review_required"
  | "error";

export interface LicenseVerificationInput {
  licenseNumber: string;
  licenseState: string;
  legalName: string;
  assetClass?: string;
}

export interface LicenseVerificationResult {
  status: LicenseVerificationStatus;
  provider: string;
  notes?: string;
  expiresAt?: string | null;
  rawPayload?: unknown;
}

export interface LicenseVerificationProvider {
  readonly name: string;
  verify(input: LicenseVerificationInput): Promise<LicenseVerificationResult>;
}

class ManualReviewProvider implements LicenseVerificationProvider {
  readonly name = "manual";
  async verify(_input: LicenseVerificationInput): Promise<LicenseVerificationResult> {
    return {
      status: "manual_review_required",
      provider: this.name,
      notes: "No third-party license lookup provider is configured. Admin must review manually.",
    };
  }
}

let activeProvider: LicenseVerificationProvider = new ManualReviewProvider();

export function registerLicenseVerificationProvider(provider: LicenseVerificationProvider): void {
  activeProvider = provider;
}

export function getLicenseVerificationProvider(): LicenseVerificationProvider {
  return activeProvider;
}

export async function verifyAndPersistLicense(
  registrationId: string,
  input: LicenseVerificationInput,
): Promise<LicenseVerificationResult> {
  let result: LicenseVerificationResult;
  try {
    result = await activeProvider.verify(input);
  } catch (err) {
    result = {
      status: "error",
      provider: activeProvider.name,
      notes: err instanceof Error ? err.message : "Unknown provider error",
    };
  }

  await db
    .update(brokerRegistrations)
    .set({
      licenseLastVerifiedAt: new Date(),
      licenseVerificationProvider: result.provider,
      licenseVerificationStatus: result.status,
      licenseVerificationNotes: result.notes ?? null,
      licenseVerificationPayload: (result.rawPayload ?? null) as any,
    })
    .where(eq(brokerRegistrations.id, registrationId));

  return result;
}

const DAY_MS = 86_400_000;

export interface LicenseExpiryCheck {
  registrationId: string;
  userId: string;
  licenseState: string | null;
  licenseExpiresAt: Date | null;
  daysUntilExpiry: number | null;
  level: "ok" | "warning" | "critical" | "expired" | "missing";
}

export function classifyExpiry(licenseExpiresAt: Date | null | undefined): LicenseExpiryCheck["level"] {
  if (!licenseExpiresAt) return "missing";
  const days = Math.floor((licenseExpiresAt.getTime() - Date.now()) / DAY_MS);
  if (days < 0) return "expired";
  if (days <= 14) return "critical";
  if (days <= 60) return "warning";
  return "ok";
}

export function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((d.getTime() - Date.now()) / DAY_MS);
}

export async function scanLicenseExpiry(pool: QueryPool): Promise<{
  expired: number;
  critical: number;
  warning: number;
  updated: number;
}> {
  const { rows } = await pool.query<{
    id: string;
    license_expires_at: Date | null;
    license_verification_status: string;
    status: string;
  }>(
    `SELECT id, license_expires_at, license_verification_status, status
       FROM broker_registrations
      WHERE status = 'approved'
        AND license_expires_at IS NOT NULL`,
  );

  let expired = 0;
  let critical = 0;
  let warning = 0;
  let updated = 0;

  for (const row of rows) {
    const level = classifyExpiry(row.license_expires_at);
    if (level === "expired") {
      expired += 1;
      if (row.license_verification_status !== "expired") {
        await pool.query(
          `UPDATE broker_registrations
              SET license_verification_status = 'expired',
                  license_last_verified_at = NOW(),
                  license_verification_notes = COALESCE(license_verification_notes, '') || E'\nAuto-flagged expired at ' || NOW()::text
            WHERE id = $1`,
          [row.id],
        );
        updated += 1;

        await pool.query(
          `UPDATE broker_profiles SET is_publishable = false, updated_at = NOW()
            WHERE registration_id = $1`,
          [row.id],
        );
      }
    } else if (level === "critical") critical += 1;
    else if (level === "warning") warning += 1;
  }

  return { expired, critical, warning, updated };
}

export async function getLicenseStatusForBroker(
  pool: QueryPool,
  registrationId: string,
): Promise<LicenseExpiryCheck | null> {
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    license_state: string | null;
    license_expires_at: Date | null;
  }>(
    `SELECT id, user_id, license_state, license_expires_at
       FROM broker_registrations WHERE id = $1`,
    [registrationId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    registrationId: row.id,
    userId: row.user_id,
    licenseState: row.license_state,
    licenseExpiresAt: row.license_expires_at,
    daysUntilExpiry: daysUntil(row.license_expires_at),
    level: classifyExpiry(row.license_expires_at),
  };
}
