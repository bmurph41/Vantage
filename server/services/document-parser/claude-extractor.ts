import Anthropic from '@anthropic-ai/sdk';
import type { PLExtractionSchema, RentRollExtractionSchema, ExtractionResult } from '../../../shared/extraction-schemas.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tool schemas ──────────────────────────────────────────────────────────
// Claude's tool-use API forces the model to emit JSON that matches the given
// input_schema exactly. Eliminates the parseClaudeJSON fragility and guarantees
// the envelope shape (data, confidence_scores, source_references, etc.).

const SOURCE_REF_SCHEMA = {
  type: 'object',
  properties: {
    page: { type: ['integer', 'null'] },
    sheet: { type: ['string', 'null'] },
    row: { type: ['integer', 'null'] },
    snippet: { type: ['string', 'null'] },
  },
  additionalProperties: false,
} as const;

const PL_TOOL = {
  name: 'emit_pl_extraction',
  description: 'Emit the extracted P&L / income statement data. Populate every field that is present in the document. Set absent fields to null — never fabricate values.',
  input_schema: {
    type: 'object',
    required: ['data', 'confidence_scores', 'source_references', 'extraction_notes', 'document_class_confirmed'],
    properties: {
      data: {
        type: 'object',
        properties: {
          property_name: { type: ['string', 'null'] },
          property_address: { type: ['string', 'null'] },
          reporting_period: { type: ['string', 'null'] },
          period_start: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD' },
          period_end: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD' },
          currency: { type: ['string', 'null'] },
          reporting_basis: { type: ['string', 'null'], enum: ['cash', 'accrual', null] },
          gross_potential_rent: { type: ['number', 'null'] },
          vacancy_loss: { type: ['number', 'null'] },
          concessions: { type: ['number', 'null'] },
          bad_debt: { type: ['number', 'null'] },
          effective_gross_income: { type: ['number', 'null'] },
          parking_income: { type: ['number', 'null'] },
          laundry_income: { type: ['number', 'null'] },
          late_fees: { type: ['number', 'null'] },
          pet_fees: { type: ['number', 'null'] },
          storage_income: { type: ['number', 'null'] },
          utility_reimbursements: { type: ['number', 'null'] },
          other_income_line_items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'amount'],
              properties: {
                label: { type: 'string' },
                amount: { type: 'number' },
              },
              additionalProperties: false,
            },
          },
          total_other_income: { type: ['number', 'null'] },
          total_revenue: { type: ['number', 'null'] },
          management_fees: { type: ['number', 'null'] },
          payroll: { type: ['number', 'null'] },
          repairs_maintenance: { type: ['number', 'null'] },
          contract_services: { type: ['number', 'null'] },
          utilities: { type: ['number', 'null'] },
          insurance: { type: ['number', 'null'] },
          real_estate_taxes: { type: ['number', 'null'] },
          landscaping: { type: ['number', 'null'] },
          administrative: { type: ['number', 'null'] },
          advertising_marketing: { type: ['number', 'null'] },
          reserves: { type: ['number', 'null'] },
          other_expense_line_items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'amount'],
              properties: {
                label: { type: 'string' },
                amount: { type: 'number' },
              },
              additionalProperties: false,
            },
          },
          total_operating_expenses: { type: ['number', 'null'] },
          net_operating_income: { type: ['number', 'null'] },
          mortgage_payment: { type: ['number', 'null'] },
          interest_expense: { type: ['number', 'null'] },
          principal_payment: { type: ['number', 'null'] },
          net_cash_flow: { type: ['number', 'null'] },
          monthly_breakdown: {
            type: 'array',
            items: {
              type: 'object',
              required: ['period'],
              properties: {
                period: { type: 'string' },
                effective_gross_income: { type: ['number', 'null'] },
                total_operating_expenses: { type: ['number', 'null'] },
                net_operating_income: { type: ['number', 'null'] },
              },
              additionalProperties: false,
            },
          },
        },
      },
      confidence_scores: {
        type: 'object',
        description: 'Per-field confidence 0.0-1.0. Keys are field_key from data object.',
        additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
      },
      source_references: {
        type: 'object',
        description: 'Per-field source location. Keys are field_key from data object.',
        additionalProperties: SOURCE_REF_SCHEMA,
      },
      extraction_notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Free-form notes about ambiguities, unusual labels, or decisions made.',
      },
      document_class_confirmed: {
        type: 'string',
        enum: ['pl', 't12'],
      },
    },
    additionalProperties: false,
  },
} as const;

