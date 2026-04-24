/**
 * Unit tests for transient-inventory-service.
 *
 * Covers all five CRUD functions with SQL-string-dispatching mock pool:
 *   - createTransientInventoryGroup (happy path, 4 validation errors, cross-org guard)
 *   - listTransientInventoryGroups (ordering + soft-delete filter)
 *   - getTransientInventoryGroup (null on miss + orgId scoping)
 *   - updateTransientInventoryGroup (partial patch, empty patch, cross-org)
 *   - softDeleteTransientInventoryGroup (happy, cross-org, idempotent)
 *
 * 16 cases total. No DB connection — Pool is injected via the deps bag.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  createTransientInventoryGroup,
  listTransientInventoryGroups,
  getTransientInventoryGroup,
  updateTransientInventoryGroup,
  softDeleteTransientInventoryGroup,
  type CreateTransientInventoryGroupInput,
} from '../transient-inventory-service';

type QueryResult = { rows: any[]; rowCount: number };

// Dispatch-by-SQL-substring mock pool. First matching pattern wins; unmatched
// SQL throws so a stray query blows up the test instead of silently returning {}.
function makeDispatcher(routes: Array<[RegExp, QueryResult]>) {
  const query = vi.fn(async (sql: string, _params?: any[]) => {
    for (const [pattern, result] of routes) {
      if (pattern.test(sql)) return result;
    }
    throw new Error(`no mock route matched SQL: ${sql.slice(0, 120).replace(/\s+/g, ' ')}`);
  });
  return { pool: { query } as unknown as Pick<Pool, 'query'>, query };
}

function baseInput(overrides: Partial<CreateTransientInventoryGroupInput> = {}): CreateTransientInventoryGroupInput {
  return {
    orgId: 'org-1',
    propertyId: 'prop-1',
    assetClassId: 'marina',
    name: 'Main Dock',
    ...overrides,
  };
}

function baseRow(overrides: Record<string, any> = {}) {
  return {
    id: 'tig-1',
    org_id: 'org-1',
    property_id: 'prop-1',
    asset_class_id: 'marina',
    name: 'Main Dock',
    description: null,
    sort_order: 0,
    meta: {},
    created_at: new Date('2026-04-24T00:00:00Z'),
    updated_at: new Date('2026-04-24T00:00:00Z'),
    created_by: null,
    updated_by: null,
    deleted_at: null,
    ...overrides,
  };
}

describe('createTransientInventoryGroup', () => {
  it('happy path — inserts row and returns mapped result', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM crm_properties/i, { rows: [{ id: 'prop-1' }], rowCount: 1 }],
      [/INSERT INTO transient_inventory_group/i, { rows: [baseRow()], rowCount: 1 }],
    ]);

    const result = await createTransientInventoryGroup(baseInput(), { pool });

    expect(result).toMatchObject({
      id: 'tig-1',
      orgId: 'org-1',
      propertyId: 'prop-1',
      assetClassId: 'marina',
      name: 'Main Dock',
      sortOrder: 0,
      meta: {},
    });
    expect(query).toHaveBeenCalledTimes(2);

    // SELECT crm_properties was parameterized as (propertyId, orgId)
    const [selectSql, selectParams] = query.mock.calls[0];
    expect(selectSql).toMatch(/FROM crm_properties/i);
    expect(selectParams).toEqual(['prop-1', 'org-1']);

    // INSERT params: orgId in $1, propertyId in $2, JSON.stringify({}) as meta
    const [insertSql, insertParams] = query.mock.calls[1];
    expect(insertSql).toMatch(/INSERT INTO transient_inventory_group/i);
    expect(insertParams[0]).toBe('org-1');
    expect(insertParams[1]).toBe('prop-1');
    expect(insertParams[2]).toBe('marina');
    expect(insertParams[3]).toBe('Main Dock');
    expect(insertParams[6]).toBe(JSON.stringify({}));
  });

  it('throws when orgId missing (undefined and empty string)', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      createTransientInventoryGroup(baseInput({ orgId: undefined as any }), { pool }),
    ).rejects.toThrow(/orgId is required/);
    await expect(
      createTransientInventoryGroup(baseInput({ orgId: '' }), { pool }),
    ).rejects.toThrow(/orgId is required/);
    expect(query).not.toHaveBeenCalled();
  });

  it('throws when propertyId missing', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      createTransientInventoryGroup(baseInput({ propertyId: '' }), { pool }),
    ).rejects.toThrow(/propertyId is required/);
    expect(query).not.toHaveBeenCalled();
  });

  it('throws when assetClassId missing', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      createTransientInventoryGroup(baseInput({ assetClassId: '' }), { pool }),
    ).rejects.toThrow(/assetClassId is required/);
    expect(query).not.toHaveBeenCalled();
  });

  it('throws when name is whitespace-only', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      createTransientInventoryGroup(baseInput({ name: '   ' }), { pool }),
    ).rejects.toThrow(/name is required/);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects cross-org property — INSERT never runs', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM crm_properties/i, { rows: [], rowCount: 0 }],
      // INSERT route deliberately omitted — if called, test fails.
    ]);

    await expect(
      createTransientInventoryGroup(baseInput({ orgId: 'attacker-org' }), { pool }),
    ).rejects.toThrow(/property not found/);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/FROM crm_properties/i);
  });
});

describe('listTransientInventoryGroups', () => {
  it('returns rows ordered by sort_order then name', async () => {
    const rowA = baseRow({ id: 'tig-A', name: 'Alpha', sort_order: 0 });
    const rowB = baseRow({ id: 'tig-B', name: 'Bravo', sort_order: 1 });
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_group/i, { rows: [rowA, rowB], rowCount: 2 }],
    ]);

    const result = await listTransientInventoryGroups({ orgId: 'org-1', propertyId: 'prop-1' }, { pool });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('tig-A');
    expect(result[1].id).toBe('tig-B');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE org_id = \$1 AND property_id = \$2 AND deleted_at IS NULL/);
    expect(sql).toMatch(/ORDER BY sort_order ASC, name ASC/);
    expect(params).toEqual(['org-1', 'prop-1']);
  });

  it('SQL excludes soft-deleted rows (deleted_at IS NULL clause present)', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_group/i, { rows: [], rowCount: 0 }],
    ]);

    await listTransientInventoryGroups({ orgId: 'org-1', propertyId: 'prop-1' }, { pool });

    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/deleted_at IS NULL/);
  });
});

describe('getTransientInventoryGroup', () => {
  it('returns null when rowCount is 0', async () => {
    const { pool } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_group/i, { rows: [], rowCount: 0 }],
    ]);

    const result = await getTransientInventoryGroup({ orgId: 'org-1', id: 'tig-missing' }, { pool });
    expect(result).toBeNull();
  });

  it('scopes by orgId (id = $1 AND org_id = $2)', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_group/i, { rows: [baseRow()], rowCount: 1 }],
    ]);

    await getTransientInventoryGroup({ orgId: 'org-1', id: 'tig-1' }, { pool });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND org_id = \$2 AND deleted_at IS NULL/);
    expect(params).toEqual(['tig-1', 'org-1']);
  });
});

describe('updateTransientInventoryGroup', () => {
  it('patches only provided fields (name only)', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_group/i, { rows: [baseRow({ name: 'New Name' })], rowCount: 1 }],
    ]);

    await updateTransientInventoryGroup(
      { orgId: 'org-1', id: 'tig-1', patch: { name: 'New Name' } },
      { pool },
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SET name = \$1/);
    expect(sql).toMatch(/updated_at = now\(\)/);
    expect(sql).toMatch(/updated_by = \$2/);
    expect(sql).not.toMatch(/description = /);
    expect(sql).not.toMatch(/sort_order = /);
    expect(sql).not.toMatch(/meta = /);
    expect(sql).not.toMatch(/asset_class_id = /);
    // Params: [name, updatedBy, id, orgId]
    expect(params[0]).toBe('New Name');
    expect(params[1]).toBeNull();
    expect(params[2]).toBe('tig-1');
    expect(params[3]).toBe('org-1');
  });

  it('bumps updated_at/updated_by even on empty patch', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_group/i, { rows: [baseRow()], rowCount: 1 }],
    ]);

    await updateTransientInventoryGroup(
      { orgId: 'org-1', id: 'tig-1', patch: {} },
      { pool },
    );

    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/updated_at = now\(\)/);
    expect(sql).toMatch(/updated_by = \$1/);
    expect(sql).not.toMatch(/SET name = /);
  });

  it('cross-org update blocked — WHERE includes org_id and rowCount 0 returns null', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_group/i, { rows: [], rowCount: 0 }],
    ]);

    const result = await updateTransientInventoryGroup(
      { orgId: 'attacker-org', id: 'tig-1', patch: { name: 'Hacked' } },
      { pool },
    );

    expect(result).toBeNull();
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/org_id = \$\d+/);
  });
});

describe('softDeleteTransientInventoryGroup', () => {
  it('sets deleted_at, updated_at, updated_by and returns true on hit', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_group/i, { rows: [], rowCount: 1 }],
    ]);

    const result = await softDeleteTransientInventoryGroup(
      { orgId: 'org-1', id: 'tig-1', updatedBy: 'user-1' },
      { pool },
    );

    expect(result).toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SET deleted_at = now\(\)/);
    expect(sql).toMatch(/updated_at = now\(\)/);
    expect(sql).toMatch(/updated_by = \$3/);
    expect(params).toEqual(['tig-1', 'org-1', 'user-1']);
  });

  it('cross-org soft-delete blocked (rowCount 0 → false)', async () => {
    const { pool } = makeDispatcher([
      [/UPDATE transient_inventory_group/i, { rows: [], rowCount: 0 }],
    ]);

    const result = await softDeleteTransientInventoryGroup(
      { orgId: 'attacker-org', id: 'tig-1' },
      { pool },
    );
    expect(result).toBe(false);
  });

  it('idempotent — second call on already-soft-deleted row returns false', async () => {
    const { pool } = makeDispatcher([
      [/UPDATE transient_inventory_group/i, { rows: [], rowCount: 0 }],
    ]);

    const result = await softDeleteTransientInventoryGroup(
      { orgId: 'org-1', id: 'tig-already-deleted' },
      { pool },
    );
    expect(result).toBe(false);
  });
});
