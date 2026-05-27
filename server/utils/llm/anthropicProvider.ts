import type { LlmClassifier, ClassificationRequest, ClassificationResult, BatchClassificationResult } from './types';
import Anthropic from '@anthropic-ai/sdk';
import { formatKeyBankForPrompt } from '../../services/pnl/key-bank';

// =============================================================================
// CLOSED-VOCABULARY CLASSIFIER PROMPT (B3 step 2)
//
// The classifier picks one canonical key from the supplied enumerated list, or
// returns the [CATCH-ALL: <reason>] sentinel so the row routes to needs_review.
// Free-invention of new keys is disallowed; the downstream lookup in mapping.ts
// uses exact-match against canonicalById and defaults to review on miss.
//
// Routing rules are ORDERED (1..N) — first-match wins. The bank itself is
// ordered subtypes-before-aggregates, so the classifier prefers a granular key
// when present and only falls to the [CATCH-ALL] aggregate when nothing fits.
// =============================================================================

const SYSTEM_PROMPT_PREFIX = `You are a financial line-item classifier for a commercial real estate underwriting platform.

Your job: given ONE P&L line-item label and its structural context, return ONE canonical key from the enumerated list below, OR return the catch-all sentinel so a human can review.

NEVER invent a canonicalKey. NEVER return a key that is not in the enumerated list. If no key fits with high confidence, return:
{
  "canonicalKey": "[REVIEW]",
  "reasoning": "<one short sentence on why no key fits>",
  "confidence": 0.0
}

ORDERED ROUTING RULES (first-match wins):
1. If the label matches a key's alias literally (case-insensitive), pick that key.
2. If the label is a clear synonym of a subtype key (e.g. "Bottom Painting" → annualBottomPaintRevenue), pick the subtype, NOT the [CATCH-ALL] aggregate.
3. Income tax labels — "Income Tax", "State Income Tax", "Federal Income Tax", "NYS Corp Tax", "PTET", "Pass-Through Entity Tax" — go to annualIncomeTax (section=non_operating). NEVER to annualPayrollTaxesExpense.
4. Payroll-tax labels — FUTA, SUI, FICA, Medicare, Social Security tax, Workers Comp — go to annualPayrollTaxesExpense (section=payroll). NEVER to annualIncomeTax.
5. Boat-sales lines (new/used boat sales, brokerage commissions, finance commission, warranty, boat-sales COGS) go to BUSINESS_INCOME section. NEVER to property revenue.
6. "Sales Tax" — return canonicalKey="[REVIEW]". Sales tax is a pass-through liability, not an underwriting expense.
7. "Ask My Accountant", "Suspense", "Opening Balance", "Uncategorized" — return canonicalKey="[REVIEW]".
8. The structural section hint (revenue / cogs / expense / payroll) is AUTHORITATIVE. If you would pick a key whose section disagrees with the structural hint, return "[REVIEW]" instead and explain the conflict in reasoning. Example: a line in a COGS block must NEVER resolve to a revenue.* key.
9. "Gas" in a revenue/COGS context = annualFuelRevenue or annualFuelCOGS. "Gas" in an expense (utilities) context = annualUtilities. Use the section hint to disambiguate.

OUTPUT STRICT JSON ONLY:
{
  "canonicalKey": "<exact key from enumerated list>" or "[REVIEW]",
  "section": "revenue|cogs|expense|payroll|non_operating|business_income|other",
  "department": "<the bracketed department for the picked key>",
  "confidence": 0.0-1.0,
  "reasoning": "<one short sentence>"
}

DO NOT include any text outside the JSON object. DO NOT wrap the JSON in markdown.`;

function buildSystemPrompt(assetClass?: string): string {
  const bank = formatKeyBankForPrompt(assetClass);
  const assetLabel = assetClass ? assetClass.toLowerCase() : 'generic';
  return `${SYSTEM_PROMPT_PREFIX}

ENUMERATED KEYS (asset class: ${assetLabel}). Pick exactly one canonicalKey from this list, or "[REVIEW]". Order = preference (subtypes first, then aggregates/catch-alls).

${bank}`;
}

export class AnthropicClassifier implements LlmClassifier {
  name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-haiku-4-5-20251001';
  }

  async classify(request: ClassificationRequest): Promise<ClassificationResult> {
    try {
      const sectionHint = request.context?.sectionHint
        ? `\nStructural section (AUTHORITATIVE — see rule 8): "${request.context.sectionHint}"`
        : '';
      const userPrompt = `Classify this P&L line item: "${request.label}"
${request.context?.vendorHint ? `Source: ${request.context.vendorHint}` : ''}
${request.context?.nearbyLabels?.length ? `Nearby items: ${request.context.nearbyLabels.slice(0, 5).join(', ')}` : ''}${sectionHint}

Respond with JSON only. canonicalKey MUST be exactly one of the enumerated keys above, or "[REVIEW]".`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        system: buildSystemPrompt(request.context?.assetClass),
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text' || !content.text) {
        return this.fallback(request, 'Empty response from Anthropic');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallback(request, 'No JSON in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      // [REVIEW] sentinel = no canonical match; force review downstream.
      const isReviewSentinel = parsed.canonicalKey === '[REVIEW]' || parsed.canonicalKey === '[CATCH-ALL]';
      return {
        canonicalKey: isReviewSentinel ? undefined : parsed.canonicalKey,
        department: parsed.department ?? 'General',
        section: parsed.section ?? 'other',
        confidence: isReviewSentinel ? 0 : Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        reasoning: parsed.reasoning,
      };
    } catch (error: any) {
      console.error('[AnthropicClassifier] Error:', error.message);
      return this.fallback(request, error.message);
    }
  }

  async classifyBatch(requests: ClassificationRequest[]): Promise<BatchClassificationResult> {
    const results = new Map<string, ClassificationResult>();
    const startTime = Date.now();
    let tokensUsed = 0;

    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const promises = batch.map(req => this.classify(req));
      const batchResults = await Promise.all(promises);

      for (let j = 0; j < batch.length; j++) {
        const key = batch[j].normalizedLabel || batch[j].label;
        results.set(key, batchResults[j]);
      }
    }

    return {
      results,
      tokensUsed,
      processingTime: Date.now() - startTime,
    };
  }

  private fallback(request: ClassificationRequest, reason: string): ClassificationResult {
    return {
      department: 'General',
      section: 'other',
      confidence: 0.1,
      reasoning: `Anthropic fallback: ${reason}`,
    };
  }
}
