import OpenAI from 'openai';
import type { DocPage, InsertVectorChunk } from '@shared/schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChunkWithMetadata {
  text: string;
  pageId: string;
  pageNo: number;
  documentId: string;
  startChar: number;
  endChar: number;
}

export interface SearchResult {
  chunkId: string;
  text: string;
  similarity: number;
  documentId: string;
  pageId: string;
  pageNo: number;
  metadata: Record<string, any> | null;
}

export class RAGService {
  private readonly CHUNK_SIZE = 800; // tokens (approximately 3200 characters)
  private readonly CHUNK_OVERLAP = 200; // tokens (approximately 800 characters)
  private readonly EMBEDDING_MODEL = 'text-embedding-ada-002';
  private readonly EMBEDDING_DIMENSIONS = 1536;

  /**
   * Chunk text into overlapping segments
   */
  chunkText(text: string, pageId: string, pageNo: number, documentId: string): ChunkWithMetadata[] {
    const chunks: ChunkWithMetadata[] = [];
    
    // Simple character-based chunking (approximation: 1 token ≈ 4 characters)
    const chunkSizeChars = this.CHUNK_SIZE * 4;
    const overlapChars = this.CHUNK_OVERLAP * 4;
    const stepSize = chunkSizeChars - overlapChars;

    let startChar = 0;
    
    while (startChar < text.length) {
      const endChar = Math.min(startChar + chunkSizeChars, text.length);
      const chunkText = text.substring(startChar, endChar).trim();
      
      if (chunkText.length > 100) { // Only create chunks with meaningful content
        chunks.push({
          text: chunkText,
          pageId,
          pageNo,
          documentId,
          startChar,
          endChar,
        });
      }
      
      // If we've reached the end, break
      if (endChar >= text.length) break;
      
      startChar += stepSize;
    }

    return chunks;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      // OpenAI allows up to 2048 inputs per request, but we'll use smaller batches
      const batchSize = 100;
      const embeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await openai.embeddings.create({
          model: this.EMBEDDING_MODEL,
          input: batch,
        });
        
        embeddings.push(...response.data.map(d => d.embedding));
      }

      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings batch:', error);
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a document page: chunk it and generate embeddings
   */
  async processDocumentPage(page: DocPage, projectId: string): Promise<InsertVectorChunk[]> {
    // Chunk the text
    const chunks = this.chunkText(page.text, page.id, page.pageNo, page.documentId);
    
    if (chunks.length === 0) {
      return [];
    }

    // Generate embeddings for all chunks
    const texts = chunks.map(c => c.text);
    const embeddings = await this.generateEmbeddingsBatch(texts);

    // Create vector chunk records
    const vectorChunks: InsertVectorChunk[] = chunks.map((chunk, index) => ({
      projectId,
      sourceType: 'doc_page',
      sourceId: chunk.pageId,
      contentText: chunk.text,
      embedding: embeddings[index],
      metadata: {
        documentId: chunk.documentId,
        pageNo: chunk.pageNo,
        chunkIndex: index,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        chunkSize: chunk.text.length,
      },
    }));

    return vectorChunks;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

export const ragService = new RAGService();
