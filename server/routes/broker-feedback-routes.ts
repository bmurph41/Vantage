/**
 * Broker Feedback Routes
 *
 * Serves cached broker evaluations to subscribers. The rules engine itself
 * lives in broker-evaluator-service; this router handles request plumbing,
 * tier gating, and narrative stripping.
 *
 * Tier gating:
 *   - Free/Solo:          verdict + score + matched/failed chips, NO narrative
 *   - Pro/Institutional:  full narrative + modeling project feedback
 *
 * Endpoints:
 *   GET  /api/broker-feedback/listing/:id
 *   GET  /api/broker-feedback/modeling-project/:id
 *   POST /api/broker-feedback/evaluate      (explicit single-broker evaluation)
 */

import { Router, Request, Response } from "express";
import {
  evaluateTarget,
  getFeedbackForTarget,
  type CachedEvaluation,
} from "../services/broker-evaluator-service";
import {
  getEffectiveBrokerEntitlement,
  tierHasFeature,
} from "../services/broker-entitlements";

const router = Router();

function getCtx(req: Request): { userId: string; orgId: string } | null {
  const user = (req as any).user || (req as any).session?.user;
  if (!user?.id || !user?.orgId) return null;
  return { userId: user.id, orgId: user.orgId };
}

function stripNarrative(evalRow: CachedEvaluation): CachedEvaluation {
  return { ...evalRow, narrative: null };
}

router.get("/listing/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });

    const entitlement = await getEffectiveBrokerEntitlement(ctx.userId, ctx.orgId);
    const canSeeNarrative = tierHasFeature(entitlement.tier, "broker_feedback_narrative");

    const feedback = await getFeedbackForTarget({
      userId: ctx.userId,
      targetType: "marina_listing",
      targetId: req.params.id,
      includeNarrative: canSeeNarrative,
    });

    res.json({
      tier: entitlement.tier,
      canSeeNarrative,
      canSeeModelingFeedback: tierHasFeature(entitlement.tier, "broker_feedback_modeling"),
      feedback: canSeeNarrative ? feedback : feedback.map(stripNarrative),
    });
  } catch (err) {
    console.error("[broker-feedback] listing error:", err);
    res.status(500).json({ error: "Failed to load broker feedback" });
  }
});

router.get("/modeling-project/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });

    const entitlement = await getEffectiveBrokerEntitlement(ctx.userId, ctx.orgId);
    const canSeeModeling = tierHasFeature(entitlement.tier, "broker_feedback_modeling");
    if (!canSeeModeling) {
      return res.status(403).json({
        error: "Modeling project broker feedback requires Marketplace+ Pro",
        upgradeUrl: "/settings/billing?upgrade=marketplace_plus&feature=broker_feedback_modeling",
        tier: entitlement.tier,
      });
    }
    const canSeeNarrative = tierHasFeature(entitlement.tier, "broker_feedback_narrative");

    const feedback = await getFeedbackForTarget({
      userId: ctx.userId,
      targetType: "modeling_project",
      targetId: req.params.id,
      includeNarrative: canSeeNarrative,
    });

    res.json({
      tier: entitlement.tier,
      canSeeNarrative,
      canSeeModelingFeedback: true,
      feedback: canSeeNarrative ? feedback : feedback.map(stripNarrative),
    });
  } catch (err) {
    console.error("[broker-feedback] modeling error:", err);
    res.status(500).json({ error: "Failed to load broker feedback" });
  }
});

router.post("/evaluate", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });

    const { brokerProfileId, targetType, targetId, force } = req.body || {};
    if (!brokerProfileId || !targetType || !targetId) {
      return res
        .status(400)
        .json({ error: "brokerProfileId, targetType, targetId required" });
    }
    if (targetType !== "marina_listing" && targetType !== "modeling_project") {
      return res.status(400).json({ error: "Invalid targetType" });
    }

    const entitlement = await getEffectiveBrokerEntitlement(ctx.userId, ctx.orgId);
    const canSeeNarrative = tierHasFeature(entitlement.tier, "broker_feedback_narrative");
    if (targetType === "modeling_project" && !tierHasFeature(entitlement.tier, "broker_feedback_modeling")) {
      return res.status(403).json({ error: "Tier does not allow modeling feedback" });
    }

    const result = await evaluateTarget({
      brokerProfileId,
      targetType,
      targetId,
      options: { force: !!force, includeNarrative: canSeeNarrative },
    });

    if ("error" in result) {
      return res.status(result.reason === "no_criteria" ? 409 : 404).json(result);
    }

    res.json(canSeeNarrative ? result : stripNarrative(result));
  } catch (err) {
    console.error("[broker-feedback] evaluate error:", err);
    res.status(500).json({ error: "Failed to evaluate" });
  }
});

export default router;
