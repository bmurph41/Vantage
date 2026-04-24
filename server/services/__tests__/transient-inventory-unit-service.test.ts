/**
 * Unit tests for transient-inventory-unit-service.
 *
 * Covers all six functions with SQL-string-dispatching mock pool:
 *   - createTransientInventoryUnit (happy, required-field table, invalid status,
 *     cross-org / cross-property / cross-group parent guard, attributes default)
 *   - listTransientInventoryUnits (no-filter, group filter, unit-type filter,
 *     statusIn filter, invalid status rejection, soft-delete clause)
 *   - getTransientInventoryUnit (null on miss + orgId scoping)
 *   - updateTransientInventoryUnit (partial patch, status rejection,
 *     empty identifier, cross-org, DB CHECK propagation)
 *   - updateStatus (happy, invalid, cross-org, decommission_date untouched)
 *   - softDeleteTransientInventoryUnit (happy + status untouched, cross-org)
 *
 * Expanded surface vs. Tables A/B because of the three-way parent guard,
 * the isolated updateStatus function, and the orthogonality of status vs.
 * deleted_at. Expect ~30 vitest subtests after it.each expansion.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  createTransientInventoryUnit,
  listTransientInventoryUnits,
  getTransientInventoryUnit,
  updateTransientInventoryUnit,
  updateStatus,
  softDeleteTransientInventoryUnit,
  type CreateTransientInventoryUnitInput,
} from '../transient-inventory-unit-service';

type QueryResult = { rows: any[]; rowCount: number };

function makeDispatcher(routes: Array<[RegExp, QueryResult | Error]>) {
  const query = vi.fn(async (sql: string, _params?: any[]) => {
    for (const [pattern, result] of routes) {
      if (pattern.test(sql)) {
        if (result instanceof Error) throw result;
        return result;
      }
    }
    throw new Error(`no mock route matched SQL: ${sql.slice(0, 120).replace(/\s+/g, ' ')}`);
  });
  return { pool: { query } as unknown as Pick<Pool, 'query'>, query };
}

function baseInput(overrides: Partial<CreateTransientInventoryUnitInput> = {}): CreateTransientInventoryUnitInput {
  return {
    orgId: 'org-1',
    propertyId: 'prop-1',
    inventoryGroupId: 'tig-1',
    unitTypeId: 'tut-1',
    identifier: 'A-12',
    ...overrides,
  };
}

function baseRow(overrides: Record<string, any> = {}) {
  return {
    id: 'tiu-1',
    org_id: 'org-1',
    property_id: 'prop-1',
    inventory_group_id: 'tig-1',
    unit_type_id: 'tut-1',
    identifier: 'A-12',
    status: 'active',
    activation_date: null,
    decommission_date: null,
    attributes: {},
    created_at: new Date('2026-04-24T00:00:00Z'),
    updated_at: new Date('2026-04-24T00:00:00Z'),
    created_by: null,
    updated_by: null,
    deleted_at: null,
    ...overrides,
  };
}

const PARENT_OK = {
  rows: [{ org_id: 'org-1', property_id: 'prop-1', inventory_group_id: 'tig-1' }],
  rowCount: 1,
};

describe('createTransientInventoryUnit', () => {
  it('happy path — parent lookup + insert, defaults applied, returns mapped row', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_unit_type/i, PARENT_OK],
      [/INSERT INTO transient_inventory_unit/i, { rows: [baseRow()], rowCount: 1 }],
    ]);

    const result = await createTransientInventoryUnit(baseInput(), { pool });

    expect(result).toMatchObject({
      id: 'tiu-1',
      orgId: 'org-1',
      propertyId: 'prop-1',
      inventoryGroupId: 'tig-1',
      unitTypeId: 'tut-1',
      identifier: 'A-12',
      status: 'active',
      attributes: {},
    });
    expect(query).toHaveBeenCalledTimes(2);

    const [selectSql, selectParams] = query.mock.calls[0];
    expect(selectSql).toMatch(/FROM transient_unit_type/i);
    expect(selectSql).toMatch(/WHERE id = \$1 AND org_id = \$2 AND deleted_at IS NULL/);
    expect(selectParams).toEqual(['tut-1', 'org-1']);

    const [insertSql, insertParams] = query.mock.calls[1];
    expect(insertSql).toMatch(/INSERT INTO transient_inventory_unit/i);
    expect(insertParams[0]).toBe('org-1');
    expect(insertParams[1]).toBe('prop-1');
    expect(insertParams[2]).toBe('tig-1');
    expect(insertParams[3]).toBe('tut-1');
    expect(insertParams[4]).toBe('A-12');
    expect(insertParams[5]).toBe('active');           // default status literal, not undefined
    expect(insertParams[6]).toBeNull();               // activation_date
    expect(insertParams[7]).toBeNull();               // decommission_date
    expect(insertParams[8]).toBe(JSON.stringify({})); // attributes default
    expect(insertParams[9]).toBeNull();               // created_by
  });

  it.each([
    ['orgId', { orgId: '' }, /orgId is required/],
    ['propertyId', { propertyId: '' }, /propertyId is required/],
    ['inventoryGroupId', { inventoryGroupId: '' }, /inventoryGroupId is required/],
    ['unitTypeId', { unitTypeId: '' }, /unitTypeId is required/],
    ['identifier whitespace', { identifier: '   ' }, /identifier is required/],
  ])('throws when %s is missing/empty — no queries issued', async (_label, overrides, expectedError) => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      createTransientInventoryUnit(baseInput(overrides as Partial<CreateTransientInventoryUnitInput>), { pool }),
    ).rejects.toThrow(expectedError);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects invalid status — no queries issued', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      createTransientInventoryUnit(baseInput({ status: 'broken' as any }), { pool }),
    ).rejects.toThrow(/status must be one of/);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects cross-org unit_type — INSERT never runs', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_unit_type/i, { rows: [], rowCount: 0 }],
    ]);
    await expect(
      createTransientInventoryUnit(baseInput({ orgId: 'attacker-org' }), { pool }),
    ).rejects.toThrow(/unit type not found/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects unit_type belonging to a different property — INSERT never runs', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_unit_type/i, {
        rows: [{ org_id: 'org-1', property_id: 'prop-OTHER', inventory_group_id: 'tig-1' }],
        rowCount: 1,
      }],
    ]);
    await expect(
      createTransientInventoryUnit(baseInput({ propertyId: 'prop-1' }), { pool }),
    ).rejects.toThrow(/does not belong to the specified property/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects unit_type belonging to a different inventory group — INSERT never runs', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_unit_type/i, {
        rows: [{ org_id: 'org-1', property_id: 'prop-1', inventory_group_id: 'tig-OTHER' }],
        rowCount: 1,
      }],
    ]);
    await expect(
      createTransientInventoryUnit(baseInput({ inventoryGroupId: 'tig-1' }), { pool }),
    ).rejects.toThrow(/does not belong to the specified inventory group/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('attributes default to {} when omitted; status defaults to literal "active" (not undefined)', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_unit_type/i, PARENT_OK],
      [/INSERT INTO transient_inventory_unit/i, { rows: [baseRow()], rowCount: 1 }],
    ]);
    await createTransientInventoryUnit(baseInput(), { pool });
    const [, insertParams] = query.mock.calls[1];
    // Stability assertion: no undefined in params.
    expect(insertParams).not.toContain(undefined);
    expect(insertParams[5]).toBe('active');
    expect(insertParams[8]).toBe(JSON.stringify({}));
  });

  it('accepts explicit status override (e.g. "ooo") and passes it through', async () => {
    const { pool, query } = makeDispatcher([
      [/FROM transient_unit_type/i, PARENT_OK],
      [/INSERT INTO transient_inventory_unit/i, { rows: [baseRow({ status: 'ooo' })], rowCount: 1 }],
    ]);
    await createTransientInventoryUnit(baseInput({ status: 'ooo' }), { pool });
    const [, insertParams] = query.mock.calls[1];
    expect(insertParams[5]).toBe('ooo');
  });
});

describe('listTransientInventoryUnits', () => {
  it('returns rows ordered by identifier ASC (no filters)', async () => {
    const rowA = baseRow({ id: 'tiu-A', identifier: 'A-1' });
    const rowB = baseRow({ id: 'tiu-B', identifier: 'A-2' });
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_unit/i, { rows: [rowA, rowB], rowCount: 2 }],
    ]);

    const result = await listTransientInventoryUnits({ orgId: 'org-1', propertyId: 'prop-1' }, { pool });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('tiu-A');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE org_id = \$1 AND property_id = \$2 AND deleted_at IS NULL/);
    expect(sql).toMatch(/ORDER BY identifier ASC/);
    expect(sql).not.toMatch(/inventory_group_id = /);
    expect(sql).not.toMatch(/unit_type_id = /);
    expect(sql).not.toMatch(/status = ANY/);
    expect(params).toEqual(['org-1', 'prop-1']);
  });

  it('appends inventory_group_id filter when provided', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_unit/i, { rows: [], rowCount: 0 }],
    ]);
    await listTransientInventoryUnits(
      { orgId: 'org-1', propertyId: 'prop-1', inventoryGroupId: 'tig-1' },
      { pool },
    );
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/AND inventory_group_id = \$3/);
    expect(params).toEqual(['org-1', 'prop-1', 'tig-1']);
  });

  it('appends unit_type_id filter when provided', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_unit/i, { rows: [], rowCount: 0 }],
    ]);
    await listTransientInventoryUnits(
      { orgId: 'org-1', propertyId: 'prop-1', unitTypeId: 'tut-1' },
      { pool },
    );
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/AND unit_type_id = \$3/);
    expect(params).toEqual(['org-1', 'prop-1', 'tut-1']);
  });

  it('appends statusIn filter as ANY(text[]) when provided', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_unit/i, { rows: [], rowCount: 0 }],
    ]);
    await listTransientInventoryUnits(
      { orgId: 'org-1', propertyId: 'prop-1', statusIn: ['active', 'ooo'] },
      { pool },
    );
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/AND status = ANY\(\$3::text\[\]\)/);
    expect(params).toEqual(['org-1', 'prop-1', ['active', 'ooo']]);
  });

  it('rejects invalid value in statusIn pre-SQL — no queries', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      listTransientInventoryUnits(
        { orgId: 'org-1', propertyId: 'prop-1', statusIn: ['active', 'bogus' as any] },
        { pool },
      ),
    ).rejects.toThrow(/status must be one of/);
    expect(query).not.toHaveBeenCalled();
  });

  it('SQL always excludes soft-deleted rows', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_unit/i, { rows: [], rowCount: 0 }],
    ]);
    await listTransientInventoryUnits({ orgId: 'org-1', propertyId: 'prop-1' }, { pool });
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/deleted_at IS NULL/);
  });
});

describe('getTransientInventoryUnit', () => {
  it('returns null on rowCount 0', async () => {
    const { pool } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_unit/i, { rows: [], rowCount: 0 }],
    ]);
    const result = await getTransientInventoryUnit({ orgId: 'org-1', id: 'tiu-missing' }, { pool });
    expect(result).toBeNull();
  });

  it('scopes by orgId (id = $1 AND org_id = $2 AND deleted_at IS NULL)', async () => {
    const { pool, query } = makeDispatcher([
      [/SELECT \* FROM transient_inventory_unit/i, { rows: [baseRow()], rowCount: 1 }],
    ]);
    await getTransientInventoryUnit({ orgId: 'org-1', id: 'tiu-1' }, { pool });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND org_id = \$2 AND deleted_at IS NULL/);
    expect(params).toEqual(['tiu-1', 'org-1']);
  });
});

describe('updateTransientInventoryUnit', () => {
  it('patches only provided fields (identifier only) — other columns absent from SQL', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_unit/i, { rows: [baseRow({ identifier: 'A-99' })], rowCount: 1 }],
    ]);
    await updateTransientInventoryUnit(
      { orgId: 'org-1', id: 'tiu-1', patch: { identifier: 'A-99' } },
      { pool },
    );
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SET identifier = \$1/);
    expect(sql).toMatch(/updated_at = now\(\)/);
    expect(sql).toMatch(/updated_by = \$2/);
    expect(sql).not.toMatch(/activation_date = /);
    expect(sql).not.toMatch(/decommission_date = /);
    expect(sql).not.toMatch(/attributes = /);
    expect(sql).not.toMatch(/status = /);
    expect(params[0]).toBe('A-99');
    expect(params[1]).toBeNull();
    expect(params[2]).toBe('tiu-1');
    expect(params[3]).toBe('org-1');
  });

  it('rejects status in patch — callers must use updateStatus', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      updateTransientInventoryUnit(
        { orgId: 'org-1', id: 'tiu-1', patch: { status: 'ooo' } as any },
        { pool },
      ),
    ).rejects.toThrow(/updateStatus/);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects empty/whitespace identifier in patch — no queries', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      updateTransientInventoryUnit(
        { orgId: 'org-1', id: 'tiu-1', patch: { identifier: '   ' } },
        { pool },
      ),
    ).rejects.toThrow(/identifier cannot be empty/);
    expect(query).not.toHaveBeenCalled();
  });

  it('cross-org update blocked — WHERE includes org_id and rowCount 0 returns null', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_unit/i, { rows: [], rowCount: 0 }],
    ]);
    const result = await updateTransientInventoryUnit(
      { orgId: 'attacker-org', id: 'tiu-1', patch: { identifier: 'Hacked' } },
      { pool },
    );
    expect(result).toBeNull();
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/org_id = \$\d+/);
  });

  it('DB CHECK date-order violation propagates (service does not swallow)', async () => {
    const checkErr = Object.assign(new Error('new row for relation "transient_inventory_unit" violates check constraint "tiu_date_order_check"'), {
      code: '23514',
      constraint: 'tiu_date_order_check',
    });
    const { pool } = makeDispatcher([
      [/UPDATE transient_inventory_unit/i, checkErr],
    ]);

    await expect(
      updateTransientInventoryUnit(
        {
          orgId: 'org-1',
          id: 'tiu-1',
          patch: { activationDate: '2026-06-01', decommissionDate: '2026-01-01' },
        },
        { pool },
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'tiu_date_order_check' });
  });
});

describe('updateStatus', () => {
  it('happy path — UPDATE sets status/updated_at/updated_by and returns mapped row', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_unit/i, { rows: [baseRow({ status: 'ooo' })], rowCount: 1 }],
    ]);
    const result = await updateStatus(
      { orgId: 'org-1', id: 'tiu-1', status: 'ooo', updatedBy: 'user-1' },
      { pool },
    );
    expect(result).toMatchObject({ id: 'tiu-1', status: 'ooo' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SET status = \$3, updated_at = now\(\), updated_by = \$4/);
    expect(sql).toMatch(/WHERE id = \$1 AND org_id = \$2 AND deleted_at IS NULL/);
    expect(params).toEqual(['tiu-1', 'org-1', 'ooo', 'user-1']);
  });

  it('rejects invalid status pre-SQL — no queries', async () => {
    const { pool, query } = makeDispatcher([]);
    await expect(
      updateStatus({ orgId: 'org-1', id: 'tiu-1', status: 'broken' as any }, { pool }),
    ).rejects.toThrow(/status must be one of/);
    expect(query).not.toHaveBeenCalled();
  });

  it('cross-org blocked — rowCount 0 returns null', async () => {
    const { pool } = makeDispatcher([
      [/UPDATE transient_inventory_unit/i, { rows: [], rowCount: 0 }],
    ]);
    const result = await updateStatus(
      { orgId: 'attacker-org', id: 'tiu-1', status: 'decommissioned' },
      { pool },
    );
    expect(result).toBeNull();
  });

  it('does NOT touch decommission_date (operational retirement is separate from the date)', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_unit/i, { rows: [baseRow({ status: 'decommissioned' })], rowCount: 1 }],
    ]);
    await updateStatus(
      { orgId: 'org-1', id: 'tiu-1', status: 'decommissioned' },
      { pool },
    );
    const [sql] = query.mock.calls[0];
    expect(sql).not.toMatch(/decommission_date/);
    expect(sql).not.toMatch(/activation_date/);
  });
});

describe('softDeleteTransientInventoryUnit', () => {
  it('sets deleted_at, updated_at, updated_by; returns true; does NOT touch status', async () => {
    const { pool, query } = makeDispatcher([
      [/UPDATE transient_inventory_unit/i, { rows: [], rowCount: 1 }],
    ]);
    const result = await softDeleteTransientInventoryUnit(
      { orgId: 'org-1', id: 'tiu-1', updatedBy: 'user-1' },
      { pool },
    );
    expect(result).toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SET deleted_at = now\(\)/);
    expect(sql).toMatch(/updated_at = now\(\)/);
    expect(sql).toMatch(/updated_by = \$3/);
    expect(sql).not.toMatch(/status = /);                // status untouched
    expect(sql).not.toMatch(/decommission_date = /);
    expect(params).toEqual(['tiu-1', 'org-1', 'user-1']);
  });

  it('cross-org blocked and idempotent — rowCount 0 returns false', async () => {
    const { pool } = makeDispatcher([
      [/UPDATE transient_inventory_unit/i, { rows: [], rowCount: 0 }],
    ]);
    const attacker = await softDeleteTransientInventoryUnit(
      { orgId: 'attacker-org', id: 'tiu-1' },
      { pool },
    );
    expect(attacker).toBe(false);

    const idempotent = await softDeleteTransientInventoryUnit(
      { orgId: 'org-1', id: 'tiu-already-deleted' },
      { pool },
    );
    expect(idempotent).toBe(false);
  });
});
