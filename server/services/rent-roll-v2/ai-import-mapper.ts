import OpenAI from "openai";
import { 
  RENT_ROLL_TARGET_FIELDS,
  ColumnMappingSuggestion,
  ValueMappingItem,
  ParsedAddress,
  ConfidenceLevel,
  ImportFieldDefinition,
} from "@shared/rent-roll-import-schema";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const AI_ENABLED = !!openai;

export class AIImportMapper {
  async suggestColumnMappings(
    headers: string[],
    sampleRows: Record<string, any>[],
    customFields: ImportFieldDefinition[] = []
  ): Promise<ColumnMappingSuggestion[]> {
    const allFields = [...RENT_ROLL_TARGET_FIELDS, ...customFields];

    if (AI_ENABLED && openai) {
      try {
        return await this.aiColumnMapping(headers, sampleRows, allFields);
      } catch (error) {
        console.warn("[AIImportMapper] AI mapping failed, falling back to patterns:", error);
      }
    }

    return this.patternBasedColumnMapping(headers, allFields);
  }

  private async aiColumnMapping(
    headers: string[],
    sampleRows: Record<string, any>[],
    availableFields: ImportFieldDefinition[]
  ): Promise<ColumnMappingSuggestion[]> {
    const fieldList = availableFields.map(f => `- "${f.id}" (${f.label})`).join("\n");
    const samplePreview = sampleRows.slice(0, 5).map(row =>
      Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(", ")
    ).join("\n");

    const completion = await openai!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a column mapping assistant for marina rent roll imports.
Map CSV/Excel columns to available database fields.

Available target fields:
${fieldList}

Return JSON:
{
  "mappings": [
    {"csvColumn": "...", "suggestedField": "fieldId" or null, "confidence": "high|medium|low", "reason": "..."}
  ]
}

Rules:
1. Only suggest fields from the list above
2. Use null if no good match exists
3. Consider sample data values when determining field type
4. "high" = exact or very close match, "medium" = partial/likely match, "low" = uncertain
5. For marina-specific fields like slip numbers, boat info, lease terms - map accurately`,
        },
        {
          role: "user",
          content: `Map these columns to rent roll fields:\n\nColumns: ${headers.join(", ")}\n\nSample data:\n${samplePreview}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const aiMappings = parsed.mappings || [];

    return headers.map(header => {
      const aiMatch = aiMappings.find((m: any) => m.csvColumn === header);
      if (aiMatch) {
        return {
          sourceColumn: header,
          targetField: aiMatch.suggestedField,
          confidence: aiMatch.confidence as ConfidenceLevel,
          reason: aiMatch.reason || "AI suggestion",
        };
      }
      return {
        sourceColumn: header,
        targetField: null,
        confidence: "low" as ConfidenceLevel,
        reason: "No AI match found",
      };
    });
  }

  private patternBasedColumnMapping(
    headers: string[],
    availableFields: ImportFieldDefinition[]
  ): ColumnMappingSuggestion[] {
    return headers.map(header => {
      const normalized = header.toLowerCase().trim().replace(/[_\-\s]+/g, "");
      let bestMatch: { field: ImportFieldDefinition; confidence: ConfidenceLevel; reason: string } | null = null;

      for (const field of availableFields) {
        const fieldNormalized = field.id.toLowerCase();
        const labelNormalized = field.label.toLowerCase().replace(/[_\-\s]+/g, "");

        if (normalized === fieldNormalized || normalized === labelNormalized) {
          bestMatch = { field, confidence: "high", reason: "Exact match" };
          break;
        }

        for (const alias of field.aliases) {
          const aliasNormalized = alias.toLowerCase().replace(/[_\-\s]+/g, "");
          if (normalized === aliasNormalized) {
            bestMatch = { field, confidence: "high", reason: `Alias match: ${alias}` };
            break;
          }
          if (normalized.includes(aliasNormalized) || aliasNormalized.includes(normalized)) {
            if (!bestMatch || bestMatch.confidence !== "high") {
              bestMatch = { field, confidence: "medium", reason: `Partial alias match: ${alias}` };
            }
          }
        }

        if (bestMatch?.confidence === "high") break;
      }

      return {
        sourceColumn: header,
        targetField: bestMatch?.field.id || null,
        confidence: bestMatch?.confidence || "low",
        reason: bestMatch?.reason || "No pattern match",
      };
    });
  }

