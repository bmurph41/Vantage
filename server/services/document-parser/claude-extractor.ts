import Anthropic from '@anthropic-ai/sdk';
import type { PLExtractionSchema, RentRollExtractionSchema, ExtractionResult } from '../../../shared/extraction-schemas.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractPL(
  fullText: string,
  tables: string,
  filename: string
): Promise<ExtractionResult<PLExtractionSchema>> {
  const systemPrompt = `You are an expert commercial real estate financial analyst and document parser.
Your task is to extract structured P&L (income statement) data from the provided document text.

CRITICAL RULES:
1. Extract ONLY values explicitly present in the document. Never infer or estimate.
2. For every field you extract, provide a confidence score (0.0–1.0) and a source snippet.
3. Confidence scoring:
   - 1.0: Exact label match, clearly numeric, single occurrence
   - 0.85: Strong match but label slightly differs (e.g. "Mgmt Fee" → management_fees)
   - 0.7: Inferred from context (e.g. NOI = EGI - OpEx when not explicitly stated)
   - 0.5: Ambiguous — multiple possible values or label unclear
   - 0.3: Low confidence — guessed from surrounding context
4. All monetary values in USD. Negative values (losses) stored as POSITIVE numbers.
5. Parentheses = negative: "(50,000)" → store as 50000
6. Detect the reporting period. TTM = trailing twelve months. T12 = same.
7. If monthly breakdown is present (T-12 format), extract all 12 months.
8. If a field is not present, set it to null — do NOT fabricate values.
9. "Total Revenue" / "EGI" / "Gross Revenue" → effective_gross_income
10. NOI is typically the bottom line before debt service.

Return ONLY valid JSON. No markdown, no explanation.`;

  const userPrompt = `Filename: ${filename}

DOCUMENT TEXT:
${fullText.slice(0, 50000)}${fullText.length > 50000 ? '\n[TEXT TRUNCATED — first 50K chars shown]' : ''}

DETECTED TABLES (formatted):
${tables.slice(0, 10000)}

Extract into this exact JSON structure:
{
  "data": {
    "property_name": null,
    "property_address": null,
    "reporting_period": null,
    "period_start": null,
    "period_end": null,
    "gross_potential_rent": null,
    "vacancy_loss": null,
    "concessions": null,
    "bad_debt": null,
    "effective_gross_income": null,
    "parking_income": null,
    "laundry_income": null,
    "late_fees": null,
    "pet_fees": null,
    "storage_income": null,
    "utility_reimbursements": null,
    "other_income_line_items": [],
    "total_other_income": null,
    "total_revenue": null,
    "management_fees": null,
    "payroll": null,
    "repairs_maintenance": null,
    "contract_services": null,
    "utilities": null,
    "insurance": null,
    "real_estate_taxes": null,
    "landscaping": null,
    "administrative": null,
    "advertising_marketing": null,
    "reserves": null,
    "other_expense_line_items": [],
    "total_operating_expenses": null,
    "net_operating_income": null,
    "mortgage_payment": null,
    "interest_expense": null,
    "principal_payment": null,
    "net_cash_flow": null,
    "monthly_breakdown": []
  },
  "confidence_scores": { "field_key": 0.95 },
  "source_references": {
    "field_key": { "page": 1, "snippet": "verbatim text from document" }
  },
  "extraction_notes": [],
  "document_class_confirmed": "pl"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseClaudeJSON(text, 'P&L extraction');
}

export async function extractRentRoll(
  fullText: string,
  tables: string,
  filename: string
): Promise<ExtractionResult<RentRollExtractionSchema>> {
  const systemPrompt = `You are an expert commercial real estate analyst specializing in rent roll analysis.
Extract structured unit-level rent roll data from the provided document.

CRITICAL RULES:
1. Extract EVERY unit row. Do not skip units.
2. Common column mappings:
   - "Unit"/"Unit #"/"#" → unit_number
   - "Tenant"/"Resident"/"Name" → tenant_name
   - "BD"/"Bed"/"BR" → bedrooms; "BA"/"Bath" → bathrooms
   - "SQFT"/"SF"/"Sq Ft" → sqft
   - "Market Rent"/"Mkt Rent"/"Potential Rent" → market_rent
   - "Actual Rent"/"Contract Rent"/"Lease Rent" → contract_rent
   - "Lease Start"/"Move In" → lease_start (ISO date)
   - "Lease End"/"Exp" → lease_end (ISO date)
3. Status: 'occupied', 'vacant', 'notice', 'model', 'down', 'unknown'
4. "VACANT" or empty tenant name → status = 'vacant'
5. "MTM" = month-to-month → lease_end = null
6. Calculate unit_mix summary after extracting all units.
7. Return ONLY valid JSON. No markdown.`;

  const userPrompt = `Filename: ${filename}

DOCUMENT TEXT:
${fullText.slice(0, 60000)}${fullText.length > 60000 ? '\n[TEXT TRUNCATED]' : ''}

TABLES:
${tables.slice(0, 15000)}

Extract into this exact JSON:
{
  "data": {
    "property_name": null,
    "property_address": null,
    "roll_date": null,
    "total_units": null,
    "total_sqft": null,
    "occupancy_rate": null,
    "occupied_units": null,
    "vacant_units": null,
    "total_potential_rent": null,
    "total_actual_rent": null,
    "units": [
      {
        "unit_number": "101",
        "unit_type": "2BR/1BA",
        "sqft": 850,
        "bedrooms": 2,
        "bathrooms": 1,
        "status": "occupied",
        "tenant_name": "Smith, J",
        "lease_start": "2023-06-01",
        "lease_end": "2024-05-31",
        "market_rent": 1500,
        "contract_rent": 1450
      }
    ],
    "unit_mix": []
  },
  "confidence_scores": { "units": 0.9, "market_rent": 0.85 },
  "source_references": { "units": { "sheet": "Rent Roll", "row": 5, "snippet": "..." } },
  "extraction_notes": [],
  "document_class_confirmed": "rent_roll"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseClaudeJSON(text, 'Rent Roll extraction');
}

export async function classifyDocument(
  firstPageText: string,
  filename: string
): Promise<{ class: 'pl' | 'rent_roll' | 't12' | 'om' | 'unknown'; confidence: number }> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Classify this CRE document. Filename: "${filename}". First page text: "${firstPageText.slice(0, 2000)}".
        
Reply ONLY with JSON: {"class": "pl"|"rent_roll"|"t12"|"om"|"unknown", "confidence": 0.0-1.0}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return parseClaudeJSON(text, 'classification');
  } catch {
    return { class: 'unknown', confidence: 0 };
  }
}

function parseClaudeJSON(text: string, context: string): any {
  try {
    const clean = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(clean);
  } catch {
    throw new Error(`Claude returned invalid JSON for ${context}: ${text.slice(0, 300)}`);
  }
}
