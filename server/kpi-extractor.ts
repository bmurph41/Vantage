import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedKPI {
  name: string;
  valueText?: string;
  valueNum?: number;
  unit?: string;
  category?: string;
  confidence: 'low' | 'medium' | 'high';
  pageHint?: string;
}

const MARINA_KPI_CATEGORIES = [
  'financial',
  'operational',
  'physical_assets',
  'market',
  'environmental',
  'legal',
];

const COMMON_MARINA_KPIS = [
  // Financial
  'Annual Revenue',
  'Annual Operating Expenses',
  'Net Operating Income (NOI)',
  'EBITDA',
  'Cap Rate',
  'Average Slip Rate',
  'Occupancy Rate',
  
  // Operational
  'Total Number of Slips',
  'Wet Slips',
  'Dry Storage Spaces',
  'Live-Aboards Allowed',
  'Waiting List Length',
  
  // Physical Assets
  'Total Acreage',
  'Water Frontage',
  'Fuel Dock',
  'Pump-Out Station',
  'Restaurant/Club',
  'Swimming Pool',
  'Boat Ramp',
  
  // Market
  'Year Built',
  'Last Major Renovation',
  'Market Position',
];

export class KpiExtractor {
  /**
   * Extract KPIs from text using OpenAI
   */
  async extractKPIsFromText(
    text: string,
    documentName: string,
    pageNumber?: number
  ): Promise<ExtractedKPI[]> {
    try {
      const prompt = this.buildExtractionPrompt(text, documentName);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a marina acquisition due diligence analyst expert at extracting key performance indicators (KPIs) from documents.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      const kpis: ExtractedKPI[] = result.kpis || [];

      // Add page hint if available
      return kpis.map(kpi => ({
        ...kpi,
        pageHint: pageNumber ? `Page ${pageNumber}` : kpi.pageHint,
      }));
    } catch (error: any) {
      console.error('KPI extraction error:', error);
      throw new Error(`Failed to extract KPIs: ${error.message}`);
    }
  }

  /**
   * Build the extraction prompt
   */
  private buildExtractionPrompt(text: string, documentName: string): string {
    return `Extract key performance indicators (KPIs) from the following marina due diligence document.

Document: ${documentName}

Common marina KPIs to look for:
${COMMON_MARINA_KPIS.map(k => `- ${k}`).join('\n')}

Categories: ${MARINA_KPI_CATEGORIES.join(', ')}

Document Text:
${text.substring(0, 8000)} ${text.length > 8000 ? '...[truncated]' : ''}

Instructions:
1. Extract factual KPIs with specific values (numbers, percentages, dates, yes/no)
2. For each KPI, provide:
   - name: Clear, descriptive name (e.g., "Annual Revenue", "Total Slips")
   - valueText: Text representation of the value (e.g., "$1.2M", "85%", "120 slips")
   - valueNum: Numeric value if applicable (extract just the number without units)
   - unit: Unit of measurement (e.g., "$", "%", "slips", "acres", "years")
   - category: One of: ${MARINA_KPI_CATEGORIES.join(', ')}
   - confidence: "high" if explicitly stated, "medium" if implied, "low" if uncertain
3. Only extract KPIs that are clearly stated or can be reliably inferred
4. Do not invent or assume KPIs not present in the text
5. For financial values, extract the numeric amount (e.g., "1200000" for "$1.2M")

Return JSON in this exact format:
{
  "kpis": [
    {
      "name": "Annual Revenue",
      "valueText": "$1,200,000",
      "valueNum": 1200000,
      "unit": "$",
      "category": "financial",
      "confidence": "high"
    }
  ]
}`;
  }

