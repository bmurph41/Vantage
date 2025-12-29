import type { LlmClassifier, ClassificationRequest, ClassificationResult, BatchClassificationResult } from './types';
import { MockLlmClassifier } from './mockProvider';
import { OpenAiClassifier } from './openaiProvider';
import { AnthropicClassifier } from './anthropicProvider';

export * from './types';

const LLM_PROVIDER = process.env.LLM_PROVIDER ?? 'mock';
const LLM_API_KEY = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
const LLM_MODEL = process.env.LLM_MODEL ?? '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

function createClassifier(providerName: string): LlmClassifier {
  switch (providerName.toLowerCase()) {
    case 'openai':
      if (!LLM_API_KEY) {
        console.warn('[LLM] OpenAI requested but no API key set, falling back to mock');
        return new MockLlmClassifier();
      }
      return new OpenAiClassifier({
        apiKey: LLM_API_KEY,
        model: LLM_MODEL || undefined,
      });

    case 'anthropic':
      const anthropicKey = ANTHROPIC_API_KEY || LLM_API_KEY;
      if (!anthropicKey) {
        console.warn('[LLM] Anthropic requested but no API key set, falling back to mock');
        return new MockLlmClassifier();
      }
      return new AnthropicClassifier({
        apiKey: anthropicKey,
        model: LLM_MODEL || undefined,
      });

    case 'none':
    case 'mock':
    default:
      return new MockLlmClassifier();
  }
}

let cachedClassifier: LlmClassifier | null = null;

export function getLlmClassifier(): LlmClassifier {
  if (!cachedClassifier) {
    cachedClassifier = createClassifier(LLM_PROVIDER);
    console.log(`[LLM] Initialized classifier: ${cachedClassifier.name}`);
  }
  return cachedClassifier;
}

export async function classifyLineItem(request: ClassificationRequest): Promise<ClassificationResult> {
  const classifier = getLlmClassifier();
  return classifier.classify(request);
}

export async function classifyLineItems(requests: ClassificationRequest[]): Promise<BatchClassificationResult> {
  const classifier = getLlmClassifier();
  return classifier.classifyBatch(requests);
}

export function resetLlmClassifier(): void {
  cachedClassifier = null;
}
