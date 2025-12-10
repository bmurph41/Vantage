import { Router } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { generateOmContent, improveContent, suggestLayout, type GenerateRequest } from "../ai-service";

const router = Router();

const generateRequestSchema = z.object({
  type: z.enum(['executive_summary', 'investment_highlights', 'market_commentary', 'financial_analysis', 'property_description', 'custom']),
  propertyContext: z.object({
    propertyName: z.string().optional(),
    propertyType: z.string().optional(),
    location: z.string().optional(),
    size: z.string().optional(),
    yearBuilt: z.string().optional(),
    occupancy: z.string().optional(),
    askingPrice: z.string().optional(),
    noi: z.string().optional(),
    capRate: z.string().optional(),
    tenants: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
    additionalNotes: z.string().optional(),
  }).optional(),
  marketContext: z.object({
    location: z.string().optional(),
    medianRent: z.number().optional(),
    vacancyRate: z.number().optional(),
    population: z.number().optional(),
    employmentGrowth: z.number().optional(),
    medianIncome: z.number().optional(),
    marketTrends: z.string().optional(),
  }).optional(),
  customPrompt: z.string().optional(),
  existingContent: z.string().optional(),
  tone: z.enum(['professional', 'compelling', 'conservative']).optional(),
});

router.post("/generate", async (req, res) => {
  try {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }

    const content = await generateOmContent(parsed.data as GenerateRequest);
    res.json({ content });
  } catch (error: any) {
    console.error("Error generating AI content:", error);
    if (error.message?.includes("AI integration not configured")) {
      return res.status(503).json({ error: "AI service is not configured. Please set up the OpenAI integration." });
    }
    res.status(500).json({ error: "Failed to generate content. Please try again." });
  }
});

router.post("/improve", async (req, res) => {
  try {
    const schema = z.object({
      content: z.string().min(1),
      instruction: z.string().min(1),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }

    const improved = await improveContent(parsed.data.content, parsed.data.instruction);
    res.json({ content: improved });
  } catch (error: any) {
    console.error("Error improving content:", error);
    if (error.message?.includes("AI integration not configured")) {
      return res.status(503).json({ error: "AI service is not configured. Please set up the OpenAI integration." });
    }
    res.status(500).json({ error: "Failed to improve content. Please try again." });
  }
});

router.post("/suggest-layout", async (req, res) => {
  try {
    const schema = z.object({
      contentDescription: z.string().min(1),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }

    const suggestion = await suggestLayout(parsed.data.contentDescription);
    res.json(suggestion);
  } catch (error: any) {
    console.error("Error suggesting layout:", error);
    if (error.message?.includes("AI integration not configured")) {
      return res.status(503).json({ error: "AI service is not configured. Please set up the OpenAI integration." });
    }
    res.status(500).json({ error: "Failed to suggest layout. Please try again." });
  }
});

export default router;
