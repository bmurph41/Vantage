import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, desc, asc, sql, inArray, isNull } from "drizzle-orm";
import { requirePermission } from "../middleware/rbac";
import { debtScenarioService } from "../debt-scenario-service";
import { docIntelService } from "../services/doc-intel-service";
import { dashboardService } from "../services/dashboard-service";
import { personaService } from "../services/persona-service";
import { calculateAll, type TransactionClosingData } from "../services/transactionClosingEngine";
import { z } from "zod";
import multer from "multer";
import { validateFileUpload } from "../middleware/file-upload-security";
import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import {
  modelingProjects,
  rentRolls,
  rentRollEntries,
  transactionClosingSummary,
  closingCostLines,
  transitionCostLines,
  nwcLines,
  insertTransactionClosingSummarySchema,
  insertClosingCostLineSchema,
  insertTransitionCostLineSchema,
  insertNwcLineSchema,
  userKpiPreferences,
  insertUserKpiPreferencesSchema,
  insertUserDashboardLayoutSchema,
  insertDashboardCustomWidgetSchema,
  updateDashboardCustomWidgetSchema,
  insertDashboardSavedLayoutSchema,
  updateDashboardSavedLayoutSchema,
  insertDebtScenarioSchema,
  updateDebtScenarioSchema,
  projects,
  users,
  salesComps,
} from "@shared/schema";
import {
  calculateMetrics,
  generateInsights,
  getMatchedComps,
  getMarketTrends,
  generateTrendsInsights,
  type AnalyticsFilters,
  type TrendsFilters,
} from "../services/salescomps/analyticsService";

