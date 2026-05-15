/**
 * Canonical Assumption Store — dual-write helper
 *
 * Day 2 of engine unification (see project_engine_unification_architecture_2026_05_14.md).
 *
 * Phase A of the dual-write migration pattern: every write to
 * modeling_scenario_versions.assumptions also appends a row to
 * scenario_assumption_payloads (append-only version log).
 *
 * Reader migration is deferred to Days 3-4 — the engine still reads the
 * JSONB blob on modeling_scenario_versions. This module only writes.
 */

import * as crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { scenarioAssumptionPayloads } from '@shared/schema';

/**
 * Recursively sort object keys so serialization is deterministic.
 *
 * JSON.stringify offers no key-ordering control — its replacer-array
 * argument is a key *allowlist* applied at every nesting level, not a
 * sort order. Building a key-sorted copy first is the only correct way
 * to get a stable serialization.
 */
function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

/**
 * Hash an assumptions payload for integrity verification.
 *
 * Recursive key-sort before serialization ensures hash stability across
 * object key ordering. sha256, 16-char hex truncation. Shared by the
 * governance service (scenario-governance-service.ts) so both writers
 * produce identical hashes for identical payloads.
 */
export function hashAssumptionsPayload(payload: any): string {
  const json = JSON.stringify(sortKeys(payload || {}));
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/**
 * Append a row to the canonical assumption store.
 *
 * Append-only: never upserts. Each assumption write creates a new payload
 * row. Latest payload retrieval is ORDER BY created_at DESC LIMIT 1. Full
 * change history is preserved per scenario_version_id.
 *
 * Failure-isolated: callers wrap this in try/catch so a canonical-store
 * failure can never break the primary JSONB write to
 * modeling_scenario_versions.
 *
 * @param scenarioId  Logical scenario identity = modeling_scenario_versions.scenario_type
 *                    ('base' | 'aggressive' | 'conservative'). Stable across version forks.
 */
export async function writeCanonicalPayload(params: {
  orgId: string;
  projectId: string;
  scenarioId: string;
  scenarioVersionId: string;
  assumptions: any;
}): Promise<void> {
  const payload = params.assumptions ?? {};
  const payloadHash = hashAssumptionsPayload(payload);

  await db.insert(scenarioAssumptionPayloads).values({
    orgId: params.orgId,
    projectId: params.projectId,
    scenarioId: params.scenarioId,
    scenarioVersionId: params.scenarioVersionId,
    payload,
    payloadSchemaVersion: 1, // integer — NOT the string '1.0' the dead governance writer passed
    payloadHash,
  });
}

/**
 * Read the latest canonical payload for a scenario version.
 *
 * Returns null only when no canonical row exists. Callers should NOT fall
 * back to modeling_scenario_versions.assumptions — the Day 3 backfill
 * ensures every populated scenario has a canonical row, and the Day 2
 * dual-write keeps coverage current. A null return for a populated
 * scenario is a bug worth surfacing, not silently working around.
 *
 * Append-only mechanics: latest = ORDER BY created_at DESC LIMIT 1.
 */
export async function readCanonicalPayload(
  scenarioVersionId: string
): Promise<Record<string, any> | null> {
  const rows = await db.select({ payload: scenarioAssumptionPayloads.payload })
    .from(scenarioAssumptionPayloads)
    .where(eq(scenarioAssumptionPayloads.scenarioVersionId, scenarioVersionId))
    .orderBy(desc(scenarioAssumptionPayloads.createdAt))
    .limit(1);
  return rows.length > 0 ? (rows[0].payload as Record<string, any>) : null;
}
