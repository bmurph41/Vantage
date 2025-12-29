import type { LlmClassifier, ClassificationRequest, ClassificationResult, BatchClassificationResult } from './types';

const KEYWORD_PATTERNS: Array<{
  pattern: RegExp;
  department: string;
  section: 'revenue' | 'cogs' | 'expense' | 'payroll' | 'other';
  canonicalKey: string;
}> = [
  { pattern: /slip|dock|berth|mooring/i, department: 'Marina', section: 'revenue', canonicalKey: 'revenue.wet_slip' },
  { pattern: /dry\s*storage|rack|indoor/i, department: 'Marina', section: 'revenue', canonicalKey: 'revenue.dry_storage' },
  { pattern: /fuel|gas|diesel|petrol/i, department: 'Fuel', section: 'revenue', canonicalKey: 'revenue.fuel_sales' },
  { pattern: /ship\s*store|retail|merchandise|chandlery/i, department: 'Retail', section: 'revenue', canonicalKey: 'revenue.ship_store' },
  { pattern: /repair|service|labor|mechanic/i, department: 'Service', section: 'revenue', canonicalKey: 'revenue.boat_repairs' },
  { pattern: /launch|haul|lift|crane/i, department: 'Marina', section: 'revenue', canonicalKey: 'revenue.launch_haul' },
  { pattern: /transient|visitor|guest/i, department: 'Marina', section: 'revenue', canonicalKey: 'revenue.transient' },
  { pattern: /cost\s*of\s*(fuel|gas|diesel)/i, department: 'Fuel', section: 'cogs', canonicalKey: 'cogs.fuel' },
  { pattern: /cost\s*of\s*(goods|merchandise|inventory)/i, department: 'Retail', section: 'cogs', canonicalKey: 'cogs.ship_store' },
  { pattern: /parts|supplies|materials/i, department: 'Service', section: 'cogs', canonicalKey: 'cogs.parts' },
  { pattern: /insurance/i, department: 'General', section: 'expense', canonicalKey: 'expense.insurance' },
  { pattern: /property\s*tax|real\s*estate\s*tax/i, department: 'General', section: 'expense', canonicalKey: 'expense.property_taxes' },
  { pattern: /utilities|electric|water|sewer/i, department: 'General', section: 'expense', canonicalKey: 'expense.utilities' },
  { pattern: /repair|maintenance|r\s*&\s*m/i, department: 'General', section: 'expense', canonicalKey: 'expense.repairs' },
  { pattern: /market|advertis|promot/i, department: 'General', section: 'expense', canonicalKey: 'expense.marketing' },
  { pattern: /legal|accounting|professional/i, department: 'General', section: 'expense', canonicalKey: 'expense.professional' },
  { pattern: /office|admin|supplies/i, department: 'General', section: 'expense', canonicalKey: 'expense.office' },
  { pattern: /wage|salary|compensation/i, department: 'General', section: 'payroll', canonicalKey: 'payroll.wages' },
  { pattern: /payroll\s*tax|fica|suta|futa/i, department: 'General', section: 'payroll', canonicalKey: 'payroll.taxes' },
  { pattern: /benefit|health|401k|retirement/i, department: 'General', section: 'payroll', canonicalKey: 'payroll.benefits' },
];

export class MockLlmClassifier implements LlmClassifier {
  name = 'mock';

  async classify(request: ClassificationRequest): Promise<ClassificationResult> {
    const label = request.normalizedLabel || request.label;

    for (const rule of KEYWORD_PATTERNS) {
      if (rule.pattern.test(label)) {
        return {
          canonicalKey: rule.canonicalKey,
          department: rule.department,
          section: rule.section,
          confidence: 0.65,
          reasoning: `Mock classifier: matched pattern "${rule.pattern.source}"`,
        };
      }
    }

    return {
      department: 'General',
      section: 'other',
      confidence: 0.3,
      reasoning: 'Mock classifier: no pattern matched, defaulting to General/other',
    };
  }

  async classifyBatch(requests: ClassificationRequest[]): Promise<BatchClassificationResult> {
    const results = new Map<string, ClassificationResult>();

    for (const req of requests) {
      const key = req.normalizedLabel || req.label;
      results.set(key, await this.classify(req));
    }

    return {
      results,
      tokensUsed: 0,
      processingTime: requests.length * 2,
    };
  }
}
