import type { EmbeddingProvider } from '../types';
import { V2_CONFIG } from '../config';
import { stubEmbedding, StubEmbeddingProvider } from './stubProvider';

const providerInstances = new Map<string, EmbeddingProvider>();

export function getEmbeddingProvider(): EmbeddingProvider {
  const providerName = V2_CONFIG.embeddings.provider;
  
  let provider = providerInstances.get(providerName);
  if (provider) return provider;
  
  switch (providerName) {
    case 'openai':
      provider = createOpenAIProvider();
      break;
    case 'stub':
    default:
      provider = new StubEmbeddingProvider();
      break;
  }
  
  providerInstances.set(providerName, provider);
  return provider;
}

function createOpenAIProvider(): EmbeddingProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = V2_CONFIG.embeddings.model;
  const dimensions = V2_CONFIG.embeddings.dimensions;
  
  return {
    name: 'openai',
    model,
    dimensions,
    
    async embed(text: string): Promise<number[]> {
      if (!apiKey) {
        return stubEmbedding(text, dimensions);
      }
      
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: text.slice(0, 8000),
            dimensions,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.data[0].embedding;
      } catch {
        return stubEmbedding(text, dimensions);
      }
    },
    
    async embedBatch(texts: string[]): Promise<number[][]> {
      if (!apiKey) {
        return texts.map(t => stubEmbedding(t, dimensions));
      }
      
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: texts.map(t => t.slice(0, 8000)),
            dimensions,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.data.map((d: { embedding: number[] }) => d.embedding);
      } catch {
        return texts.map(t => stubEmbedding(t, dimensions));
      }
    },
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}
