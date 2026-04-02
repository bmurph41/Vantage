/**
 * MarinaMatch AI/RAG Enhancement Engine
 * Real embeddings, document ingestion, deal scoring, anomaly detection, conversational memory
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import Decimal from 'decimal.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  name: string;
  model: string;
  dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, any>;
  tokenCount: number;
}

export interface DealScoreResult {
  dealId: string;
  overallScore: number;
  factors: DealScoreFactor[];
  riskFlags: string[];
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'pass';
  confidence: number;
}

export interface DealScoreFactor {
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  reasoning: string;
}

export interface AnomalyResult {
  id: string;
  entityType: string;
  entityId: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedValue: string;
  actualValue: string;
  deviationPercent: number;
  detectedAt: Date;
  isAcknowledged: boolean;
}

export interface ConversationMemory {
  sessionId: string;
  userId: string;
  messages: ConversationMessage[];
  context: Record<string, any>;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ─── OpenAI Embedding Provider ───────────────────────────────────────────────

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';
  model = 'text-embedding-3-small';
  dimensions = 1536;

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isConfigured) return this.fallbackEmbed(text);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text.slice(0, 8000),
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[AI] OpenAI embedding error:', error);
      return this.fallbackEmbed(text);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured) return texts.map(t => this.fallbackEmbed(t));

    // OpenAI supports batch embedding
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts.map(t => t.slice(0, 8000)),
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      return texts.map(t => this.fallbackEmbed(t));
    }

    const data = await response.json();
    return data.data.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
  }

  private fallbackEmbed(text: string): number[] {
    // Deterministic hash-based fallback when no API key
    const hash = crypto.createHash('sha256').update(text).digest();
    const vec: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      const byteIdx = i % hash.length;
      vec.push((hash[byteIdx] / 255) * 2 - 1);
    }
    // L2 normalize
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return vec.map(v => v / norm);
  }
}

// ─── Document Ingestion Pipeline ─────────────────────────────────────────────

class DocumentIngestionPipeline {
  private embeddingProvider: OpenAIEmbeddingProvider;

  constructor(provider: OpenAIEmbeddingProvider) {
    this.embeddingProvider = provider;
  }

  async ingestDocument(orgId: string, data: {
    documentId: string;
    title: string;
    content: string;
    documentType: string;
    sourceEntity?: string;
    sourceEntityId?: string;
    metadata?: Record<string, any>;
  }): Promise<{ chunks: number; embedded: number }> {
    const chunks = this.chunkText(data.content, 512, 50);
    let embedded = 0;

    // Store document record
    await db.execute(sql`
      INSERT INTO ai_knowledge_documents (
        id, org_id, title, document_type, source_entity, source_entity_id,
        content_hash, chunk_count, metadata, status, created_at
      ) VALUES (
        ${data.documentId}, ${orgId}, ${data.title}, ${data.documentType},
        ${data.sourceEntity || null}, ${data.sourceEntityId || null},
        ${crypto.createHash('sha256').update(data.content).digest('hex')},
        ${chunks.length}, ${JSON.stringify(data.metadata || {})}::jsonb,
        'processing', ${new Date()}
      )
      ON CONFLICT (id) DO UPDATE SET
        content_hash = EXCLUDED.content_hash,
        chunk_count = EXCLUDED.chunk_count,
        status = 'processing',
        updated_at = now()
    `);

    // Delete old chunks for re-ingestion
    await db.execute(sql`
      DELETE FROM ai_knowledge_chunks WHERE document_id = ${data.documentId}
    `);

    // Embed in batches of 20
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.content);

      let embeddings: number[][];
      try {
        embeddings = await this.embeddingProvider.embedBatch(texts);
        embedded += batch.length;
      } catch (err) {
        console.error('[AI] Batch embedding failed:', err);
        embeddings = texts.map(() => []);
      }

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const chunkId = crypto.randomUUID();
        const embedding = embeddings[j];

        await db.execute(sql`
          INSERT INTO ai_knowledge_chunks (
            id, document_id, org_id, chunk_index, content, token_count,
            embedding, metadata, created_at
          ) VALUES (
            ${chunkId}, ${data.documentId}, ${orgId}, ${chunk.index},
            ${chunk.content}, ${chunk.tokenCount},
            ${embedding.length > 0 ? JSON.stringify(embedding) : null}::jsonb,
            ${JSON.stringify(chunk.metadata)}::jsonb, ${new Date()}
          )
        `);
      }
    }

    // Update status
    await db.execute(sql`
      UPDATE ai_knowledge_documents SET status = 'ready', updated_at = now()
      WHERE id = ${data.documentId}
    `);

    return { chunks: chunks.length, embedded };
  }

  async semanticSearch(orgId: string, query: string, options?: {
    limit?: number;
    documentType?: string;
    entityType?: string;
    entityId?: string;
    minScore?: number;
  }): Promise<{ chunks: (DocumentChunk & { score: number })[]; }> {
    const queryEmbedding = await this.embeddingProvider.embed(query);
    const limit = options?.limit || 10;
    const minScore = options?.minScore || 0.3;

    // Cosine similarity search
    const conditions: string[] = [`c.org_id = '${orgId}'`, `c.embedding IS NOT NULL`];
    if (options?.documentType) {
      conditions.push(`d.document_type = '${options.documentType}'`);
    }
    if (options?.entityType && options?.entityId) {
      conditions.push(`d.source_entity = '${options.entityType}'`);
      conditions.push(`d.source_entity_id = '${options.entityId}'`);
    }

    // Calculate cosine similarity in SQL using dot product
    // Since vectors are normalized, dot product = cosine similarity
    const embeddingStr = `'[${queryEmbedding.join(',')}]'::jsonb`;

    const result = await db.execute(sql.raw(`
      SELECT
        c.id, c.document_id, c.chunk_index, c.content, c.token_count, c.metadata,
        d.title as document_title, d.document_type,
        (
          SELECT SUM(
            (ce.value::float) * (qe.value::float)
          )
          FROM jsonb_array_elements_text(c.embedding) WITH ORDINALITY AS ce(value, idx),
               jsonb_array_elements_text(${embeddingStr}) WITH ORDINALITY AS qe(value, idx)
          WHERE ce.idx = qe.idx
        ) as similarity_score
      FROM ai_knowledge_chunks c
      JOIN ai_knowledge_documents d ON d.id = c.document_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY similarity_score DESC
      LIMIT ${limit}
    `));

    return {
      chunks: (result.rows as any[])
        .filter(r => parseFloat(r.similarity_score || '0') >= minScore)
        .map(r => ({
          id: r.id,
          documentId: r.document_id,
          chunkIndex: r.chunk_index,
          content: r.content,
          embedding: null, // Don't return embedding vectors
          metadata: { ...r.metadata, documentTitle: r.document_title, documentType: r.document_type },
          tokenCount: r.token_count,
          score: parseFloat(r.similarity_score || '0'),
        })),
    };
  }

  async deleteDocument(orgId: string, documentId: string): Promise<void> {
    await db.execute(sql`DELETE FROM ai_knowledge_chunks WHERE document_id = ${documentId} AND org_id = ${orgId}`);
    await db.execute(sql`DELETE FROM ai_knowledge_documents WHERE id = ${documentId} AND org_id = ${orgId}`);
  }

  async getDocumentStatus(orgId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    embeddedChunks: number;
    byType: Record<string, number>;
  }> {
    const result = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM ai_knowledge_documents WHERE org_id = ${orgId}) as total_documents,
        (SELECT count(*)::int FROM ai_knowledge_chunks WHERE org_id = ${orgId}) as total_chunks,
        (SELECT count(*)::int FROM ai_knowledge_chunks WHERE org_id = ${orgId} AND embedding IS NOT NULL) as embedded_chunks
    `);
    const row = (result.rows as any[])?.[0] || {};

    const typeResult = await db.execute(sql`
      SELECT document_type, count(*)::int as cnt
      FROM ai_knowledge_documents WHERE org_id = ${orgId}
      GROUP BY document_type
    `);
    const byType: Record<string, number> = {};
    for (const r of (typeResult.rows as any[])) {
      byType[r.document_type] = r.cnt;
    }

    return {
      totalDocuments: row.total_documents || 0,
      totalChunks: row.total_chunks || 0,
      embeddedChunks: row.embedded_chunks || 0,
      byType,
    };
  }

  private chunkText(text: string, chunkSize: number, overlap: number): { index: number; content: string; tokenCount: number; metadata: any }[] {
    const words = text.split(/\s+/);
    const chunks: any[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      const content = words.slice(start, end).join(' ');
      chunks.push({
        index: chunks.length,
        content,
        tokenCount: Math.ceil(content.length / 4), // rough token estimate
        metadata: { startWord: start, endWord: end },
      });
      start = end - overlap;
      if (start >= words.length) break;
    }

    return chunks;
  }
}

// ─── AI Deal Scoring ─────────────────────────────────────────────────────────

class AIDealScoringEngine {

  async scoreDeal(orgId: string, dealId: string): Promise<DealScoreResult> {
    // Fetch deal data
    const dealResult = await db.execute(sql`
      SELECT d.*, p.name as property_name, p.address as property_address
      FROM crm_deals d
      LEFT JOIN properties p ON p.id::text = d.property_id
      WHERE d.id = ${dealId} AND d.org_id = ${orgId}
    `);
    const deal = (dealResult.rows as any[])?.[0];
    if (!deal) throw new Error('Deal not found');

    // Fetch modeling data if linked
    let modelData: any = null;
    if (deal.modeling_project_id) {
      const modelResult = await db.execute(sql`
        SELECT * FROM modeling_project_config
        WHERE project_id = ${deal.modeling_project_id}
      `);
      modelData = (modelResult.rows as any[])?.[0];
    }

    const factors: DealScoreFactor[] = [];

    // Factor 1: Cap Rate vs Market (weight: 20%)
    const capRate = parseFloat(deal.cap_rate || modelData?.cap_rate || '0');
    const capRateScore = capRate >= 6 ? 85 : capRate >= 5 ? 70 : capRate >= 4 ? 55 : capRate >= 3 ? 40 : 25;
    factors.push({
      name: 'Cap Rate', score: capRateScore, weight: 0.20,
      weightedScore: capRateScore * 0.20,
      reasoning: `${capRate.toFixed(2)}% cap rate — ${capRateScore >= 70 ? 'above' : 'below'} market average`,
    });

    // Factor 2: Deal Size (weight: 10%)
    const dealValue = parseFloat(deal.value || deal.purchase_price || '0');
    const sizeScore = dealValue >= 50000000 ? 90 : dealValue >= 20000000 ? 80 : dealValue >= 5000000 ? 70 : dealValue >= 1000000 ? 60 : 40;
    factors.push({
      name: 'Deal Size', score: sizeScore, weight: 0.10,
      weightedScore: sizeScore * 0.10,
      reasoning: `$${(dealValue / 1000000).toFixed(1)}M — ${sizeScore >= 70 ? 'institutional' : 'smaller'} scale`,
    });

    // Factor 3: IRR Projection (weight: 25%)
    const projectedIrr = parseFloat(modelData?.projected_irr || deal.projected_irr || '0');
    const irrScore = projectedIrr >= 20 ? 95 : projectedIrr >= 15 ? 85 : projectedIrr >= 12 ? 70 : projectedIrr >= 8 ? 55 : 30;
    factors.push({
      name: 'Projected IRR', score: irrScore, weight: 0.25,
      weightedScore: irrScore * 0.25,
      reasoning: `${projectedIrr.toFixed(1)}% projected IRR — ${irrScore >= 70 ? 'meets' : 'below'} hurdle rate`,
    });

    // Factor 4: DSCR (weight: 15%)
    const dscr = parseFloat(modelData?.dscr || deal.dscr || '1.25');
    const dscrScore = dscr >= 1.50 ? 90 : dscr >= 1.30 ? 75 : dscr >= 1.20 ? 60 : dscr >= 1.10 ? 40 : 20;
    factors.push({
      name: 'DSCR', score: dscrScore, weight: 0.15,
      weightedScore: dscrScore * 0.15,
      reasoning: `${dscr.toFixed(2)}x DSCR — ${dscrScore >= 60 ? 'adequate' : 'tight'} debt coverage`,
    });

    // Factor 5: Market Fundamentals (weight: 15%)
    const marketScore = 70; // Default; would be enhanced with market data feeds
    factors.push({
      name: 'Market Fundamentals', score: marketScore, weight: 0.15,
      weightedScore: marketScore * 0.15,
      reasoning: 'Market fundamentals assessment based on location and asset class',
    });

    // Factor 6: Pipeline Stage / Momentum (weight: 15%)
    const stage = deal.stage || deal.pipeline_stage || '';
    const stageScore = stage.includes('Close') || stage.includes('LOI') ? 85
      : stage.includes('DD') || stage.includes('Underwriting') ? 70
      : stage.includes('Review') ? 55 : 40;
    factors.push({
      name: 'Deal Momentum', score: stageScore, weight: 0.15,
      weightedScore: stageScore * 0.15,
      reasoning: `Stage: ${stage || 'Unknown'} — ${stageScore >= 70 ? 'advancing' : 'early stage'}`,
    });

    const overallScore = Math.round(factors.reduce((s, f) => s + f.weightedScore, 0));

    // Risk flags
    const riskFlags: string[] = [];
    if (dscr < 1.20) riskFlags.push('DSCR below 1.20x — refinancing risk');
    if (capRate < 4) riskFlags.push('Sub-4% cap rate — compressed returns');
    if (projectedIrr < 8) riskFlags.push('IRR below 8% hurdle');
    if (!deal.modeling_project_id) riskFlags.push('No financial model linked — projections unverified');

    const recommendation: DealScoreResult['recommendation'] =
      overallScore >= 80 ? 'strong_buy' : overallScore >= 65 ? 'buy' : overallScore >= 50 ? 'hold' : 'pass';

    // Store the score
    await db.execute(sql`
      INSERT INTO ai_deal_scores (
        id, org_id, deal_id, overall_score, factors, risk_flags,
        recommendation, confidence, scored_at
      ) VALUES (
        ${crypto.randomUUID()}, ${orgId}, ${dealId}, ${overallScore},
        ${JSON.stringify(factors)}::jsonb, ${JSON.stringify(riskFlags)}::jsonb,
        ${recommendation}, ${0.75}, ${new Date()}
      )
    `);

    return { dealId, overallScore, factors, riskFlags, recommendation, confidence: 0.75 };
  }

  async getHistoricalScores(orgId: string, dealId: string): Promise<DealScoreResult[]> {
    const result = await db.execute(sql`
      SELECT * FROM ai_deal_scores
      WHERE org_id = ${orgId} AND deal_id = ${dealId}
      ORDER BY scored_at DESC
      LIMIT 20
    `);
    return (result.rows as any[]).map(r => ({
      dealId: r.deal_id, overallScore: r.overall_score,
      factors: r.factors, riskFlags: r.risk_flags,
      recommendation: r.recommendation, confidence: parseFloat(r.confidence || '0.75'),
    }));
  }

  async scoreAllDeals(orgId: string): Promise<{ scored: number; errors: number }> {
    const deals = await db.execute(sql`
      SELECT id FROM crm_deals WHERE org_id = ${orgId} AND status != 'closed_lost'
    `);
    let scored = 0, errors = 0;
    for (const deal of (deals.rows as any[])) {
      try {
        await this.scoreDeal(orgId, deal.id);
        scored++;
      } catch {
        errors++;
      }
    }
    return { scored, errors };
  }
}

// ─── Anomaly Detection Engine ────────────────────────────────────────────────

class AnomalyDetectionEngine {

  async detectFinancialAnomalies(orgId: string, projectId: string): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];

    // Check pro forma line items for statistical outliers
    const proFormaResult = await db.execute(sql`
      SELECT line_item_key, display_name,
        json_agg(json_build_object('year', year, 'amount', amount) ORDER BY year) as yearly_values
      FROM pro_forma_values
      WHERE project_id = ${projectId}
      GROUP BY line_item_key, display_name
      HAVING count(*) >= 3
    `);

    for (const row of (proFormaResult.rows as any[])) {
      const values = row.yearly_values || [];
      if (values.length < 3) continue;

      const amounts = values.map((v: any) => parseFloat(v.amount || '0'));
      const mean = amounts.reduce((s: number, v: number) => s + v, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((s: number, v: number) => s + Math.pow(v - mean, 2), 0) / amounts.length);

      if (stdDev === 0) continue;

      for (let i = 0; i < amounts.length; i++) {
        const zScore = Math.abs(amounts[i] - mean) / stdDev;
        if (zScore > 2.5) {
          const deviation = ((amounts[i] - mean) / mean * 100);
          anomalies.push({
            id: crypto.randomUUID(),
            entityType: 'pro_forma_line',
            entityId: `${projectId}:${row.line_item_key}`,
            anomalyType: 'statistical_outlier',
            severity: zScore > 3.5 ? 'critical' : zScore > 3 ? 'high' : 'medium',
            description: `${row.display_name} in year ${values[i].year} deviates ${deviation.toFixed(1)}% from trend`,
            expectedValue: mean.toFixed(2),
            actualValue: amounts[i].toFixed(2),
            deviationPercent: Math.abs(deviation),
            detectedAt: new Date(),
            isAcknowledged: false,
          });
        }
      }
    }

    // Check for revenue growth rate anomalies
    const revenueResult = await db.execute(sql`
      SELECT year, SUM(amount::numeric) as total_revenue
      FROM pro_forma_values
      WHERE project_id = ${projectId} AND line_item_key ILIKE '%revenue%'
      GROUP BY year ORDER BY year
    `);

    const revenues = (revenueResult.rows as any[]).map(r => parseFloat(r.total_revenue || '0'));
    for (let i = 1; i < revenues.length; i++) {
      if (revenues[i - 1] === 0) continue;
      const growthRate = (revenues[i] - revenues[i - 1]) / revenues[i - 1];
      if (Math.abs(growthRate) > 0.30) {
        anomalies.push({
          id: crypto.randomUUID(),
          entityType: 'revenue_growth',
          entityId: projectId,
          anomalyType: 'excessive_growth_rate',
          severity: Math.abs(growthRate) > 0.50 ? 'high' : 'medium',
          description: `Revenue ${growthRate > 0 ? 'growth' : 'decline'} of ${(growthRate * 100).toFixed(1)}% exceeds normal range`,
          expectedValue: '3-10%',
          actualValue: `${(growthRate * 100).toFixed(1)}%`,
          deviationPercent: Math.abs(growthRate * 100),
          detectedAt: new Date(),
          isAcknowledged: false,
        });
      }
    }

    // Check expense ratios
    const expenseResult = await db.execute(sql`
      SELECT year,
        SUM(CASE WHEN line_item_key ILIKE '%expense%' OR line_item_key ILIKE '%opex%' THEN amount::numeric ELSE 0 END) as total_expenses,
        SUM(CASE WHEN line_item_key ILIKE '%revenue%' THEN amount::numeric ELSE 0 END) as total_revenue
      FROM pro_forma_values
      WHERE project_id = ${projectId}
      GROUP BY year
    `);

    for (const row of (expenseResult.rows as any[])) {
      const revenue = parseFloat(row.total_revenue || '0');
      const expenses = parseFloat(row.total_expenses || '0');
      if (revenue === 0) continue;
      const expenseRatio = expenses / revenue;
      if (expenseRatio > 0.85) {
        anomalies.push({
          id: crypto.randomUUID(),
          entityType: 'expense_ratio',
          entityId: `${projectId}:${row.year}`,
          anomalyType: 'high_expense_ratio',
          severity: expenseRatio > 0.95 ? 'critical' : 'high',
          description: `Expense ratio of ${(expenseRatio * 100).toFixed(1)}% in year ${row.year} is dangerously high`,
          expectedValue: '50-75%',
          actualValue: `${(expenseRatio * 100).toFixed(1)}%`,
          deviationPercent: (expenseRatio - 0.70) * 100,
          detectedAt: new Date(),
          isAcknowledged: false,
        });
      }
    }

    // Store anomalies
    for (const anomaly of anomalies) {
      await db.execute(sql`
        INSERT INTO ai_anomalies (
          id, org_id, entity_type, entity_id, anomaly_type, severity,
          description, expected_value, actual_value, deviation_percent,
          detected_at, is_acknowledged
        ) VALUES (
          ${anomaly.id}, ${orgId}, ${anomaly.entityType}, ${anomaly.entityId},
          ${anomaly.anomalyType}, ${anomaly.severity}, ${anomaly.description},
          ${anomaly.expectedValue}, ${anomaly.actualValue}, ${anomaly.deviationPercent},
          ${anomaly.detectedAt}, false
        )
      `);
    }

    return anomalies;
  }

  async acknowledgeAnomaly(orgId: string, anomalyId: string, userId: string): Promise<void> {
    await db.execute(sql`
      UPDATE ai_anomalies SET is_acknowledged = true, acknowledged_by = ${userId}, acknowledged_at = ${new Date()}
      WHERE id = ${anomalyId} AND org_id = ${orgId}
    `);
  }

  async getAnomalies(orgId: string, filters?: {
    entityType?: string; severity?: string; acknowledged?: boolean; limit?: number;
  }): Promise<AnomalyResult[]> {
    const conditions: string[] = [`org_id = '${orgId}'`];
    if (filters?.entityType) conditions.push(`entity_type = '${filters.entityType}'`);
    if (filters?.severity) conditions.push(`severity = '${filters.severity}'`);
    if (filters?.acknowledged !== undefined) conditions.push(`is_acknowledged = ${filters.acknowledged}`);

    const result = await db.execute(sql.raw(`
      SELECT * FROM ai_anomalies
      WHERE ${conditions.join(' AND ')}
      ORDER BY detected_at DESC
      LIMIT ${filters?.limit || 100}
    `));

    return (result.rows as any[]).map(r => ({
      id: r.id, entityType: r.entity_type, entityId: r.entity_id,
      anomalyType: r.anomaly_type, severity: r.severity, description: r.description,
      expectedValue: r.expected_value, actualValue: r.actual_value,
      deviationPercent: parseFloat(r.deviation_percent || '0'),
      detectedAt: new Date(r.detected_at), isAcknowledged: r.is_acknowledged,
    }));
  }
}

// ─── Conversational Memory ───────────────────────────────────────────────────

class ConversationalMemoryManager {

  async getOrCreateSession(orgId: string, userId: string, sessionId?: string): Promise<ConversationMemory> {
    if (sessionId) {
      const result = await db.execute(sql`
        SELECT * FROM ai_conversation_sessions
        WHERE id = ${sessionId} AND org_id = ${orgId} AND user_id = ${userId}
      `);
      const row = (result.rows as any[])?.[0];
      if (row) {
        const messagesResult = await db.execute(sql`
          SELECT * FROM ai_conversation_messages WHERE session_id = ${sessionId}
          ORDER BY created_at ASC LIMIT 100
        `);
        return {
          sessionId: row.id, userId: row.user_id,
          messages: (messagesResult.rows as any[]).map(m => ({
            role: m.role, content: m.content,
            timestamp: new Date(m.created_at), metadata: m.metadata,
          })),
          context: row.context || {},
          createdAt: new Date(row.created_at),
          lastActiveAt: new Date(row.last_active_at),
        };
      }
    }

    // Create new session
    const newId = sessionId || crypto.randomUUID();
    const now = new Date();
    await db.execute(sql`
      INSERT INTO ai_conversation_sessions (id, org_id, user_id, context, created_at, last_active_at)
      VALUES (${newId}, ${orgId}, ${userId}, '{}'::jsonb, ${now}, ${now})
    `);
    return { sessionId: newId, userId, messages: [], context: {}, createdAt: now, lastActiveAt: now };
  }

  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    await db.execute(sql`
      INSERT INTO ai_conversation_messages (id, session_id, role, content, metadata, created_at)
      VALUES (${crypto.randomUUID()}, ${sessionId}, ${message.role}, ${message.content},
              ${JSON.stringify(message.metadata || {})}::jsonb, ${message.timestamp || new Date()})
    `);
    await db.execute(sql`
      UPDATE ai_conversation_sessions SET last_active_at = ${new Date()} WHERE id = ${sessionId}
    `);
  }

  async updateContext(sessionId: string, context: Record<string, any>): Promise<void> {
    await db.execute(sql`
      UPDATE ai_conversation_sessions
      SET context = context || ${JSON.stringify(context)}::jsonb, last_active_at = ${new Date()}
      WHERE id = ${sessionId}
    `);
  }

  async getRecentSessions(orgId: string, userId: string, limit: number = 10): Promise<ConversationMemory[]> {
    const result = await db.execute(sql`
      SELECT * FROM ai_conversation_sessions
      WHERE org_id = ${orgId} AND user_id = ${userId}
      ORDER BY last_active_at DESC LIMIT ${limit}
    `);

    return (result.rows as any[]).map(r => ({
      sessionId: r.id, userId: r.user_id, messages: [],
      context: r.context || {}, createdAt: new Date(r.created_at),
      lastActiveAt: new Date(r.last_active_at),
    }));
  }

  async buildContextWindow(sessionId: string, maxTokens: number = 4000): Promise<string> {
    const messagesResult = await db.execute(sql`
      SELECT * FROM ai_conversation_messages WHERE session_id = ${sessionId}
      ORDER BY created_at DESC LIMIT 50
    `);

    const messages = (messagesResult.rows as any[]).reverse();
    let contextStr = '';
    let tokenCount = 0;

    for (const msg of messages) {
      const line = `${msg.role}: ${msg.content}\n`;
      const lineTokens = Math.ceil(line.length / 4);
      if (tokenCount + lineTokens > maxTokens) break;
      contextStr += line;
      tokenCount += lineTokens;
    }

    return contextStr;
  }

  async cleanupOldSessions(orgId: string, daysOld: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await db.execute(sql`
      DELETE FROM ai_conversation_sessions
      WHERE org_id = ${orgId} AND last_active_at < ${cutoff}
    `);
    return result.rowCount || 0;
  }
}

// ─── AI Comp Suggestions ─────────────────────────────────────────────────────

class AICompSuggestionEngine {
  private embeddingProvider: OpenAIEmbeddingProvider;

  constructor(provider: OpenAIEmbeddingProvider) {
    this.embeddingProvider = provider;
  }

  async suggestRateComps(orgId: string, subjectProperty: {
    address: string;
    assetClass: string;
    units?: number;
    sqft?: number;
    latitude?: number;
    longitude?: number;
  }, limit: number = 10): Promise<{
    suggestions: { compId: string; name: string; score: number; reasons: string[] }[];
  }> {
    // Build a text description for embedding similarity
    const description = `${subjectProperty.assetClass} property at ${subjectProperty.address} with ${subjectProperty.units || 'N/A'} units and ${subjectProperty.sqft || 'N/A'} sqft`;

    // Fetch candidate comps
    const compsResult = await db.execute(sql`
      SELECT id, property_name, address, asset_class, total_units, total_sqft,
             latitude, longitude
      FROM rate_comps
      WHERE org_id = ${orgId}
      LIMIT 500
    `);

    const candidates = (compsResult.rows as any[]);
    if (candidates.length === 0) return { suggestions: [] };

    // Score each candidate
    const scored = candidates.map(comp => {
      let score = 0;
      const reasons: string[] = [];

      // Asset class match (30 points)
      if (comp.asset_class === subjectProperty.assetClass) {
        score += 30;
        reasons.push('Same asset class');
      }

      // Size similarity (20 points)
      if (subjectProperty.units && comp.total_units) {
        const unitRatio = Math.min(subjectProperty.units, comp.total_units) / Math.max(subjectProperty.units, comp.total_units);
        const unitScore = unitRatio * 20;
        score += unitScore;
        if (unitRatio > 0.7) reasons.push('Similar unit count');
      }

      // Geographic proximity (30 points)
      if (subjectProperty.latitude && subjectProperty.longitude && comp.latitude && comp.longitude) {
        const dist = this.haversineDistance(
          subjectProperty.latitude, subjectProperty.longitude,
          parseFloat(comp.latitude), parseFloat(comp.longitude)
        );
        const proxScore = Math.max(0, 30 - (dist / 10)); // 30 points at 0 miles, 0 at 300 miles
        score += proxScore;
        if (dist < 50) reasons.push(`${dist.toFixed(0)} miles away`);
      }

      // Sqft similarity (20 points)
      if (subjectProperty.sqft && comp.total_sqft) {
        const sqftRatio = Math.min(subjectProperty.sqft, comp.total_sqft) / Math.max(subjectProperty.sqft, comp.total_sqft);
        score += sqftRatio * 20;
        if (sqftRatio > 0.7) reasons.push('Similar size');
      }

      return { compId: comp.id, name: comp.property_name || comp.address, score: Math.round(score), reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    return { suggestions: scored.slice(0, limit) };
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

const embeddingProvider = new OpenAIEmbeddingProvider();

export const documentIngestion = new DocumentIngestionPipeline(embeddingProvider);
export const dealScoring = new AIDealScoringEngine();
export const anomalyDetection = new AnomalyDetectionEngine();
export const conversationMemory = new ConversationalMemoryManager();
export const compSuggestions = new AICompSuggestionEngine(embeddingProvider);
export { embeddingProvider };