const RENT_ROLL_TOOL = {
  name: 'emit_rent_roll_extraction',
  description: 'Emit the extracted unit-level rent roll data. Extract EVERY unit row — do not skip units. Set absent fields to null — never fabricate values.',
  input_schema: {
    type: 'object',
    required: ['data', 'confidence_scores', 'source_references', 'extraction_notes', 'document_class_confirmed'],
    properties: {
      data: {
        type: 'object',
        required: ['units'],
        properties: {
          property_name: { type: ['string', 'null'] },
          property_address: { type: ['string', 'null'] },
          roll_date: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD' },
          total_units: { type: ['integer', 'null'] },
          total_sqft: { type: ['integer', 'null'] },
          occupancy_rate: { type: ['number', 'null'], description: 'Decimal 0.0-1.0' },
          occupied_units: { type: ['integer', 'null'] },
          vacant_units: { type: ['integer', 'null'] },
          total_potential_rent: { type: ['number', 'null'] },
          total_actual_rent: { type: ['number', 'null'] },
          units: {
            type: 'array',
            items: {
              type: 'object',
              required: ['unit_number', 'status'],
              properties: {
                unit_number: { type: 'string' },
                unit_type: { type: ['string', 'null'] },
                sqft: { type: ['integer', 'null'] },
                bedrooms: { type: ['integer', 'null'] },
                bathrooms: { type: ['number', 'null'] },
                status: { type: 'string', enum: ['occupied', 'vacant', 'notice', 'model', 'down', 'unknown'] },
                tenant_name: { type: ['string', 'null'] },
                lease_start: { type: ['string', 'null'] },
                lease_end: { type: ['string', 'null'] },
                lease_term_months: { type: ['integer', 'null'] },
                market_rent: { type: ['number', 'null'] },
                contract_rent: { type: ['number', 'null'] },
                actual_rent_collected: { type: ['number', 'null'] },
                rent_per_sqft: { type: ['number', 'null'] },
                deposits: { type: ['number', 'null'] },
                balance_owed: { type: ['number', 'null'] },
                move_in_date: { type: ['string', 'null'] },
                move_out_date: { type: ['string', 'null'] },
                notes: { type: ['string', 'null'] },
              },
              additionalProperties: false,
            },
          },
          unit_mix: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'count'],
              properties: {
                type: { type: 'string' },
                count: { type: 'integer' },
                avg_sqft: { type: ['number', 'null'] },
                avg_market_rent: { type: ['number', 'null'] },
                avg_contract_rent: { type: ['number', 'null'] },
                occupancy_rate: { type: ['number', 'null'] },
              },
              additionalProperties: false,
            },
          },
        },
      },
      confidence_scores: {
        type: 'object',
        additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
      },
      source_references: {
        type: 'object',
        additionalProperties: SOURCE_REF_SCHEMA,
      },
      extraction_notes: {
        type: 'array',
        items: { type: 'string' },
      },
      document_class_confirmed: {
        type: 'string',
        enum: ['rent_roll'],
      },
    },
    additionalProperties: false,
  },
} as const;

const PL_SYSTEM = `You are an expert commercial real estate financial analyst and document parser.
Extract structured P&L (income statement) data from the provided document text and emit it via the emit_pl_extraction tool.

CRITICAL RULES:
1. Extract ONLY values explicitly present in the document. Never infer or estimate.
2. For every field you populate, add a confidence score (0.0–1.0) in confidence_scores.
3. Confidence scoring:
   - 1.0: Exact label match, clearly numeric, single occurrence
   - 0.85: Strong match but label slightly differs (e.g. "Mgmt Fee" → management_fees)
   - 0.7: Inferred from context (e.g. NOI = EGI - OpEx when not explicitly stated)
   - 0.5: Ambiguous — multiple possible values or label unclear
   - 0.3: Low confidence — guessed from surrounding context
4. All monetary values in USD. Negative values (losses) stored as POSITIVE numbers.
5. Parentheses = negative: "(50,000)" → store as 50000
6. Detect the reporting period. TTM = trailing twelve months. T12 = same.
7. If monthly breakdown is present (T-12 format), populate monthly_breakdown with all 12 months.
8. If a field is not present in the document, leave it out of data (or set to null). NEVER fabricate values.
9. "Total Revenue" / "EGI" / "Gross Revenue" → effective_gross_income
10. NOI is typically the bottom line before debt service.
11. Add source_references for every extracted field with page/sheet/row/snippet where found.
12. Use extraction_notes to record ambiguities, unusual labels, or decisions that needed judgment.`;

