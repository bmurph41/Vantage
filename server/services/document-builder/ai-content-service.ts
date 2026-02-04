/**
 * AI Content Generation Service
 * Generates content for document sections using OpenAI or Anthropic
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getSectionDefinition } from '../../../shared/document-builder/section-library';
import type { AIPromptTemplate, ResolvedBinding } from '../../../shared/document-builder/types';

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

    // Build the prompt
    const userPrompt = this.interpolateTemplate(template.userPromptTemplate, context);

    const provider = options?.provider || this.defaultProvider;
    const temperature = options?.temperature ?? template.temperature;
    const maxTokens = options?.maxTokens ?? template.maxTokens;

    if (provider === 'anthropic') {
      return this.generateWithAnthropic(
        template.systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        options?.model
      );
    } else {
      return this.generateWithOpenAI(
        template.systemPrompt,
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
    const systemPrompt = `You are an expert commercial real estate analyst specializing in marina investments. Write institutional-quality content for investment committee memorandums and offering memorandums. Use professional, analytical tone with specific data points. Write in flowing paragraphs without bullet points unless specifically requested.`;

    const userPrompt = `Write a compelling executive summary paragraph (200-250 words) for ${context.propertyName}, located in ${context.location}.

Property Details:
- Total Slips: ${context.totalSlips || 'N/A'}
- Ground Lease: ${context.groundLeaseTerm || 'Fee Simple'}
- Purchase Price: ${context.purchasePrice ? `$${context.purchasePrice.toLocaleString()}` : 'N/A'}
- Cap Rate: ${context.capRate ? `${(context.capRate * 100).toFixed(1)}%` : 'N/A'}
${context.additionalContext ? `\nAdditional Context:\n${context.additionalContext}` : ''}

The summary should:
1. Open with the property's unique positioning and investment opportunity
2. Highlight the strategic location and market position
3. Describe the storage-dominant operation if applicable
4. Note key amenities and revenue diversification
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
      totalSlips?: number;
      occupancy?: number;
      capRate?: number;
      marketPosition?: string;
      valueAddOpportunities?: string[];
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const systemPrompt = `You are a marina investment analyst. Generate concise, compelling investment highlights that emphasize value, stability, and growth potential. Each highlight should be one line and start with a strong action word or key metric.`;

    const userPrompt = `Generate 6-8 investment highlights for ${context.propertyName} in ${context.location}.

Property Context:
- Total Slips: ${context.totalSlips || 'N/A'}
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
      population?: number;
      medianIncome?: number;
      boatRegistrations?: number;
      marketTrends?: string[];
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const systemPrompt = `You are a marina market analyst with expertise in recreational boating trends and demographic analysis. Write analytical market overviews that provide context for marina investments.`;

    const userPrompt = `Write a market overview (150-200 words) for the ${context.location} marina market.

Market Data:
- Population: ${context.population?.toLocaleString() || 'N/A'}
- Median Household Income: ${context.medianIncome ? `$${context.medianIncome.toLocaleString()}` : 'N/A'}
- Boat Registrations: ${context.boatRegistrations?.toLocaleString() || 'N/A'}
${context.marketTrends?.length ? `- Market Trends: ${context.marketTrends.join(', ')}` : ''}

The overview should:
1. Describe local/regional marina market conditions
2. Highlight boating and watercraft ownership trends
3. Discuss supply/demand dynamics for marina slips
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
      groundLeaseTerm?: string;
      purchasePrice?: number;
      specificRisks?: string[];
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const systemPrompt = `You are a due diligence analyst specializing in marina acquisitions. Generate comprehensive risk assessments with specific mitigants for each identified risk.`;

    const userPrompt = `Generate a risk assessment for the ${context.propertyName} marina acquisition in ${context.location}.

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
      totalSlips?: number;
      wetSlips?: number;
      drySlips?: number;
      amenities?: string[];
      waterBody?: string;
      yearBuilt?: number;
      recentImprovements?: string[];
    },
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const systemPrompt = `You are a commercial real estate writer specializing in marina properties. Write detailed, professional property descriptions that highlight physical attributes, amenities, and operational characteristics.`;

    const userPrompt = `Write a property description (150-200 words) for ${context.propertyName} in ${context.location}.

Property Details:
- Total Slips: ${context.totalSlips || 'N/A'}
- Wet Slips: ${context.wetSlips || 'N/A'}
- Dry Slips: ${context.drySlips || 'N/A'}
- Water Body: ${context.waterBody || 'N/A'}
- Year Built: ${context.yearBuilt || 'N/A'}
- Amenities: ${context.amenities?.join(', ') || 'N/A'}
${context.recentImprovements?.length ? `- Recent Improvements: ${context.recentImprovements.join(', ')}` : ''}

The description should:
1. Open with the property's positioning and setting
2. Describe the storage mix and slip configuration
3. Highlight key amenities and services
4. Note infrastructure quality and recent improvements
5. Mention access and navigational characteristics

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
