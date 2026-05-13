/**
 * AI Content Generation Service
 * Generates content for document sections using OpenAI or Anthropic
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getSectionDefinition } from '../../../shared/document-builder/section-library';
import type { AIPromptTemplate, ResolvedBinding } from '../../../shared/document-builder/types';
import { getModelConfig } from '../../../shared/asset-class-model-config';

// =============================================================================
// Asset-Class Narrative Terms
// =============================================================================

/**
 * Terms injected into AI systemPrompts + userPrompts so the model writes
 * about the right thing (marina vs multifamily vs hotel vs office vs …)
 * without per-asset-class branching in each generator.
 *
 * Pulled from shared/asset-class-model-config.ts. Three layers:
 *   - assetLabel:     human-readable label ("marina", "multifamily", "hotel")
 *   - unit/unitPlural: the rentable unit term ("slip"/"slips", "unit"/"units")
 *   - totalUnitsLabel: column label for the count ("Total Slips", "Total Units")
 *
 * `analystSpecialty` is a marketing-friendly noun phrase for systemPrompts;
 * derived from assetLabel but kept as its own field so we can override per
 * asset class if "marina investments analyst" reads differently from
 * "multifamily acquisitions analyst" in practice.
 */
interface AssetNarrativeTerms {
  assetLabel: string;
  assetLabelPlural: string;
  unit: string;
  unitPlural: string;
  totalUnitsLabel: string;
  analystSpecialty: string;
}

function getAssetNarrativeTerms(assetClass?: string | null): AssetNarrativeTerms {
  const cfg = getModelConfig(assetClass ?? 'marina');
  const label = cfg.label.toLowerCase();
  // propertyPlural in the config is mostly "properties" — generic and not very
  // useful by itself ("specializing in properties" reads poorly). When the
  // config provides a distinct plural noun (e.g. "hotels"), use it directly;
  // otherwise compose "<label> properties" (e.g. "marina properties",
  // "multifamily properties") so the systemPrompt is always specific.
  const cfgPlural = cfg.terms.propertyPlural;
  const assetLabelPlural =
    cfgPlural && cfgPlural !== 'properties' ? cfgPlural : `${label} properties`;
  return {
    assetLabel: label,
    assetLabelPlural,
    unit: cfg.terms.unit,
    unitPlural: cfg.terms.unitPlural,
    totalUnitsLabel: cfg.terms.totalUnitsLabel || 'Total Units',
    analystSpecialty: `${label} investments`,
  };
}

// =============================================================================
// Provider Types
// =============================================================================

type AIProvider = 'openai' | 'anthropic';

interface GenerationOptions {
  provider?: AIProvider;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

interface GenerationResult {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed?: number;
  cached?: boolean;
}

// =============================================================================
// AI Content Generation Service
// =============================================================================

class AIContentGenerationService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private defaultProvider: AIProvider;

  constructor() {
    // Initialize providers based on available API keys
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    // Determine default provider from env or availability
    const envProvider = process.env.AI_PROVIDER?.toLowerCase() as AIProvider;
    if (envProvider === 'anthropic' && this.anthropic) {
      this.defaultProvider = 'anthropic';
    } else if (envProvider === 'openai' && this.openai) {
      this.defaultProvider = 'openai';
    } else if (this.anthropic) {
      this.defaultProvider = 'anthropic';
    } else if (this.openai) {
      this.defaultProvider = 'openai';
    } else {
      this.defaultProvider = 'openai'; // Fallback, will error if used without key
    }
  }

