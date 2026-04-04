/**
 * Knowledge Base Service — RAG pipeline, global cross-user learning, conversation persistence
 */

import OpenAI from 'openai';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

export async function ensureKnowledgeBaseSchema(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id      TEXT NOT NULL,
        user_id     TEXT,
        title       TEXT NOT NULL,
        description TEXT,
        content_text TEXT NOT NULL,
        source_type TEXT DEFAULT 'text',
        file_name   TEXT,
        mime_type   TEXT,
        status      TEXT DEFAULT 'processing',
        chunk_count INTEGER DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id  UUID NOT NULL REFERENCES ai_knowledge_documents(id) ON DELETE CASCADE,
        org_id       TEXT NOT NULL,
        chunk_index  INTEGER NOT NULL,
        content      TEXT NOT NULL,
        embedding    JSONB,
        metadata     JSONB DEFAULT '{}',
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org ON ai_knowledge_chunks(org_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_global_knowledge (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question      TEXT NOT NULL,
        answer        TEXT NOT NULL,
        advisory_mode TEXT DEFAULT 'general',
        asset_context TEXT,
        quality_score FLOAT DEFAULT 1.0,
        use_count     INTEGER DEFAULT 0,
        embedding     JSONB,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id        TEXT NOT NULL,
        user_id       TEXT,
        advisory_mode TEXT DEFAULT 'general',
        title         TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conversations_org_user ON ai_conversations(org_id, user_id)`);

    // ai_conversation_messages may already exist with a different schema (session_id vs conversation_id).
    // Wrap in its own try/catch so type/column mismatches don't abort the rest of bootstrap.
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ai_conversation_messages (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
          role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content         TEXT NOT NULL,
          advisory_mode   TEXT,
          page            TEXT,
          rag_chunk_ids   JSONB DEFAULT '[]',
          metadata        JSONB DEFAULT '{}',
          created_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON ai_conversation_messages(conversation_id)`);
    } catch (_innerErr) {
      // Existing table schema differs — index/FK creation skipped gracefully
    }

    console.log('[KnowledgeBase] Schema ensured');
  } catch (err) {
    console.error('[KnowledgeBase] Schema bootstrap error:', err);
  }
}

async function embed(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('[KnowledgeBase] Embedding error:', err);
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 6));
      current = overlapWords.join(' ') + ' ' + sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 20);
}

export async function ingestDocument(params: {
  orgId: string;
  userId?: string;
  title: string;
  description?: string;
  contentText: string;
  sourceType?: string;
  fileName?: string;
  mimeType?: string;
}): Promise<{ id: string; chunkCount: number }> {
  const docResult = await db.execute(sql`
    INSERT INTO ai_knowledge_documents
      (org_id, user_id, title, description, content_text, source_type, file_name, mime_type, status)
    VALUES
      (${params.orgId}, ${params.userId ?? null}, ${params.title},
       ${params.description ?? null}, ${params.contentText},
       ${params.sourceType ?? 'text'}, ${params.fileName ?? null}, ${params.mimeType ?? null},
       'processing')
    RETURNING id
  `);
  const docId = (docResult.rows[0] as any).id as string;

  setImmediate(async () => {
    try {
      const chunks = chunkText(params.contentText);
      let inserted = 0;
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embed(chunks[i]);
        await db.execute(sql`
          INSERT INTO ai_knowledge_chunks (document_id, org_id, chunk_index, content, embedding)
          VALUES (${docId}::uuid, ${params.orgId}, ${i}, ${chunks[i]}, ${JSON.stringify(embedding)}::jsonb)
        `);
        inserted++;
      }
      await db.execute(sql`
        UPDATE ai_knowledge_documents
        SET status = 'ready', chunk_count = ${inserted}, updated_at = NOW()
        WHERE id = ${docId}::uuid
      `);
      console.log(`[KnowledgeBase] Ingested ${docId}: ${inserted} chunks`);
    } catch (err) {
      console.error('[KnowledgeBase] Chunk/embed error:', err);
      await db.execute(sql`UPDATE ai_knowledge_documents SET status = 'error' WHERE id = ${docId}::uuid`);
    }
  });

  return { id: docId, chunkCount: 0 };
}

