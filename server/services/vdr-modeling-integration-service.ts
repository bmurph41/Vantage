import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  vdrFolders,
  vdrDocuments,
  modelingAuditLog
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface VDRExportOptions {
  includeICMemo?: boolean;
  includeProForma?: boolean;
  includeScenarioComparison?: boolean;
  includeSensitivityAnalysis?: boolean;
  scenarioVersionIds?: string[];
}

export interface VDRExportResult {
  folderId: string;
  folderPath: string;
  documents: Array<{
    id: string;
    filename: string;
    type: string;
  }>;
}

export class VDRModelingIntegrationService {
  private uploadDir = path.join(process.cwd(), 'uploads', 'vdr');

  async exportToVDR(
    modelingProjectId: string,
    orgId: string,
    userId: string,
    options: VDRExportOptions = {}
  ): Promise<VDRExportResult> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, modelingProjectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Modeling project not found');
    }

    if (!project.ddProjectId) {
      throw new Error('Modeling project is not linked to a Due Diligence project. VDR export requires a linked DD project.');
    }

    const ddProjectId = project.ddProjectId;

    const folder = await this.ensureModelingFolder(ddProjectId, orgId, userId, project.marinaName || project.name || 'Modeling');

    const documents: VDRExportResult['documents'] = [];

    if (options.includeICMemo !== false) {
      const icMemoDoc = await this.exportICMemo(project, folder.id, ddProjectId, orgId, userId);
      if (icMemoDoc) documents.push(icMemoDoc);
    }

    if (options.includeProForma !== false) {
      const proFormaDoc = await this.exportProForma(project, folder.id, ddProjectId, orgId, userId, options.scenarioVersionIds);
      if (proFormaDoc) documents.push(proFormaDoc);
    }

    if (options.includeScenarioComparison !== false) {
      const comparisonDoc = await this.exportScenarioComparison(project, folder.id, ddProjectId, orgId, userId);
      if (comparisonDoc) documents.push(comparisonDoc);
    }

    if (options.includeSensitivityAnalysis !== false) {
      const sensitivityDoc = await this.exportSensitivityAnalysis(project, folder.id, ddProjectId, orgId, userId);
      if (sensitivityDoc) documents.push(sensitivityDoc);
    }

    await this.logAuditEvent(modelingProjectId, orgId, userId, 'vdr_export', {
      ddProjectId,
      folderId: folder.id,
      documentCount: documents.length,
      documentTypes: documents.map(d => d.type)
    });

    return {
      folderId: folder.id,
      folderPath: folder.path,
      documents
    };
  }

  private async ensureModelingFolder(
    ddProjectId: string,
    orgId: string,
    userId: string,
    projectName: string
  ): Promise<{ id: string; path: string }> {
    const [existingFolder] = await db.select()
      .from(vdrFolders)
      .where(and(
        eq(vdrFolders.projectId, ddProjectId),
        eq(vdrFolders.orgId, orgId),
        eq(vdrFolders.name, 'Modeling Outputs')
      ))
      .limit(1);

    if (existingFolder) {
      return { id: existingFolder.id, path: existingFolder.path };
    }

    const [newFolder] = await db.insert(vdrFolders).values({
      projectId: ddProjectId,
      name: 'Modeling Outputs',
      path: '/Modeling Outputs',
      displayOrder: 100,
      description: `Financial modeling outputs for ${projectName}`,
      orgId,
      createdBy: userId
    }).returning();

    return { id: newFolder.id, path: newFolder.path };
  }

  private async exportICMemo(
    project: typeof modelingProjects.$inferSelect,
    folderId: string,
    ddProjectId: string,
    orgId: string,
    userId: string
  ): Promise<{ id: string; filename: string; type: string } | null> {
    try {
      const { icMemoService } = await import('./ic-memo-service');
      const memoData = await icMemoService.generateICMemo(project.id, orgId);
      const memoText = await icMemoService.generateTextMemo(memoData);

      const filename = `IC_Memo_${project.marinaName || project.name}_${new Date().toISOString().split('T')[0]}.txt`;
      const doc = await this.saveDocument(folderId, ddProjectId, orgId, userId, filename, memoText, 'text/plain', 'ic_memo');
      
      return doc;
    } catch (error) {
      console.error('Failed to export IC Memo:', error);
      return null;
    }
  }

  private async exportProForma(
    project: typeof modelingProjects.$inferSelect,
    folderId: string,
    ddProjectId: string,
    orgId: string,
    userId: string,
    scenarioVersionIds?: string[]
  ): Promise<{ id: string; filename: string; type: string } | null> {
    try {
      const { proFormaEngineService } = await import('./pro-forma-engine-service');
      
      let versionIds = scenarioVersionIds;
      if (!versionIds || versionIds.length === 0) {
        const scenarios = await db.select()
          .from(modelingScenarioVersions)
          .where(and(
            eq(modelingScenarioVersions.modelingProjectId, project.id),
            eq(modelingScenarioVersions.status, 'approved')
          ))
          .limit(1);
        
        if (scenarios.length > 0) {
          versionIds = [scenarios[0].id];
        }
      }

      if (!versionIds || versionIds.length === 0) {
        return null;
      }

      const proFormaData = await proFormaEngineService.generateProForma(project.id, orgId, versionIds[0]);

      const csvContent = this.generateProFormaCSV(proFormaData);
      const filename = `Pro_Forma_${project.marinaName || project.name}_${new Date().toISOString().split('T')[0]}.csv`;
      const doc = await this.saveDocument(folderId, ddProjectId, orgId, userId, filename, csvContent, 'text/csv', 'pro_forma');
      
      return doc;
    } catch (error) {
      console.error('Failed to export Pro Forma:', error);
      return null;
    }
  }

  private async exportScenarioComparison(
    project: typeof modelingProjects.$inferSelect,
    folderId: string,
    ddProjectId: string,
    orgId: string,
    userId: string
  ): Promise<{ id: string; filename: string; type: string } | null> {
    try {
      const scenarios = await db.select()
        .from(modelingScenarioVersions)
        .where(and(
          eq(modelingScenarioVersions.modelingProjectId, project.id),
          eq(modelingScenarioVersions.orgId, orgId)
        ))
        .orderBy(modelingScenarioVersions.version);

      if (scenarios.length < 2) {
        return null;
      }

      const comparisonContent = this.generateScenarioComparisonText(project, scenarios);
      const filename = `Scenario_Comparison_${project.marinaName || project.name}_${new Date().toISOString().split('T')[0]}.txt`;
      const doc = await this.saveDocument(folderId, ddProjectId, orgId, userId, filename, comparisonContent, 'text/plain', 'scenario_comparison');
      
      return doc;
    } catch (error) {
      console.error('Failed to export Scenario Comparison:', error);
      return null;
    }
  }

  private async exportSensitivityAnalysis(
    project: typeof modelingProjects.$inferSelect,
    folderId: string,
    ddProjectId: string,
    orgId: string,
    userId: string
  ): Promise<{ id: string; filename: string; type: string } | null> {
    try {
      const { sensitivityMatrixService } = await import('./sensitivity-matrix-service');
      const matrices = await sensitivityMatrixService.getMatrices(project.id, orgId);

      if (matrices.length === 0) {
        return null;
      }

      const csvContent = this.generateSensitivityCSV(matrices);
      const filename = `Sensitivity_Analysis_${project.marinaName || project.name}_${new Date().toISOString().split('T')[0]}.csv`;
      const doc = await this.saveDocument(folderId, ddProjectId, orgId, userId, filename, csvContent, 'text/csv', 'sensitivity_analysis');
      
      return doc;
    } catch (error) {
      console.error('Failed to export Sensitivity Analysis:', error);
      return null;
    }
  }

  private async saveDocument(
    folderId: string,
    ddProjectId: string,
    orgId: string,
    userId: string,
    filename: string,
    content: string,
    mimeType: string,
    documentType: string
  ): Promise<{ id: string; filename: string; type: string }> {
    await fs.mkdir(this.uploadDir, { recursive: true });

    const fileId = crypto.randomUUID();
    const storagePath = path.join(this.uploadDir, `${fileId}_${filename}`);
    
    await fs.writeFile(storagePath, content, 'utf-8');
    
    const buffer = Buffer.from(content, 'utf-8');
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const [doc] = await db.insert(vdrDocuments).values({
      folderId,
      projectId: ddProjectId,
      filename,
      originalFilename: filename,
      mimeType,
      size: buffer.length,
      checksum,
      storagePath,
      version: 1,
      isCurrentVersion: true,
      orgId,
      createdBy: userId,
      aiCategory: 'Financial Analysis'
    }).returning();

    return {
      id: doc.id,
      filename,
      type: documentType
    };
  }

  private generateProFormaCSV(proForma: any): string {
    const lines: string[] = [];
    
    lines.push('Year,Revenue,Operating Expenses,NOI,Cap Rate,Valuation');
    
    if (proForma.projections) {
      for (const proj of proForma.projections) {
        lines.push([
          proj.year,
          proj.totalRevenue?.toFixed(2) || '0.00',
          proj.totalExpenses?.toFixed(2) || '0.00',
          proj.noi?.toFixed(2) || '0.00',
          (proj.capRate * 100)?.toFixed(2) + '%' || '0.00%',
          proj.valuation?.toFixed(2) || '0.00'
        ].join(','));
      }
    }
    
    return lines.join('\n');
  }

  private generateScenarioComparisonText(project: any, scenarios: any[]): string {
    const lines: string[] = [];
    
    lines.push('SCENARIO COMPARISON REPORT');
    lines.push('='.repeat(50));
    lines.push(`Project: ${project.marinaName || project.name}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    for (const scenario of scenarios) {
      lines.push(`\n${'─'.repeat(50)}`);
      lines.push(`Scenario: ${scenario.name} (v${scenario.version})`);
      lines.push(`Status: ${scenario.status}`);
      lines.push(`Type: ${scenario.scenarioType || 'N/A'}`);
      lines.push(`Created: ${scenario.createdAt}`);
      
      if (scenario.assumptions) {
        lines.push('\nKey Assumptions:');
        const assumptions = typeof scenario.assumptions === 'string' 
          ? JSON.parse(scenario.assumptions) 
          : scenario.assumptions;
        
        for (const [key, value] of Object.entries(assumptions)) {
          lines.push(`  - ${key}: ${value}`);
        }
      }
    }
    
    return lines.join('\n');
  }

  private generateSensitivityCSV(matrices: any[]): string {
    const lines: string[] = [];
    
    for (const matrix of matrices) {
      lines.push(`Matrix: ${matrix.analysisType}`);
      lines.push(`Row Variable: ${matrix.rowVariable}, Column Variable: ${matrix.columnVariable}`);
      
      if (matrix.results?.matrix) {
        const headers = [''].concat(matrix.columnValues.map((v: number) => v.toString()));
        lines.push(headers.join(','));
        
        for (let i = 0; i < matrix.rowValues.length; i++) {
          const row = [matrix.rowValues[i].toString()].concat(
            matrix.results.matrix[i].map((v: number) => v.toFixed(2))
          );
          lines.push(row.join(','));
        }
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }

  async getVDRExportHistory(
    modelingProjectId: string,
    orgId: string
  ): Promise<any[]> {
    const logs = await db.select()
      .from(modelingAuditLog)
      .where(and(
        eq(modelingAuditLog.modelingProjectId, modelingProjectId),
        eq(modelingAuditLog.orgId, orgId),
        eq(modelingAuditLog.eventType, 'vdr_export')
      ))
      .orderBy(sql`${modelingAuditLog.createdAt} DESC`)
      .limit(20);

    return logs.map(log => ({
      id: log.id,
      timestamp: log.createdAt,
      details: log.newValue as any
    }));
  }

  private async logAuditEvent(
    projectId: string,
    orgId: string,
    userId: string,
    eventType: string,
    details: any
  ): Promise<void> {
    await db.insert(modelingAuditLog).values({
      orgId,
      modelingProjectId: projectId,
      eventType,
      entityType: 'vdr_export',
      entityId: details.folderId,
      newValue: details,
      userId
    });
  }
}

export const vdrModelingIntegrationService = new VDRModelingIntegrationService();
