let openAIQuotaExhausted = false;
let lastQuotaCheck: Date | null = null;

export function shouldSkipAIFeatures(): boolean {
  if (!process.env.OPENAI_API_KEY) {
    return true;
  }
  if (openAIQuotaExhausted && lastQuotaCheck) {
    const hoursSinceCheck = (Date.now() - lastQuotaCheck.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCheck < 1) {
      return true;
    }
    openAIQuotaExhausted = false;
  }
  return false;
}

export function reportOpenAIQuotaExhausted(): void {
  if (!openAIQuotaExhausted) {
    openAIQuotaExhausted = true;
    lastQuotaCheck = new Date();
    console.log('[AI Quota] OpenAI quota exhausted - AI features paused for 1 hour');
  }
}

export function getQuotaStatus(): { exhausted: boolean; resumeTime: Date | null } {
  if (!openAIQuotaExhausted || !lastQuotaCheck) {
    return { exhausted: false, resumeTime: null };
  }
  return {
    exhausted: true,
    resumeTime: new Date(lastQuotaCheck.getTime() + 60 * 60 * 1000)
  };
}
