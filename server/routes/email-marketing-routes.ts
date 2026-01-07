import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  emailMarketingConnections, 
  emailMarketingLeads
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

const CONSTANT_CONTACT_CLIENT_ID = process.env.CONSTANT_CONTACT_CLIENT_ID;
const CONSTANT_CONTACT_CLIENT_SECRET = process.env.CONSTANT_CONTACT_CLIENT_SECRET;
const CONSTANT_CONTACT_REDIRECT_URI = process.env.CONSTANT_CONTACT_REDIRECT_URI || 'https://marinamatch.replit.app/api/email-marketing/constant-contact/callback';
const CONSTANT_CONTACT_AUTH_BASE = 'https://authz.constantcontact.com/oauth2/default/v1';
const CONSTANT_CONTACT_API_BASE = 'https://api.cc.email/v3';

const TOKEN_ENCRYPTION_KEY = process.env.EMAIL_MARKETING_ENCRYPTION_KEY || process.env.JWT_SECRET;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  if (!TOKEN_ENCRYPTION_KEY || TOKEN_ENCRYPTION_KEY.length < 16) {
    throw new Error('EMAIL_MARKETING_ENCRYPTION_KEY or JWT_SECRET must be set (min 16 chars) for token encryption');
  }
  return crypto.scryptSync(TOKEN_ENCRYPTION_KEY, 'email-marketing-salt', 32);
}

function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decryptToken(encryptedData: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Token decryption failed:', error);
    return null;
  }
}

const oauthStateStore = new Map<string, { userId: string; orgId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthStateStore.entries()) {
    if (value.expiresAt < now) {
      oauthStateStore.delete(key);
    }
  }
}, 60000);

function createSecureState(userId: string, orgId: string): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000;
  oauthStateStore.set(nonce, { userId, orgId, expiresAt });
  return nonce;
}

function validateAndConsumeState(nonce: string): { userId: string; orgId: string } | null {
  const stateData = oauthStateStore.get(nonce);
  if (!stateData) return null;
  if (stateData.expiresAt < Date.now()) {
    oauthStateStore.delete(nonce);
    return null;
  }
  oauthStateStore.delete(nonce);
  return { userId: stateData.userId, orgId: stateData.orgId };
}

interface AuthenticatedRequest extends Request {
  user?: { id: string };
  tenantId?: string;
}

router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'org-1';
    const userId = req.user?.id || 'user-1';

    const connections = await db.select()
      .from(emailMarketingConnections)
      .where(and(
        eq(emailMarketingConnections.orgId, orgId),
        eq(emailMarketingConnections.isActive, true)
      ));

    const leads = await db.select()
      .from(emailMarketingLeads)
      .where(eq(emailMarketingLeads.orgId, orgId));

    const ccConnection = connections.find(c => c.providerSlug === 'constant_contact');

    res.json({
      hasMarketingModule: true,
      connectedProviders: connections.length,
      totalLeads: leads.length,
      constantContact: {
        connected: !!ccConnection,
        accountLabel: ccConnection?.accountLabel,
        expiresAt: ccConnection?.expiresAt,
        lastSyncAt: ccConnection?.lastSyncAt
      }
    });
  } catch (error) {
    console.error('Failed to fetch email marketing status:', error);
    res.status(500).json({ error: 'Failed to fetch email marketing status' });
  }
});

