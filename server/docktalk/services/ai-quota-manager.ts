let openAIQuotaExhausted = false;
let lastQuotaCheck: Date | null = null;
let consecutiveFailures = 0;
let lastRequestTime = 0;
let backoffMs = 0;

const MIN_REQUEST_INTERVAL_MS = 500;
const MAX_BACKOFF_MS = 30 * 60 * 1000;
const BASE_BACKOFF_MS = 5000;
const MAX_CONSECUTIVE_FAILURES = 10;

export function shouldSkipAIFeatures(): boolean {
  if (!process.env.OPENAI_API_KEY) {
    return true;
  }
  if (openAIQuotaExhausted && lastQuotaCheck) {
    const hoursSinceCheck = (Date.now() - lastQuotaCheck.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCheck < 2) {
      return true;
    }
    openAIQuotaExhausted = false;
    consecutiveFailures = 0;
    backoffMs = 0;
    console.log('[AI Quota] Quota cooldown expired - resuming AI features');
  }
  return false;
}

export async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const waitTime = Math.max(MIN_REQUEST_INTERVAL_MS, backoffMs) - timeSinceLastRequest;
  
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
}

export function reportOpenAISuccess(): void {
  if (consecutiveFailures > 0) {
    consecutiveFailures = Math.max(0, consecutiveFailures - 1);
    backoffMs = Math.max(0, backoffMs / 2);
  }
}

export function reportOpenAIQuotaExhausted(): void {
  consecutiveFailures++;
  
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    if (!openAIQuotaExhausted) {
      openAIQuotaExhausted = true;
      lastQuotaCheck = new Date();
      console.log('[AI Quota] OpenAI quota exhausted after', consecutiveFailures, 'failures - AI features paused for 2 hours');
    }
    return;
  }
  
  backoffMs = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, consecutiveFailures - 1));
  console.log('[AI Quota] OpenAI rate limit hit - backing off for', Math.round(backoffMs / 1000), 'seconds');
}

export function getQuotaStatus(): { 
  exhausted: boolean; 
  resumeTime: Date | null;
  consecutiveFailures: number;
  currentBackoffMs: number;
} {
  if (!openAIQuotaExhausted || !lastQuotaCheck) {
    return { 
      exhausted: false, 
      resumeTime: null,
      consecutiveFailures,
      currentBackoffMs: backoffMs
    };
  }
  return {
    exhausted: true,
    resumeTime: new Date(lastQuotaCheck.getTime() + 2 * 60 * 60 * 1000),
    consecutiveFailures,
    currentBackoffMs: backoffMs
  };
}

export function resetQuotaState(): void {
  openAIQuotaExhausted = false;
  lastQuotaCheck = null;
  consecutiveFailures = 0;
  backoffMs = 0;
  console.log('[AI Quota] Quota state manually reset');
}
