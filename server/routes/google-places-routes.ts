import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { encrypt, decrypt } from '../integrations/crypto';

const router = Router();

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

  // Decrypt if encrypted (format: iv:authTag:ciphertext)
  if (raw.includes(':') && raw.split(':').length === 3) {
    try {
      return decrypt(raw);
    } catch {
      return raw; // fall back to raw value if decryption fails
    }
  }
  return raw;
}

function getOrgId(req: Request): string {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || '';
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS — Save/load encrypted API key
// ═══════════════════════════════════════════════════════════════

// GET /api/google-places/settings — check if key is configured
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const key = await getGoogleApiKey(orgId);
    res.json({
      configured: !!key,
      maskedKey: key ? `****${key.slice(-4)}` : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/google-places/settings — save encrypted API key
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { apiKey } = req.body;

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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/google-places/settings — remove API key
router.delete('/settings', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    await pool.query(
      `DELETE FROM organization_settings
       WHERE org_id = $1 AND setting_key = 'google_api_key'`,
      [orgId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTOCOMPLETE — search-as-you-type
// ═══════════════════════════════════════════════════════════════

router.get('/autocomplete', async (req: Request, res: Response) => {
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
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places autocomplete error:', data.status, data.error_message);
      return res.status(502).json({ error: data.error_message || `Google API error: ${data.status}` });
    }

    const predictions = (data.predictions || []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description,
      structured: {
        main_text: p.structured_formatting?.main_text,
        secondary_text: p.structured_formatting?.secondary_text,
      },
    }));

    res.json({ predictions });
  } catch (err: any) {
    console.error('Google Places autocomplete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DETAILS — full place info
// ═══════════════════════════════════════════════════════════════

router.get('/details/:placeId', async (req: Request, res: Response) => {
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
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(502).json({ error: data.error_message || `Google API error: ${data.status}` });
    }

    const r = data.result;
    const priceLevels: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

    // Build photo URLs (up to 3)
    const photoUrls = (r.photos || []).slice(0, 3).map((photo: any) =>
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
  } catch (err: any) {
    console.error('Google Places details error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GEOCODE — address to lat/lng
// ═══════════════════════════════════════════════════════════════

router.post('/geocode', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const apiKey = await getGoogleApiKey(orgId);
    if (!apiKey) {
      return res.status(503).json({ error: 'Google API key not configured' });
    }

    const { address } = req.body;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'address is required' });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(502).json({ error: data.error_message || `Google API error: ${data.status}` });
    }

    const result = data.results[0];
    res.json({
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id,
    });
  } catch (err: any) {
    console.error('Google geocode error:', err);
    res.status(500).json({ error: err.message });
  }
});

export const googlePlacesRouter = router;