  /**
   * Generate content for a section using AI
   */
  async generateSectionContent(
    sectionKey: string,
    promptKey: string,
    context: Record<string, any>,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const sectionDef = getSectionDefinition(sectionKey);
    if (!sectionDef) {
      throw new Error(`Section not found: ${sectionKey}`);
    }

    const template = sectionDef.aiPromptTemplates.find((t) => t.key === promptKey);
    if (!template) {
      throw new Error(`Prompt template not found: ${promptKey}`);
    }

    // Validate required context
    for (const required of template.requiredContext) {
      if (!context[required]) {
        throw new Error(`Missing required context: ${required}`);
      }
    }

    // Inject asset-class narrative terms so section-library templates can
    // reference {{assetLabel}}, {{assetLabelPlural}}, {{unit}}, {{unitPlural}},
    // {{totalUnitsLabel}}, {{analystSpecialty}} without per-asset branching.
    // Caller passes context.assetClass; if absent, marina defaults apply
    // (back-compat with templates authored before asset-class support).
    const terms = getAssetNarrativeTerms(context.assetClass);
    const ctx = { ...terms, ...context };

    // Build the prompt. Interpolate the systemPrompt too so seed templates
    // can switch out the analyst-specialty phrasing per asset class.
    const systemPrompt = this.interpolateTemplate(template.systemPrompt, ctx);
    const userPrompt = this.interpolateTemplate(template.userPromptTemplate, ctx);

    const provider = options?.provider || this.defaultProvider;
    const temperature = options?.temperature ?? template.temperature;
    const maxTokens = options?.maxTokens ?? template.maxTokens;

    if (provider === 'anthropic') {
      return this.generateWithAnthropic(
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        options?.model
      );
    } else {
      return this.generateWithOpenAI(
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        options?.model
      );
    }
  }

  /**
   * Generate arbitrary content with custom prompts
   */
  async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const provider = options?.provider || this.defaultProvider;
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens ?? 1000;

