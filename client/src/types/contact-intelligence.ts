/**
 * MarinaMatch CRM - Relationship Intelligence Routes
 * 
 * Add to server/routes/contact-intelligence.ts
 * Then import and use in your main routes file
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getContactMetrics,
  getLeaderboard,
  updateContactRelationship,
  linkContactToDeal,
  getContactsForDeal,
  removeContactFromDeal,
  createFinancialEvent,
  getFinancialEventsForDeal,
  getFinancialEventsForContact,
  type MetricsTimeframe,
  type LeaderboardSortField,
} from '../services/contactMetrics';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const contactRoles = ['seller', 'attorney', 'lender', 'title_insurance', 'inspector', 'surveyor', 'environmental', 'appraiser', 'broker', 'insurance_agent', 'other'] as const;
const relationshipStatuses = ['preferred', 'approved', 'neutral', 'do_not_track', 'hidden'] as const;
const visibilityScopes = ['private', 'team', 'public'] as const;
const dealSides = ['buy', 'sell', 'refi', 'raise_equity', 'other'] as const;
const financialEventTypes = ['fee', 'commission', 'lender_fee', 'legal', 'accounting', 'insurance', 'title', 'other'] as const;
const financialEventDirections = ['paid', 'received', 'waived', 'credited', 'burned_off'] as const;

const updateRelationshipSchema = z.object({
  primaryRole: z.enum(contactRoles).optional().nullable(),
  roleTags: z.array(z.string()).optional().nullable(),
  relationshipStatus: z.enum(relationshipStatuses).optional(),
  includeInMetrics: z.boolean().optional(),
  isPublicShowcase: z.boolean().optional(),
  publicProfileSlug: z.string().max(100).optional().nullable(),
  headline: z.string().max(500).optional().nullable(),
  specialties: z.array(z.string()).optional().nullable(),
  serviceRegions: z.array(z.string()).optional().nullable(),
  visibilityScope: z.enum(visibilityScopes).optional(),
  badgeOverrides: z.record(z.boolean()).optional().nullable(),
});

const linkContactSchema = z.object({
  contactId: z.string(),
  roleOnDeal: z.enum(contactRoles).optional().nullable(),
  dealSide: z.enum(dealSides).optional().nullable(),
  isPrimaryForDeal: z.boolean().optional(),
  volumeAttributionMode: z.enum(['all_linked', 'primary_only']).optional(),
  feeCreditingMode: z.enum(['contact', 'company', 'split']).optional(),
  splitPctContact: z.number().min(0).max(100).optional().nullable(),
});

const financialEventSchema = z.object({
  eventType: z.enum(financialEventTypes),
  amount: z.number().positive(),
  direction: z.enum(financialEventDirections),
  appliesToContactId: z.string().optional().nullable(),
  appliesToCompanyId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ============================================================================
// MIDDLEWARE - Get orgId from request
// ============================================================================

function getOrgId(req: Request): string {
  // Adjust based on your auth middleware
  const orgId = (req as any).user?.orgId || (req as any).orgId;
  if (!orgId) throw new Error('Unauthorized - no orgId');
  return orgId;
}

// ============================================================================
// METRICS ROUTES
// ============================================================================

/**
 * GET /api/contacts/:id/metrics
 */
router.get('/contacts/:id/metrics', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const timeframe = (req.query.timeframe as MetricsTimeframe) || 'all';

    const metrics = await getContactMetrics(orgId, id, timeframe);
    res.json(metrics);
  } catch (error: any) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/contacts/leaderboard
 */
router.get('/contacts/leaderboard', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const {
      role,
      status,
      timeframe = 'all',
      minDeals,
      minVolume,
      minFeesWaived,
      regions,
      search,
      sort = 'score',
      sortDirection = 'desc',
      page = '1',
      pageSize = '20',
    } = req.query;

    const statusArray = status
      ? (status as string).split(',')
      : ['preferred', 'approved', 'neutral'];
    const regionsArray = regions ? (regions as string).split(',') : undefined;

    const result = await getLeaderboard(
      orgId,
      {
        role: role as string,
        relationshipStatus: statusArray,
        timeframe: timeframe as MetricsTimeframe,
        minDeals: minDeals ? parseInt(minDeals as string) : undefined,
        minVolume: minVolume ? parseFloat(minVolume as string) : undefined,
        minFeesWaived: minFeesWaived ? parseFloat(minFeesWaived as string) : undefined,
        regions: regionsArray,
        search: search as string,
      },
      sort as LeaderboardSortField,
      sortDirection as 'asc' | 'desc',
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch leaderboard' });
  }
});

// ============================================================================
// RELATIONSHIP MANAGEMENT ROUTES
// ============================================================================

/**
 * PATCH /api/contacts/:id/relationship
 */
router.patch('/contacts/:id/relationship', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const validation = updateRelationshipSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.flatten() });
    }

    const updated = await updateContactRelationship(orgId, id, validation.data as any);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating relationship:', error);
    res.status(500).json({ error: error.message || 'Failed to update relationship' });
  }
});

// ============================================================================
// DEAL CONTACT LINKAGE ROUTES
// ============================================================================

/**
 * GET /api/deals/:dealId/contacts
 */
router.get('/deals/:dealId/contacts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { dealId } = req.params;

    const contacts = await getContactsForDeal(orgId, dealId);
    res.json(contacts);
  } catch (error: any) {
    console.error('Error fetching deal contacts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch deal contacts' });
  }
});

/**
 * POST /api/deals/:dealId/contacts
 */
router.post('/deals/:dealId/contacts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { dealId } = req.params;

    const validation = linkContactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.flatten() });
    }

    const link = await linkContactToDeal(orgId, {
      ...validation.data,
      dealId,
    } as any);

    res.status(201).json(link);
  } catch (error: any) {
    console.error('Error linking contact:', error);
    res.status(500).json({ error: error.message || 'Failed to link contact' });
  }
});

/**
 * DELETE /api/deals/:dealId/contacts/:contactId
 */
router.delete('/deals/:dealId/contacts/:contactId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { dealId, contactId } = req.params;

    await removeContactFromDeal(orgId, dealId, contactId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing contact:', error);
    res.status(500).json({ error: error.message || 'Failed to remove contact' });
  }
});

// ============================================================================
// FINANCIAL EVENTS ROUTES
// ============================================================================

/**
 * GET /api/deals/:dealId/financial-events
 */
router.get('/deals/:dealId/financial-events', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { dealId } = req.params;

    const events = await getFinancialEventsForDeal(orgId, dealId);
    res.json(events);
  } catch (error: any) {
    console.error('Error fetching financial events:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch financial events' });
  }
});

/**
 * POST /api/deals/:dealId/financial-events
 */
router.post('/deals/:dealId/financial-events', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { dealId } = req.params;

    const validation = financialEventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.flatten() });
    }

    const event = await createFinancialEvent(orgId, {
      ...validation.data,
      dealId,
    } as any);

    res.status(201).json(event);
  } catch (error: any) {
    console.error('Error creating financial event:', error);
    res.status(500).json({ error: error.message || 'Failed to create financial event' });
  }
});

/**
 * GET /api/contacts/:id/financial-events
 */
router.get('/contacts/:id/financial-events', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const events = await getFinancialEventsForContact(orgId, id);
    res.json(events);
  } catch (error: any) {
    console.error('Error fetching contact financial events:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch financial events' });
  }
});

export default router;
