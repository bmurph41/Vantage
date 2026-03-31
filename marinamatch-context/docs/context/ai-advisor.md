# MarinaMatch — AI Advisor & RAG System

## Architecture Overview

```
User Question
      ↓
Query Embedding (OpenAI text-embedding-3-small)
      ↓
Vector Similarity Search (knowledge base)
      ↓
Context Assembly
  - Relevant knowledge chunks
  - Entity context (deal/property data)
  - Deal comparisons (if requested)
      ↓
LLM Completion (GPT-4o)
      ↓
Response (with source citations)
```

---

## Knowledge Base Service

File: `server/services/knowledge-base-service.ts`

This is the canonical service for all knowledge base operations.
Do not create additional embedding or vector search services.

### Key Architecture Decisions
- **Global anonymous knowledge pool** — knowledge chunks are org-scoped OR global (public)
- **OpenAI embeddings** — uses `text-embedding-3-small` model
- **PostgreSQL vector storage** — embeddings stored as `vector` type (pgvector extension)
- **Chunking strategy** — documents chunked at ~500 tokens with 50-token overlap

### KnowledgeBaseService Interface
```typescript
class KnowledgeBaseService {
  // Add a document to the knowledge base
  async addDocument(params: {
    orgId: string | null;   // null = global/public knowledge
    title: string;
    content: string;
    source: KnowledgeSource;
    metadata?: Record<string, any>;
  }): Promise<string>; // returns document ID

  // Search the knowledge base
  async search(params: {
    query: string;
    orgId: string;
    topK?: number;         // default: 5
    threshold?: number;    // similarity threshold, default: 0.7
    includeGlobal?: boolean; // include global knowledge pool, default: true
  }): Promise<KnowledgeChunk[]>;

  // Delete a document
  async deleteDocument(documentId: string, orgId: string): Promise<void>;

  // List documents
  async listDocuments(orgId: string): Promise<KnowledgeDocument[]>;
}
```

### Knowledge Source Types
```typescript
type KnowledgeSource =
  | 'deal_document'        // uploaded deal document (OM, IC memo, etc.)
  | 'market_report'        // market research / CBRE / JLL reports
  | 'property_data'        // property information
  | 'comps_data'           // comparable sales/leases
  | 'legal_document'       // purchase agreements, LOIs
  | 'financial_statement'  // P&L, rent rolls
  | 'manual_entry'         // manually entered knowledge
  | 'web_scraped';         // scraped from web sources
```

### KnowledgeChunk Response
```typescript
interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  similarity: number;    // 0–1 cosine similarity
  metadata: {
    source: KnowledgeSource;
    title: string;
    orgId: string | null;
    pageNumber?: number;
    chunkIndex?: number;
  };
}
```

---

## Database Schema

```sql
-- Enable pgvector extension (run once)
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge documents
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,              -- NULL = global knowledge
  title VARCHAR(500) NOT NULL,
  source VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge chunks with embeddings
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  org_id UUID,              -- denormalized from document for query performance
  content TEXT NOT NULL,
  embedding vector(1536),   -- text-embedding-3-small produces 1536-dim vectors
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for org filtering
CREATE INDEX idx_knowledge_chunks_org_id ON knowledge_chunks(org_id);
```

### Vector Similarity Search Query
```typescript
const result = await pool.query(
  `SELECT
    kc.id,
    kc.document_id,
    kc.content,
    kc.metadata,
    kd.title,
    kd.source,
    1 - (kc.embedding <=> $1::vector) as similarity
   FROM knowledge_chunks kc
   JOIN knowledge_documents kd ON kc.document_id = kd.id
   WHERE (kc.org_id = $2 OR kc.org_id IS NULL)
     AND 1 - (kc.embedding <=> $1::vector) > $3
   ORDER BY kc.embedding <=> $1::vector
   LIMIT $4`,
  [JSON.stringify(queryEmbedding), orgId, threshold, topK]
);
```

---

## AI Assistant Service

File: `server/services/ai-assistant-service.ts`

### Generating Embeddings
```typescript
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' ').trim(),
  });
  return response.data[0].embedding;
}
```

### Building the System Prompt
```typescript
function buildSystemPrompt(entityContext?: EntityContext): string {
  return `You are an expert commercial real estate investment advisor with deep expertise
in marina and waterfront properties, multi-asset CRE, and institutional investment analysis.

You assist investment professionals with deal analysis, underwriting, market research,
and investment strategy.

${entityContext ? `
Current Deal Context:
- Deal Name: ${entityContext.dealName}
- Asset Class: ${entityContext.assetClass}
- Location: ${entityContext.location}
- Purchase Price: ${entityContext.purchasePrice}
- Current Stage: ${entityContext.stage}
` : ''}

When answering questions:
1. Be specific and data-driven
2. Reference relevant industry benchmarks (cap rates, DSCR standards, etc.)
3. Flag risks clearly
4. If you're using retrieved context, integrate it naturally
5. Keep responses focused and actionable`;
}
```

