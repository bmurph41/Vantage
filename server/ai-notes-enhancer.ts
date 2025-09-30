import OpenAI from "openai";
import type { Project, Task } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface NotesEnhancementResult {
  enhancedNarrative: string;
  performanceAnalysis: string;
  timelineAssessment: string;
}

interface NotesContext {
  project: Project;
  tasks: Task[];
  userNotes: string;
  completionRate: number;
  daysRemaining: number;
  overdueTasks: number;
  totalTasks: number;
}

export class AINotesEnhancer {
  /**
   * Enhance user's notes into a compelling executive narrative
   */
  async enhanceNotes(context: NotesContext): Promise<NotesEnhancementResult> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const prompt = this.buildEnhancementPrompt(context);

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are a senior executive communications advisor specializing in crafting compelling narratives for marina acquisition due diligence reports. 
            Your expertise includes transforming brief notes into polished, strategic insights that resonate with board members and executives.
            Take the user's notes and enhance them into a professional, compelling narrative while preserving their key points and intent.
            The tone should be authoritative, strategic, and focused on executive decision-making.
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
      return this.validateAndFormatResult(result, context);

    } catch (error) {
      console.error('AI Notes Enhancement failed:', error);
      // Fallback to basic formatting if AI fails
      return this.generateFallbackNarrative(context);
    }
  }

  /**
   * Build the enhancement prompt with project context
   */
  private buildEnhancementPrompt(context: NotesContext): string {
    const { project, userNotes, completionRate, daysRemaining, overdueTasks, totalTasks } = context;

    return `
Project: ${project.name}
User's Notes: ${userNotes || "No notes provided yet"}

Project Metrics:
- Completion Rate: ${completionRate}%
- Days Until Closing: ${daysRemaining}
- Total Tasks: ${totalTasks}
- Overdue Tasks: ${overdueTasks}

Based on the user's notes above, create a compelling executive narrative that:
1. Expands on the user's key points
2. Maintains their original insights and intentions
3. Uses strategic, executive-level language
4. Provides actionable perspectives
5. Demonstrates operational expertise and market awareness

If no notes are provided, generate a brief placeholder encouraging the user to add their insights.

Response must be in this exact JSON format:
{
  "enhancedNarrative": "The full enhanced narrative combining all insights",
  "performanceAnalysis": "Enhanced perspective on project performance",
  "timelineAssessment": "Enhanced perspective on timeline and deadlines"
}`;
  }

  /**
   * Validate and format the AI response
   */
  private validateAndFormatResult(result: any, context: NotesContext): NotesEnhancementResult {
    return {
      enhancedNarrative: result.enhancedNarrative || this.generateFallbackNarrative(context).enhancedNarrative,
      performanceAnalysis: result.performanceAnalysis || "Project tracking is progressing as expected.",
      timelineAssessment: result.timelineAssessment || `Timeline remains on track with ${context.daysRemaining} days until closing.`,
    };
  }

  /**
   * Generate fallback narrative when AI is unavailable
   */
  private generateFallbackNarrative(context: NotesContext): NotesEnhancementResult {
    const { userNotes, completionRate, daysRemaining } = context;

    if (!userNotes || userNotes.trim() === '') {
      return {
        enhancedNarrative: "No executive notes have been added yet. Add your insights and observations to generate an AI-enhanced narrative.",
        performanceAnalysis: `Project is ${completionRate}% complete with ${context.totalTasks} total tasks tracked.`,
        timelineAssessment: `Timeline shows ${daysRemaining} days remaining until the closing deadline.`,
      };
    }

    return {
      enhancedNarrative: userNotes,
      performanceAnalysis: `${userNotes} The project is currently ${completionRate}% complete.`,
      timelineAssessment: `Timeline considerations: ${daysRemaining} days remaining to closing.`,
    };
  }
}
