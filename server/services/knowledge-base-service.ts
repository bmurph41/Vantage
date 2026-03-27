/**
 * server/services/knowledge-base-service.ts
 *
 * Knowledge Base Service — document ingestion, chunking, embedding,
 * and semantic retrieval (RAG) for the AI assistant.
 */

import OpenAI from 'openai';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  knowledgeDocuments,
  knowledgeChunks,
  aiConversations,
  aiMessages,
} from '@shared/schema';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

// ─── Document Ingestion ─────────────────────────────────────────────────────

const CHUNK_SIZE = 1200;      // ~300 tokens per chunk
const CHUNK_OVERLAP = 200;    // overlap for context continuity

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of current chunk
      const overlapStart = Math.max(0, current.length - CHUNK_OVERLAP);
      current = current.slice(overlapStart) + '\n\n' + trimmed;
    } else {
      current += (current ? '\n\n' : '') + trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If text has no paragraph breaks, split by sentences
  if (chunks.length === 0 && text.trim().length > 0) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    current = '';
    for (const sentence of sentences) {
      if (current.length + sentence.length > CHUNK_SIZE && current.length > 0) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += (current ? ' ' : '') + sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // limit to model max
  });
  return response.data[0].embedding;
}

async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // Process in batches of 20 to stay under rate limits
  const batchSize = 20;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map(t => t.slice(0, 8000));
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    allEmbeddings.push(...response.data.map(d => d.embedding));
  }

  return allEmbeddings;
}

/**
 * Ingest a document: store metadata, chunk text, generate embeddings.
 */
export async function ingestDocument(params: {
  orgId: string;
  userId: string;
  title: string;
  description?: string;
  contentText: string;
  sourceType: 'upload' | 'text' | 'url';
  fileName?: string;
  mimeType?: string;
}): Promise<{ documentId: string; chunkCount: number }> {
  const { orgId, userId, title, description, contentText, sourceType, fileName, mimeType } = params;

  // 1. Create document record
  const [doc] = await db.insert(knowledgeDocuments).values({
    orgId,
    title,
    description,
    sourceType,
    fileName,
    mimeType,
    contentText,
    status: 'processing',
    uploadedBy: userId,
  }).returning();

  try {
    // 2. Split into chunks
    const chunks = splitIntoChunks(contentText);

    if (chunks.length === 0) {
      await db.update(knowledgeDocuments)
        .set({ status: 'error', chunkCount: 0, updatedAt: new Date() })
        .where(eq(knowledgeDocuments.id, doc.id));
      return { documentId: doc.id, chunkCount: 0 };
    }

    // 3. Generate embeddings for all chunks
    const embeddings = await generateEmbeddingsBatch(chunks);

    // 4. Store chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      await db.insert(knowledgeChunks).values({
        documentId: doc.id,
        orgId,
        chunkIndex: i,
        contentText: chunks[i],
        embedding: embeddings[i],
        tokenCount: Math.ceil(chunks[i].length / 4),
      });
    }

    // 5. Mark document as ready
    await db.update(knowledgeDocuments)
      .set({ status: 'ready', chunkCount: chunks.length, updatedAt: new Date() })
      .where(eq(knowledgeDocuments.id, doc.id));

    console.log(`[Knowledge Base] Ingested "${title}": ${chunks.length} chunks`);
    return { documentId: doc.id, chunkCount: chunks.length };
  } catch (error: any) {
    console.error(`[Knowledge Base] Ingestion failed for "${title}":`, error);
    await db.update(knowledgeDocuments)
      .set({ status: 'error', updatedAt: new Date() })
      .where(eq(knowledgeDocuments.id, doc.id));
    throw error;
  }
}

// ─── Semantic Search (RAG Retrieval) ────────────────────────────────────────

/**
 * Search the knowledge base for chunks relevant to a query.
 * Uses cosine similarity via pgvector.
 */
export async function searchKnowledgeBase(params: {
  orgId: string;
  query: string;
  topK?: number;
  minSimilarity?: number;
}): Promise<{ id: string; content: string; similarity: number; documentTitle: string }[]> {
  const { orgId, query, topK = 5, minSimilarity = 0.3 } = params;

  try {
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Use pgvector cosine distance operator <=> for similarity search
    const results = await db.execute(sql`
      SELECT
        kc.id,
        kc.content_text,
        kd.title as document_title,
        1 - (kc.embedding <=> ${embeddingStr}::vector) as similarity
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kc.org_id = ${orgId}
        AND kd.status = 'ready'
        AND kc.embedding IS NOT NULL
        AND 1 - (kc.embedding <=> ${embeddingStr}::vector) > ${minSimilarity}
      ORDER BY kc.embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `);

    return (results.rows as any[]).map(r => ({
      id: r.id,
      content: r.content_text,
      similarity: parseFloat(r.similarity),
      documentTitle: r.document_title,
    }));
  } catch (error: any) {
    // If pgvector is not installed or table doesn't exist, return empty
    console.error('[Knowledge Base] Search error:', error.message);
    return [];
  }
}

/**
 * Build a RAG context string from knowledge base results.
 */
