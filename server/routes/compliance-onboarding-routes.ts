import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  climateRiskAssessments,
  environmentalStudies,
  insurancePolicies,
  insuranceClaims,
  regulatoryObligations,
  userOnboarding,
  crmDeals,
} from '@shared/schema';
import { eq, and, desc, sql, lte, gte } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export const complianceOnboardingRouter = Router();

const anthropic = new Anthropic();

// ═══════════════════════════════════════════════════════════════════════
// I.1 — Climate Risk
// ═══════════════════════════════════════════════════════════════════════

// GET /climate-risk — list all assessments for org
complianceOnboardingRouter.get('/climate-risk', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const assessments = await db
      .select()
      .from(climateRiskAssessments)
      .where(eq(climateRiskAssessments.orgId, orgId))
      .orderBy(desc(climateRiskAssessments.assessedAt));

    res.json(assessments);
  } catch (error) {
    console.error('[Climate Risk] Error listing assessments:', error);
    res.status(500).json({ error: 'Failed to list climate risk assessments' });
  }
});

// GET /climate-risk/:dealId — get latest assessment for deal
complianceOnboardingRouter.get('/climate-risk/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId } = req.params;

    const [assessment] = await db
      .select()
      .from(climateRiskAssessments)
      .where(
        and(
          eq(climateRiskAssessments.dealId, dealId),
          eq(climateRiskAssessments.orgId, orgId)
        )
      )
      .orderBy(desc(climateRiskAssessments.assessedAt))
      .limit(1);

    if (!assessment) {
      return res.status(404).json({ error: 'No climate risk assessment found for this deal' });
    }

    res.json(assessment);
  } catch (error) {
    console.error('[Climate Risk] Error fetching assessment:', error);
    res.status(500).json({ error: 'Failed to fetch climate risk assessment' });
  }
});