  /**
   * Validate and normalize a KPI
   */
  async validateKPI(kpi: ExtractedKPI, context: string): Promise<ExtractedKPI> {
    try {
      const prompt = `Validate this marina KPI extracted from a document:

KPI Name: ${kpi.name}
Value Text: ${kpi.valueText || 'N/A'}
Value Numeric: ${kpi.valueNum || 'N/A'}
Unit: ${kpi.unit || 'N/A'}
Category: ${kpi.category || 'N/A'}
Current Confidence: ${kpi.confidence}

Context from document:
${context.substring(0, 1000)}

Instructions:
1. Verify the KPI makes sense for marina due diligence
2. Check if the value is reasonable (e.g., occupancy rate should be 0-100%)
3. Normalize the name to a standard format
4. Adjust confidence level based on clarity of the source text
5. Suggest a category if missing

Return JSON:
{
  "name": "standardized name",
  "valueText": "formatted value",
  "valueNum": numeric_value_or_null,
  "unit": "unit",
  "category": "category",
  "confidence": "low|medium|high",
  "valid": true_or_false,
  "reason": "explanation if invalid"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a marina acquisition analyst validating extracted KPIs for accuracy and consistency.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return kpi; // Return original if validation fails
      }

      const validated = JSON.parse(content);
      
      if (validated.valid === false) {
        console.log(`KPI validation failed: ${validated.reason}`);
        return { ...kpi, confidence: 'low' };
      }

      return {
        name: validated.name || kpi.name,
        valueText: validated.valueText || kpi.valueText,
        valueNum: validated.valueNum ?? kpi.valueNum,
        unit: validated.unit || kpi.unit,
        category: validated.category || kpi.category,
        confidence: validated.confidence || kpi.confidence,
        pageHint: kpi.pageHint, // Preserve original page hint
      };
    } catch (error) {
      console.error('KPI validation error:', error);
      return kpi; // Return original on error
    }
  }

  /**
   * Extract KPIs from multiple pages with AI validation
   */
  async extractKPIsFromPages(
    pages: Array<{ pageNo: number; contentText: string }>,
    documentName: string
  ): Promise<ExtractedKPI[]> {
    const allKpis: ExtractedKPI[] = [];

    // Process pages in batches to avoid rate limits
    for (const page of pages) {
      try {
        const kpis = await this.extractKPIsFromText(
          page.contentText,
          documentName,
          page.pageNo
        );
        
        // Validate each KPI with AI
        for (const kpi of kpis) {
          try {
            const validated = await this.validateKPI(kpi, page.contentText);
            allKpis.push(validated);
          } catch (validationError) {
            console.error(`Error validating KPI ${kpi.name}:`, validationError);
            // Still add the KPI but with lower confidence
            allKpis.push({ ...kpi, confidence: 'low' });
          }
        }
      } catch (error) {
        console.error(`Error extracting KPIs from page ${page.pageNo}:`, error);
      }
    }

    // Deduplicate KPIs (considering both name and value)
    const uniqueKpis = this.deduplicateKPIs(allKpis);

    return uniqueKpis;
  }

  /**
   * Deduplicate KPIs by name and value similarity, keeping the most confident or complete version
   */
  private deduplicateKPIs(kpis: ExtractedKPI[]): ExtractedKPI[] {
    const kpiMap = new Map<string, ExtractedKPI[]>();

    // Group KPIs by normalized name
    for (const kpi of kpis) {
      const normalizedName = kpi.name.toLowerCase().trim();
      const existing = kpiMap.get(normalizedName) || [];
      existing.push(kpi);
      kpiMap.set(normalizedName, existing);
    }

    const uniqueKpis: ExtractedKPI[] = [];

    // For each group, deduplicate based on value similarity
    for (const [name, group] of Array.from(kpiMap.entries())) {
      if (group.length === 1) {
        uniqueKpis.push(group[0]);
        continue;
      }

      // Check if values are identical or very similar
      const uniqueValues = new Set(
        group.map((k: ExtractedKPI) => `${k.valueText}|${k.valueNum}|${k.unit}`)
      );

      if (uniqueValues.size === 1) {
        // All have the same value - keep the highest confidence one
        const best = group.reduce((best: ExtractedKPI, current: ExtractedKPI) => {
          const confidenceScore = (conf: string) => 
            conf === 'high' ? 3 : conf === 'medium' ? 2 : 1;
          return confidenceScore(current.confidence) > confidenceScore(best.confidence)
            ? current
            : best;
        });
        uniqueKpis.push(best);
      } else {
        // Different values - group by value and keep highest confidence of each
        const valueGroups = new Map<string, ExtractedKPI[]>();
        
        for (const kpi of group) {
          const valueKey = `${kpi.valueText}|${kpi.valueNum}|${kpi.unit}`;
          const existing = valueGroups.get(valueKey) || [];
          existing.push(kpi);
          valueGroups.set(valueKey, existing);
        }

        // For each distinct value, keep the highest confidence version
        for (const [valueKey, valueGroup] of Array.from(valueGroups.entries())) {
          const confidenceScore = (conf: string) => 
            conf === 'high' ? 3 : conf === 'medium' ? 2 : 1;
          
          const best = valueGroup.reduce((best: ExtractedKPI, current: ExtractedKPI) => {
            return confidenceScore(current.confidence) > confidenceScore(best.confidence)
              ? current
              : best;
          });

          // If this value appears only once among many variants, lower confidence
          if (valueGroup.length === 1 && valueGroups.size > 1) {
            uniqueKpis.push({
              ...best,
              confidence: best.confidence === 'high' ? 'medium' : 'low',
            });
          } else {
            uniqueKpis.push(best);
          }
        }
      }
    }

    return uniqueKpis;
  }
}

export const kpiExtractor = new KpiExtractor();