export async function getRAGContext(orgId: string, userMessage: string): Promise<{ context: string; chunkIds: string[] }> {
  const results = await searchKnowledgeBase({ orgId, query: userMessage, topK: 4 });

  if (results.length === 0) {
    return { context: '', chunkIds: [] };
  }

  const context = results
    .map((r, i) => `[Source: ${r.documentTitle}]\n${r.content}`)
    .join('\n\n---\n\n');

  return {
    context: `\n\n## Relevant Knowledge Base Context\nThe following excerpts from your organization's knowledge base are relevant:\n\n${context}`,
    chunkIds: results.map(r => r.id),
  };
}

// ─── Document Management ────────────────────────────────────────────────────

export async function listDocuments(orgId: string): Promise<any[]> {
  return db.select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.orgId, orgId))
    .orderBy(desc(knowledgeDocuments.createdAt));
}

export async function getDocument(docId: string, orgId: string) {
  const [doc] = await db.select()
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeDocuments.orgId, orgId)))
    .limit(1);
  return doc || null;
}

export async function deleteDocument(docId: string, orgId: string): Promise<boolean> {
  const [doc] = await db.select()
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeDocuments.orgId, orgId)))
    .limit(1);

  if (!doc) return false;

  // Cascade delete handles chunks
  await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, docId));
  console.log(`[Knowledge Base] Deleted document "${doc.title}" and its chunks`);
  return true;
}

// ─── Conversation Persistence ───────────────────────────────────────────────

export async function getOrCreateConversation(params: {
  orgId: string;
  userId: string;
  conversationId?: string;
  advisoryMode?: string;
}): Promise<string> {
  const { orgId, userId, conversationId, advisoryMode } = params;

  if (conversationId) {
    const [existing] = await db.select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.orgId, orgId),
      ))
      .limit(1);
    if (existing) return existing.id;
  }

  const [conv] = await db.insert(aiConversations).values({
    orgId,
    userId,
    advisoryMode: advisoryMode || 'general',
    messageCount: 0,
  }).returning();

  return conv.id;
}

export async function saveMessage(params: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  advisoryMode?: string;
  page?: string;
  ragChunkIds?: string[];
}): Promise<string> {
  const { conversationId, role, content, advisoryMode, page, ragChunkIds } = params;

  const [msg] = await db.insert(aiMessages).values({
    conversationId,
    role,
    content,
    advisoryMode,
    page,
    ragChunkIds: ragChunkIds || [],
  }).returning();

  // Update conversation stats
  await db.update(aiConversations)
    .set({
      messageCount: sql`${aiConversations.messageCount} + 1`,
      lastMessageAt: new Date(),
      title: role === 'user' && content.length > 0
        ? sql`COALESCE(${aiConversations.title}, ${content.slice(0, 100)})`
        : aiConversations.title,
    })
    .where(eq(aiConversations.id, conversationId));

  return msg.id;
}

export async function getConversationHistory(conversationId: string, limit = 20): Promise<{ role: string; content: string }[]> {
  const messages = await db.select({
    role: aiMessages.role,
    content: aiMessages.content,
  })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(limit);

  return messages.reverse();
}

export async function listConversations(orgId: string, userId: string, limit = 20) {
  return db.select()
    .from(aiConversations)
    .where(and(
      eq(aiConversations.orgId, orgId),
      eq(aiConversations.userId, userId),
    ))
    .orderBy(desc(aiConversations.lastMessageAt))
    .limit(limit);
}

/**
 * Learn from positive feedback — store highly-rated Q&A pairs
 * so they can be retrieved as examples in future similar queries.
 */
export async function learnFromFeedback(params: {
  orgId: string;
  userQuery: string;
  assistantResponse: string;
  rating: 'positive' | 'negative';
  advisoryMode: string;
}): Promise<void> {
  if (params.rating !== 'positive') return;

  try {
    // Store the positively-rated Q&A as a knowledge chunk so it can be
    // retrieved via RAG for similar future questions
    const qaText = `Q: ${params.userQuery}\nA: ${params.assistantResponse}`;
    const embedding = await generateEmbedding(qaText);

    // Find or create a "Learned Responses" document for this org
    let [learnedDoc] = await db.select()
      .from(knowledgeDocuments)
      .where(and(
        eq(knowledgeDocuments.orgId, params.orgId),
        eq(knowledgeDocuments.sourceType, 'learned'),
      ))
      .limit(1);

    if (!learnedDoc) {
      [learnedDoc] = await db.insert(knowledgeDocuments).values({
        orgId: params.orgId,
        title: 'Learned from User Feedback',
        description: 'Automatically curated Q&A pairs rated positively by users',
        sourceType: 'learned',
        status: 'ready',
        chunkCount: 0,
      }).returning();
    }

    // Add the Q&A as a new chunk
    await db.insert(knowledgeChunks).values({
      documentId: learnedDoc.id,
      orgId: params.orgId,
      chunkIndex: (learnedDoc.chunkCount || 0) + 1,
      contentText: qaText,
      embedding,
      tokenCount: Math.ceil(qaText.length / 4),
      metadata: { advisoryMode: params.advisoryMode, type: 'learned_qa' },
    });

    await db.update(knowledgeDocuments)
      .set({
        chunkCount: sql`${knowledgeDocuments.chunkCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, learnedDoc.id));

    console.log(`[Knowledge Base] Learned from positive feedback (mode: ${params.advisoryMode})`);
  } catch (error) {
    console.error('[Knowledge Base] Learning from feedback failed:', error);
  }
}
