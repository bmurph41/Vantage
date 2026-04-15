import { Router, Response } from 'express';
import { pool } from '../db';
import { encrypt, decrypt } from '../integrations/crypto';
import { AuthenticatedRequest, getValidatedOrgId, requireStrictOrg } from '../middleware/org-guard';

const router = Router();

// All routes require a valid org context — returns 401 if missing
router.use(requireStrictOrg());

// Ensure organization_settings table exists
async function ensureOrgSettingsTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organization_settings (
        id SERIAL PRIMARY KEY,
        org_id TEXT NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (org_id, setting_key)
      )
    `);
  } catch (err) {
    console.error('Failed to create organization_settings table:', err);
  }
}

ensureOrgSettingsTable();

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function getGoogleApiKey(orgId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT setting_value FROM organization_settings
     WHERE org_id = $1 AND setting_key = 'google_api_key'
     LIMIT 1`,
    [orgId]
  );
  if (result.rows.length === 0) return null;

  const raw = result.rows[0].setting_value;
  if (!raw) return null;

  // Always decrypt — stored value is always AES-256-GCM encrypted.
  // If decryption fails (e.g., key rotation), return null to block the proxy
  // rather than leaking ciphertext to Google.
  try {
    return decrypt(raw);
  } catch (err) {
    console.error('[Google Places] Failed to decrypt API key — refusing proxy request:', err);
    return null;
  }
}

function getOrgId(req: AuthenticatedRequest): string {
  return getValidatedOrgId(req);
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS — Save/load encrypted API key
// ═══════════════════════════════════════════════════════════════

// GET /api/google-places/settings — check if key is configured
router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const key = await getGoogleApiKey(orgId);
    res.json({
      configured: !!key,
      maskedKey: key ? `****${key.slice(-4)}` : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

// POST /api/google-places/settings — save encrypted API key
router.post('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { apiKey } = req.body as { apiKey?: unknown };

    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
      return res.status(400).json({ error: 'Valid API key is required' });
    }

    const encryptedKey = encrypt(apiKey);

    // Upsert into organization_settings
    await pool.query(
      `INSERT INTO organization_settings (org_id, setting_key, setting_value, updated_at)
       VALUES ($1, 'google_api_key', $2, NOW())
       ON CONFLICT (org_id, setting_key)
       DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [orgId, encryptedKey]
    );

    res.json({ success: true, maskedKey: `****${apiKey.slice(-4)}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/google-places/settings — remove API key
router.delete('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    await pool.query(
      `DELETE FROM organization_settings
       WHERE org_id = $1 AND setting_key = 'google_api_key'`,
      [orgId]
    );
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTOCOMPLETE — search-as-you-type
// ═══════════════════════════════════════════════════════════════

router.get('/autocomplete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const apiKey = await getGoogleApiKey(orgId);
    if (!apiKey) {
      return res.status(503).json({ error: 'Google API key not configured. Add it in Settings.' });
    }

    const { input, types = 'establishment' } = req.query;
    if (!input || typeof input !== 'string' || input.length < 2) {
      return res.json({ predictions: [] });
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=${encodeURIComponent(types as string)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json() as { status: string; error_message?: string; predictions?: Array<{ place_id: string; description: string; structured_formatting?: { main_text?: string; secondary_text?: string } }> };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places autocomplete error:', data.status, data.error_message);
      return res.status(502).json({ error: data.error_message || `Google API error: ${data.status}` });
    }

    const predictions = (data.predictions || []).map((p) => ({
      place_id: p.place_id,
      description: p.description,
      structured: {
        main_text: p.structured_formatting?.main_text,
        secondary_text: p.structured_formatting?.secondary_text,
      },
    }));

    res.json({ predictions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Google Places autocomplete error:', err);
    res.status(500).json({ error: message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DETAILS — full place info
// ═══════════════════════════════════════════════════════════════

interface GooglePlaceDetailsResult {
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  geometry?: { location?: { lat?: number; lng?: number } };
  photos?: Array<{ photo_reference: string }>;
  opening_hours?: { weekday_text?: string[] };
  types?: string[];
  place_id?: string;
  url?: string;
}

router.get('/details/:placeId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const apiKey = await getGoogleApiKey(orgId);
    if (!apiKey) {
      return res.status(503).json({ error: 'Google API key not configured' });
    }

    const { placeId } = req.params;
    const fields = 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,price_level,geometry,photos,opening_hours,types,place_id,url';

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json() as { status: string; error_message?: string; result?: GooglePlaceDetailsResult };

    if (data.status !== 'OK') {
      return res.status(502).json({ error: data.error_message || `Google API error: ${data.status}` });
    }

    const r = data.result ?? {};
    const priceLevels: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

    // Build photo URLs (up to 3)
    const photoUrls = (r.photos || []).slice(0, 3).map((photo) =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${apiKey}`
    );

    res.json({
      name: r.name,
      address: r.formatted_address,
      phone: r.formatted_phone_number || null,
      website: r.website || null,
      rating: r.rating || null,
      reviews_count: r.user_ratings_total || 0,
      price_level: r.price_level != null ? priceLevels[r.price_level] || null : null,
      latitude: r.geometry?.location?.lat || null,
      longitude: r.geometry?.location?.lng || null,
      google_place_id: r.place_id,
      google_url: r.url || null,
      types: r.types || [],
      hours: r.opening_hours?.weekday_text?.join('; ') || null,
      photo_urls: photoUrls,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Google Places details error:', err);
    res.status(500).json({ error: message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GEOCODE — address to lat/lng
// ═══════════════════════════════════════════════════════════════

router.post('/geocode', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const apiKey = await getGoogleApiKey(orgId);
    if (!apiKey) {
      return res.status(503).json({ error: 'Google API key not configured' });
    }

    const { address } = req.body as { address?: unknown };
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'address is required' });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json() as {
      status: string;
      error_message?: string;
      results?: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string; place_id: string }>;
    };

    if (data.status !== 'OK') {
      return res.status(502).json({ error: data.error_message || `Google API error: ${data.status}` });
    }

    const result = data.results?.[0];
    if (!result) {
      return res.status(502).json({ error: 'No geocode results found' });
    }
    res.json({
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Google geocode error:', err);
    res.status(500).json({ error: message });
  }
});

export const googlePlacesRouter = router;
