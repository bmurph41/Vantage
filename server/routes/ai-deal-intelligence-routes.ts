import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { db } from "../db";
import {
  dealChatSessions,
  dealChatMessages,
  dealChatFeedback,
  aiNarratives,
  leaseAbstractions,
  dealRiskScores,
  crmDeals,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const aiDealIntelligenceRouter = Router();

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-5-20250514";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ─── Helper: gather deal context ────────────────────────────────────────────

async function getDealContext(dealId: string) {
  const [deal] = await db
    .select()
    .from(crmDeals)
    .where(eq(crmDeals.id, dealId))
    .limit(1);
  if (!deal) return null;
  return deal;
}

// ─── 1.1 Ask Your Deal — AI Chat ───────────────────────────────────────────

// Create chat session
aiDealIntelligenceRouter.post("/sessions", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { dealId } = req.body;

    if (!dealId) {
      return res.status(400).json({ error: "dealId is required" });
    }

    const [session] = await db
      .insert(dealChatSessions)
      .values({
        orgId,
        dealId,
        userId,
        sessionTitle: `Chat — ${new Date().toLocaleDateString()}`,
      })
      .returning();

    res.status(201).json(session);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Create session error:", error);
    res.status(500).json({ error: "Failed to create chat session", message: error.message });
  }
});

// List sessions for a deal
aiDealIntelligenceRouter.get("/sessions/deal/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { dealId } = req.params;

    const sessions = await db
      .select()
      .from(dealChatSessions)
      .where(and(eq(dealChatSessions.dealId, dealId), eq(dealChatSessions.orgId, orgId)))
      .orderBy(desc(dealChatSessions.createdAt));

    res.json(sessions);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] List sessions error:", error);
    res.status(500).json({ error: "Failed to list sessions", message: error.message });
  }
});

// Send message (SSE streaming)
aiDealIntelligenceRouter.post("/sessions/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    // Verify session exists
    const [session] = await db
      .select()
      .from(dealChatSessions)
      .where(eq(dealChatSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Save user message
    const [userMsg] = await db
      .insert(dealChatMessages)
      .values({
        sessionId,
        role: "user",
        content,
      })
      .returning();

    // Build deal context
    const dealContext = session.dealId ? await getDealContext(session.dealId) : null;

    // Fetch conversation history
    const history = await db
      .select()
      .from(dealChatMessages)
      .where(eq(dealChatMessages.sessionId, sessionId))
      .orderBy(dealChatMessages.createdAt);

    const messages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const startTime = Date.now();
    let fullResponse = "";

    const systemPrompt = `You are an expert commercial real estate deal analyst. You have deep knowledge of CRE acquisitions, dispositions, financing, and due diligence.

${dealContext ? `Current Deal Context:\n${JSON.stringify(dealContext, null, 2)}` : "No deal context available."}

Answer questions about this deal accurately. If you don't have enough information, say so. Provide actionable insights.`;

    const stream = await anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.filter((m) => m.role === "user" || m.role === "assistant"),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ type: "delta", text: event.delta.text })}\n\n`);
      }
    }

    const latencyMs = Date.now() - startTime;
    const finalMessage = await stream.finalMessage();
    const tokensUsed = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;

    // Save assistant message
    const [assistantMsg] = await db
      .insert(dealChatMessages)
      .values({
        sessionId,
        role: "assistant",
        content: fullResponse,
        contextSnapshot: dealContext,
        tokensUsed,
        latencyMs,
      })
      .returning();

    res.write(
      `data: ${JSON.stringify({ type: "done", messageId: assistantMsg.id, tokensUsed, latencyMs })}\n\n`
    );
    res.end();
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Chat message error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process message", message: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Delete session
aiDealIntelligenceRouter.delete("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await db.delete(dealChatSessions).where(eq(dealChatSessions.id, sessionId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Delete session error:", error);
    res.status(500).json({ error: "Failed to delete session", message: error.message });
  }
});

// Message feedback
aiDealIntelligenceRouter.post("/messages/:messageId/feedback", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { messageId } = req.params;
    const { rating, comment } = req.body;

    const [feedback] = await db
      .insert(dealChatFeedback)
      .values({
        messageId,
        rating,
        comment,
        userId,
      })
      .returning();

    res.status(201).json(feedback);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Feedback error:", error);
    res.status(500).json({ error: "Failed to save feedback", message: error.message });
  }
});

// ─── 1.2 AI Narrative Generator ────────────────────────────────────────────

const NARRATIVE_TYPES = [
  "ic_exec_summary",
  "market_overview",
  "risk_factors",
  "asset_description",
  "investment_highlights",
  "capital_stack",
  "exit_strategy",
] as const;

const NARRATIVE_PROMPTS: Record<string, string> = {
  ic_exec_summary:
    "Write an Investment Committee Executive Summary for this deal. Include key metrics, investment thesis, risks, and recommendation.",
  market_overview:
    "Write a comprehensive Market Overview for this deal's location and asset class. Cover supply/demand dynamics, comparable transactions, and market trends.",
  risk_factors:
    "Identify and analyze all material risk factors for this deal. Categorize by likelihood and impact. Suggest mitigants.",
  asset_description:
    "Write a detailed Asset Description covering physical characteristics, location, condition, improvements, and competitive positioning.",
  investment_highlights:
    "Write compelling Investment Highlights for this deal. Focus on value creation opportunities, competitive advantages, and return drivers.",
  capital_stack:
    "Analyze and describe the Capital Stack for this deal. Cover debt terms, equity structure, waterfall, and capitalization strategy.",
  exit_strategy:
    "Outline potential Exit Strategies for this deal. Analyze hold period scenarios, disposition timing, and buyer universe.",
};

// Generate narrative
aiDealIntelligenceRouter.post("/narratives/generate", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { dealId, narrativeType } = req.body;

    if (!dealId || !narrativeType) {
      return res.status(400).json({ error: "dealId and narrativeType are required" });
    }

    if (!NARRATIVE_TYPES.includes(narrativeType)) {
      return res.status(400).json({ error: `Invalid narrativeType. Must be one of: ${NARRATIVE_TYPES.join(", ")}` });
    }

    const dealContext = await getDealContext(dealId);
    if (!dealContext) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const prompt = NARRATIVE_PROMPTS[narrativeType];

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system:
        "You are a senior commercial real estate analyst writing institutional-quality investment narratives. Write in professional, formal tone suitable for an Investment Committee memorandum.",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nDeal Data:\n${JSON.stringify(dealContext, null, 2)}`,
        },
      ],
    });

    const generatedContent =
      response.content[0].type === "text" ? response.content[0].text : "";

    const [narrative] = await db
      .insert(aiNarratives)
      .values({
        dealId,
        orgId,
        userId,
        narrativeType,
        promptVersion: "1.0",
        generatedContent,
        contextSnapshot: dealContext,
      })
      .returning();

    res.status(201).json(narrative);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Generate narrative error:", error);
    res.status(500).json({ error: "Failed to generate narrative", message: error.message });
  }
});

