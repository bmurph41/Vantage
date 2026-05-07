/**
 * G4 Phase 1.6a — applyAdjustments
 *
 * Persists the user's "Apply" intent against the per-line-item adjustments UI:
 * toggles modeling_addbacks.is_active for the requested set, optionally flips
 * modeling_projects.adjustments_master_state, and writes audit-log rows.
 *
 * Contract is intentionally narrow:
 *   - Single transaction. All reads + writes inside BEGIN/COMMIT.
 *   - SELECT ... FOR UPDATE on the touched addback rows so concurrent toggles
 *     (multi-tab, retry) serialize cleanly. The lock is held across the few
 *     UPDATEs and INSERTs that follow — short-lived, small row count.
 *   - Idempotent toggles: when the requested isActive matches the persisted
 *     value, no UPDATE is issued and no addback_toggle history row is written.
 *   - One apply_to_pro_forma history row is ALWAYS written, even on no-op
 *     submissions. The "Apply" click is itself the user-action being audited;
 *     recording the no-op is honest and gives downstream observers a single
 *     event per click.
 *   - Does NOT call generateProForma or any pro forma engine method. No
 *     adjusted-actuals cache exists today (see G4 Phase 1.4 service header),
 *     so the next pro-forma read picks up the new state automatically. Pro
 *     forma wiring lands in Phase 1.6b.
 *
 * Error semantics:
 *   - Any provided addbackId that does not exist for (projectId, orgId)
 *     causes the whole transaction to ROLLBACK and throws
 *     InvalidAddbackError. No partial writes, no orphan history rows.
 *
 * Note: modeling_projects + modeling_addbacks + modeling_adjustment_history
 * are not RLS-affected, so raw pool/client.query() is the canonical access
 * path here (matches sibling G4 services at adjusted-actuals-service.ts and
 * consolidated-pnl-service.ts).
 */

import { pool } from '../db';
import type {
  AdjustmentMasterState,
  ApplyAdjustmentsRequest,
  ApplyAdjustmentsResult,
} from '@shared/types/consolidated-pnl';

export class InvalidAddbackError extends Error {
  constructor(
    public readonly missingAddbackIds: string[],
    public readonly projectId: string,
  ) {
    super(
      `Addback id(s) not found in project ${projectId}: ${missingAddbackIds.join(', ')}`,
    );
    this.name = 'InvalidAddbackError';
  }
}

interface AddbackRow {
  id: string;
  is_active: boolean;
}

export async function applyAdjustments(
  orgId: string,
  projectId: string,
  userId: string,
  request: ApplyAdjustmentsRequest,
): Promise<ApplyAdjustmentsResult> {
  const toggles = request.addbackToggles ?? [];
  const requestedMasterState = request.masterStateChange;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Lock + fetch the current is_active for every requested addback.
    //    SELECT ... FOR UPDATE serializes concurrent applies on overlapping sets.
    let currentByAddback = new Map<string, boolean>();
    if (toggles.length > 0) {
      const ids = toggles.map((t) => t.addbackId);
      const lockResult = await client.query<AddbackRow>(
        `SELECT id, is_active
         FROM modeling_addbacks
         WHERE project_id = $1 AND org_id = $2 AND id = ANY($3::varchar[])
         FOR UPDATE`,
        [projectId, orgId, ids],
      );

      for (const row of lockResult.rows) {
        currentByAddback.set(row.id, row.is_active);
      }

      const missing = ids.filter((id) => !currentByAddback.has(id));
      if (missing.length > 0) {
        throw new InvalidAddbackError(missing, projectId);
      }
    }

    // 2) Lock + read current master state when a change is requested.
    let currentMasterState: AdjustmentMasterState | null = null;
    if (requestedMasterState !== undefined) {
      const projectResult = await client.query<{
        adjustments_master_state: AdjustmentMasterState;
      }>(
        `SELECT adjustments_master_state
         FROM modeling_projects
         WHERE id = $1 AND org_id = $2
         FOR UPDATE`,
        [projectId, orgId],
      );
      if (projectResult.rows.length === 0) {
        throw new Error(`Modeling project ${projectId} not found in org ${orgId}`);
      }
      currentMasterState = projectResult.rows[0].adjustments_master_state;
    }

    // 3) Apply addback toggles. Skip rows already at the requested state.
    let appliedToggles = 0;
    for (const toggle of toggles) {
      const currentValue = currentByAddback.get(toggle.addbackId)!;
      if (currentValue === toggle.isActive) continue;

      await client.query(
        `UPDATE modeling_addbacks
         SET is_active = $1, updated_at = NOW()
         WHERE id = $2 AND project_id = $3 AND org_id = $4`,
        [toggle.isActive, toggle.addbackId, projectId, orgId],
      );

      await client.query(
        `INSERT INTO modeling_adjustment_history
           (org_id, project_id, user_id, action_type, target_id, old_value, new_value)
         VALUES ($1, $2, $3, 'addback_toggle', $4, $5::jsonb, $6::jsonb)`,
        [
          orgId,
          projectId,
          userId,
          toggle.addbackId,
          JSON.stringify({ isActive: currentValue }),
          JSON.stringify({ isActive: toggle.isActive }),
        ],
      );

      appliedToggles++;
    }

    // 4) Apply master state change if it differs from the persisted value.
    let masterStateChanged = false;
    if (
      requestedMasterState !== undefined &&
      currentMasterState !== null &&
      currentMasterState !== requestedMasterState
    ) {
      await client.query(
        `UPDATE modeling_projects
         SET adjustments_master_state = $1, updated_at = NOW()
         WHERE id = $2 AND org_id = $3`,
        [requestedMasterState, projectId, orgId],
      );

      await client.query(
        `INSERT INTO modeling_adjustment_history
           (org_id, project_id, user_id, action_type, target_id, old_value, new_value)
         VALUES ($1, $2, $3, 'master_state_change', $4, $5::jsonb, $6::jsonb)`,
        [
          orgId,
          projectId,
          userId,
          projectId,
          JSON.stringify({ masterState: currentMasterState }),
          JSON.stringify({ masterState: requestedMasterState }),
        ],
      );

      masterStateChanged = true;
    }

    // 5) Always record the user's Apply intent — even on a pure no-op submit.
    await client.query(
      `INSERT INTO modeling_adjustment_history
         (org_id, project_id, user_id, action_type, target_id, metadata)
       VALUES ($1, $2, $3, 'apply_to_pro_forma', $4, $5::jsonb)`,
      [
        orgId,
        projectId,
        userId,
        projectId,
        JSON.stringify({ appliedToggles, masterStateChanged }),
      ],
    );

    await client.query('COMMIT');

    return {
      appliedToggles,
      masterStateChanged,
      historyEntries: appliedToggles + (masterStateChanged ? 1 : 0) + 1,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore — error already in flight
    }
    throw err;
  } finally {
    client.release();
  }
}