    if (provider === 'anthropic') {
      return this.generateWithAnthropic(
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        options?.model
      );
    } else {
      return this.generateWithOpenAI(
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        options?.model
      );
    }
  }

  /**
   * Generate with OpenAI
   */
  private async generateWithOpenAI(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number,
    model?: string
  ): Promise<GenerationResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Set OPENAI_API_KEY environment variable.');
    }

    const modelToUse = model || 'gpt-4o';

    const response = await this.openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      provider: 'openai',
      model: modelToUse,
      tokensUsed: response.usage?.total_tokens,
    };
  }

  /**
   * Generate with Anthropic Claude
   */
  private async generateWithAnthropic(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number,
    model?: string
  ): Promise<GenerationResult> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized. Set ANTHROPIC_API_KEY environment variable.');
    }

    const modelToUse = model || 'claude-sonnet-4-20250514';

    const response = await this.anthropic.messages.create({
      model: modelToUse,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    return {
      content,
      provider: 'anthropic',
      model: modelToUse,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
    };
  }

  /**
   * Interpolate variables in a template string
   */
  private interpolateTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = context[key];
      if (value === undefined || value === null) {
        return match; // Keep the placeholder if value not found
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
  }

  // =============================================================================
  // Section-Specific Generation Methods
  // =============================================================================

  /**
   * Generate executive summary narrative
   */
  async generateExecutiveSummary(
    context: {
      propertyName: string;
      location: string;
      assetClass?: string;
      // Generic unit count — used for all asset classes. `totalSlips` is kept
      // as a marina-era alias for back-compat with callers that predate
      // asset-class support.
      totalUnits?: number;
      totalSlips?: number;
      groundLeaseTerm?: string;
      purchasePrice?: number;
      capRate?: number;
      irr?: number;
      equityMultiple?: number;
      additionalContext?: string;
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const terms = getAssetNarrativeTerms(context.assetClass);
    const unitCount = context.totalUnits ?? context.totalSlips;

    const systemPrompt = `You are an expert commercial real estate analyst specializing in ${terms.analystSpecialty}. Write institutional-quality content for investment committee memorandums and offering memorandums. Use professional, analytical tone with specific data points. Write in flowing paragraphs without bullet points unless specifically requested.`;

    const userPrompt = `Write a compelling executive summary paragraph (200-250 words) for ${context.propertyName}, a ${terms.assetLabel} in ${context.location}.

Property Details:
- ${terms.totalUnitsLabel}: ${unitCount || 'N/A'}
- Ground Lease: ${context.groundLeaseTerm || 'Fee Simple'}
- Purchase Price: ${context.purchasePrice ? `$${context.purchasePrice.toLocaleString()}` : 'N/A'}
- Cap Rate: ${context.capRate ? `${(context.capRate * 100).toFixed(1)}%` : 'N/A'}
${context.additionalContext ? `\nAdditional Context:\n${context.additionalContext}` : ''}

The summary should:
1. Open with the property's unique positioning and investment opportunity
2. Highlight the strategic location and market position
3. Describe the operational profile and revenue mix
4. Note key amenities or value drivers
5. Close with the investment thesis and return potential

Write in third person, professional tone suitable for institutional investors.`;

    return this.generateContent(systemPrompt, userPrompt, options);
  }

  /**
   * Generate investment highlights
   */
  async generateInvestmentHighlights(
    context: {
      propertyName: string;
      location: string;
      assetClass?: string;
      totalUnits?: number;
      totalSlips?: number; // marina-era alias
      occupancy?: number;
      capRate?: number;
      marketPosition?: string;
      valueAddOpportunities?: string[];
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const terms = getAssetNarrativeTerms(context.assetClass);
    const unitCount = context.totalUnits ?? context.totalSlips;

    const systemPrompt = `You are a ${terms.assetLabel} investment analyst. Generate concise, compelling investment highlights that emphasize value, stability, and growth potential. Each highlight should be one line and start with a strong action word or key metric.`;

    const userPrompt = `Generate 6-8 investment highlights for ${context.propertyName} in ${context.location}.

Property Context:
- ${terms.totalUnitsLabel}: ${unitCount || 'N/A'}
- Occupancy: ${context.occupancy ? `${(context.occupancy * 100).toFixed(0)}%` : 'N/A'}
- Cap Rate: ${context.capRate ? `${(context.capRate * 100).toFixed(1)}%` : 'N/A'}
- Market Position: ${context.marketPosition || 'Strong regional presence'}
${context.valueAddOpportunities?.length ? `- Value-Add Opportunities: ${context.valueAddOpportunities.join(', ')}` : ''}

Format as bullet points starting with "• ". Each bullet should be concise (under 20 words) and highlight a specific value driver.`;

    return this.generateContent(systemPrompt, userPrompt, options);
  }

  /**
   * Generate market overview
   */
  async generateMarketOverview(
    context: {
      location: string;
      assetClass?: string;
      population?: number;
      medianIncome?: number;
      // marina-specific demographic signal — kept on the context for marina
      // deals; non-marina deals should leave this undefined.
      boatRegistrations?: number;
      marketTrends?: string[];
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const terms = getAssetNarrativeTerms(context.assetClass);
    const isMarina = terms.assetLabel === 'marina';

    const systemPrompt = isMarina
      ? `You are a marina market analyst with expertise in recreational boating trends and demographic analysis. Write analytical market overviews that provide context for marina investments.`
      : `You are a commercial real estate market analyst specializing in ${terms.assetLabelPlural}. Write analytical market overviews that provide context for ${terms.analystSpecialty}, grounded in demographics, supply/demand, and local market dynamics.`;

    const userPrompt = `Write a market overview (150-200 words) for the ${context.location} ${terms.assetLabel} market.

Market Data:
- Population: ${context.population?.toLocaleString() || 'N/A'}
- Median Household Income: ${context.medianIncome ? `$${context.medianIncome.toLocaleString()}` : 'N/A'}
${isMarina && context.boatRegistrations ? `- Boat Registrations: ${context.boatRegistrations.toLocaleString()}` : ''}
${context.marketTrends?.length ? `- Market Trends: ${context.marketTrends.join(', ')}` : ''}

The overview should:
1. Describe local/regional ${terms.assetLabel} market conditions
${isMarina ? '2. Highlight boating and watercraft ownership trends\n3. Discuss supply/demand dynamics for marina slips' : `2. Highlight demand drivers relevant to ${terms.assetLabelPlural}\n3. Discuss supply/demand dynamics for ${terms.unitPlural}`}
4. Note any barriers to new supply
5. Position the subject property favorably within market context

Write in flowing paragraphs with analytical, professional tone.`;

    return this.generateContent(systemPrompt, userPrompt, options);
  }

  /**
   * Generate risk assessment
   */
  async generateRiskAssessment(
    context: {
      propertyName: string;
      location: string;
      assetClass?: string;
      groundLeaseTerm?: string;
      purchasePrice?: number;
      specificRisks?: string[];
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const terms = getAssetNarrativeTerms(context.assetClass);

    const systemPrompt = `You are a due diligence analyst specializing in ${terms.assetLabel} acquisitions. Generate comprehensive risk assessments with specific mitigants for each identified risk.`;

    const userPrompt = `Generate a risk assessment for the ${context.propertyName} ${terms.assetLabel} acquisition in ${context.location}.

Property Context:
- Ground Lease: ${context.groundLeaseTerm || 'Fee Simple'}
- Purchase Price: ${context.purchasePrice ? `$${context.purchasePrice.toLocaleString()}` : 'N/A'}
${context.specificRisks?.length ? `- Known Risks to Address: ${context.specificRisks.join(', ')}` : ''}

Identify 5-7 key risks across these categories:
1. Market/Demand Risk
2. Operational Risk
3. Environmental/Weather Risk
4. Regulatory/Lease Risk
5. Financial Risk

For each risk, provide:
- Risk description (1 sentence)
- Likelihood: Low/Medium/High
- Impact: Low/Medium/High
- Specific mitigant (1-2 sentences)

Format as a structured list that can be converted to a table.`;

    return this.generateContent(systemPrompt, userPrompt, options);
  }

  /**
   * Generate property description narrative
   */
  async generatePropertyDescription(
    context: {
      propertyName: string;
      location: string;
      assetClass?: string;
      totalUnits?: number;
      // Marina-specific physical fields. Non-marina deals leave these
      // undefined; the prompt omits them in that case so the model isn't
      // primed with marina-flavored detail it can't use.
      totalSlips?: number;
      wetSlips?: number;
      drySlips?: number;
      waterBody?: string;
      // Generic
      amenities?: string[];
      yearBuilt?: number;
      recentImprovements?: string[];
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const terms = getAssetNarrativeTerms(context.assetClass);
    const isMarina = terms.assetLabel === 'marina';
    const unitCount = context.totalUnits ?? context.totalSlips;

    const systemPrompt = `You are a commercial real estate writer specializing in ${terms.assetLabelPlural}. Write detailed, professional property descriptions that highlight physical attributes, amenities, and operational characteristics.`;

    const userPrompt = `Write a property description (150-200 words) for ${context.propertyName} in ${context.location}.

Property Details:
- ${terms.totalUnitsLabel}: ${unitCount || 'N/A'}
${isMarina ? `- Wet Slips: ${context.wetSlips || 'N/A'}
- Dry Slips: ${context.drySlips || 'N/A'}
- Water Body: ${context.waterBody || 'N/A'}` : ''}
- Year Built: ${context.yearBuilt || 'N/A'}
- Amenities: ${context.amenities?.join(', ') || 'N/A'}
${context.recentImprovements?.length ? `- Recent Improvements: ${context.recentImprovements.join(', ')}` : ''}

The description should:
1. Open with the property's positioning and setting
${isMarina ? '2. Describe the storage mix and slip configuration' : `2. Describe the ${terms.unit} mix and operational configuration`}
3. Highlight key amenities and services
4. Note infrastructure quality and recent improvements
${isMarina ? '5. Mention access and navigational characteristics' : '5. Mention access, visibility, and locational characteristics'}

Write in professional, descriptive prose suitable for an offering memorandum.`;

    return this.generateContent(systemPrompt, userPrompt, options);
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: AIProvider): boolean {
    if (provider === 'openai') {
      return this.openai !== null;
    }
    if (provider === 'anthropic') {
      return this.anthropic !== null;
    }
    return false;
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): AIProvider {
    return this.defaultProvider;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    if (this.openai) providers.push('openai');
    if (this.anthropic) providers.push('anthropic');
    return providers;
  }
}

export const aiContentGenerationService = new AIContentGenerationService();
