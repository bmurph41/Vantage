/**
 * transient-inventory-unit-service
 *
 * Represents the individual physical unit — slip #A-12, Room 304, Pad 27.
 *
 * Important semantic distinction (do NOT conflate these):
 *
 *   status = 'decommissioned'
 *     Operational end-of-life. The unit physically existed, was in service,
 *     and has been permanently retired (demolished, permanently removed,
 *     re-assigned out of inventory). The row REMAINS VISIBLE in reads —
 *     historical bookings still reference it, reports still aggregate it,
 *     occupancy math for past periods still includes its unit-nights.
 *     Only status = 'active' and status = 'ooo' affect current availability.
 *
 *   deleted_at IS NOT NULL  (soft delete)
 *     Data-entry cleanup. The unit should never have existed in the system
 *     (duplicate, typo, wrong property, stray import row). The row is
 *     HIDDEN from all service reads and all aggregates. Use for data
 *     hygiene, not for modeling real-world retirement.
 *
 * softDeleteTransientInventoryUnit DOES NOT set status='decommissioned'.
 * updateStatus is the correct action for operational retirement.
 *
 * These two axes are orthogonal by design. A row can be active+deleted
 * (entered in error), decommissioned+not-deleted (normal end of life),
 * or decommissioned+deleted (entered in error AND had status changed
 * before anyone noticed). Reads filter deleted_at IS NULL regardless
 * of status.
 */

import type { Pool } from 'pg';

export type UnitStatus = 'active' | 'ooo' | 'decommissioned';
// 'ooo' = out of order (temporary unavailability, e.g. maintenance/damage)

export const VALID_UNIT_STATUS: readonly UnitStatus[] = ['active', 'ooo', 'decommissioned'] as const;

export interface TransientInventoryUnitRow {
  id: string;
  orgId: string;
  propertyId: string;
  inventoryGroupId: string;
  unitTypeId: string;
  identifier: string;
  status: UnitStatus;
  activationDate: string | null;
  decommissionDate: string | null;
  attributes: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

export interface CreateTransientInventoryUnitInput {
  orgId: string;
  propertyId: string;
  inventoryGroupId: string;
  unitTypeId: string;
  identifier: string;
  status?: UnitStatus;
  activationDate?: string | null;
  decommissionDate?: string | null;
  attributes?: Record<string, unknown>;
  createdBy?: string | null;
}

export interface ServiceDeps {
  pool: Pick<Pool, 'query'>;
}

function isValidStatus(v: unknown): v is UnitStatus {
  return typeof v === 'string' && (VALID_UNIT_STATUS as readonly string[]).includes(v);
}

function mapRow(r: Record<string, any>): TransientInventoryUnitRow {
  return {
    id: r.id,
    orgId: r.org_id,
    propertyId: r.property_id,
    inventoryGroupId: r.inventory_group_id,
    unitTypeId: r.unit_type_id,
    identifier: r.identifier,
    status: r.status as UnitStatus,
    activationDate: r.activation_date,
    decommissionDate: r.decommission_date,
    attributes: r.attributes ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    deletedAt: r.deleted_at,
  };
}

export async function createTransientInventoryUnit(
  input: CreateTransientInventoryUnitInput,
  deps: ServiceDeps,
): Promise<TransientInventoryUnitRow> {
  if (!input.orgId) throw new Error('orgId is required');
  if (!input.propertyId) throw new Error('propertyId is required');
  if (!input.inventoryGroupId) throw new Error('inventoryGroupId is required');
  if (!input.unitTypeId) throw new Error('unitTypeId is required');
  if (!input.identifier || !input.identifier.trim()) throw new Error('identifier is required');
  if (input.status !== undefined && !isValidStatus(input.status)) {
    throw new Error(`status must be one of: ${VALID_UNIT_STATUS.join(', ')}`);
  }

  // Three-way parent consistency guard: fetch the parent unit_type and
  // confirm that (org_id, property_id, inventory_group_id) all agree with
  // the caller's input. Rejects cross-org, cross-property, and cross-group
  // mis-parenting in a single SELECT.
  const parent = await deps.pool.query(
    `SELECT org_id, property_id, inventory_group_id FROM transient_unit_type
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [input.unitTypeId, input.orgId],
  );
  if (parent.rowCount === 0) {
    throw new Error('unit type not found or not accessible to this org');
  }
  const p = parent.rows[0];
  if (p.property_id !== input.propertyId) {
    throw new Error('unit type does not belong to the specified property');
  }
  if (p.inventory_group_id !== input.inventoryGroupId) {
    throw new Error('unit type does not belong to the specified inventory group');
  }

  // Pass literal 'active' when status is undefined — never pass JS undefined
  // as a query param (pg would coerce to NULL and violate NOT NULL).
  const statusParam: UnitStatus = input.status ?? 'active';
  const attributesParam = JSON.stringify(input.attributes ?? {});

  const res = await deps.pool.query(
    `INSERT INTO transient_inventory_unit
       (org_id, property_id, inventory_group_id, unit_type_id, identifier,
        status, activation_date, decommission_date, attributes,
        created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $10)
     RETURNING *`,
    [
      input.orgId,
      input.propertyId,
      input.inventoryGroupId,
      input.unitTypeId,
      input.identifier.trim(),
      statusParam,
      input.activationDate ?? null,
      input.decommissionDate ?? null,
      attributesParam,
      input.createdBy ?? null,
    ],
  );
  return mapRow(res.rows[0]);
}

export async function listTransientInventoryUnits(
  args: {
    orgId: string;
    propertyId: string;
    inventoryGroupId?: string;
    unitTypeId?: string;
    statusIn?: UnitStatus[];
  },
  deps: ServiceDeps,
): Promise<TransientInventoryUnitRow[]> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.propertyId) throw new Error('propertyId is required');
  if (args.statusIn) {
    for (const s of args.statusIn) {
      if (!isValidStatus(s)) {
        throw new Error(`status must be one of: ${VALID_UNIT_STATUS.join(', ')}`);
      }
    }
  }

  const params: any[] = [args.orgId, args.propertyId];
  let sql =
    `SELECT * FROM transient_inventory_unit
      WHERE org_id = $1 AND property_id = $2 AND deleted_at IS NULL`;
  if (args.inventoryGroupId) {
    params.push(args.inventoryGroupId);
    sql += ` AND inventory_group_id = $${params.length}`;
  }
  if (args.unitTypeId) {
    params.push(args.unitTypeId);
    sql += ` AND unit_type_id = $${params.length}`;
  }
  if (args.statusIn && args.statusIn.length > 0) {
    params.push(args.statusIn);
    sql += ` AND status = ANY($${params.length}::text[])`;
  }
  // NOTE: Lexical ordering means "A-10" sorts before "A-9". Natural sort
  // (A-1, A-2, A-9, A-10) is deferred until UX demands it. See future
  // consideration: ORDER BY identifier COLLATE "C" or an extracted numeric
  // suffix column if needed.
  sql += ` ORDER BY identifier ASC`;

  const res = await deps.pool.query(sql, params);
  return res.rows.map(mapRow);
}

export async function getTransientInventoryUnit(
  args: { orgId: string; id: string },
  deps: ServiceDeps,
): Promise<TransientInventoryUnitRow | null> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');
  const res = await deps.pool.query(
    `SELECT * FROM transient_inventory_unit
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [args.id, args.orgId],
  );
  return res.rowCount ? mapRow(res.rows[0]) : null;
}

export async function updateTransientInventoryUnit(
  args: {
    orgId: string;
    id: string;
    patch: Partial<Pick<CreateTransientInventoryUnitInput,
      'identifier' | 'activationDate' | 'decommissionDate' | 'attributes'>> & {
        // status intentionally excluded — callers must use updateStatus.
      };
    updatedBy?: string | null;
  },
  deps: ServiceDeps,
): Promise<TransientInventoryUnitRow | null> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');