router.get('/providers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'org-1';
    const userId = req.user?.id || 'user-1';

    const connections = await db.select()
      .from(emailMarketingConnections)
      .where(and(
        eq(emailMarketingConnections.orgId, orgId),
        eq(emailMarketingConnections.userId, userId)
      ));

    const providers = [
      {
        slug: 'constant_contact',
        displayName: 'Constant Contact',
        description: 'Professional email marketing and automation',
        connected: connections.some(c => c.providerSlug === 'constant_contact' && c.isActive),
        connection: connections.find(c => c.providerSlug === 'constant_contact'),
        configured: !!(CONSTANT_CONTACT_CLIENT_ID && CONSTANT_CONTACT_CLIENT_SECRET)
      },
      {
        slug: 'mailchimp',
        displayName: 'Mailchimp',
        description: 'All-in-one marketing platform',
        connected: connections.some(c => c.providerSlug === 'mailchimp' && c.isActive),
        connection: connections.find(c => c.providerSlug === 'mailchimp'),
        configured: false,
        comingSoon: true
      }
    ];

    res.json(providers);
  } catch (error) {
    console.error('Failed to fetch email marketing providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

router.get('/constant-contact/auth', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'user-1';
    const orgId = req.tenantId || 'org-1';
    
    if (!CONSTANT_CONTACT_CLIENT_ID) {
      return res.status(400).json({ 
        error: 'CONSTANT_CONTACT_NOT_CONFIGURED',
        message: 'Constant Contact integration is not configured. Please add API credentials.'
      });
    }

    const state = createSecureState(userId, orgId);

    const authUrl = new URL(`${CONSTANT_CONTACT_AUTH_BASE}/authorize`);
    authUrl.searchParams.set('client_id', CONSTANT_CONTACT_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', CONSTANT_CONTACT_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'contact_data campaign_data');
    authUrl.searchParams.set('state', state);

    res.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('Failed to generate Constant Contact auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

router.get('/constant-contact/callback', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect('/operations/marketing?tab=email-campaigns&error=oauth_denied');
    }

    if (!code || !state || typeof state !== 'string') {
      return res.redirect('/operations/marketing?tab=email-campaigns&error=invalid_callback');
    }

    const stateData = validateAndConsumeState(state);
    if (!stateData) {
      console.error('Invalid or expired OAuth state');
      return res.redirect('/operations/marketing?tab=email-campaigns&error=invalid_state');
    }

    const { userId, orgId } = stateData;

    if (!CONSTANT_CONTACT_CLIENT_ID || !CONSTANT_CONTACT_CLIENT_SECRET) {
      return res.redirect('/operations/marketing?tab=email-campaigns&error=not_configured');
    }

    const tokenResponse = await fetch(`${CONSTANT_CONTACT_AUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${CONSTANT_CONTACT_CLIENT_ID}:${CONSTANT_CONTACT_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: CONSTANT_CONTACT_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.redirect('/operations/marketing?tab=email-campaigns&error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    let accountLabel = 'Constant Contact Account';
    try {
      const accountResponse = await fetch(`${CONSTANT_CONTACT_API_BASE}/account/summary`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      if (accountResponse.ok) {
        const accountData = await accountResponse.json() as { organization_name?: string; email?: string };
        accountLabel = accountData.organization_name || accountData.email || 'Constant Contact Account';
      }
    } catch (e) {
      console.warn('Could not fetch account info:', e);
    }

    const existingConnection = await db.select()
      .from(emailMarketingConnections)
      .where(and(
        eq(emailMarketingConnections.userId, userId),
        eq(emailMarketingConnections.orgId, orgId),
        eq(emailMarketingConnections.providerSlug, 'constant_contact')
      ))
      .limit(1);

    if (existingConnection.length > 0) {
      await db.update(emailMarketingConnections)
        .set({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          accountLabel,
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(emailMarketingConnections.id, existingConnection[0].id));
    } else {
      await db.insert(emailMarketingConnections).values({
        orgId,
        userId,
        providerSlug: 'constant_contact',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        accountLabel,
        isActive: true,
        scopes: 'contact_data campaign_data'
      });
    }

    res.redirect('/operations/marketing?tab=email-campaigns&connected=constant_contact');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/operations/marketing?tab=email-campaigns&error=callback_failed');
  }
});

router.get('/constant-contact/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'org-1';
    const userId = req.user?.id || 'user-1';

    const connection = await db.select()
      .from(emailMarketingConnections)
      .where(and(
        eq(emailMarketingConnections.userId, userId),
        eq(emailMarketingConnections.orgId, orgId),
        eq(emailMarketingConnections.providerSlug, 'constant_contact'),
        eq(emailMarketingConnections.isActive, true)
      ))
      .limit(1);

    if (!connection.length) {
      return res.json({ connected: false });
    }

    const conn = connection[0];
    res.json({
      connected: true,
      accountLabel: conn.accountLabel,
      expiresAt: conn.expiresAt,
      lastSyncAt: conn.lastSyncAt,
      needsRefresh: conn.expiresAt && new Date(conn.expiresAt) < new Date(Date.now() + 5 * 60 * 1000)
    });
  } catch (error) {
    console.error('Failed to fetch CC status:', error);
    res.status(500).json({ error: 'Failed to fetch connection status' });
  }
});

router.post('/constant-contact/disconnect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'user-1';
    const orgId = req.tenantId || 'org-1';

    await db.update(emailMarketingConnections)
      .set({ 
        isActive: false, 
        accessToken: null,
        refreshToken: null,
        updatedAt: new Date() 
      })
      .where(and(
        eq(emailMarketingConnections.userId, userId),
        eq(emailMarketingConnections.orgId, orgId),
        eq(emailMarketingConnections.providerSlug, 'constant_contact')
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to disconnect Constant Contact:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

async function getValidAccessToken(userId: string, orgId: string): Promise<string | null> {
  const connection = await db.select()
    .from(emailMarketingConnections)
    .where(and(
      eq(emailMarketingConnections.userId, userId),
      eq(emailMarketingConnections.orgId, orgId),
      eq(emailMarketingConnections.providerSlug, 'constant_contact'),
      eq(emailMarketingConnections.isActive, true)
    ))
    .limit(1);

  if (!connection.length || !connection[0].accessToken) return null;

  const conn = connection[0];
  const accessToken = decryptToken(conn.accessToken);
  if (!accessToken) {
    console.error('Failed to decrypt access token');
    await deactivateConnection(conn.id, 'Token decryption failed');
    return null;
  }

  if (conn.expiresAt && new Date(conn.expiresAt) < new Date()) {
    if (!conn.refreshToken || !CONSTANT_CONTACT_CLIENT_ID || !CONSTANT_CONTACT_CLIENT_SECRET) {
      await deactivateConnection(conn.id, 'Token expired, no refresh token available');
      return null;
    }

    const refreshToken = decryptToken(conn.refreshToken);
    if (!refreshToken) {
      await deactivateConnection(conn.id, 'Refresh token decryption failed');
      return null;
    }

    try {
      const tokenResponse = await fetch(`${CONSTANT_CONTACT_AUTH_BASE}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${CONSTANT_CONTACT_CLIENT_ID}:${CONSTANT_CONTACT_CLIENT_SECRET}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token refresh failed:', errorText);
        await deactivateConnection(conn.id, 'Token refresh failed');
        return null;
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      const newEncryptedAccessToken = encryptToken(tokens.access_token);
      const newEncryptedRefreshToken = tokens.refresh_token 
        ? encryptToken(tokens.refresh_token) 
        : conn.refreshToken;
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      await db.update(emailMarketingConnections)
        .set({
          accessToken: newEncryptedAccessToken,
          refreshToken: newEncryptedRefreshToken,
          expiresAt,
          updatedAt: new Date()
        })
        .where(eq(emailMarketingConnections.id, conn.id));

      return tokens.access_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      await deactivateConnection(conn.id, 'Token refresh network error');
      return null;
    }
  }

  return accessToken;
}

async function deactivateConnection(connectionId: string, reason: string): Promise<void> {
  console.warn(`Deactivating email marketing connection ${connectionId}: ${reason}`);
  await db.update(emailMarketingConnections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(emailMarketingConnections.id, connectionId));
}

router.get('/constant-contact/lists', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'org-1';
    const userId = req.user?.id || 'user-1';

    const accessToken = await getValidAccessToken(userId, orgId);
    if (!accessToken) {
      return res.status(401).json({ error: 'Not connected to Constant Contact', reconnectRequired: true });
    }

    const listsResponse = await fetch(`${CONSTANT_CONTACT_API_BASE}/contact_lists`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!listsResponse.ok) {
      if (listsResponse.status === 401) {
        return res.status(401).json({ error: 'Authorization expired', reconnectRequired: true });
      }
      throw new Error('Failed to fetch lists from Constant Contact');
    }

    const data = await listsResponse.json() as { lists: Array<{ list_id: string; name: string; membership_count: number }> };

    const lists = (data.lists || []).map((list: any) => ({
      id: list.list_id,
      name: list.name,
      contactCount: list.membership_count || 0
    }));

    res.json(lists);
  } catch (error) {
    console.error('Failed to fetch CC lists:', error);
    res.status(500).json({ error: 'Failed to fetch contact lists' });
  }
});

const subscribeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  listIds: z.array(z.string()).min(1)
});

