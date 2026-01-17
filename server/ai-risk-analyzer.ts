import OpenAI from "openai";
import type { Risk, DDTask, Project } from "@shared/schema";

// Use Replit AI Integrations if available (billed to Replit credits), otherwise fall back to user's OpenAI key
const openai = new OpenAI({ 
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

interface RiskAnalysisResult {
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskSummary: string;
  categoryInsights: Array<{
    category: string;
    count: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    insight: string;
  }>;
  recommendations: string[];
  criticalFactors: string[];
}

interface RiskContext {
  project: Project;
  risks: Risk[];
  tasks: DDTask[];
  daysRemaining: number;
  completionRate: number;
  overdueTasks: number;
}

export class AIRiskAnalyzer {
  /**
   * Analyze risks using AI to provide intelligent insights
   */
  async analyzeRisks(context: RiskContext): Promise<RiskAnalysisResult> {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const prompt = this.buildAnalysisPrompt(context);

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are a senior risk management consultant specializing in marina acquisition due diligence. 
            Your expertise includes financial analysis, operational risk assessment, regulatory compliance, 
            environmental factors, and market conditions. Analyze the provided risk data and provide 
            strategic insights that would be valuable to executives and board members. 
            Respond with JSON in the exact format specified.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return this.validateAndFormatResult(result);

    } catch (error) {
      console.error('AI Risk Analysis failed:', error);
      // Fallback to basic analysis if AI fails
      return this.generateFallbackAnalysis(context);
    }
  }

  /**
   * Build the analysis prompt with project context
   */
  private buildAnalysisPrompt(context: RiskContext): string {
    const { project, risks, tasks, daysRemaining, completionRate, overdueTasks } = context;

    // Categorize risks by category and severity
    const risksByCategory = this.categorizeRisks(risks);
    const highSeverityRisks = risks.filter(risk => this.calculateRiskScore(risk) >= 15);

    return `
Analyze the following marina acquisition due diligence project risks:

PROJECT CONTEXT:
- Project: ${project.name}
- Purchase Price: $${(project as any).purchasePrice?.toLocaleString() || 'N/A'}
- Days Remaining to Closing: ${daysRemaining}
- Project Completion Rate: ${completionRate}%
- Overdue Tasks: ${overdueTasks}
- Total Tasks: ${tasks.length}
- Location: ${(project as any).location || 'Not specified'}

RISK INVENTORY (${risks.length} total risks):
${Object.entries(risksByCategory).map(([category, categoryRisks]) => 
  `${category.toUpperCase()} (${categoryRisks.length} risks):
${categoryRisks.map(risk => 
  `  - ${risk.name}: Impact ${risk.impact}/5, Likelihood ${risk.likelihood}/5, Status: ${risk.status}
    ${risk.description ? `Description: ${risk.description}` : ''}
    ${risk.mitigationPlan ? `Mitigation: ${risk.mitigationPlan}` : ''}`
).join('\n')}`
).join('\n\n')}

HIGH-SEVERITY RISKS (Score ≥15):
${highSeverityRisks.map(risk => 
  `- ${risk.name} (Score: ${this.calculateRiskScore(risk)}): ${risk.description || 'No description'}`
).join('\n')}

TIMELINE PRESSURE:
- Days remaining: ${daysRemaining}
- Completion rate: ${completionRate}%
- Overdue tasks: ${overdueTasks}

Please provide a comprehensive risk analysis in JSON format:
{
  "overallRiskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskSummary": "Executive summary of overall risk posture (2-3 sentences)",
  "categoryInsights": [
    {
      "category": "category name",
      "count": number_of_risks,
      "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL", 
      "insight": "Strategic insight about this category (1-2 sentences)"
    }
  ],
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ],
  "criticalFactors": [
    "Critical success factor 1",
    "Critical success factor 2", 
    "Critical success factor 3"
  ]
}

Focus on:
1. Marina-specific risks (marine environmental, dock infrastructure, slip occupancy, seasonal factors)
2. Financial risks relative to purchase price and market conditions
3. Timeline risks given days remaining to closing
4. Regulatory and environmental compliance issues
5. Operational risks affecting property value

Provide specific, actionable insights that executives can act upon.
`;
  }

  /**
   * Categorize risks by their category
   */
  private categorizeRisks(risks: Risk[]): Record<string, Risk[]> {
    return risks.reduce((acc, risk) => {
      const category = risk.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(risk);
      return acc;
    }, {} as Record<string, Risk[]>);
  }

  /**
   * Calculate risk score based on impact and likelihood
   */
  private calculateRiskScore(risk: Risk): number {
    const impact = parseInt(risk.impact as string) || 3;
    const likelihood = parseInt(risk.likelihood as string) || 3;
    return impact * likelihood;
  }

  /**
   * Validate and format the AI response
   */
  private validateAndFormatResult(result: any): RiskAnalysisResult {
    return {
      overallRiskLevel: this.validateRiskLevel(result.overallRiskLevel) || 'MEDIUM',
      riskSummary: result.riskSummary || 'Risk analysis unavailable',
      categoryInsights: Array.isArray(result.categoryInsights) ? 
        result.categoryInsights.map((insight: any) => ({
          category: insight.category || 'Unknown',
          count: insight.count || 0,
          riskLevel: this.validateRiskLevel(insight.riskLevel) || 'MEDIUM',
          insight: insight.insight || 'No insight available'
        })) : [],
      recommendations: Array.isArray(result.recommendations) ? 
        result.recommendations.filter((rec: any) => typeof rec === 'string') : [],
      criticalFactors: Array.isArray(result.criticalFactors) ? 
        result.criticalFactors.filter((factor: any) => typeof factor === 'string') : []
    };
  }

  /**
   * Validate risk level values
   */
  private validateRiskLevel(level: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null {
    const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return validLevels.includes(level) ? level : null;
  }

  /**
   * Generate fallback analysis if AI fails
   */
  private generateFallbackAnalysis(context: RiskContext): RiskAnalysisResult {
    const { risks, daysRemaining, completionRate, overdueTasks } = context;
    
    const highRisks = risks.filter(risk => this.calculateRiskScore(risk) >= 15);
    const risksByCategory = this.categorizeRisks(risks);

    let overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    
    if (overdueTasks > 0 || daysRemaining <= 7 || highRisks.length >= 3) {
      overallRiskLevel = 'CRITICAL';
    } else if (daysRemaining <= 14 || completionRate < 60 || highRisks.length >= 1) {
      overallRiskLevel = 'HIGH';
    } else if (daysRemaining <= 30 || completionRate < 80) {
      overallRiskLevel = 'MEDIUM';
    }

    return {
      overallRiskLevel,
      riskSummary: `Based on ${risks.length} identified risks, ${overdueTasks} overdue tasks, and ${daysRemaining} days remaining, the project requires ${overallRiskLevel.toLowerCase()} attention.`,
      categoryInsights: Object.entries(risksByCategory).map(([category, categoryRisks]) => ({
        category,
        count: categoryRisks.length,
        riskLevel: categoryRisks.some(r => this.calculateRiskScore(r) >= 15) ? 'HIGH' : 'MEDIUM',
        insight: `${categoryRisks.length} ${category} risks identified requiring monitoring.`
      })),
      recommendations: [
        'Review and prioritize high-impact risks',
        'Accelerate completion of overdue tasks',
        'Monitor critical path dependencies'
      ],
      criticalFactors: [
        'Timeline adherence',
        'Risk mitigation execution', 
        'Stakeholder coordination'
      ]
    };
  }
}