  // Reject status in the patch — callers must use updateStatus.
  if ((args.patch as any).status !== undefined) {
    throw new Error('status must be updated via updateStatus');
  }

  if (args.patch.identifier !== undefined && !args.patch.identifier.trim()) {
    throw new Error('identifier cannot be empty');
  }
  if ((args.patch as any).attributes === null) {
    throw new Error('attributes cannot be null');
  }

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (args.patch.identifier !== undefined)       { sets.push(`identifier = $${i++}`);        vals.push(args.patch.identifier.trim()); }
  if (args.patch.activationDate !== undefined)   { sets.push(`activation_date = $${i++}`);   vals.push(args.patch.activationDate); }
  if (args.patch.decommissionDate !== undefined) { sets.push(`decommission_date = $${i++}`); vals.push(args.patch.decommissionDate); }
  if (args.patch.attributes !== undefined) {
    sets.push(`attributes = $${i++}::jsonb`); vals.push(JSON.stringify(args.patch.attributes));
  }
  sets.push(`updated_at = now()`);
  sets.push(`updated_by = $${i++}`); vals.push(args.updatedBy ?? null);

  vals.push(args.id, args.orgId);
  // DB CHECK tiu_date_order_check enforces decommission_date >= activation_date
  // when both are set; any violation will surface as a thrown pg error with
  // code '23514' which the service intentionally does NOT catch.
  const res = await deps.pool.query(
    `UPDATE transient_inventory_unit
        SET ${sets.join(', ')}
      WHERE id = $${i++} AND org_id = $${i++} AND deleted_at IS NULL
      RETURNING *`,
    vals,
  );
  return res.rowCount ? mapRow(res.rows[0]) : null;
}

export async function updateStatus(
  args: {
    orgId: string;
    id: string;
    status: UnitStatus;
    updatedBy?: string | null;
  },
  deps: ServiceDeps,
): Promise<TransientInventoryUnitRow | null> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');
  if (!isValidStatus(args.status)) {
    throw new Error(`status must be one of: ${VALID_UNIT_STATUS.join(', ')}`);
  }

  const res = await deps.pool.query(
    `UPDATE transient_inventory_unit
        SET status = $3, updated_at = now(), updated_by = $4
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
      RETURNING *`,
    [args.id, args.orgId, args.status, args.updatedBy ?? null],
  );
  return res.rowCount ? mapRow(res.rows[0]) : null;
}

export async function softDeleteTransientInventoryUnit(
  args: { orgId: string; id: string; updatedBy?: string | null },
  deps: ServiceDeps,
): Promise<boolean> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');
  // Does NOT modify status — see file header comment. status='decommissioned'
  // is operational retirement; deleted_at is data-entry cleanup. Orthogonal.
  const res = await deps.pool.query(
    `UPDATE transient_inventory_unit
        SET deleted_at = now(), updated_at = now(), updated_by = $3
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [args.id, args.orgId, args.updatedBy ?? null],
  );
  return (res.rowCount ?? 0) > 0;
}