router.post('/constant-contact/subscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'org-1';
    const userId = req.user?.id || 'user-1';

    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { email, firstName, lastName, listIds } = parsed.data;

    const accessToken = await getValidAccessToken(userId, orgId);
    if (!accessToken) {
      return res.status(401).json({ error: 'Not connected to Constant Contact', reconnectRequired: true });
    }

    const contactPayload = {
      email_address: { address: email },
      first_name: firstName || '',
      last_name: lastName || '',
      list_memberships: listIds
    };

    const createResponse = await fetch(`${CONSTANT_CONTACT_API_BASE}/contacts/sign_up_form`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });

    let providerContactId: string | undefined;
    if (createResponse.ok) {
      const result = await createResponse.json() as { contact_id?: string };
      providerContactId = result.contact_id;
    } else if (createResponse.status !== 409) {
      const errorText = await createResponse.text();
      console.error('Failed to create contact in Constant Contact:', errorText);
    }

    const connection = await db.select()
      .from(emailMarketingConnections)
      .where(and(
        eq(emailMarketingConnections.userId, userId),
        eq(emailMarketingConnections.orgId, orgId),
        eq(emailMarketingConnections.providerSlug, 'constant_contact')
      ))
      .limit(1);

    const [lead] = await db.insert(emailMarketingLeads).values({
      orgId,
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      source: 'marketing_form',
      connectionId: connection[0]?.id,
      providerContactId,
      listIds,
      syncStatus: providerContactId ? 'synced' : 'pending',
      lastSyncAt: providerContactId ? new Date() : null
    }).returning();

    res.json({
      success: true,
      lead,
      syncedToProvider: !!providerContactId
    });
  } catch (error) {
    console.error('Failed to subscribe contact:', error);
    res.status(500).json({ error: 'Failed to subscribe contact' });
  }
});