// List narratives for deal
aiDealIntelligenceRouter.get("/narratives/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { dealId } = req.params;

    const narratives = await db
      .select()
      .from(aiNarratives)
      .where(and(eq(aiNarratives.dealId, dealId), eq(aiNarratives.orgId, orgId)))
      .orderBy(desc(aiNarratives.createdAt));

    res.json(narratives);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] List narratives error:", error);
    res.status(500).json({ error: "Failed to list narratives", message: error.message });
  }
});

// Update narrative (edited content)
aiDealIntelligenceRouter.put("/narratives/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { editedContent } = req.body;

    const [updated] = await db
      .update(aiNarratives)
      .set({ editedContent, updatedAt: new Date() })
      .where(eq(aiNarratives.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Narrative not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Update narrative error:", error);
    res.status(500).json({ error: "Failed to update narrative", message: error.message });
  }
});

// Approve narrative
aiDealIntelligenceRouter.post("/narratives/:id/approve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const [updated] = await db
      .update(aiNarratives)
      .set({ isApproved: true, approvedBy: userId, approvedAt: new Date() })
      .where(eq(aiNarratives.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Narrative not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Approve narrative error:", error);
    res.status(500).json({ error: "Failed to approve narrative", message: error.message });
  }
});

// Regenerate narrative
aiDealIntelligenceRouter.post("/narratives/:id/regenerate", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.orgId;
    const { id } = req.params;

    // Get existing narrative
    const [existing] = await db
      .select()
      .from(aiNarratives)
      .where(eq(aiNarratives.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Narrative not found" });
    }

    const dealContext = existing.dealId ? await getDealContext(existing.dealId) : null;
    const prompt = NARRATIVE_PROMPTS[existing.narrativeType];

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system:
        "You are a senior commercial real estate analyst writing institutional-quality investment narratives. Write in professional, formal tone suitable for an Investment Committee memorandum.",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nDeal Data:\n${JSON.stringify(dealContext, null, 2)}`,
        },
      ],
    });

    const generatedContent =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Create new version
    const [narrative] = await db
      .insert(aiNarratives)
      .values({
        dealId: existing.dealId,
        orgId,
        userId,
        narrativeType: existing.narrativeType,
        promptVersion: "1.0",
        generatedContent,
        contextSnapshot: dealContext,
      })
      .returning();

    res.status(201).json(narrative);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Regenerate narrative error:", error);
    res.status(500).json({ error: "Failed to regenerate narrative", message: error.message });
  }
});

// ─── 1.3 AI Lease Abstractor ───────────────────────────────────────────────

// Extract lease data from uploaded PDF
aiDealIntelligenceRouter.post(
  "/lease-abstractor/extract",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).user?.orgId;
      const userId = (req as any).user?.id;
      const { dealId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!dealId) {
        return res.status(400).json({ error: "dealId is required" });
      }

      // Create abstraction record in pending state
      const [abstraction] = await db
        .insert(leaseAbstractions)
        .values({
          orgId,
          dealId,
          fileName: file.originalname,
          status: "processing",
          createdBy: userId,
        })
        .returning();

      // Convert file buffer to base64 for Anthropic
      const fileBase64 = file.buffer.toString("base64");
      const mediaType = file.mimetype === "application/pdf" ? "application/pdf" : "image/png";

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: `You are an expert commercial real estate lease abstractor. Extract all key terms from this lease document and return them as structured JSON.

Return JSON with these fields:
{
  "tenantName": "",
  "landlordName": "",
  "premisesAddress": "",
  "suiteUnit": "",
  "squareFootage": null,
  "leaseType": "", // NNN, Gross, Modified Gross, etc.
  "commencementDate": "",
  "expirationDate": "",
  "leaseTerm": "",
  "baseRent": null,
  "rentPerSF": null,
  "annualEscalation": "",
  "securityDeposit": null,
  "renewalOptions": [],
  "terminationRights": "",
  "tenantImprovementAllowance": null,
  "freeRentPeriod": "",
  "camCharges": null,
  "insuranceRequirements": "",
  "permittedUse": "",
  "exclusiveUse": "",
  "coTenancy": "",
  "assignmentSubletting": "",
  "guarantor": "",
  "notableProvisions": [],
  "riskFlags": []
}`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: fileBase64,
                },
              },
              {
                type: "text",
                text: "Extract all key lease terms from this document. Return structured JSON.",
              },
            ],
          },
        ],
      });

      const responseText =
        response.content[0].type === "text" ? response.content[0].text : "{}";

      // Parse JSON from response (handle markdown code blocks)
      let extractedData: any;
      let riskFlags: any[] = [];
      try {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
        extractedData = JSON.parse(jsonStr);
        riskFlags = extractedData.riskFlags || [];
      } catch {
        extractedData = { rawText: responseText };
      }

      // Update abstraction with extracted data
      const [updated] = await db
        .update(leaseAbstractions)
        .set({
          extractedData,
          riskFlags,
          status: "completed",
          extractedAt: new Date(),
        })
        .where(eq(leaseAbstractions.id, abstraction.id))
        .returning();

      res.status(201).json(updated);
    } catch (error: any) {
      console.error("[AI Deal Intelligence] Lease extraction error:", error);
      res.status(500).json({ error: "Failed to extract lease data", message: error.message });
    }
  }
);

// List abstractions for deal
aiDealIntelligenceRouter.get("/lease-abstractor/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { dealId } = req.params;

    const abstractions = await db
      .select()
      .from(leaseAbstractions)
      .where(and(eq(leaseAbstractions.dealId, dealId), eq(leaseAbstractions.orgId, orgId)))
      .orderBy(desc(leaseAbstractions.createdAt));

    res.json(abstractions);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] List abstractions error:", error);
    res.status(500).json({ error: "Failed to list abstractions", message: error.message });
  }
});

// Update extracted fields
aiDealIntelligenceRouter.patch("/lease-abstractor/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { extractedData, riskFlags } = req.body;

    const updates: any = {};
    if (extractedData !== undefined) updates.extractedData = extractedData;
    if (riskFlags !== undefined) updates.riskFlags = riskFlags;

    const [updated] = await db
      .update(leaseAbstractions)
      .set(updates)
      .where(eq(leaseAbstractions.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Lease abstraction not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Update abstraction error:", error);
    res.status(500).json({ error: "Failed to update abstraction", message: error.message });
  }
});

// ─── 1.4 Deal Risk Scoring ─────────────────────────────────────────────────

const RISK_DIMENSIONS = [
  { key: "financialStructure", label: "Financial Structure", weight: 0.20 },
  { key: "marketRisk", label: "Market Risk", weight: 0.15 },
  { key: "tenantCredit", label: "Tenant Credit", weight: 0.15 },
  { key: "physicalCondition", label: "Physical Condition", weight: 0.10 },
  { key: "executionRisk", label: "Execution Risk", weight: 0.10 },
  { key: "liquidityRisk", label: "Liquidity Risk", weight: 0.10 },
  { key: "regulatoryRisk", label: "Regulatory Risk", weight: 0.10 },
  { key: "macroRisk", label: "Macro Risk", weight: 0.10 },
] as const;

function computeRiskTier(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

// Generate risk score
aiDealIntelligenceRouter.post("/risk-score/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { dealId } = req.params;

    const dealContext = await getDealContext(dealId);
    if (!dealContext) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const dimensionList = RISK_DIMENSIONS.map(
      (d) => `- ${d.key} (${d.label}, weight: ${d.weight})`
    ).join("\n");

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are a commercial real estate risk analyst. Score deals across risk dimensions on a 0-100 scale (100 = lowest risk / best). Return structured JSON.`,
      messages: [
        {
          role: "user",
          content: `Analyze this deal and score each risk dimension (0-100, where 100 = lowest risk):

Dimensions:
${dimensionList}

Also provide:
- A narrative summary (2-3 paragraphs)
- Top 3 risks (array of {risk, severity, description})
- Top 3 strengths (array of {strength, impact, description})

Deal Data:
${JSON.stringify(dealContext, null, 2)}

Return JSON format:
{
  "dimensions": { "financialStructure": 75, "marketRisk": 80, ... },
  "narrativeSummary": "...",
  "topRisks": [...],
  "topStrengths": [...]
}`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    let parsed: any;
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        dimensions: {},
        narrativeSummary: responseText,
        topRisks: [],
        topStrengths: [],
      };
    }

    // Calculate weighted composite score
    let compositeScore = 0;
    for (const dim of RISK_DIMENSIONS) {
      const dimScore = parsed.dimensions?.[dim.key] ?? 50;
      compositeScore += dimScore * dim.weight;
    }
    compositeScore = Math.round(compositeScore * 100) / 100;

    const riskTier = computeRiskTier(compositeScore);

    const [riskScore] = await db
      .insert(dealRiskScores)
      .values({
        dealId,
        orgId,
        compositeScore: compositeScore.toFixed(2),
        riskTier,
        dimensions: parsed.dimensions,
        narrativeSummary: parsed.narrativeSummary,
        topRisks: parsed.topRisks,
        topStrengths: parsed.topStrengths,
        generatedBy: userId,
      })
      .returning();

    res.status(201).json(riskScore);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Risk score error:", error);
    res.status(500).json({ error: "Failed to generate risk score", message: error.message });
  }
});

