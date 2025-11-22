import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "",
});

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_ENV_VAR || "";

export async function summarizeArticle(text: string): Promise<string> {
  const prompt = `Summarize this marina industry article in 2-3 sentences for marina investors and operators. Focus on:
1. Marina relevance and implications
2. Investment/business impact
3. Operational considerations
4. Key financial or strategic details

Text: ${text.slice(0, 6000)}`;

  // Try OpenAI first if available
  if (process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a marina industry expert who creates concise, actionable summaries for marina investors and operators."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 200,
      });

      return response.choices[0]?.message?.content || "Summary unavailable";
    } catch (error) {
    }
  }

  // Fallback to Anthropic if available
  if (ANTHROPIC_API_KEY) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          system: "You are a marina industry expert who creates concise, actionable summaries for marina investors and operators.",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.content?.[0]?.text || "Summary unavailable";
      }
    } catch (error) {
    }
  }

  // Fallback to basic extraction if no AI is available
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.slice(0, 2).join(". ") + ".";
}

export async function analyzeMarketSentiment(text: string): Promise<{
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  keyFactors: string[];
}> {
  if (!process.env.OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
    return {
      sentiment: 'neutral',
      confidence: 0.5,
      keyFactors: []
    };
  }

  const prompt = `Analyze the market sentiment of this marina industry text. Consider factors like:
- Investment opportunities/risks
- Regulatory changes
- Market growth/decline
- Operational challenges/improvements

Respond with JSON: {"sentiment": "positive|negative|neutral", "confidence": 0.0-1.0, "keyFactors": ["factor1", "factor2"]}

Text: ${text.slice(0, 4000)}`;

  try {
    if (process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR) {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a marina industry market analyst. Analyze sentiment and provide JSON responses only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      return {
        sentiment: result.sentiment || 'neutral',
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        keyFactors: result.keyFactors || []
      };
    }
  } catch (error) {
  }

  return {
    sentiment: 'neutral',
    confidence: 0.5,
    keyFactors: []
  };
}
