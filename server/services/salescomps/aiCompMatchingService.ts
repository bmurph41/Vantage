import OpenAI from 'openai';
import type { SalesComp, ProjectProfile } from "@shared/schema";

export interface AICompScore {
  compId: string;
  aiScore: number;
  rationale: string;
  keyFactors: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface AIBatchScore {
  scores: AICompScore[];
  model: string;
  promptVersion: string;
}

export class AICompMatchingService {
  private openai: OpenAI | null = null;
  private readonly PROMPT_VERSION = '1.0';
  private readonly enabled: boolean;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.enabled = true;
    } else {
      console.warn('OPENAI_API_KEY not set - AI comp matching will be disabled');
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Score a batch of sales comps against project criteria using GPT-4
   * Returns null if AI is disabled or fails, signaling to use rule-based scores only
   */
  async scoreComps(
    projectProfile: ProjectProfile,
    comps: SalesComp[],
    existingScores: Array<{ compId: string; ruleBasedScore: number }>,
    timeoutMs: number = 8000
  ): Promise<AIBatchScore | null> {
    if (!this.enabled || !this.openai) {
      return null;
    }

    if (comps.length === 0) {
      return { scores: [], model: 'gpt-4o-mini', promptVersion: this.PROMPT_VERSION };
    }

    // Limit batch size to prevent token overflow and slow responses
    const BATCH_SIZE = 12;
    if (comps.length > BATCH_SIZE) {
      console.warn(`Batch size ${comps.length} exceeds recommended ${BATCH_SIZE}, truncating`);
      comps = comps.slice(0, BATCH_SIZE);
      existingScores = existingScores.slice(0, BATCH_SIZE);
    }

    const prompt = this.buildScoringPrompt(projectProfile, comps, existingScores);
    
    try {
      // Add timeout protection
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI scoring timeout')), timeoutMs)
      );

      const completionPromise = this.openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert marina acquisition analyst. Your task is to evaluate sales comparables (comps) against a target acquisition profile and provide relevance scores with detailed rationales.

You will receive:
1. Target acquisition criteria (price range, capacity, location, profit centers, etc.)
2. A list of candidate sales comps with their characteristics
3. Rule-based similarity scores for each comp

Your job is to:
- Analyze each comp for strategic fit beyond simple numerical matching
- Consider market trends, operational characteristics, and growth potential
- Provide nuanced scoring that accounts for context (e.g., a slightly higher price might be justified by superior location)
- Generate clear, actionable rationales explaining why each comp is or isn't a good match

Return scores as JSON matching the exact schema provided.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4000,
      });

      const completion = await Promise.race([completionPromise, timeoutPromise]);

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(responseText);
      
      const scores: AICompScore[] = parsed.scores.map((s: any) => ({
        compId: s.compId,
        aiScore: Math.max(0, Math.min(1, s.aiScore)),
        rationale: s.rationale || 'No rationale provided',
        keyFactors: s.keyFactors || [],
        confidence: s.confidence || 'medium'
      }));