  async suggestValueMappings(
    fieldId: string,
    fieldLabel: string,
    originalValues: string[],
    validOptions: string[]
  ): Promise<ValueMappingItem[]> {
    const results: ValueMappingItem[] = [];

    for (const originalValue of originalValues) {
      const exactMatch = validOptions.find(
        opt => opt.toLowerCase() === originalValue.toLowerCase()
      );
      
      if (exactMatch) {
        results.push({
          fieldId,
          fieldLabel,
          originalValue,
          occurrences: 1,
          suggestedValue: exactMatch,
          confidence: "high",
          isResolved: true,
        });
        continue;
      }

      if (AI_ENABLED && openai) {
        try {
          const suggestion = await this.aiValueMapping(originalValue, validOptions, fieldLabel);
          results.push({
            fieldId,
            fieldLabel,
            originalValue,
            occurrences: 1,
            suggestedValue: suggestion.suggestedValue,
            confidence: suggestion.confidence as ConfidenceLevel,
            isResolved: !!suggestion.suggestedValue,
          });
        } catch (error) {
          results.push({
            fieldId,
            fieldLabel,
            originalValue,
            occurrences: 1,
            suggestedValue: null,
            confidence: "low",
            isResolved: false,
          });
        }
      } else {
        const fuzzyMatch = this.fuzzyValueMatch(originalValue, validOptions);
        results.push({
          fieldId,
          fieldLabel,
          originalValue,
          occurrences: 1,
          suggestedValue: fuzzyMatch?.value || null,
          confidence: fuzzyMatch?.confidence || "low",
          isResolved: !!fuzzyMatch?.value,
        });
      }
    }

    return results;
  }

  private async aiValueMapping(
    originalValue: string,
    validOptions: string[],
    fieldLabel: string
  ): Promise<{ suggestedValue: string | null; confidence: ConfidenceLevel }> {
    const completion = await openai!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Map unrecognized values to valid options for marina rent rolls.
For "${fieldLabel}", valid options are:
${validOptions.map(opt => `- "${opt}"`).join("\n")}

Return JSON: {"suggestedValue": "..." or null, "confidence": "high|medium|low"}

Examples for storage types:
- "wet" → "Wet Slip" (high)
- "dry indoor" → "Dry Rack - Indoor" (high)
- "slip" → "Wet Slip" (medium)
- "XYZ123" → null (low)

Examples for contract terms:
- "yearly" → "Annual" (high)
- "summer" → "Seasonal" (high)
- "month to month" → "Monthly" (medium)`,
        },
        {
          role: "user",
          content: `Map: "${originalValue}"`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 256,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      suggestedValue: parsed.suggestedValue || null,
      confidence: (parsed.confidence as ConfidenceLevel) || "low",
    };
  }

  private fuzzyValueMatch(
    originalValue: string,
    validOptions: string[]
  ): { value: string; confidence: ConfidenceLevel } | null {
    const normalized = originalValue.toLowerCase().trim();

    for (const option of validOptions) {
      const optNorm = option.toLowerCase();
      if (optNorm.includes(normalized) || normalized.includes(optNorm)) {
        return { value: option, confidence: "medium" };
      }
      if (optNorm.split(/[\s\-]+/).some(word => normalized.includes(word))) {
        return { value: option, confidence: "low" };
      }
    }

    return null;
  }

  async parseAddress(fullAddress: string): Promise<ParsedAddress> {
    if (!fullAddress?.toString().trim()) {
      return { address1: null, address2: null, city: null, state: null, zip: null };
    }

    if (AI_ENABLED && openai) {
      try {
        return await this.aiAddressParsing(fullAddress);
      } catch (error) {
        console.warn("[AIImportMapper] AI address parsing failed, using heuristic:", error);
      }
    }

    return this.heuristicAddressParsing(fullAddress);
  }

  private async aiAddressParsing(fullAddress: string): Promise<ParsedAddress> {
    const completion = await openai!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Parse US addresses into components:
- address1: Street number and name
- address2: Apt/suite/unit (can be empty string)
- city: City name
- state: State code (e.g., "FL", "CA", "NY")
- zip: ZIP code (5 digits or 5+4)

Return JSON with null for missing fields. Handle marina-specific addresses.`,
        },
        {
          role: "user",
          content: `Parse: ${fullAddress}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 256,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      address1: parsed.address1 || null,
      address2: parsed.address2 || null,
      city: parsed.city || null,
      state: parsed.state || null,
      zip: parsed.zip || null,
    };
  }

  private heuristicAddressParsing(fullAddress: string): ParsedAddress {
    const result: ParsedAddress = {
      address1: null,
      address2: null,
      city: null,
      state: null,
      zip: null,
    };

    const addr = fullAddress.trim();
    const zipMatch = addr.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
    if (zipMatch) {
      result.zip = zipMatch[1];
    }

    const stateZipMatch = addr.match(/,\s*([A-Z]{2})\s+\d{5}/i);
    if (stateZipMatch) {
      result.state = stateZipMatch[1].toUpperCase();
    }

    const parts = addr.split(",").map(p => p.trim());
    if (parts.length >= 2) {
      result.address1 = parts[0];
      if (parts.length >= 3) {
        result.city = parts[parts.length - 2].replace(/\s+[A-Z]{2}\s+\d{5}.*$/, "").trim();
      }
    }

    return result;
  }

  async parseAddressesBatch(addresses: string[], batchSize = 10): Promise<ParsedAddress[]> {
    const results: ParsedAddress[] = [];
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(addr => this.parseAddress(addr)));
      results.push(...batchResults);
    }
    
    return results;
  }
}

export const aiImportMapper = new AIImportMapper();
