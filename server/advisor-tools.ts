import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { storage } from './storage';
import { kpiExtractor } from './kpi-extractor';
import { ragService } from './rag-service';

/**
 * AI Tool Definitions for CDD Advisor
 * These tools can be called by the OpenAI assistant to perform actions
 */

export const advisorTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'extract_kpis_from_document',
      description: 'Extract key performance indicators (KPIs) from a specified CDD document. Use this when the user asks to analyze financial metrics, operational data, or other quantifiable information from a document.',
      parameters: {
        type: 'object',
        properties: {
          documentId: {
            type: 'string',
            description: 'The ID of the document to extract KPIs from',
          },
        },
        required: ['documentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_finding',
      description: 'Create a new due diligence finding or issue. Use this when the user mentions a problem, concern, red flag, or observation that should be documented.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Brief title summarizing the finding',
          },
          severity: {
            type: 'string',
            enum: ['low', 'med', 'high', 'critical'],
            description: 'Severity level of the finding',
          },
          bodyMd: {
            type: 'string',
            description: 'Detailed description of the finding in Markdown format',
          },
          sources: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'List of source documents or references',
          },
        },
        required: ['title', 'severity', 'bodyMd'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_recommendation',
      description: 'Create an actionable recommendation based on due diligence analysis. Use this when the user asks for suggestions, next steps, or action items.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Brief title of the recommendation',
          },
          bodyMd: {
            type: 'string',
            description: 'Detailed recommendation in Markdown format. Include any relevant document references or citations within the body text.',
          },
          priority: {
            type: 'string',
            enum: ['low', 'med', 'high'],
            description: 'Priority level of the recommendation',
          },
        },
        required: ['title', 'bodyMd'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_documents',
      description: 'Perform semantic search across all project documents using RAG (Retrieval-Augmented Generation). Use this to find relevant information, answer questions, or locate specific content in the documents.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query or question to find relevant information',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  },
];

/**
 * Execute an AI tool function
 */
export async function executeAdvisorTool(
  toolName: string,
  args: any,
  projectId: string,
  userId: string,
  orgId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    switch (toolName) {
      case 'extract_kpis_from_document':
        return await extractKpisFromDocument(args.documentId, projectId, userId, orgId);

      case 'add_finding':
        return await addFinding(args, projectId, userId, orgId);

      case 'add_recommendation':
        return await addRecommendation(args, projectId, userId, orgId);

      case 'search_documents':
        return await searchDocuments(args.query, args.limit || 5, projectId);

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      success: false,
      error: error.message || 'Tool execution failed',
    };
  }
}

/**
 * Extract KPIs from a document
 */
async function extractKpisFromDocument(
  documentId: string,
  projectId: string,
  userId: string,
  orgId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const document = await storage.getCddDocument(documentId);
    if (!document) {
      return { success: false, error: 'Document not found' };
    }

    if (document.projectId !== projectId) {
      return { success: false, error: 'Document does not belong to this project' };
    }

    if (document.parseStatus !== 'parsed') {
      return {
        success: false,
        error: `Document must be parsed first (current status: ${document.parseStatus})`,
      };
    }

    // Get all pages for the document
    const pages = await storage.getDocPagesForDocument(documentId);
    if (pages.length === 0) {
      return { success: false, error: 'No pages found for document' };
    }

    // Extract KPIs from all pages
    const extractedKpis = await kpiExtractor.extractKPIsFromPages(
      pages.map(p => ({ pageNo: p.pageNo, contentText: p.text })),
      document.filename
    );

    // Save extracted KPIs to database
    const createdKpis = [];
    for (const kpi of extractedKpis) {
      const created = await storage.createKpi({
        projectId,
        name: kpi.name,
        valueText: kpi.valueText || null,
        valueNum: kpi.valueNum || null,
        unit: kpi.unit || null,
        category: kpi.category || null,
        confidence: kpi.confidence,
        sourceDocumentId: documentId,
        pageHint: kpi.pageHint || null,
      });
      createdKpis.push(created);
    }

    // Log audit
    await storage.createAuditLog({
      orgId,
      projectId,
      userId,
      entityType: 'cdd_document',
      entityId: documentId,
      action: 'kpis_extracted',
      after: { kpisExtracted: createdKpis.length, documentName: document.filename },
    });

    return {
      success: true,
      data: {
        kpisExtracted: createdKpis.length,
        kpis: createdKpis,
      },
    };
  } catch (error: any) {
    console.error('Error extracting KPIs:', error);
    return {
      success: false,
      error: error.message || 'Failed to extract KPIs',
    };
  }
}

