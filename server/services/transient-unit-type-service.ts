import type { Pool } from 'pg';

export type RateBasis = 'per_foot_per_night' | 'flat_per_night' | 'per_month' | 'per_year';

export const VALID_RATE_BASIS: readonly RateBasis[] = [
  'per_foot_per_night',
  'flat_per_night',
  'per_month',
  'per_year',
] as const;

export interface TransientUnitTypeRow {
  id: string;
  orgId: string;
  propertyId: string;
  inventoryGroupId: string;
  code: string;
  name: string;
  description: string | null;
  dimensions: Record<string, unknown> | null;
  baseRate: string | null;
  rateBasis: RateBasis;
  maxOccupancy: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

export interface CreateTransientUnitTypeInput {
  orgId: string;
  propertyId: string;
  inventoryGroupId: string;
  code: string;
  name: string;
  rateBasis: RateBasis;
  description?: string | null;
  dimensions?: Record<string, unknown> | null;
  baseRate?: string | number | null;
  maxOccupancy?: number | null;
  sortOrder?: number;
  createdBy?: string | null;
}

export interface ServiceDeps {
  pool: Pick<Pool, 'query'>;
}

function isValidRateBasis(v: unknown): v is RateBasis {
  return typeof v === 'string' && (VALID_RATE_BASIS as readonly string[]).includes(v);
}

function mapRow(r: Record<string, any>): TransientUnitTypeRow {
  return {
    id: r.id,
    orgId: r.org_id,
    propertyId: r.property_id,
    inventoryGroupId: r.inventory_group_id,
    code: r.code,
    name: r.name,
    description: r.description,
    dimensions: r.dimensions,
    baseRate: r.base_rate,
    rateBasis: r.rate_basis as RateBasis,
    maxOccupancy: r.max_occupancy,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    deletedAt: r.deleted_at,
  };
}

export async function createTransientUnitType(
  input: CreateTransientUnitTypeInput,
  deps: ServiceDeps,
): Promise<TransientUnitTypeRow> {
  if (!input.orgId) throw new Error('orgId is required');
  if (!input.propertyId) throw new Error('propertyId is required');
  if (!input.inventoryGroupId) throw new Error('inventoryGroupId is required');
  if (!input.code || !input.code.trim()) throw new Error('code is required');
  if (!input.name || !input.name.trim()) throw new Error('name is required');
  if (!isValidRateBasis(input.rateBasis)) {
    throw new Error(`rateBasis must be one of: ${VALID_RATE_BASIS.join(', ')}`);
  }

  const parent = await deps.pool.query(
    `SELECT id, property_id FROM transient_inventory_group
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [input.inventoryGroupId, input.orgId],
  );
  if (parent.rowCount === 0) {
    throw new Error('inventory group not found or not accessible to this org');
  }
  if (parent.rows[0].property_id !== input.propertyId) {
    throw new Error('inventory group does not belong to the specified property');
  }

  const dimensionsParam =
    input.dimensions === undefined || input.dimensions === null
      ? null
      : JSON.stringify(input.dimensions);

  const res = await deps.pool.query(
    `INSERT INTO transient_unit_type
       (org_id, property_id, inventory_group_id, code, name, description,
        dimensions, base_rate, rate_basis, max_occupancy, sort_order,
        created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $12)
     RETURNING *`,
    [
      input.orgId,
      input.propertyId,
      input.inventoryGroupId,
      input.code.trim(),
      input.name.trim(),
      input.description ?? null,
      dimensionsParam,
      input.baseRate ?? null,
      input.rateBasis,
      input.maxOccupancy ?? null,
      input.sortOrder ?? 0,
      input.createdBy ?? null,
    ],
  );
  return mapRow(res.rows[0]);
}

export async function listTransientUnitTypes(
  args: { orgId: string; propertyId: string; inventoryGroupId?: string },
  deps: ServiceDeps,
): Promise<TransientUnitTypeRow[]> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.propertyId) throw new Error('propertyId is required');

  const params: any[] = [args.orgId, args.propertyId];
  let sql =
    `SELECT * FROM transient_unit_type
      WHERE org_id = $1 AND property_id = $2 AND deleted_at IS NULL`;
  if (args.inventoryGroupId) {
    params.push(args.inventoryGroupId);
    sql += ` AND inventory_group_id = $${params.length}`;
  }
  sql += ` ORDER BY sort_order ASC, name ASC`;

  const res = await deps.pool.query(sql, params);
  return res.rows.map(mapRow);
}

export async function getTransientUnitType(
  args: { orgId: string; id: string },
  deps: ServiceDeps,
): Promise<TransientUnitTypeRow | null> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');
  const res = await deps.pool.query(
    `SELECT * FROM transient_unit_type
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [args.id, args.orgId],
  );
  return res.rowCount ? mapRow(res.rows[0]) : null;
}

export async function updateTransientUnitType(
  args: {
    orgId: string;
    id: string;
    patch: Partial<Pick<CreateTransientUnitTypeInput,
      'name' | 'description' | 'dimensions' | 'baseRate' | 'rateBasis' | 'maxOccupancy' | 'sortOrder'>>;
    updatedBy?: string | null;
  },
  deps: ServiceDeps,
): Promise<TransientUnitTypeRow | null> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');

  if (args.patch.rateBasis !== undefined && !isValidRateBasis(args.patch.rateBasis)) {
    throw new Error(`rateBasis must be one of: ${VALID_RATE_BASIS.join(', ')}`);
  }

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (args.patch.name !== undefined)          { sets.push(`name = $${i++}`);          vals.push(args.patch.name.trim()); }
  if (args.patch.description !== undefined)   { sets.push(`description = $${i++}`);   vals.push(args.patch.description); }
  if (args.patch.dimensions !== undefined) {
    const dimParam = args.patch.dimensions === null ? null : JSON.stringify(args.patch.dimensions);
    sets.push(`dimensions = $${i++}::jsonb`); vals.push(dimParam);
  }
  if (args.patch.baseRate !== undefined)      { sets.push(`base_rate = $${i++}`);     vals.push(args.patch.baseRate); }
  if (args.patch.rateBasis !== undefined)     { sets.push(`rate_basis = $${i++}`);    vals.push(args.patch.rateBasis); }
  if (args.patch.maxOccupancy !== undefined)  { sets.push(`max_occupancy = $${i++}`); vals.push(args.patch.maxOccupancy); }
  if (args.patch.sortOrder !== undefined)     { sets.push(`sort_order = $${i++}`);    vals.push(args.patch.sortOrder); }
  sets.push(`updated_at = now()`);
  sets.push(`updated_by = $${i++}`); vals.push(args.updatedBy ?? null);

  vals.push(args.id, args.orgId);
  const res = await deps.pool.query(
    `UPDATE transient_unit_type
        SET ${sets.join(', ')}
      WHERE id = $${i++} AND org_id = $${i++} AND deleted_at IS NULL
      RETURNING *`,
    vals,
  );
  return res.rowCount ? mapRow(res.rows[0]) : null;
}

export async function softDeleteTransientUnitType(
  args: { orgId: string; id: string; updatedBy?: string | null },
  deps: ServiceDeps,
): Promise<boolean> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');
  const res = await deps.pool.query(
    `UPDATE transient_unit_type
        SET deleted_at = now(), updated_at = now(), updated_by = $3
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [args.id, args.orgId, args.updatedBy ?? null],
  );
  return (res.rowCount ?? 0) > 0;
}
