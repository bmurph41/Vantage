import type { LlmClassifier, ClassificationRequest, ClassificationResult, BatchClassificationResult } from './types';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a financial line item classifier for marina businesses. Given a P&L line item label, classify it into the appropriate category.

Marina-specific departments:
- Marina: Slip rentals, dockage, dry storage, launch/haul, transient dockage
- Fuel: Fuel sales and fuel cost of goods
- Retail: Ship store, chandlery, merchandise
- Service: Boat repairs, mechanical work, labor, parts

Standard sections:
- revenue: Income from operations
- cogs: Cost of goods sold (fuel cost, merchandise cost, parts)
- expense: Operating expenses (insurance, taxes, utilities, repairs, marketing, professional fees)
- payroll: Wages, salaries, payroll taxes, benefits

Respond in JSON format only:
{
  "canonicalKey": "section.category" (e.g., "revenue.wet_slip", "expense.insurance"),
  "department": "Marina|Fuel|Retail|Service|General",
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
      const userPrompt = `Classify this P&L line item: "${request.label}"
${request.context?.vendorHint ? `Source: ${request.context.vendorHint}` : ''}
${request.context?.nearbyLabels?.length ? `Nearby items: ${request.context.nearbyLabels.slice(0, 3).join(', ')}` : ''}

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
