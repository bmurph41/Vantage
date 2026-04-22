import Anthropic from '@anthropic-ai/sdk';
import type {
  ContractExtractionSchema,
  ContractType,
  ExtractionResult,
} from '../../../shared/extraction-schemas.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Stable across every call — wrapped in an ephemeral cache block so the
// prompt cache keeps it warm and only the variable `fullText` changes per
// invocation. Saves ~$0.01/call after the first.
const CONTRACT_SYSTEM_PROMPT = `You are an expert commercial real estate transactional attorney and document parser.
Your task is to extract structured deal terms and critical dates from a Letter of Intent (LOI),
Purchase & Sale Agreement (PSA), or Asset Sale Agreement (ASA).

CRITICAL RULES:
1. Extract ONLY values explicitly present in the document text. Never infer, estimate, or hallucinate.
2. For every field you populate, provide a confidence score (0.0–1.0) in confidence_scores
   and a verbatim source snippet + page number in source_references.
3. Confidence scoring:
   - 1.0  Exact match, single unambiguous occurrence, clear label.
   - 0.85 Strong match, label slightly paraphrased (e.g. "Inspection Period" → inspection_end).
   - 0.7  Computed from adjacent text (e.g. "within 30 days of Effective Date" + known Effective Date).
   - 0.5  Ambiguous — multiple candidate values or label unclear.
   - 0.3  Low confidence — guessed from surrounding context.
4. ALL dates ISO-8601 (YYYY-MM-DD). If the contract gives only a duration
   (e.g. "30 days after Effective Date"):
     - Populate inspection_duration_days / closing_offset_days.
     - Populate the absolute date ONLY IF the anchor (Effective Date) is itself stated
       in the document — otherwise leave absolute = null and anchor_field filled.
5. Monetary amounts are plain numbers in USD. $1,500,000 → 1500000.
6. Parties: extract the legal entity name as it appears on the signature block or preamble.
   Common label variants: "Purchaser"/"Buyer", "Seller"/"Vendor".
7. Property: address + APN (tax parcel number) if present.
8. assignment_allowed:
     - true  if the contract expressly permits assignment without consent.
     - false if assignment requires seller consent or is prohibited.
     - null  if the contract is silent or the clause is ambiguous (this IS a signal — do not guess).
9. If a field is not present in the document, set it to null — do NOT fabricate.
10. Return ONLY valid JSON. No markdown, no prose, no commentary.`;

const CONTRACT_OUTPUT_TEMPLATE = `{
  "data": {
    "contract_type": "psa",
    "extraction_schema_version": 1,
    "parties": {
      "buyer": null,
      "seller": null,
      "property_address": null,
      "apn": null
    },
    "money": {
      "purchase_price": null,
      "earnest_money": null,
      "earnest_money_deadline": null
    },
    "dates": {
      "effective_date": null,
      "inspection_end": null,
      "inspection_duration_days": null,
      "financing_deadline": null,
      "title_delivery": null,
      "title_objection": null,
      "survey_delivery": null,
      "survey_objection": null,
      "estoppel_delivery": null,
      "closing_date": null,
      "closing_offset_days": null
    },
    "flags": {
      "assignment_allowed": null
    }
  },
  "confidence_scores": {
    "parties.buyer": 0.0,
    "money.purchase_price": 0.0,
    "dates.closing_date": 0.0
  },
  "source_references": {
    "parties.buyer": { "page": 1, "snippet": "verbatim text from document" }
  },
  "extraction_notes": [],
  "document_class_confirmed": "psa"
}`;

export async function extractContract(
  fullText: string,
  filename: string,
  hint: ContractType,
): Promise<ExtractionResult<ContractExtractionSchema>> {
  const truncated = fullText.slice(0, 80000);
  const userPrompt = `Filename: ${filename}
Classifier hint: ${hint}

DOCUMENT TEXT:
${truncated}${fullText.length > 80000 ? '\n[TEXT TRUNCATED — first 80K chars shown]' : ''}

Extract into this exact JSON structure (populate every leaf — null for unknown):
${CONTRACT_OUTPUT_TEMPLATE}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 6000,
    // Array-form system enables cache_control on the stable block.
    system: [
      {
        type: 'text',
        text: CONTRACT_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      } as any,
    ] as any,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseContractJSON(text);
}

function parseContractJSON(text: string): ExtractionResult<ContractExtractionSchema> {
  const clean = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`Contract extractor returned invalid JSON: ${text.slice(0, 300)}`);
  }
}
