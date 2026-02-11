import type { LlmClassifier, ClassificationRequest, ClassificationResult, BatchClassificationResult } from './types';

const KEYWORD_PATTERNS: Array<{
  pattern: RegExp;
  department: string;
  section: 'revenue' | 'cogs' | 'expense' | 'payroll' | 'other';
  canonicalKey: string;
}> = [
  { pattern: /slip|berth|mooring|dockage/i, department: 'Storage', section: 'revenue', canonicalKey: 'revenue.wet_slip' },
  { pattern: /dry\s*storage|rack|indoor\s*storage|land\s*storage|winter\s*storage/i, department: 'Storage', section: 'revenue', canonicalKey: 'revenue.dry_storage' },
  { pattern: /transient/i, department: 'Storage', section: 'revenue', canonicalKey: 'revenue.transient' },
  { pattern: /fuel|gas\s*dock|diesel/i, department: 'Fuel', section: 'revenue', canonicalKey: 'revenue.fuel_sales' },
  { pattern: /cost\s*of\s*(fuel|gas|diesel)/i, department: 'Fuel', section: 'cogs', canonicalKey: 'cogs.fuel' },
  { pattern: /ship\s*store|retail|merchandise|chandlery|marine\s*supply/i, department: "Ship's Store", section: 'revenue', canonicalKey: 'revenue.ship_store' },
  { pattern: /cost\s*of\s*(goods|merchandise|inventory)/i, department: "Ship's Store", section: 'cogs', canonicalKey: 'cogs.ship_store' },
  { pattern: /new\s*boat|used\s*boat|boat\s*sale/i, department: 'Boat Sales', section: 'revenue', canonicalKey: 'revenue.boat_sales' },
  { pattern: /boat\s*purchase|cogs.*boat|trade.?in|trailer\s*sale/i, department: 'Boat Sales', section: 'cogs', canonicalKey: 'cogs.boat_sales' },
  { pattern: /warrant/i, department: 'Boat Sales', section: 'revenue', canonicalKey: 'revenue.warranty' },
  { pattern: /brokerage|broker\s*fee|finance\s*commission/i, department: 'Boat Brokerage', section: 'revenue', canonicalKey: 'revenue.brokerage' },
  { pattern: /repair|service|mechanic|bottom\s*paint|shrink\s*wrap|winteriz/i, department: 'Service', section: 'revenue', canonicalKey: 'revenue.boat_repairs' },
  { pattern: /parts|subcontract/i, department: 'Service', section: 'cogs', canonicalKey: 'cogs.parts' },
  { pattern: /launch|haul|lift|crane|pump.?out|amenity|dockside/i, department: 'Marina & Amenities', section: 'revenue', canonicalKey: 'revenue.launch_haul' },
  { pattern: /wage|salary|salari|compensation/i, department: 'Payroll', section: 'payroll', canonicalKey: 'payroll.wages' },
  { pattern: /payroll\s*tax|fica|suta|futa|sui|soc\s*sec|medicare/i, department: 'Payroll', section: 'payroll', canonicalKey: 'payroll.taxes' },
  { pattern: /benefit|health|401k|retirement|workers\s*comp|disability|family\s*leave|medical\s*insurance/i, department: 'Payroll', section: 'payroll', canonicalKey: 'payroll.benefits' },
  { pattern: /insurance/i, department: 'General', section: 'expense', canonicalKey: 'expense.insurance' },
  { pattern: /property\s*tax|real\s*estate\s*tax/i, department: 'General', section: 'expense', canonicalKey: 'expense.property_taxes' },
  { pattern: /utilit|electric|water|sewer/i, department: 'General', section: 'expense', canonicalKey: 'expense.utilities' },
  { pattern: /repair|maintenance|r\s*&\s*m/i, department: 'General', section: 'expense', canonicalKey: 'expense.repairs' },
  { pattern: /market|advertis|promot/i, department: 'General', section: 'expense', canonicalKey: 'expense.marketing' },
  { pattern: /legal|accounting|professional/i, department: 'General', section: 'expense', canonicalKey: 'expense.professional' },
  { pattern: /office|admin/i, department: 'General', section: 'expense', canonicalKey: 'expense.office' },
  { pattern: /depreci|amortiz/i, department: 'General', section: 'expense', canonicalKey: 'expense.depreciation' },
  { pattern: /interest|bank\s*charge/i, department: 'General', section: 'expense', canonicalKey: 'expense.interest' },
  { pattern: /rent|lease/i, department: 'General', section: 'expense', canonicalKey: 'expense.rent' },
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