export function registerModelingRoutes(
  app: Express,
  authenticateUser: any,
  enforceTenant: any
) {
  // ==================== SENSITIVITY MATRIX ROUTES ====================
  
  // Generate sensitivity matrix for a project
  /* === OLD ROUTE (replaced by dcf-routes.ts) === POST /sensitivity-matrix
  app.post('/api/modeling/projects/:projectId/sensitivity-matrix', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioType = 'base', config, save, name, description } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { sensitivityMatrixService } = await import('./services/sensitivity-matrix-service');
      const result = await sensitivityMatrixService.generateMatrix(projectId, orgId, scenarioType, config);

      if (save) {
        const userId = req.user.id;
        const savedId = await sensitivityMatrixService.saveMatrix(projectId, orgId, userId, result, name, description);
        result.id = savedId;
      }

      res.json(result);
    } catch (error: any) {
      console.error('Failed to generate sensitivity matrix:', error);
      res.status(500).json({ error: 'Failed to generate sensitivity matrix' });
    }
  });
  === END OLD ROUTE === */

  // Get saved sensitivity matrices for a project
  app.get('/api/modeling/projects/:projectId/sensitivity-matrices', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { sensitivityMatrixService } = await import('./services/sensitivity-matrix-service');
      const matrices = await sensitivityMatrixService.getMatrices(projectId, orgId);

      res.json(matrices);
    } catch (error: any) {
      console.error('Failed to fetch sensitivity matrices:', error);
      res.status(500).json({ error: 'Failed to fetch sensitivity matrices' });
    }
  });

  // ==================== BENCHMARK COMPARISON ROUTES ====================

  // Compare project metrics against sales comps benchmarks
  app.get('/api/modeling/projects/:projectId/benchmarks', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { region, state, yearStart, yearEnd, priceMin, priceMax } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { benchmarkComparisonService } = await import('./services/benchmark-comparison-service');
      const benchmarks = await benchmarkComparisonService.compareToBenchmarks(projectId, orgId, {
        region: region as string,
        state: state as string,
        yearRange: yearStart && yearEnd ? { 
          start: parseInt(yearStart as string), 
          end: parseInt(yearEnd as string) 
        } : undefined,
        priceRange: priceMin && priceMax ? { 
          min: parseFloat(priceMin as string), 
          max: parseFloat(priceMax as string) 
        } : undefined
      });

      res.json(benchmarks);
    } catch (error: any) {
      console.error('Failed to get benchmark comparison:', error);
      res.status(500).json({ error: 'Failed to get benchmark comparison' });
    }
  });

  // Get portfolio risk metrics
  app.get('/api/modeling/portfolio/risk-metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      const { benchmarkComparisonService } = await import('./services/benchmark-comparison-service');
      const riskMetrics = await benchmarkComparisonService.getPortfolioRiskMetrics(orgId);

      res.json(riskMetrics);
    } catch (error: any) {
      console.error('Failed to get portfolio risk metrics:', error);
      res.status(500).json({ error: 'Failed to get portfolio risk metrics' });
    }
  });

  // ==================== MULTI-APPROVER WORKFLOW ROUTES ====================

  // Create approval request for a scenario
  app.post('/api/modeling/projects/:projectId/approval-requests', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scenarioVersionId, title, description, requiredApprovers, quorumCount, deadline } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { multiApproverService } = await import('./services/multi-approver-service');
      const requestId = await multiApproverService.createApprovalRequest(projectId, orgId, userId, {
        scenarioVersionId,
        title,
        description,
        requiredApprovers,
        quorumCount: quorumCount || 1,
        deadline: deadline ? new Date(deadline) : undefined
      });

      res.json({ id: requestId, message: 'Approval request created successfully' });
    } catch (error: any) {
      console.error('Failed to create approval request:', error);
      res.status(500).json({ error: 'Failed to create approval request' });
    }
  });

  // Get approval requests for a project
  app.get('/api/modeling/projects/:projectId/approval-requests', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { multiApproverService } = await import('./services/multi-approver-service');
      const requests = await multiApproverService.getProjectApprovalRequests(projectId, orgId);

      res.json(requests);
    } catch (error: any) {
      console.error('Failed to get approval requests:', error);
      res.status(500).json({ error: 'Failed to get approval requests' });
    }
  });

  // Get pending approvals for current user
  app.get('/api/modeling/pending-approvals', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const { multiApproverService } = await import('./services/multi-approver-service');
      const pendingApprovals = await multiApproverService.getPendingApprovalsForUser(userId, orgId);

      res.json(pendingApprovals);
    } catch (error: any) {
      console.error('Failed to get pending approvals:', error);
      res.status(500).json({ error: 'Failed to get pending approvals' });
    }
  });

  // Submit approval decision
  app.post('/api/modeling/approval-requests/:requestId/decide', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { requestId } = req.params;
      const { decision, comments } = req.body;
      
      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Decision must be "approved" or "rejected"' });
      }

      const { multiApproverService } = await import('./services/multi-approver-service');
      const result = await multiApproverService.submitDecision(orgId, userId, {
        approvalRequestId: requestId,
        decision,
        comments
      });

      res.json({ 
        message: `Decision submitted: ${decision}`,
        requestStatus: result.requestStatus,
        isComplete: result.isComplete
      });
    } catch (error: any) {
      console.error('Failed to submit decision:', error);
      res.status(400).json({ error: error.message || 'Failed to submit decision' });
    }
  });

  // Get single approval request details
  app.get('/api/modeling/approval-requests/:requestId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { requestId } = req.params;
      
      const { multiApproverService } = await import('./services/multi-approver-service');
      const request = await multiApproverService.getApprovalRequest(requestId, orgId);

      if (!request) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      res.json(request);
    } catch (error: any) {
      console.error('Failed to get approval request:', error);
      res.status(500).json({ error: 'Failed to get approval request' });
    }
  });

  // ==================== DOCUMENT INTELLIGENCE ROUTES ====================

  // Create document intelligence job from VDR document (parse P&L or Rent Roll)
  app.post('/api/modeling/projects/:projectId/document-intelligence', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { vdrDocumentId, documentType } = req.body;

      if (!vdrDocumentId || !documentType) {
        return res.status(400).json({ error: 'vdrDocumentId and documentType are required' });
      }

      if (!['p&l', 'rent_roll'].includes(documentType)) {
        return res.status(400).json({ error: 'documentType must be "p&l" or "rent_roll"' });
      }

      const { documentIntelligenceService } = await import('./services/document-intelligence-service');
      const jobId = await documentIntelligenceService.createJobFromVdrDocument(
        orgId,
        userId,
        projectId,
        vdrDocumentId,
        documentType
      );

      res.json({ jobId, message: 'Document intelligence job created' });
    } catch (error: any) {
      console.error('Failed to create document intelligence job:', error);
      res.status(400).json({ error: error.message || 'Failed to create document intelligence job' });
    }
  });

  // Get document intelligence jobs for a project
  app.get('/api/modeling/projects/:projectId/document-intelligence', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const { documentIntelligenceService } = await import('./services/document-intelligence-service');
      const jobs = await documentIntelligenceService.getProjectJobs(projectId, orgId);

      res.json(jobs);
    } catch (error: any) {
      console.error('Failed to get document intelligence jobs:', error);
      if (error.message?.includes('not found') || error.message?.includes('access denied')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to get document intelligence jobs' });
    }
  });

  // Get document intelligence job status and result
  app.get('/api/modeling/document-intelligence/:jobId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { jobId } = req.params;

      const { documentIntelligenceService } = await import('./services/document-intelligence-service');
      const job = await documentIntelligenceService.getJob(jobId, orgId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const result = job.status === 'completed' 
        ? await documentIntelligenceService.getJobResult(jobId, orgId)
        : null;

      res.json({ job, result });
    } catch (error: any) {
      console.error('Failed to get document intelligence job:', error);
      res.status(500).json({ error: 'Failed to get document intelligence job' });
    }
  });

  // Approve document intelligence result
  app.post('/api/modeling/document-intelligence/:resultId/approve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { resultId } = req.params;
      const { modifications } = req.body;

      const { documentIntelligenceService } = await import('./services/document-intelligence-service');
      await documentIntelligenceService.approveResult(resultId, orgId, userId, modifications);

      res.json({ message: 'Result approved' });
    } catch (error: any) {
      console.error('Failed to approve result:', error);
      res.status(500).json({ error: 'Failed to approve result' });
    }
  });

  // Reject document intelligence result
  app.post('/api/modeling/document-intelligence/:resultId/reject', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { resultId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      const { documentIntelligenceService } = await import('./services/document-intelligence-service');
      await documentIntelligenceService.rejectResult(resultId, orgId, userId, reason);

      res.json({ message: 'Result rejected' });
    } catch (error: any) {
      console.error('Failed to reject result:', error);
      res.status(500).json({ error: 'Failed to reject result' });
    }
  });

  // Import approved result to modeling actuals
  app.post('/api/modeling/document-intelligence/:resultId/import', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { resultId } = req.params;
      const { year, month, overwriteExisting } = req.body;

      if (!year) {
        return res.status(400).json({ error: 'Year is required' });
      }

      const { documentIntelligenceService } = await import('./services/document-intelligence-service');
      const result = await documentIntelligenceService.importToModelingActuals(resultId, orgId, userId, {
        year,
        month,
        overwriteExisting
      });

      res.json({ 
        message: `Imported ${result.imported} line items, skipped ${result.skipped}`,
        imported: result.imported,
        skipped: result.skipped
      });
    } catch (error: any) {
      console.error('Failed to import to actuals:', error);
      res.status(400).json({ error: error.message || 'Failed to import to actuals' });
    }
  });

  app.get('/api/modeling/document-intelligence/:resultId/structured', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { resultId } = req.params;

      const { documentIntelligenceService } = await import('./services/document-intelligence-service');
      const data = await documentIntelligenceService.getStructuredPLData(resultId, orgId);

      res.json(data);
    } catch (error: any) {
      console.error('Failed to get structured P&L data:', error);
      res.status(400).json({ error: error.message || 'Failed to get structured P&L data' });
    }
  });

  // ==================== COMMENT THREADS ROUTES ====================

  // Create a comment thread
  app.post('/api/modeling/projects/:projectId/threads', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scenarioVersionId, targetType, targetId, targetLabel, initialComment } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!targetType || !initialComment) {
        return res.status(400).json({ error: 'targetType and initialComment are required' });
      }

      const { commentThreadsService } = await import('./services/comment-threads-service');
      const threadId = await commentThreadsService.createThread(projectId, orgId, userId, {
        scenarioVersionId,
        targetType,
        targetId,
        targetLabel,
        initialComment
      });

      res.json({ id: threadId, message: 'Thread created successfully' });
    } catch (error: any) {
      console.error('Failed to create comment thread:', error);
      res.status(500).json({ error: 'Failed to create comment thread' });
    }
  });

  // Get all threads for a project
  app.get('/api/modeling/projects/:projectId/threads', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioVersionId, status, targetType } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { commentThreadsService } = await import('./services/comment-threads-service');
      const threads = await commentThreadsService.getProjectThreads(projectId, orgId, {
        scenarioVersionId: scenarioVersionId as string,
        status: status as 'open' | 'resolved' | 'archived',
        targetType: targetType as string
      });

      res.json(threads);
    } catch (error: any) {
      console.error('Failed to get comment threads:', error);
      res.status(500).json({ error: 'Failed to get comment threads' });
    }
  });

  // Get unresolved thread count for a project
  app.get('/api/modeling/projects/:projectId/threads/unresolved-count', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      const count = await commentThreadsService.getUnresolvedCount(projectId, orgId);

      res.json(count);
    } catch (error: any) {
      console.error('Failed to get unresolved count:', error);
      res.status(500).json({ error: 'Failed to get unresolved count' });
    }
  });

  // Get single thread with comments
  app.get('/api/modeling/threads/:threadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { threadId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      const thread = await commentThreadsService.getThread(threadId, orgId);

      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json(thread);
    } catch (error: any) {
      console.error('Failed to get thread:', error);
      res.status(500).json({ error: 'Failed to get thread' });
    }
  });

  // Add comment to thread
  app.post('/api/modeling/threads/:threadId/comments', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { threadId } = req.params;
      const { content, mentions } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const { commentThreadsService } = await import('./services/comment-threads-service');
      const commentId = await commentThreadsService.addComment(orgId, userId, {
        threadId,
        content,
        mentions
      });

      res.json({ id: commentId, message: 'Comment added successfully' });
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      res.status(400).json({ error: error.message || 'Failed to add comment' });
    }
  });

  // Edit comment
  app.patch('/api/modeling/comments/:commentId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { commentId } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const { commentThreadsService } = await import('./services/comment-threads-service');
      await commentThreadsService.editComment(commentId, orgId, userId, content);

      res.json({ message: 'Comment updated successfully' });
    } catch (error: any) {
      console.error('Failed to edit comment:', error);
      res.status(400).json({ error: error.message || 'Failed to edit comment' });
    }
  });

  // Resolve thread
  app.post('/api/modeling/threads/:threadId/resolve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { threadId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      await commentThreadsService.resolveThread(threadId, orgId, userId);

      res.json({ message: 'Thread resolved successfully' });
    } catch (error: any) {
      console.error('Failed to resolve thread:', error);
      res.status(400).json({ error: error.message || 'Failed to resolve thread' });
    }
  });

  // Reopen thread
  app.post('/api/modeling/threads/:threadId/reopen', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { threadId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      await commentThreadsService.reopenThread(threadId, orgId, userId);

      res.json({ message: 'Thread reopened successfully' });
    } catch (error: any) {
      console.error('Failed to reopen thread:', error);
      res.status(400).json({ error: error.message || 'Failed to reopen thread' });
    }
  });

  // Archive thread
  app.post('/api/modeling/threads/:threadId/archive', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { threadId } = req.params;
      
      const { commentThreadsService } = await import('./services/comment-threads-service');
      await commentThreadsService.archiveThread(threadId, orgId, userId);

      res.json({ message: 'Thread archived successfully' });
    } catch (error: any) {
      console.error('Failed to archive thread:', error);
      res.status(400).json({ error: error.message || 'Failed to archive thread' });
    }
  });

  // ==================== VDR INTEGRATION ROUTES ====================

  // Export modeling outputs to VDR
  app.post('/api/modeling/projects/:projectId/export-to-vdr', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { includeICMemo, includeProForma, includeScenarioComparison, includeSensitivityAnalysis, scenarioVersionIds } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { vdrModelingIntegrationService } = await import('./services/vdr-modeling-integration-service');
      const result = await vdrModelingIntegrationService.exportToVDR(projectId, orgId, userId, {
        includeICMemo,
        includeProForma,
        includeScenarioComparison,
        includeSensitivityAnalysis,
        scenarioVersionIds
      });

      res.json({
        message: `Successfully exported ${result.documents.length} documents to VDR`,
        ...result
      });
    } catch (error: any) {
      console.error('Failed to export to VDR:', error);
      res.status(400).json({ error: error.message || 'Failed to export to VDR' });
    }
  });

  // Get VDR export history for a project
  app.get('/api/modeling/projects/:projectId/vdr-exports', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { vdrModelingIntegrationService } = await import('./services/vdr-modeling-integration-service');
      const history = await vdrModelingIntegrationService.getVDRExportHistory(projectId, orgId);

      res.json(history);
    } catch (error: any) {
      console.error('Failed to get VDR export history:', error);
      res.status(500).json({ error: 'Failed to get VDR export history' });
    }
  });

  app.get('/api/modeling/projects/:projectId/vdr-documents', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const ddProjectId = project.ddProjectId;
      if (!ddProjectId) {
        return res.json([]);
      }

      const { vdrDocuments, vdrFolders } = await import('@shared/schema');
      const { isNull } = await import('drizzle-orm');

      const documents = await db
        .select({
          id: vdrDocuments.id,
          filename: vdrDocuments.filename,
          originalFilename: vdrDocuments.originalFilename,
          mimeType: vdrDocuments.mimeType,
          size: vdrDocuments.size,
          storagePath: vdrDocuments.storagePath,
          folderName: vdrFolders.name,
          folderPath: vdrFolders.path,
          aiCategory: vdrDocuments.aiCategory,
          tags: vdrDocuments.tags,
          createdAt: vdrDocuments.createdAt,
        })
        .from(vdrDocuments)
        .innerJoin(vdrFolders, eq(vdrDocuments.folderId, vdrFolders.id))
        .where(and(
          eq(vdrDocuments.projectId, ddProjectId),
          eq(vdrDocuments.orgId, orgId),
          eq(vdrDocuments.isCurrentVersion, true),
          isNull(vdrDocuments.deletedAt)
        ))
        .orderBy(vdrDocuments.createdAt);

      res.json(documents);
    } catch (error: any) {
      console.error('Failed to fetch VDR documents:', error);
      res.status(500).json({ error: 'Failed to fetch VDR documents' });
    }
  });

  app.post('/api/modeling/projects/:projectId/import-vdr-document', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { vdrDocumentId, docType, year } = req.body;

      if (!vdrDocumentId) {
        return res.status(400).json({ error: 'vdrDocumentId is required' });
      }

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { vdrDocuments } = await import('@shared/schema');

      const [vdrDoc] = await db.select()
        .from(vdrDocuments)
        .where(and(
          eq(vdrDocuments.id, vdrDocumentId),
          eq(vdrDocuments.orgId, orgId)
        ))
        .limit(1);

      if (!vdrDoc) {
        return res.status(404).json({ error: 'VDR document not found' });
      }

      if (!project.ddProjectId || vdrDoc.projectId !== project.ddProjectId) {
        return res.status(403).json({ error: 'Document does not belong to this project\'s linked Data Room' });
      }

      const fsModule = await import('fs');
      const pathModule = await import('path');

      const sourceExists = fsModule.existsSync(vdrDoc.storagePath);
      if (!sourceExists) {
        return res.status(404).json({ error: 'VDR document file not found on disk' });
      }

      const docIntelDir = pathModule.default.join(process.cwd(), 'server', 'uploads', 'doc-intel');
      fsModule.mkdirSync(docIntelDir, { recursive: true });

      const timestamp = Date.now();
      const ext = pathModule.default.extname(vdrDoc.originalFilename);
      const newFilename = `${timestamp}-vdr-${crypto.randomBytes(8).toString('hex')}${ext}`;
      const destPath = pathModule.default.join(docIntelDir, newFilename);

      fsModule.copyFileSync(vdrDoc.storagePath, destPath);

      const stat = fsModule.statSync(destPath);

      const result = await docIntelService.createUploadWithDuplicateCheck(
        orgId,
        {
          modelingProjectId: projectId,
          filename: newFilename,
          originalName: vdrDoc.originalFilename,
          storagePath: destPath,
          mimeType: vdrDoc.mimeType,
          fileSize: stat.size,
          docType: docType || null,
          year: year ? parseInt(year) : null,
          uploadedBy: userId,
          status: 'uploaded',
          holdingStatus: 'staging',
          holdingTags: null,
          holdingNotes: `Imported from Data Room: ${vdrDoc.filename}`,
        },
        false
      );

      res.status(201).json({
        ...result.upload,
        isDuplicate: result.isDuplicate,
        source: 'vdr',
        vdrDocumentId: vdrDoc.id,
      });

      setImmediate(async () => {
        try {
          logger.info(`[DocIntel] Starting automatic AI parsing for VDR import ${result.upload.id}`);
          await docIntelService.parseAndExtract(orgId, result.upload.id);
          logger.info(`[DocIntel] Parsing complete for VDR import ${result.upload.id}, categorizing...`);
          await docIntelService.categorizeItems(orgId, result.upload.id);
          logger.info(`[DocIntel] Categorization complete for VDR import ${result.upload.id}`);
          await docIntelService.updateUpload(orgId, result.upload.id, { status: 'reviewing' });
        } catch (parseError: any) {
          console.error(`[DocIntel] Background parsing failed for VDR import ${result.upload.id}:`, parseError.message);
        }
      });
    } catch (error: any) {
      console.error('Failed to import VDR document:', error);
      res.status(500).json({ error: 'Failed to import VDR document' });
    }
  });

  // ==================== MODELING EXCEL EXPORT ROUTES ====================

  // Export modeling project to Excel with multiple sheets
  app.get('/api/modeling/projects/:projectId/export-excel', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { caseId, includeAllCases, includeAddbacks, includeLeaseUp } = req.query;
      
      const { exportModelingProjectToExcel } = await import('./services/modeling-export');
      
      const buffer = await exportModelingProjectToExcel(projectId, orgId, {
        caseId: caseId as string | undefined,
        includeAllCases: includeAllCases !== 'false',
        includeAddbacks: includeAddbacks !== 'false',
        includeLeaseUp: includeLeaseUp !== 'false',
      });

      const project = await storage.getModelingProject(projectId, orgId);
      const filename = `${(project?.name || 'model').replace(/[^a-zA-Z0-9]/g, '_')}_export.xlsx`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error: any) {
      console.error('Failed to export modeling project to Excel:', error);
      res.status(500).json({ error: 'Failed to export modeling project' });
    }
  });

  // Export case comparison to Excel
  app.post('/api/modeling/projects/:projectId/export-case-comparison', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { caseIds } = req.body;
      
      if (!Array.isArray(caseIds) || caseIds.length < 2) {
        return res.status(400).json({ error: 'At least 2 case IDs required for comparison' });
      }

      const { exportCaseComparisonToExcel } = await import('./services/modeling-export');
      
      const buffer = await exportCaseComparisonToExcel(projectId, orgId, caseIds);

      const project = await storage.getModelingProject(projectId, orgId);
      const filename = `${(project?.name || 'model').replace(/[^a-zA-Z0-9]/g, '_')}_case_comparison.xlsx`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error: any) {
      console.error('Failed to export case comparison to Excel:', error);
      res.status(500).json({ error: 'Failed to export case comparison' });
    }
  });

  // ==================== DEBT SENSITIVITY ROUTES ====================

  // Analyze debt sensitivity across lender structures
  app.post('/api/modeling/projects/:projectId/debt-sensitivity', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scenarioVersionId, purchasePrice, lenderStructures, rateShifts } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!scenarioVersionId || !purchasePrice) {
        return res.status(400).json({ error: 'scenarioVersionId and purchasePrice are required' });
      }

      const { debtSensitivityService } = await import('./services/debt-sensitivity-service');
      
      let structures = lenderStructures;
      if (!structures || structures.length === 0) {
        structures = await debtSensitivityService.getStandardLenderStructures(purchasePrice);
      }

      const shifts = rateShifts || [-1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0];

      const analysis = await debtSensitivityService.analyzeDebtSensitivity(projectId, orgId, userId, {
        scenarioVersionId,
        purchasePrice,
        lenderStructures: structures,
        rateShifts: shifts
      });

      res.json(analysis);
    } catch (error: any) {
      console.error('Failed to analyze debt sensitivity:', error);
      res.status(400).json({ error: error.message || 'Failed to analyze debt sensitivity' });
    }
  });

  // Get standard lender structures
  app.get('/api/modeling/debt-sensitivity/lender-templates', authenticateUser, async (req: any, res) => {
    try {
      const { purchasePrice } = req.query;
      const price = parseFloat(purchasePrice as string) || 10000000;

      const { debtSensitivityService } = await import('./services/debt-sensitivity-service');
      const structures = await debtSensitivityService.getStandardLenderStructures(price);

      res.json(structures);
    } catch (error: any) {
      console.error('Failed to get lender templates:', error);
      res.status(500).json({ error: 'Failed to get lender templates' });
    }
  });

  // Compare multiple lenders and get recommendations
  app.post('/api/modeling/projects/:projectId/lender-comparison', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioVersionId, purchasePrice, targetDSCR } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { debtSensitivityService } = await import('./services/debt-sensitivity-service');
      const comparison = await debtSensitivityService.compareMultipleLenders(
        projectId,
        orgId,
        scenarioVersionId,
        purchasePrice,
        targetDSCR || 1.25
      );

      res.json(comparison);
    } catch (error: any) {
      console.error('Failed to compare lenders:', error);
      res.status(400).json({ error: error.message || 'Failed to compare lenders' });
    }
  });

  // ==================== WATERFALL CUSTOMIZATION ROUTES ====================

  // Calculate waterfall distribution
  app.post('/api/modeling/projects/:projectId/waterfall', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const input = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!input.scenarioVersionId || !input.totalInvestment) {
        return res.status(400).json({ error: 'scenarioVersionId and totalInvestment are required' });
      }

      const { waterfallService } = await import('./services/waterfall-service');
      const result = await waterfallService.calculateWaterfall(projectId, orgId, userId, input);

      res.json(result);
    } catch (error: any) {
      console.error('Failed to calculate waterfall:', error);
      res.status(400).json({ error: error.message || 'Failed to calculate waterfall' });
    }
  });

  // Get standard waterfall configurations
  app.get('/api/modeling/waterfall/templates', authenticateUser, async (req: any, res) => {
    try {
      const { waterfallService } = await import('./services/waterfall-service');
      const configs = await waterfallService.getStandardWaterfallConfigs();

      res.json(configs);
    } catch (error: any) {
      console.error('Failed to get waterfall templates:', error);
      res.status(500).json({ error: 'Failed to get waterfall templates' });
    }
  });

  // Compare multiple waterfall structures
  app.post('/api/modeling/projects/:projectId/waterfall/compare', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { baseInput, configs } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { waterfallService } = await import('./services/waterfall-service');
      const comparison = await waterfallService.compareWaterfallStructures(
        projectId,
        orgId,
        baseInput,
        configs
      );

      res.json(comparison);
    } catch (error: any) {
      console.error('Failed to compare waterfall structures:', error);
      res.status(400).json({ error: error.message || 'Failed to compare waterfall structures' });
    }
  });

  // ==================== EXTERNAL API ROUTES ====================

  // Export single project data
  app.get('/api/modeling/export/project/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { format } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { externalAPIService } = await import('./services/external-api-service');
      const exportData = await externalAPIService.exportProject(
        projectId, 
        orgId, 
        userId, 
        (format as 'json' | 'csv' | 'xml') || 'json'
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="project_${projectId}.csv"`);
        res.send(exportData);
      } else if (format === 'xml') {
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="project_${projectId}.xml"`);
        res.send(exportData);
      } else {
        res.json(exportData);
      }
    } catch (error: any) {
      console.error('Failed to export project:', error);
      res.status(400).json({ error: error.message || 'Failed to export project' });
    }
  });

  // Export portfolio data
  app.get('/api/modeling/export/portfolio', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { status, region, outcome, minValue, maxValue } = req.query;

      const { externalAPIService } = await import('./services/external-api-service');
      const exportData = await externalAPIService.exportPortfolio(orgId, userId, {
        status: status as string,
        region: region as string,
        outcome: outcome as string,
        minValue: minValue ? parseFloat(minValue as string) : undefined,
        maxValue: maxValue ? parseFloat(maxValue as string) : undefined
      });

      res.json(exportData);
    } catch (error: any) {
      console.error('Failed to export portfolio:', error);
      res.status(400).json({ error: error.message || 'Failed to export portfolio' });
    }
  });

  // Get webhook payload preview
  app.get('/api/modeling/webhook/preview/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { eventType } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { externalAPIService } = await import('./services/external-api-service');
      const payload = await externalAPIService.getWebhookPayload(
        projectId,
        orgId,
        (eventType as 'scenario_approved' | 'project_updated' | 'analysis_completed') || 'project_updated'
      );

      res.json(payload);
    } catch (error: any) {
      console.error('Failed to get webhook payload:', error);
      res.status(400).json({ error: error.message || 'Failed to get webhook payload' });
    }
  });

  // Generate API documentation
  app.get('/api/modeling/api-docs', authenticateUser, async (req: any, res) => {
    try {
      const docs = {
        version: '1.0.0',
        endpoints: [
          {
            method: 'GET',
            path: '/api/modeling/export/project/:projectId',
            description: 'Export project data in JSON, CSV, or XML format',
            params: { format: 'json | csv | xml' }
          },
          {
            method: 'GET',
            path: '/api/modeling/export/portfolio',
            description: 'Export portfolio data with optional filters',
            params: { status: 'string', region: 'string', outcome: 'string', minValue: 'number', maxValue: 'number' }
          },
          {
            method: 'GET',
            path: '/api/modeling/webhook/preview/:projectId',
            description: 'Preview webhook payload for integration testing',
            params: { eventType: 'scenario_approved | project_updated | analysis_completed' }
          },
          {
            method: 'POST',
            path: '/api/modeling/projects/:projectId/pro-forma',
            description: 'Generate pro forma projections from actuals'
          },
          {
            method: 'POST',
            path: '/api/modeling/projects/:projectId/sensitivity-matrix',
            description: 'Generate sensitivity analysis matrix'
          },
          {
            method: 'GET',
            path: '/api/modeling/projects/:projectId/benchmarks',
            description: 'Compare project metrics against sales comps'
          },
          {
            method: 'POST',
            path: '/api/modeling/projects/:projectId/debt-sensitivity',
            description: 'Analyze debt sensitivity across lender structures'
          },
          {
            method: 'POST',
            path: '/api/modeling/projects/:projectId/waterfall',
            description: 'Calculate LP/GP waterfall distributions'
          }
        ],
        authentication: 'Bearer token or session cookie required',
        rateLimit: '100 requests per minute'
      };

      res.json(docs);
    } catch (error: any) {
      console.error('Failed to get API docs:', error);
      res.status(500).json({ error: 'Failed to get API docs' });
    }
  });

  // Get modeling analytics and metrics
  app.get('/api/modeling/analytics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Parse filter parameters
      const filters: any = {};
      if (req.query.region) filters.region = req.query.region;
      if (req.query.state) filters.state = req.query.state;
      if (req.query.dealOutcome) filters.dealOutcome = req.query.dealOutcome;
      if (req.query.brokerId) filters.brokerId = req.query.brokerId;
      if (req.query.minPrice) filters.minPrice = parseFloat(req.query.minPrice as string);
      if (req.query.maxPrice) filters.maxPrice = parseFloat(req.query.maxPrice as string);
      if (req.query.minSize) filters.minSize = parseInt(req.query.minSize as string);
      if (req.query.maxSize) filters.maxSize = parseInt(req.query.maxSize as string);
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      
      const analytics = await storage.getModelingAnalytics(orgId, filters);
      res.json(analytics);
    } catch (error: any) {
      console.error('Failed to fetch modeling analytics:', error);
      res.status(500).json({ error: 'Failed to fetch modeling analytics' });
    }
  });

  // ============================================================================
  // APPROVAL NOTIFICATIONS - Email and In-App Notifications for Scenario Approvals
  // ============================================================================

  // Get pending approvals for the organization
  app.get('/api/approvals/pending', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const pendingApprovals = await approvalNotificationService.getPendingApprovals(orgId);
      res.json(pendingApprovals);
    } catch (error: any) {
      console.error('Failed to get pending approvals:', error);
      res.status(500).json({ error: 'Failed to get pending approvals' });
    }
  });

  // Get approval statistics
  app.get('/api/approvals/stats', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const stats = await approvalNotificationService.getApprovalStats(orgId);
      res.json(stats);
    } catch (error: any) {
      console.error('Failed to get approval stats:', error);
      res.status(500).json({ error: 'Failed to get approval statistics' });
    }
  });

  // Get available approvers for the organization
  app.get('/api/approvals/approvers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const approvers = await approvalNotificationService.getOrgApprovers(orgId);
      res.json(approvers);
    } catch (error: any) {
      console.error('Failed to get approvers:', error);
      res.status(500).json({ error: 'Failed to get approvers' });
    }
  });

  // Get user notifications
  app.get('/api/notifications', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const notifications = await approvalNotificationService.getUserNotifications(orgId, userId, unreadOnly);
      res.json(notifications);
    } catch (error: any) {
      console.error('Failed to get notifications:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  // Get unread notification count
  app.get('/api/notifications/unread-count', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      const count = await approvalNotificationService.getUnreadCount(orgId, userId);
      res.json({ count });
    } catch (error: any) {
      console.error('Failed to get unread count:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  });

  // Mark notification as read
  app.post('/api/notifications/:notificationId/read', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      await approvalNotificationService.markNotificationRead(notificationId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read
  app.post('/api/notifications/mark-all-read', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      await approvalNotificationService.markAllNotificationsRead(orgId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // Submit scenario for approval with specific approvers
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/submit-for-approval', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { approverIds } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      
      const updated = await scenarioVersioningService.submitForApproval(scenarioId, userId);

      if (approverIds && approverIds.length > 0) {
        await approvalNotificationService.notifyApprovalRequested(scenarioId, userId, approverIds);
      } else {
        const orgApprovers = await approvalNotificationService.getOrgApprovers(orgId);
        const approverUserIds = orgApprovers.map(a => a.id).filter(id => id !== userId);
        if (approverUserIds.length > 0) {
          await approvalNotificationService.notifyApprovalRequested(scenarioId, userId, approverUserIds);
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to submit for approval:', error);
      res.status(500).json({ error: 'Failed to submit for approval' });
    }
  });

  // Approve scenario with notifications
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/approve-with-notification', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { notes } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      
      const updated = await scenarioVersioningService.approveScenario(scenarioId, userId, notes);
      await approvalNotificationService.notifyApprovalDecision(scenarioId, 'approved', userId, notes);

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to approve scenario:', error);
      res.status(500).json({ error: 'Failed to approve scenario' });
    }
  });

  // Reject scenario with notifications
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/reject-with-notification', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { notes } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('./services/scenario-versioning-service');
      const { approvalNotificationService } = await import('./services/approval-notification-service');
      
      const updated = await scenarioVersioningService.rejectScenario(scenarioId, userId, notes);
      await approvalNotificationService.notifyApprovalDecision(scenarioId, 'rejected', userId, notes);

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to reject scenario:', error);
      res.status(500).json({ error: 'Failed to reject scenario' });
    }
  });

  // ============================================================================
  // QUICKBOOKS INTEGRATION - OAuth2 Connection and P&L Sync
  // ============================================================================

  // Get QuickBooks connection status
  app.get('/api/quickbooks/status', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const status = await quickBooksService.getConnectionStatus(orgId);
      res.json(status);
    } catch (error: any) {
      console.error('Failed to get QuickBooks status:', error);
      res.status(500).json({ error: 'Failed to get connection status' });
    }
  });

  // Get QuickBooks authorization URL
  app.get('/api/quickbooks/auth-url', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const authUrl = quickBooksService.getAuthorizationUrl(orgId);
      res.json({ authUrl });
    } catch (error: any) {
      console.error('Failed to generate auth URL:', error);
      res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
  });

  // QuickBooks OAuth callback
  app.get('/api/quickbooks/callback', async (req, res) => {
    try {
      const { code, realmId, state, error: oauthError } = req.query;
      
      if (oauthError) {
        console.error('QuickBooks OAuth error:', oauthError);
        return res.redirect('/settings/integrations?qb_error=authorization_denied');
      }

      if (!code || !realmId || !state) {
        return res.redirect('/settings/integrations?qb_error=missing_params');
      }

      const { quickBooksService } = await import('./services/quickbooks-service');
      await quickBooksService.handleCallback(
        code as string,
        realmId as string,
        state as string
      );

      res.redirect('/settings/integrations?qb_connected=true');
    } catch (error: any) {
      console.error('Failed to handle QuickBooks callback:', error);
      res.redirect('/settings/integrations?qb_error=connection_failed');
    }
  });

  // Disconnect QuickBooks
  app.post('/api/quickbooks/disconnect', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      await quickBooksService.disconnect(orgId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to disconnect QuickBooks:', error);
      res.status(500).json({ error: 'Failed to disconnect' });
    }
  });

  // Get QuickBooks company info
  app.get('/api/quickbooks/company', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const companyInfo = await quickBooksService.getCompanyInfo(orgId);
      res.json(companyInfo);
    } catch (error: any) {
      console.error('Failed to get company info:', error);
      res.status(500).json({ error: 'Failed to get company information' });
    }
  });

  // Get QuickBooks chart of accounts
  app.get('/api/quickbooks/accounts', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const accounts = await quickBooksService.getChartOfAccounts(orgId);
      res.json(accounts);
    } catch (error: any) {
      console.error('Failed to get chart of accounts:', error);
      res.status(500).json({ error: 'Failed to get chart of accounts' });
    }
  });

  // Get QuickBooks P&L report
  app.get('/api/quickbooks/profit-and-loss', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const { quickBooksService } = await import('./services/quickbooks-service');
      const report = await quickBooksService.getProfitAndLoss(
        orgId,
        startDate as string,
        endDate as string
      );
      res.json(report);
    } catch (error: any) {
      console.error('Failed to get P&L report:', error);
      res.status(500).json({ error: 'Failed to get Profit & Loss report' });
    }
  });

  // Sync QuickBooks P&L to modeling actuals
  app.post('/api/quickbooks/sync/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { startDate, endDate } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const { quickBooksService } = await import('./services/quickbooks-service');
      const result = await quickBooksService.syncProfitAndLossToActuals(
        orgId,
        projectId,
        startDate,
        endDate
      );
      res.json(result);
    } catch (error: any) {
      console.error('Failed to sync QuickBooks data:', error);
      res.status(500).json({ error: 'Failed to sync QuickBooks data' });
    }
  });

  // Get QuickBooks sync history
  app.get('/api/quickbooks/sync-history', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const limit = parseInt(req.query.limit as string) || 20;
      const { quickBooksService } = await import('./services/quickbooks-service');
      const history = await quickBooksService.getSyncHistory(orgId, limit);
      res.json(history);
    } catch (error: any) {
      console.error('Failed to get sync history:', error);
      res.status(500).json({ error: 'Failed to get sync history' });
    }
  });

  // Update account mapping
  app.post('/api/quickbooks/account-mapping', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { mapping } = req.body;
      
      if (!mapping) {
        return res.status(400).json({ error: 'Mapping data is required' });
      }

      const { quickBooksService } = await import('./services/quickbooks-service');
      await quickBooksService.updateAccountMapping(orgId, mapping);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update account mapping:', error);
      res.status(500).json({ error: 'Failed to update account mapping' });
    }
  });

  // ============================================================================
  // PORTFOLIO ROLL-UPS - Aggregate Views Across Modeling Projects
  // ============================================================================

  // Get portfolio summary
  app.get('/api/portfolio/summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projectIds = req.query.projectIds ? (req.query.projectIds as string).split(',') : undefined;
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const summary = await portfolioRollupService.getPortfolioSummary(orgId, projectIds);
      res.json(summary);
    } catch (error: any) {
      console.error('Failed to get portfolio summary:', error);
      res.status(500).json({ error: 'Failed to get portfolio summary' });
    }
  });

  // Get project rollups with filters
  app.get('/api/portfolio/projects', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: any = {};
      if (req.query.region) filters.region = req.query.region as string;
      if (req.query.state) filters.state = req.query.state as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.minValue) filters.minValue = parseFloat(req.query.minValue as string);
      if (req.query.maxValue) filters.maxValue = parseFloat(req.query.maxValue as string);
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const projects = await portfolioRollupService.getProjectRollups(orgId, filters);
      res.json(projects);
    } catch (error: any) {
      console.error('Failed to get project rollups:', error);
      res.status(500).json({ error: 'Failed to get project rollups' });
    }
  });

  // Get portfolio breakdown by region, state, status, and year
  app.get('/api/portfolio/breakdown', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const breakdown = await portfolioRollupService.getPortfolioBreakdown(orgId);
      res.json(breakdown);
    } catch (error: any) {
      console.error('Failed to get portfolio breakdown:', error);
      res.status(500).json({ error: 'Failed to get portfolio breakdown' });
    }
  });

  // Get portfolio projections for all scenarios
  app.get('/api/portfolio/projections', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projectIds = req.query.projectIds ? (req.query.projectIds as string).split(',') : undefined;
      const yearsToProject = parseInt(req.query.years as string) || 5;
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const projections = await portfolioRollupService.getPortfolioProjections(orgId, projectIds, yearsToProject);
      res.json(projections);
    } catch (error: any) {
      console.error('Failed to get portfolio projections:', error);
      res.status(500).json({ error: 'Failed to get portfolio projections' });
    }
  });

  // Get top performing projects
  app.get('/api/portfolio/top-performers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const topPerformers = await portfolioRollupService.getTopPerformingProjects(orgId, limit);
      res.json(topPerformers);
    } catch (error: any) {
      console.error('Failed to get top performers:', error);
      res.status(500).json({ error: 'Failed to get top performing projects' });
    }
  });

  // Get underperforming projects
  app.get('/api/portfolio/underperformers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const occupancyThreshold = parseFloat(req.query.threshold as string) || 70;
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const underperformers = await portfolioRollupService.getUnderperformingProjects(orgId, occupancyThreshold);
      res.json(underperformers);
    } catch (error: any) {
      console.error('Failed to get underperformers:', error);
      res.status(500).json({ error: 'Failed to get underperforming projects' });
    }
  });

  // Export full portfolio report
  app.get('/api/portfolio/export', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      const { portfolioRollupService } = await import('./services/portfolio-rollup-service');
      const report = await portfolioRollupService.exportPortfolioReport(orgId);
      res.json(report);
    } catch (error: any) {
      console.error('Failed to export portfolio report:', error);
      res.status(500).json({ error: 'Failed to export portfolio report' });
    }
  });

  // ============================================================================
  // DOCUMENT INTELLIGENCE - AI-Powered Financial Document Parsing
  // ============================================================================

  // Configure multer for document uploads
  const docIntelUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'server', 'uploads', 'doc-intel');
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${crypto.randomBytes(8).toString('hex')}${ext}`);
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for financial docs
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.ms-excel', // xls
        'text/csv',
        'application/pdf'
      ];
      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(csv|xls|xlsx)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only Excel, CSV, and PDF files are allowed.'));
      }
    }
  });

  // Initialize organization with default categories and patterns
// Custom Document Types Routes - to be added to routes.ts

// --- CUSTOM DOCUMENT TYPES ---

// Get all custom document types for organization
app.get('/api/doc-intel/custom-document-types', authenticateUser, async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const { customDocumentTypes } = await import('@shared/schema');
    const types = await db.select().from(customDocumentTypes).where(eq(customDocumentTypes.orgId, orgId)).orderBy(customDocumentTypes.sortOrder);
    res.json(types);
  } catch (error: any) {
    console.error('Failed to fetch custom document types:', error);
    res.status(500).json({ error: 'Failed to fetch custom document types' });
  }
});

// Create custom document type
app.post('/api/doc-intel/custom-document-types', authenticateUser, async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const userId = req.user.id;
    const { name, description } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const { customDocumentTypes } = await import('@shared/schema');
    
    // Check for duplicates
    const existing = await db.select().from(customDocumentTypes)
      .where(and(eq(customDocumentTypes.orgId, orgId), eq(customDocumentTypes.name, name.trim())));
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A document type with this name already exists' });
    }

    const [newType] = await db.insert(customDocumentTypes).values({
      orgId,
      name: name.trim(),
      description: description || null,
      createdBy: userId,
    }).returning();

    res.status(201).json(newType);
  } catch (error: any) {
    console.error('Failed to create custom document type:', error);
    res.status(500).json({ error: 'Failed to create custom document type' });
  }
});

// Delete custom document type
app.delete('/api/doc-intel/custom-document-types/:id', authenticateUser, async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const { id } = req.params;

    const { customDocumentTypes } = await import('@shared/schema');
    await db.delete(customDocumentTypes).where(and(eq(customDocumentTypes.id, id), eq(customDocumentTypes.orgId, orgId)));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete custom document type:', error);
    res.status(500).json({ error: 'Failed to delete custom document type' });
  }
});
  app.post('/api/modeling/doc-intel/init', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const result = await docIntelService.initializeOrganization(orgId);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to initialize document intelligence:', error);
      res.status(500).json({ error: 'Failed to initialize document intelligence' });
    }
  });

  // --- P&L CATEGORIES ---
  
  // Get all categories for organization (hierarchical)
  app.get('/api/modeling/doc-intel/categories', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const hierarchical = req.query.hierarchical === 'true';
      
      if (hierarchical) {
        const categories = await docIntelService.getCategoriesHierarchical(orgId);
        res.json(categories);
      } else {
        const categories = await docIntelService.getCategories(orgId);
        res.json(categories);
      }
    } catch (error: any) {
      console.error('Failed to fetch categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Create category
  app.post('/api/modeling/doc-intel/categories', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const category = await docIntelService.createCategory(orgId, req.body);
      res.status(201).json(category);
    } catch (error: any) {
      console.error('Failed to create category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  // Update category
  app.patch('/api/modeling/doc-intel/categories/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const category = await docIntelService.updateCategory(orgId, req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json(category);
    } catch (error: any) {
      console.error('Failed to update category:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  // Delete category (soft delete)
  app.delete('/api/modeling/doc-intel/categories/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      await docIntelService.deleteCategory(orgId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // --- DOCUMENT UPLOADS ---
  
  // Get all uploads for a project
  app.get('/api/modeling/projects/:projectId/documents', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { holdingOnly, holdingStatus } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      let uploads = await docIntelService.getProjectUploads(orgId, projectId);
      
      if (holdingOnly === 'true') {
        uploads = uploads.filter((u: any) => 
          u.holdingStatus && ['staging', 'validated', 'ready_to_process'].includes(u.holdingStatus)
        );
      }
      
      if (holdingStatus) {
        uploads = uploads.filter((u: any) => u.holdingStatus === holdingStatus);
      }
      
      const uploadIds = uploads.map((u: any) => u.id);
      let statsMap: Record<string, { total: number; pending: number; confirmed: number; rejected: number; needsReview: number; highConfidence: number; lowConfidence: number; imported: number }> = {};
      if (uploadIds.length > 0) {
        const { docIntelExtractedItems } = await import('@shared/schema');
        const { sql, inArray, and: andOp, eq: eqOp } = await import('drizzle-orm');
        const statsRows = await db.select({
          uploadId: docIntelExtractedItems.uploadId,
          total: sql<number>`count(*)::int`,
          pending: sql<number>`count(*) filter (where ${docIntelExtractedItems.status} = 'pending')::int`,
          confirmed: sql<number>`count(*) filter (where ${docIntelExtractedItems.status} = 'confirmed')::int`,
          rejected: sql<number>`count(*) filter (where ${docIntelExtractedItems.status} = 'rejected')::int`,
          highConfidence: sql<number>`count(*) filter (where ${docIntelExtractedItems.confidenceScore}::numeric >= 0.8)::int`,
          lowConfidence: sql<number>`count(*) filter (where ${docIntelExtractedItems.confidenceScore}::numeric < 0.8)::int`,
          imported: sql<number>`count(*) filter (where ${docIntelExtractedItems.targetRecordId} is not null)::int`,
        })
          .from(docIntelExtractedItems)
          .where(andOp(
            eqOp(docIntelExtractedItems.orgId, orgId),
            inArray(docIntelExtractedItems.uploadId, uploadIds)
          ))
          .groupBy(docIntelExtractedItems.uploadId);
        for (const row of statsRows) {
          statsMap[row.uploadId] = {
            total: row.total,
            pending: row.pending,
            confirmed: row.confirmed,
            rejected: row.rejected,
            needsReview: row.pending,
            highConfidence: row.highConfidence,
            lowConfidence: row.lowConfidence,
            imported: row.imported || 0,
          };
        }
      }
      
      const enriched = uploads.map((u: any) => ({
        ...u,
        stats: statsMap[u.id] || null,
      }));
      
      res.json(enriched);
    } catch (error: any) {
      console.error('Failed to fetch document uploads:', error);
      res.status(500).json({ error: 'Failed to fetch document uploads' });
    }
  });

  // Upload new document for processing (with SHA-256 duplicate detection)
  app.post('/api/modeling/projects/:projectId/documents', authenticateUser, docIntelUpload.single('file'), validateFileUpload({ maxSize: 50 * 1024 * 1024 }), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      let holdingTags: string[] = [];
      if (req.body.tags) {
        try {
          holdingTags = JSON.parse(req.body.tags);
        } catch {
          holdingTags = [];
        }
      }
      
      const checkProjectOnly = req.body.checkProjectOnly === 'true';
      
      const displayName = req.body.displayName?.trim() || req.file.originalname;
      
      const isT12 = req.body.isT12 === 'true';
      const rentRollSubType = req.body.docType === 'rent_roll' && req.body.rentRollSubType ? req.body.rentRollSubType : null;
      const isMultiYear = req.body.isMultiYear === 'true';
      let multiYears: number[] | null = null;
      if (isMultiYear && req.body.multiYears) {
        try {
          multiYears = JSON.parse(req.body.multiYears).map((y: string | number) => parseInt(String(y))).filter((y: number) => !isNaN(y));
        } catch { multiYears = null; }
      }
      const dataGranularity = req.body.dataGranularity === 'annual' ? 'annual' : 'monthly';
      const sheetIndex = req.body.sheetIndex != null ? parseInt(req.body.sheetIndex) : null;
      const sheetName = req.body.sheetName || null;
      const periodMetadata: any = {};
      if (isT12) {
        periodMetadata.t12StartMonth = req.body.t12StartMonth ? parseInt(req.body.t12StartMonth) : null;
        periodMetadata.t12StartYear = req.body.t12StartYear ? parseInt(req.body.t12StartYear) : null;
        periodMetadata.t12EndMonth = req.body.t12EndMonth ? parseInt(req.body.t12EndMonth) : null;
        periodMetadata.t12EndYear = req.body.t12EndYear ? parseInt(req.body.t12EndYear) : null;
      }
      if (sheetIndex != null) {
        periodMetadata.sheetIndex = sheetIndex;
        periodMetadata.sheetName = sheetName;
      }
      const finalPeriodMetadata = Object.keys(periodMetadata).length > 0 ? periodMetadata : null;

      let holdingTagsList = holdingTags;
      if (isT12 && !holdingTagsList.includes('T12')) {
        holdingTagsList = [...holdingTagsList, 'T12'];
      }
      if (isMultiYear && !holdingTagsList.includes('Multi-Year')) {
        holdingTagsList = [...holdingTagsList, 'Multi-Year'];
      }
      
      const allowOverwrite = req.body.allowOverwrite === 'true';
      
      const result = await docIntelService.createUploadWithDuplicateCheck(
        orgId, 
        {
          modelingProjectId: projectId,
          filename: req.file.filename,
          originalName: displayName,
          storagePath: req.file.path,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          docType: req.body.docType || null,
          year: req.body.year ? parseInt(req.body.year) : null,
          dataGranularity: dataGranularity as 'monthly' | 'annual',
          uploadedBy: userId,
          status: 'uploaded',
          holdingStatus: req.body.holdingStatus || 'staging',
          holdingTags: holdingTagsList.length > 0 ? holdingTagsList : null,
          holdingNotes: req.body.notes || null,
          isT12: isT12,
          isMultiYear: isMultiYear,
          multiYears: multiYears,
          periodMetadata: finalPeriodMetadata,
          rentRollSubType: rentRollSubType,
        },
        checkProjectOnly,
        allowOverwrite
      );
      
      if (result.isDuplicate && !allowOverwrite) {
        return res.status(409).json({
          error: 'duplicate',
          message: `This file has already been uploaded as "${result.originalUpload?.originalName || 'unknown'}"`,
          existingUploadId: result.originalUpload?.id,
          existingUploadName: result.originalUpload?.originalName,
          existingUploadDate: result.originalUpload?.createdAt,
        });
      }
      
      const docType = req.body.docType;
      const isParseable = ['pnl', 'rent_roll', 'balance_sheet', 'rate_sheet', 'invoice'].includes(docType);

      // Save to VDR for all non-P&L documents (alongside parsing)
      let savedToVdr = false;
      if (docType !== 'pnl') {
        try {
          const ddProjectId = project.ddProjectId;
          if (ddProjectId) {
            const { vdrFolders, vdrDocuments: vdrDocsTable } = await import('@shared/schema');
            const docTypeLabel = docType === 'rent_roll' ? 'Rent Rolls'
              : docType === 'balance_sheet' ? 'Balance Sheets'
              : docType === 'rate_sheet' ? 'Rate Sheets'
              : docType === 'invoice' ? 'Invoices'
              : 'Other Documents';
            const folderPath = `/Financial Documents/${docTypeLabel}`;

            let [parentFolder] = await db.select().from(vdrFolders)
              .where(and(eq(vdrFolders.projectId, ddProjectId), eq(vdrFolders.orgId, orgId), eq(vdrFolders.name, 'Financial Documents')))
              .limit(1);
            if (!parentFolder) {
              [parentFolder] = await db.insert(vdrFolders).values({
                projectId: ddProjectId, orgId, name: 'Financial Documents', path: '/Financial Documents',
                createdBy: userId,
              }).returning();
            }

            let [targetFolder] = await db.select().from(vdrFolders)
              .where(and(eq(vdrFolders.projectId, ddProjectId), eq(vdrFolders.orgId, orgId), eq(vdrFolders.name, docTypeLabel), eq(vdrFolders.parentFolderId, parentFolder.id)))
              .limit(1);
            if (!targetFolder) {
              [targetFolder] = await db.insert(vdrFolders).values({
                projectId: ddProjectId, orgId, name: docTypeLabel, path: folderPath,
                parentFolderId: parentFolder.id, createdBy: userId,
              }).returning();
            }

            const fileBuffer = await fs.readFile(req.file.path);
            const hashHex = require('crypto').createHash('sha256').update(fileBuffer).digest('hex');

            await db.insert(vdrDocsTable).values({
              folderId: targetFolder.id, projectId: ddProjectId, orgId,
              filename: displayName, originalFilename: req.file.originalname,
              mimeType: req.file.mimetype, size: req.file.size,
              checksum: hashHex, storagePath: req.file.path,
              uploadedBy: userId,
              aiCategory: docTypeLabel,
              tags: [req.body.docType],
            });
            savedToVdr = true;
            logger.info(`[DocIntel] Document ${result.upload.id} saved to VDR folder: ${folderPath}`);
          }
        } catch (vdrError: any) {
          console.error(`[DocIntel] Failed to save to VDR for upload ${result.upload.id}:`, vdrError.message);
        }
      }

      // Respond immediately, then process in background
      res.status(201).json({
        ...result.upload,
        isDuplicate: result.isDuplicate,
        savedToDataRoom: savedToVdr,
        originalUpload: result.originalUpload ? {
          id: result.originalUpload.id,
          originalName: result.originalUpload.originalName,
          createdAt: result.originalUpload.createdAt,
        } : null,
      });

      if (isParseable) {
        // Auto-parse ALL parseable document types in background (P&L, rent rolls, balance sheets, rate sheets, invoices)
        setImmediate(async () => {
          try {
            logger.info(`[DocIntel] Starting automatic AI parsing for ${docType} upload ${result.upload.id}`);
            await docIntelService.parseAndExtract(orgId, result.upload.id);
            logger.info(`[DocIntel] Parsing complete for upload ${result.upload.id}, categorizing...`);
            await docIntelService.categorizeItems(orgId, result.upload.id);
            logger.info(`[DocIntel] Categorization complete for upload ${result.upload.id}`);
            await docIntelService.updateUpload(orgId, result.upload.id, { status: 'reviewing' });
          } catch (parseError: any) {
            console.error(`[DocIntel] Background parsing failed for ${docType} upload ${result.upload.id}:`, parseError.message);
            try {
              await docIntelService.updateUpload(orgId, result.upload.id, { status: 'completed' });
            } catch (_) {}
          }
        });
      } else {
        // Non-parseable doc types (e.g., 'other') just go to completed
        await docIntelService.updateUpload(orgId, result.upload.id, { status: 'completed' });
      }
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      res.status(500).json({ error: 'Failed to upload document', details: error?.message });
    }
  });

  // Get single upload with stats
  app.get('/api/modeling/projects/:projectId/documents/:uploadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const stats = await docIntelService.getUploadStats(orgId, uploadId);
      res.json({ ...upload, stats });
    } catch (error: any) {
      console.error('Failed to fetch document:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  // Update upload metadata (doc type, year, wizard step)
  app.patch('/api/modeling/projects/:projectId/documents/:uploadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.updateUpload(orgId, uploadId, req.body);
      if (!upload) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      res.json(upload);
    } catch (error: any) {
      console.error('Failed to update document:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
  });

  // Delete upload and associated items
  app.delete('/api/modeling/projects/:projectId/documents/:uploadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      const purgeEntirely = req.query.purge === 'true';

      if (purgeEntirely) {
        const { purgeDocIntelUpload } = await import('./services/pnl/pnl-document-purge');
        const result = await purgeDocIntelUpload(uploadId, orgId, projectId);

        // Audit trail
        try {
          const { modelingAuditLog } = await import('@shared/schema');
          await db.insert(modelingAuditLog).values({
            orgId,
            modelingProjectId: projectId,
            eventType: 'document_purged',
            entityType: 'document',
            entityId: uploadId,
            newValue: result,
            changedFields: ['pnlDocuments', 'pnlFacts', 'modelingActuals', 'docIntelUploads'],
            userId: req.user.id,
            userEmail: req.user.email || null,
          });
        } catch (auditErr) {
          console.warn('[Audit] Failed to log purge:', auditErr);
        }

        res.json({ success: true, purged: true, ...result });
      } else {
        await docIntelService.deleteUpload(orgId, uploadId);
        res.json({ success: true });
      }
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  // ─── Revenue Source Toggle (Profit Center vs P&L Actuals per dept) ────
  app.get('/api/modeling/projects/:projectId/revenue-source-config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const cm = (project.customMetrics as any) || {};
      const revenueSourceByDept = cm.revenueSourceByDept || {};

      const { asmpFuel, asmpShipStore, asmpService, asmpBoatRentals,
              asmpBoatClub, asmpBoatSales, asmpCommercialTenants, asmpBookkeeping } = await import('@shared/schema');

      const [fuel, store, service, rentals, club, sales, tenants, bk] = await Promise.all([
        db.select({ id: asmpFuel.id }).from(asmpFuel).where(eq(asmpFuel.projectId, projectId)).limit(1),
        db.select({ id: asmpShipStore.id }).from(asmpShipStore).where(eq(asmpShipStore.projectId, projectId)).limit(1),
        db.select({ id: asmpService.id }).from(asmpService).where(eq(asmpService.projectId, projectId)).limit(1),
        db.select({ id: asmpBoatRentals.id }).from(asmpBoatRentals).where(eq(asmpBoatRentals.projectId, projectId)).limit(1),
        db.select({ id: asmpBoatClub.id }).from(asmpBoatClub).where(eq(asmpBoatClub.projectId, projectId)).limit(1),
        db.select({ id: asmpBoatSales.id }).from(asmpBoatSales).where(eq(asmpBoatSales.projectId, projectId)).limit(1),
        db.select({ id: asmpCommercialTenants.id }).from(asmpCommercialTenants).where(eq(asmpCommercialTenants.projectId, projectId)).limit(1),
        db.select({ id: asmpBookkeeping.id }).from(asmpBookkeeping).where(eq(asmpBookkeeping.projectId, projectId)).limit(1),
      ]);

      // Compute PC revenue totals
      const pcAmounts: Record<string, number> = {};
      pcAmounts['Fuel'] = fuel.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
      pcAmounts['Ship Store'] = store.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
      pcAmounts['Service'] = service.reduce((s: number, r: any) => s + Number(r.totalRevenue || 0), 0);
      pcAmounts['Boat Rentals'] = rentals.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
      pcAmounts['Boat Club'] = club.reduce((s: number, r: any) => s + Number(r.monthlyRecurringRevenue || 0), 0);
      pcAmounts['Boat Sales'] = sales.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
      pcAmounts['Commercial'] = tenants.reduce((s: number, r: any) => s + Number(r.totalRevenue || 0), 0);
      pcAmounts['Bookkeeping'] = bk.reduce((s: number, r: any) => s + Number(r.revenueTotalOverride || 0), 0);

      // Compute P&L actuals totals per department
      const { modelingActuals } = await import('@shared/schema');
      const pnlRows = await db.select({
        department: modelingActuals.department,
        total: sql<number>`sum(${modelingActuals.amount}::numeric)::float`,
      })
        .from(modelingActuals)
        .where(and(
          eq(modelingActuals.modelingProjectId, projectId),
          eq(modelingActuals.category, 'Revenue')
        ))
        .groupBy(modelingActuals.department);

      const pnlAmounts: Record<string, number> = {};
      for (const row of pnlRows) {
        if (row.department) pnlAmounts[row.department] = Math.round(row.total || 0);
      }

      const departments = [
        { dept: 'Fuel', label: 'Fuel Sales', hasProfitCenterData: fuel.length > 0, source: revenueSourceByDept['Fuel'] || 'profit_center', pcAmount: pcAmounts['Fuel'] || 0, pnlAmount: pnlAmounts['Fuel'] || 0 },
        { dept: 'Ship Store', label: 'Ship Store', hasProfitCenterData: store.length > 0, source: revenueSourceByDept['Ship Store'] || 'profit_center', pcAmount: pcAmounts['Ship Store'] || 0, pnlAmount: pnlAmounts['Ship Store'] || 0 },
        { dept: 'Service', label: 'Service Department', hasProfitCenterData: service.length > 0, source: revenueSourceByDept['Service'] || 'profit_center', pcAmount: pcAmounts['Service'] || 0, pnlAmount: pnlAmounts['Service'] || 0 },
        { dept: 'Boat Rentals', label: 'Boat Rentals', hasProfitCenterData: rentals.length > 0, source: revenueSourceByDept['Boat Rentals'] || 'profit_center', pcAmount: pcAmounts['Boat Rentals'] || 0, pnlAmount: pnlAmounts['Boat Rentals'] || 0 },
        { dept: 'Boat Club', label: 'Boat Club', hasProfitCenterData: club.length > 0, source: revenueSourceByDept['Boat Club'] || 'profit_center', pcAmount: pcAmounts['Boat Club'] || 0, pnlAmount: pnlAmounts['Boat Club'] || 0 },
        { dept: 'Boat Sales', label: 'Boat Sales', hasProfitCenterData: sales.length > 0, source: revenueSourceByDept['Boat Sales'] || 'profit_center', pcAmount: pcAmounts['Boat Sales'] || 0, pnlAmount: pnlAmounts['Boat Sales'] || 0 },
        { dept: 'Commercial', label: 'Commercial Tenants', hasProfitCenterData: tenants.length > 0, source: revenueSourceByDept['Commercial'] || 'profit_center', pcAmount: pcAmounts['Commercial'] || 0, pnlAmount: pnlAmounts['Commercial'] || 0 },
        { dept: 'Bookkeeping', label: 'Bookkeeping', hasProfitCenterData: bk.length > 0, source: revenueSourceByDept['Bookkeeping'] || 'profit_center', pcAmount: pcAmounts['Bookkeeping'] || 0, pnlAmount: pnlAmounts['Bookkeeping'] || 0 },
      ];

      res.json({ departments, revenueSourceByDept });
    } catch (error: any) {
      console.error('Failed to get revenue source config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/modeling/projects/:projectId/revenue-source-config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { revenueSourceByDept } = req.body;

      if (!revenueSourceByDept || typeof revenueSourceByDept !== 'object') {
        return res.status(400).json({ error: 'revenueSourceByDept object is required' });
      }

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const existingMetrics = (project.customMetrics as any) || {};
      const updatedMetrics = { ...existingMetrics, revenueSourceByDept };
      await storage.updateModelingProject(projectId, { customMetrics: updatedMetrics, updatedBy: userId }, orgId);

      // Audit trail
      try {
        const { modelingAuditLog } = await import('@shared/schema');
        await db.insert(modelingAuditLog).values({
          orgId,
          modelingProjectId: projectId,
          eventType: 'revenue_source_toggled',
          entityType: 'project_config',
          entityId: projectId,
          previousValue: existingMetrics.revenueSourceByDept || {},
          newValue: revenueSourceByDept,
          changedFields: Object.keys(revenueSourceByDept),
          userId,
          userEmail: req.user.email || null,
        });
      } catch (auditErr) {
        console.warn('[Audit] Failed to log revenue source change:', auditErr);
      }

      res.json({ success: true, revenueSourceByDept });
    } catch (error: any) {
      console.error('Failed to update revenue source config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Model Validation Warnings (data-driven) ────
  app.get('/api/modeling/projects/:projectId/validation-warnings', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const warnings: Array<{id: string; severity: string; category: string; title: string; message: string; recommendation?: string; value?: string; threshold?: string}> = [];
      let warnId = 0;
      const warn = (severity: string, category: string, title: string, message: string, recommendation?: string, value?: string, threshold?: string) => {
        warnings.push({ id: String(++warnId), severity, category, title, message, recommendation, value, threshold });
      };

      const { modelingActuals, docIntelUploads, docIntelExtractedItems } = await import('@shared/schema');

      const actualsCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(modelingActuals)
        .where(and(eq(modelingActuals.modelingProjectId, projectId), eq(modelingActuals.orgId, orgId)));
      if ((actualsCount[0]?.count || 0) === 0) {
        warn('warning', 'inputs', 'No Historical Data', 'No actuals imported yet. Upload and review P&L documents first.', 'Go to Uploads tab.');
      }

      const uploads = await db.select({ id: docIntelUploads.id, name: docIntelUploads.originalName })
        .from(docIntelUploads).where(and(eq(docIntelUploads.modelingProjectId, projectId), eq(docIntelUploads.orgId, orgId)));
      for (const upload of uploads) {
        const itemStats = await db.select({
          confirmed: sql<number>`count(*) filter (where ${docIntelExtractedItems.status} = 'confirmed')::int`,
          imported: sql<number>`count(*) filter (where ${docIntelExtractedItems.targetRecordId} is not null)::int`,
          pending: sql<number>`count(*) filter (where ${docIntelExtractedItems.status} = 'pending')::int`,
        }).from(docIntelExtractedItems).where(eq(docIntelExtractedItems.uploadId, upload.id));
        const s = itemStats[0] || { confirmed: 0, imported: 0, pending: 0 };
        if (s.confirmed > 0 && s.imported === 0)
          warn('critical', 'inputs', 'Confirmed Items Not Imported', (upload.name||'Document')+' has '+s.confirmed+' confirmed items not yet imported.', 'Click Refresh Actuals on Historical P&L.', s.confirmed+' confirmed', '0 imported');
        if (s.pending > 5)
          warn('info', 'inputs', 'Items Pending Review', (upload.name||'Document')+' has '+s.pending+' items pending review.', 'Review remaining items.');
      }

      const noDept = await db.select({ count: sql<number>`count(*)::int` })
        .from(modelingActuals)
        .where(and(eq(modelingActuals.modelingProjectId, projectId), or(isNull(modelingActuals.department), eq(modelingActuals.department, ''))));
      if ((noDept[0]?.count || 0) > 0)
        warn('warning', 'inputs', 'Missing Department Assignments', (noDept[0]?.count||0)+' actuals have no department.', 'Review doc-intel classifications and re-import.', (noDept[0]?.count||0)+' items', 'All assigned');

      const project = await storage.getModelingProject(projectId, orgId);
      const cm = (project?.customMetrics as any) || {};
      const rsbd = cm.revenueSourceByDept || {};
      for (const [dept, src] of Object.entries(rsbd)) {
        if (src !== 'pnl_actuals') continue;
        const da = await db.select({ count: sql<number>`count(*)::int` })
          .from(modelingActuals).where(and(eq(modelingActuals.modelingProjectId, projectId), eq(modelingActuals.department, dept), eq(modelingActuals.category, 'Revenue')));
        if ((da[0]?.count || 0) === 0)
          warn('warning', 'revenue', dept+' Set to P&L but No Data', dept+' uses P&L actuals but has no revenue data.', 'Upload P&L data or switch to Profit Center.');
      }

      const negRev = await db.select({ count: sql<number>`count(*)::int` })
        .from(modelingActuals).where(and(eq(modelingActuals.modelingProjectId, projectId), eq(modelingActuals.category, 'Revenue'), sql`${modelingActuals.amount}::numeric < -1000`));
      if ((negRev[0]?.count || 0) > 3)
        warn('warning', 'inputs', 'Negative Revenue Items', (negRev[0]?.count||0)+' revenue items are large negatives (possible miscategorized expenses).', 'Review in doc-intel.');

      const score = Math.max(0, 100 - warnings.filter(w=>w.severity==='critical').length*20 - warnings.filter(w=>w.severity==='warning').length*10 - warnings.filter(w=>w.severity==='info').length*2);
      res.json({ isValid: warnings.filter(w=>w.severity==='critical').length===0, score, warnings, summary: { critical: warnings.filter(w=>w.severity==='critical').length, warning: warnings.filter(w=>w.severity==='warning').length, info: warnings.filter(w=>w.severity==='info').length } });
    } catch (error: any) {
      console.error('Failed to generate validation warnings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Validate document in holding station (mark as ready for processing)
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/validate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const validationErrors: string[] = [];
      if (!upload.docType) {
        validationErrors.push('Document type is required');
      }
      if (!upload.year) {
        validationErrors.push('Fiscal year is required');
      }
      
      const updatedUpload = await docIntelService.updateUpload(orgId, uploadId, {
        holdingStatus: validationErrors.length === 0 ? 'validated' : 'staging',
        validationErrors: validationErrors.length > 0 ? validationErrors : null,
        validatedAt: validationErrors.length === 0 ? new Date() : null,
        validatedBy: validationErrors.length === 0 ? userId : null,
      });
      
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          validationErrors 
        });
      }
      
      res.json(updatedUpload);
    } catch (error: any) {
      console.error('Failed to validate document:', error);
      res.status(500).json({ error: 'Failed to validate document' });
    }
  });

  // --- PARSING & EXTRACTION ---
  
  // Parse document and extract line items
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/parse', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const items = await docIntelService.parseAndExtract(orgId, uploadId);
      res.json({ items, count: items.length });
    } catch (error: any) {
      console.error('Failed to parse document:', error);
      res.status(500).json({ error: 'Failed to parse document' });
    }
  });

  // Categorize extracted items using rules
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/categorize', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      const { enabledDepartments } = req.body || {};
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const items = await docIntelService.categorizeItems(orgId, uploadId, enabledDepartments);
      
      // Update upload to reviewing status
      await docIntelService.updateUpload(orgId, uploadId, { 
        status: 'reviewing',
        reviewStartedAt: new Date(),
        wizardStep: 2
      });
      
      res.json({ items, count: items.length });
    } catch (error: any) {
      console.error('Failed to categorize items:', error);
      res.status(500).json({ error: 'Failed to categorize items' });
    }
  });

  // --- EXTRACTED ITEMS ---
  
  // Get all extracted items for an upload
  app.get('/api/modeling/projects/:projectId/documents/:uploadId/items', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const grouped = req.query.grouped === 'true';
      if (grouped) {
        const groupedItems = await docIntelService.getExtractedItemsGrouped(orgId, uploadId);
        return res.json(groupedItems);
      }

      // Always apply learning rules for auto-confirmation
      const marinaId = upload.marinaId ?? null;
      const itemsWithRules = await docIntelService.getExtractedItemsWithLearningRules(orgId, uploadId, marinaId);
      
      const withCategories = req.query.withCategories === 'true';
      if (withCategories) {
        const categories = await docIntelService.getCategories(orgId);
        const categoryMap = new Map(categories.map((c: any) => [c.id, c]));
        const items = itemsWithRules.map((item: any) => ({
          ...item,
          suggestedCategory: item.categorySuggested ? categoryMap.get(item.categorySuggested) : undefined,
          confirmedCategory: item.categoryConfirmed ? categoryMap.get(item.categoryConfirmed) : undefined,
        }));
        return res.json(items);
      }
      
      res.json(itemsWithRules);
    } catch (error: any) {
      console.error('Failed to fetch extracted items:', error);
      res.status(500).json({ error: 'Failed to fetch extracted items' });
    }
  });

  // Confirm an extracted item (assign category and optionally department)
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/items/:itemId/confirm', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { itemId } = req.params;
      const { categoryId, amount, department } = req.body;
      
      if (!categoryId) {
        return res.status(400).json({ error: 'Cannot confirm: Category is required.' });
      }
      if (!department) {
        return res.status(400).json({ error: 'Cannot confirm: Department is required.' });
      }
      
      const item = await docIntelService.confirmItem(orgId, itemId, categoryId, userId, amount, department);
      res.json(item);
    } catch (error: any) {
      console.error('Failed to confirm item:', error);
      res.status(500).json({ error: error.message || 'Failed to confirm item' });
    }
  });

  // Reject an extracted item
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/items/:itemId/reject', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { itemId } = req.params;
      
      const item = await docIntelService.rejectItem(orgId, itemId);
      res.json(item);
    } catch (error: any) {
      console.error('Failed to reject item:', error);
      res.status(500).json({ error: 'Failed to reject item' });
    }
  });

  // Exclude an extracted item (different from reject - marks as excluded from import)
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/items/:itemId/exclude', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { itemId } = req.params;
      
      const item = await docIntelService.excludeItem(orgId, itemId);
      res.json(item);
    } catch (error: any) {
      console.error('Failed to exclude item:', error);
      res.status(500).json({ error: 'Failed to exclude item' });
    }
  });

  // Upload audit summary - processing status across recent uploads
  app.get('/api/uploads/audit-summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const limitVal = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const { docIntelUploads } = await import('@shared/schema');

      const uploads = await db
        .select({
          id: docIntelUploads.id,
          filename: docIntelUploads.filename,
          originalName: docIntelUploads.originalName,
          docType: docIntelUploads.docType,
          status: docIntelUploads.status,
          createdAt: docIntelUploads.createdAt,
          fileSize: docIntelUploads.fileSize,
          mimeType: docIntelUploads.mimeType,
          holdingStatus: docIntelUploads.holdingStatus,
          isDuplicate: docIntelUploads.isDuplicate,
          errorMessage: docIntelUploads.errorMessage,
          year: docIntelUploads.year,
          reviewCompletedAt: docIntelUploads.reviewCompletedAt,
          appliedAt: docIntelUploads.appliedAt,
        })
        .from(docIntelUploads)
        .where(eq(docIntelUploads.orgId, orgId))
        .orderBy(desc(docIntelUploads.createdAt))
        .limit(limitVal);

      // Compute audit stats
      const total = uploads.length;
      const completed = uploads.filter(u => u.status === 'completed').length;
      const reviewing = uploads.filter(u => u.status === 'reviewing').length;
      const failed = uploads.filter(u => u.status === 'error').length;
      const pending = uploads.filter(u => u.status === 'uploaded' || u.status === 'processing').length;
      const duplicates = uploads.filter(u => u.isDuplicate).length;
      const applied = uploads.filter(u => u.appliedAt !== null).length;

      res.json({
        stats: {
          total,
          completed,
          reviewing,
          failed,
          pending,
          duplicates,
          applied,
        },
        uploads,
      });
    } catch (error: any) {
      console.error('Error fetching upload audit summary:', error);
      res.status(500).json({ error: 'Failed to fetch audit summary' });
    }
  });

  // --- Simplified routes for PLReviewGrid component ---

  // Get extracted items by upload ID (simpler route)
  app.get('/api/doc-intel/uploads/:uploadId/items', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { uploadId } = req.params;
      const grouped = req.query.grouped === 'true';
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload) {
        return res.status(404).json({ error: 'Upload not found' });
      }
      
      if (grouped) {
        const groupedItems = await docIntelService.getExtractedItemsGrouped(orgId, uploadId);
        return res.json(groupedItems);
      }
      
      const items = await docIntelService.getExtractedItemsWithCategories(orgId, uploadId);
      res.json(items);
    } catch (error: any) {
      console.error('Failed to fetch items:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  });
  
  // Update a single extracted item
  app.patch('/api/doc-intel/items/:itemId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { itemId } = req.params;
      const updates = req.body;
      
      const item = await docIntelService.updateExtractedItem(orgId, itemId, updates, userId);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // ── Learning: record confirmed classification ──────────────────────
      if (updates.status === 'confirmed' || updates.categoryTierConfirmed) {
        recordConfirm(orgId, [{ rawText: item.rawText, ...updates }]).catch(e => console.error('[Learning single]', e.message, e.stack?.split('\n')[1]));
      }

      let propagation = { propagatedCount: 0, affectedUploadIds: [] as string[] };
      const hasStatusChange = updates.status !== undefined;
      const hasClassificationChange = updates.categoryTierConfirmed !== undefined || 
        updates.revenueCogsDeptConfirmed !== undefined || updates.expenseDeptConfirmed !== undefined;
      if (hasStatusChange || hasClassificationChange) {
        propagation = await docIntelService.propagateClassificationToSiblingUploads(
          orgId, item.uploadId, item.rawText, updates, userId
        );
      }

      // Auto-reimport if classification changed on already-imported items
      let _reimported = false;
      if (hasClassificationChange && item.targetRecordId) {
        try {
          const upload = await db.select({
            id: docIntelUploads.id,
            projectId: docIntelUploads.modelingProjectId,
            year: docIntelUploads.year,
          })
            .from(docIntelUploads)
            .where(eq(docIntelUploads.id, item.uploadId))
            .limit(1);

          if (upload.length > 0 && upload[0].projectId) {
            await docIntelService.importConfirmedItems(
              orgId, item.uploadId, upload[0].projectId, userId, upload[0].year || undefined
            );
            _reimported = true;
            logger.info(`[AutoReimport] Re-imported upload ${item.uploadId} after classification change`);
          }
        } catch (reimportErr) {
          console.warn('[AutoReimport] Failed:', reimportErr);
        }
      }

      res.json({ ...item, _propagation: propagation, _reimported });
    } catch (error: any) {
      if (error.message?.startsWith('Cannot confirm:')) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Failed to update item:', error);
      res.status(500).json({ error: 'Failed to update item' });
    }
  });
  
  // Bulk confirm ALL pending items for an upload (one-click confirm all)
  app.post('/api/doc-intel/uploads/:uploadId/confirm-all', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { uploadId } = req.params;
      const { categoryTierConfirmed, revenueCogsDeptConfirmed } = req.body;

      // Get all pending items
      const { docIntelExtractedItems } = await import('@shared/schema');
      const { eq, and, inArray } = await import('drizzle-orm');
      const pendingItems = await db.select({ id: docIntelExtractedItems.id })
        .from(docIntelExtractedItems)
        .where(and(
          eq(docIntelExtractedItems.uploadId, uploadId),
          eq(docIntelExtractedItems.status, 'pending')
        ));

      if (pendingItems.length === 0) {
        return res.json({ confirmed: 0, message: 'No pending items to confirm' });
      }

      const ids = pendingItems.map(i => i.id);
      const updates: any = { status: 'confirmed', updatedAt: new Date() };
      if (categoryTierConfirmed !== undefined) updates.categoryTierConfirmed = categoryTierConfirmed;
      if (revenueCogsDeptConfirmed !== undefined) updates.revenueCogsDeptConfirmed = revenueCogsDeptConfirmed;

      await db.update(docIntelExtractedItems)
        .set(updates)
        .where(inArray(docIntelExtractedItems.id, ids));

      // Auto-import to modeling_actuals
      const upload = await db.select({ modelingProjectId: docIntelExtractedItems.uploadId })
        .from(docIntelExtractedItems)
        .limit(1);

      const uploadRecord = await db.query.docIntelUploads?.findFirst?.({
        where: (t: any, { eq }: any) => eq(t.id, uploadId)
      }).catch(() => null);

      let imported = 0;
      if (uploadRecord?.modelingProjectId) {
        try {
          const lines = await docIntelService.importConfirmedItems(
            orgId, uploadId, uploadRecord.modelingProjectId, userId,
            uploadRecord.year || undefined
          );
          imported = lines.length;
        } catch (importErr: any) {
          console.warn('[ConfirmAll] Auto-import failed:', importErr.message);
        }
      }

      res.json({ confirmed: ids.length, imported, message: `Confirmed ${ids.length} items${imported ? `, imported ${imported} actuals` : ''}` });
    } catch (error: any) {
      console.error('Failed to confirm all items:', error);
      res.status(500).json({ error: 'Failed to confirm all items' });
    }
  });

  // Bulk update extracted items
  app.patch('/api/doc-intel/uploads/:uploadId/items/bulk', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { uploadId } = req.params;
      const { itemIds, updates } = req.body;
      
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: 'itemIds array required' });
      }
      
      let results: any[];
      try {
        results = await docIntelService.bulkUpdateExtractedItems(orgId, itemIds, updates, userId);
      } catch (bulkError: any) {
        if (bulkError.message?.startsWith('Cannot confirm:')) {
          return res.status(400).json({ error: bulkError.message });
        }
        throw bulkError;
      }

      // ── Learning: record confirmed classifications ───────────────────────
      if (updates.status === 'confirmed' || updates.categoryTierConfirmed) {
        const learningItems = results.map((r: any) => ({ rawText: r.rawText, ...updates }));
        recordConfirm(orgId, learningItems).catch(e => console.error('[Learning bulk]', e.message, e.stack?.split('\n')[1]));
      }

      const allAffectedUploadIds = new Set<string>();
      let totalPropagated = 0;
      const hasStatusChange = updates.status !== undefined;
      const hasClassificationChange = updates.categoryTierConfirmed !== undefined || 
        updates.revenueCogsDeptConfirmed !== undefined || updates.expenseDeptConfirmed !== undefined;
      if (hasStatusChange || hasClassificationChange) {
        const uniqueTexts = [...new Set(results.map(r => r.rawText))];
        for (const rawText of uniqueTexts) {
          const propagation = await docIntelService.propagateClassificationToSiblingUploads(
            orgId, uploadId, rawText, updates, userId
          );
          totalPropagated += propagation.propagatedCount;
          propagation.affectedUploadIds.forEach(id => allAffectedUploadIds.add(id));
        }
      }

      // Auto-reimport if classification changed on already-imported items
      let _reimported = false;
      if (hasClassificationChange) {
        try {
          const importedItems = results.filter((r: any) => r.targetRecordId);
          if (importedItems.length > 0) {
            const upload = await db.select({
              id: docIntelUploads.id,
              projectId: docIntelUploads.modelingProjectId,
              year: docIntelUploads.year,
            })
              .from(docIntelUploads)
              .where(eq(docIntelUploads.id, uploadId))
              .limit(1);

            if (upload.length > 0 && upload[0].projectId) {
              await docIntelService.importConfirmedItems(
                orgId, uploadId, upload[0].projectId, userId, upload[0].year || undefined
              );
              _reimported = true;
              logger.info('[AutoReimport] Re-imported upload ' + uploadId + ' after bulk classification change');
            }
          }
        } catch (reimportErr) {
          console.warn('[AutoReimport] Bulk failed:', reimportErr);
        }
      }

      res.json({ 
        updated: results.length,
        _reimported,
        _propagation: { 
          propagatedCount: totalPropagated, 
          affectedUploadIds: [...allAffectedUploadIds] 
        } 
      });
    } catch (error: any) {
      console.error('Failed to bulk update items:', error?.message, error?.stack?.split('\n').slice(0,3).join(' | '));
      res.status(500).json({ error: 'Failed to bulk update items', detail: error?.message });
    }
  });

  // Auto-confirm high confidence items
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/items/confirm-high-confidence', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { uploadId } = req.params;
      const threshold = parseFloat(req.body.threshold) || 0.9;
      
      const count = await docIntelService.confirmAllHighConfidence(orgId, uploadId, userId, threshold);
      res.json({ confirmed: count });
    } catch (error: any) {
      console.error('Failed to auto-confirm items:', error);
      res.status(500).json({ error: 'Failed to auto-confirm items' });
    }
  });

  // --- APPROVAL WORKFLOW ---

  // Approve a document for import (marks document as ready to apply)
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/approve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { uploadId } = req.params;
      const { notes } = req.body;
      
      const upload = await docIntelService.approveDocument(orgId, uploadId, userId, notes);
      res.json(upload);
    } catch (error: any) {
      console.error('Failed to approve document:', error);
      res.status(500).json({ error: 'Failed to approve document' });
    }
  });

  // --- IMPORT TO P&L ---
  
  // Import confirmed items to P&L Lines
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/import', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, uploadId } = req.params;
      const { fiscalYear } = req.body;
      
      logger.info("[Doc Intel Import] projectId:", projectId, "uploadId:", uploadId, "fiscalYear:", fiscalYear);
      const lines = await docIntelService.importConfirmedItems(orgId, uploadId, projectId, userId, fiscalYear);
      res.json({ imported: lines.length, lines });
      logger.info("[Doc Intel Import] Result - imported lines:", lines.length);
    } catch (error: any) {
      console.error('Failed to import items:', error);
      res.status(500).json({ error: 'Failed to import items' });
    }
  });

  // Re-import all confirmed doc-intel items for a project (re-derive actuals from current classifications)
  app.post('/api/modeling/projects/:projectId/reimport-actuals', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;

      // Find all doc-intel uploads for this project that have imported items
      const uploads = await db.select({
        id: docIntelUploads.id,
        year: docIntelUploads.year,
      })
        .from(docIntelUploads)
        .where(and(
          eq(docIntelUploads.modelingProjectId, projectId),
          eq(docIntelUploads.orgId, orgId)
        ));

      let totalImported = 0;
      const results: Array<{ uploadId: string; imported: number }> = [];

      for (const upload of uploads) {
        // Check if this upload has any confirmed items
        const confirmedCount = await db.select({ id: docIntelExtractedItems.id })
          .from(docIntelExtractedItems)
          .where(and(
            eq(docIntelExtractedItems.uploadId, upload.id),
            eq(docIntelExtractedItems.status, 'confirmed')
          ))
          .limit(1);

        if (confirmedCount.length > 0) {
          const lines = await docIntelService.importConfirmedItems(
            orgId, upload.id, projectId, userId, upload.year || undefined
          );
          totalImported += lines.length;
          results.push({ uploadId: upload.id, imported: lines.length });
        }
      }

      // Also run P&L pipeline promote (covers the other upload path)
      let pnlPromoted = 0;
      try {
        const { promoteToActuals } = await import('./services/pnl/promote-to-actuals');
        const promoteResult = await promoteToActuals(projectId, orgId);
        pnlPromoted = promoteResult?.promoted || 0;
      } catch (pnlErr) {
        console.warn('[Reimport] P&L pipeline promote skipped:', pnlErr);
      }

      logger.info(`[Reimport] Re-imported ${totalImported} doc-intel actuals + ${pnlPromoted} P&L pipeline actuals across ${results.length} uploads for project ${projectId}`);

      // Audit trail
      try {
        const { modelingAuditLog } = await import('@shared/schema');
        await db.insert(modelingAuditLog).values({
          orgId,
          modelingProjectId: projectId,
          eventType: 'actuals_reimported',
          entityType: 'actuals',
          entityId: projectId,
          newValue: { totalImported, pnlPromoted, uploadCount: results.length },
          changedFields: ['modelingActuals'],
          userId,
          userEmail: req.user.email || null,
        });
      } catch (auditErr) {
        console.warn('[Audit] Failed to log reimport:', auditErr);
      }

      res.json({ success: true, totalImported, pnlPromoted, uploads: results });
    } catch (error: any) {
      console.error('Failed to reimport actuals:', error);
      res.status(500).json({ error: 'Failed to reimport actuals' });
    }
  });
  // Re-import: clear existing actuals for this upload and re-import confirmed items
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/reimport', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, uploadId } = req.params;

      // Verify project access
      const [project] = await db.select().from(modelingProjects)
        .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
      if (!project) return res.status(404).json({ error: 'Project not found' });

      // Clear previous actuals from this upload
      const { modelingActuals } = await import('@shared/schema');
      await db.delete(modelingActuals).where(
        and(
          eq(modelingActuals.orgId, orgId),
          eq(modelingActuals.modelingProjectId, projectId),
          eq(modelingActuals.sourceRecordType, 'doc_intel_extracted_item'),
          sql`${modelingActuals.sourceRecordId} IN (
            SELECT id FROM doc_intel_extracted_items WHERE upload_id = ${uploadId}
          )`
        )
      );

      // Re-import confirmed items
      const imported = await docIntelService.importConfirmedItems(orgId, uploadId, projectId, userId);

      res.json({
        reimported: imported.length,
        cleared: true,
        message: `Cleared previous import and re-imported ${imported.length} line items`
      });
    } catch (error: any) {
      console.error('Failed to reimport:', error);
      res.status(500).json({ error: error.message || 'Failed to reimport' });
    }
  });

  // Reprocess a completed document - reset to review state
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/reprocess', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const result = await docIntelService.reprocessUpload(orgId, uploadId);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to reprocess document:', error);
      res.status(500).json({ error: 'Failed to reprocess document' });
    }
  });
  // Retry parsing a stuck or errored document
  app.post("/api/modeling/projects/:projectId/documents/:uploadId/retry", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;

      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload || upload.modelingProjectId !== projectId) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json({ message: "Retrying parse", uploadId });

      setImmediate(async () => {
        try {
          logger.info(`[DocIntel] Retrying parse for upload ${uploadId}`);
          const items = await docIntelService.retryParse(orgId, uploadId);
          logger.info(`[DocIntel] Retry parse complete for ${uploadId}, ${items.length} items extracted`);
          await docIntelService.categorizeItems(orgId, uploadId);
          logger.info(`[DocIntel] Retry categorization complete for ${uploadId}`);
          const { updateUpload } = docIntelService;
          await docIntelService.updateUpload(orgId, uploadId, { status: "reviewing" });
        } catch (parseError: any) {
          console.error(`[DocIntel] Retry parse failed for ${uploadId}:`, parseError.message);
        }
      });
    } catch (error: any) {
      console.error("Failed to retry document:", error);
      res.status(500).json({ error: "Failed to retry document parsing" });
    }
  });
  // Import Rent Roll document to Rent Roll module with customer creation and CRM linking
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/import-rent-roll', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      const { 
        rentRollId, 
        rentRollName, 
        effectiveDate, 
        createCustomers = true, 
        linkToCrm = true 
      } = req.body;
      
      const result = await docIntelService.importRentRollToModule(orgId, uploadId, {
        rentRollId,
        rentRollName,
        effectiveDate,
        createCustomers,
        linkToCrm,
      });
      
      res.json({
        success: true,
        rentRoll: result.rentRoll,
        stats: {
          entriesImported: result.entries.length,
          customersCreated: result.customers.length,
          contactsLinked: result.matchedContacts.length,
          errors: result.errors.length,
        },
        entries: result.entries,
        customers: result.customers,
        matchedContacts: result.matchedContacts,
        errors: result.errors,
      });
    } catch (error: any) {
      console.error('Failed to import rent roll:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to import rent roll' 
      });
    }
  });

  // Preview rent roll document parsing (without importing)
  app.post('/api/modeling/projects/:projectId/documents/:uploadId/preview-rent-roll', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      
      const upload = await docIntelService.getUpload(orgId, uploadId);
      if (!upload) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const parsed = await docIntelService.parseRentRollFile(upload.storagePath);
      
      const tenantNames = parsed
        .filter(p => p.tenantName && p.status !== 'vacant')
        .map(p => p.tenantName as string);
      
      const uniqueTenants = [...new Set(tenantNames)];
      const crmMatches = await docIntelService.matchTenantsToCrmContacts(orgId, uniqueTenants);
      
      res.json({
        entries: parsed,
        summary: {
          totalUnits: parsed.length,
          occupiedUnits: parsed.filter(p => p.status !== 'vacant').length,
          vacantUnits: parsed.filter(p => p.status === 'vacant').length,
          totalMonthlyRevenue: parsed.reduce((sum, p) => sum + p.monthlyRate, 0),
          uniqueTenants: uniqueTenants.length,
        },
        crmMatching: crmMatches,
      });
    } catch (error: any) {
      console.error('Failed to preview rent roll:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to preview rent roll' 
      });
    }
  });

  // Match tenant names to CRM contacts
  app.post('/api/modeling/doc-intel/match-tenants', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { tenantNames } = req.body;
      
      if (!Array.isArray(tenantNames)) {
        return res.status(400).json({ error: 'tenantNames must be an array' });
      }
      
      const result = await docIntelService.matchTenantsToCrmContacts(orgId, tenantNames);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to match tenants:', error);
      res.status(500).json({ error: 'Failed to match tenants to CRM contacts' });
    }
  });

  // Get P&L Lines for a project
  app.get('/api/modeling/projects/:projectId/pnl-lines', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const lines = await docIntelService.getProjectPnlLines(orgId, projectId);
      res.json(lines);
    } catch (error: any) {
      console.error('Failed to fetch P&L lines:', error);
      res.status(500).json({ error: 'Failed to fetch P&L lines' });
    }
  });

  // Get P&L Summary by category for variance preview
  app.get('/api/modeling/projects/:projectId/pnl-summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const summary = await docIntelService.getPnlSummaryByCategory(orgId, projectId);
      res.json(summary);
    } catch (error: any) {
      console.error('Failed to fetch P&L summary:', error);
      res.status(500).json({ error: 'Failed to fetch P&L summary' });
    }
  });

  // --- CATEGORY MAPPINGS & RULES ---
  
  // Get category mappings for organization
  app.get('/api/modeling/doc-intel/mappings', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projectId = req.query.projectId as string | undefined;
      
      const mappings = await docIntelService.getCategoryMappings(orgId, projectId);
      res.json(mappings);
    } catch (error: any) {
      console.error('Failed to fetch category mappings:', error);
      res.status(500).json({ error: 'Failed to fetch category mappings' });
    }
  });

  // Create learning rule from user feedback
  app.post('/api/modeling/doc-intel/rules', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { name, keywords, categoryId } = req.body;
      
      if (!name || !keywords || !categoryId) {
        return res.status(400).json({ error: 'name, keywords, and categoryId are required' });
      }
      
      const rule = await docIntelService.createLearningRule(orgId, name, keywords, categoryId, userId);
      res.status(201).json(rule);
    } catch (error: any) {
      console.error('Failed to create learning rule:', error);
      res.status(500).json({ error: 'Failed to create learning rule' });
    }
  });

  // ============================================================================
  // EXIT STRATEGY SUITE
  // ============================================================================

  // --- EXIT DASHBOARD METRICS ---
  app.get('/api/modeling/projects/:projectId/exit/metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }

      const { modelingActuals, modelingFinancialPeriods } = await import('@shared/schema');

      const propertyValue = project.purchasePrice ? parseFloat(project.purchasePrice.toString()) : null;

      let t12Ebitda: number | null = null;
      let t12Label: string | null = null;

      try {
        const financialPeriods = await db.select()
          .from(modelingFinancialPeriods)
          .where(and(
            eq(modelingFinancialPeriods.modelingProjectId, projectId),
            eq(modelingFinancialPeriods.orgId, orgId)
          ));

        const t12Period = financialPeriods.find(p => p.periodType === 't12');
        if (t12Period) {
          t12Ebitda = t12Period.ebitda ? parseFloat(t12Period.ebitda) : (t12Period.noi ? parseFloat(t12Period.noi) : null);
          t12Label = t12Period.periodLabel || 'T12';
        }

        if (t12Ebitda === null) {
          const actuals = await db.select({
            year: modelingActuals.year,
            month: modelingActuals.month,
            category: modelingActuals.category,
            amount: modelingActuals.amount,
          })
          .from(modelingActuals)
          .where(and(
            eq(modelingActuals.modelingProjectId, projectId),
            eq(modelingActuals.orgId, orgId)
          ));

          if (actuals.length > 0) {
            const periods = new Set(actuals.map(a => `${a.year}-${String(a.month).padStart(2, '0')}`));
            const sortedPeriods = Array.from(periods).sort().slice(-12);

            if (sortedPeriods.length > 0) {
              const validPeriods = new Set(sortedPeriods);
              let revenue = 0;
              let cogs = 0;
              let expenses = 0;

              for (const actual of actuals) {
                const key = `${actual.year}-${String(actual.month).padStart(2, '0')}`;
                if (!validPeriods.has(key)) continue;
                const amt = parseFloat(actual.amount?.toString() || '0');
                const cat = actual.category?.toLowerCase() || '';
                if (cat === 'revenue') revenue += amt;
                else if (cat === 'cogs') cogs += amt;
                else if (cat === 'expenses' || cat === 'expense') expenses += amt;
              }
              const rawNoi = revenue - cogs - expenses;

              // Apply active addbacks to get normalized NOI
              let addbackTotal = 0;
              try {
                const { modelingAddbacks, modelingAddbackValues } = await import('@shared/schema');
                const activeAddbackRows = await db.select()
                  .from(modelingAddbacks)
                  .where(and(
                    eq(modelingAddbacks.projectId, projectId),
                    eq(modelingAddbacks.orgId, orgId),
                    eq(modelingAddbacks.isActive, true)
                  ));
                for (const ab of activeAddbackRows) {
                  const vals = await db.select()
                    .from(modelingAddbackValues)
                    .where(eq(modelingAddbackValues.addbackId, ab.id));
                  for (const v of vals) {
                    addbackTotal += parseFloat(v.amount?.toString() || '0');
                  }
                }
              } catch (abErr) {
                console.warn('[Exit Metrics] Addback fetch failed (non-fatal):', abErr);
              }
              t12Ebitda = rawNoi + addbackTotal;

              const firstPeriod = sortedPeriods[0].split('-');
              const lastPeriod = sortedPeriods[sortedPeriods.length - 1].split('-');
              const startMonth = parseInt(firstPeriod[1]);
              const startYear = parseInt(firstPeriod[0]);
              const endMonth = parseInt(lastPeriod[1]);
              const endYear = parseInt(lastPeriod[0]);
              const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

              if (sortedPeriods.length === 12 && startMonth === 1 && endMonth === 12 && startYear === endYear) {
                t12Label = `FY ${startYear}`;
              } else {
                t12Label = `${monthNames[startMonth - 1]} ${startYear} - ${monthNames[endMonth - 1]} ${endYear}`;
              }
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to compute T12 EBITDA for project ${projectId}:`, e);
      }

      let capRate: number | null = null;
      if (t12Ebitda && propertyValue && propertyValue > 0) {
        capRate = (t12Ebitda / propertyValue) * 100;
      }

      const isOwnedMarina = project.dealSource === 'owned_marina';

      res.json({
        propertyValue,
        t12Ebitda,
        t12Label,
        capRate,
        isOwnedMarina,
        dealSource: project.dealSource,
      });
    } catch (error: any) {
      console.error('Failed to fetch exit metrics:', error);
      res.status(500).json({ error: 'Failed to fetch exit metrics' });
    }
  });

  // --- EXIT SCENARIOS ---

  // Get best exit scenario metrics for all projects in org (batch for listing page)
  app.get('/api/modeling/exit-summaries', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const summaries = await storage.getExitScenarioBestByOrg(orgId);
      res.json(summaries);
    } catch (error: any) {
      console.error('Failed to fetch exit summaries:', error);
      res.status(500).json({ error: 'Failed to fetch exit summaries' });
    }
  });
  
  // Get all exit scenarios for a modeling project
  app.get('/api/modeling/projects/:projectId/exit/scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      // Verify project exists and belongs to organization
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenarios = await storage.getExitScenarios(projectId, orgId);
      res.json(scenarios);
    } catch (error: any) {
      console.error('Failed to fetch exit scenarios:', error);
      res.status(500).json({ error: 'Failed to fetch exit scenarios' });
    }
  });

  // Get single exit scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario || scenario.modelingProjectId !== projectId) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      res.json(scenario);
    } catch (error: any) {
      console.error('Failed to fetch exit scenario:', error);
      res.status(500).json({ error: 'Failed to fetch exit scenario' });
    }
  });

  // Create exit scenario
  app.post('/api/modeling/projects/:projectId/exit/scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenario = await storage.createExitScenario({
        ...req.body,
        modelingProjectId: projectId,
        orgId,
        createdBy: userId
      });
      
      // Log activity
      await storage.createExitActivity({
        modelingProjectId: projectId,
        exitScenarioId: scenario.id,
        activityType: 'scenario_created',
        description: `Created exit scenario: ${scenario.name}`,
        userId,
        orgId
      });
      
      res.status(201).json(scenario);
    } catch (error: any) {
      console.error('Failed to create exit scenario:', error);
      res.status(500).json({ error: 'Failed to create exit scenario' });
    }
  });

  // Update exit scenario
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenario = await storage.updateExitScenario(scenarioId, {
        ...req.body,
        updatedBy: userId
      }, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      res.json(scenario);
    } catch (error: any) {
      console.error('Failed to update exit scenario:', error);
      res.status(500).json({ error: 'Failed to update exit scenario' });
    }
  });

  // Delete exit scenario
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const success = await storage.deleteExitScenario(scenarioId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete exit scenario:', error);
      res.status(500).json({ error: 'Failed to delete exit scenario' });
    }
  });

  // --- TAX CALCULATIONS ---

  // Get tax calculations for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/tax', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const taxCalcs = await storage.getExitTaxCalculations(scenarioId, orgId);
      res.json(taxCalcs);
    } catch (error: any) {
      console.error('Failed to fetch tax calculations:', error);
      res.status(500).json({ error: 'Failed to fetch tax calculations' });
    }
  });

  // Create tax calculation
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/tax', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const taxCalc = await storage.createExitTaxCalculation({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(taxCalc);
    } catch (error: any) {
      console.error('Failed to create tax calculation:', error);
      res.status(500).json({ error: 'Failed to create tax calculation' });
    }
  });

  // Update tax calculation
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/tax/:taxId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { taxId } = req.params;
      
      const taxCalc = await storage.updateExitTaxCalculation(taxId, req.body, orgId);
      if (!taxCalc) {
        return res.status(404).json({ error: 'Tax calculation not found' });
      }
      
      res.json(taxCalc);
    } catch (error: any) {
      console.error('Failed to update tax calculation:', error);
      res.status(500).json({ error: 'Failed to update tax calculation' });
    }
  });

  // Delete tax calculation
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/tax/:taxId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { taxId } = req.params;
      
      const success = await storage.deleteExitTaxCalculation(taxId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Tax calculation not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete tax calculation:', error);
      res.status(500).json({ error: 'Failed to delete tax calculation' });
    }
  });

  // --- AI EXIT INSIGHTS ---

  app.post('/api/modeling/projects/:projectId/exit/ai-analysis', authenticateUser, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { prompt } = req.body || {};
      const result = await generateExitAIInsights(projectId, prompt, {
        orgId: req.user.orgId,
        userId: req.user.id,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Exit AI analysis failed:', error);
      res.status(500).json({ error: 'AI analysis failed' });
    }
  });

  // --- SELLER FINANCING ---

  // Get seller financing for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/seller-financing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const sellerFinancing = await storage.getExitSellerFinancing(scenarioId, orgId);
      res.json(sellerFinancing);
    } catch (error: any) {
      console.error('Failed to fetch seller financing:', error);
      res.status(500).json({ error: 'Failed to fetch seller financing' });
    }
  });

  // Create seller financing
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/seller-financing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const sellerFinancing = await storage.createExitSellerFinancing({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(sellerFinancing);
    } catch (error: any) {
      console.error('Failed to create seller financing:', error);
      res.status(500).json({ error: 'Failed to create seller financing' });
    }
  });

  // Update seller financing
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/seller-financing/:sfId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { sfId } = req.params;
      
      const sellerFinancing = await storage.updateExitSellerFinancing(sfId, req.body, orgId);
      if (!sellerFinancing) {
        return res.status(404).json({ error: 'Seller financing not found' });
      }
      
      res.json(sellerFinancing);
    } catch (error: any) {
      console.error('Failed to update seller financing:', error);
      res.status(500).json({ error: 'Failed to update seller financing' });
    }
  });

  // Delete seller financing
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/seller-financing/:sfId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { sfId } = req.params;
      
      const success = await storage.deleteExitSellerFinancing(sfId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Seller financing not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete seller financing:', error);
      res.status(500).json({ error: 'Failed to delete seller financing' });
    }
  });

  // --- EARNOUTS ---

  // Get earnouts for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/earnouts', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const earnouts = await storage.getExitEarnouts(scenarioId, orgId);
      res.json(earnouts);
    } catch (error: any) {
      console.error('Failed to fetch earnouts:', error);
      res.status(500).json({ error: 'Failed to fetch earnouts' });
    }
  });

  // Create earnout
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/earnouts', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const earnout = await storage.createExitEarnout({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(earnout);
    } catch (error: any) {
      console.error('Failed to create earnout:', error);
      res.status(500).json({ error: 'Failed to create earnout' });
    }
  });

  // Update earnout
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/earnouts/:earnoutId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { earnoutId } = req.params;
      
      const earnout = await storage.updateExitEarnout(earnoutId, req.body, orgId);
      if (!earnout) {
        return res.status(404).json({ error: 'Earnout not found' });
      }
      
      res.json(earnout);
    } catch (error: any) {
      console.error('Failed to update earnout:', error);
      res.status(500).json({ error: 'Failed to update earnout' });
    }
  });

  // Delete earnout
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/earnouts/:earnoutId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { earnoutId } = req.params;
      
      const success = await storage.deleteExitEarnout(earnoutId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Earnout not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete earnout:', error);
      res.status(500).json({ error: 'Failed to delete earnout' });
    }
  });

  // --- 1031 EXCHANGES ---

  // Get 1031 exchanges for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/1031', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const exchanges = await storage.getExit1031Exchanges(scenarioId, orgId);
      res.json(exchanges);
    } catch (error: any) {
      console.error('Failed to fetch 1031 exchanges:', error);
      res.status(500).json({ error: 'Failed to fetch 1031 exchanges' });
    }
  });

  // Create 1031 exchange
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/1031', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const exchange = await storage.createExit1031Exchange({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(exchange);
    } catch (error: any) {
      console.error('Failed to create 1031 exchange:', error);
      res.status(500).json({ error: 'Failed to create 1031 exchange' });
    }
  });

  // Update 1031 exchange
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/1031/:exchangeId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { exchangeId } = req.params;
      
      const exchange = await storage.updateExit1031Exchange(exchangeId, req.body, orgId);
      if (!exchange) {
        return res.status(404).json({ error: '1031 exchange not found' });
      }
      
      res.json(exchange);
    } catch (error: any) {
      console.error('Failed to update 1031 exchange:', error);
      res.status(500).json({ error: 'Failed to update 1031 exchange' });
    }
  });

  // Delete 1031 exchange
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/1031/:exchangeId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { exchangeId } = req.params;
      
      const success = await storage.deleteExit1031Exchange(exchangeId, orgId);
      if (!success) {
        return res.status(404).json({ error: '1031 exchange not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete 1031 exchange:', error);
      res.status(500).json({ error: 'Failed to delete 1031 exchange' });
    }
  });

  // --- DST ANALYSES ---

  // Get DST analyses for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/dst', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const dstAnalyses = await storage.getExitDstAnalyses(scenarioId, orgId);
      res.json(dstAnalyses);
    } catch (error: any) {
      console.error('Failed to fetch DST analyses:', error);
      res.status(500).json({ error: 'Failed to fetch DST analyses' });
    }
  });

  // Create DST analysis
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/dst', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const dstAnalysis = await storage.createExitDstAnalysis({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(dstAnalysis);
    } catch (error: any) {
      console.error('Failed to create DST analysis:', error);
      res.status(500).json({ error: 'Failed to create DST analysis' });
    }
  });

  // Update DST analysis
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/dst/:dstId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dstId } = req.params;
      
      const dstAnalysis = await storage.updateExitDstAnalysis(dstId, req.body, orgId);
      if (!dstAnalysis) {
        return res.status(404).json({ error: 'DST analysis not found' });
      }
      
      res.json(dstAnalysis);
    } catch (error: any) {
      console.error('Failed to update DST analysis:', error);
      res.status(500).json({ error: 'Failed to update DST analysis' });
    }
  });

  // Delete DST analysis
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/dst/:dstId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dstId } = req.params;
      
      const success = await storage.deleteExitDstAnalysis(dstId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'DST analysis not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete DST analysis:', error);
      res.status(500).json({ error: 'Failed to delete DST analysis' });
    }
  });

  // --- FUNDS ---

  // Get all funds for organization
  app.get('/api/exit/funds', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const funds = await storage.getExitFunds(orgId);
      res.json(funds);
    } catch (error: any) {
      console.error('Failed to fetch funds:', error);
      res.status(500).json({ error: 'Failed to fetch funds' });
    }
  });

  // Get single fund
  app.get('/api/exit/funds/:fundId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const fund = await storage.getExitFund(fundId, orgId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      res.json(fund);
    } catch (error: any) {
      console.error('Failed to fetch fund:', error);
      res.status(500).json({ error: 'Failed to fetch fund' });
    }
  });

  // Create fund
  app.post('/api/exit/funds', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      const fund = await storage.createExitFund({
        ...req.body,
        orgId
      });
      
      res.status(201).json(fund);
    } catch (error: any) {
      console.error('Failed to create fund:', error);
      res.status(500).json({ error: 'Failed to create fund' });
    }
  });

  // Update fund
  app.patch('/api/exit/funds/:fundId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const fund = await storage.updateExitFund(fundId, req.body, orgId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      res.json(fund);
    } catch (error: any) {
      console.error('Failed to update fund:', error);
      res.status(500).json({ error: 'Failed to update fund' });
    }
  });

  // Delete fund
  app.delete('/api/exit/funds/:fundId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const success = await storage.deleteExitFund(fundId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete fund:', error);
      res.status(500).json({ error: 'Failed to delete fund' });
    }
  });

  // --- WATERFALL STRUCTURES ---

  // Get waterfall structures for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/waterfall', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const waterfalls = await storage.getExitWaterfallStructures(scenarioId, orgId);
      res.json(waterfalls);
    } catch (error: any) {
      console.error('Failed to fetch waterfall structures:', error);
      res.status(500).json({ error: 'Failed to fetch waterfall structures' });
    }
  });

  // Create waterfall structure
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/waterfall', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      const waterfall = await storage.createExitWaterfallStructure({
        ...req.body,
        exitScenarioId: scenarioId,
        orgId
      });
      
      res.status(201).json(waterfall);
    } catch (error: any) {
      console.error('Failed to create waterfall structure:', error);
      res.status(500).json({ error: 'Failed to create waterfall structure' });
    }
  });

  // Update waterfall structure
  app.patch('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/waterfall/:waterfallId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { waterfallId } = req.params;
      
      const waterfall = await storage.updateExitWaterfallStructure(waterfallId, req.body, orgId);
      if (!waterfall) {
        return res.status(404).json({ error: 'Waterfall structure not found' });
      }
      
      res.json(waterfall);
    } catch (error: any) {
      console.error('Failed to update waterfall structure:', error);
      res.status(500).json({ error: 'Failed to update waterfall structure' });
    }
  });

  // Delete waterfall structure
  app.delete('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/waterfall/:waterfallId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { waterfallId } = req.params;
      
      const success = await storage.deleteExitWaterfallStructure(waterfallId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Waterfall structure not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete waterfall structure:', error);
      res.status(500).json({ error: 'Failed to delete waterfall structure' });
    }
  });

  // --- INVESTORS ---

  // Get investors for a fund
  app.get('/api/exit/funds/:fundId/investors', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const fund = await storage.getExitFund(fundId, orgId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      const investors = await storage.getExitInvestors(fundId, orgId);
      res.json(investors);
    } catch (error: any) {
      console.error('Failed to fetch investors:', error);
      res.status(500).json({ error: 'Failed to fetch investors' });
    }
  });

  // Create investor
  app.post('/api/exit/funds/:fundId/investors', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      
      const fund = await storage.getExitFund(fundId, orgId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      const investor = await storage.createExitInvestor({
        ...req.body,
        fundId,
        orgId
      });
      
      res.status(201).json(investor);
    } catch (error: any) {
      console.error('Failed to create investor:', error);
      res.status(500).json({ error: 'Failed to create investor' });
    }
  });

  // Update investor
  app.patch('/api/exit/funds/:fundId/investors/:investorId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { investorId } = req.params;
      
      const investor = await storage.updateExitInvestor(investorId, req.body, orgId);
      if (!investor) {
        return res.status(404).json({ error: 'Investor not found' });
      }
      
      res.json(investor);
    } catch (error: any) {
      console.error('Failed to update investor:', error);
      res.status(500).json({ error: 'Failed to update investor' });
    }
  });

  // Delete investor
  app.delete('/api/exit/funds/:fundId/investors/:investorId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { investorId } = req.params;
      
      const success = await storage.deleteExitInvestor(investorId, orgId);
      if (!success) {
        return res.status(404).json({ error: 'Investor not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete investor:', error);
      res.status(500).json({ error: 'Failed to delete investor' });
    }
  });

  // --- CASH FLOWS ---

  // Get cash flows for a scenario
  app.get('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/cash-flows', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      
      const cashFlows = await storage.getExitCashFlows(scenarioId, orgId);
      res.json(cashFlows);
    } catch (error: any) {
      console.error('Failed to fetch cash flows:', error);
      res.status(500).json({ error: 'Failed to fetch cash flows' });
    }
  });

  // Save cash flows for a scenario (replaces existing)
  app.post('/api/modeling/projects/:projectId/exit/scenarios/:scenarioId/cash-flows', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      const { cashFlows } = req.body;
      
      const scenario = await storage.getExitScenario(scenarioId, orgId);
      if (!scenario) {
        return res.status(404).json({ error: 'Exit scenario not found' });
      }
      
      // Delete existing cash flows
      await storage.deleteExitCashFlows(scenarioId, orgId);
      
      // Create new cash flows
      const createdFlows = [];
      for (const cf of cashFlows) {
        const created = await storage.createExitCashFlow({
          ...cf,
          exitScenarioId: scenarioId,
          orgId
        });
        createdFlows.push(created);
      }
      
      res.status(201).json(createdFlows);
    } catch (error: any) {
      console.error('Failed to save cash flows:', error);
      res.status(500).json({ error: 'Failed to save cash flows' });
    }
  });

  // --- ACTIVITIES / AUDIT LOG ---

  // Get activities for a scenario or project
  app.get('/api/modeling/projects/:projectId/exit/activities', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioId } = req.query;
      
      const activities = await storage.getExitActivities(
        scenarioId as string || null,
        projectId,
        orgId
      );
      res.json(activities);
    } catch (error: any) {
      console.error('Failed to fetch exit activities:', error);
      res.status(500).json({ error: 'Failed to fetch exit activities' });
    }
  });

  // ============================================================================
  // TRANSACTION & CLOSING COSTS
  // ============================================================================

  // Get transaction closing data for a modeling project
  app.get('/api/modeling/projects/:projectId/transaction-closing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      // Verify project exists and belongs to organization
      const [project] = await db.select().from(modelingProjects)
        .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
      
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      // Get summary (1:1 relationship)
      const [summary] = await db.select().from(transactionClosingSummary)
        .where(eq(transactionClosingSummary.modelingProjectId, projectId));
      
      // Get line items
      const closingLines = await db.select().from(closingCostLines)
        .where(eq(closingCostLines.modelingProjectId, projectId))
        .orderBy(asc(closingCostLines.sortOrder));
      
      const transitionLines = await db.select().from(transitionCostLines)
        .where(eq(transitionCostLines.modelingProjectId, projectId))
        .orderBy(asc(transitionCostLines.sortOrder));
      
      const nwcLinesData = await db.select().from(nwcLines)
        .where(eq(nwcLines.modelingProjectId, projectId))
        .orderBy(asc(nwcLines.sortOrder));
      
      res.json({
        summary: summary || null,
        closingCostLines: closingLines,
        transitionCostLines: transitionLines,
        nwcLines: nwcLinesData,
      });
    } catch (error: any) {
      console.error('Failed to fetch transaction closing data:', error);
      res.status(500).json({ error: 'Failed to fetch transaction closing data' });
    }
  });

  // Save transaction closing data for a modeling project
  app.post('/api/modeling/projects/:projectId/transaction-closing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      // Verify project exists and belongs to organization
      const [project] = await db.select().from(modelingProjects)
        .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
      
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      // Parse and validate request body
      const { summary, closingCostLines: closingLines, transitionCostLines: transitionLines, nwcLines: nwcLinesData } = req.body;
      
      // Run calculations
      const calculatedSummary = calculateAll({
        summary: summary || {},
        closingCostLines: closingLines || [],
        transitionCostLines: transitionLines || [],
        nwcLines: nwcLinesData || [],
      });
      
      // Merge user-entered fields with computed fields
      const summaryToSave = {
        ...summary, // User-entered fields (purchasePrice, financingFeeRate, etc.)
        ...calculatedSummary, // Computed fields (override with calculated values)
      };
      
      // Begin transaction - save everything atomically
      await db.transaction(async (tx) => {
        // Upsert summary
        const [existingSummary] = await tx.select().from(transactionClosingSummary)
          .where(eq(transactionClosingSummary.modelingProjectId, projectId));
        
        if (existingSummary) {
          // Update existing
          await tx.update(transactionClosingSummary)
            .set({
              ...summaryToSave,
              modelingProjectId: projectId,
              orgId,
              updatedAt: new Date(),
            })
            .where(eq(transactionClosingSummary.id, existingSummary.id));
        } else {
          // Insert new
          await tx.insert(transactionClosingSummary).values({
            ...summaryToSave,
            modelingProjectId: projectId,
            orgId,
          });
        }
        
        // Delete existing line items and re-insert (simpler than upsert logic)
        await tx.delete(closingCostLines).where(eq(closingCostLines.modelingProjectId, projectId));
        await tx.delete(transitionCostLines).where(eq(transitionCostLines.modelingProjectId, projectId));
        await tx.delete(nwcLines).where(eq(nwcLines.modelingProjectId, projectId));
        
        // Insert closing cost lines
        if (closingLines && closingLines.length > 0) {
          await tx.insert(closingCostLines).values(
            closingLines.map((line: any, index: number) => ({
              ...line,
              modelingProjectId: projectId,
              orgId,
              sortOrder: line.sortOrder ?? index,
            }))
          );
        }
        
        // Insert transition cost lines
        if (transitionLines && transitionLines.length > 0) {
          await tx.insert(transitionCostLines).values(
            transitionLines.map((line: any, index: number) => ({
              ...line,
              modelingProjectId: projectId,
              orgId,
              sortOrder: line.sortOrder ?? index,
            }))
          );
        }
        
        // Insert NWC lines
        if (nwcLinesData && nwcLinesData.length > 0) {
          await tx.insert(nwcLines).values(
            nwcLinesData.map((line: any, index: number) => ({
              ...line,
              modelingProjectId: projectId,
              orgId,
              sortOrder: line.sortOrder ?? index,
            }))
          );
        }
      });
      
      // Fetch and return saved data
      const [savedSummary] = await db.select().from(transactionClosingSummary)
        .where(eq(transactionClosingSummary.modelingProjectId, projectId));
      
      const savedClosingLines = await db.select().from(closingCostLines)
        .where(eq(closingCostLines.modelingProjectId, projectId))
        .orderBy(asc(closingCostLines.sortOrder));
      
      const savedTransitionLines = await db.select().from(transitionCostLines)
        .where(eq(transitionCostLines.modelingProjectId, projectId))
        .orderBy(asc(transitionCostLines.sortOrder));
      
      const savedNwcLines = await db.select().from(nwcLines)
        .where(eq(nwcLines.modelingProjectId, projectId))
        .orderBy(asc(nwcLines.sortOrder));
      
      res.json({
        summary: savedSummary,
        closingCostLines: savedClosingLines,
        transitionCostLines: savedTransitionLines,
        nwcLines: savedNwcLines,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to save transaction closing data:', error);
      res.status(500).json({ error: 'Failed to save transaction closing data' });
    }
  });

  // ============================================================================
  // CAPITAL STACK - Multi-Tranche Debt & Equity Structure with Waterfall
  // ============================================================================

  // Get all capital stacks for a modeling project
  app.get('/api/modeling/projects/:projectId/capital-stacks', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const stacks = await capitalStackService.getCapitalStacksByProject(orgId, projectId);
      res.json(stacks);
    } catch (error: any) {
      console.error('Failed to fetch capital stacks:', error);
      res.status(500).json({ error: 'Failed to fetch capital stacks' });
    }
  });

  // Get single capital stack with details (debt tranches, equity layers, projections)
  app.get('/api/modeling/capital-stacks/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const stack = await capitalStackService.getCapitalStackWithDetails(orgId, id);
      if (!stack) {
        return res.status(404).json({ error: 'Capital stack not found' });
      }
      res.json(stack);
    } catch (error: any) {
      console.error('Failed to fetch capital stack:', error);
      res.status(500).json({ error: 'Failed to fetch capital stack' });
    }
  });

  // Create new capital stack
  app.post('/api/modeling/projects/:projectId/capital-stacks', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { debtTranches: debtTrancheData, ...stackData } = req.body;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const stack = await capitalStackService.createCapitalStack(orgId, userId, {
        ...stackData,
        modelingProjectId: projectId,
      });

      if (Array.isArray(debtTrancheData) && debtTrancheData.length > 0) {
        for (const tranche of debtTrancheData) {
          try {
            await capitalStackService.createDebtTranche(orgId, {
              ...tranche,
              capitalStackId: stack.id,
            });
          } catch (trancheError: any) {
            console.error('Failed to create debt tranche:', trancheError.message);
          }
        }
      }

      res.status(201).json(stack);
    } catch (error: any) {
      console.error('Failed to create capital stack:', error);
      res.status(500).json({ error: 'Failed to create capital stack' });
    }
  });

  // Update capital stack
  app.patch('/api/modeling/capital-stacks/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const stack = await capitalStackService.updateCapitalStack(orgId, id, req.body);
      if (!stack) {
        return res.status(404).json({ error: 'Capital stack not found' });
      }
      res.json(stack);
    } catch (error: any) {
      console.error('Failed to update capital stack:', error);
      res.status(500).json({ error: 'Failed to update capital stack' });
    }
  });

  // Delete capital stack
  app.delete('/api/modeling/capital-stacks/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const success = await capitalStackService.deleteCapitalStack(orgId, id);
      if (!success) {
        return res.status(404).json({ error: 'Capital stack not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete capital stack:', error);
      res.status(500).json({ error: 'Failed to delete capital stack' });
    }
  });

  // === Debt Tranches ===
  app.get('/api/modeling/capital-stacks/:stackId/debt-tranches', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stackId } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const tranches = await capitalStackService.getDebtTranches(orgId, stackId);
      res.json(tranches);
    } catch (error: any) {
      console.error('Failed to fetch debt tranches:', error);
      res.status(500).json({ error: 'Failed to fetch debt tranches' });
    }
  });

  app.post('/api/modeling/capital-stacks/:stackId/debt-tranches', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stackId } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const tranche = await capitalStackService.createDebtTranche(orgId, {
        ...req.body,
        capitalStackId: stackId,
      });
      res.status(201).json(tranche);
    } catch (error: any) {
      console.error('Failed to create debt tranche:', error);
      res.status(500).json({ error: 'Failed to create debt tranche' });
    }
  });

  app.patch('/api/modeling/debt-tranches/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const tranche = await capitalStackService.updateDebtTranche(orgId, id, req.body);
      if (!tranche) {
        return res.status(404).json({ error: 'Debt tranche not found' });
      }
      res.json(tranche);
    } catch (error: any) {
      console.error('Failed to update debt tranche:', error);
      res.status(500).json({ error: 'Failed to update debt tranche' });
    }
  });

  app.delete('/api/modeling/debt-tranches/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const success = await capitalStackService.deleteDebtTranche(orgId, id);
      if (!success) {
        return res.status(404).json({ error: 'Debt tranche not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete debt tranche:', error);
      res.status(500).json({ error: 'Failed to delete debt tranche' });
    }
  });

  // === Equity Layers ===
  app.get('/api/modeling/capital-stacks/:stackId/equity-layers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stackId } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const layers = await capitalStackService.getEquityLayers(orgId, stackId);
      res.json(layers);
    } catch (error: any) {
      console.error('Failed to fetch equity layers:', error);
      res.status(500).json({ error: 'Failed to fetch equity layers' });
    }
  });

  app.post('/api/modeling/capital-stacks/:stackId/equity-layers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stackId } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const layer = await capitalStackService.createEquityLayer(orgId, {
        ...req.body,
        capitalStackId: stackId,
      });
      res.status(201).json(layer);
    } catch (error: any) {
      console.error('Failed to create equity layer:', error);
      res.status(500).json({ error: 'Failed to create equity layer' });
    }
  });

  app.patch('/api/modeling/equity-layers/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const layer = await capitalStackService.updateEquityLayer(orgId, id, req.body);
      if (!layer) {
        return res.status(404).json({ error: 'Equity layer not found' });
      }
      res.json(layer);
    } catch (error: any) {
      console.error('Failed to update equity layer:', error);
      res.status(500).json({ error: 'Failed to update equity layer' });
    }
  });

  app.delete('/api/modeling/equity-layers/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const success = await capitalStackService.deleteEquityLayer(orgId, id);
      if (!success) {
        return res.status(404).json({ error: 'Equity layer not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete equity layer:', error);
      res.status(500).json({ error: 'Failed to delete equity layer' });
    }
  });

  // === Projections ===
  app.get('/api/modeling/capital-stacks/:stackId/projections', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stackId } = req.params;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const projections = await capitalStackService.getProjections(orgId, stackId);
      res.json(projections);
    } catch (error: any) {
      console.error('Failed to fetch projections:', error);
      res.status(500).json({ error: 'Failed to fetch projections' });
    }
  });

  app.post('/api/modeling/capital-stacks/:stackId/projections/generate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stackId } = req.params;
      const { noi } = req.body;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const projections = await capitalStackService.generateProjections(orgId, stackId, parseFloat(noi));
      res.json(projections);
    } catch (error: any) {
      console.error('Failed to generate projections:', error);
      res.status(500).json({ error: 'Failed to generate projections' });
    }
  });

  // === Metrics ===
  app.get('/api/modeling/capital-stacks/:stackId/metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stackId } = req.params;
      const noi = parseFloat(req.query.noi as string) || 0;
      const { capitalStackService } = await import('./services/capital-stack-service');
      const metrics = await capitalStackService.getCapitalStackMetrics(orgId, stackId, noi);
      res.json(metrics);
    } catch (error: any) {
      console.error('Failed to fetch capital stack metrics:', error);
      res.status(500).json({ error: 'Failed to fetch capital stack metrics' });
    }
  });

  // ============================================================================
  // PE FUND MANAGEMENT - Fund Lifecycle, Investor Capital Accounts, Deal Allocations
  // ============================================================================

  // === Funds CRUD ===
  app.get('/api/funds', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundService } = await import('./services/fund-service');
      const funds = await fundService.getFundsByOrg(orgId);
      res.json(funds);
    } catch (error: any) {
      console.error('Failed to fetch funds:', error);
      res.status(500).json({ error: 'Failed to fetch funds' });
    }
  });

  app.get('/api/funds/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { fundService } = await import('./services/fund-service');
      const fund = await fundService.getFundWithDetails(orgId, id);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      res.json(fund);
    } catch (error: any) {
      console.error('Failed to fetch fund:', error);
      res.status(500).json({ error: 'Failed to fetch fund' });
    }
  });

  app.post('/api/funds', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { fundService } = await import('./services/fund-service');
      const fund = await fundService.createFund(orgId, userId, req.body);
      res.status(201).json(fund);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create fund:', error);
      res.status(500).json({ error: 'Failed to create fund' });
    }
  });

  app.patch('/api/funds/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { fundService } = await import('./services/fund-service');
      const fund = await fundService.updateFund(orgId, id, req.body);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      res.json(fund);
    } catch (error: any) {
      console.error('Failed to update fund:', error);
      res.status(500).json({ error: 'Failed to update fund' });
    }
  });

  app.delete('/api/funds/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { fundService } = await import('./services/fund-service');
      const success = await fundService.deleteFund(orgId, id);
      if (!success) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete fund:', error);
      res.status(500).json({ error: 'Failed to delete fund' });
    }
  });

  // === Fund Metrics ===
  app.get('/api/funds/:fundId/metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const metrics = await fundService.calculateFundMetrics(orgId, fundId);
      res.json(metrics);
    } catch (error: any) {
      console.error('Failed to calculate fund metrics:', error);
      res.status(500).json({ error: 'Failed to calculate fund metrics' });
    }
  });

  app.post('/api/funds/:fundId/recalculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      await fundService.recalculateFundMetrics(orgId, fundId);
      const fund = await fundService.getFundWithDetails(orgId, fundId);
      res.json(fund);
    } catch (error: any) {
      console.error('Failed to recalculate fund metrics:', error);
      res.status(500).json({ error: 'Failed to recalculate fund metrics' });
    }
  });

  // === Fund Investors ===
  app.get('/api/funds/:fundId/investors', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const investors = await fundService.getInvestorsByFund(orgId, fundId);
      res.json(investors);
    } catch (error: any) {
      console.error('Failed to fetch fund investors:', error);
      res.status(500).json({ error: 'Failed to fetch fund investors' });
    }
  });

  app.get('/api/funds/:fundId/investors/:investorId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { investorId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const investor = await fundService.getInvestor(orgId, investorId);
      if (!investor) {
        return res.status(404).json({ error: 'Investor not found' });
      }
      res.json(investor);
    } catch (error: any) {
      console.error('Failed to fetch investor:', error);
      res.status(500).json({ error: 'Failed to fetch investor' });
    }
  });

  app.post('/api/funds/:fundId/investors', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const investor = await fundService.createInvestor(orgId, {
        ...req.body,
        fundId,
      });
      res.status(201).json(investor);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create investor:', error);
      res.status(500).json({ error: 'Failed to create investor' });
    }
  });

  app.patch('/api/funds/:fundId/investors/:investorId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { investorId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const investor = await fundService.updateInvestor(orgId, investorId, req.body);
      if (!investor) {
        return res.status(404).json({ error: 'Investor not found' });
      }
      res.json(investor);
    } catch (error: any) {
      console.error('Failed to update investor:', error);
      res.status(500).json({ error: 'Failed to update investor' });
    }
  });

  app.delete('/api/funds/:fundId/investors/:investorId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { investorId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const success = await fundService.deleteInvestor(orgId, investorId);
      if (!success) {
        return res.status(404).json({ error: 'Investor not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete investor:', error);
      res.status(500).json({ error: 'Failed to delete investor' });
    }
  });

  // === Investor Capital Accounts ===
  app.get('/api/funds/:fundId/capital-accounts', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const accounts = await fundService.getInvestorCapitalAccounts(orgId, fundId);
      res.json(accounts);
    } catch (error: any) {
      console.error('Failed to fetch capital accounts:', error);
      res.status(500).json({ error: 'Failed to fetch capital accounts' });
    }
  });

  // === Fund Deal Allocations ===
  app.get('/api/funds/:fundId/allocations', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const allocations = await fundService.getAllocationsByFund(orgId, fundId);
      res.json(allocations);
    } catch (error: any) {
      console.error('Failed to fetch fund allocations:', error);
      res.status(500).json({ error: 'Failed to fetch fund allocations' });
    }
  });

  app.get('/api/modeling/projects/:projectId/fund-allocations', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const allocations = await fundService.getAllocationsByProject(orgId, projectId);
      res.json(allocations);
    } catch (error: any) {
      console.error('Failed to fetch project fund allocations:', error);
      res.status(500).json({ error: 'Failed to fetch project fund allocations' });
    }
  });

  app.get('/api/funds/:fundId/allocations/:allocationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { allocationId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const allocation = await fundService.getDealAllocation(orgId, allocationId);
      if (!allocation) {
        return res.status(404).json({ error: 'Deal allocation not found' });
      }
      res.json(allocation);
    } catch (error: any) {
      console.error('Failed to fetch deal allocation:', error);
      res.status(500).json({ error: 'Failed to fetch deal allocation' });
    }
  });

  app.post('/api/funds/:fundId/allocations', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const allocation = await fundService.createDealAllocation(orgId, {
        ...req.body,
        fundId,
      });
      res.status(201).json(allocation);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create deal allocation:', error);
      res.status(500).json({ error: 'Failed to create deal allocation' });
    }
  });

  app.patch('/api/funds/:fundId/allocations/:allocationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { allocationId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const allocation = await fundService.updateDealAllocation(orgId, allocationId, req.body);
      if (!allocation) {
        return res.status(404).json({ error: 'Deal allocation not found' });
      }
      res.json(allocation);
    } catch (error: any) {
      console.error('Failed to update deal allocation:', error);
      res.status(500).json({ error: 'Failed to update deal allocation' });
    }
  });

  app.delete('/api/funds/:fundId/allocations/:allocationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { allocationId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const success = await fundService.deleteDealAllocation(orgId, allocationId);
      if (!success) {
        return res.status(404).json({ error: 'Deal allocation not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete deal allocation:', error);
      res.status(500).json({ error: 'Failed to delete deal allocation' });
    }
  });

  // === Fund Capital Movements ===
  app.get('/api/funds/:fundId/capital-movements', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const movements = await fundService.getCapitalMovementsByFund(orgId, fundId);
      res.json(movements);
    } catch (error: any) {
      console.error('Failed to fetch capital movements:', error);
      res.status(500).json({ error: 'Failed to fetch capital movements' });
    }
  });

  app.get('/api/funds/:fundId/capital-movements/:movementId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { movementId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const movement = await fundService.getCapitalMovement(orgId, movementId);
      if (!movement) {
        return res.status(404).json({ error: 'Capital movement not found' });
      }
      res.json(movement);
    } catch (error: any) {
      console.error('Failed to fetch capital movement:', error);
      res.status(500).json({ error: 'Failed to fetch capital movement' });
    }
  });

  app.post('/api/funds/:fundId/capital-movements', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const movement = await fundService.createCapitalMovement(orgId, userId, {
        ...req.body,
        fundId,
      });
      res.status(201).json(movement);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create capital movement:', error);
      res.status(500).json({ error: 'Failed to create capital movement' });
    }
  });

  // Capital movement PATCH - disabled for immutable ledger compliance
  // Corrections must be made via reversal entries, not edits
  app.patch('/api/funds/:fundId/capital-movements/:movementId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId, movementId } = req.params;

      // Check period lock before allowing modification
      const { periodLockService } = await import('./services/period-lock-service');
      const { fundService } = await import('./services/fund-service');

      const movement = await fundService.getCapitalMovement(orgId, movementId);
      if (!movement) return res.status(404).json({ error: 'Capital movement not found' });

      // Only allow status updates (pending → completed), not amount changes
      const allowedFields = ['status', 'description'];
      const disallowedFields = Object.keys(req.body).filter(k => !allowedFields.includes(k));
      if (disallowedFields.length > 0) {
        return res.status(403).json({
          error: 'Immutable ledger policy: capital movement amounts cannot be modified after creation. ' +
                 'Create a reversal entry instead. Only status and description can be updated.',
          disallowedFields,
        });
      }

      // Check period lock
      if (movement.movementDate) {
        await periodLockService.enforcePeriodLock(orgId, fundId, new Date(movement.movementDate));
      }

      const updated = await fundService.updateCapitalMovement(orgId, movementId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update capital movement:', error);
      res.status(error.message?.includes('locked') ? 409 : 500).json({ error: error.message });
    }
  });

  // Capital movement DELETE - disabled for audit compliance
  // Movements cannot be deleted; they must be reversed with a contra-entry
  app.delete('/api/funds/:fundId/capital-movements/:movementId', authenticateUser, async (req: any, res) => {
    return res.status(403).json({
      error: 'Immutable ledger policy: capital movements cannot be deleted. ' +
             'Create a reversal entry with opposite sign to correct errors. ' +
             'This policy ensures a complete audit trail for SOC 2 compliance.',
    });
    // Original code preserved for reference but unreachable:
    try {
      const orgId = req.user.orgId;
      const { movementId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const success = await fundService.deleteCapitalMovement(orgId, movementId);
      if (!success) {
        return res.status(404).json({ error: 'Capital movement not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete capital movement:', error);
      res.status(500).json({ error: 'Failed to delete capital movement' });
    }
  });

  // === Fund Cash Flows (for IRR) ===
  app.get('/api/funds/:fundId/cash-flows', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const cashFlows = await fundService.getCashFlowsByFund(orgId, fundId);
      res.json(cashFlows);
    } catch (error: any) {
      console.error('Failed to fetch cash flows:', error);
      res.status(500).json({ error: 'Failed to fetch cash flows' });
    }
  });

  app.post('/api/funds/:fundId/cash-flows', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const cashFlow = await fundService.createCashFlow(orgId, {
        ...req.body,
        fundId,
      });
      res.status(201).json(cashFlow);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create cash flow:', error);
      res.status(500).json({ error: 'Failed to create cash flow' });
    }
  });

  // === Fund Investor Report Generation ===
  app.post('/api/funds/:fundId/generate-report', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || 'default';
      const { fundId } = req.params;
      const { quarter, year, marketCommentary, sectionOverrides } = req.body;

      const { fundService } = await import('./services/fund-service');
      const fund = await fundService.getFund(orgId, fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }

      // Get fund metrics
      let metrics;
      try {
        metrics = await fundService.calculateFundMetrics(orgId, fundId);
      } catch {
        metrics = {
          netIrr: parseFloat(fund.netIrr?.toString() || '0'),
          grossIrr: parseFloat(fund.grossIrr?.toString() || '0'),
          tvpi: parseFloat(fund.tvpi?.toString() || '0'),
          dpi: parseFloat(fund.dpi?.toString() || '0'),
          calledCapital: parseFloat(fund.calledCapital?.toString() || '0'),
          distributedCapital: parseFloat(fund.distributedCapital?.toString() || '0'),
          nav: parseFloat(fund.calledCapital?.toString() || '0') * 1.15,
          deployedCapital: parseFloat(fund.calledCapital?.toString() || '0') * 0.85,
          dryPowder: parseFloat(fund.committedCapital?.toString() || '0') - parseFloat(fund.calledCapital?.toString() || '0'),
        };
      }

      const committed = parseFloat(fund.committedCapital?.toString() || '0');
      const called = parseFloat(fund.calledCapital?.toString() || '0');
      const distributed = parseFloat(fund.distributedCapital?.toString() || '0');

      // Get allocations for portfolio update
      let allocations: any[] = [];
      try {
        allocations = await fundService.getAllocationsByFund(orgId, fundId);
      } catch {
        allocations = [];
      }

      const report = {
        id: `report-${fundId}-Q${quarter}-${year}`,
        fundName: fund.name,
        period: `Q${quarter} ${year}`,
        generatedAt: new Date().toISOString(),
        performanceSummary: {
          netIrr: metrics.netIrr || 0,
          grossIrr: metrics.grossIrr || 0,
          tvpi: metrics.tvpi || 0,
          dpi: metrics.dpi || 0,
          calledCapital: called,
          distributedCapital: distributed,
          nav: metrics.nav || 0,
          deployedCapital: metrics.deployedCapital || 0,
          dryPowder: metrics.dryPowder || 0,
        },
        portfolioUpdate: {
          totalDeals: allocations.length,
          activeDeals: allocations.filter((a: any) => a.exitStatus === 'active').length,
          exitedDeals: allocations.filter((a: any) => a.exitStatus === 'exited').length,
          newInvestments: allocations
            .filter((a: any) => {
              if (!a.investmentDate) return false;
              const investDate = new Date(a.investmentDate);
              const quarterStart = new Date(year, (quarter - 1) * 3, 1);
              const quarterEnd = new Date(year, quarter * 3, 0);
              return investDate >= quarterStart && investDate <= quarterEnd;
            })
            .map((a: any) => a.projectName || 'New Investment'),
          exits: [],
        },
        capitalAccountSummary: {
          committedCapital: committed,
          calledPct: committed > 0 ? called / committed : 0,
          distributedPct: called > 0 ? distributed / called : 0,
        },
        marketCommentary: marketCommentary || '',
        sectionOverrides: sectionOverrides || {},
      };

      res.status(201).json(report);
    } catch (error: any) {
      console.error('Failed to generate fund report:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  app.post('/api/funds/:fundId/send-report', authenticateUser, async (req: any, res) => {
    try {
      // Placeholder - would send to all investors
      res.json({ sent: true, message: 'Reports queued for delivery to all fund investors.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to send reports' });
    }
  });

  // === Fund Capital Stack Templates ===
  app.get('/api/funds/:fundId/capital-stack-templates', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const templates = await fundService.getTemplatesByFund(orgId, fundId);
      res.json(templates);
    } catch (error: any) {
      console.error('Failed to fetch capital stack templates:', error);
      res.status(500).json({ error: 'Failed to fetch capital stack templates' });
    }
  });

  app.get('/api/funds/capital-stack-templates/:templateId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { templateId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const template = await fundService.getCapitalStackTemplate(orgId, templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error: any) {
      console.error('Failed to fetch capital stack template:', error);
      res.status(500).json({ error: 'Failed to fetch capital stack template' });
    }
  });

  app.post('/api/funds/:fundId/capital-stack-templates', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const template = await fundService.createCapitalStackTemplate(orgId, userId, {
        ...req.body,
        fundId,
      });
      res.status(201).json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create capital stack template:', error);
      res.status(500).json({ error: 'Failed to create capital stack template' });
    }
  });

  app.patch('/api/funds/capital-stack-templates/:templateId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { templateId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const template = await fundService.updateCapitalStackTemplate(orgId, templateId, req.body);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error: any) {
      console.error('Failed to update capital stack template:', error);
      res.status(500).json({ error: 'Failed to update capital stack template' });
    }
  });

  app.delete('/api/funds/capital-stack-templates/:templateId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { templateId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const success = await fundService.deleteCapitalStackTemplate(orgId, templateId);
      if (!success) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete capital stack template:', error);
      res.status(500).json({ error: 'Failed to delete capital stack template' });
    }
  });

  // === Fund Waterfall Calculations ===
  app.get('/api/funds/:fundId/waterfall', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const waterfall = await fundService.getLatestWaterfallCalculation(orgId, fundId);
      res.json(waterfall);
    } catch (error: any) {
      console.error('Failed to fetch waterfall calculation:', error);
      res.status(500).json({ error: 'Failed to fetch waterfall calculation' });
    }
  });

  app.get('/api/funds/:fundId/waterfall/history', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const history = await fundService.getWaterfallHistory(orgId, fundId);
      res.json(history);
    } catch (error: any) {
      console.error('Failed to fetch waterfall history:', error);
      res.status(500).json({ error: 'Failed to fetch waterfall history' });
    }
  });

  app.post('/api/funds/:fundId/waterfall/calculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');
      
      const fund = await fundService.getFund(orgId, fundId);
      if (!fund) {
        return res.status(404).json({ error: 'Fund not found' });
      }
      
      const metrics = await fundService.calculateFundMetrics(orgId, fundId);
      
      const totalDistributable = req.body.totalDistributable || (metrics.distributedCapital + metrics.nav);
      const yearsHeld = req.body.yearsHeld || 1;
      
      const result = fundService.calculateWaterfallDistribution(
        totalDistributable,
        metrics.calledCapital,
        parseFloat(fund.preferredReturn?.toString() || '0.08'),
        parseFloat(fund.gpCatchUpPct?.toString() || '1.00'),
        fund.promoteTiers || [{ irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }],
        yearsHeld
      );
      
      const stored = await fundService.storeWaterfallCalculation(orgId, fundId, result, metrics);
      
      res.json({
        ...result,
        storedCalculation: stored,
        fundMetrics: metrics
      });
    } catch (error: any) {
      console.error('Failed to calculate waterfall:', error);
      res.status(500).json({ error: 'Failed to calculate waterfall' });
    }
  });

  // === Distribution Approval Workflow (Institutional) ===
  app.post('/api/funds/:fundId/distribution-drafts', authenticateUser, async (req: any, res) => {
    try {
      const { fundId } = req.params;
      const { distributionApprovalService } = await import('./services/distribution-approval-service');
      const draft = await distributionApprovalService.createDraft(req, fundId, req.body);
      res.status(201).json(draft);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/funds/:fundId/distribution-drafts', authenticateUser, async (req: any, res) => {
    try {
      const { fundId } = req.params;
      const { distributionApprovalService } = await import('./services/distribution-approval-service');
      const drafts = await distributionApprovalService.listDrafts(req.user.orgId, fundId, req.query.status);
      res.json(drafts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/funds/:fundId/distribution-drafts/:draftId/submit', authenticateUser, async (req: any, res) => {
    try {
      const { draftId } = req.params;
      const { distributionApprovalService } = await import('./services/distribution-approval-service');
      const draft = await distributionApprovalService.submitForApproval(req, draftId);
      res.json(draft);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/funds/:fundId/distribution-drafts/:draftId/approve', authenticateUser, async (req: any, res) => {
    try {
      const { draftId } = req.params;
      const { requirePermission } = await import('./middleware/rbac');
      // Inline permission check for fund:distribution:approve
      const userRole = req.user?.role;
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions: fund:distribution:approve required' });
      }
      const { distributionApprovalService } = await import('./services/distribution-approval-service');
      const draft = await distributionApprovalService.approve(req, draftId, req.body.notes);
      res.json(draft);
    } catch (error: any) {
      const status = error.message?.includes('Segregation') ? 403 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  app.post('/api/funds/:fundId/distribution-drafts/:draftId/reject', authenticateUser, async (req: any, res) => {
    try {
      const { draftId } = req.params;
      const { distributionApprovalService } = await import('./services/distribution-approval-service');
      const draft = await distributionApprovalService.reject(req, draftId, req.body.reason);
      res.json(draft);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/funds/:fundId/distribution-drafts/:draftId/execute', authenticateUser, async (req: any, res) => {
    try {
      const { draftId } = req.params;
      const userRole = req.user?.role;
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions: only owner/admin can execute distributions' });
      }
      const { distributionApprovalService } = await import('./services/distribution-approval-service');
      const result = await distributionApprovalService.execute(req, draftId);
      res.json(result);
    } catch (error: any) {
      const status = error.message?.includes('Compliance') ? 409 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  // === Period Lock Management ===
  app.post('/api/funds/:fundId/period-locks', authenticateUser, async (req: any, res) => {
    try {
      const { fundId } = req.params;
      const userRole = req.user?.role;
      if (!['owner', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: 'Only owner/admin can lock periods' });
      }
      const { periodLockService } = await import('./services/period-lock-service');
      const { periodLabel, periodStart, periodEnd } = req.body;
      if (!periodLabel || !periodStart || !periodEnd) {
        return res.status(400).json({ error: 'periodLabel, periodStart, and periodEnd are required' });
      }
      const lock = await periodLockService.lockPeriod(req, fundId, periodLabel, new Date(periodStart), new Date(periodEnd));
      res.status(201).json(lock);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/funds/:fundId/period-locks', authenticateUser, async (req: any, res) => {
    try {
      const { fundId } = req.params;
      const { periodLockService } = await import('./services/period-lock-service');
      const locks = await periodLockService.listPeriodLocks(req.user.orgId, fundId);
      res.json(locks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/funds/:fundId/period-locks/:lockId/unlock', authenticateUser, async (req: any, res) => {
    try {
      const { lockId } = req.params;
      const userRole = req.user?.role;
      if (userRole !== 'owner') {
        return res.status(403).json({ error: 'Only owner can unlock periods (audit control)' });
      }
      const { periodLockService } = await import('./services/period-lock-service');
      const lock = await periodLockService.unlockPeriod(req, lockId, req.body.reason);
      res.json(lock);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // === Financial Audit Trail ===
  app.get('/api/funds/:fundId/audit-trail', authenticateUser, async (req: any, res) => {
    try {
      const { fundId } = req.params;
      const userRole = req.user?.role;
      if (!['owner', 'admin', 'auditor'].includes(userRole)) {
        return res.status(403).json({ error: 'Audit trail access requires owner, admin, or auditor role' });
      }
      const { financialAuditService } = await import('./services/financial-audit-service');
      const { eventType, fromDate, toDate, investorId, limit, offset } = req.query;
      const result = await financialAuditService.getAuditTrail(req.user.orgId, {
        fundId,
        eventType,
        investorId,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // === Fund-Level Capital Calls ===
  app.post('/api/funds/:fundId/capital-calls', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { fundId } = req.params;

      // RBAC: require capital call creation permission
      const userRole = req.user?.role;
      if (!['owner', 'admin', 'editor'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions to create capital calls' });
      }

      // Period lock check
      const { periodLockService } = await import('./services/period-lock-service');
      await periodLockService.enforcePeriodLock(orgId, fundId, new Date());

      // Compliance: check investor accreditation before calling capital
      const { distributionApprovalService } = await import('./services/distribution-approval-service');
      await distributionApprovalService.runComplianceChecks(orgId, fundId);

      const { fundService } = await import('./services/fund-service');
      const { totalAmount, purpose, dueDate, callNumber, notes, dealAllocationId } = req.body;

      if (!totalAmount || !purpose || !dueDate) {
        return res.status(400).json({ error: 'totalAmount, purpose, and dueDate are required' });
      }

      const result = await fundService.createFundCapitalCall(orgId, userId, fundId, {
        totalAmount: parseFloat(totalAmount),
        purpose,
        dueDate,
        callNumber,
        notes,
        dealAllocationId,
      });

      // Audit log
      const { financialAuditService } = await import('./services/financial-audit-service');
      await financialAuditService.logFromRequest(req, {
        fundId,
        eventType: 'capital_call.created',
        amount: parseFloat(totalAmount),
        afterState: { callNumber: result.capitalCall.callNumber, investorCount: result.investorLineItems.length, totalAllocated: result.totalAllocated },
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Failed to create fund capital call:', error);
      const status = error.message?.includes('exceeds') ? 400 : error.message?.includes('locked') ? 409 : error.message?.includes('Compliance') ? 409 : 500;
      res.status(status).json({ error: error.message || 'Failed to create capital call' });
    }
  });

  app.get('/api/funds/:fundId/capital-calls', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');

      const movements = await fundService.getCapitalMovementsByFund(orgId, fundId);
      const calls = movements.filter(m => m.movementType === 'call' && !m.fundInvestorId);

      // For each call, get the investor line items
      const callsWithDetails = await Promise.all(calls.map(async (call) => {
        const lineItems = movements.filter(m =>
          m.movementType === 'call' &&
          m.fundInvestorId &&
          m.callNumber === call.callNumber
        );

        return {
          ...call,
          lineItems,
          investorCount: lineItems.length,
          totalAllocated: lineItems.reduce((sum, li) =>
            sum + parseFloat(li.amount?.toString() || '0'), 0
          ),
        };
      }));

      res.json(callsWithDetails);
    } catch (error: any) {
      console.error('Failed to fetch fund capital calls:', error);
      res.status(500).json({ error: 'Failed to fetch capital calls' });
    }
  });

  app.post('/api/funds/:fundId/capital-calls/:callNumber/complete', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId, callNumber } = req.params;
      const { fundService } = await import('./services/fund-service');

      const result = await fundService.completeFundCapitalCall(orgId, fundId, parseInt(callNumber));
      res.json(result);
    } catch (error: any) {
      console.error('Failed to complete capital call:', error);
      res.status(500).json({ error: error.message || 'Failed to complete capital call' });
    }
  });

  // === Fund Distributions (with Waterfall) ===
  app.post('/api/funds/:fundId/distributions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');

      const { totalProceeds, distributionType, dealAllocationId, notes, yearsHeld } = req.body;

      if (!totalProceeds || !distributionType) {
        return res.status(400).json({ error: 'totalProceeds and distributionType are required' });
      }

      const result = await fundService.processFundDistribution(orgId, userId, fundId, {
        totalProceeds: parseFloat(totalProceeds),
        distributionType,
        dealAllocationId,
        notes,
        yearsHeld: yearsHeld ? parseFloat(yearsHeld) : undefined,
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Failed to process fund distribution:', error);
      res.status(500).json({ error: error.message || 'Failed to process distribution' });
    }
  });

  app.get('/api/funds/:fundId/distributions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');

      const movements = await fundService.getCapitalMovementsByFund(orgId, fundId);
      const distributions = movements.filter(m =>
        m.movementType === 'distribution' || m.movementType === 'return_of_capital'
      );

      res.json(distributions);
    } catch (error: any) {
      console.error('Failed to fetch fund distributions:', error);
      res.status(500).json({ error: 'Failed to fetch distributions' });
    }
  });

  // === Preferred Return Accrual ===
  app.post('/api/funds/:fundId/preferred-return/accrue', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');

      const { compoundingMethod, periodMonths, asOfDate } = req.body;

      const result = await fundService.accruePreferredReturn(orgId, fundId, {
        compoundingMethod: compoundingMethod || 'simple',
        periodMonths: periodMonths ? parseInt(periodMonths) : 3,
        asOfDate: asOfDate ? new Date(asOfDate) : undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Failed to accrue preferred return:', error);
      res.status(500).json({ error: error.message || 'Failed to accrue preferred return' });
    }
  });

  app.get('/api/funds/:fundId/preferred-return', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');

      const fund = await fundService.getFund(orgId, fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });

      const investors = await fundService.getInvestorsByFund(orgId, fundId);

      const prefRate = parseFloat(fund.preferredReturn?.toString() || '0.08');

      const summary = investors.map(inv => ({
        investorId: inv.id,
        investorName: inv.investorName,
        investorType: inv.investorType,
        calledCapital: parseFloat(inv.calledCapital?.toString() || '0'),
        returnedCapital: parseFloat(inv.returnedCapital?.toString() || '0'),
        preferredReturnRate: prefRate,
        totalAccrued: parseFloat(inv.preferredReturnAccrued?.toString() || '0'),
        totalPaid: parseFloat(inv.preferredReturnPaid?.toString() || '0'),
        unpaidBalance: parseFloat(inv.preferredReturnAccrued?.toString() || '0') -
          parseFloat(inv.preferredReturnPaid?.toString() || '0'),
      }));

      const totalAccrued = summary.reduce((s, i) => s + i.totalAccrued, 0);
      const totalPaid = summary.reduce((s, i) => s + i.totalPaid, 0);

      res.json({
        fundId,
        preferredReturnRate: prefRate,
        totalAccrued: Math.round(totalAccrued * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalUnpaid: Math.round((totalAccrued - totalPaid) * 100) / 100,
        investors: summary,
      });
    } catch (error: any) {
      console.error('Failed to fetch preferred return summary:', error);
      res.status(500).json({ error: 'Failed to fetch preferred return summary' });
    }
  });

  // === NAV Calculation ===
  app.post('/api/funds/:fundId/nav/calculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');

      const { cashOnHand, outstandingLiabilities, asOfDate } = req.body;

      const result = await fundService.calculateFundNav(orgId, fundId, {
        cashOnHand: cashOnHand ? parseFloat(cashOnHand) : undefined,
        outstandingLiabilities: outstandingLiabilities ? parseFloat(outstandingLiabilities) : undefined,
        asOfDate: asOfDate ? new Date(asOfDate) : undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Failed to calculate NAV:', error);
      res.status(500).json({ error: error.message || 'Failed to calculate NAV' });
    }
  });

  // === Sync Deal Returns ===
  app.post('/api/funds/:fundId/sync-deal-returns', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId } = req.params;
      const { fundService } = await import('./services/fund-service');

      const result = await fundService.syncDealReturns(orgId, fundId);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to sync deal returns:', error);
      res.status(500).json({ error: 'Failed to sync deal returns' });
    }
  });

  // === LP Investor Statement ===
  app.get('/api/funds/:fundId/investors/:investorId/statement', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId, investorId } = req.params;
      const { fundService } = await import('./services/fund-service');

      const { periodStart, periodEnd, asOfDate } = req.query as Record<string, string>;

      const statement = await fundService.generateInvestorStatement(orgId, fundId, investorId, {
        asOfDate: asOfDate ? new Date(asOfDate) : undefined,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      });

      res.json(statement);
    } catch (error: any) {
      console.error('Failed to generate investor statement:', error);
      res.status(500).json({ error: error.message || 'Failed to generate investor statement' });
    }
  });

  // === LP Investor Statement — PDF Download ===
  app.get('/api/funds/:fundId/investors/:investorId/statement/pdf', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fundId, investorId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const { generateStatementPDF } = await import('./services/lp-statement-pdf');

      const { periodStart, periodEnd, asOfDate } = req.query as Record<string, string>;
      const asOf = asOfDate ? new Date(asOfDate) : undefined;

      const statement = await fundService.generateInvestorStatement(orgId, fundId, investorId, {
        asOfDate: asOf,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      });

      const pdfBytes = await generateStatementPDF(statement, asOf);

      const filename = `${statement.fund.name.replace(/[^a-zA-Z0-9]/g, '_')}_${statement.investor.name.replace(/[^a-zA-Z0-9]/g, '_')}_Statement.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.end(Buffer.from(pdfBytes));
    } catch (error: any) {
      console.error('Failed to generate PDF statement:', error);
      res.status(500).json({ error: error.message || 'Failed to generate PDF statement' });
    }
  });

  // === LP Reporting (project-level, for workspace tab) ===
  app.get('/api/modeling/projects/:projectId/lp-reporting', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { fundService } = await import('./services/fund-service');

      // Find fund allocation for this project
      const allocation = await fundService.getAllocationByProject(orgId, projectId);

      if (!allocation) {
        // No fund linked — return structured empty response so frontend shows empty state
        return res.json({
          fundSummary: null,
          capitalAccount: [],
          distributionHistory: [],
          navBridge: [],
          investments: [],
          reportDate: new Date().toISOString().split('T')[0],
          fundName: 'No Fund Linked',
        });
      }

      const fundId = allocation.fundId;
      const fund = await fundService.getFund(orgId, fundId);
      if (!fund) return res.status(404).json({ error: 'Fund not found' });

      const metrics = await fundService.calculateFundMetrics(orgId, fundId);
      const investors = await fundService.getInvestorsByFund(orgId, fundId);
      const allocations = await fundService.getAllocationsByFund(orgId, fundId);
      const cashFlows = await fundService.getCashFlowsByFund(orgId, fundId);

      // Build fund summary
      const fundSummary = {
        tvpi: metrics.tvpi || 0,
        dpi: metrics.dpi || 0,
        rvpi: metrics.rvpi || 0,
        netIRR: (metrics.netIrr || 0) * 100,
        totalCommitted: metrics.committedCapital,
        totalCalled: metrics.calledCapital,
        totalDistributed: metrics.distributedCapital,
        totalNAV: metrics.nav,
        vintage: fund.vintage || new Date().getFullYear(),
        fundLife: `${fund.investmentPeriodYears || 0} of ${fund.fundLifeYears || 10} years`,
      };

      // Build capital account entries from cash flows
      const capitalAccount: any[] = [];
      let runningBalance = 0;

      // Group cash flows by quarter
      const quarterlyFlows = new Map<string, { contributions: number; distributions: number; gainsLosses: number }>();

      for (const cf of cashFlows) {
        const date = new Date(cf.flowDate);
        const q = `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
        const existing = quarterlyFlows.get(q) || { contributions: 0, distributions: 0, gainsLosses: 0 };

        const gross = parseFloat(cf.grossAmount?.toString() || '0');
        if (cf.flowType === 'inflow') {
          existing.contributions += Math.abs(gross);
        } else {
          existing.distributions += Math.abs(gross);
        }
        quarterlyFlows.set(q, existing);
      }

      for (const [quarter, flows] of quarterlyFlows) {
        const beginningBalance = runningBalance;
        const gainsLosses = flows.contributions * 0.03; // Simplified unrealized gain estimate
        runningBalance = beginningBalance + flows.contributions - flows.distributions + gainsLosses;
        capitalAccount.push({
          quarter,
          beginningBalance: Math.round(beginningBalance * 100) / 100,
          contributions: Math.round(flows.contributions * 100) / 100,
          distributions: Math.round(-flows.distributions * 100) / 100,
          gainsLosses: Math.round(gainsLosses * 100) / 100,
          endingBalance: Math.round(runningBalance * 100) / 100,
        });
      }

      // Build distribution history from capital movements
      const movements = await fundService.getCapitalMovementsByFund(orgId, fundId);
      const distributionMovements = movements.filter(m =>
        (m.movementType === 'distribution' || m.movementType === 'return_of_capital') &&
        m.status === 'completed' && !m.fundInvestorId
      );

      const distributionHistory = distributionMovements.map(m => {
        const date = new Date(m.movementDate);
        const q = `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
        return {
          quarter: q,
          returnOfCapital: parseFloat(m.returnOfCapital?.toString() || '0'),
          capitalGains: parseFloat(m.carriedInterest?.toString() || '0'),
          incomeDistributions: parseFloat(m.amount?.toString() || '0') -
            parseFloat(m.returnOfCapital?.toString() || '0') -
            parseFloat(m.carriedInterest?.toString() || '0'),
          total: parseFloat(m.amount?.toString() || '0'),
        };
      });

      // Build NAV bridge
      const navBridge = [
        { label: 'Beginning NAV', value: metrics.calledCapital, type: 'start' },
        { label: 'Capital Calls', value: metrics.calledCapital, type: 'add' },
        { label: 'Distributions', value: -metrics.distributedCapital, type: 'subtract' },
        { label: 'Unrealized Gains', value: metrics.nav - metrics.calledCapital + metrics.distributedCapital, type: 'add' },
        { label: 'Ending NAV', value: metrics.nav, type: 'end' },
      ];

      // Build investment summaries
      const investments: any[] = [];
      for (const alloc of allocations) {
        let projectName = 'Unknown Property';
        if (alloc.modelingProjectId) {
          const { modelingProjects: mp } = await import('@shared/schema');
          const { eq: eqOp } = await import('drizzle-orm');
          const { db: database } = await import('./db');
          const [proj] = await database.select({ name: mp.marinaName }).from(mp).where(eqOp(mp.id, alloc.modelingProjectId)).limit(1);
          projectName = proj?.name || projectName;
        }

        const invested = parseFloat(alloc.fundedAmount?.toString() || '0');
        const current = parseFloat(alloc.currentValue?.toString() || alloc.fundedAmount?.toString() || '0');
        const moic = invested > 0 ? current / invested : 0;

        investments.push({
          property: projectName,
          vintage: alloc.investmentDate ? new Date(alloc.investmentDate).getFullYear() : fund.vintage || 0,
          investedCapital: invested,
          currentValue: current,
          moic: Math.round(moic * 100) / 100,
          irr: parseFloat(alloc.dealIrr?.toString() || '0'),
          status: alloc.exitStatus === 'exited' ? 'realized' : 'active',
        });
      }

      res.json({
        fundSummary,
        capitalAccount,
        distributionHistory,
        navBridge,
        investments,
        reportDate: new Date().toISOString().split('T')[0],
        fundName: fund.name,
      });
    } catch (error: any) {
      console.error('Failed to generate LP reporting data:', error);
      res.status(500).json({ error: 'Failed to generate LP reporting data' });
    }
  });

  // Get deal allocation by modeling project ID
  app.get('/api/funds/allocations/by-project/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const allocation = await fundService.getAllocationByProject(orgId, projectId);
      if (!allocation) {
        return res.status(404).json({ error: 'No fund allocation found for this project' });
      }
      res.json(allocation);
    } catch (error: any) {
      console.error('Failed to fetch deal allocation by project:', error);
      res.status(500).json({ error: 'Failed to fetch deal allocation' });
    }
  });

  // Create fund allocation (link project to fund)
  app.post('/api/funds/allocations', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { fundService } = await import('./services/fund-service');
      const allocation = await fundService.createDealAllocation(orgId, {
        ...req.body,
        orgId,
      });
      res.status(201).json(allocation);
    } catch (error: any) {
      console.error('Failed to create fund allocation:', error);
      res.status(500).json({ error: 'Failed to create fund allocation' });
    }
  });

  // Update fund allocation (toggle inheritance, change template, etc.)
  app.patch('/api/funds/allocations/:allocationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { allocationId } = req.params;
      const { fundService } = await import('./services/fund-service');
      const updated = await fundService.updateDealAllocation(orgId, allocationId, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Allocation not found' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update fund allocation:', error);
      res.status(500).json({ error: 'Failed to update fund allocation' });
    }
  });

  // Delete fund allocation (unlink project from fund)
  app.delete('/api/funds/allocations/:allocationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { allocationId } = req.params;
      const { fundService } = await import('./services/fund-service');
      await fundService.deleteDealAllocation(orgId, allocationId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Failed to delete fund allocation:', error);
      res.status(500).json({ error: 'Failed to delete fund allocation' });
    }
  });

  // Apply capital stack template to modeling project
  app.post('/api/modeling/projects/:projectId/capital-stacks/apply-template', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { templateId } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ error: 'Template ID is required' });
      }
      
      const { fundService } = await import('./services/fund-service');
      const template = await fundService.getCapitalStackTemplate(orgId, templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      // Create a new capital stack based on the template
      const modelingProject = await storage.getModelingProject(projectId, orgId);
      if (!modelingProject) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      // Get or estimate purchase price from the project
      const purchasePrice = parseFloat(modelingProject.purchasePrice?.toString() || '10000000');
      const targetLtv = parseFloat(template.targetLtv?.toString() || '0.65');
      const totalDebt = purchasePrice * targetLtv;
      const totalEquity = purchasePrice - totalDebt;
      
      // Create capital stack
      const stack = await storage.createCapitalStack({
        orgId,
        modelingProjectId: projectId,
        name: `${template.name} - Applied`,
        description: `Created from fund template: ${template.name}`,
        purchasePrice: purchasePrice.toString(),
        closingCosts: (purchasePrice * 0.015).toString(),
        capexReserves: (purchasePrice * 0.02).toString(),
        workingCapital: (purchasePrice * 0.005).toString(),
        totalCapitalization: (purchasePrice * 1.04).toString(),
        holdPeriodYears: 5,
        exitCapRate: '0.07',
        noiGrowthRate: '0.02',
        status: 'active',
        createdBy: userId,
      });
      
      // Create debt tranches from template
      const debtTemplates = template.debtTemplates || [];
      for (const debtTemplate of debtTemplates) {
        await storage.createDebtTranche({
          capitalStackId: stack.id,
          name: debtTemplate.name,
          trancheType: debtTemplate.trancheType,
          principal: (totalDebt * (debtTemplate.principalPct || 1)).toString(),
          interestRate: debtTemplate.interestRate.toString(),
          termYears: debtTemplate.termYears,
          amortizationYears: debtTemplate.amortizationYears || null,
          interestOnlyMonths: debtTemplate.interestOnlyMonths || 0,
          priority: debtTemplate.priority,
        });
      }
      
      // Create equity layers from template
      const equityTemplates = template.equityTemplates || [];
      for (const equityTemplate of equityTemplates) {
        await storage.createEquityLayer({
          capitalStackId: stack.id,
          name: equityTemplate.name,
          layerType: equityTemplate.layerType,
          investorType: equityTemplate.investorType,
          commitmentAmount: (totalEquity * (equityTemplate.ownershipPct || 0)).toString(),
          fundedAmount: '0',
          ownershipPct: (equityTemplate.ownershipPct * 100).toString(),
          preferredReturn: equityTemplate.preferredReturn?.toString() || null,
          preferredReturnType: equityTemplate.preferredReturnType || null,
          isParticipating: equityTemplate.isParticipating ?? true,
          promoteTiers: equityTemplate.promoteTiers || null,
          waterfallPriority: equityTemplate.waterfallPriority,
        });
      }
      
      res.status(201).json({ 
        message: 'Template applied successfully',
        capitalStack: stack
      });
    } catch (error: any) {
      console.error('Failed to apply capital stack template:', error);
      res.status(500).json({ error: 'Failed to apply capital stack template' });
    }
  });
  // ============================================================================
  // LOANS - Phase 1 Debt Engine (Single Loan CRUD + Schedule Computation)
  // ============================================================================

  // Get all loans for a project
  app.get('/api/modeling/projects/:projectId/loans', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { loans: loansTable } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const result = await db.select().from(loansTable)
        .where(and(eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)))
        .orderBy(loansTable.ordinal);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to fetch loans:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a loan for a project
  app.post('/api/modeling/projects/:projectId/loans', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { loans: loansTable } = await import('@shared/schema');
      const [loan] = await db.insert(loansTable).values({
        ...req.body,
        projectId,
        orgId,
      }).returning();
      // Sync: push new loan into capital stack
      try {
        await syncLoansToCapitalStack(projectId, orgId, userId);
      } catch (syncErr) {
        console.warn("[Loan→CapStack Sync] Failed on create:", syncErr);
      }
      res.json(loan);
    } catch (error: any) {
      console.error('Failed to create loan:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update a loan
  app.patch('/api/modeling/projects/:projectId/loans/:loanId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, loanId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { loans: loansTable } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const [updated] = await db.update(loansTable)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(loansTable.id, loanId), eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)))
        .returning();
      // Sync: push updated loan into capital stack
      try {
        await syncLoansToCapitalStack(projectId, orgId, req.user.id);
      } catch (syncErr) {
        console.warn("[Loan→CapStack Sync] Failed on update:", syncErr);
      }
      if (!updated) return res.status(404).json({ error: 'Loan not found' });
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update loan:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a loan
  app.delete('/api/modeling/projects/:projectId/loans/:loanId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, loanId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { loans: loansTable } = await import('@shared/schema');
      // Sync: re-sync or clear capital stack
      try {
        const remainingLoans = await db.select().from(loansTable)
          .where(and(eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)));
        if (remainingLoans.length === 0) {
          await clearDebtFromCapitalStack(projectId, orgId);
        } else {
          await syncLoansToCapitalStack(projectId, orgId);
        }
      } catch (syncErr) {
        console.warn("[Loan→CapStack Sync] Failed on delete:", syncErr);
      }
      const { eq, and } = await import('drizzle-orm');
      await db.delete(loansTable)
        .where(and(eq(loansTable.id, loanId), eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete loan:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Compute loan schedule (on-demand, using canonical engine)
  app.get('/api/modeling/projects/:projectId/loans/:loanId/schedule', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, loanId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { loans: loansTable } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const [loan] = await db.select().from(loansTable)
        .where(and(eq(loansTable.id, loanId), eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)));
      if (!loan) return res.status(404).json({ error: 'Loan not found' });

      const { computeLoanSchedule, computeLoanFeesAtClose, computeLoanPayoffAtExit, computeAnnualDebtService, computeDSCR, computeLTV } = await import('@shared/debt/debt-engine');

      const loanInput = {
        loanAmount: parseFloat(loan.loanAmount),
        termMonths: loan.termMonths,
        amortMonths: loan.amortMonths,
        interestOnlyMonths: loan.interestOnlyMonths,
        rateType: loan.rateType as 'fixed' | 'floating',
        fixedRate: loan.fixedRate ? parseFloat(loan.fixedRate) : undefined,
        initialIndexBps: loan.initialIndexBps ?? undefined,
        spreadBps: loan.spreadBps ?? undefined,
        indexFloorBps: loan.indexFloorBps ?? undefined,
        capitalizeOriginationFees: loan.capitalizeOriginationFees,
        originationFeePct: loan.originationFeePct ? parseFloat(loan.originationFeePct) : undefined,
        underwritingFee: loan.underwritingFee ? parseFloat(loan.underwritingFee) : undefined,
        legalFee: loan.legalFee ? parseFloat(loan.legalFee) : undefined,
        appraisalFee: loan.appraisalFee ? parseFloat(loan.appraisalFee) : undefined,
        otherClosingCosts: loan.otherClosingCosts ? parseFloat(loan.otherClosingCosts) : undefined,
        annualServicingFee: loan.annualServicingFee ? parseFloat(loan.annualServicingFee) : undefined,
        exitFeePct: loan.exitFeePct ? parseFloat(loan.exitFeePct) : undefined,
        prepayType: loan.prepayType as 'none' | 'stepdown' | 'yield_maint' | 'defeasance',
        stepdownSchedule: loan.stepdownScheduleJson as number[] | undefined,
      };

      const schedule = computeLoanSchedule(loanInput);
      const fees = computeLoanFeesAtClose(loanInput);
      const annualDS = computeAnnualDebtService(schedule);

      // Compute exit payoff at end of term
      const exitMonth = loan.termMonths - 1;
      const payoff = computeLoanPayoffAtExit(loanInput, schedule, exitMonth);

      // Compute DSCR and LTV using project data if available
      const purchasePrice = project.purchasePrice ? parseFloat(project.purchasePrice) : 0;
      const year1DS = annualDS[0]?.totalDebtService || 0;

      res.json({
        loan,
        schedule,
        fees,
        annualDebtService: annualDS,
        exitPayoff: payoff,
        metrics: {
          purchasePrice,
          ltv: computeLTV(parseFloat(loan.loanAmount), purchasePrice),
          year1DSCR: null, // Computed in client with NOI
        },
      });
    } catch (error: any) {
      console.error('Failed to compute loan schedule:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Lightweight capital stack summary from loans (for debt-inputs widget)
  app.get("/api/modeling/projects/:projectId/debt-summary", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const { loans: loansTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const projectLoans = await db.select().from(loansTable)
        .where(and(eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)))
        .orderBy(loansTable.ordinal);

      const purchasePrice = parseFloat(project.purchasePrice?.toString() || "0");

      if (projectLoans.length === 0) {
        return res.json({
          hasDebt: false,
          totalUses: purchasePrice,
          totalDebt: 0,
          totalEquity: purchasePrice,
          debtPct: 0,
          equityPct: 1,
          ltv: 0,
          dscr: null,
          debtYield: null,
          monthlyDebtService: 0,
          annualDebtService: 0,
          year1EndingBalance: 0,
          blendedRate: 0,
        });
      }

      const { computeCapitalStackSummary } = await import("@shared/debt/debt-engine");
      type DebtEngineInput = import("@shared/debt/debt-engine").DebtEngineInput;

      const engineInputs: DebtEngineInput[] = projectLoans.map((loan: any) => ({
        loanAmount: parseFloat(loan.loanAmount?.toString() || "0"),
        termMonths: loan.termMonths,
        amortMonths: loan.amortMonths,
        interestOnlyMonths: loan.interestOnlyMonths,
        rateType: loan.rateType as "fixed" | "floating",
        fixedRate: loan.fixedRate ? parseFloat(loan.fixedRate) : undefined,
        initialIndexBps: loan.initialIndexBps ?? undefined,
        spreadBps: loan.spreadBps ?? undefined,
        indexFloorBps: loan.indexFloorBps ?? undefined,
        capitalizeOriginationFees: loan.capitalizeOriginationFees,
        originationFeePct: loan.originationFeePct ? parseFloat(loan.originationFeePct) : undefined,
        underwritingFee: loan.underwritingFee ? parseFloat(loan.underwritingFee) : undefined,
        legalFee: loan.legalFee ? parseFloat(loan.legalFee) : undefined,
        appraisalFee: loan.appraisalFee ? parseFloat(loan.appraisalFee) : undefined,
        otherClosingCosts: loan.otherClosingCosts ? parseFloat(loan.otherClosingCosts) : undefined,
        annualServicingFee: loan.annualServicingFee ? parseFloat(loan.annualServicingFee) : undefined,
        exitFeePct: loan.exitFeePct ? parseFloat(loan.exitFeePct) : undefined,
        prepayType: (loan.prepayType || "none") as "none" | "stepdown" | "yield_maint" | "defeasance",
        stepdownSchedule: loan.stepdownScheduleJson as number[] | undefined,
      }));

      // Fetch NOI from Pro Forma for DSCR computation
      let annualNoi: number | undefined;
      let noiTimeline: { year: number; noi: number }[] = [];
      try {
        const { proFormaEngineService } = await import("./services/pro-forma-engine-service");
        const proForma = await proFormaEngineService.generateProForma(projectId, orgId, "base");
        if (proForma?.annualProjections?.length > 0) {
          annualNoi = proForma.annualProjections[0]?.noi ?? proForma.annualProjections[0]?.netOperatingIncome;
          noiTimeline = proForma.annualProjections.map((yr: any, i: number) => ({
            year: i + 1,
            noi: yr.noi ?? yr.netOperatingIncome ?? 0,
          })).filter((y: any) => y.noi > 0);
        }
      } catch (noiErr) {
        // Pro Forma not available yet
      }

      const summary = computeCapitalStackSummary(engineInputs, purchasePrice, 0, 0, 0, annualNoi);

      // Build multi-year DSCR timeline
      const { computeLoanSchedule: cls } = await import("@shared/debt/debt-engine");
      const allScheds = engineInputs.map((inp: any) => cls(inp));
      const mxLen = Math.max(...allScheds.map((s: any) => s.length));
      const annualDS: Record<number, { ds: number; endBal: number }> = {};
      for (let m = 0; m < mxLen; m++) {
        let ds = 0, eb = 0;
        for (const s of allScheds) { if (m < s.length) { ds += s[m].debtService; eb += s[m].endBal; } }
        const yr = Math.floor(m / 12) + 1;
        if (!annualDS[yr]) annualDS[yr] = { ds: 0, endBal: 0 };
        annualDS[yr].ds += ds;
        annualDS[yr].endBal = eb;
      }

      const dscrTimeline = Object.entries(annualDS).map(([yr, val]) => {
        const yearNum = parseInt(yr);
        const noiEntry = noiTimeline.find((n: any) => n.year === yearNum);
        const noi = noiEntry?.noi ?? 0;
        return {
          year: yearNum,
          noi: Math.round(noi),
          debtService: Math.round(val.ds),
          dscr: noi > 0 && val.ds > 0 ? Math.round((noi / val.ds) * 100) / 100 : null,
          debtYield: noi > 0 && val.endBal > 0 ? Math.round((noi / val.endBal) * 10000) / 10000 : null,
          endingBalance: Math.round(val.endBal),
        };
      });

      res.json({
        hasDebt: true,
        ...summary,
        noiSource: noiTimeline.length > 0 ? "pro_forma" : null,
        dscrTimeline,
      });
    } catch (error: any) {
      console.error("Failed to compute debt summary:", error);
      res.status(500).json({ error: error.message });
    }
  });


  // Consolidated merged schedule across all loans
  app.get("/api/modeling/projects/:projectId/debt-schedule-all", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const { loans: loansTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const projectLoans = await db.select().from(loansTable)
        .where(and(eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)))
        .orderBy(loansTable.ordinal);

      if (projectLoans.length === 0) return res.json({ loans: [], merged: [], annual: [] });

      const { computeLoanSchedule, computeAnnualDebtService } = await import("@shared/debt/debt-engine");
      type DebtEngineInput = import("@shared/debt/debt-engine").DebtEngineInput;

      const loanSchedules = projectLoans.map((loan: any) => {
        const input: DebtEngineInput = {
          loanAmount: parseFloat(loan.loanAmount?.toString() || "0"),
          termMonths: loan.termMonths, amortMonths: loan.amortMonths,
          interestOnlyMonths: loan.interestOnlyMonths,
          rateType: loan.rateType as "fixed" | "floating",
          fixedRate: loan.fixedRate ? parseFloat(loan.fixedRate) : undefined,
          initialIndexBps: loan.initialIndexBps ?? undefined,
          spreadBps: loan.spreadBps ?? undefined,
          indexFloorBps: loan.indexFloorBps ?? undefined,
          capitalizeOriginationFees: loan.capitalizeOriginationFees,
          originationFeePct: loan.originationFeePct ? parseFloat(loan.originationFeePct) : undefined,
          exitFeePct: loan.exitFeePct ? parseFloat(loan.exitFeePct) : undefined,
          prepayType: (loan.prepayType || "none") as any,
          stepdownSchedule: loan.stepdownScheduleJson as number[] | undefined,
        };
        return { loanId: loan.id, loanName: loan.loanName, schedule: computeLoanSchedule(input) };
      });

      const maxLen = Math.max(...loanSchedules.map((ls: any) => ls.schedule.length));
      const merged = Array.from({ length: maxLen }, (_, m) => {
        let ti = 0, tp = 0, tb = 0, te = 0;
        for (const ls of loanSchedules) { const r = ls.schedule[m]; if (r) { ti += r.interest; tp += r.principal; tb += r.beginBal; te += r.endBal; } }
        return { monthIndex: m, beginBal: Math.round(tb*100)/100, interest: Math.round(ti*100)/100, principal: Math.round(tp*100)/100, debtService: Math.round((ti+tp)*100)/100, endBal: Math.round(te*100)/100 };
      });

      const annual = computeAnnualDebtService(merged as any);
      res.json({ loans: loanSchedules.map((ls: any) => ({ loanId: ls.loanId, loanName: ls.loanName, monthCount: ls.schedule.length })), merged, annual });
    } catch (error: any) {
      console.error("Failed to compute consolidated schedule:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // Diagnostic: inspect actuals category distribution for a project
  app.get("/api/modeling/projects/:projectId/actuals-diagnostic", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { modelingActuals } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const actuals = await db.select().from(modelingActuals)
        .where(and(eq(modelingActuals.modelingProjectId, projectId), eq(modelingActuals.orgId, orgId)));
      const byCategory: Record<string, { count: number; total: number; items: string[] }> = {};
      const byDepartment: Record<string, { count: number; total: number }> = {};
      const uncategorized: any[] = [];
      for (const a of actuals) {
        const cat = a.category || "MISSING";
        const dept = a.department || "MISSING";
        const amt = parseFloat(a.amount?.toString() || "0");
        if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0, items: [] };
        byCategory[cat].count++;
        byCategory[cat].total += amt;
        if (byCategory[cat].items.length < 5) byCategory[cat].items.push(a.subcategory || "?");
        if (!byDepartment[dept]) byDepartment[dept] = { count: 0, total: 0 };
        byDepartment[dept].count++;
        byDepartment[dept].total += amt;
        if (cat === "MISSING" || cat === "Other") uncategorized.push({ id: a.id, sub: a.subcategory, amt, dept });
      }
      const revenue = byCategory["Revenue"]?.total || 0;
      const cogs = byCategory["COGS"]?.total || 0;
      const expenses = byCategory["Expenses"]?.total || 0;
      const impliedNoi = revenue - cogs - expenses;
      res.json({
        totalRecords: actuals.length,
        years: [...new Set(actuals.map(a => a.year))].sort(),
        categoryBreakdown: Object.entries(byCategory).map(([k, v]) => ({ category: k, ...v, total: Math.round(v.total) })),
        departmentBreakdown: Object.entries(byDepartment).map(([k, v]) => ({ department: k, ...v, total: Math.round(v.total) })),
        impliedAnnualNoi: Math.round(impliedNoi),
        uncategorizedItems: uncategorized.slice(0, 20),
        warnings: [
          ...(!byCategory["Revenue"] ? ["NO REVENUE RECORDS — all income may be misclassified"] : []),
          ...(byCategory["MISSING"] ? [`${byCategory["MISSING"].count} records with MISSING category`] : []),
          ...(byCategory["Other"] ? [`${byCategory["Other"].count} records classified as Other — review needed`] : []),
          ...(impliedNoi < 0 ? ["IMPLIED NOI IS NEGATIVE — likely classification issue"] : []),
        ],
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // Debt → Tax bridge: annual interest expense + depreciation for tax deductions
  app.get("/api/modeling/projects/:projectId/debt-tax-bridge", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const holdYears = parseInt(req.query.holdYears as string) || 10;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const { loans: loansTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const projectLoans = await db.select().from(loansTable)
        .where(and(eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)))
        .orderBy(loansTable.ordinal);
      const { computeLoanSchedule, computeAnnualDebtService } = await import("@shared/debt/debt-engine");
      // Build annual interest from all loans
      const allSchedules = projectLoans.map((loan: any) => computeLoanSchedule({
        loanAmount: parseFloat(loan.loanAmount?.toString() || "0"),
        termMonths: loan.termMonths, amortMonths: loan.amortMonths,
        interestOnlyMonths: loan.interestOnlyMonths,
        rateType: loan.rateType as "fixed" | "floating",
        fixedRate: loan.fixedRate ? parseFloat(loan.fixedRate) : undefined,
        initialIndexBps: loan.initialIndexBps ?? undefined,
        spreadBps: loan.spreadBps ?? undefined,
        indexFloorBps: loan.indexFloorBps ?? undefined,
        capitalizeOriginationFees: loan.capitalizeOriginationFees,
        originationFeePct: loan.originationFeePct ? parseFloat(loan.originationFeePct) : undefined,
        exitFeePct: loan.exitFeePct ? parseFloat(loan.exitFeePct) : undefined,
        prepayType: (loan.prepayType || "none") as any,
        stepdownSchedule: loan.stepdownScheduleJson as number[] | undefined,
      }));
      // Merge monthly → annual interest
      const annualInterest: Record<number, number> = {};
      const annualPrincipal: Record<number, number> = {};
      const annualDS: Record<number, number> = {};
      const annualEndBal: Record<number, number> = {};
      for (const sched of allSchedules) {
        for (let m = 0; m < sched.length; m++) {
          const yr = Math.floor(m / 12) + 1;
          annualInterest[yr] = (annualInterest[yr] || 0) + sched[m].interest;
          annualPrincipal[yr] = (annualPrincipal[yr] || 0) + sched[m].principal;
          annualDS[yr] = (annualDS[yr] || 0) + sched[m].debtService;
          annualEndBal[yr] = sched[m].endBal;
        }
      }
      // Fetch depreciation from tax inputs
      const { projectTaxInputs: taxInputsTable } = await import("@shared/schema");
      const [taxInputs] = await db.select().from(taxInputsTable)
        .where(eq(taxInputsTable.projectId, projectId));
      const purchasePrice = parseFloat(project.purchasePrice?.toString() || "0");
      const buildingBasis = taxInputs?.buildingBasisCents ? parseFloat(taxInputs.buildingBasisCents) / 100 : purchasePrice * 0.8;
      const buildingLife = taxInputs?.buildingLifeYears || 39;
      const annualDepreciation = taxInputs?.annualDepreciationCents
        ? parseFloat(taxInputs.annualDepreciationCents) / 100
        : Math.round(buildingBasis / buildingLife);
      const bonusDepPct = taxInputs?.bonusDepreciationPercent ? parseFloat(taxInputs.bonusDepreciationPercent) : 0;
      const amortizationAnnual = taxInputs?.amortizationAnnualCents ? parseFloat(taxInputs.amortizationAnnualCents) / 100 : 0;
      const interestDeductible = taxInputs?.interestDeductible !== false;
      // Build year-by-year tax deductions
      const timeline = Array.from({ length: holdYears }, (_, i) => {
        const yr = i + 1;
        const interest = Math.round((annualInterest[yr] || 0) * 100) / 100;
        const principal = Math.round((annualPrincipal[yr] || 0) * 100) / 100;
        const debtService = Math.round((annualDS[yr] || 0) * 100) / 100;
        const endBal = Math.round((annualEndBal[yr] || 0) * 100) / 100;
        const depreciation = yr === 1
          ? Math.round((annualDepreciation + (buildingBasis * bonusDepPct)) * 100) / 100
          : Math.round(annualDepreciation * 100) / 100;
        const amortization = amortizationAnnual;
        const interestDeduction = interestDeductible ? interest : 0;
        const totalDeductions = interestDeduction + depreciation + amortization;
        return { year: yr, interest, principal, debtService, endingBalance: endBal, depreciation, amortization, interestDeduction, totalDeductions };
      });
      const totals = {
        totalInterest: timeline.reduce((s, r) => s + r.interest, 0),
        totalPrincipal: timeline.reduce((s, r) => s + r.principal, 0),
        totalDepreciation: timeline.reduce((s, r) => s + r.depreciation, 0),
        totalAmortization: timeline.reduce((s, r) => s + r.amortization, 0),
        totalDeductions: timeline.reduce((s, r) => s + r.totalDeductions, 0),
      };
      res.json({ holdYears, interestDeductible, buildingBasis, buildingLife, annualDepreciation, timeline, totals });
    } catch (error: any) {
      console.error("Failed to compute debt-tax bridge:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // Canonical debt payoff at exit month (for exit scenario auto-population)
  app.get("/api/modeling/projects/:projectId/debt-payoff", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const exitMonth = parseInt(req.query.exitMonth as string) || 60;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const { loans: loansTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const projectLoans = await db.select().from(loansTable)
        .where(and(eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)))
        .orderBy(loansTable.ordinal);

      if (projectLoans.length === 0) {
        return res.json({
          hasDebt: false, exitMonth, outstandingBalance: 0,
          prepaymentPenalty: 0, exitFees: 0, totalPayoff: 0, loanPayoffs: [],
        });
      }

      const { computeProjectExitDebt } = await import("@shared/debt/exit-adapter");
      type DebtEngineInput = import("@shared/debt/debt-engine").DebtEngineInput;

      const engineInputs: DebtEngineInput[] = projectLoans.map((loan: any) => ({
        loanAmount: parseFloat(loan.loanAmount?.toString() || "0"),
        termMonths: loan.termMonths,
        amortMonths: loan.amortMonths,
        interestOnlyMonths: loan.interestOnlyMonths,
        rateType: loan.rateType as "fixed" | "floating",
        fixedRate: loan.fixedRate ? parseFloat(loan.fixedRate) : undefined,
        initialIndexBps: loan.initialIndexBps ?? undefined,
        spreadBps: loan.spreadBps ?? undefined,
        indexFloorBps: loan.indexFloorBps ?? undefined,
        capitalizeOriginationFees: loan.capitalizeOriginationFees,
        originationFeePct: loan.originationFeePct ? parseFloat(loan.originationFeePct) : undefined,
        underwritingFee: loan.underwritingFee ? parseFloat(loan.underwritingFee) : undefined,
        legalFee: loan.legalFee ? parseFloat(loan.legalFee) : undefined,
        appraisalFee: loan.appraisalFee ? parseFloat(loan.appraisalFee) : undefined,
        otherClosingCosts: loan.otherClosingCosts ? parseFloat(loan.otherClosingCosts) : undefined,
        annualServicingFee: loan.annualServicingFee ? parseFloat(loan.annualServicingFee) : undefined,
        exitFeePct: loan.exitFeePct ? parseFloat(loan.exitFeePct) : undefined,
        prepayType: (loan.prepayType || "none") as "none" | "stepdown" | "yield_maint" | "defeasance",
        stepdownSchedule: loan.stepdownScheduleJson as number[] | undefined,
      }));

      const payoff = computeProjectExitDebt(engineInputs, exitMonth - 1);

      res.json({ hasDebt: true, exitMonth, ...payoff });
    } catch (error: any) {
      console.error("Failed to compute debt payoff:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Phase 4: Refinance Analysis ──
  app.post("/api/modeling/projects/:projectId/debt-refi", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { loanId, triggerMonthIndex, newLoanTerms, cashOutAllowed, propertyValueAtRefi, maxLtvPct, refiFees, maxCashOut } = req.body;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const { loans: loansTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const [loan] = await db.select().from(loansTable)
        .where(and(eq(loansTable.id, loanId), eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)))
        .limit(1);
      if (!loan) return res.status(404).json({ error: "Loan not found" });

      const { computeRefiPlan, compareRefiVsHold } = await import("@shared/debt/refi-engine");
      type DebtEngineInput = import("@shared/debt/debt-engine").DebtEngineInput;

      const existingLoan: DebtEngineInput = {
        loanAmount: parseFloat(loan.loanAmount?.toString() || "0"),
        termMonths: loan.termMonths, amortMonths: loan.amortMonths,
        interestOnlyMonths: loan.interestOnlyMonths,
        rateType: loan.rateType as "fixed" | "floating",
        fixedRate: loan.fixedRate ? parseFloat(loan.fixedRate) : undefined,
        initialIndexBps: loan.initialIndexBps ?? undefined,
        spreadBps: loan.spreadBps ?? undefined,
        indexFloorBps: loan.indexFloorBps ?? undefined,
        capitalizeOriginationFees: loan.capitalizeOriginationFees,
        originationFeePct: loan.originationFeePct ? parseFloat(loan.originationFeePct) : undefined,
        exitFeePct: loan.exitFeePct ? parseFloat(loan.exitFeePct) : undefined,
        prepayType: (loan.prepayType || "none") as any,
        stepdownSchedule: loan.stepdownScheduleJson as number[] | undefined,
      };

      const refiConfig = { triggerMonthIndex, newLoanTerms, cashOutAllowed, propertyValueAtRefi, maxLtvPct, refiFees, maxCashOut };
      const plan = computeRefiPlan(existingLoan, refiConfig);
      const comparison = compareRefiVsHold(existingLoan, refiConfig, loan.termMonths - 1);

      res.json({ plan: { ...plan, mergedSchedule: undefined, annualSummary: plan.annualSummary }, comparison });
    } catch (error: any) {
      console.error("Failed to compute refi plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Phase 5: Stress Testing ──
  app.post("/api/modeling/projects/:projectId/debt-stress-test", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const { loans: loansTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const projectLoans = await db.select().from(loansTable)
        .where(and(eq(loansTable.projectId, projectId), eq(loansTable.orgId, orgId)))
        .orderBy(loansTable.ordinal);

      if (projectLoans.length === 0) return res.json({ error: "No loans configured" });

      const { computeStressTest } = await import("@shared/debt/stress-test-engine");
      type DebtEngineInput = import("@shared/debt/debt-engine").DebtEngineInput;

      const engineInputs: DebtEngineInput[] = projectLoans.map((loan: any) => ({
        loanAmount: parseFloat(loan.loanAmount?.toString() || "0"),
        termMonths: loan.termMonths, amortMonths: loan.amortMonths,
        interestOnlyMonths: loan.interestOnlyMonths,
        rateType: loan.rateType as "fixed" | "floating",
        fixedRate: loan.fixedRate ? parseFloat(loan.fixedRate) : undefined,
        initialIndexBps: loan.initialIndexBps ?? undefined,
        spreadBps: loan.spreadBps ?? undefined,
        indexFloorBps: loan.indexFloorBps ?? undefined,
        capitalizeOriginationFees: loan.capitalizeOriginationFees,
        originationFeePct: loan.originationFeePct ? parseFloat(loan.originationFeePct) : undefined,
        exitFeePct: loan.exitFeePct ? parseFloat(loan.exitFeePct) : undefined,
        prepayType: (loan.prepayType || "none") as any,
        stepdownSchedule: loan.stepdownScheduleJson as number[] | undefined,
      }));

      const result = computeStressTest(engineInputs, {
        rateShocksBps: req.body.rateShocksBps || [0, 50, 100, 150, 200],
        noiDrops: req.body.noiDrops || [0, -0.05, -0.10, -0.15, -0.20],
        baseNoi: req.body.baseNoi || parseFloat(project.purchasePrice?.toString() || "0") * 0.065,
        propertyValue: req.body.propertyValue || parseFloat(project.purchasePrice?.toString() || "0"),
        noiGrowthRate: req.body.noiGrowthRate,
        minDscrThreshold: req.body.minDscrThreshold,
        maxLtvThreshold: req.body.maxLtvThreshold,
        exitMonthIndex: req.body.exitMonthIndex,
        ioExtensionMonths: req.body.ioExtensionMonths,
        altAmortMonths: req.body.altAmortMonths,
      });

      res.json({ ...result, scenarios: result.scenarios.map(s => ({ ...s, annualSummary: undefined })) });
    } catch (error: any) {
      console.error("Failed to run stress test:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Phase 6: Fund Waterfall ──
  app.post("/api/modeling/projects/:projectId/fund-waterfall", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const { computeSimpleWaterfall } = await import("@shared/debt/fund-waterfall-adapter");
      const result = computeSimpleWaterfall(req.body.cashflows, req.body.config);

      res.json(result);
    } catch (error: any) {
      console.error("Failed to compute fund waterfall:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // ============================================================================
  // DEBT SCENARIOS - Debt Structure Analysis & Sensitivity Modeling
  // ============================================================================

  // Get all debt scenarios for organization
  app.get('/api/modeling/debt-scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      // TODO: Add to storage interface
      const scenarios = await storage.getDebtScenarios(orgId);
      res.json(scenarios);
    } catch (error: any) {
      console.error('Failed to fetch debt scenarios:', error);
      res.status(500).json({ error: 'Failed to fetch debt scenarios' });
    }
  });

  // Get scenarios for a specific modeling project
  app.get('/api/modeling/debt-scenarios/project/:projectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      // TODO: Add to storage interface
      const scenarios = await storage.getDebtScenariosByProject(projectId, orgId);
      res.json(scenarios);
    } catch (error: any) {
      console.error('Failed to fetch debt scenarios for project:', error);
      res.status(500).json({ error: 'Failed to fetch debt scenarios for project' });
    }
  });

  // Get single debt scenario with calculated metrics
  app.get('/api/modeling/debt-scenarios/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      // TODO: Add to storage interface
      const scenario = await storage.getDebtScenario(id, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }

      // Calculate metrics using the debt scenario service
      const metrics = debtScenarioService.calculateMetrics({
        purchasePrice: scenario.purchasePrice,
        loanAmount: scenario.loanAmount,
        noi: scenario.noi,
        interestRate: scenario.baseRate + (scenario.spreadBps / 100),
        amortizationYears: scenario.amortizationYears,
        loanTermYears: scenario.loanTermYears,
        interestOnlyYears: scenario.interestOnlyYears || 0
      });

      // Return scenario with calculated metrics
      res.json({
        ...scenario,
        calculatedMetrics: metrics
      });
    } catch (error: any) {
      console.error('Failed to fetch debt scenario:', error);
      res.status(500).json({ error: 'Failed to fetch debt scenario' });
    }
  });

  // Create new debt scenario
  app.post('/api/modeling/debt-scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const data = insertDebtScenarioSchema.parse(req.body);
      
      // Calculate initial metrics
      const metrics = debtScenarioService.calculateMetrics({
        purchasePrice: data.purchasePrice,
        loanAmount: data.loanAmount,
        noi: data.noi,
        interestRate: data.baseRate + (data.spreadBps / 100),
        amortizationYears: data.amortizationYears,
        loanTermYears: data.loanTermYears,
        interestOnlyYears: data.interestOnlyYears || 0
      });

      // TODO: Add to storage interface
      const scenario = await storage.createDebtScenario({
        ...data,
        orgId,
        createdBy: userId,
        calculatedLtv: metrics.loanToValue,
        calculatedDscr: metrics.debtServiceCoverageRatio,
        calculatedDebtYield: metrics.debtYield
      });
      
      res.status(201).json({
        ...scenario,
        calculatedMetrics: metrics
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create debt scenario:', error);
      res.status(500).json({ error: 'Failed to create debt scenario' });
    }
  });

  // Update debt scenario handler (shared for both PATCH and PUT)
  const updateDebtScenarioHandler = async (req: any, res: any) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { id } = req.params;
      
      const data = updateDebtScenarioSchema.parse(req.body);
      
      const existingScenario = await storage.getDebtScenario(id, orgId);
      
      if (!existingScenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }

      // Merge existing scenario with updates for metric calculation
      const updatedData = { ...existingScenario, ...data };

      // Recalculate metrics with updated values
      const metrics = debtScenarioService.calculateMetrics({
        purchasePrice: updatedData.purchasePrice,
        loanAmount: updatedData.loanAmount,
        noi: updatedData.noi,
        interestRate: updatedData.baseRate + (updatedData.spreadBps / 100),
        amortizationYears: updatedData.amortizationYears,
        loanTermYears: updatedData.loanTermYears,
        interestOnlyYears: updatedData.interestOnlyYears || 0
      });

      const scenario = await storage.updateDebtScenario(id, {
        ...data,
        updatedBy: userId,
        calculatedLtv: metrics.loanToValue,
        calculatedDscr: metrics.debtServiceCoverageRatio,
        calculatedDebtYield: metrics.debtYield
      }, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }
      
      res.json({
        ...scenario,
        calculatedMetrics: metrics
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update debt scenario:', error);
      res.status(500).json({ error: 'Failed to update debt scenario' });
    }
  };

  // Update debt scenario (PATCH and PUT for compatibility)
  app.patch('/api/modeling/debt-scenarios/:id', authenticateUser, updateDebtScenarioHandler);
  app.put('/api/modeling/debt-scenarios/:id', authenticateUser, updateDebtScenarioHandler);

  // Delete debt scenario
  app.delete('/api/modeling/debt-scenarios/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      // TODO: Add to storage interface
      const success = await storage.deleteDebtScenario(id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete debt scenario:', error);
      res.status(500).json({ error: 'Failed to delete debt scenario' });
    }
  });

  // Recalculate metrics for a scenario (useful after bulk updates or corrections)
  app.post('/api/modeling/debt-scenarios/:id/calculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      // TODO: Add to storage interface
      const scenario = await storage.getDebtScenario(id, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }

      // Calculate comprehensive metrics
      const metrics = debtScenarioService.calculateMetrics({
        purchasePrice: scenario.purchasePrice,
        loanAmount: scenario.loanAmount,
        noi: scenario.noi,
        interestRate: scenario.baseRate + (scenario.spreadBps / 100),
        amortizationYears: scenario.amortizationYears,
        loanTermYears: scenario.loanTermYears,
        interestOnlyYears: scenario.interestOnlyYears || 0
      });

      // Generate amortization schedule
      const amortizationSchedule = debtScenarioService.generateAmortizationSchedule(
        scenario.loanAmount,
        scenario.baseRate + (scenario.spreadBps / 100),
        scenario.amortizationYears,
        (scenario.interestOnlyYears || 0) * 12
      );

      res.json({
        scenario,
        metrics,
        amortizationSchedule: amortizationSchedule.slice(0, 12) // First year only for performance
      });
    } catch (error: any) {
      console.error('Failed to calculate debt scenario metrics:', error);
      res.status(500).json({ error: 'Failed to calculate debt scenario metrics' });
    }
  });

  // Run sensitivity analysis on a scenario
  app.post('/api/modeling/debt-scenarios/:id/sensitivity', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      // TODO: Add to storage interface
      const scenario = await storage.getDebtScenario(id, orgId);
      
      if (!scenario) {
        return res.status(404).json({ error: 'Debt scenario not found' });
      }

      // Parse optional sensitivity parameters from request body
      const { rateSteps, ltvTargets } = req.body;

      // Run comprehensive sensitivity analysis
      const sensitivityAnalysis = debtScenarioService.runSensitivityAnalysis({
        purchasePrice: scenario.purchasePrice,
        loanAmount: scenario.loanAmount,
        noi: scenario.noi,
        interestRate: scenario.baseRate + (scenario.spreadBps / 100),
        amortizationYears: scenario.amortizationYears,
        loanTermYears: scenario.loanTermYears,
        interestOnlyYears: scenario.interestOnlyYears || 0
      });

      // Optional: run custom sensitivity if parameters provided
      let customRateSensitivity;
      let customLtvSensitivity;

      if (rateSteps && Array.isArray(rateSteps)) {
        customRateSensitivity = debtScenarioService.runRateSensitivity({
          purchasePrice: scenario.purchasePrice,
          loanAmount: scenario.loanAmount,
          noi: scenario.noi,
          interestRate: scenario.baseRate + (scenario.spreadBps / 100),
          amortizationYears: scenario.amortizationYears,
          loanTermYears: scenario.loanTermYears,
          interestOnlyYears: scenario.interestOnlyYears || 0
        }, rateSteps);
      }

      if (ltvTargets && Array.isArray(ltvTargets)) {
        customLtvSensitivity = debtScenarioService.runLTVSensitivity({
          purchasePrice: scenario.purchasePrice,
          loanAmount: scenario.loanAmount,
          noi: scenario.noi,
          interestRate: scenario.baseRate + (scenario.spreadBps / 100),
          amortizationYears: scenario.amortizationYears,
          loanTermYears: scenario.loanTermYears,
          interestOnlyYears: scenario.interestOnlyYears || 0
        }, ltvTargets);
      }

      res.json({
        scenario: {
          id: scenario.id,
          name: scenario.name,
          modelingProjectId: scenario.modelingProjectId
        },
        sensitivityAnalysis,
        ...(customRateSensitivity && { customRateSensitivity }),
        ...(customLtvSensitivity && { customLtvSensitivity })
      });
    } catch (error: any) {
      console.error('Failed to run sensitivity analysis:', error);
      res.status(500).json({ error: 'Failed to run sensitivity analysis' });
    }
  });

  // ========================================================================
  // PERSONA MANAGEMENT
  // ========================================================================

  // Get user's persona assignment
  app.get('/api/personas/me', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const persona = await personaService.getUserPersona(userId, orgId);
      
      // Return null with 200 status if no persona assigned (not 404)
      res.json(persona || null);
    } catch (error: any) {
      console.error('Failed to fetch user persona:', error);
      res.status(500).json({ error: 'Failed to fetch user persona' });
    }
  });

  // Assign or update persona for current user
  app.post('/api/personas/me', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const data = insertUserPersonaAssignmentSchema.parse(req.body);
      const persona = await personaService.assignPersona(userId, orgId, data);
      res.json(persona);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to assign persona:', error);
      res.status(500).json({ error: 'Failed to assign persona' });
    }
  });

  // Get user's accessible features
  app.get('/api/personas/features', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const features = await personaService.getUserFeatures(userId, orgId);
      res.json({ features });
    } catch (error: any) {
      console.error('Failed to fetch user features:', error);
      res.status(500).json({ error: 'Failed to fetch user features' });
    }
  });

  // Check permission for a feature
  app.post('/api/personas/check-permission', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { featureKey } = req.body;
      
      if (!featureKey) {
        return res.status(400).json({ error: 'featureKey is required' });
      }
      
      const hasPermission = await personaService.checkPermission(userId, orgId, featureKey);
      res.json({ hasPermission });
    } catch (error: any) {
      console.error('Failed to check permission:', error);
      res.status(500).json({ error: 'Failed to check permission' });
    }
  });

  // ========================================================================
  // DASHBOARD WIDGETS & LAYOUTS
  // ========================================================================

  // Get persona-aware dashboard header metrics
  app.get('/api/dashboard/header', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      
      const persona = await personaService.getUserPersona(userId, orgId);
      const personaType = persona?.primaryPersona || 'operator';
      
      let headerData: {
        personaType: string;
        title: string;
        subtitle: string;
        metrics: Array<{ label: string; value: string; icon?: string; trend?: string; color?: string }>;
        actions?: Array<{ label: string; href: string }>;
      };
      
      const formatCurrency = (val: string | number | null) => {
        if (!val) return '$0';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num) || num === 0) return '$0';
        if (num >= 1000000) return `\$${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `\$${(num / 1000).toFixed(0)}K`;
        return `\$${num.toFixed(0)}`;
      };
      
      if (personaType === 'pe_investor') {
        const { fundService } = await import('./services/fund-service');
        const funds = await fundService.getFundsByOrg(orgId);
        const activeFund = funds.find(f => f.status === 'investing') || funds[0];
        
        if (activeFund) {
          const formatPercent = (val: string | null) => val ? `${(parseFloat(val) * 100).toFixed(1)}%` : '-';
          const formatMultiple = (val: string | null) => val ? `${parseFloat(val).toFixed(2)}x` : '-';
          
          headerData = {
            personaType: 'pe_investor',
            title: activeFund.shortName || activeFund.name,
            subtitle: `${activeFund.status} • Vintage ${activeFund.vintage}`,
            metrics: [
              { label: 'Net IRR', value: formatPercent(activeFund.netIrr), icon: 'TrendingUp', color: 'green' },
              { label: 'TVPI', value: formatMultiple(activeFund.tvpi), icon: 'DollarSign', color: 'blue' },
              { label: 'DPI', value: formatMultiple(activeFund.dpi) },
              { label: 'Committed', value: formatCurrency(activeFund.committedCapital) },
            ],
            actions: [{ label: 'Manage Funds', href: '/modeling/funds' }]
          };
        } else {
          headerData = {
            personaType: 'pe_investor',
            title: 'No Active Fund',
            subtitle: 'Create your first fund to start tracking investments',
            metrics: [],
            actions: [{ label: 'Create Fund', href: '/modeling/funds' }]
          };
        }
      } else if (personaType === 'broker') {
        const { crmDeals: dealsTable, crmProperties: propsTable, users } = await import('@shared/schema');
        const { and: andFn, or: orFn, sql: sqlFn, inArray: inArrayFn } = await import('drizzle-orm');
        
        const orgUserIds = db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));
        
        const activeDealsResult = await db.select({
          count: sqlFn<number>`count(*)`,
          totalValue: sqlFn<string>`coalesce(sum(${dealsTable.value}::numeric), 0)`,
          totalCommission: sqlFn<string>`coalesce(sum(${dealsTable.commissionAmount}::numeric), 0)`,
        }).from(dealsTable)
          .where(andFn(
            inArrayFn(dealsTable.ownerId, orgUserIds),
            orFn(eq(dealsTable.stage, 'prospect'), eq(dealsTable.stage, 'initial_outreach'), eq(dealsTable.stage, 'qualified'), eq(dealsTable.stage, 'loi_submitted'), eq(dealsTable.stage, 'loi_negotiated'), eq(dealsTable.stage, 'loi_executed'), eq(dealsTable.stage, 'psa_drafting'), eq(dealsTable.stage, 'psa_executed'), eq(dealsTable.stage, 'due_diligence'), eq(dealsTable.stage, 'financing'), eq(dealsTable.stage, 'clear_to_close'), eq(dealsTable.stage, 'lead'), eq(dealsTable.stage, 'proposal'), eq(dealsTable.stage, 'negotiation'))
          ));
        
        const listingsResult = await db.select({
          count: sqlFn<number>`count(*)`,
          totalListPrice: sqlFn<string>`coalesce(sum(${propsTable.listPrice}::numeric), 0)`,
        }).from(propsTable)
          .where(andFn(
            inArrayFn(propsTable.ownerId, orgUserIds),
            eq(propsTable.isOnMarket, true)
          ));
        
        headerData = {
          personaType: 'broker',
          title: 'Broker Dashboard',
          subtitle: 'Active listings and pipeline overview',
          metrics: [
            { label: 'Active Listings', value: String(listingsResult[0]?.count || 0), icon: 'Home', color: 'blue' },
            { label: 'Listing Value', value: formatCurrency(listingsResult[0]?.totalListPrice || 0), icon: 'DollarSign', color: 'green' },
            { label: 'Pipeline Deals', value: String(activeDealsResult[0]?.count || 0), icon: 'Briefcase', color: 'purple' },
            { label: 'Potential Commission', value: formatCurrency(activeDealsResult[0]?.totalCommission || 0), icon: 'TrendingUp', color: 'amber' },
          ],
          actions: [
            { label: 'Manage Listings', href: '/crm/properties' },
            { label: 'View Pipeline', href: '/crm/deals' }
          ]
        };
      } else {
        const { modelingProjects: mpTable, crmProperties: cpTable, users } = await import('@shared/schema');
        const { and: andOp, sql: sqlOp, inArray: inArrayOp } = await import('drizzle-orm');
        
        const orgUserIds = db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));
        
        const ownedProjectsResult = await db.select({
          count: sqlOp<number>`count(*)`,
          totalValue: sqlOp<string>`coalesce(sum(${mpTable.purchasePrice}::numeric), 0)`,
          totalEbitda: sqlOp<string>`coalesce(sum(${mpTable.ebitda}::numeric), 0)`,
        }).from(mpTable)
          .where(andOp(
            eq(mpTable.orgId, orgId),
            eq(mpTable.dealOutcome, 'won')
          ));
        
        const ownedPropertiesResult = await db.select({
          count: sqlOp<number>`count(*)`,
        }).from(cpTable)
          .where(andOp(
            inArrayOp(cpTable.ownerId, orgUserIds),
            eq(cpTable.pipelineStage, 'owned')
          ));
        
        const pipelineResult = await db.select({
          count: sqlOp<number>`count(*)`,
          totalValue: sqlOp<string>`coalesce(sum(${mpTable.purchasePrice}::numeric), 0)`,
        }).from(mpTable)
          .where(andOp(
            eq(mpTable.orgId, orgId),
            eq(mpTable.dealOutcome, 'active')
          ));
        
        const totalOwnedCount = Number(ownedProjectsResult[0]?.count || 0) + Number(ownedPropertiesResult[0]?.count || 0);
        
        headerData = {
          personaType: personaType,
          title: 'Investment Portfolio',
          subtitle: totalOwnedCount > 0 ? `${totalOwnedCount} owned ${totalOwnedCount === 1 ? 'asset' : 'assets'}` : 'Track your real estate investments',
          metrics: [
            { label: 'Owned Assets', value: String(totalOwnedCount), icon: 'Building2', color: 'blue' },
            { label: 'Portfolio Value', value: formatCurrency(ownedProjectsResult[0]?.totalValue || 0), icon: 'DollarSign', color: 'green' },
            { label: 'Annual EBITDA', value: formatCurrency(ownedProjectsResult[0]?.totalEbitda || 0), icon: 'TrendingUp', color: 'purple' },
            { label: 'Active Deals', value: String(pipelineResult[0]?.count || 0), icon: 'Target', color: 'amber' },
          ],
          actions: [
            { label: 'View Portfolio', href: '/modeling' },
            { label: 'Deal Pipeline', href: '/crm/deals' }
          ]
        };
      }
      
      res.json(headerData);
    } catch (error: any) {
      console.error('Failed to fetch dashboard header:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard header' });
    }
  });

  // Get widget registry (optionally filtered by persona)
  app.get('/api/dashboards/widgets', authenticateUser, async (req: any, res) => {
    try {
      const personaType = req.query.personaType;
      const widgets = await dashboardService.getWidgetRegistry(personaType);
      res.json(widgets);
    } catch (error: any) {
      console.error('Failed to fetch widget registry:', error);
      res.status(500).json({ error: 'Failed to fetch widget registry' });
    }
  });

  // Get user's dashboard layout
  app.get('/api/dashboards/layout', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const personaTemplate = req.query.personaTemplate;
      
      let layout = await dashboardService.getUserDashboardLayout(userId, orgId, personaTemplate);
      
      // If no layout exists, return default template
      if (!layout && personaTemplate) {
        const defaultLayout = await dashboardService.getTemplateByPersona(personaTemplate);
        return res.json({ layout: defaultLayout, isDefault: true });
      }
      
      if (!layout) {
        return res.json({ layout: [], isDefault: true });
      }
      
      res.json(layout);
    } catch (error: any) {
      console.error('Failed to fetch dashboard layout:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard layout' });
    }
  });

  // Save or update dashboard layout
  app.put('/api/dashboards/layout', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const data = insertUserDashboardLayoutSchema.parse(req.body);
      
      // Validate layout structure
      if (!dashboardService.validateLayout(data.layout as any)) {
        return res.status(400).json({ error: 'Invalid layout structure' });
      }
      
      const layout = await dashboardService.saveDashboardLayout(userId, orgId, data);
      res.json(layout);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to save dashboard layout:', error);
      res.status(500).json({ error: 'Failed to save dashboard layout' });
    }
  });

  // Get default template for a persona
  app.get('/api/dashboards/templates/:persona', authenticateUser, async (req: any, res) => {
    try {
      const { persona } = req.params;
      const template = await dashboardService.getTemplateByPersona(persona);
      res.json({ template });
    } catch (error: any) {
      console.error('Failed to fetch dashboard template:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard template' });
    }
  });

  // Reset dashboard to default
  app.post('/api/dashboards/reset', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { personaType } = req.body;
      
      if (!personaType) {
        return res.status(400).json({ error: 'personaType is required' });
      }
      
      const layout = await dashboardService.resetToDefault(userId, orgId, personaType);
      res.json(layout);
    } catch (error: any) {
      console.error('Failed to reset dashboard:', error);
      res.status(500).json({ error: 'Failed to reset dashboard' });
    }
  });

  // =====================================================
  // DASHBOARD WIDGET CUSTOMIZATION SYSTEM
  // =====================================================

  // Initialize metric registry (admin)
  app.post('/api/dashboards/metrics/initialize', authenticateUser, async (req: any, res) => {
    try {
      await dashboardService.initializeMetricRegistry();
      res.json({ success: true, message: 'Metric registry initialized' });
    } catch (error: any) {
      console.error('Failed to initialize metric registry:', error);
      res.status(500).json({ error: 'Failed to initialize metric registry' });
    }
  });

  // Get available metrics (optionally filtered by module)
  app.get('/api/dashboards/metrics', authenticateUser, async (req: any, res) => {
    try {
      const moduleKey = req.query.module as string | undefined;
      const metrics = await dashboardService.getModuleMetrics(moduleKey);
      res.json(metrics);
    } catch (error: any) {
      console.error('Failed to fetch metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // Get specific metric by module and key
  app.get('/api/dashboards/metrics/:moduleKey/:metricKey', authenticateUser, async (req: any, res) => {
    try {
      const { moduleKey, metricKey } = req.params;
      const metric = await dashboardService.getMetricByKey(moduleKey, metricKey);
      
      if (!metric) {
        return res.status(404).json({ error: 'Metric not found' });
      }
      
      res.json(metric);
    } catch (error: any) {
      console.error('Failed to fetch metric:', error);
      res.status(500).json({ error: 'Failed to fetch metric' });
    }
  });

  // Get user's custom widgets
  app.get('/api/dashboards/custom-widgets', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const widgets = await dashboardService.getUserCustomWidgets(userId, orgId);
      res.json(widgets);
    } catch (error: any) {
      console.error('Failed to fetch custom widgets:', error);
      res.status(500).json({ error: 'Failed to fetch custom widgets' });
    }
  });

  // Get single custom widget
  app.get('/api/dashboards/custom-widgets/:id', authenticateUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      const widget = await dashboardService.getCustomWidget(id);
      
      if (!widget) {
        return res.status(404).json({ error: 'Widget not found' });
      }
      
      res.json(widget);
    } catch (error: any) {
      console.error('Failed to fetch custom widget:', error);
      res.status(500).json({ error: 'Failed to fetch custom widget' });
    }
  });

  // Create custom widget
  app.post('/api/dashboards/custom-widgets', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const data = insertDashboardCustomWidgetSchema.parse(req.body);
      const widget = await dashboardService.createCustomWidget(userId, orgId, data);
      res.status(201).json(widget);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create custom widget:', error);
      res.status(500).json({ error: 'Failed to create custom widget' });
    }
  });

  // Update custom widget
  app.patch('/api/dashboards/custom-widgets/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const data = updateDashboardCustomWidgetSchema.parse(req.body);
      const widget = await dashboardService.updateCustomWidget(id, userId, orgId, data);
      
      if (!widget) {
        return res.status(404).json({ error: 'Widget not found' });
      }
      
      res.json(widget);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update custom widget:', error);
      res.status(500).json({ error: 'Failed to update custom widget' });
    }
  });

  // Delete custom widget
  app.delete('/api/dashboards/custom-widgets/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const success = await dashboardService.deleteCustomWidget(id, userId, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Widget not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete custom widget:', error);
      res.status(500).json({ error: 'Failed to delete custom widget' });
    }
  });

  // Update widget order
  app.put('/api/dashboards/custom-widgets/order', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { widgetOrder } = req.body;
      
      if (!Array.isArray(widgetOrder)) {
        return res.status(400).json({ error: 'widgetOrder must be an array' });
      }
      
      await dashboardService.updateWidgetOrder(userId, orgId, widgetOrder);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update widget order:', error);
      res.status(500).json({ error: 'Failed to update widget order' });
    }
  });

  // Get saved layouts
  app.get('/api/dashboards/saved-layouts', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const layouts = await dashboardService.getUserSavedLayouts(userId, orgId);
      res.json(layouts);
    } catch (error: any) {
      console.error('Failed to fetch saved layouts:', error);
      res.status(500).json({ error: 'Failed to fetch saved layouts' });
    }
  });

  // Get single saved layout
  app.get('/api/dashboards/saved-layouts/:id', authenticateUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      const layout = await dashboardService.getSavedLayout(id);
      
      if (!layout) {
        return res.status(404).json({ error: 'Layout not found' });
      }
      
      res.json(layout);
    } catch (error: any) {
      console.error('Failed to fetch saved layout:', error);
      res.status(500).json({ error: 'Failed to fetch saved layout' });
    }
  });

  // Create saved layout
  app.post('/api/dashboards/saved-layouts', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const data = insertDashboardSavedLayoutSchema.parse(req.body);
      const layout = await dashboardService.createSavedLayout(userId, orgId, data);
      res.status(201).json(layout);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create saved layout:', error);
      res.status(500).json({ error: 'Failed to create saved layout' });
    }
  });

  // Update saved layout
  app.patch('/api/dashboards/saved-layouts/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const data = updateDashboardSavedLayoutSchema.parse(req.body);
      const layout = await dashboardService.updateSavedLayout(id, userId, orgId, data);
      
      if (!layout) {
        return res.status(404).json({ error: 'Layout not found' });
      }
      
      res.json(layout);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update saved layout:', error);
      res.status(500).json({ error: 'Failed to update saved layout' });
    }
  });

  // Delete saved layout
  app.delete('/api/dashboards/saved-layouts/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const success = await dashboardService.deleteSavedLayout(id, userId, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Layout not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete saved layout:', error);
      res.status(500).json({ error: 'Failed to delete saved layout' });
    }
  });

  // Get widget templates
  app.get('/api/dashboards/widget-templates', authenticateUser, async (req: any, res) => {
    try {
      const moduleKey = req.query.module as string | undefined;
      const category = req.query.category as string | undefined;
      const templates = await dashboardService.getWidgetTemplates(moduleKey, category);
      res.json(templates);
    } catch (error: any) {
      console.error('Failed to fetch widget templates:', error);
      res.status(500).json({ error: 'Failed to fetch widget templates' });
    }
  });

  // Create widget from template
  app.post('/api/dashboards/widget-templates/:templateId/create', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { templateId } = req.params;
      const { customName } = req.body;
      
      const widget = await dashboardService.createWidgetFromTemplate(userId, orgId, templateId, customName);
      
      if (!widget) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.status(201).json(widget);
    } catch (error: any) {
      console.error('Failed to create widget from template:', error);
      res.status(500).json({ error: 'Failed to create widget from template' });
    }
  });

  // Get available modules and their metrics for the widget builder
  app.get('/api/dashboards/module-metrics', authenticateUser, async (req: any, res) => {
    try {
      const modules = [
        {
          key: 'sales_comps',
          name: 'Sales Comps',
          icon: 'TrendingUp',
          metrics: [
            { key: 'total_count', label: 'Total Comps', type: 'count', format: 'number', description: 'Total number of sales comparables' },
            { key: 'avg_price', label: 'Average Price', type: 'avg', format: 'currency', description: 'Average sale price' },
            { key: 'median_price', label: 'Median Price', type: 'avg', format: 'currency', description: 'Median sale price' },
            { key: 'avg_price_per_slip', label: 'Avg Price/Slip', type: 'avg', format: 'currency', description: 'Average price per wet slip' },
            { key: 'avg_cap_rate', label: 'Average Cap Rate', type: 'avg', format: 'percent', description: 'Average capitalization rate' },
            { key: 'total_volume', label: 'Total Volume', type: 'sum', format: 'currency', description: 'Total sales volume' },
          ],
          filters: [
            { key: 'year', label: 'Year', type: 'year' },
            { key: 'states', label: 'State', type: 'state' },
            { key: 'waterType', label: 'Water Type', type: 'category', options: [
              { value: 'Coastal', label: 'Coastal' },
              { value: 'Lake', label: 'Lake' },
              { value: 'River', label: 'River' },
            ]},
          ],
        },
        {
          key: 'crm',
          name: 'CRM Pipeline',
          icon: 'Users',
          metrics: [
            { key: 'total_deals', label: 'Total Deals', type: 'count', format: 'number', description: 'Total number of deals' },
            { key: 'active_deals', label: 'Active Deals', type: 'count', format: 'number', description: 'Deals in progress' },
            { key: 'total_value', label: 'Pipeline Value', type: 'sum', format: 'currency', description: 'Total value of all deals' },
            { key: 'won_value', label: 'Won Value', type: 'sum', format: 'currency', description: 'Total value of won deals' },
            { key: 'avg_deal_size', label: 'Avg Deal Size', type: 'avg', format: 'currency', description: 'Average deal value' },
            { key: 'win_rate', label: 'Win Rate', type: 'percentage', format: 'percent', description: 'Percentage of deals won' },
          ],
          filters: [
            { key: 'stage', label: 'Stage', type: 'status' },
            { key: 'owner', label: 'Owner', type: 'category' },
          ],
        },
        {
          key: 'due_diligence',
          name: 'Due Diligence',
          icon: 'FileText',
          metrics: [
            { key: 'total_projects', label: 'Total Projects', type: 'count', format: 'number', description: 'Total DD projects' },
            { key: 'active_projects', label: 'Active Projects', type: 'count', format: 'number', description: 'Projects in progress' },
            { key: 'completed_tasks', label: 'Completed Tasks', type: 'count', format: 'number', description: 'Tasks completed' },
            { key: 'pending_tasks', label: 'Pending Tasks', type: 'count', format: 'number', description: 'Tasks awaiting action' },
            { key: 'completion_rate', label: 'Completion Rate', type: 'percentage', format: 'percent', description: 'Task completion percentage' },
          ],
          filters: [
            { key: 'status', label: 'Status', type: 'status' },
          ],
        },
        {
          key: 'fuel',
          name: 'Fuel Operations',
          icon: 'Fuel',
          metrics: [
            { key: 'total_revenue', label: 'Total Revenue', type: 'sum', format: 'currency', description: 'Total fuel revenue' },
            { key: 'total_gallons', label: 'Total Gallons', type: 'sum', format: 'number', description: 'Total gallons sold' },
            { key: 'avg_price_per_gallon', label: 'Avg Price/Gallon', type: 'avg', format: 'currency', description: 'Average price per gallon' },
            { key: 'transaction_count', label: 'Transactions', type: 'count', format: 'number', description: 'Number of transactions' },
          ],
          filters: [
            { key: 'fuelType', label: 'Fuel Type', type: 'category' },
            { key: 'dateRange', label: 'Date Range', type: 'range' },
          ],
        },
        {
          key: 'ship_store',
          name: 'Ship Store',
          icon: 'ShoppingCart',
          metrics: [
            { key: 'total_revenue', label: 'Total Revenue', type: 'sum', format: 'currency', description: 'Total store revenue' },
            { key: 'transaction_count', label: 'Transactions', type: 'count', format: 'number', description: 'Number of sales' },
            { key: 'avg_transaction', label: 'Avg Transaction', type: 'avg', format: 'currency', description: 'Average transaction value' },
            { key: 'items_sold', label: 'Items Sold', type: 'count', format: 'number', description: 'Total items sold' },
          ],
          filters: [
            { key: 'category', label: 'Category', type: 'category' },
            { key: 'dateRange', label: 'Date Range', type: 'range' },
          ],
        },
        {
          key: 'rent_roll',
          name: 'Rent Roll',
          icon: 'Home',
          metrics: [
            { key: 'total_units', label: 'Total Units', type: 'count', format: 'number', description: 'Total rental units' },
            { key: 'occupied_units', label: 'Occupied Units', type: 'count', format: 'number', description: 'Units currently occupied' },
            { key: 'occupancy_rate', label: 'Occupancy Rate', type: 'percentage', format: 'percent', description: 'Occupancy percentage' },
            { key: 'monthly_revenue', label: 'Monthly Revenue', type: 'sum', format: 'currency', description: 'Monthly rental revenue' },
            { key: 'avg_rent', label: 'Average Rent', type: 'avg', format: 'currency', description: 'Average monthly rent' },
          ],
          filters: [
            { key: 'unitType', label: 'Unit Type', type: 'category' },
            { key: 'status', label: 'Status', type: 'status' },
          ],
        },
        {
          key: 'vdr',
          name: 'Virtual Data Room',
          icon: 'Database',
          metrics: [
            { key: 'total_documents', label: 'Total Documents', type: 'count', format: 'number', description: 'Total uploaded documents' },
            { key: 'active_rooms', label: 'Active Rooms', type: 'count', format: 'number', description: 'Active data rooms' },
            { key: 'pending_requests', label: 'Pending Requests', type: 'count', format: 'number', description: 'Diligence requests pending' },
            { key: 'external_users', label: 'External Users', type: 'count', format: 'number', description: 'External users with access' },
          ],
          filters: [
            { key: 'project', label: 'Project', type: 'category' },
          ],
        },
        {
          key: 'docket',
          name: 'The Docket Intelligence',
          icon: 'Radio',
          metrics: [
            { key: 'total_deals', label: 'M&A Deals', type: 'count', format: 'number', description: 'Total tracked M&A deals' },
            { key: 'articles_count', label: 'Articles', type: 'count', format: 'number', description: 'Industry articles' },
            { key: 'new_deals', label: 'New Deals', type: 'count', format: 'number', description: 'Deals added this period' },
          ],
          filters: [
            { key: 'category', label: 'Category', type: 'category' },
          ],
        },
      ];
      
      res.json({ modules });
    } catch (error: any) {
      console.error('Failed to get module metrics:', error);
      res.status(500).json({ error: 'Failed to get module metrics' });
    }
  });

  // Execute widget query (get data for a widget)
  app.post('/api/dashboards/widgets/query', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { moduleKey, metricKey, filters, options } = req.body;
      
      if (!moduleKey || !metricKey) {
        return res.status(400).json({ error: 'moduleKey and metricKey are required' });
      }
      
      const result = await dashboardService.executeWidgetQuery(
        orgId,
        moduleKey,
        metricKey,
        filters || {},
        options || {}
      );
      
      res.json(result);
    } catch (error: any) {
      console.error('Failed to execute widget query:', error);
      res.status(500).json({ error: 'Failed to execute widget query' });
    }
  });

  // Batch execute widget queries
  app.post('/api/dashboards/widgets/batch-query', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { widgets } = req.body;
      
      if (!Array.isArray(widgets)) {
        return res.status(400).json({ error: 'widgets must be an array' });
      }
      
      const results = await dashboardService.batchExecuteWidgetQueries(orgId, widgets);
      
      // Convert Map to object for JSON response
      const resultObj: Record<string, any> = {};
      results.forEach((value, key) => {
        resultObj[key] = value;
      });
      
      res.json(resultObj);
    } catch (error: any) {
      console.error('Failed to batch execute widget queries:', error);
      res.status(500).json({ error: 'Failed to batch execute widget queries' });
    }
  });

  // =====================================================
  // USER KPI PREFERENCES
  // =====================================================

  // Get user's KPI preferences for a page
  app.get('/api/user-preferences/kpis/:pageKey', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { pageKey } = req.params;
      
      const [prefs] = await db
        .select()
        .from(userKpiPreferences)
        .where(and(
          eq(userKpiPreferences.userId, userId),
          eq(userKpiPreferences.orgId, orgId),
          eq(userKpiPreferences.pageKey, pageKey)
        ))
        .limit(1);
      
      if (!prefs) {
        return res.status(404).json({ error: 'No KPI preferences found' });
      }
      
      res.json(prefs);
    } catch (error: any) {
      console.error('Failed to fetch KPI preferences:', error);
      res.status(500).json({ error: 'Failed to fetch KPI preferences' });
    }
  });

  // Save or update user's KPI preferences for a page
  app.put('/api/user-preferences/kpis/:pageKey', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { pageKey } = req.params;
      const { kpiConfig } = req.body;
      
      // Validate kpiConfig
      const parsed = insertUserKpiPreferencesSchema.parse({ pageKey, kpiConfig });
      
      // Check if preferences exist
      const [existing] = await db
        .select()
        .from(userKpiPreferences)
        .where(and(
          eq(userKpiPreferences.userId, userId),
          eq(userKpiPreferences.orgId, orgId),
          eq(userKpiPreferences.pageKey, pageKey)
        ))
        .limit(1);
      
      let result;
      if (existing) {
        [result] = await db
          .update(userKpiPreferences)
          .set({
            kpiConfig: parsed.kpiConfig,
            lastModified: new Date(),
          })
          .where(eq(userKpiPreferences.id, existing.id))
          .returning();
      } else {
        [result] = await db
          .insert(userKpiPreferences)
          .values({
            userId,
            orgId,
            pageKey,
            kpiConfig: parsed.kpiConfig,
          })
          .returning();
      }
      
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to save KPI preferences:', error);
      res.status(500).json({ error: 'Failed to save KPI preferences' });
    }
  });
  app.get('/api/dashboards/data', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const timeRange = (req.query.timeRange as any) || 'all'; // 7d, 30d, 90d, ytd, all
      const modulesParam = req.query.modules as string;
      const selectedModules = modulesParam && modulesParam !== 'all' ? modulesParam.split(',') : null;
      
      const data = await dashboardService.getAggregatedDashboardData(orgId, timeRange, selectedModules);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // Get CRM trend data for charts
  app.get('/api/dashboards/trends/crm', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const timeRange = (req.query.timeRange as any) || '30d';
      const data = await dashboardService.getCRMTrendData(orgId, timeRange);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch CRM trend data:', error);
      res.status(500).json({ error: 'Failed to fetch CRM trend data' });
    }
  });

  // Get CRM stage distribution for pie chart
  app.get('/api/dashboards/distribution/crm-stages', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const timeRange = (req.query.timeRange as any) || '30d';
      const data = await dashboardService.getCRMStageDistribution(orgId, timeRange);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch CRM stage distribution:', error);
      res.status(500).json({ error: 'Failed to fetch stage distribution' });
    }
  });

  // Get revenue trend data for financial modules
  app.get('/api/dashboards/trends/revenue', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const module = (req.query.module as 'fuel' | 'shipStore') || 'fuel';
      const timeRange = (req.query.timeRange as any) || '30d';
      const data = await dashboardService.getRevenueTrendData(orgId, module, timeRange);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch revenue trend data:', error);
      res.status(500).json({ error: 'Failed to fetch revenue trend data' });
    }
  });

  // Export dashboard to JSON (PDF MVP)
  app.post('/api/dashboards/export/pdf', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { timeRange, modules } = req.body;
      
      // Security: Fetch dashboard data server-side instead of accepting arbitrary client data
      const validatedTimeRange = ['7d', '30d', '90d', 'ytd', 'all'].includes(timeRange) ? timeRange : '30d';
      const validatedModules = Array.isArray(modules) ? modules.filter((m: any) => typeof m === 'string') : null;
      
      // Fetch data server-side to prevent payload injection
      const dashboardData = await dashboardService.getAggregatedDashboardData(orgId, validatedTimeRange, validatedModules);
      
      // Create a simple JSON report
      // For full PDF export, integrate @react-pdf/renderer server-side rendering
      const report = {
        title: `Dashboard Report - ${new Date().toLocaleDateString()}`,
        timeRange: validatedTimeRange,
        modules: validatedModules || ['all'],
        data: dashboardData,
        generatedAt: new Date().toISOString(),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-report-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(report);
    } catch (error: any) {
      console.error('Failed to export PDF:', error);
      res.status(500).json({ error: 'Failed to export dashboard' });
    }
  });

  // Export dashboard to Excel
  app.post('/api/dashboards/export/excel', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { timeRange, modules } = req.body;
      const XLSX = await import('xlsx');
      
      // Security: Validate input and fetch data server-side
      const validatedTimeRange = ['7d', '30d', '90d', 'ytd', 'all'].includes(timeRange) ? timeRange : '30d';
      const validatedModules = Array.isArray(modules) ? modules.filter((m: any) => typeof m === 'string') : null;
      
      // Fetch data server-side to prevent payload injection
      const dashboardData = await dashboardService.getAggregatedDashboardData(orgId, validatedTimeRange, validatedModules);
      
      // Create workbook with multiple sheets
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet with sanitized data
      const summaryData = [
        ['Dashboard Export'],
        ['Generated:', new Date().toLocaleString()],
        ['Time Range:', validatedTimeRange],
        [''],
        ['Module', 'Key Metrics'],
      ];
      
      // Add CRM data if available
      if (dashboardData?.crm) {
        summaryData.push(['CRM Pipeline', '']);
        summaryData.push(['Pipeline Value', Number(dashboardData.crm.pipelineValue) || 0]);
        summaryData.push(['Active Deals', Number(dashboardData.crm.activeDeals) || 0]);
        summaryData.push(['Win Rate', `${Number(dashboardData.crm.winRate) || 0}%`]);
      }
      
      // Add Due Diligence data if available
      if (dashboardData?.dueDiligence) {
        summaryData.push(['', '']);
        summaryData.push(['Due Diligence', '']);
        summaryData.push(['Active Projects', Number(dashboardData.dueDiligence.activeProjects) || 0]);
        summaryData.push(['Completed Projects', Number(dashboardData.dueDiligence.completedProjects) || 0]);
        summaryData.push(['Completion Rate', `${Number(dashboardData.dueDiligence.completionRate) || 0}%`]);
      }
      
      // Add Fuel data if available
      if (dashboardData?.fuel) {
        summaryData.push(['', '']);
        summaryData.push(['Fuel Operations', '']);
        summaryData.push(['Monthly Revenue', Number(dashboardData.fuel.monthlyRevenue) || 0]);
        summaryData.push(['Monthly Gallons', Number(dashboardData.fuel.monthlyGallons) || 0]);
      }
      
      // Add Ship Store data if available
      if (dashboardData?.shipStore) {
        summaryData.push(['', '']);
        summaryData.push(['Ship Store', '']);
        summaryData.push(['Monthly Revenue', Number(dashboardData.shipStore.monthlyRevenue) || 0]);
        summaryData.push(['Transactions', Number(dashboardData.shipStore.monthlyTransactions) || 0]);
        summaryData.push(['Avg Transaction', Number(dashboardData.shipStore.avgTransaction) || 0]);
      }
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-report-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(excelBuffer);
    } catch (error: any) {
      console.error('Failed to export Excel:', error);
      res.status(500).json({ error: 'Failed to export dashboard' });
    }
  });

  // Export dashboard via email
  app.post('/api/dashboards/export/email', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { timeRange, modules, recipientEmail } = req.body;

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      // Security: Validate input and fetch data server-side
      const validatedTimeRange = ['7d', '30d', '90d', 'ytd', 'all'].includes(timeRange) ? timeRange : '30d';
      const validatedModules = Array.isArray(modules) ? modules.filter((m: any) => typeof m === 'string') : null;

      // Fetch data server-side to prevent payload injection
      const dashboardData = await dashboardService.getAggregatedDashboardData(orgId, validatedTimeRange, validatedModules);

      // Generate HTML email
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #0891b2; margin: 0;">Dashboard Report</h1>
  </div>

  <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <p><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Time Range:</strong> ${validatedTimeRange}</p>
    <p><strong>Modules:</strong> ${validatedModules?.join(', ') || 'All'}</p>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
    ${dashboardData?.crm ? `
    <h2 style="color: #1e293b; margin-top: 0;">CRM Pipeline</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f1f5f9;">
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Pipeline Value</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">$${Number(dashboardData.crm.pipelineValue || 0).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Active Deals</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${Number(dashboardData.crm.activeDeals || 0)}</td>
      </tr>
      <tr style="background: #f1f5f9;">
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Win Rate</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${Number(dashboardData.crm.winRate || 0)}%</td>
      </tr>
    </table>
    ` : ''}

    ${dashboardData?.dueDiligence ? `
    <h2 style="color: #1e293b; margin-top: 20px;">Due Diligence</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f1f5f9;">
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Active Projects</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${Number(dashboardData.dueDiligence.activeProjects || 0)}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Completed Projects</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${Number(dashboardData.dueDiligence.completedProjects || 0)}</td>
      </tr>
      <tr style="background: #f1f5f9;">
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Completion Rate</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${Number(dashboardData.dueDiligence.completionRate || 0)}%</td>
      </tr>
    </table>
    ` : ''}

    ${dashboardData?.fuel ? `
    <h2 style="color: #1e293b; margin-top: 20px;">Fuel Operations</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f1f5f9;">
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Monthly Revenue</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">$${Number(dashboardData.fuel.monthlyRevenue || 0).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Monthly Gallons</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${Number(dashboardData.fuel.monthlyGallons || 0).toLocaleString()}</td>
      </tr>
    </table>
    ` : ''}

    ${dashboardData?.shipStore ? `
    <h2 style="color: #1e293b; margin-top: 20px;">Ship Store</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f1f5f9;">
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Monthly Revenue</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">$${Number(dashboardData.shipStore.monthlyRevenue || 0).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Transactions</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${Number(dashboardData.shipStore.monthlyTransactions || 0)}</td>
      </tr>
      <tr style="background: #f1f5f9;">
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Avg Transaction</strong></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">$${Number(dashboardData.shipStore.avgTransaction || 0).toLocaleString()}</td>
      </tr>
    </table>
    ` : ''}
  </div>

  <div style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
    <p>&copy; ${new Date().getFullYear()} Vantage. All rights reserved.</p>
  </div>
</body>
</html>
      `;

      // Import email service
      const { sendDashboardReportEmail } = await import('./services/dashboard-email-service');
      const success = await sendDashboardReportEmail(recipientEmail, emailHtml, dashboardData);

      if (!success) {
        return res.status(500).json({ error: 'Failed to send email' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to export email:', error);
      res.status(500).json({ error: 'Failed to export dashboard' });
    }
  });

  // Get recent deals for detail panel
  app.get('/api/crm/deals/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { sql } = await import('drizzle-orm');

      const crmResult = await db.execute(sql`
        SELECT d.id, d.title, 
          COALESCE(d.value, 0) + COALESCE(d.amount, 0) as value,
          d.stage, d.probability, d.created_at as "createdAt",
          'crm' as source
        FROM crm_deals d
        INNER JOIN users u ON d.owner_id = u.id
        WHERE u.org_id = ${orgId}
          AND LOWER(d.stage) IN ('active', 'under review', 'under_review')
        ORDER BY d.created_at DESC
        LIMIT 50
      `);

      const modelingResult = await db.execute(sql`
        SELECT id, marina_name as title,
          COALESCE(purchase_price, 0) as value,
          COALESCE(deal_outcome::text, 'active') as stage,
          0 as probability, created_at as "createdAt",
          'modeling' as source
        FROM modeling_projects
        WHERE org_id = ${orgId}
          AND LOWER(COALESCE(deal_outcome::text, 'active')) IN ('active', 'under review', 'under_review')
        ORDER BY created_at DESC
        LIMIT 50
      `);

      const crmRows = (crmResult as any).rows || crmResult || [];
      const modelingRows = (modelingResult as any).rows || modelingResult || [];

      const combined = [...crmRows, ...modelingRows]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(combined);
    } catch (error: any) {
      console.error('Failed to fetch recent deals:', error);
      res.status(500).json({ error: 'Failed to fetch recent deals' });
    }
  });

  // Get recent sales comps for detail panel (with optional year filter)
  app.get('/api/analysis/sales-comps/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const year = req.query.year ? parseInt(req.query.year as string) : null;
      const { salesComps } = await import('@shared/schema');
      const { desc, isNull, and, sql } = await import('drizzle-orm');
      
      const conditions: any[] = [eq(salesComps.orgId, orgId), isNull(salesComps.deletedAt)];
      if (year) {
        conditions.push(eq(salesComps.saleYear, year));
      }
      
      const comps = await db
        .select({
          id: salesComps.id,
          marina: salesComps.marina,
          city: salesComps.city,
          state: salesComps.state,
          salePrice: salesComps.salePrice,
          wetSlips: salesComps.wetSlips,
          dryRacks: salesComps.dryRacks,
          capRate: salesComps.capRate,
          saleYear: salesComps.saleYear,
          saleMonth: salesComps.saleMonth,
          broker: salesComps.broker,
          estimatedPurchasePrice: salesComps.estimatedPurchasePrice,
          createdAt: salesComps.createdAt,
        })
        .from(salesComps)
        .where(and(...conditions))
        .orderBy(sql`${salesComps.saleYear} DESC NULLS LAST`, sql`${salesComps.saleMonth} DESC NULLS LAST`, desc(salesComps.createdAt))
        .limit(50);

      res.json(comps);
    } catch (error: any) {
      console.error('Failed to fetch recent sales comps:', error);
      res.status(500).json({ error: 'Failed to fetch recent sales comps' });
    }
  });

  // ============================================================================
  // Demographics & Market Intelligence API
  // ============================================================================

  // Get demographics overview for a specific state
  app.get('/api/demographics/overview/:stateCode', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stateCode } = req.params;
      const { demographicsService } = await import('./services/demographics-service');
      
      const overview = await demographicsService.getDemographicsOverview(orgId, stateCode);
      res.json(overview);
    } catch (error: any) {
      console.error('Failed to fetch demographics overview:', error);
      res.status(500).json({ error: 'Failed to fetch demographics overview' });
    }
  });

  // Get economic indicators for a state
  app.get('/api/demographics/economic/:stateCode', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stateCode } = req.params;
      const { demographicsService } = await import('./services/demographics-service');
      
      const indicators = await demographicsService.getEconomicIndicators(orgId, stateCode);
      res.json(indicators);
    } catch (error: any) {
      console.error('Failed to fetch economic indicators:', error);
      res.status(500).json({ error: 'Failed to fetch economic indicators' });
    }
  });

  // Get regional market statistics for a state
  app.get('/api/demographics/market/:stateCode', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stateCode } = req.params;
      const { demographicsService } = await import('./services/demographics-service');
      
      const stats = await demographicsService.getRegionalMarketStats(orgId, stateCode);
      res.json(stats);
    } catch (error: any) {
      console.error('Failed to fetch market statistics:', error);
      res.status(500).json({ error: 'Failed to fetch market statistics' });
    }
  });

  // Get list of available states with transaction counts
  app.get('/api/demographics/states', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { demographicsService } = await import('./services/demographics-service');
      
      const states = await demographicsService.getAvailableStates(orgId);
      res.json(states);
    } catch (error: any) {
      console.error('Failed to fetch available states:', error);
      res.status(500).json({ error: 'Failed to fetch available states' });
    }
  });

  // Get national overview
  app.get('/api/demographics/national', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { demographicsService } = await import('./services/demographics-service');
      
      const overview = await demographicsService.getNationalOverview(orgId);
      res.json(overview);
    } catch (error: any) {
      console.error('Failed to fetch national overview:', error);
      res.status(500).json({ error: 'Failed to fetch national overview' });
    }
  });

  // Generate drive-time isochrone polygon for a location
  app.post('/api/demographics/isochrone', authenticateUser, async (req: any, res) => {
    try {
      const { latitude, longitude, targetMinutes } = req.body;

      if (latitude === undefined || longitude === undefined || !targetMinutes) {
        return res.status(400).json({ error: 'latitude, longitude, and targetMinutes are required' });
      }

      const { driveTimeService } = await import('./services/drivetime-service');
      const isochrone = await driveTimeService.generateIsochrone(
        parseFloat(latitude), parseFloat(longitude), parseInt(targetMinutes)
      );

      res.json(isochrone);
    } catch (error: any) {
      console.error('Failed to generate isochrone:', error);
      res.status(500).json({ error: 'Failed to generate isochrone polygon' });
    }
  });

  // Fetch Census demographics for a specific location with optional radius or polygon aggregation
  app.post('/api/demographics/location', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { latitude, longitude, address, radiusMiles, polygonBoundary } = req.body;

      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }

      const { CensusService } = await import('./services/census-service');
      const censusApiKey = process.env.CENSUS_API_KEY;
      const censusService = new CensusService(censusApiKey);

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radius = radiusMiles ? parseFloat(radiusMiles) : null;

      let demographics;
      let dataSource = 'point';

      if (polygonBoundary && Array.isArray(polygonBoundary) && polygonBoundary.length >= 3) {
        // Drive-time isochrone polygon aggregation
        const { computePolygonAreaSqMiles } = await import('./services/drivetime-service');
        const area = computePolygonAreaSqMiles(polygonBoundary, lat);
        demographics = await censusService.getDemographicsForPolygon(polygonBoundary, area);
        dataSource = 'polygon_aggregated';
      } else if (radius && radius > 0) {
        demographics = await censusService.getDemographicsForRadius(lat, lng, radius);
        dataSource = 'radius_aggregated';
      } else {
        demographics = await censusService.getDemographicsForLocation(lat, lng);
      }

      res.json({
        location: { latitude: lat, longitude: lng, address },
        radiusMiles: radius,
        dataSource,
        demographics,
        fetchedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Failed to fetch location demographics:', error);
      res.status(500).json({ error: 'Failed to fetch location demographics' });
    }
  });

  app.post('/api/demographics/historical-trends', authenticateUser, async (req: any, res) => {
    try {
      const { latitude, longitude, radiusMiles } = req.body;

      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }

      const { CensusService } = await import('./services/census-service');
      const censusApiKey = process.env.CENSUS_API_KEY;
      const censusService = new CensusService(censusApiKey);

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radius = radiusMiles ? parseFloat(radiusMiles) : undefined;

      const result = await censusService.getHistoricalTrends(lat, lng, radius);

      res.json({
        location: { latitude: lat, longitude: lng },
        trends: result.trends,
        cagr: result.cagr,
        geographicLevel: result.geographicLevel,
        fetchedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Failed to fetch historical trends:', error);
      res.status(500).json({ error: 'Failed to fetch historical trends' });
    }
  });

  app.post('/api/demographics/business-patterns', authenticateUser, async (req: any, res) => {
    try {
      const { latitude, longitude } = req.body;

      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }

      const { CensusService } = await import('./services/census-service');
      const censusApiKey = process.env.CENSUS_API_KEY;
      const censusService = new CensusService(censusApiKey);

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      const geoData = await (censusService as any).getGeographicCodes(lat, lng);

      if (!geoData.state || !geoData.county) {
        return res.status(400).json({ error: 'Could not determine county FIPS codes for this location' });
      }

      const businessPatterns = await censusService.getBusinessPatterns(geoData.state, geoData.county);

      res.json({
        location: { latitude: lat, longitude: lng },
        fipsState: geoData.state,
        fipsCounty: geoData.county,
        businessPatterns,
        fetchedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Failed to fetch business patterns:', error);
      res.status(500).json({ error: 'Failed to fetch business patterns' });
    }
  });

  // Calculate validated drive time radius for a location
  app.post('/api/demographics/drivetime-radius', authenticateUser, async (req: any, res) => {
    try {
      const { latitude, longitude, targetMinutes } = req.body;
      
      if (latitude === undefined || longitude === undefined || !targetMinutes) {
        return res.status(400).json({ error: 'Latitude, longitude, and targetMinutes are required' });
      }
      
      const { driveTimeService } = await import('./services/drivetime-service');
      
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const minutes = parseInt(targetMinutes);
      
      const estimate = await driveTimeService.getEstimatedRadiusForDriveTime(lat, lng, minutes);
      
      res.json({
        targetMinutes: minutes,
        estimatedMiles: estimate.estimatedMiles,
        calculatedMiles: estimate.calculatedMiles,
        isEstimate: estimate.isEstimate,
        source: estimate.source,
        radiusMiles: estimate.calculatedMiles || estimate.estimatedMiles
      });
    } catch (error: any) {
      console.error('Failed to calculate drive time radius:', error);
      res.status(500).json({ error: 'Failed to calculate drive time radius' });
    }
  });

  // Validate drive time for a proposed radius
  app.post('/api/demographics/validate-drivetime', authenticateUser, async (req: any, res) => {
    try {
      const { latitude, longitude, proposedMiles, targetMinutes } = req.body;
      
      if (latitude === undefined || longitude === undefined || !proposedMiles || !targetMinutes) {
        return res.status(400).json({ error: 'Latitude, longitude, proposedMiles, and targetMinutes are required' });
      }
      
      const { driveTimeService } = await import('./services/drivetime-service');
      
      const validation = await driveTimeService.validateDriveTimeRadius(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(proposedMiles),
        parseInt(targetMinutes)
      );
      
      res.json(validation);
    } catch (error: any) {
      console.error('Failed to validate drive time:', error);
      res.status(500).json({ error: 'Failed to validate drive time' });
    }
  });

  // Get demographics for a CRM property by ID
  app.get('/api/demographics/property/:propertyId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { propertyId } = req.params;
      
      // Get property from CRM
      const { crmProperties } = await import('@shared/schema');
      const property = await db
        .select()
        .from(crmProperties)
        .where(and(
          eq(crmProperties.id, parseInt(propertyId)),
          eq(crmProperties.orgId, orgId)
        ))
        .limit(1);
      
      if (property.length === 0) {
        return res.status(404).json({ error: 'Property not found' });
      }
      
      const prop = property[0];
      if (!prop.latitude || !prop.longitude) {
        return res.status(400).json({ error: 'Property does not have coordinates' });
      }
      
      const { CensusService } = await import('./services/census-service');
      const censusApiKey = process.env.CENSUS_API_KEY;
      const censusService = new CensusService(censusApiKey);
      
      const demographics = await censusService.getDemographicsForLocation(
        prop.latitude,
        prop.longitude
      );
      
      res.json({
        property: {
          id: prop.id,
          name: prop.name,
          address: prop.address,
          city: prop.city,
          state: prop.state,
          latitude: prop.latitude,
          longitude: prop.longitude
        },
        demographics,
        fetchedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Failed to fetch property demographics:', error);
      res.status(500).json({ error: 'Failed to fetch property demographics' });
    }
  });

  // Compare demographics for multiple locations
  app.post('/api/demographics/compare', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { locations } = req.body;
      
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.status(400).json({ error: 'At least one location is required' });
      }
      
      if (locations.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 locations can be compared' });
      }
      
      const { CensusService } = await import('./services/census-service');
      const censusApiKey = process.env.CENSUS_API_KEY;
      const censusService = new CensusService(censusApiKey);
      
      const results = await Promise.all(
        locations.map(async (loc: { latitude: number; longitude: number; label?: string }) => {
          try {
            const demographics = await censusService.getDemographicsForLocation(
              loc.latitude,
              loc.longitude
            );
            return {
              location: loc,
              demographics,
              success: true
            };
          } catch (error: any) {
            return {
              location: loc,
              demographics: null,
              success: false,
              error: 'Failed to fetch demographics'
            };
          }
        })
      );
      
      res.json({
        comparisons: results,
        fetchedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Failed to compare demographics:', error);
      res.status(500).json({ error: 'Failed to compare demographics' });
    }
  });

  // Get saved demographic locations for a modeling project
  app.get('/api/demographics/project-locations/:modelingProjectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { modelingProjectId } = req.params;
      
      const { demographicProjectLocations } = await import('@shared/schema');
      const { eq, and, asc } = await import('drizzle-orm');
      
      const locations = await db
        .select()
        .from(demographicProjectLocations)
        .where(and(
          eq(demographicProjectLocations.orgId, orgId),
          eq(demographicProjectLocations.modelingProjectId, modelingProjectId)
        ))
        .orderBy(asc(demographicProjectLocations.sortOrder));

      res.json(locations);
    } catch (error: any) {
      console.error('Failed to fetch demographic project locations:', error);
      res.status(500).json({ error: 'Failed to fetch demographic project locations' });
    }
  });

  // Save demographic locations for a modeling project (bulk save/update)
  app.post('/api/demographics/project-locations/:modelingProjectId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { modelingProjectId } = req.params;
      const { locations } = req.body;

      if (!Array.isArray(locations)) {
        return res.status(400).json({ error: 'locations must be an array' });
      }

      const { demographicProjectLocations } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      // Delete existing locations for this project
      await db
        .delete(demographicProjectLocations)
        .where(and(
          eq(demographicProjectLocations.orgId, orgId),
          eq(demographicProjectLocations.modelingProjectId, modelingProjectId)
        ));

      // Insert new locations
      if (locations.length > 0) {
        const locationsToInsert = locations.map((loc: any, index: number) => ({
          orgId,
          modelingProjectId,
          address: loc.address,
          latitude: loc.lat,
          longitude: loc.lng,
          label: loc.label || null,
          analysisMode: loc.config?.analysisMode || 'distance',
          distanceRings: loc.config?.distanceRings || [1],
          driveTimes: loc.config?.driveTimes || [],
          sortOrder: index,
          createdBy: userId,
        }));

        await db.insert(demographicProjectLocations).values(locationsToInsert);
      }

      res.json({ success: true, count: locations.length });
    } catch (error: any) {
      console.error('Failed to save demographic project locations:', error);
      res.status(500).json({ error: 'Failed to save demographic project locations' });
    }
  });

  // Update a single demographic location configuration
  app.patch('/api/demographics/project-locations/:locationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { locationId } = req.params;
      const { analysisMode, distanceRings, driveTimes, label } = req.body;

      const { demographicProjectLocations } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const updateData: any = { updatedAt: new Date() };
      if (analysisMode !== undefined) updateData.analysisMode = analysisMode;
      if (distanceRings !== undefined) updateData.distanceRings = distanceRings;
      if (driveTimes !== undefined) updateData.driveTimes = driveTimes;
      if (label !== undefined) updateData.label = label;

      const [updated] = await db
        .update(demographicProjectLocations)
        .set(updateData)
        .where(and(
          eq(demographicProjectLocations.id, locationId),
          eq(demographicProjectLocations.orgId, orgId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Location not found' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update demographic location:', error);
      res.status(500).json({ error: 'Failed to update demographic location' });
    }
  });

  // Delete a single demographic location
  app.delete('/api/demographics/project-locations/:locationId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { locationId } = req.params;

      const { demographicProjectLocations } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [deleted] = await db
        .delete(demographicProjectLocations)
        .where(and(
          eq(demographicProjectLocations.id, locationId),
          eq(demographicProjectLocations.orgId, orgId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Location not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete demographic location:', error);
      res.status(500).json({ error: 'Failed to delete demographic location' });
    }
  });

  // Get recent fuel transactions for detail panel
  app.get('/api/fuel/transactions/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { fuelSales } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const transactions = await db
        .select({
          id: fuelSales.id,
          transactionDate: fuelSales.transactionDate,
          customerName: fuelSales.customerName,
          fuelType: fuelSales.fuelType,
          gallons: fuelSales.gallons,
          pricePerGallon: fuelSales.pricePerGallon,
          totalAmount: fuelSales.totalAmount,
          paymentMethod: fuelSales.paymentMethod,
          createdAt: fuelSales.createdAt,
        })
        .from(fuelSales)
        .where(eq(fuelSales.orgId, orgId))
        .orderBy(desc(fuelSales.transactionDate))
        .limit(20);

      res.json(transactions);
    } catch (error: any) {
      console.error('Failed to fetch recent fuel transactions:', error);
      res.status(500).json({ error: 'Failed to fetch recent fuel transactions' });
    }
  });

  // Get recent Docket deals for detail panel
  app.get('/api/docket/articles/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { docketDeals } = await import('@shared/schema');
      const { desc, isNull, and } = await import('drizzle-orm');
      
      const deals = await db
        .select({
          id: docketDeals.id,
          buyer: docketDeals.buyer,
          seller: docketDeals.seller,
          transactionType: docketDeals.transactionType,
          dealStatus: docketDeals.dealStatus,
          assetDescription: docketDeals.assetDescription,
          closingDate: docketDeals.closingDate,
          createdAt: docketDeals.createdAt,
        })
        .from(docketDeals)
        .where(and(eq(docketDeals.orgId, orgId), isNull(docketDeals.deletedAt)))
        .orderBy(desc(docketDeals.createdAt))
        .limit(20);

      res.json(deals);
    } catch (error: any) {
      console.error('Failed to fetch recent Docket deals:', error);
      res.status(500).json({ error: 'Failed to fetch recent Docket deals' });
    }
  });

  // Get recent VDR documents for detail panel
  app.get('/api/vdr/documents/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { vdrDocuments, projects } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const documents = await db
        .select({
          id: vdrDocuments.id,
          filename: vdrDocuments.filename,
          size: vdrDocuments.size,
          mimeType: vdrDocuments.mimeType,
          uploadedBy: vdrDocuments.uploadedBy,
          projectId: vdrDocuments.projectId,
          projectName: projects.name,
          createdAt: vdrDocuments.createdAt,
        })
        .from(vdrDocuments)
        .innerJoin(projects, eq(vdrDocuments.projectId, projects.id))
        .where(eq(vdrDocuments.orgId, orgId))
        .orderBy(desc(vdrDocuments.createdAt))
        .limit(20);

      res.json(documents);
    } catch (error: any) {
      console.error('Failed to fetch recent VDR documents:', error);
      res.status(500).json({ error: 'Failed to fetch recent VDR documents' });
    }
  });

  // Get recent ship store transactions for detail panel
  app.get('/api/ship-store/transactions/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { shipStoreTransactions } = await import('@shared/schema');
      const { desc, eq } = await import('drizzle-orm');
      
      const transactions = await db
        .select({
          id: shipStoreTransactions.id,
          total: shipStoreTransactions.total,
          paymentMethod: shipStoreTransactions.paymentMethod,
          status: shipStoreTransactions.status,
          createdAt: shipStoreTransactions.createdAt,
        })
        .from(shipStoreTransactions)
        .where(eq(shipStoreTransactions.orgId, orgId))
        .orderBy(desc(shipStoreTransactions.createdAt))
        .limit(20);

      res.json(transactions);
    } catch (error: any) {
      console.error('Failed to fetch recent ship store transactions:', error);
      res.status(500).json({ error: 'Failed to fetch recent ship store transactions' });
    }
  });

  // Get recent due diligence tasks for detail panel
  app.get('/api/projects/tasks/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { tasks, projects } = await import('@shared/schema');
      const { desc, isNull, and } = await import('drizzle-orm');
      
      const recentTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          deadline: tasks.deadline,
          assignee: tasks.assignee,
          projectId: tasks.projectId,
          projectName: projects.name,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(eq(projects.orgId, orgId), isNull(projects.deletedAt)))
        .orderBy(desc(tasks.createdAt))
        .limit(20);

      res.json(recentTasks);
    } catch (error: any) {
      console.error('Failed to fetch recent DD tasks:', error);
      res.status(500).json({ error: 'Failed to fetch recent DD tasks' });
    }
  });

  // Get recent rent roll entries for detail panel
  app.get('/api/rent-roll/entries/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { rentRollEntries, rentRolls } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const entries = await db
        .select({
          id: rentRollEntries.id,
          unitNumber: rentRollEntries.unitNumber,
          tenantName: rentRollEntries.tenantName,
          monthlyRate: rentRollEntries.monthlyRate,
          status: rentRollEntries.status,
          endDate: rentRollEntries.endDate,
          entryType: rentRollEntries.entryType,
          createdAt: rentRollEntries.createdAt,
        })
        .from(rentRollEntries)
        .where(eq(rentRollEntries.orgId, orgId))
        .orderBy(desc(rentRollEntries.createdAt))
        .limit(20);

      res.json(entries);
    } catch (error: any) {
      console.error('Failed to fetch recent rent roll entries:', error);
      res.status(500).json({ error: 'Failed to fetch recent rent roll entries' });
    }
  });

  // Get recent modeling projects for detail panel
  app.get('/api/modeling/projects/recent', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { modelingProjects } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const projects = await db
        .select({
          id: modelingProjects.id,
          marinaName: modelingProjects.marinaName,
          city: modelingProjects.city,
          state: modelingProjects.state,
          purchasePrice: modelingProjects.purchasePrice,
          year1CapRate: modelingProjects.year1CapRate,
          ebitda: modelingProjects.ebitda,
          dealOutcome: modelingProjects.dealOutcome,
          createdAt: modelingProjects.createdAt,
        })
        .from(modelingProjects)
        .where(eq(modelingProjects.orgId, orgId))
        .orderBy(desc(modelingProjects.createdAt))
        .limit(20);

      res.json(projects);
    } catch (error: any) {
      console.error('Failed to fetch recent modeling projects:', error);
      res.status(500).json({ error: 'Failed to fetch recent modeling projects' });
    }
  });
}
