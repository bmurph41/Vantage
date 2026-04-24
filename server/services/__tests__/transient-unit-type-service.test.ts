/**
 * Unit tests for transient-unit-type-service.
 *
 * Covers all five CRUD functions with SQL-string-dispatching mock pool:
 *   - createTransientUnitType (happy, required-field table, invalid rateBasis, cross-org, cross-property)
 *   - listTransientUnitTypes (ordering + optional group filter + soft-delete clause)
 *   - getTransientUnitType (null on miss + orgId scoping)
 *   - updateTransientUnitType (partial patch, empty patch, cross-org, invalid rateBasis)
 *   - softDeleteTransientUnitType (happy + consolidated cross-org/idempotent)
 *
 * 16 cases total. No DB connection — Pool is injected via the deps bag.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  createTransientUnitType,
  listTransientUnitTypes,
  getTransientUnitType,
  updateTransientUnitType,
  softDeleteTransientUnitType,
  type CreateTransientUnitTypeInput,
} from '../transient-unit-type-service';

type QueryResult = { rows: any[]; rowCount: number };

function makeDispatcher(routes: Array<[RegExp, QueryResult]>) {
  const query = vi.fn(async (sql: string, _params?: any[]) => {
    for (const [pattern, result] of routes) {
      if (pattern.test(sql)) return result;
    }
    throw new Error(`no mock route matched SQL: ${sql.slice(0, 120).replace(/\s+/g, ' ')}`);
  });
  return { pool: { query } as unknown as Pick<Pool, 'query'>, query };
}

function baseInput(overrides: Partial<CreateTransientUnitTypeInput> = {}): CreateTransientUnitTypeInput {
  return {
    orgId: 'org-1',
    propertyId: 'prop-1',
    inventoryGroupId: 'tig-1',
    code: 'KING-OV',
    name: 'King Ocean View',
    rateBasis: 'flat_per_night',
    ...overrides,
  };
}

function baseRow(overrides: Record<string, any> = {}) {
  return {
    id: 'tut-1',
    org_id: 'org-1',
    property_id: 'prop-1',
    inventory_group_id: 'tig-1',
    code: 'KING-OV',
    name: 'King Ocean View',
    description: null,
    dimensions: null,
    base_rate: null,
    rate_basis: 'flat_per_night',
    max_occupancy: null,
    sort_order: 0,
    created_at: new Date('2026-04-24T00:00:00Z'),
    updated_at: new Date('2026-04-24T00:00:00Z'),
    created_by: null,
    updated_by: null,
    deleted_at: null,
    ...overrides,
  };
}

describe('createTransientUnitType', () => {
  it('happy path — inserts row and returns mapped result', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_inventory_group/i, { rows: [{ id: 'tig-1', property_id: 'prop-1' }], rowCount: 1 }],
      [/INSERT INTO transient_unit_type/i, { rows: [baseRow({ dimensions: { bed: 'king' } })], rowCount: 1 }],
    ]);

    const result = await createTransientUnitType(
      baseInput({ dimensions: { bed: 'king' }, description: 'Oceanfront', maxOccupancy: 2, baseRate: '299.0000' }),
      { pool },
    );

    expect(result).toMatchObject({
      id: 'tut-1',
      orgId: 'org-1',
      propertyId: 'prop-1',
      inventoryGroupId: 'tig-1',
      code: 'KING-OV',
      name: 'King Ocean View',
      rateBasis: 'flat_per_night',
      sortOrder: 0,
    });
    expect(query).toHaveBeenCalledTimes(2);

    // Parent lookup: (inventoryGroupId, orgId)
    const [selectSql, selectParams] = query.mock.calls[0];
    expect(selectSql).toMatch(/FROM transient_inventory_group/i);
    expect(selectSql).toMatch(/WHERE id = \$1 AND org_id = \$2 AND deleted_at IS NULL/);
    expect(selectParams).toEqual(['tig-1', 'org-1']);

    // INSERT positional args
    const [insertSql, insertParams] = query.mock.calls[1];
    expect(insertSql).toMatch(/INSERT INTO transient_unit_type/i);
    expect(insertParams[0]).toBe('org-1');           // org_id
    expect(insertParams[1]).toBe('prop-1');          // property_id
    expect(insertParams[2]).toBe('tig-1');           // inventory_group_id
    expect(insertParams[3]).toBe('KING-OV');         // code (trimmed)
    expect(insertParams[4]).toBe('King Ocean View'); // name (trimmed)
    expect(insertParams[5]).toBe('Oceanfront');      // description
    expect(insertParams[6]).toBe(JSON.stringify({ bed: 'king' })); // dimensions
    expect(insertParams[7]).toBe('299.0000');        // base_rate
    expect(insertParams[8]).toBe('flat_per_night');  // rate_basis
    expect(insertParams[9]).toBe(2);                 // max_occupancy
    expect(insertParams[10]).toBe(0);                // sort_order default
    expect(insertParams[11]).toBeNull();             // created_by
  });

  it.each([
    ['orgId', { orgId: '' }, /orgId is required/],
    ['propertyId', { propertyId: '' }, /propertyId is required/],
    ['inventoryGroupId', { inventoryGroupId: '' }, /inventoryGroupId is required/],
    ['code whitespace', { code: '   ' }, /code is required/],
    ['name whitespace', { name: '   ' }, /name is required/],
  ])('throws when %s is missing/empty — no queries issued', async (_label, overrides, expectedError) => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      createTransientUnitType(baseInput(overrides as Partial<CreateTransientUnitTypeInput>), { pool }),
    ).rejects.toThrow(expectedError);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects invalid rateBasis — no queries issued', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      createTransientUnitType(baseInput({ rateBasis: 'weekly' as any }), { pool }),
    ).rejects.toThrow(/rateBasis must be one of/);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects cross-org inventory group — INSERT never runs', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_inventory_group/i, { rows: [], rowCount: 0 }],
      // INSERT route deliberately omitted — if called, test fails.
    ]);

    await expect(
      createTransientUnitType(baseInput({ orgId: 'attacker-org' }), { pool }),
    ).rejects.toThrow(/inventory group not found/);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/FROM transient_inventory_group/i);
  });

  it('rejects inventory group belonging to a different property — INSERT never runs', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_inventory_group/i, { rows: [{ id: 'tig-1', property_id: 'prop-OTHER' }], rowCount: 1 }],
      // INSERT route deliberately omitted — if called, test fails.
    ]);

    await expect(
      createTransientUnitType(baseInput({ propertyId: 'prop-1' }), { pool }),
    ).rejects.toThrow(/does not belong to the specified property/);

    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('listTransientUnitTypes', () => {
  it('returns rows ordered by sort_order then name (no group filter)', async () => {
    const rowA = baseRow({ id: 'tut-A', name: 'Alpha', sort_order: 0 });
    const rowB = baseRow({ id: 'tut-B', name: 'Bravo', sort_order: 1 });
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_unit_type/i, { rows: [rowA, rowB], rowCount: 2 }],
    ]);

    const result = await listTransientUnitTypes({ orgId: 'org-1', propertyId: 'prop-1' }, { pool });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('tut-A');
    expect(result[1].id).toBe('tut-B');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE org_id = \$1 AND property_id = \$2 AND deleted_at IS NULL/);
    expect(sql).toMatch(/ORDER BY sort_order ASC, name ASC/);
    expect(sql).not.toMatch(/inventory_group_id = /);
    expect(params).toEqual(['org-1', 'prop-1']);
  });

  it('appends inventory_group_id filter when provided', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_unit_type/i, { rows: [], rowCount: 0 }],
    ]);

    await listTransientUnitTypes(
      { orgId: 'org-1', propertyId: 'prop-1', inventoryGroupId: 'tig-1' },
      { pool },
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/AND inventory_group_id = \$3/);
    expect(params).toEqual(['org-1', 'prop-1', 'tig-1']);
  });

  it('SQL excludes soft-deleted rows (deleted_at IS NULL clause present)', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_unit_type/i, { rows: [], rowCount: 0 }],
    ]);

    await listTransientUnitTypes({ orgId: 'org-1', propertyId: 'prop-1' }, { pool });

    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/deleted_at IS NULL/);
  });
});

describe('getTransientUnitType', () => {
  it('returns null when rowCount is 0', async () => {
    const { pool } = makeDispatcher([
      [/SELECT \* FROM transient_unit_type/i, { rows: [], rowCount: 0 }],
    ]);

    const result = await getTransientUnitType({ orgId: 'org-1', id: 'tut-missing' }, { pool });
    expect(result).toBeNull();
  });

  it('scopes by orgId (id = $1 AND org_id = $2 AND deleted_at IS NULL)', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_unit_type/i, { rows: [baseRow()], rowCount: 1 }],
    ]);

    await getTransientUnitType({ orgId: 'org-1', id: 'tut-1' }, { pool });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND org_id = \$2 AND deleted_at IS NULL/);
    expect(params).toEqual(['tut-1', 'org-1']);
  });
});

describe('updateTransientUnitType', () => {
  it('patches only provided fields (name only)', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_unit_type/i, { rows: [baseRow({ name: 'New Name' })], rowCount: 1 }],
    ]);

    await updateTransientUnitType(
      { orgId: 'org-1', id: 'tut-1', patch: { name: 'New Name' } },
      { pool },
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SET name = \$1/);
    expect(sql).toMatch(/updated_at = now\(\)/);
    expect(sql).toMatch(/updated_by = \$2/);
    expect(sql).not.toMatch(/description = /);
    expect(sql).not.toMatch(/dimensions = /);
    expect(sql).not.toMatch(/base_rate = /);
    expect(sql).not.toMatch(/rate_basis = /);
    expect(sql).not.toMatch(/max_occupancy = /);
    expect(sql).not.toMatch(/sort_order = /);
    // Params: [name, updatedBy, id, orgId]
    expect(params[0]).toBe('New Name');
    expect(params[1]).toBeNull();
    expect(params[2]).toBe('tut-1');
    expect(params[3]).toBe('org-1');
  });

  it('bumps updated_at/updated_by even on empty patch', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_unit_type/i, { rows: [baseRow()], rowCount: 1 }],
    ]);

    await updateTransientUnitType(
      { orgId: 'org-1', id: 'tut-1', patch: {} },
      { pool },
    );

    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/updated_at = now\(\)/);
    expect(sql).toMatch(/updated_by = \$1/);
    expect(sql).not.toMatch(/SET name = /);
  });

  it('cross-org update blocked — WHERE includes org_id and rowCount 0 returns null', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_unit_type/i, { rows: [], rowCount: 0 }],
    ]);

    const result = await updateTransientUnitType(
      { orgId: 'attacker-org', id: 'tut-1', patch: { name: 'Hacked' } },
      { pool },
    );

    expect(result).toBeNull();
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/org_id = \$\d+/);
  });

  it('rejects invalid rateBasis patch pre-SQL (no queries)', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      updateTransientUnitType(
        { orgId: 'org-1', id: 'tut-1', patch: { rateBasis: 'hourly' as any } },
        { pool },
      ),
    ).rejects.toThrow(/rateBasis must be one of/);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('softDeleteTransientUnitType', () => {
  it('sets deleted_at, updated_at, updated_by and returns true on hit', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_unit_type/i, { rows: [], rowCount: 1 }],
    ]);

    const result = await softDeleteTransientUnitType(
      { orgId: 'org-1', id: 'tut-1', updatedBy: 'user-1' },
      { pool },
    );

    expect(result).toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SET deleted_at = now\(\)/);
    expect(sql).toMatch(/updated_at = now\(\)/);
    expect(sql).toMatch(/updated_by = \$3/);
    expect(params).toEqual(['tut-1', 'org-1', 'user-1']);
  });

  it('cross-org blocked and idempotent — rowCount 0 returns false', async () => {
    const { pool } = makeDispatcher([
      [/UPDATE transient_unit_type/i, { rows: [], rowCount: 0 }],
    ]);

    const attacker = await softDeleteTransientUnitType(
      { orgId: 'attacker-org', id: 'tut-1' },
      { pool },
    );
    expect(attacker).toBe(false);

    const idempotent = await softDeleteTransientUnitType(
      { orgId: 'org-1', id: 'tut-already-deleted' },
      { pool },
    );
    expect(idempotent).toBe(false);
  });
});
