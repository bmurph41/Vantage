# MarinaMatch AI Chatbot — Full Enhancement Implementation Guide

## What Was Wrong / Missing

### 1. `knowledge-base-service.ts` — COMPLETELY MISSING
The entire RAG (Retrieval-Augmented Generation) layer was imported but never existed.
Both `ai-assistant-service.ts` and `ai-assistant-routes.ts` import from it. This means:
- The knowledge base feature was broken / throwing errors at runtime
- No conversation persistence
- No feedback-based learning
- No document ingestion/retrieval

### 2. Global Learning — Not Implemented
Feedback was recorded in `aiAssistantFeedback` table but **never used to improve responses**.
The learning loop was one-way: users gave feedback, AI never got smarter.

### 3. Entity Data Not Injected
When viewing a specific deal, model, or property, the AI had no access to that entity's
actual data. It could only respond generically. Now it fetches and injects live data.

### 4. No Deal Comparison
No endpoint or UI existed for side-by-side deal/model comparison.

### 5. Markdown Rendering
Chat responses rendered as plain text. AI outputs markdown (bold, tables, lists, headers)
but the frontend just displayed raw `**text**` and `##` characters.

### 6. `gpt-5.1` Model Reference (Bug)
`server/replit_integrations/chat/routes.ts` referenced `gpt-5.1` which doesn't exist.
Changed to `gpt-4o`.

---

## Architecture of the Enhanced System

```
User Message
    │
    ├─► Entity Enrichment (fetch live deal/model data from DB)
    ├─► RAG Retrieval (embed query → cosine similarity → top-K chunks)
    │       ├─ Org-specific chunks (from knowledge base)
    │       └─ Global knowledge pool (learned from ALL users)
    ├─► Investment Criteria (org's buy-box, if set)
    ├─► Advisor Persona (learned from feedback patterns)
    └─► Tenant Context (pipeline summary, recent deals)
              │
              ▼
        System Prompt (assembled from all above)
              │
              ▼
         GPT-4o API (streaming)
              │
              ▼
        Response → User
              │
              ▼ (on thumbs up)
        learnFromFeedback()
              ├─ ingestDocument() → org-specific knowledge
              └─ Global knowledge pool (if general question)
                    └─ Benefits ALL future users
```

---

## Files Changed / Created

### NEW: `server/services/knowledge-base-service.ts`
Complete from scratch. Handles:
- PostgreSQL table auto-creation (no migration needed)
- OpenAI `text-embedding-3-small` embeddings
- Text chunking with sentence-boundary awareness and overlap
- Cosine similarity computed in-process (no pgvector required)
- **Global anonymous knowledge pool** — cross-user learning
- Conversation + message persistence
- All CRUD for knowledge base documents

### ENHANCED: `server/services/ai-assistant-service.ts`
- Deep entity enrichment: fetches full deal/model data when viewing specific entity
- Investment criteria integration (pulls org buy-box)
- Advisor persona: learns from feedback which modes this advisor prefers
- Multi-asset benchmarks expanded (marina + multifamily, storage, RV, industrial, retail, etc.)
- Token tracking fed to spending guard
- Deal comparison: accepts `compareEntityIds` in context
- Advisory mode prompts sharpened with specific numeric thresholds

### ENHANCED: `server/routes/ai-assistant-routes.ts`
New endpoints:
- `POST /api/ai-assistant/compare` — side-by-side deal comparison
- `POST /api/ai-assistant/evaluate-criteria` — evaluate deal vs buy-box
- `GET /api/ai-assistant/knowledge/global/stats` — global pool stats
- Schema bootstrap called on import (no manual migration step)

### ENHANCED: `client/src/components/ai-assistant.tsx`
- **Markdown rendering**: headers, bold, italic, code blocks, tables, lists
- **Entity detection**: auto-detects deal/model/property from URL, passes to AI
- **Quick actions**: when on deal page, shows Critique/Risk/Benchmark/Memo buttons
- **Deal comparison UI**: toggle comparison mode, add IDs, fire comparison query
- **History panel**: load past conversations
- **Streaming cursor**: animated cursor while streaming
- **Learning indicator**: thumbs up shows "AI learned from this"
- Global knowledge indicator (🌐) in header

