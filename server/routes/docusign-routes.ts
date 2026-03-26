/**
 * F.4 — DocuSign Deep Integration Routes
 *
 * Provides: template management, envelope sending, embedded signing,
 * webhook processing, bulk send, and status tracking.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  docusignEnvelopes,
  docusignTemplates,
  signatureRequests,
  userIntegrations,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export const docusignRouter = Router();

const DOCUSIGN_BASE_URL = "https://na1.docusign.net/restapi/v2.1";
const DOCUSIGN_DEMO_URL = "https://demo.docusign.net/restapi/v2.1";

// ── Helpers ──────────────────────────────────────────────────────────────

async function getDocuSignConfig(orgId: string) {
  const [integration] = await db
    .select()
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.organizationId, orgId),
        eq(userIntegrations.provider, "docusign"),
      ),
    );
  if (!integration) throw new Error("DocuSign not configured for this organization");

  const settings = (integration.settings || {}) as Record<string, any>;
  const environment = settings.environment || "production";
  const baseUrl = environment === "demo" ? DOCUSIGN_DEMO_URL : DOCUSIGN_BASE_URL;
  const accountId = settings.accountId;
  const accessToken = integration.accessToken;

  if (!accountId || !accessToken) {
    throw new Error("DocuSign credentials incomplete — configure account ID and access token");
  }

  return { baseUrl, accountId, accessToken, environment };
}

async function docuSignFetch(
  config: { baseUrl: string; accountId: string; accessToken: string },
  path: string,
  options: RequestInit = {},
) {
  const url = `${config.baseUrl}/accounts/${config.accountId}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`DocuSign API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

// ── Template Management ──────────────────────────────────────────────────

// GET /templates — list templates (synced from DocuSign + local metadata)
docusignRouter.get("/templates", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const templates = await db
      .select()
      .from(docusignTemplates)
      .where(and(eq(docusignTemplates.orgId, orgId), eq(docusignTemplates.isActive, true)))
      .orderBy(desc(docusignTemplates.createdAt));
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /templates/sync — pull templates from DocuSign and upsert locally
docusignRouter.post("/templates/sync", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const config = await getDocuSignConfig(orgId);

    const data = await docuSignFetch(config, "/templates?count=100");
    const remoteTemplates = data.envelopeTemplates || [];

    let synced = 0;
    for (const t of remoteTemplates) {
      const existing = await db
        .select()
        .from(docusignTemplates)
        .where(
          and(
            eq(docusignTemplates.orgId, orgId),
            eq(docusignTemplates.externalTemplateId, t.templateId),
          ),
        );

      const signerRoles = (t.recipients?.signers || []).map((s: any) => ({
        roleName: s.roleName || s.name,
        order: parseInt(s.routingOrder || "1", 10),
      }));

      if (existing.length > 0) {
        await db
          .update(docusignTemplates)
          .set({
            name: t.name,
            description: t.description,
            signerRoles,
            lastSyncedAt: new Date(),
          })
          .where(eq(docusignTemplates.id, existing[0].id));
      } else {
        await db.insert(docusignTemplates).values({
          orgId,
          externalTemplateId: t.templateId,
          name: t.name,
          description: t.description,
          category: inferTemplateCategory(t.name),
          signerRoles,
          lastSyncedAt: new Date(),
        });
      }
      synced++;
    }

    res.json({ synced, total: remoteTemplates.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /templates — create/register a template mapping
docusignRouter.post("/templates", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [template] = await db
      .insert(docusignTemplates)
      .values({ ...req.body, orgId })
      .returning();
    res.status(201).json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /templates/:id — update template metadata
docusignRouter.put("/templates/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { category, description, prefillFieldNames, isActive } = req.body;
    const [updated] = await db
      .update(docusignTemplates)
      .set({ category, description, prefillFieldNames, isActive })
      .where(and(eq(docusignTemplates.id, req.params.id), eq(docusignTemplates.orgId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Template not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Send Envelope from Template ──────────────────────────────────────────

// POST /envelopes/send — create and send an envelope from a template
docusignRouter.post("/envelopes/send", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { templateId, signers, prefillFields, subject, dealId } = req.body;

    if (!templateId || !signers?.length) {
      return res.status(400).json({ error: "templateId and signers[] are required" });
    }

    // Look up template
    const [template] = await db
      .select()
      .from(docusignTemplates)
      .where(
        and(eq(docusignTemplates.orgId, orgId), eq(docusignTemplates.externalTemplateId, templateId)),
      );

    const config = await getDocuSignConfig(orgId);

    // Build envelope definition
    const templateRoles = signers.map((s: any, i: number) => ({
      email: s.email,
      name: s.name,
      roleName: s.roleName || template?.signerRoles?.[i]?.roleName || `signer${i + 1}`,
      routingOrder: String(s.order || i + 1),
      tabs: prefillFields
        ? {
            textTabs: Object.entries(prefillFields).map(([tabLabel, value]) => ({
              tabLabel,
              value,
            })),
          }
        : undefined,
    }));

    const envelopeDefinition = {
      templateId,
      templateRoles,
      emailSubject: subject || `Signature requested: ${template?.name || "Document"}`,
      status: "sent",
    };

    const result = await docuSignFetch(config, "/envelopes", {
      method: "POST",
      body: JSON.stringify(envelopeDefinition),
    });

    // Store envelope record
    const [envelope] = await db
      .insert(docusignEnvelopes)
      .values({
        orgId,
        dealId: dealId || null,
        externalEnvelopeId: result.envelopeId,
        templateId,
        subject: envelopeDefinition.emailSubject,
        status: "sent",
        signers: signers.map((s: any) => ({ ...s, status: "sent" })),
        prefillFields,
        sentAt: new Date(),
        createdBy: userId,
      })
      .returning();

    // Also create a signatureRequest record for cross-reference
    await db.insert(signatureRequests).values({
      orgId,
      dealId: dealId || null,
      provider: "docusign",
      externalEnvelopeId: result.envelopeId,
      status: "sent",
      signers: signers.map((s: any) => ({ name: s.name, email: s.email, status: "sent" })),
      sentAt: new Date(),
    });

    res.status(201).json({
      envelopeId: result.envelopeId,
      status: result.status,
      localId: envelope.id,
      uri: result.uri,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Embedded Signing URL ─────────────────────────────────────────────────

// POST /envelopes/:envelopeId/signing-url — get embedded signing URL
docusignRouter.post("/envelopes/:envelopeId/signing-url", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { envelopeId } = req.params;
    const { signerEmail, signerName, returnUrl } = req.body;

    if (!signerEmail || !signerName) {
      return res.status(400).json({ error: "signerEmail and signerName are required" });
    }

    // Verify envelope belongs to org
    const [envelope] = await db
      .select()
      .from(docusignEnvelopes)
      .where(
        and(
          eq(docusignEnvelopes.externalEnvelopeId, envelopeId),
          eq(docusignEnvelopes.orgId, orgId),
        ),
      );
    if (!envelope) return res.status(404).json({ error: "Envelope not found" });

    const config = await getDocuSignConfig(orgId);

    const recipientView = await docuSignFetch(config, `/envelopes/${envelopeId}/views/recipient`, {
      method: "POST",
      body: JSON.stringify({
        email: signerEmail,
        userName: signerName,
        authenticationMethod: "none",
        returnUrl: returnUrl || `${process.env.APP_URL || ""}/signing-complete?envelopeId=${envelopeId}`,
        clientUserId: signerEmail, // for embedded signing
      }),
    });

    res.json({ signingUrl: recipientView.url, expiresIn: "5 minutes" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Envelope Status & Management ─────────────────────────────────────────

// GET /envelopes — list envelopes for org
docusignRouter.get("/envelopes", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId, status } = req.query;

    let query = db
      .select()
      .from(docusignEnvelopes)
      .where(eq(docusignEnvelopes.orgId, orgId))
      .orderBy(desc(docusignEnvelopes.createdAt));

    const conditions = [eq(docusignEnvelopes.orgId, orgId)];
    if (dealId) conditions.push(eq(docusignEnvelopes.dealId, dealId as string));
    if (status) conditions.push(eq(docusignEnvelopes.status, status as string));

    const results = await db
      .select()
      .from(docusignEnvelopes)
      .where(and(...conditions))
      .orderBy(desc(docusignEnvelopes.createdAt));

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /envelopes/:id — get envelope detail with signer statuses
docusignRouter.get("/envelopes/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [envelope] = await db
      .select()
      .from(docusignEnvelopes)
      .where(
        and(eq(docusignEnvelopes.id, req.params.id), eq(docusignEnvelopes.orgId, orgId)),
      );
    if (!envelope) return res.status(404).json({ error: "Envelope not found" });

    // Optionally refresh status from DocuSign
    if (req.query.refresh === "true") {
      try {
        const config = await getDocuSignConfig(orgId);
        const remote = await docuSignFetch(
          config,
          `/envelopes/${envelope.externalEnvelopeId}`,
        );
        const updatedSigners = remote.recipients?.signers?.map((s: any) => ({
          name: s.name,
          email: s.email,
          status: s.status,
          signedAt: s.signedDateTime,
          deliveredAt: s.deliveredDateTime,
        }));

        await db
          .update(docusignEnvelopes)
          .set({
            status: remote.status,
            signers: updatedSigners,
            completedAt: remote.completedDateTime ? new Date(remote.completedDateTime) : null,
          })
          .where(eq(docusignEnvelopes.id, envelope.id));

        return res.json({ ...envelope, status: remote.status, signers: updatedSigners });
      } catch {
        // Fall through to return cached data
      }
    }

    res.json(envelope);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /envelopes/:envelopeId/void — void/cancel an envelope
docusignRouter.post("/envelopes/:envelopeId/void", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { envelopeId } = req.params;
    const { reason } = req.body;

    const [envelope] = await db
      .select()
      .from(docusignEnvelopes)
      .where(
        and(
          eq(docusignEnvelopes.externalEnvelopeId, envelopeId),
          eq(docusignEnvelopes.orgId, orgId),
        ),
      );
    if (!envelope) return res.status(404).json({ error: "Envelope not found" });

    const config = await getDocuSignConfig(orgId);
    await docuSignFetch(config, `/envelopes/${envelopeId}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "voided",
        voidedReason: reason || "Voided by user",
      }),
    });

    const [updated] = await db
      .update(docusignEnvelopes)
      .set({ status: "voided" })
      .where(eq(docusignEnvelopes.id, envelope.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /envelopes/:envelopeId/resend — resend to pending signers
docusignRouter.post("/envelopes/:envelopeId/resend", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { envelopeId } = req.params;

    const [envelope] = await db
      .select()
      .from(docusignEnvelopes)
      .where(
        and(
          eq(docusignEnvelopes.externalEnvelopeId, envelopeId),
          eq(docusignEnvelopes.orgId, orgId),
        ),
      );
    if (!envelope) return res.status(404).json({ error: "Envelope not found" });

    const config = await getDocuSignConfig(orgId);
    await docuSignFetch(config, `/envelopes/${envelopeId}?resend_envelope=true`, {
      method: "PUT",
      body: JSON.stringify({}),
    });

    res.json({ message: "Envelope resent to pending signers" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Download Executed Document ───────────────────────────────────────────

// GET /envelopes/:envelopeId/download — download the signed PDF
docusignRouter.get("/envelopes/:envelopeId/download", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { envelopeId } = req.params;

    const [envelope] = await db
      .select()
      .from(docusignEnvelopes)
      .where(
        and(
          eq(docusignEnvelopes.externalEnvelopeId, envelopeId),
          eq(docusignEnvelopes.orgId, orgId),
        ),
      );
    if (!envelope) return res.status(404).json({ error: "Envelope not found" });

    const config = await getDocuSignConfig(orgId);
    const url = `${config.baseUrl}/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });

    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="signed-${envelopeId}.pdf"`);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Bulk Send ────────────────────────────────────────────────────────────

// POST /envelopes/bulk-send — send same template to multiple signer sets
docusignRouter.post("/envelopes/bulk-send", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { templateId, recipients, subject, dealId, prefillFields } = req.body;

    if (!templateId || !recipients?.length) {
      return res.status(400).json({ error: "templateId and recipients[] are required" });
    }

    const config = await getDocuSignConfig(orgId);
    const results: any[] = [];
    const errors: any[] = [];

    for (const recipient of recipients) {
      try {
        const templateRoles = [
          {
            email: recipient.email,
            name: recipient.name,
            roleName: recipient.roleName || "signer",
            routingOrder: "1",
            tabs: prefillFields
              ? {
                  textTabs: Object.entries({
                    ...prefillFields,
                    ...(recipient.prefillFields || {}),
                  }).map(([tabLabel, value]) => ({ tabLabel, value })),
                }
              : undefined,
          },
        ];

        const result = await docuSignFetch(config, "/envelopes", {
          method: "POST",
          body: JSON.stringify({
            templateId,
            templateRoles,
            emailSubject: subject || `Signature requested`,
            status: "sent",
          }),
        });

        const [envelope] = await db
          .insert(docusignEnvelopes)
          .values({
            orgId,
            dealId: dealId || null,
            externalEnvelopeId: result.envelopeId,
            templateId,
            subject: subject || "Signature requested",
            status: "sent",
            signers: [{ name: recipient.name, email: recipient.email, status: "sent" }],
            prefillFields: { ...prefillFields, ...(recipient.prefillFields || {}) },
            sentAt: new Date(),
            createdBy: userId,
          })
          .returning();

        results.push({ email: recipient.email, envelopeId: result.envelopeId, localId: envelope.id });
      } catch (err: any) {
        errors.push({ email: recipient.email, error: err.message });
      }
    }

    res.status(201).json({
      sent: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Webhook Handler ──────────────────────────────────────────────────────

// POST /webhook — DocuSign Connect webhook (no auth — called by DocuSign)
// DocuSign Connect supports HMAC signature verification via X-DocuSign-Signature headers
docusignRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    // Verify DocuSign HMAC signature if secret is configured
    const docusignHmacKey = process.env.DOCUSIGN_WEBHOOK_HMAC_KEY;
    if (docusignHmacKey) {
      const crypto = await import('crypto');
      const signatureHeaders = [
        req.headers['x-docusign-signature-1'] as string,
        req.headers['x-docusign-signature-2'] as string,
        req.headers['x-docusign-signature-3'] as string,
      ].filter(Boolean);

      if (signatureHeaders.length === 0) {
        return res.status(401).json({ error: 'Missing DocuSign signature header' });
      }

      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const computedHmac = crypto.default
        .createHmac('sha256', docusignHmacKey)
        .update(rawBody, 'utf8')
        .digest('base64');

      const isValid = signatureHeaders.some((sig) => {
        try {
          return crypto.default.timingSafeEqual(
            Buffer.from(sig),
            Buffer.from(computedHmac)
          );
        } catch {
          return false;
        }
      });

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid DocuSign webhook signature' });
      }
    }

    const event = req.body;
    const envelopeId = event?.data?.envelopeId || event?.envelopeId;
    const eventType = event?.event || event?.status;

    if (!envelopeId) {
      return res.status(400).json({ error: "No envelope ID in webhook payload" });
    }

    // Find the envelope in our DB (search across all orgs since webhook has no org context)
    const [envelope] = await db
      .select()
      .from(docusignEnvelopes)
      .where(eq(docusignEnvelopes.externalEnvelopeId, envelopeId));

    if (!envelope) {
      // Not our envelope — acknowledge anyway
      return res.status(200).json({ received: true, matched: false });
    }

    // Update signers from webhook data
    const recipientStatuses = event?.data?.envelopeSummary?.recipients?.signers || [];
    const updatedSigners = recipientStatuses.map((s: any) => ({
      name: s.name,
      email: s.email,
      status: s.status,
      signedAt: s.signedDateTime || null,
      deliveredAt: s.deliveredDateTime || null,
    }));

    const updateData: Record<string, any> = {
      status: mapDocuSignStatus(eventType),
    };

    if (updatedSigners.length > 0) {
      updateData.signers = updatedSigners;
    }

    if (eventType === "envelope-completed" || eventType === "completed") {
      updateData.completedAt = new Date();

      // Try to download and store the executed document URL
      try {
        const config = await getDocuSignConfig(envelope.orgId);
        // Store a reference URL — actual download via /envelopes/:id/download
        updateData.executedDocUrl = `signed/${envelopeId}.pdf`;
      } catch {
        // Config may not be available in webhook context
      }
    }

    await db
      .update(docusignEnvelopes)
      .set(updateData)
      .where(eq(docusignEnvelopes.id, envelope.id));

    // Also update the signatureRequests record
    await db
      .update(signatureRequests)
      .set({
        status: updateData.status,
        completedAt: updateData.completedAt,
        executedDocUrl: updateData.executedDocUrl,
      })
      .where(eq(signatureRequests.externalEnvelopeId, envelopeId));

    res.status(200).json({ received: true, matched: true, status: updateData.status });
  } catch (error: any) {
    // Always return 200 to DocuSign to prevent retries
    // Do not leak internal error details in the response
    console.error("DocuSign webhook error:", error);
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

// ── Dashboard / Summary ──────────────────────────────────────────────────

// GET /dashboard — signing activity summary
docusignRouter.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [stats] = await db
      .select({
        total: count(),
        sent: sql<number>`count(*) filter (where ${docusignEnvelopes.status} = 'sent')`,
        delivered: sql<number>`count(*) filter (where ${docusignEnvelopes.status} = 'delivered')`,
        completed: sql<number>`count(*) filter (where ${docusignEnvelopes.status} = 'completed')`,
        declined: sql<number>`count(*) filter (where ${docusignEnvelopes.status} = 'declined')`,
        voided: sql<number>`count(*) filter (where ${docusignEnvelopes.status} = 'voided')`,
      })
      .from(docusignEnvelopes)
      .where(eq(docusignEnvelopes.orgId, orgId));

    // Recent envelopes
    const recent = await db
      .select()
      .from(docusignEnvelopes)
      .where(eq(docusignEnvelopes.orgId, orgId))
      .orderBy(desc(docusignEnvelopes.createdAt))
      .limit(10);

    // Awaiting signature (sent but not completed)
    const awaiting = await db
      .select()
      .from(docusignEnvelopes)
      .where(
        and(
          eq(docusignEnvelopes.orgId, orgId),
          inArray(docusignEnvelopes.status, ["sent", "delivered"]),
        ),
      )
      .orderBy(desc(docusignEnvelopes.sentAt));

    res.json({
      stats: stats || { total: 0, sent: 0, delivered: 0, completed: 0, declined: 0, voided: 0 },
      recent,
      awaiting,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Utility Functions ────────────────────────────────────────────────────

function inferTemplateCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("loi") || lower.includes("letter of intent")) return "loi";
  if (lower.includes("subscription")) return "subscription";
  if (lower.includes("operating agreement")) return "operating_agreement";
  if (lower.includes("lease") || lower.includes("amendment")) return "lease";
  if (lower.includes("capital call")) return "capital_call";
  if (lower.includes("nda") || lower.includes("non-disclosure")) return "nda";
  if (lower.includes("psa") || lower.includes("purchase")) return "psa";
  return "custom";
}

function mapDocuSignStatus(event: string): string {
  const map: Record<string, string> = {
    "envelope-sent": "sent",
    "envelope-delivered": "delivered",
    "envelope-completed": "completed",
    "envelope-declined": "declined",
    "envelope-voided": "voided",
    sent: "sent",
    delivered: "delivered",
    completed: "completed",
    declined: "declined",
    voided: "voided",
  };
  return map[event] || event;
}