router.get('/constant-contact/campaigns', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'org-1';
    const userId = req.user?.id || 'user-1';
    const limit = parseInt(req.query.limit as string) || 10;

    const accessToken = await getValidAccessToken(userId, orgId);
    if (!accessToken) {
      return res.status(401).json({ error: 'Not connected to Constant Contact', reconnectRequired: true });
    }

    const campaignsResponse = await fetch(
      `${CONSTANT_CONTACT_API_BASE}/emails?limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!campaignsResponse.ok) {
      if (campaignsResponse.status === 401) {
        return res.status(401).json({ error: 'Authorization expired', reconnectRequired: true });
      }
      throw new Error('Failed to fetch campaigns from Constant Contact');
    }

    const data = await campaignsResponse.json() as { 
      campaigns: Array<{
        campaign_id: string;
        name: string;
        current_status: string;
        subject?: string;
        send_date?: string;
        created_at: string;
      }> 
    };

    const campaigns = (data.campaigns || []).map((c: any) => ({
      id: c.campaign_id,
      name: c.name,
      status: c.current_status,
      subject: c.subject,
      sentAt: c.send_date,
      createdAt: c.created_at
    }));

    res.json(campaigns);
  } catch (error) {
    console.error('Failed to fetch CC campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

router.get('/leads', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.tenantId || 'org-1';

    const leads = await db.select()
      .from(emailMarketingLeads)
      .where(eq(emailMarketingLeads.orgId, orgId))
      .orderBy(desc(emailMarketingLeads.createdAt))
      .limit(100);

    res.json(leads);
  } catch (error) {
    console.error('Failed to fetch email marketing leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

export default router;
