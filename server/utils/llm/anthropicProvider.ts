import type { LlmClassifier, ClassificationRequest, ClassificationResult, BatchClassificationResult } from './types';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a financial line item classifier for marina businesses. Given a P&L line item label, classify it into the correct department, section, and canonical key.

DEPARTMENTS (use these exact names):
- Storage: Wet slips, dry storage, dockage, berths, moorings, land storage, winter storage, transient dockage, rack storage
- Fuel: Fuel sales, gas dock revenue, diesel sales, fuel cost of goods
- Ship's Store: Ship store sales, chandlery, merchandise, retail, marine supplies
- Service: Boat repairs, mechanical work, service labor, parts, bottom paint, shrink wrap, hauling/launch labor
- Boat Sales: New boat sales, used boat sales, boat purchases (COGS), trade-ins, warranties, boat sales commissions, trailer sales
- Boat Brokerage: Brokerage commissions, broker fees, finance commissions
- Payroll: Wages, salaries, payroll taxes (FICA, FUTA, SUI), workers comp, health benefits, 401k, disability, family leave, Medicare, Social Security
- Marina & Amenities: Launch/haul services, electric/power income, pump-out, ice, laundry, pool, amenity fees, dockside services
- General: Insurance, property taxes, utilities (electric, water, gas for heating), rent/lease, office expenses, professional fees (legal, accounting), marketing, advertising, repairs & maintenance, depreciation, interest, bank charges

SECTIONS:
- revenue: Income from marina operations
- cogs: Cost of goods sold (fuel cost, merchandise cost, boat purchase cost, parts cost)
- expense: Operating expenses (insurance, taxes, utilities, repairs, marketing, professional fees, office)
- payroll: Wages, salaries, payroll taxes, employee benefits

IMPORTANT CLASSIFICATION RULES:
1. "Gas" in a revenue or COGS context = Fuel department. "Gas" in an expense context (utilities) = General department.
2. "Commission" in revenue/COGS context (boat sales commissions, salesmen commissions) = Boat Sales. "Finance commission" = Boat Brokerage.
3. All payroll-related items (wages, salaries, taxes, benefits) go to Payroll department AND payroll section.
4. Storage items include: slips, docks, berths, moorings, dry storage, rack storage, land storage, winter storage.
5. Service includes: repairs, mechanical work, bottom painting, shrink wrap, winterizing, parts (when in COGS).
6. Boat Sales includes: new/used boat sales (revenue), boat purchases/cost (COGS), trade-ins, warranties, trailer sales.

Respond in JSON format only:
{
  "canonicalKey": "section.category" (e.g., "revenue.wet_slip", "expense.insurance", "payroll.wages"),
  "department": "Storage|Fuel|Ship's Store|Service|Boat Sales|Boat Brokerage|Payroll|Marina & Amenities|General",
  "section": "revenue|cogs|expense|payroll|other",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export class AnthropicClassifier implements LlmClassifier {
  name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-3-haiku-20240307';
  }

  async classify(request: ClassificationRequest): Promise<ClassificationResult> {
    try {
      const sectionHint = request.context?.sectionHint ? `\nSection context: This item appears under "${request.context.sectionHint}"` : '';
      const userPrompt = `Classify this P&L line item: "${request.label}"
${request.context?.vendorHint ? `Source: ${request.context.vendorHint}` : ''}
${request.context?.nearbyLabels?.length ? `Nearby items: ${request.context.nearbyLabels.slice(0, 5).join(', ')}` : ''}${sectionHint}

Respond with JSON only.`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 200,
        system: SYSTEM_PROMPT,
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
      return {
        canonicalKey: parsed.canonicalKey,
        department: parsed.department ?? 'General',
        section: parsed.section ?? 'other',
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
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
