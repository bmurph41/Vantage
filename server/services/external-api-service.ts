import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingActuals,
  modelingAuditLog
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface ProjectExportData {
  project: {
    id: string;
    name: string;
    marinaName?: string;
    state?: string;
    region?: string;
    status: string;
    dealOutcome?: string;
    acquisitionDate?: string;
    purchasePrice?: number;
    slips?: number;
  };
  scenarios: Array<{
    id: string;
    name: string;
    type: string;
    version: number;
    status: string;
    assumptions: any;
    createdAt: string;
    approvedAt?: string;
  }>;
  financials: {
    historical: Array<{
      year: number;
      period: string;
      category: string;
      accountName: string;
      amount: number;
    }>;
    projections?: any;
  };
  metrics: {
    currentNOI?: number;
    capRate?: number;
    pricePerSlip?: number;
    occupancyRate?: number;
    revenuePerSlip?: number;
  };
  metadata: {
    exportedAt: string;
    version: string;
    format: string;
  };
}

export interface PortfolioExportData {
  portfolio: {
    totalProjects: number;
    totalValue: number;
    totalNOI: number;
    averageCapRate: number;
    totalSlips: number;
  };
  projects: ProjectExportData[];
  analytics: {
    byStatus: Record<string, number>;
    byRegion: Record<string, number>;
    byOutcome: Record<string, number>;
  };
  metadata: {
    exportedAt: string;
    version: string;
    orgId: string;
  };
}

export class ExternalAPIService {
  private apiVersion = '1.0.0';

  async exportProject(
    projectId: string,
    orgId: string,
    userId: string,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<ProjectExportData | string> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found');
    }