/**
 * Add a finding
 */
async function addFinding(
  args: any,
  projectId: string,
  userId: string,
  orgId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const sourcesArray = Array.isArray(args.sources)
      ? args.sources.map((s: string) => ({ text: s }))
      : [];

    const finding = await storage.createFinding({
      projectId,
      title: args.title,
      severity: args.severity,
      bodyMd: args.bodyMd,
      sources: sourcesArray,
      createdBy: userId,
    });

    await storage.createAuditLog({
      orgId,
      projectId,
      userId,
      entityType: 'finding',
      entityId: finding.id,
      action: 'create',
      after: { title: finding.title, severity: finding.severity, source: 'ai_advisor' },
    });

    return {
      success: true,
      data: finding,
    };
  } catch (error: any) {
    console.error('Error adding finding:', error);
    return {
      success: false,
      error: error.message || 'Failed to create finding',
    };
  }
}

/**
 * Add a recommendation
 */
async function addRecommendation(
  args: any,
  projectId: string,
  userId: string,
  orgId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const recommendation = await storage.createRecommendation({
      projectId,
      title: args.title,
      bodyMd: args.bodyMd,
      priority: args.priority || 'med',
      createdBy: userId,
    });

    await storage.createAuditLog({
      orgId,
      projectId,
      userId,
      entityType: 'recommendation',
      entityId: recommendation.id,
      action: 'create',
      after: { title: recommendation.title, priority: recommendation.priority, source: 'ai_advisor' },
    });

    return {
      success: true,
      data: recommendation,
    };
  } catch (error: any) {
    console.error('Error adding recommendation:', error);
    return {
      success: false,
      error: error.message || 'Failed to create recommendation',
    };
  }
}

/**
 * Search documents using RAG
 */
async function searchDocuments(
  query: string,
  limit: number,
  projectId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await ragService.generateEmbedding(query.trim());
    
    // Search for relevant chunks
    const searchResults = await storage.searchVectorChunks(
      projectId,
      queryEmbedding,
      Math.min(limit, 20) // Cap at 20 results
    );

    // Enrich results with document information and filter out any cross-project results
    const enrichedResults = [];
    for (const result of searchResults) {
      const metadata = result.metadata || {};
      const documentId = metadata.documentId;
      
      let documentName = 'Unknown Document';
      if (documentId) {
        const doc = await storage.getCddDocument(documentId);
        
        // SECURITY: Verify document belongs to this project
        if (!doc || doc.projectId !== projectId) {
          console.warn(`Skipping chunk from document ${documentId} - does not belong to project ${projectId}`);
          continue; // Skip this result - it doesn't belong to this project
        }
        
        documentName = doc.filename;
      }

      enrichedResults.push({
        text: result.contentText,
        similarity: result.similarity,
        citation: {
          documentId,
          documentName,
          pageNo: metadata.pageNo || null,
          sourceType: result.sourceType,
          sourceId: result.sourceId,
        },
        metadata: result.metadata,
      });
    }

    return {
      success: true,
      data: {
        query,
        results: enrichedResults,
        count: enrichedResults.length,
      },
    };
  } catch (error: any) {
    console.error('Error searching documents:', error);
    return {
      success: false,
      error: error.message || 'Failed to search documents',
    };
  }
}
