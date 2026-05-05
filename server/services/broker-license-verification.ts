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

// ── Manual review fallback ────────────────────────────────────────────────────
// Used when no third-party API credentials are configured.  All licenses are
// flagged for human review rather than auto-accepted.

export class ManualReviewProvider implements LicenseVerificationProvider {
  readonly name = "manual";
  async verify(_input: LicenseVerificationInput): Promise<LicenseVerificationResult> {
    return {
      status: "manual_review_required",
      provider: this.name,
      notes:
        "No third-party license lookup provider is configured (NIPR_API_KEY not set). " +
        "Admin must review manually.",
    };
  }
}

// ── NIPR Gateway API provider ─────────────────────────────────────────────────
// Calls the National Insurance Producer Registry (NIPR) PLAS Gateway API to
// verify a license number against the issuing state's records.
//
// Configuration:
//   NIPR_API_KEY  – subscription API key issued by NIPR (nipr.com)
//   NIPR_API_BASE – (optional) override base URL; defaults to the NIPR gateway
//
// Response status mapping:
//   ACTIVE / LICENSED → verified
//   EXPIRED           → expired
//   REVOKED / SUSPENDED / TERMINATED → revoked
//   (not found / 404) → not_found
//   unexpected         → manual_review_required
//
// If NIPR_API_KEY is absent the active provider falls back to ManualReviewProvider.

const NIPR_DEFAULT_BASE = "https://niprgateway.com/Gateway/v1";

export class NIPRApiProvider implements LicenseVerificationProvider {
  readonly name = "nipr";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = NIPR_DEFAULT_BASE) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async verify(input: LicenseVerificationInput): Promise<LicenseVerificationResult> {
    const { licenseNumber, licenseState } = input;

    const url =
      `${this.baseUrl}/producers/license` +
      `?licenseNumber=${encodeURIComponent(licenseNumber)}` +
      `&stateCode=${encodeURIComponent(licenseState.toUpperCase())}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          "X-NIPR-Client": "marinalytics/1.0",
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch (networkErr) {
      throw new Error(
        `NIPR API network error: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`,
      );
    }

    if (response.status === 404) {
      return {
        status: "not_found",
        provider: this.name,
        notes: `License ${licenseNumber} was not found in the NIPR database for state ${licenseState}.`,
        rawPayload: { httpStatus: 404 },
      };
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(`NIPR API authentication failed (HTTP ${response.status}). Check NIPR_API_KEY.`);
    }

    if (!response.ok) {
      throw new Error(`NIPR API returned HTTP ${response.status}: ${response.statusText}`);
    }

    let data: Record<string, unknown>;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new Error("NIPR API returned a non-JSON response body.");
    }

    const rawStatus = String(data?.licenseStatus ?? data?.status ?? "UNKNOWN").toUpperCase();

    let status: LicenseVerificationStatus;
    switch (rawStatus) {
      case "ACTIVE":
      case "LICENSED":
      case "CURRENT":
        status = "verified";
        break;
      case "EXPIRED":
        status = "expired";
        break;
      case "REVOKED":
      case "SUSPENDED":
      case "TERMINATED":
      case "CANCELLED":
        status = "revoked";
        break;
      case "NOT FOUND":
      case "NOTFOUND":
      case "NOT_FOUND":
        status = "not_found";
        break;
      default:
        status = "manual_review_required";
    }

    return {
      status,
      provider: this.name,
      notes:
        typeof data?.statusDescription === "string"
          ? data.statusDescription
          : `NIPR license status: ${rawStatus}`,
      expiresAt: typeof data?.expirationDate === "string" ? data.expirationDate : null,
      rawPayload: data,
    };
  }
}

// ── Active provider registry ──────────────────────────────────────────────────
// Bootstrapped from environment at startup.  Call registerLicenseVerificationProvider()
// to swap in a different provider at runtime (e.g. in tests or when credentials
// become available after startup).

function buildDefaultProvider(): LicenseVerificationProvider {
  const apiKey = process.env.NIPR_API_KEY;
  const baseUrl = process.env.NIPR_API_BASE || NIPR_DEFAULT_BASE;
  if (apiKey) {
    console.info("[broker-license] NIPR_API_KEY detected — using NIPRApiProvider for live lookups.");
    return new NIPRApiProvider(apiKey, baseUrl);
  }
  console.info(
    "[broker-license] NIPR_API_KEY not set — using ManualReviewProvider. " +
      "Set NIPR_API_KEY to enable live license lookups.",
  );
  return new ManualReviewProvider();
}

let activeProvider: LicenseVerificationProvider = buildDefaultProvider();

export function registerLicenseVerificationProvider(provider: LicenseVerificationProvider): void {
  activeProvider = provider;
}

export function getLicenseVerificationProvider(): LicenseVerificationProvider {
  return activeProvider;
}

// ── Core verification + persistence ──────────────────────────────────────────

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

// ── License-expiry scanner (background / cron) ────────────────────────────────

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