    const scenarios = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.orgId, orgId)
      ))
      .orderBy(desc(modelingScenarioVersions.version));

    const actuals = await db.select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));

    const data: ProjectExportData = {
      project: {
        id: project.id,
        name: project.name,
        marinaName: project.marinaName || undefined,
        state: project.state || undefined,
        region: project.region || undefined,
        status: project.status,
        dealOutcome: project.dealOutcome || undefined,
        acquisitionDate: project.acquisitionDate?.toISOString(),
        purchasePrice: project.purchasePrice ? parseFloat(project.purchasePrice) : undefined,
        slips: project.slips || undefined
      },
      scenarios: scenarios.map(s => ({
        id: s.id,
        name: s.name,
        type: s.scenarioType || 'base',
        version: s.version,
        status: s.status,
        assumptions: s.assumptions,
        createdAt: s.createdAt.toISOString(),
        approvedAt: s.approvedAt?.toISOString()
      })),
      financials: {
        historical: actuals.map(a => ({
          year: a.year,
          period: a.period,
          category: a.category,
          accountName: a.accountName,
          amount: parseFloat(a.amount)
        }))
      },
      metrics: this.calculateMetrics(project, actuals),
      metadata: {
        exportedAt: new Date().toISOString(),
        version: this.apiVersion,
        format
      }
    };

    await this.logAuditEvent(projectId, orgId, userId, 'api_export', {
      format,
      scenarioCount: scenarios.length,
      actualsCount: actuals.length
    });

    if (format === 'csv') {
      return this.convertToCSV(data);
    } else if (format === 'xml') {
      return this.convertToXML(data);
    }

    return data;
  }

  async exportPortfolio(
    orgId: string,
    userId: string,
    filters?: {
      status?: string;
      region?: string;
      outcome?: string;
      minValue?: number;
      maxValue?: number;
    }
  ): Promise<PortfolioExportData> {
    let query = db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));

    const allProjects = await query;

    let filteredProjects = allProjects;
    if (filters) {
      if (filters.status) {
        filteredProjects = filteredProjects.filter(p => p.status === filters.status);
      }
      if (filters.region) {
        filteredProjects = filteredProjects.filter(p => p.region === filters.region);
      }
      if (filters.outcome) {
        filteredProjects = filteredProjects.filter(p => p.dealOutcome === filters.outcome);
      }
      if (filters.minValue) {
        filteredProjects = filteredProjects.filter(p => 
          p.purchasePrice && parseFloat(p.purchasePrice) >= filters.minValue!
        );
      }
      if (filters.maxValue) {
        filteredProjects = filteredProjects.filter(p => 
          p.purchasePrice && parseFloat(p.purchasePrice) <= filters.maxValue!
        );
      }
    }

    const projectExports: ProjectExportData[] = [];
    for (const project of filteredProjects) {
      const exportData = await this.exportProject(project.id, orgId, userId, 'json');
      if (typeof exportData !== 'string') {
        projectExports.push(exportData);
      }
    }

    const byStatus: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};

    for (const project of filteredProjects) {
      byStatus[project.status] = (byStatus[project.status] || 0) + 1;
      if (project.region) {
        byRegion[project.region] = (byRegion[project.region] || 0) + 1;
      }
      if (project.dealOutcome) {
        byOutcome[project.dealOutcome] = (byOutcome[project.dealOutcome] || 0) + 1;
      }
    }

    const totalValue = filteredProjects.reduce((sum, p) => 
      sum + (p.purchasePrice ? parseFloat(p.purchasePrice) : 0), 0
    );
    const totalSlips = filteredProjects.reduce((sum, p) => 
      sum + (p.slips || 0), 0
    );
    const totalNOI = projectExports.reduce((sum, p) => 
      sum + (p.metrics.currentNOI || 0), 0
    );
    const avgCapRate = totalValue > 0 ? (totalNOI / totalValue) * 100 : 0;

    return {
      portfolio: {
        totalProjects: filteredProjects.length,
        totalValue,
        totalNOI,
        averageCapRate: avgCapRate,
        totalSlips
      },
      projects: projectExports,
      analytics: {
        byStatus,
        byRegion,
        byOutcome
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        version: this.apiVersion,
        orgId
      }
    };
  }

  async generateAPIKey(
    orgId: string,
    userId: string,
    description: string,
    permissions: string[]
  ): Promise<{ key: string; expiresAt: string }> {
    const key = `mm_${this.generateRandomString(32)}`;
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    return {
      key,
      expiresAt: expiresAt.toISOString()
    };
  }

  async getWebhookPayload(
    projectId: string,
    orgId: string,
    eventType: 'scenario_approved' | 'project_updated' | 'analysis_completed'
  ): Promise<{
    event: string;
    timestamp: string;
    projectId: string;
    data: any;
  }> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found');
    }

    return {
      event: eventType,
      timestamp: new Date().toISOString(),
      projectId,
      data: {
        name: project.name,
        marinaName: project.marinaName,
        status: project.status,
        dealOutcome: project.dealOutcome
      }
    };
  }

  private calculateMetrics(project: any, actuals: any[]): ProjectExportData['metrics'] {
    const revenueItems = actuals.filter(a => a.category === 'revenue' || a.category === 'Revenue');
    const expenseItems = actuals.filter(a => a.category === 'expense' || a.category === 'Expense' || a.category === 'Operating Expense');

    const totalRevenue = revenueItems.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const totalExpenses = expenseItems.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const currentNOI = totalRevenue - totalExpenses;

    const purchasePrice = project.purchasePrice ? parseFloat(project.purchasePrice) : 0;
    const capRate = purchasePrice > 0 ? (currentNOI / purchasePrice) * 100 : 0;
    const pricePerSlip = project.slips && project.slips > 0 && purchasePrice > 0 
      ? purchasePrice / project.slips 
      : 0;
    const revenuePerSlip = project.slips && project.slips > 0 
      ? totalRevenue / project.slips 
      : 0;

    return {
      currentNOI: currentNOI > 0 ? currentNOI : undefined,
      capRate: capRate > 0 ? capRate : undefined,
      pricePerSlip: pricePerSlip > 0 ? pricePerSlip : undefined,
      revenuePerSlip: revenuePerSlip > 0 ? revenuePerSlip : undefined
    };
  }

  private convertToCSV(data: ProjectExportData): string {
    const lines: string[] = [];
    
    lines.push('Section,Field,Value');
    lines.push(`Project,ID,${data.project.id}`);
    lines.push(`Project,Name,${data.project.name}`);
    lines.push(`Project,Marina Name,${data.project.marinaName || ''}`);
    lines.push(`Project,State,${data.project.state || ''}`);
    lines.push(`Project,Status,${data.project.status}`);
    lines.push(`Project,Purchase Price,${data.project.purchasePrice || ''}`);
    lines.push(`Project,Slips,${data.project.slips || ''}`);
    
    lines.push('');
    lines.push('Scenario,Name,Type,Version,Status,Created At');
    for (const scenario of data.scenarios) {
      lines.push(`Scenario,${scenario.name},${scenario.type},${scenario.version},${scenario.status},${scenario.createdAt}`);
    }
    
    lines.push('');
    lines.push('Financial,Year,Period,Category,Account,Amount');
    for (const item of data.financials.historical) {
      lines.push(`Financial,${item.year},${item.period},${item.category},${item.accountName},${item.amount}`);
    }
    
    lines.push('');
    lines.push(`Metrics,Current NOI,${data.metrics.currentNOI || ''}`);
    lines.push(`Metrics,Cap Rate,${data.metrics.capRate ? data.metrics.capRate.toFixed(2) + '%' : ''}`);
    lines.push(`Metrics,Price Per Slip,${data.metrics.pricePerSlip || ''}`);
    
    return lines.join('\n');
  }

  private convertToXML(data: ProjectExportData): string {
    const escape = (str: string) => str.replace(/[<>&'"]/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    }[c] || c));

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ModelingProjectExport>\n';
    xml += '  <Project>\n';
    xml += `    <ID>${escape(data.project.id)}</ID>\n`;
    xml += `    <Name>${escape(data.project.name)}</Name>\n`;
    xml += `    <MarinaName>${escape(data.project.marinaName || '')}</MarinaName>\n`;
    xml += `    <State>${escape(data.project.state || '')}</State>\n`;
    xml += `    <Status>${escape(data.project.status)}</Status>\n`;
    xml += `    <PurchasePrice>${data.project.purchasePrice || ''}</PurchasePrice>\n`;
    xml += `    <Slips>${data.project.slips || ''}</Slips>\n`;
    xml += '  </Project>\n';
    
    xml += '  <Scenarios>\n';
    for (const scenario of data.scenarios) {
      xml += '    <Scenario>\n';
      xml += `      <ID>${escape(scenario.id)}</ID>\n`;
      xml += `      <Name>${escape(scenario.name)}</Name>\n`;
      xml += `      <Type>${escape(scenario.type)}</Type>\n`;
      xml += `      <Version>${scenario.version}</Version>\n`;
      xml += `      <Status>${escape(scenario.status)}</Status>\n`;
      xml += '    </Scenario>\n';
    }
    xml += '  </Scenarios>\n';
    
    xml += '  <Metrics>\n';
    xml += `    <CurrentNOI>${data.metrics.currentNOI || ''}</CurrentNOI>\n`;
    xml += `    <CapRate>${data.metrics.capRate?.toFixed(2) || ''}</CapRate>\n`;
    xml += `    <PricePerSlip>${data.metrics.pricePerSlip || ''}</PricePerSlip>\n`;
    xml += '  </Metrics>\n';
    
    xml += `  <Metadata>\n`;
    xml += `    <ExportedAt>${data.metadata.exportedAt}</ExportedAt>\n`;
    xml += `    <Version>${data.metadata.version}</Version>\n`;
    xml += `  </Metadata>\n`;
    xml += '</ModelingProjectExport>';
    
    return xml;
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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
      entityType: 'api_export',
      entityId: projectId,
      newValue: details,
      userId
    });
  }
}

export const externalAPIService = new ExternalAPIService();
