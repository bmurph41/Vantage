import { Router } from 'express';
import {
  createWaitlist,
  getWaitlistsForProperty,
  getWaitlistById,
  addWaitlistEntry,
  getWaitlistEntries,
  sendOffer,
  acceptOffer,
  declineOffer,
  expireOffer,
  getOffersForEntry,
  getWaitlistMetrics,
} from './waitlist-service';

export function createWaitlistRouter(): Router {
  const router = Router();

  router.get('/ping', (_req, res) => {
    res.json({ ok: true, module: 'waitlist', version: '1.0.0' });
  });

  router.post('/', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const { propertyId, unitType, bandKey, name, constraints, maxEntries } = req.body;
      if (!propertyId || !unitType || !name) {
        return res.status(400).json({ error: 'propertyId, unitType, and name are required' });
      }

      const wl = await createWaitlist({ orgId, propertyId, unitType, bandKey, name, constraints, maxEntries });
      res.status(201).json(wl);
    } catch (error: any) {
      console.error('[Waitlist] Error creating waitlist:', error);
      res.status(500).json({ error: 'Failed to create waitlist' });
    }
  });

  router.get('/property/:propertyId', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const { propertyId } = req.params;
      const unitType = req.query.unitType as string | undefined;
      const bandKey = req.query.bandKey as string | undefined;

      const wls = await getWaitlistsForProperty(orgId, propertyId, unitType, bandKey);
      res.json(wls);
    } catch (error: any) {
      console.error('[Waitlist] Error fetching waitlists:', error);
      res.status(500).json({ error: 'Failed to fetch waitlists' });
    }
  });

  router.get('/metrics/:propertyId', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const { propertyId } = req.params;
      const metrics = await getWaitlistMetrics(orgId, propertyId);
      res.json(metrics);
    } catch (error: any) {
      console.error('[Waitlist] Error fetching metrics:', error);
      res.status(500).json({ error: 'Failed to fetch waitlist metrics' });
    }
  });

  router.get('/:waitlistId', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const wl = await getWaitlistById(req.params.waitlistId, orgId);
      if (!wl) return res.status(404).json({ error: 'Waitlist not found' });
      res.json(wl);
    } catch (error: any) {
      console.error('[Waitlist] Error fetching waitlist:', error);
      res.status(500).json({ error: 'Failed to fetch waitlist' });
    }
  });

  router.get('/:waitlistId/entries', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const entries = await getWaitlistEntries(req.params.waitlistId, orgId);
      res.json(entries);
    } catch (error: any) {
      console.error('[Waitlist] Error fetching entries:', error);
      res.status(500).json({ error: 'Failed to fetch waitlist entries' });
    }
  });

  router.post('/:waitlistId/entries', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const { contactName, contactEmail, contactPhone, contactId, boatLengthFt, boatBeamFt, boatDraftFt, boatName, preferredBandKey, notes, priority } = req.body;
      if (!contactName) {
        return res.status(400).json({ error: 'contactName is required' });
      }

      const entry = await addWaitlistEntry({
        waitlistId: req.params.waitlistId,
        orgId,
        contactName,
        contactEmail,
        contactPhone,
        contactId,
        boatLengthFt,
        boatBeamFt,
        boatDraftFt,
        boatName,
        preferredBandKey,
        notes,
        priority,
      });
      res.status(201).json(entry);
    } catch (error: any) {
      console.error('[Waitlist] Error adding entry:', error);
      res.status(500).json({ error: 'Failed to add waitlist entry' });
    }
  });

  router.post('/:waitlistId/entries/:entryId/offer', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const { unitId, unitCode, expiresAt, notes } = req.body;
      if (!unitId) return res.status(400).json({ error: 'unitId is required' });

      const offer = await sendOffer({
        entryId: req.params.entryId,
        waitlistId: req.params.waitlistId,
        orgId,
        unitId,
        unitCode,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes,
      });
      res.status(201).json(offer);
    } catch (error: any) {
      console.error('[Waitlist] Error sending offer:', error);
      res.status(500).json({ error: 'Failed to send offer' });
    }
  });

  router.get('/:waitlistId/entries/:entryId/offers', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const offers = await getOffersForEntry(req.params.entryId, orgId);
      res.json(offers);
    } catch (error: any) {
      console.error('[Waitlist] Error fetching offers:', error);
      res.status(500).json({ error: 'Failed to fetch offers' });
    }
  });

  router.post('/offers/:offerId/accept', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const result = await acceptOffer(req.params.offerId, orgId);
      res.json(result);
    } catch (error: any) {
      console.error('[Waitlist] Error accepting offer:', error);
      res.status(500).json({ error: 'Failed to accept offer' });
    }
  });

  router.post('/offers/:offerId/decline', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const result = await declineOffer(req.params.offerId, orgId);
      res.json(result);
    } catch (error: any) {
      console.error('[Waitlist] Error declining offer:', error);
      res.status(500).json({ error: 'Failed to decline offer' });
    }
  });

  router.post('/offers/:offerId/expire', async (req: any, res) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Organization context required' });

      const result = await expireOffer(req.params.offerId, orgId);
      res.json(result);
    } catch (error: any) {
      console.error('[Waitlist] Error expiring offer:', error);
      res.status(500).json({ error: 'Failed to expire offer' });
    }
  });

  return router;
}