// Get latest risk score
aiDealIntelligenceRouter.get("/risk-score/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { dealId } = req.params;

    const [score] = await db
      .select()
      .from(dealRiskScores)
      .where(and(eq(dealRiskScores.dealId, dealId), eq(dealRiskScores.orgId, orgId)))
      .orderBy(desc(dealRiskScores.generatedAt))
      .limit(1);

    if (!score) {
      return res.status(404).json({ error: "No risk score found for this deal" });
    }

    res.json(score);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Get risk score error:", error);
    res.status(500).json({ error: "Failed to get risk score", message: error.message });
  }
});

// Risk score history
aiDealIntelligenceRouter.get("/risk-score/:dealId/history", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { dealId } = req.params;

    const scores = await db
      .select()
      .from(dealRiskScores)
      .where(and(eq(dealRiskScores.dealId, dealId), eq(dealRiskScores.orgId, orgId)))
      .orderBy(desc(dealRiskScores.generatedAt));

    res.json(scores);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Risk score history error:", error);
    res.status(500).json({ error: "Failed to get risk score history", message: error.message });
  }
});

// ─── 1.5 AI Comps Narrator ─────────────────────────────────────────────────

aiDealIntelligenceRouter.post("/comps-narrator/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    const { dealId } = req.params;
    const { compsData } = req.body;

    const dealContext = await getDealContext(dealId);
    if (!dealContext) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system:
        "You are a commercial real estate analyst specializing in comparable transaction analysis. Write institutional-quality comp narratives.",
      messages: [
        {
          role: "user",
          content: `Write a comprehensive comparable transactions narrative for this deal.

Subject Deal:
${JSON.stringify(dealContext, null, 2)}

${compsData ? `Comparable Transactions Data:\n${JSON.stringify(compsData, null, 2)}` : "No specific comps data provided. Discuss the general approach to finding and analyzing comps for this deal type and market."}

Include:
1. Executive summary of comp analysis
2. Comparison to each comp (if provided) — price/SF, cap rate, date, adjustments
3. Implied valuation range for the subject property
4. Key takeaways and market positioning`,
        },
      ],
    });

    const generatedContent =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Save as a narrative of type "comps_analysis"
    const [narrative] = await db
      .insert(aiNarratives)
      .values({
        dealId,
        orgId,
        userId,
        narrativeType: "comps_analysis",
        promptVersion: "1.0",
        generatedContent,
        contextSnapshot: { deal: dealContext, compsData: compsData || null },
      })
      .returning();

    res.status(201).json(narrative);
  } catch (error: any) {
    console.error("[AI Deal Intelligence] Comps narrator error:", error);
    res.status(500).json({ error: "Failed to generate comps narrative", message: error.message });
  }
});