export async function getRAGContext(
  orgId: string,
  query: string,
  topK = 5
): Promise<{ context: string; chunkIds: string[] }> {
  try {
    const queryEmbedding = await embed(query);
    if (!queryEmbedding.length) return { context: '', chunkIds: [] };

    const [orgChunks, globalChunks] = await Promise.all([
      db.execute(sql`
        SELECT id, content, embedding FROM ai_knowledge_chunks
        WHERE org_id = ${orgId} AND embedding IS NOT NULL
        ORDER BY created_at DESC LIMIT 200
      `),
      db.execute(sql`
        SELECT id::text as id, answer as content, embedding, question FROM ai_global_knowledge
        WHERE embedding IS NOT NULL
        ORDER BY quality_score DESC, use_count DESC LIMIT 100
      `),
    ]);

    const allChunks = [
      ...(orgChunks.rows as any[]).map(r => ({
        id: r.id, source: 'org',
        content: r.content,
        embedding: typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding,
      })),
      ...(globalChunks.rows as any[]).map(r => ({
        id: r.id, source: 'global',
        content: r.question ? `Q: ${r.question}\nA: ${r.content}` : r.content,
        embedding: typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding,
      })),
    ];

    const scored = allChunks
      .map(c => ({ ...c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
      .filter(c => c.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (!scored.length) return { context: '', chunkIds: [] };

    const context = `\n\n## Relevant Knowledge Base Context\n${scored.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')}`;

    const globalIds = scored.filter(c => c.source === 'global').map(c => c.id);
    for (const gid of globalIds) {
      await db.execute(sql`UPDATE ai_global_knowledge SET use_count = use_count + 1 WHERE id = ${gid}::uuid`).catch(() => {});
    }

    return { context, chunkIds: scored.map(c => c.id) };
  } catch (err) {
    console.error('[KnowledgeBase] RAG error:', err);
    return { context: '', chunkIds: [] };
  }
}

export async function learnFromFeedback(params: {
  orgId: string;
  userQuery: string;
  assistantResponse: string;
  rating: 'positive' | 'negative';
  advisoryMode?: string;
}): Promise<void> {
  if (params.rating !== 'positive') return;
  if (params.userQuery.length < 10 || params.assistantResponse.length < 50) return;

  try {
    const orgDoc = `Q: ${params.userQuery}\n\nA: ${params.assistantResponse}`;
    await ingestDocument({
      orgId: params.orgId,
      title: `Learned: ${params.userQuery.slice(0, 80)}`,
      contentText: orgDoc,
      sourceType: 'feedback',
    });

    const isGeneral = ['cap rate','noi','irr','dscr','ltv','occupancy','benchmark','market','how to',
      'what is','should i','best practice','due diligence','risk','valuation','financing','exit']
      .some(t => params.userQuery.toLowerCase().includes(t));

    if (isGeneral) {
      const embedding = await embed(params.userQuery + ' ' + params.assistantResponse.slice(0, 300));
      await db.execute(sql`
        INSERT INTO ai_global_knowledge (question, answer, advisory_mode, embedding, quality_score)
        VALUES (${params.userQuery}, ${params.assistantResponse}, ${params.advisoryMode ?? 'general'}, ${JSON.stringify(embedding)}::jsonb, 1.0)
        ON CONFLICT DO NOTHING
      `);
      console.log('[KnowledgeBase] Contributed to global knowledge pool');
    }
  } catch (err) {
    console.error('[KnowledgeBase] learnFromFeedback error:', err);
  }
}

export async function getOrCreateConversation(params: {
  orgId: string; userId: string; conversationId?: string; advisoryMode?: string;
}): Promise<string> {
  if (params.conversationId) {
    const existing = await db.execute(sql`
      SELECT id FROM ai_conversations WHERE id = ${params.conversationId} AND org_id = ${params.orgId}
    `);
    if (existing.rows.length) {
      await db.execute(sql`UPDATE ai_conversations SET last_message_at = NOW() WHERE id = ${params.conversationId}`).catch(() => {});
      return params.conversationId;
    }
  }
  const result = await db.execute(sql`
    INSERT INTO ai_conversations (org_id, user_id, advisory_mode)
    VALUES (${params.orgId}, ${params.userId}, ${params.advisoryMode ?? 'general'})
    RETURNING id
  `);
  return (result.rows[0] as any).id as string;
}

export async function saveMessage(params: {
  conversationId: string; role: 'user' | 'assistant'; content: string;
  advisoryMode?: string; page?: string; ragChunkIds?: string[]; metadata?: Record<string, any>;
}): Promise<void> {
  const meta = {
    ...(params.metadata ?? {}),
    ...(params.advisoryMode ? { advisoryMode: params.advisoryMode } : {}),
    ...(params.page ? { page: params.page } : {}),
    ...(params.ragChunkIds?.length ? { ragChunkIds: params.ragChunkIds } : {}),
  };
  await db.execute(sql`
    INSERT INTO ai_conversation_messages
      (session_id, role, content, metadata)
    VALUES (
      ${params.conversationId}::uuid, ${params.role}, ${params.content},
      ${JSON.stringify(meta)}::jsonb
    )
  `);
}

export async function getConversationHistory(conversationId: string): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT role, content, created_at FROM ai_conversation_messages
    WHERE session_id = ${conversationId}::uuid
    ORDER BY created_at ASC LIMIT 50
  `);
  return (result.rows as any[]).map(r => ({ role: r.role, content: r.content, createdAt: r.created_at }));
}

export async function listConversations(orgId: string, userId: string): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT c.id, c.advisory_mode, c.title, c.last_message_at, COUNT(m.id)::int as message_count
    FROM ai_conversations c
    LEFT JOIN ai_conversation_messages m ON m.session_id = c.id::uuid
    WHERE c.org_id = ${orgId} AND c.user_id = ${userId}
    GROUP BY c.id ORDER BY c.last_message_at DESC NULLS LAST LIMIT 50
  `);
  return (result.rows as any[]).map(r => ({
    id: r.id, advisoryMode: r.advisory_mode, title: r.title,
    updatedAt: r.last_message_at, messageCount: r.message_count,
  }));
}

export async function listDocuments(orgId: string): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT id, title, description, source_type, file_name, chunk_count, status, created_at
    FROM ai_knowledge_documents WHERE org_id = ${orgId} ORDER BY created_at DESC
  `);
  return (result.rows as any[]).map(r => ({
    id: r.id, title: r.title, description: r.description,
    sourceType: r.source_type, fileName: r.file_name,
    chunkCount: r.chunk_count, status: r.status, createdAt: r.created_at,
  }));
}

export async function getDocument(id: string, orgId: string): Promise<any | null> {
  const result = await db.execute(sql`
    SELECT * FROM ai_knowledge_documents WHERE id = ${id}::uuid AND org_id = ${orgId}
  `);
  return (result.rows[0] as any) ?? null;
}

export async function deleteDocument(id: string, orgId: string): Promise<boolean> {
  const result = await db.execute(sql`
    DELETE FROM ai_knowledge_documents WHERE id = ${id}::uuid AND org_id = ${orgId} RETURNING id
  `);
  return result.rows.length > 0;
}

export async function getGlobalKnowledgeStats(): Promise<any> {
  try {
    const [count, uses, modes] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int as n FROM ai_global_knowledge`),
      db.execute(sql`SELECT COALESCE(SUM(use_count), 0)::int as n FROM ai_global_knowledge`),
      db.execute(sql`SELECT advisory_mode as mode, COUNT(*)::int as count FROM ai_global_knowledge GROUP BY advisory_mode ORDER BY count DESC`),
    ]);
    return {
      totalEntries: (count.rows[0] as any).n,
      totalUses: (uses.rows[0] as any).n,
      topModes: (modes.rows as any[]).map(r => ({ mode: r.mode, count: r.count })),
    };
  } catch {
    return { totalEntries: 0, totalUses: 0, topModes: [] };
  }
}