// POST /climate-risk/:dealId — generate assessment with AI disclosure
complianceOnboardingRouter.post('/climate-risk/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId } = req.params;

    // Fetch deal for location data
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const location = deal.location || 'Unknown location';

    // Risk factor placeholders
    const riskFactors = {
      floodRisk: { score: 0.5, zone: 'moderate', source: 'placeholder' },
      seaLevelRise: { score: 0.3, projectionYears: 30, source: 'placeholder' },
      windRisk: { score: 0.4, category: 'moderate', source: 'placeholder' },
      wildfireRisk: { score: 0.2, zone: 'low', source: 'placeholder' },
      insuranceImpact: { premiumMultiplier: 1.15, availabilityRisk: 'low', source: 'placeholder' },
    };

    // Composite score: average of individual scores
    const scores = [
      riskFactors.floodRisk.score,
      riskFactors.seaLevelRise.score,
      riskFactors.windRisk.score,
      riskFactors.wildfireRisk.score,
    ];
    const compositeScore = (scores.reduce((a, b) => a + b, 0) / scores.length * 100).toFixed(2);

    // Generate AI disclosure paragraph
    let aiDisclosure = '';
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Write a concise climate risk disclosure paragraph for a commercial real estate investment property located at "${location}". Include references to flood risk, sea level rise, wind risk, and wildfire risk. The composite risk score is ${compositeScore}/100. This is for an investment memo. Keep it professional and factual, 3-5 sentences.`,
          },
        ],
      });
      const block = message.content[0];
      if (block.type === 'text') {
        aiDisclosure = block.text;
      }
    } catch (aiError) {
      console.error('[Climate Risk] AI generation failed, using fallback:', aiError);
      aiDisclosure = `Climate risk assessment for property at ${location}. Composite risk score: ${compositeScore}/100. Detailed risk factors have been recorded for flood, sea level rise, wind, and wildfire categories. Further analysis recommended.`;
    }

    const [assessment] = await db
      .insert(climateRiskAssessments)
      .values({
        dealId,
        orgId,
        compositeScore: compositeScore,
        floodRisk: riskFactors.floodRisk,
        seaLevelRise: riskFactors.seaLevelRise,
        windRisk: riskFactors.windRisk,
        wildfireRisk: riskFactors.wildfireRisk,
        insuranceImpact: riskFactors.insuranceImpact,
        aiDisclosure,
      })
      .returning();

    res.status(201).json(assessment);
  } catch (error) {
    console.error('[Climate Risk] Error generating assessment:', error);
    res.status(500).json({ error: 'Failed to generate climate risk assessment' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// I.2 — Environmental Tracking
// ═══════════════════════════════════════════════════════════════════════

// GET /environmental/recs — list all studies with REC identified across org
complianceOnboardingRouter.get('/environmental/recs', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const studies = await db
      .select()
      .from(environmentalStudies)
      .where(
        and(
          eq(environmentalStudies.orgId, orgId),
          eq(environmentalStudies.recIdentified, true)
        )
      )
      .orderBy(desc(environmentalStudies.createdAt));

    res.json(studies);
  } catch (error) {
    console.error('[Environmental] Error listing RECs:', error);
    res.status(500).json({ error: 'Failed to list environmental RECs' });
  }
});

// GET /environmental/:dealId — list studies for deal
complianceOnboardingRouter.get('/environmental/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId } = req.params;

    const studies = await db
      .select()
      .from(environmentalStudies)
      .where(
        and(
          eq(environmentalStudies.dealId, dealId),
          eq(environmentalStudies.orgId, orgId)
        )
      )
      .orderBy(desc(environmentalStudies.createdAt));

    res.json(studies);
  } catch (error) {
    console.error('[Environmental] Error listing studies:', error);
    res.status(500).json({ error: 'Failed to list environmental studies' });
  }
});

// POST /environmental — create study record
complianceOnboardingRouter.post('/environmental', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId, studyType, vendorName, orderedDate, documentUrl } = req.body;

    if (!dealId) {
      return res.status(400).json({ error: 'dealId is required' });
    }

    const [study] = await db
      .insert(environmentalStudies)
      .values({
        dealId,
        orgId,
        studyType,
        vendorName,
        orderedDate,
        documentUrl,
      })
      .returning();

    res.status(201).json(study);
  } catch (error) {
    console.error('[Environmental] Error creating study:', error);
    res.status(500).json({ error: 'Failed to create environmental study' });
  }
});

// PUT /environmental/:id — update study (status, findings, completion)
complianceOnboardingRouter.put('/environmental/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { status, findings, completedDate, recIdentified, nfaLetterUrl, documentUrl, vendorName } = req.body;

    const updates: Record<string, any> = {};
    if (status !== undefined) updates.status = status;
    if (findings !== undefined) updates.findings = findings;
    if (completedDate !== undefined) updates.completedDate = completedDate;
    if (recIdentified !== undefined) updates.recIdentified = recIdentified;
    if (nfaLetterUrl !== undefined) updates.nfaLetterUrl = nfaLetterUrl;
    if (documentUrl !== undefined) updates.documentUrl = documentUrl;
    if (vendorName !== undefined) updates.vendorName = vendorName;

    const [updated] = await db
      .update(environmentalStudies)
      .set(updates)
      .where(
        and(
          eq(environmentalStudies.id, id),
          eq(environmentalStudies.orgId, orgId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Environmental study not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Environmental] Error updating study:', error);
    res.status(500).json({ error: 'Failed to update environmental study' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// I.3 — Insurance Management
// ═══════════════════════════════════════════════════════════════════════

// GET /insurance/expiring — policies expiring within 60 days
complianceOnboardingRouter.get('/insurance/expiring', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const policies = await db
      .select()
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.orgId, orgId),
          eq(insurancePolicies.status, 'active'),
          gte(insurancePolicies.expirationDate, now.toISOString().split('T')[0]),
          lte(insurancePolicies.expirationDate, sixtyDays.toISOString().split('T')[0])
        )
      )
      .orderBy(insurancePolicies.expirationDate);

    res.json(policies);
  } catch (error) {
    console.error('[Insurance] Error fetching expiring policies:', error);
    res.status(500).json({ error: 'Failed to fetch expiring policies' });
  }
});

// GET /insurance/gaps — deals with no active property policy
complianceOnboardingRouter.get('/insurance/gaps', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Find deals that have no active property insurance policy
    const dealsWithPropertyInsurance = db
      .select({ dealId: insurancePolicies.dealId })
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.orgId, orgId),
          eq(insurancePolicies.policyType, 'property'),
          eq(insurancePolicies.status, 'active')
        )
      );

    const dealsWithoutInsurance = await db
      .select()
      .from(crmDeals)
      .where(
        and(
          eq(crmDeals.orgId, orgId),
          sql`${crmDeals.id} NOT IN (${dealsWithPropertyInsurance})`
        )
      );

    res.json(dealsWithoutInsurance);
  } catch (error) {
    console.error('[Insurance] Error fetching coverage gaps:', error);
    res.status(500).json({ error: 'Failed to fetch insurance coverage gaps' });
  }
});

// GET /insurance — list all policies for org (filter by dealId, policyType, status)
complianceOnboardingRouter.get('/insurance', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId, policyType, status } = req.query;

    const conditions = [eq(insurancePolicies.orgId, orgId)];
    if (dealId) conditions.push(eq(insurancePolicies.dealId, dealId as string));
    if (policyType) conditions.push(eq(insurancePolicies.policyType, policyType as string));
    if (status) conditions.push(eq(insurancePolicies.status, status as string));

    const policies = await db
      .select()
      .from(insurancePolicies)
      .where(and(...conditions))
      .orderBy(desc(insurancePolicies.createdAt));

    res.json(policies);
  } catch (error) {
    console.error('[Insurance] Error listing policies:', error);
    res.status(500).json({ error: 'Failed to list insurance policies' });
  }
});

// POST /insurance — create policy
complianceOnboardingRouter.post('/insurance', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      dealId, policyType, carrier, policyNumber,
      coverageAmount, deductible, annualPremium,
      effectiveDate, expirationDate, documentUrl,
    } = req.body;

    const [policy] = await db
      .insert(insurancePolicies)
      .values({
        orgId,
        dealId,
        policyType,
        carrier,
        policyNumber,
        coverageAmount,
        deductible,
        annualPremium,
        effectiveDate,
        expirationDate,
        documentUrl,
      })
      .returning();

    res.status(201).json(policy);
  } catch (error) {
    console.error('[Insurance] Error creating policy:', error);
    res.status(500).json({ error: 'Failed to create insurance policy' });
  }
});

// GET /insurance/:id — get policy detail
complianceOnboardingRouter.get('/insurance/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const [policy] = await db
      .select()
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.id, id),
          eq(insurancePolicies.orgId, orgId)
        )
      )
      .limit(1);

    if (!policy) {
      return res.status(404).json({ error: 'Insurance policy not found' });
    }

    res.json(policy);
  } catch (error) {
    console.error('[Insurance] Error fetching policy:', error);
    res.status(500).json({ error: 'Failed to fetch insurance policy' });
  }
});

// PUT /insurance/:id — update policy
complianceOnboardingRouter.put('/insurance/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const {
      policyType, carrier, policyNumber,
      coverageAmount, deductible, annualPremium,
      effectiveDate, expirationDate, status, documentUrl,
    } = req.body;

    const updates: Record<string, any> = {};
    if (policyType !== undefined) updates.policyType = policyType;
    if (carrier !== undefined) updates.carrier = carrier;
    if (policyNumber !== undefined) updates.policyNumber = policyNumber;
    if (coverageAmount !== undefined) updates.coverageAmount = coverageAmount;
    if (deductible !== undefined) updates.deductible = deductible;
    if (annualPremium !== undefined) updates.annualPremium = annualPremium;
    if (effectiveDate !== undefined) updates.effectiveDate = effectiveDate;
    if (expirationDate !== undefined) updates.expirationDate = expirationDate;
    if (status !== undefined) updates.status = status;
    if (documentUrl !== undefined) updates.documentUrl = documentUrl;

    const [updated] = await db
      .update(insurancePolicies)
      .set(updates)
      .where(
        and(
          eq(insurancePolicies.id, id),
          eq(insurancePolicies.orgId, orgId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Insurance policy not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Insurance] Error updating policy:', error);
    res.status(500).json({ error: 'Failed to update insurance policy' });
  }
});

// DELETE /insurance/:id — delete policy
complianceOnboardingRouter.delete('/insurance/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const [deleted] = await db
      .delete(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.id, id),
          eq(insurancePolicies.orgId, orgId)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Insurance policy not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Insurance] Error deleting policy:', error);
    res.status(500).json({ error: 'Failed to delete insurance policy' });
  }
});

// POST /insurance/:id/claims — create claim
complianceOnboardingRouter.post('/insurance/:id/claims', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id: policyId } = req.params;
    const { claimNumber, description, incidentDate, filedDate, claimAmount } = req.body;

    // Verify policy belongs to org
    const [policy] = await db
      .select()
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.id, policyId),
          eq(insurancePolicies.orgId, orgId)
        )
      )
      .limit(1);

    if (!policy) {
      return res.status(404).json({ error: 'Insurance policy not found' });
    }

    const [claim] = await db
      .insert(insuranceClaims)
      .values({
        policyId,
        orgId,
        claimNumber,
        description,
        incidentDate,
        filedDate,
        claimAmount,
      })
      .returning();

    res.status(201).json(claim);
  } catch (error) {
    console.error('[Insurance] Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create insurance claim' });
  }
});

// GET /insurance/:id/claims — list claims for policy
complianceOnboardingRouter.get('/insurance/:id/claims', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id: policyId } = req.params;

    const claims = await db
      .select()
      .from(insuranceClaims)
      .where(
        and(
          eq(insuranceClaims.policyId, policyId),
          eq(insuranceClaims.orgId, orgId)
        )
      )
      .orderBy(desc(insuranceClaims.createdAt));

    res.json(claims);
  } catch (error) {
    console.error('[Insurance] Error listing claims:', error);
    res.status(500).json({ error: 'Failed to list insurance claims' });
  }
});

// PUT /insurance/claims/:claimId — update claim
complianceOnboardingRouter.put('/insurance/claims/:claimId', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { claimId } = req.params;
    const { claimNumber, description, incidentDate, filedDate, claimAmount, settledAmount, status } = req.body;

    const updates: Record<string, any> = {};
    if (claimNumber !== undefined) updates.claimNumber = claimNumber;
    if (description !== undefined) updates.description = description;
    if (incidentDate !== undefined) updates.incidentDate = incidentDate;
    if (filedDate !== undefined) updates.filedDate = filedDate;
    if (claimAmount !== undefined) updates.claimAmount = claimAmount;
    if (settledAmount !== undefined) updates.settledAmount = settledAmount;
    if (status !== undefined) updates.status = status;

    const [updated] = await db
      .update(insuranceClaims)
      .set(updates)
      .where(
        and(
          eq(insuranceClaims.id, claimId),
          eq(insuranceClaims.orgId, orgId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Insurance claim not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Insurance] Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update insurance claim' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// I.4 — Regulatory Calendar
// ═══════════════════════════════════════════════════════════════════════

// GET /regulatory/upcoming — obligations due within 30 days
complianceOnboardingRouter.get('/regulatory/upcoming', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const obligations = await db
      .select()
      .from(regulatoryObligations)
      .where(
        and(
          eq(regulatoryObligations.orgId, orgId),
          eq(regulatoryObligations.status, 'upcoming'),
          gte(regulatoryObligations.dueDate, now.toISOString().split('T')[0]),
          lte(regulatoryObligations.dueDate, thirtyDays.toISOString().split('T')[0])
        )
      )
      .orderBy(regulatoryObligations.dueDate);

    res.json(obligations);
  } catch (error) {
    console.error('[Regulatory] Error fetching upcoming obligations:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming obligations' });
  }
});

// GET /regulatory/overdue — past due obligations
complianceOnboardingRouter.get('/regulatory/overdue', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date().toISOString().split('T')[0];

    const obligations = await db
      .select()
      .from(regulatoryObligations)
      .where(
        and(
          eq(regulatoryObligations.orgId, orgId),
          eq(regulatoryObligations.status, 'upcoming'),
          lte(regulatoryObligations.dueDate, now)
        )
      )
      .orderBy(regulatoryObligations.dueDate);

    res.json(obligations);
  } catch (error) {
    console.error('[Regulatory] Error fetching overdue obligations:', error);
    res.status(500).json({ error: 'Failed to fetch overdue obligations' });
  }
});

// GET /regulatory — list obligations for org (filter by dealId, status, frequency)
complianceOnboardingRouter.get('/regulatory', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId, status, frequency } = req.query;

    const conditions = [eq(regulatoryObligations.orgId, orgId)];
    if (dealId) conditions.push(eq(regulatoryObligations.dealId, dealId as string));
    if (status) conditions.push(eq(regulatoryObligations.status, status as string));
    if (frequency) conditions.push(eq(regulatoryObligations.frequency, frequency as string));

    const obligations = await db
      .select()
      .from(regulatoryObligations)
      .where(and(...conditions))
      .orderBy(regulatoryObligations.dueDate);

    res.json(obligations);
  } catch (error) {
    console.error('[Regulatory] Error listing obligations:', error);
    res.status(500).json({ error: 'Failed to list regulatory obligations' });
  }
});

// POST /regulatory — create obligation
complianceOnboardingRouter.post('/regulatory', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      dealId, obligationType, title, description,
      authority, dueDate, frequency, noticePeriodDays, documentUrl,
    } = req.body;

    if (!obligationType || !title) {
      return res.status(400).json({ error: 'obligationType and title are required' });
    }

    const [obligation] = await db
      .insert(regulatoryObligations)
      .values({
        orgId,
        dealId,
        obligationType,
        title,
        description,
        authority,
        dueDate,
        frequency,
        noticePeriodDays,
        documentUrl,
      })
      .returning();

    res.status(201).json(obligation);
  } catch (error) {
    console.error('[Regulatory] Error creating obligation:', error);
    res.status(500).json({ error: 'Failed to create regulatory obligation' });
  }
});

// PUT /regulatory/:id — update obligation
complianceOnboardingRouter.put('/regulatory/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const {
      obligationType, title, description, authority,
      dueDate, frequency, noticePeriodDays, status, documentUrl,
    } = req.body;

    const updates: Record<string, any> = {};
    if (obligationType !== undefined) updates.obligationType = obligationType;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (authority !== undefined) updates.authority = authority;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (frequency !== undefined) updates.frequency = frequency;
    if (noticePeriodDays !== undefined) updates.noticePeriodDays = noticePeriodDays;
    if (status !== undefined) updates.status = status;
    if (documentUrl !== undefined) updates.documentUrl = documentUrl;

    const [updated] = await db
      .update(regulatoryObligations)
      .set(updates)
      .where(
        and(
          eq(regulatoryObligations.id, id),
          eq(regulatoryObligations.orgId, orgId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Regulatory obligation not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Regulatory] Error updating obligation:', error);
    res.status(500).json({ error: 'Failed to update regulatory obligation' });
  }
});

// DELETE /regulatory/:id — delete obligation
complianceOnboardingRouter.delete('/regulatory/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const [deleted] = await db
      .delete(regulatoryObligations)
      .where(
        and(
          eq(regulatoryObligations.id, id),
          eq(regulatoryObligations.orgId, orgId)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Regulatory obligation not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Regulatory] Error deleting obligation:', error);
    res.status(500).json({ error: 'Failed to delete regulatory obligation' });
  }
});

// POST /regulatory/:id/complete — mark complete with timestamp
complianceOnboardingRouter.post('/regulatory/:id/complete', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const [updated] = await db
      .update(regulatoryObligations)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(regulatoryObligations.id, id),
          eq(regulatoryObligations.orgId, orgId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Regulatory obligation not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Regulatory] Error completing obligation:', error);
    res.status(500).json({ error: 'Failed to complete regulatory obligation' });
  }
});

// POST /regulatory/seed/:dealId — seed default obligations by asset class
complianceOnboardingRouter.post('/regulatory/seed/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId } = req.params;

    // Fetch deal to determine asset class
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const assetClass = (deal as any).assetClass || 'general_cre';

    // Default obligations by asset class
    const baseObligations = [
      { obligationType: 'fire_inspection', title: 'Annual Fire Inspection', authority: 'Local Fire Marshal', frequency: 'annual' as const, noticePeriodDays: 30 },
      { obligationType: 'business_license', title: 'Business License Renewal', authority: 'City/County Clerk', frequency: 'annual' as const, noticePeriodDays: 60 },
      { obligationType: 'property_tax', title: 'Property Tax Filing', authority: 'County Tax Assessor', frequency: 'annual' as const, noticePeriodDays: 30 },
      { obligationType: 'building_inspection', title: 'Building Code Compliance Inspection', authority: 'Building Department', frequency: 'annual' as const, noticePeriodDays: 30 },
    ];

    const assetClassObligations: Record<string, Array<{ obligationType: string; title: string; authority: string; frequency: string; noticePeriodDays: number }>> = {
      marina: [
        { obligationType: 'dredging_permit', title: 'Dredging Permit Renewal', authority: 'Army Corps of Engineers', frequency: 'annual', noticePeriodDays: 90 },
        { obligationType: 'water_quality', title: 'Water Quality Testing', authority: 'State DEP', frequency: 'quarterly', noticePeriodDays: 14 },
        { obligationType: 'uscg_inspection', title: 'USCG Facility Inspection', authority: 'US Coast Guard', frequency: 'annual', noticePeriodDays: 30 },
      ],
      multifamily: [
        { obligationType: 'habitability_inspection', title: 'Habitability Inspection', authority: 'Housing Authority', frequency: 'annual', noticePeriodDays: 30 },
        { obligationType: 'rent_roll_filing', title: 'Rent Stabilization Filing', authority: 'Rent Board', frequency: 'annual', noticePeriodDays: 60 },
      ],
      hotel: [
        { obligationType: 'health_inspection', title: 'Health Department Inspection', authority: 'Health Department', frequency: 'annual', noticePeriodDays: 14 },
        { obligationType: 'liquor_license', title: 'Liquor License Renewal', authority: 'Alcohol Control Board', frequency: 'annual', noticePeriodDays: 90 },
        { obligationType: 'occupancy_tax', title: 'Transient Occupancy Tax Filing', authority: 'City Tax Authority', frequency: 'monthly', noticePeriodDays: 5 },
      ],
      self_storage: [
        { obligationType: 'lien_compliance', title: 'Lien Sale Compliance Review', authority: 'State Self-Storage Association', frequency: 'annual', noticePeriodDays: 30 },
      ],
      retail: [
        { obligationType: 'ada_compliance', title: 'ADA Compliance Inspection', authority: 'DOJ / Local Building Dept', frequency: 'annual', noticePeriodDays: 30 },
        { obligationType: 'signage_permit', title: 'Signage Permit Renewal', authority: 'City Planning', frequency: 'annual', noticePeriodDays: 30 },
      ],
      office: [
        { obligationType: 'elevator_inspection', title: 'Elevator Inspection', authority: 'State Labor Dept', frequency: 'annual', noticePeriodDays: 30 },
        { obligationType: 'hvac_inspection', title: 'HVAC System Inspection', authority: 'Mechanical Board', frequency: 'annual', noticePeriodDays: 14 },
      ],
    };

    const additionalObligations = assetClassObligations[assetClass] || [];
    const allObligations = [...baseObligations, ...additionalObligations];

    // Calculate due dates starting from one year from now
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    const values = allObligations.map((ob) => ({
      orgId,
      dealId,
      obligationType: ob.obligationType,
      title: ob.title,
      authority: ob.authority,
      frequency: ob.frequency,
      noticePeriodDays: ob.noticePeriodDays,
      dueDate: oneYearOut.toISOString().split('T')[0],
      status: 'upcoming',
    }));

    const created = await db
      .insert(regulatoryObligations)
      .values(values)
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error('[Regulatory] Error seeding obligations:', error);
    res.status(500).json({ error: 'Failed to seed regulatory obligations' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// J.2 — Onboarding / In-App Training
// ═══════════════════════════════════════════════════════════════════════

// GET /onboarding — get current user's onboarding state (create if not exists)
complianceOnboardingRouter.get('/onboarding', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    let [record] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1);

    if (!record) {
      [record] = await db
        .insert(userOnboarding)
        .values({
          userId,
          orgId,
          completedSteps: [],
          toursCompleted: [],
          tooltipsDismissed: [],
        })
        .returning();
    }

    res.json(record);
  } catch (error) {
    console.error('[Onboarding] Error fetching onboarding state:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding state' });
  }
});

// PUT /onboarding/step — mark step as completed
complianceOnboardingRouter.put('/onboarding/step', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { step } = req.body;
    if (!step) return res.status(400).json({ error: 'step is required' });

    const [record] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Onboarding record not found. GET /onboarding first.' });
    }

    const completedSteps = Array.isArray(record.completedSteps) ? record.completedSteps : [];
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
    }

    const [updated] = await db
      .update(userOnboarding)
      .set({
        completedSteps,
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[Onboarding] Error marking step complete:', error);
    res.status(500).json({ error: 'Failed to update onboarding step' });
  }
});

// PUT /onboarding/tour — mark tour as completed
complianceOnboardingRouter.put('/onboarding/tour', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { tour } = req.body;
    if (!tour) return res.status(400).json({ error: 'tour is required' });

    const [record] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Onboarding record not found. GET /onboarding first.' });
    }

    const toursCompleted = Array.isArray(record.toursCompleted) ? record.toursCompleted : [];
    if (!toursCompleted.includes(tour)) {
      toursCompleted.push(tour);
    }

    const [updated] = await db
      .update(userOnboarding)
      .set({
        toursCompleted,
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[Onboarding] Error marking tour complete:', error);
    res.status(500).json({ error: 'Failed to update onboarding tour' });
  }
});

// PUT /onboarding/tooltip — dismiss tooltip
complianceOnboardingRouter.put('/onboarding/tooltip', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { tooltip } = req.body;
    if (!tooltip) return res.status(400).json({ error: 'tooltip is required' });

    const [record] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Onboarding record not found. GET /onboarding first.' });
    }

    const tooltipsDismissed = Array.isArray(record.tooltipsDismissed) ? record.tooltipsDismissed : [];
    if (!tooltipsDismissed.includes(tooltip)) {
      tooltipsDismissed.push(tooltip);
    }

    const [updated] = await db
      .update(userOnboarding)
      .set({
        tooltipsDismissed,
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[Onboarding] Error dismissing tooltip:', error);
    res.status(500).json({ error: 'Failed to dismiss tooltip' });
  }
});

// POST /onboarding/complete — mark onboarding as complete
complianceOnboardingRouter.post('/onboarding/complete', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const [updated] = await db
      .update(userOnboarding)
      .set({
        isOnboardingComplete: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Onboarding record not found. GET /onboarding first.' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[Onboarding] Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// GET /onboarding/checklist — return checklist items with completion status
complianceOnboardingRouter.get('/onboarding/checklist', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const [record] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1);

    const completedSteps = Array.isArray(record?.completedSteps) ? record.completedSteps : [];

    const checklistItems = [
      { key: 'welcome', label: 'Welcome & Account Setup', description: 'Complete your profile and organization settings' },
      { key: 'first_deal', label: 'Create Your First Deal', description: 'Add a deal to your pipeline' },
      { key: 'first_contact', label: 'Add a Contact', description: 'Import or create your first contact' },
      { key: 'upload_document', label: 'Upload a Document', description: 'Upload a file to the document vault' },
      { key: 'financial_model', label: 'Build a Financial Model', description: 'Create your first underwriting model' },
      { key: 'invite_team', label: 'Invite Team Members', description: 'Add colleagues to your organization' },
      { key: 'connect_integration', label: 'Connect an Integration', description: 'Set up a marina PMS or other integration' },
      { key: 'run_report', label: 'Run a Report', description: 'Generate your first analytics report' },
    ];

    const checklist = checklistItems.map((item) => ({
      ...item,
      completed: completedSteps.includes(item.key),
    }));

    res.json({
      checklist,
      completedCount: checklist.filter((c) => c.completed).length,
      totalCount: checklist.length,
      isOnboardingComplete: record?.isOnboardingComplete ?? false,
    });
  } catch (error) {
    console.error('[Onboarding] Error fetching checklist:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding checklist' });
  }
});