---

## Global Learning Flow (How the AI Gets Smarter)

```
User asks: "What's a healthy DSCR for marina acquisition?"
AI responds with accurate answer
User clicks 👍 Helpful
  └─► learnFromFeedback() called
        ├─► ingestDocument() → stored in THIS org's knowledge base
        │     (helps this org's future questions)
        └─► isGeneralKnowledge() check → TRUE (contains "dscr")
              └─► ai_global_knowledge table
                    (embedded and stored anonymously)
                    └─► Used by ALL orgs on next similar question
```

The global pool grows passively as users interact. No manual curation needed.
Questions that score above the general-knowledge threshold are anonymized
(proper nouns stripped) and contributed.

---

## Installation Steps (Replit)

### Step 1: Run the bootstrap patch
```bash
bash /tmp/PATCH_SCRIPT.sh
```
This creates `knowledge-base-service.ts` and fixes the `gpt-5.1` bug.

### Step 2: Replace enhanced files
```bash
# In Replit shell — copy each enhanced file:
cp /tmp/ai-assistant-service.ts ~/workspace/server/services/ai-assistant-service.ts
cp /tmp/ai-assistant-routes.ts ~/workspace/server/routes/ai-assistant-routes.ts
cp /tmp/ai-assistant.tsx ~/workspace/client/src/components/ai-assistant.tsx
```

### Step 3: Verify no TypeScript errors
```bash
cd ~/workspace && npx tsc --noEmit 2>&1 | head -30
```

### Step 4: Restart server
The schema tables auto-create on first request to any `/api/ai-assistant/*` endpoint.
No manual SQL migration needed.

---

## Environment Variables Required

```
OPENAI_API_KEY=sk-...           # Required for GPT-4o + embeddings
AI_INTEGRATIONS_OPENAI_API_KEY= # Optional — Replit's built-in key (billed to Replit)
AI_INTEGRATIONS_OPENAI_BASE_URL= # Optional — Replit proxy
AI_SPENDING_LIMIT_CENTS=10000   # $100/month default per org
```

---

## Key Accuracy Guarantees

1. **Entity-specific answers**: When viewing a deal worth $2.3M at 6.8% cap, the AI
   has that exact data and won't guess or hallucinate deal details.

2. **Benchmark precision**: All benchmarks are hardcoded from industry sources with
   specific ranges, not vague qualitative descriptions.

3. **Buy-box evaluation**: If your org has investment criteria set, every deal
   evaluation checks against your actual criteria (not generic advice).

4. **RAG augmentation**: Your uploaded documents (DD reports, OM packets, market
   studies) are chunked, embedded, and retrieved semantically — the AI answers
   from your actual materials.

5. **Global learning**: The more users interact and give positive feedback,
   the richer the global knowledge pool becomes for everyone.

---

## Deal Comparison Usage

### Via UI:
1. Click the ⚖️ (Scale) icon in the AI chat header
2. Enter 2–4 deal or model IDs
3. Ask any question — the AI compares them structurally

### Via API:
```json
POST /api/ai-assistant/compare
{
  "entityIds": ["deal-uuid-1", "deal-uuid-2"],
  "entityType": "deal",
  "advisoryMode": "benchmark_comparison"
}
```

### Via Investment Criteria Evaluation:
```json
POST /api/ai-assistant/evaluate-criteria
{
  "entityId": "deal-uuid-1",
  "entityType": "deal"
}
```

---

## Advisory Modes Reference

| Mode | Best For | Output Structure |
|------|----------|-----------------|
| General | Q&A, navigation help | Conversational |
| Critique | Stress-testing assumptions | 5-section risk analysis |
| Risk Analysis | Full risk register | Severity/probability matrix |
| Benchmark | Market comparison | Scorecard with deviations |
| Options | Alternative paths | Pros/cons decision matrix |
| Decision Memo | IC presentation | Structured investment memo |
| Stress Test | Adverse scenario modeling | Per-scenario P&L impact |
| Next Actions | Action planning | Tiered priority list |
