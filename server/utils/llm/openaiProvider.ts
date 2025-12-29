import type { LlmClassifier, ClassificationRequest, ClassificationResult, BatchClassificationResult } from './types';
import OpenAI from 'openai';

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

Respond in JSON format:
{
  "canonicalKey": "section.category" (e.g., "revenue.wet_slip", "expense.insurance"),
  "department": "Marina|Fuel|Retail|Service|General",
  "section": "revenue|cogs|expense|payroll|other",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export class OpenAiClassifier implements LlmClassifier {
  name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model ?? 'gpt-4o-mini';
  }

  async classify(request: ClassificationRequest): Promise<ClassificationResult> {
    try {
      const userPrompt = `Classify this P&L line item: "${request.label}"
${request.context?.vendorHint ? `Source: ${request.context.vendorHint}` : ''}
${request.context?.nearbyLabels?.length ? `Nearby items: ${request.context.nearbyLabels.slice(0, 3).join(', ')}` : ''}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.fallback(request, 'Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      return {
        canonicalKey: parsed.canonicalKey,
        department: parsed.department ?? 'General',
        section: parsed.section ?? 'other',
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        reasoning: parsed.reasoning,
      };
    } catch (error: any) {
      console.error('[OpenAiClassifier] Error:', error.message);
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
      reasoning: `OpenAI fallback: ${reason}`,
    };
  }
}