      return {
        scores,
        model: completion.model,
        promptVersion: this.PROMPT_VERSION
      };
    } catch (error) {
      console.error('Error scoring comps with AI:', error);
      // Return null to signal fallback to rule-based scoring only
      return null;
    }
  }

  /**
   * Build the scoring prompt for GPT-4
   */
  private buildScoringPrompt(
    profile: ProjectProfile,
    comps: SalesComp[],
    existingScores: Array<{ compId: string; ruleBasedScore: number }>
  ): string {
    const profileSummary = this.summarizeProfile(profile);
    const compsSummary = comps.map((comp, idx) => {
      const ruleScore = existingScores.find(s => s.compId === comp.id)?.ruleBasedScore || 0;
      return this.summarizeComp(comp, ruleScore, idx + 1);
    }).join('\n\n');

    return `# Target Acquisition Profile

${profileSummary}

# Sales Comparables to Evaluate (${comps.length} total)

${compsSummary}

# Your Task

Analyze each comp and provide a JSON response with this exact structure:

{
  "scores": [
    {
      "compId": "comp-id-here",
      "aiScore": 0.85,
      "rationale": "2-3 sentence explanation of why this comp is a good/poor match, highlighting key strengths or concerns",
      "keyFactors": ["Factor 1", "Factor 2", "Factor 3"],
      "confidence": "high|medium|low"
    }
  ]
}

Scoring Guidelines:
- aiScore: 0.0 to 1.0 where 1.0 is perfect match
- Consider both quantitative fit (capacity, price, NOI) and qualitative factors (profit centers, market trends, operational characteristics)
- keyFactors: 2-4 brief bullets highlighting most important considerations (e.g., "Excellent capacity match", "Premium waterfront location", "Dated facilities", "Strong F&B revenue")
- confidence: "high" if comp data is complete and clear fit, "medium" if some uncertainty, "low" if data is sparse or fit is unclear
- Use the rule-based score as a starting point but feel free to adjust based on strategic considerations

Provide scores for all ${comps.length} comps.`;
  }

  /**
   * Summarize project profile for the prompt
   */
  private summarizeProfile(profile: ProjectProfile): string {
    const parts: string[] = [];
    
    if (profile.targetStates && profile.targetStates.length > 0) {
      parts.push(`Location: ${profile.targetStates.join(', ')}`);
    }
    if (profile.targetRegions && profile.targetRegions.length > 0) {
      parts.push(`Regions: ${profile.targetRegions.join(', ')}`);
    }
    if (profile.coastalType) {
      parts.push(`Water Type: ${profile.coastalType}`);
    }
    if (profile.targetPriceMin || profile.targetPriceMax) {
      const priceRange = profile.targetPriceMin && profile.targetPriceMax 
        ? `$${(profile.targetPriceMin / 1000000).toFixed(1)}M - $${(profile.targetPriceMax / 1000000).toFixed(1)}M`
        : profile.targetPriceMin 
        ? `$${(profile.targetPriceMin / 1000000).toFixed(1)}M+`
        : `Up to $${(profile.targetPriceMax! / 1000000).toFixed(1)}M`;
      parts.push(`Price Range: ${priceRange}`);
    }
    if (profile.targetCapacity) {
      parts.push(`Target Capacity: ${profile.targetCapacity} slips`);
    }
    if (profile.targetWetSlipsMin || profile.targetWetSlipsMax) {
      const range = profile.targetWetSlipsMin && profile.targetWetSlipsMax
        ? `${profile.targetWetSlipsMin}-${profile.targetWetSlipsMax}`
        : profile.targetWetSlipsMin
        ? `${profile.targetWetSlipsMin}+`
        : `Up to ${profile.targetWetSlipsMax}`;
      parts.push(`Wet Slips: ${range}`);
    }
    if (profile.targetNOI) {
      parts.push(`Target NOI: $${(profile.targetNOI / 1000000).toFixed(2)}M`);
    }
    if (profile.mustHaveProfitCenters && profile.mustHaveProfitCenters.length > 0) {
      parts.push(`Must Have Profit Centers: ${profile.mustHaveProfitCenters.join(', ')}`);
    }
    if (profile.niceToHaveProfitCenters && profile.niceToHaveProfitCenters.length > 0) {
      parts.push(`Nice to Have Profit Centers: ${profile.niceToHaveProfitCenters.join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join('\n') : 'No specific criteria defined';
  }

  /**
   * Summarize a single comp for the prompt
   */
  private summarizeComp(comp: SalesComp, ruleBasedScore: number, index: number): string {
    const parts: string[] = [`## Comp ${index}: ${comp.marina} (ID: ${comp.id})`];
    parts.push(`Rule-Based Score: ${(ruleBasedScore * 100).toFixed(1)}%`);
    parts.push('');
    
    if (comp.state) parts.push(`Location: ${comp.city ? comp.city + ', ' : ''}${comp.state}`);
    if (comp.market) parts.push(`Market: ${comp.market}`);
    if (comp.coastalType) parts.push(`Water Type: ${comp.coastalType}`);
    if (comp.salePrice) parts.push(`Sale Price: $${(comp.salePrice / 1000000).toFixed(2)}M`);
    if (comp.saleYear) parts.push(`Sale Year: ${comp.saleYear}${comp.saleMonth ? ' (Month: ' + comp.saleMonth + ')' : ''}`);
    
    const totalCap = (comp.wetSlips || 0) + (comp.dryRacks || 0);
    if (totalCap > 0) {
      parts.push(`Total Capacity: ${totalCap} (Wet: ${comp.wetSlips || 0}, Dry: ${comp.dryRacks || 0})`);
    }
    
    if (comp.noi) parts.push(`NOI: $${(comp.noi / 1000000).toFixed(2)}M`);
    if (comp.capRate) parts.push(`Cap Rate: ${comp.capRate}%`);
    if (comp.occupancy) parts.push(`Occupancy: ${comp.occupancy}%`);
    
    if (comp.profitCenters && comp.profitCenters.length > 0) {
      parts.push(`Profit Centers: ${comp.profitCenters.join(', ')}`);
    }
    
    if (comp.storageTypes && comp.storageTypes.length > 0) {
      parts.push(`Storage Types: ${comp.storageTypes.join(', ')}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Combine rule-based and AI scores
   */
  combineScores(
    ruleBasedScore: number,
    aiScore: number,
    alpha: number = 0.6
  ): number {
    return alpha * aiScore + (1 - alpha) * ruleBasedScore;
  }
}