### Full Advisor Query Pipeline
```typescript
async function queryAdvisor(params: {
  question: string;
  orgId: string;
  entityContext?: EntityContext;
  conversationHistory?: Message[];
}): Promise<AdvisorResponse> {
  const { question, orgId, entityContext, conversationHistory = [] } = params;

  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(question);

  // 2. Search knowledge base
  const relevantChunks = await knowledgeBaseService.search({
    query: question,
    orgId,
    topK: 5,
    threshold: 0.65,
    includeGlobal: true
  });

  // 3. Build context from chunks
  const context = relevantChunks.length > 0
    ? `Relevant context from knowledge base:\n\n${relevantChunks.map(c =>
        `[${c.metadata.title}]\n${c.content}`
      ).join('\n\n---\n\n')}`
    : '';

  // 4. Build messages array
  const messages = [
    ...conversationHistory,
    {
      role: 'user' as const,
      content: context
        ? `${question}\n\n${context}`
        : question
    }
  ];

  // 5. Call LLM
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildSystemPrompt(entityContext) },
      ...messages
    ],
    temperature: 0.3,
    max_tokens: 1500
  });

  return {
    answer: completion.choices[0].message.content ?? '',
    sources: relevantChunks.map(c => ({
      title: c.metadata.title,
      source: c.metadata.source,
      similarity: c.similarity
    })),
    tokensUsed: completion.usage?.total_tokens ?? 0
  };
}
```

---

## Entity Injection

When the user is viewing a specific deal/property, inject that entity's context:

```typescript
interface EntityContext {
  entityType: 'deal' | 'property' | 'contact' | 'company';
  entityId: string;
  dealName?: string;
  assetClass?: string;
  location?: string;
  purchasePrice?: number;
  stage?: string;
  // Financial snapshot
  noiYear1?: number;
  capRate?: number;
  irr?: number;
}

// Fetch entity context for a deal
async function buildEntityContext(dealId: string, orgId: string): Promise<EntityContext> {
  const result = await pool.query(
    `SELECT d.*, mpc.noi_year_1, mpc.cap_rate, mpc.irr
     FROM crm_deals d
     LEFT JOIN modeling_project_config mpc ON mpc.org_id = d.org_id
     WHERE d.id = $1 AND d.org_id = $2`,
    [dealId, orgId]
  );
  // map and return
}
```

---

## Deal Comparison

The AI advisor can compare multiple deals:

```typescript
interface DealComparisonRequest {
  dealIds: string[];           // 2–5 deals to compare
  comparisonDimensions: ComparisonDimension[];
}

type ComparisonDimension =
  | 'financial_returns'        // IRR, cash-on-cash, equity multiple
  | 'risk_profile'             // DSCR, LTV, market risk
  | 'market_position'          // location, submarket, demographics
  | 'operational'              // asset condition, management complexity
  | 'exit_options';            // exit strategy flexibility
```

---

## AI Advisor UI

File: `client/src/components/AIAdvisor.tsx` (or similar)

### UI Elements
- Chat interface with conversation history
- Entity context indicator (shows which deal is in context)
- Source citations (shown below each AI response)
- Knowledge base management (upload documents, view indexed content)
- Quick prompt suggestions based on current entity

### Markdown Rendering
AI responses must be rendered as Markdown, not raw text.
Use a Markdown renderer (e.g. `react-markdown`) for all AI response output.

```typescript
import ReactMarkdown from 'react-markdown';

// In the chat message component:
<ReactMarkdown className="prose prose-sm max-w-none">
  {message.content}
</ReactMarkdown>
```

**Critical:** Raw markdown strings (with `##`, `**`, `-` etc.) should never be
displayed as plain text. Always pass AI responses through a Markdown renderer.

---

## API Routes

```typescript
// Chat endpoint
POST /api/marinamatch/ai-advisor/chat
Body: {
  message: string;
  conversationId?: string;
  dealId?: string;           // for entity context injection
  dealIds?: string[];        // for deal comparison mode
}

// Knowledge base management
GET    /api/marinamatch/ai-advisor/knowledge
POST   /api/marinamatch/ai-advisor/knowledge/upload
DELETE /api/marinamatch/ai-advisor/knowledge/:documentId

// Conversation history
GET    /api/marinamatch/ai-advisor/conversations
GET    /api/marinamatch/ai-advisor/conversations/:conversationId
DELETE /api/marinamatch/ai-advisor/conversations/:conversationId
```

---

## Error Handling

```typescript
// Handle OpenAI API errors gracefully
try {
  const response = await queryAdvisor(params);
  res.json(response);
} catch (err: any) {
  if (err.code === 'insufficient_quota') {
    res.status(503).json({ error: 'AI service temporarily unavailable' });
  } else if (err.code === 'rate_limit_exceeded') {
    res.status(429).json({ error: 'Too many requests, please wait a moment' });
  } else {
    console.error('AI Advisor error:', err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
}
```

---

## Known Issues Fixed

1. **Missing knowledge-base-service.ts** — file was missing from original implementation. Now exists at `server/services/knowledge-base-service.ts`.
2. **Bad model reference** — old code referenced `gpt-4-turbo-preview`, now uses `gpt-4o`.
3. **No entity injection** — entity context was not being passed to the system prompt. Now injected via `buildEntityContext()`.
4. **No deal comparison** — deal comparison mode was not implemented. Now supported via `dealIds[]` param.
5. **Raw markdown rendering** — AI responses were displayed as raw markdown strings. Now rendered via `react-markdown`.
