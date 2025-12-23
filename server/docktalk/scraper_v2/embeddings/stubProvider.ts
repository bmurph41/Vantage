import type { EmbeddingProvider } from '../types';
import { sha256 } from '../utils/hash';
import { V2_CONFIG } from '../config';

export function stubEmbedding(text: string, dimensions: number): number[] {
  const hash = sha256(text.toLowerCase().trim());
  const vector: number[] = [];
  
  for (let i = 0; i < dimensions; i++) {
    const charIndex = (i * 2) % hash.length;
    const hexValue = parseInt(hash.slice(charIndex, charIndex + 2), 16);
    const normalized = (hexValue / 255) * 2 - 1;
    vector.push(normalized);
  }
  
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / magnitude);
}

export class StubEmbeddingProvider implements EmbeddingProvider {
  name = 'stub';
  model = 'hash-based-stub';
  dimensions = V2_CONFIG.embeddings.dimensions;
  
  async embed(text: string): Promise<number[]> {
    return stubEmbedding(text, this.dimensions);
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(t => stubEmbedding(t, this.dimensions));
  }
}

export function generateTopicEmbedding(topicStatement: string): number[] {
  return stubEmbedding(topicStatement, V2_CONFIG.embeddings.dimensions);
}
