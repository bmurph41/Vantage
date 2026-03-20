/**
 * CRM Advanced Search Routes
 * Dynamic filter builder that constructs SQL WHERE clauses from FilterRule arrays.
 * Supports contacts, companies, and properties entity types.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────

interface FilterRule {
  field: string;
  operator: string;
  value: string;
  conjunction: 'AND' | 'OR';
}

interface AdvancedSearchRequest {
  filters: FilterRule[];
  entityType: 'contact' | 'company' | 'property';
  limit?: number;
  offset?: number;
}

// ── Column Mappings (camelCase field -> snake_case column) ─────────────

const CONTACT_COLUMNS: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  phone: 'phone',
  company: 'company',
  city: 'city',
  state: 'state',
  contactTag: 'contact_tag',
  leadScore: 'lead_score',
  leadStatus: 'lead_status',
  position: 'position',
  role: 'role',
  contactType: 'contact_type',
  leadSource: 'lead_source',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const COMPANY_COLUMNS: Record<string, string> = {
  name: 'name',
  domain: 'domain',
  industry: 'industry',
  size: 'size',
  city: 'city',
  state: 'state',
  phone: 'phone',
  annualRevenue: 'annual_revenue',
  acquisitionInterest: 'acquisition_interest',
  isPortfolioCompany: 'is_portfolio_company',
  employeeCount: 'employee_count',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const PROPERTY_COLUMNS: Record<string, string> = {
  title: 'title',
  name: 'name',
  type: 'type',
  status: 'status',
  city: 'city',
  state: 'state',
  address: 'address',
  listingPrice: 'listing_price',
  annualRevenue: 'annual_revenue',
  wetSlips: 'wet_slips',
  drySlips: 'dry_slips',
  occupancyRate: 'occupancy_rate',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const ENTITY_CONFIG: Record<string, { table: string; columns: Record<string, string> }> = {
  contact: { table: 'crm_contacts', columns: CONTACT_COLUMNS },
  company: { table: 'crm_companies', columns: COMPANY_COLUMNS },
  property: { table: 'crm_properties', columns: PROPERTY_COLUMNS },
};

// ── SQL Builder ──────────────────────────────────────────────────────────

function buildWhereClause(
  filters: FilterRule[],
  columns: Record<string, string>,
  startParamIndex: number
): { clause: string; params: any[] } {
  if (!filters.length) return { clause: '', params: [] };

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = startParamIndex;

  for (let i = 0; i < filters.length; i++) {
    const rule = filters[i];
    const column = columns[rule.field];
    if (!column) continue; // skip unknown fields

    let condition = '';
    const needsValue = !['is_empty', 'is_not_empty'].includes(rule.operator);

    switch (rule.operator) {
      case 'equals':
        condition = `${column}::text = $${paramIdx}`;
        params.push(rule.value);
        paramIdx++;
        break;
      case 'not_equals':
        condition = `(${column}::text != $${paramIdx} OR ${column} IS NULL)`;
        params.push(rule.value);
        paramIdx++;
        break;
      case 'contains':
        condition = `${column}::text ILIKE $${paramIdx}`;
        params.push(`%${rule.value}%`);
        paramIdx++;
        break;
      case 'starts_with':
        condition = `${column}::text ILIKE $${paramIdx}`;
        params.push(`${rule.value}%`);
        paramIdx++;
        break;
      case 'greater_than':
        condition = `${column}::text > $${paramIdx}`;
        params.push(rule.value);
        paramIdx++;
        break;
      case 'less_than':
        condition = `${column}::text < $${paramIdx}`;
        params.push(rule.value);
        paramIdx++;
        break;
      case 'is_empty':
        condition = `(${column} IS NULL OR ${column}::text = '')`;
        break;
      case 'is_not_empty':
        condition = `(${column} IS NOT NULL AND ${column}::text != '')`;
        break;
      default:
        continue;
    }

    if (condition) {
      if (conditions.length > 0) {
        conditions.push(rule.conjunction === 'OR' ? 'OR' : 'AND');
      }
      conditions.push(condition);
    }
  }

  if (!conditions.length) return { clause: '', params: [] };

  return {
    clause: `AND (${conditions.join(' ')})`,
    params,
  };
}

// ── Route ────────────────────────────────────────────────────────────────

router.post('/advanced-search', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { filters = [], entityType = 'contact', limit = 50, offset = 0 } = req.body as AdvancedSearchRequest;

    const config = ENTITY_CONFIG[entityType];
    if (!config) {
      return res.status(400).json({ error: `Invalid entityType: ${entityType}. Must be contact, company, or property.` });
    }

    // Build dynamic WHERE clause
    const { clause: filterClause, params: filterParams } = buildWhereClause(
      filters,
      config.columns,
      2 // $1 is orgId
    );

    const safeLimit = Math.min(Math.max(1, limit), 200);
    const safeOffset = Math.max(0, offset);

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM ${config.table} WHERE org_id = $1 ${filterClause}`;
    const countResult = await pool.query(countSql, [orgId, ...filterParams]);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Data query
    const dataSql = `SELECT * FROM ${config.table} WHERE org_id = $1 ${filterClause} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const dataResult = await pool.query(dataSql, [orgId, ...filterParams]);

    res.json({
      results: dataResult.rows,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + safeLimit < total,
    });
  } catch (error: any) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

export default router;