const RENT_ROLL_SYSTEM = `You are an expert commercial real estate analyst specializing in rent roll analysis.
Extract structured unit-level rent roll data and emit it via the emit_rent_roll_extraction tool.

CRITICAL RULES:
1. Extract EVERY unit row. Do not skip units. If the document has 200 units, the units array must have 200 entries.
2. Common column mappings:
   - "Unit"/"Unit #"/"#" → unit_number
   - "Tenant"/"Resident"/"Name" → tenant_name
   - "BD"/"Bed"/"BR" → bedrooms; "BA"/"Bath" → bathrooms
   - "SQFT"/"SF"/"Sq Ft" → sqft
   - "Market Rent"/"Mkt Rent"/"Potential Rent" → market_rent
   - "Actual Rent"/"Contract Rent"/"Lease Rent" → contract_rent
   - "Lease Start"/"Move In" → lease_start (ISO date YYYY-MM-DD)
   - "Lease End"/"Exp" → lease_end (ISO date YYYY-MM-DD)
3. Status: 'occupied', 'vacant', 'notice', 'model', 'down', 'unknown'
4. "VACANT" or empty tenant name → status = 'vacant'
5. "MTM" = month-to-month → lease_end = null
6. Populate unit_mix summary after extracting all units.
7. Add source_references for the units array and key summary fields.
8. CRE occupancy convention for the summary counts:
   - occupied_units = units with status in {'occupied', 'notice'} (tenant is still physically
     present and paying rent until their lease-end/move-out). Do NOT exclude 'notice' units.
   - vacant_units = units with status in {'vacant', 'down'}.
   - 'model' units are typically excluded from both counts.
   This convention applies to the TOP-LEVEL summary fields only — each unit's status field
   should still reflect its literal state from the document.`;

export async function extractPL(
  fullText: string,
  tables: string,
  filename: string,
  templateContext?: string | null
): Promise<ExtractionResult<PLExtractionSchema>> {
  const userPrompt = `Filename: ${filename}

DOCUMENT TEXT:
${fullText.slice(0, 50000)}${fullText.length > 50000 ? '\n[TEXT TRUNCATED — first 50K chars shown]' : ''}

DETECTED TABLES (formatted):
${tables.slice(0, 10000)}
${templateContext ? `\n${templateContext}\n` : ''}
Call the emit_pl_extraction tool to return the structured extraction.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [{ type: 'text', text: PL_SYSTEM, cache_control: { type: 'ephemeral' } } as any] as any,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [PL_TOOL as any],
    tool_choice: { type: 'tool', name: 'emit_pl_extraction' } as any,
  });

  return parseToolUseResult(response, 'emit_pl_extraction', 'P&L extraction');
}

export async function extractRentRoll(
  fullText: string,
  tables: string,
  filename: string,
  templateContext?: string | null
): Promise<ExtractionResult<RentRollExtractionSchema>> {
  const userPrompt = `Filename: ${filename}

DOCUMENT TEXT:
${fullText.slice(0, 60000)}${fullText.length > 60000 ? '\n[TEXT TRUNCATED]' : ''}

TABLES:
${tables.slice(0, 15000)}
${templateContext ? `\n${templateContext}\n` : ''}
Call the emit_rent_roll_extraction tool to return the structured extraction.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    system: [{ type: 'text', text: RENT_ROLL_SYSTEM, cache_control: { type: 'ephemeral' } } as any] as any,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [RENT_ROLL_TOOL as any],
    tool_choice: { type: 'tool', name: 'emit_rent_roll_extraction' } as any,
  });

  return parseToolUseResult(response, 'emit_rent_roll_extraction', 'Rent Roll extraction');
}

export type DocumentClass =
  | 'pl'
  | 'cash_flow'
  | 'rent_roll'
  | 't12'
  | 'om'
  | 'loi'
  | 'psa'
  | 'asa'
  | 'unknown';

export async function classifyDocument(
  firstPageText: string,
  filename: string
): Promise<{ class: DocumentClass; confidence: number }> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Classify this commercial real estate document. Filename: "${filename}".
First page text: "${firstPageText.slice(0, 2000)}".

Classes:
- pl:         profit & loss / income statement (single period).
- cash_flow:  cash flow statement — revenue minus operating expenses yielding "cash flow before debt" or net operating income. Common in laundromat, car wash, and other owner-operator businesses.
- rent_roll:  unit-level rent roll with tenants, rents, lease dates.
- t12:        trailing-12-month breakdown with monthly columns.
- om:         offering memorandum / marketing deck.
- loi:        letter of intent — non-binding, short (1-5 pages), "subject to definitive agreement".
- psa:        purchase & sale agreement — binding, long, closing/earnest money/contingency clauses for real estate.
- asa:        asset sale agreement — binding, business-acquisition flavor (stock vs. asset sale language, working-capital peg).
- unknown:    none of the above.

Reply ONLY with JSON: {"class": "pl"|"cash_flow"|"rent_roll"|"t12"|"om"|"loi"|"psa"|"asa"|"unknown", "confidence": 0.0-1.0}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return parseClaudeJSON(text, 'classification');
  } catch {
    return { class: 'unknown', confidence: 0 };
  }
}

function parseToolUseResult(response: Anthropic.Messages.Message, toolName: string, context: string): any {
  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use' && b.name === toolName
  );
  if (!toolBlock) {
    const textBlock = response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === 'text');
    const hint = textBlock ? textBlock.text.slice(0, 300) : '(no text block)';
    throw new Error(`Claude did not invoke ${toolName} for ${context}. Stop reason: ${response.stop_reason}. Text: ${hint}`);
  }
  return toolBlock.input;
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
