import type { Pool } from 'pg';

export interface TransientInventoryGroupRow {
  id: string;
  orgId: string;
  propertyId: string;
  assetClassId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

export interface CreateTransientInventoryGroupInput {
  orgId: string;
  propertyId: string;
  assetClassId: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  meta?: Record<string, unknown>;
  createdBy?: string | null;
}

export interface ServiceDeps {
  pool: Pick<Pool, 'query'>;
}

function mapRow(r: Record<string, any>): TransientInventoryGroupRow {
  return {
    id: r.id,
    orgId: r.org_id,
    propertyId: r.property_id,
    assetClassId: r.asset_class_id,
    name: r.name,
    description: r.description,
    sortOrder: r.sort_order,
    meta: r.meta ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    deletedAt: r.deleted_at,
  };
}

export async function createTransientInventoryGroup(
  input: CreateTransientInventoryGroupInput,
  deps: ServiceDeps,
): Promise<TransientInventoryGroupRow> {
  if (!input.orgId) throw new Error('orgId is required');
  if (!input.propertyId) throw new Error('propertyId is required');
  if (!input.assetClassId) throw new Error('assetClassId is required');
  if (!input.name || !input.name.trim()) throw new Error('name is required');

  const prop = await deps.pool.query(
    `SELECT id FROM crm_properties WHERE id = $1 AND org_id = $2`,
    [input.propertyId, input.orgId],
  );
  if (prop.rowCount === 0) {
    throw new Error('property not found or not accessible to this org');
  }

  const res = await deps.pool.query(
    `INSERT INTO transient_inventory_group
       (org_id, property_id, asset_class_id, name, description, sort_order, meta, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8)
     RETURNING *`,
    [
      input.orgId,
      input.propertyId,
      input.assetClassId,
      input.name.trim(),
      input.description ?? null,
      input.sortOrder ?? 0,
      JSON.stringify(input.meta ?? {}),
      input.createdBy ?? null,
    ],
  );
  return mapRow(res.rows[0]);
}

export async function listTransientInventoryGroups(
  args: { orgId: string; propertyId: string },
  deps: ServiceDeps,
): Promise<TransientInventoryGroupRow[]> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.propertyId) throw new Error('propertyId is required');
  const res = await deps.pool.query(
    `SELECT * FROM transient_inventory_group
      WHERE org_id = $1 AND property_id = $2 AND deleted_at IS NULL
      ORDER BY sort_order ASC, name ASC`,
    [args.orgId, args.propertyId],
  );
  return res.rows.map(mapRow);
}

export async function getTransientInventoryGroup(
  args: { orgId: string; id: string },
  deps: ServiceDeps,
): Promise<TransientInventoryGroupRow | null> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');
  const res = await deps.pool.query(
    `SELECT * FROM transient_inventory_group
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [args.id, args.orgId],
  );
  return res.rowCount ? mapRow(res.rows[0]) : null;
}

export async function updateTransientInventoryGroup(
  args: {
    orgId: string;
    id: string;
    patch: Partial<Pick<CreateTransientInventoryGroupInput,
      'name' | 'description' | 'sortOrder' | 'meta' | 'assetClassId'>>;
    updatedBy?: string | null;
  },
  deps: ServiceDeps,
): Promise<TransientInventoryGroupRow | null> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (args.patch.name !== undefined)         { sets.push(`name = $${i++}`);           vals.push(args.patch.name.trim()); }
  if (args.patch.description !== undefined)  { sets.push(`description = $${i++}`);    vals.push(args.patch.description); }
  if (args.patch.sortOrder !== undefined)    { sets.push(`sort_order = $${i++}`);     vals.push(args.patch.sortOrder); }
  if (args.patch.meta !== undefined)         { sets.push(`meta = $${i++}::jsonb`);    vals.push(JSON.stringify(args.patch.meta)); }
  if (args.patch.assetClassId !== undefined) { sets.push(`asset_class_id = $${i++}`); vals.push(args.patch.assetClassId); }
  sets.push(`updated_at = now()`);
  sets.push(`updated_by = $${i++}`); vals.push(args.updatedBy ?? null);

  vals.push(args.id, args.orgId);
  const res = await deps.pool.query(
    `UPDATE transient_inventory_group
        SET ${sets.join(', ')}
      WHERE id = $${i++} AND org_id = $${i++} AND deleted_at IS NULL
      RETURNING *`,
    vals,
  );
  return res.rowCount ? mapRow(res.rows[0]) : null;
}

export async function softDeleteTransientInventoryGroup(
  args: { orgId: string; id: string; updatedBy?: string | null },
  deps: ServiceDeps,
): Promise<boolean> {
  if (!args.orgId) throw new Error('orgId is required');
  if (!args.id) throw new Error('id is required');
  const res = await deps.pool.query(
    `UPDATE transient_inventory_group
        SET deleted_at = now(), updated_at = now(), updated_by = $3
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [args.id, args.orgId, args.updatedBy ?? null],
  );
  return (res.rowCount ?? 0) > 0;
}
