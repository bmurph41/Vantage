export interface LlmConfig {
  provider: 'openai' | 'anthropic' | 'mock' | 'none';
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClassificationRequest {
  label: string;
  normalizedLabel: string;
  context?: {
    nearbyLabels?: string[];
    documentType?: string;
    vendorHint?: string;
  };
}

export interface ClassificationResult {
  canonicalKey?: string;
  department: string;
  section: 'revenue' | 'cogs' | 'expense' | 'payroll' | 'other';
  confidence: number;
  reasoning?: string;
  alternatives?: Array<{
    canonicalKey: string;
    department: string;
    section: string;
    confidence: number;
  }>;
}

export interface BatchClassificationResult {
  results: Map<string, ClassificationResult>;
  tokensUsed?: number;
  processingTime?: number;
}

export interface LlmClassifier {
  name: string;
  classify(request: ClassificationRequest): Promise<ClassificationResult>;
  classifyBatch(requests: ClassificationRequest[]): Promise<BatchClassificationResult>;
}
