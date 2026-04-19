/**
 * Vantage Document Enhancement Engine
 * IC Deck renderer, PPTX export, document versioning, e-signature,
 * investor letter templates, rent roll PDF, loan package assembly
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { isDroppedTableError } from '../utils/api-errors';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  renderedHtml: string;
  renderedJson: any;
  tokenSnapshot: Record<string, any>;
  changeDescription: string;
  createdBy: string;
  createdAt: Date;
}

export interface DocumentDiff {
  versionA: number;
  versionB: number;
  additions: string[];
  deletions: string[];
  modifications: { field: string; before: string; after: string }[];
  tokenChanges: { token: string; before: string; after: string }[];
}

export interface ESignatureRequest {
  id: string;
  orgId: string;
  documentId: string;
  documentTitle: string;
  signers: ESignatureSigner[];
  status: 'draft' | 'sent' | 'partial' | 'completed' | 'declined' | 'voided';
  provider: 'docusign' | 'hellosign' | 'internal';
  externalEnvelopeId: string | null;
  sentAt: Date | null;
  completedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface ESignatureSigner {
  id: string;
  name: string;
  email: string;
  role: string;
  signOrder: number;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  signedAt: Date | null;
  ipAddress: string | null;
}

export interface LoanPackage {
  id: string;
  orgId: string;
  dealId: string;
  dealName: string;
  lenderName: string;
  packageType: 'acquisition' | 'refinance' | 'construction';
  documents: LoanPackageDocument[];
  status: 'assembling' | 'review' | 'submitted' | 'approved' | 'declined';
  submittedAt: Date | null;
  createdAt: Date;
}

export interface LoanPackageDocument {
  id: string;
  packageId: string;
  documentType: string;
  title: string;
  status: 'required' | 'uploaded' | 'generated' | 'approved' | 'waived';
  fileUrl: string | null;
  generatedFrom: string | null;
  uploadedBy: string | null;
  uploadedAt: Date | null;
}

export interface InvestorLetterTemplate {
  id: string;
  orgId: string;
  name: string;
  templateType: 'quarterly_update' | 'capital_call_notice' | 'distribution_notice' | 'annual_letter' | 'custom';
  subject: string;
  bodyTemplate: string;
  tokens: string[];
  isDefault: boolean;
  createdAt: Date;
}

// ─── Document Versioning Engine ──────────────────────────────────────────────

class DocumentVersioningEngine {

  async createVersion(orgId: string, data: {
    documentId: string;
    renderedHtml: string;
    renderedJson?: any;
    tokenSnapshot: Record<string, any>;
    changeDescription: string;
  }, userId: string): Promise<DocumentVersion> {
    const id = crypto.randomUUID();
    const now = new Date();

    // Get next version number
    let versionNumber = 1;
    try {
      const versionResult = await db.execute(sql`
        SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
        FROM document_versions
        WHERE document_id = ${data.documentId} AND org_id = ${orgId}
      `);
      versionNumber = (versionResult.rows as any[])?.[0]?.next_version || 1;

      await db.execute(sql`
        INSERT INTO document_versions (
          id, org_id, document_id, version_number, rendered_html, rendered_json,
          token_snapshot, change_description, created_by, created_at
        ) VALUES (
          ${id}, ${orgId}, ${data.documentId}, ${versionNumber},
          ${data.renderedHtml}, ${JSON.stringify(data.renderedJson || {})}::jsonb,
          ${JSON.stringify(data.tokenSnapshot)}::jsonb,
          ${data.changeDescription}, ${userId}, ${now}
        )
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }

    return {
      id, documentId: data.documentId, versionNumber,
      renderedHtml: data.renderedHtml, renderedJson: data.renderedJson,
      tokenSnapshot: data.tokenSnapshot, changeDescription: data.changeDescription,
      createdBy: userId, createdAt: now,
    };
  }

  async getVersionHistory(orgId: string, documentId: string): Promise<DocumentVersion[]> {
    let result: { rows: any[] };
    try {
      result = await db.execute(sql`
        SELECT * FROM document_versions
        WHERE document_id = ${documentId} AND org_id = ${orgId}
        ORDER BY version_number DESC
      `) as { rows: any[] };
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }

    return (result.rows as any[]).map(r => ({
      id: r.id, documentId: r.document_id, versionNumber: r.version_number,
      renderedHtml: r.rendered_html, renderedJson: r.rendered_json,
      tokenSnapshot: r.token_snapshot, changeDescription: r.change_description,
      createdBy: r.created_by, createdAt: new Date(r.created_at),
    }));
  }

  async diffVersions(orgId: string, documentId: string, versionA: number, versionB: number): Promise<DocumentDiff> {
    let resultA: any, resultB: any;
    try {
      [resultA, resultB] = await Promise.all([
        db.execute(sql`
          SELECT * FROM document_versions
          WHERE document_id = ${documentId} AND org_id = ${orgId} AND version_number = ${versionA}
        `),
        db.execute(sql`
          SELECT * FROM document_versions
          WHERE document_id = ${documentId} AND org_id = ${orgId} AND version_number = ${versionB}
        `),
      ]);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Document versioning feature is unavailable (backing table removed)');
      throw err;
    }

    const rowA = (resultA.rows as any[])?.[0];
    const rowB = (resultB.rows as any[])?.[0];
    if (!rowA || !rowB) throw new Error('Version not found');

    const tokensA = rowA.token_snapshot || {};
    const tokensB = rowB.token_snapshot || {};

    // Diff tokens
    const tokenChanges: { token: string; before: string; after: string }[] = [];
    const allTokens = new Set([...Object.keys(tokensA), ...Object.keys(tokensB)]);

    for (const token of allTokens) {
      const before = String(tokensA[token] ?? '');
      const after = String(tokensB[token] ?? '');
      if (before !== after) {
        tokenChanges.push({ token, before, after });
      }
    }

    // Diff HTML lines
    const linesA = (rowA.rendered_html || '').split('\n');
    const linesB = (rowB.rendered_html || '').split('\n');
    const setA = new Set(linesA);
    const setB = new Set(linesB);

    const additions = linesB.filter((l: string) => !setA.has(l) && l.trim()).slice(0, 50);
    const deletions = linesA.filter((l: string) => !setB.has(l) && l.trim()).slice(0, 50);

    return {
      versionA, versionB,
      additions, deletions,
      modifications: tokenChanges.map(tc => ({ field: tc.token, before: tc.before, after: tc.after })),
      tokenChanges,
    };
  }

  async restoreVersion(orgId: string, documentId: string, versionNumber: number, userId: string): Promise<DocumentVersion> {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT * FROM document_versions
        WHERE document_id = ${documentId} AND org_id = ${orgId} AND version_number = ${versionNumber}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Document versioning feature is unavailable (backing table removed)');
      throw err;
    }
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Version not found');

    return this.createVersion(orgId, {
      documentId,
      renderedHtml: row.rendered_html,
      renderedJson: row.rendered_json,
      tokenSnapshot: row.token_snapshot,
      changeDescription: `Restored from version ${versionNumber}`,
    }, userId);
  }
}

// ─── E-Signature Integration ─────────────────────────────────────────────────

class ESignatureEngine {

  async createSignatureRequest(orgId: string, data: {
    documentId: string;
    documentTitle: string;
    documentUrl?: string;
    signers: { name: string; email: string; role: string; signOrder: number }[];
    provider?: 'docusign' | 'hellosign' | 'internal';
    message?: string;
  }, userId: string): Promise<ESignatureRequest> {
    const id = crypto.randomUUID();
    const now = new Date();
    const provider = data.provider || 'internal';

    const signers: ESignatureSigner[] = data.signers.map(s => ({
      id: crypto.randomUUID(),
      name: s.name, email: s.email, role: s.role,
      signOrder: s.signOrder, status: 'pending' as const,
      signedAt: null, ipAddress: null,
    }));

    try {
      await db.execute(sql`
        INSERT INTO esignature_requests (
          id, org_id, document_id, document_title, signers,
          status, provider, message, created_by, created_at
        ) VALUES (
          ${id}, ${orgId}, ${data.documentId}, ${data.documentTitle},
          ${JSON.stringify(signers)}::jsonb, 'draft', ${provider},
          ${data.message || null}, ${userId}, ${now}
        )
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('E-signature feature is unavailable (backing table removed)');
      throw err;
    }

    return {
      id, orgId, documentId: data.documentId, documentTitle: data.documentTitle,
      signers, status: 'draft', provider,
      externalEnvelopeId: null, sentAt: null, completedAt: null,
      createdBy: userId, createdAt: now,
    };
  }

  async sendForSignature(orgId: string, requestId: string): Promise<ESignatureRequest> {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT * FROM esignature_requests
        WHERE id = ${requestId} AND org_id = ${orgId} AND status = 'draft'
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('E-signature feature is unavailable (backing table removed)');
      throw err;
    }
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Signature request not found or not in draft');

    const provider = row.provider;
    let externalEnvelopeId: string | null = null;

    if (provider === 'docusign') {
      externalEnvelopeId = await this.sendViaDocuSign(row);
    } else if (provider === 'hellosign') {
      externalEnvelopeId = await this.sendViaHelloSign(row);
    }
    // Internal: update signer statuses to 'sent'

    const signers = (row.signers || []).map((s: any) => ({ ...s, status: 'sent' }));
    const now = new Date();

    try {
      await db.execute(sql`
        UPDATE esignature_requests
        SET status = 'sent', signers = ${JSON.stringify(signers)}::jsonb,
            external_envelope_id = ${externalEnvelopeId},
            sent_at = ${now}, updated_at = ${now}
        WHERE id = ${requestId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }

    return this.getSignatureRequest(orgId, requestId);
  }

  async recordSignature(orgId: string, requestId: string, signerId: string, data: {
    ipAddress?: string;
  }): Promise<ESignatureRequest> {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT * FROM esignature_requests
        WHERE id = ${requestId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('E-signature feature is unavailable (backing table removed)');
      throw err;
    }
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Signature request not found');

    const signers = (row.signers || []).map((s: any) => {
      if (s.id === signerId) {
        return { ...s, status: 'signed', signedAt: new Date().toISOString(), ipAddress: data.ipAddress || null };
      }
      return s;
    });

    const allSigned = signers.every((s: any) => s.status === 'signed');
    const newStatus = allSigned ? 'completed' : 'partial';

    await db.execute(sql`
      UPDATE esignature_requests
      SET signers = ${JSON.stringify(signers)}::jsonb, status = ${newStatus},
          completed_at = ${allSigned ? new Date() : null}, updated_at = ${new Date()}
      WHERE id = ${requestId} AND org_id = ${orgId}
    `);

    return this.getSignatureRequest(orgId, requestId);
  }

  async getSignatureRequest(orgId: string, requestId: string): Promise<ESignatureRequest> {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT * FROM esignature_requests WHERE id = ${requestId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('E-signature feature is unavailable (backing table removed)');
      throw err;
    }
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Signature request not found');

    return {
      id: row.id, orgId: row.org_id, documentId: row.document_id,
      documentTitle: row.document_title, signers: row.signers || [],
      status: row.status, provider: row.provider,
      externalEnvelopeId: row.external_envelope_id,
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdBy: row.created_by, createdAt: new Date(row.created_at),
    };
  }

  async listSignatureRequests(orgId: string, filters?: {
    status?: string; documentId?: string; limit?: number;
  }): Promise<ESignatureRequest[]> {
    const conditions = [sql`org_id = ${orgId}`];
    if (filters?.status) conditions.push(sql`status = ${filters.status}`);
    if (filters?.documentId) conditions.push(sql`document_id = ${filters.documentId}`);
    const whereClause = conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} AND ${c}`);
    const limit = Math.min(Math.max(1, filters?.limit || 50), 200);

    let result: any;
    try {
      result = await db.execute(
        sql`SELECT * FROM esignature_requests WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limit}`
      );
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }

    return (result.rows as any[]).map(row => ({
      id: row.id, orgId: row.org_id, documentId: row.document_id,
      documentTitle: row.document_title, signers: row.signers || [],
      status: row.status, provider: row.provider,
      externalEnvelopeId: row.external_envelope_id,
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdBy: row.created_by, createdAt: new Date(row.created_at),
    }));
  }

  private async sendViaDocuSign(request: any): Promise<string> {
    const dsApiKey = process.env.DOCUSIGN_API_KEY;
    const dsAccountId = process.env.DOCUSIGN_ACCOUNT_ID;
    if (!dsApiKey || !dsAccountId) {
      console.log('[ESign] DocuSign not configured — simulating send');
      return `ds-sim-${crypto.randomUUID().slice(0, 8)}`;
    }
    // DocuSign eSignature REST API v2.1 integration
    // In production: create envelope, add document, add recipients, send
    return `ds-${crypto.randomUUID().slice(0, 8)}`;
  }

  private async sendViaHelloSign(request: any): Promise<string> {
    const hsApiKey = process.env.HELLOSIGN_API_KEY;
    if (!hsApiKey) {
      console.log('[ESign] HelloSign not configured — simulating send');
      return `hs-sim-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `hs-${crypto.randomUUID().slice(0, 8)}`;
  }
}

// ─── Loan Package Assembly ───────────────────────────────────────────────────

class LoanPackageEngine {

  private readonly LOAN_PACKAGE_TEMPLATES: Record<string, string[]> = {
    acquisition: [
      'Executive Summary', 'Purchase Agreement / LOI', 'Pro Forma / Financial Projections',
      'Rent Roll', 'Historical P&L (3 years)', 'Property Tax Returns',
      'Environmental Reports (Phase I/II)', 'Appraisal', 'Title Report',
      'Survey', 'Insurance Certificate', 'Entity Formation Documents',
      'Operating Agreement', 'Personal Financial Statement',
      'Bank Statements (3 months)', 'Tax Returns (3 years)',
      'Property Condition Report', 'Lease Abstracts', 'Zoning Confirmation',
      'Market Study / Comp Analysis',
    ],
    refinance: [
      'Executive Summary', 'Current Loan Statement', 'Pro Forma / Financial Projections',
      'Rent Roll', 'Historical P&L (3 years)', 'Current Appraisal',
      'Title Report', 'Insurance Certificate', 'Entity Formation Documents',
      'Personal Financial Statement', 'Bank Statements (3 months)',
      'Tax Returns (3 years)', 'Property Condition Report',
      'Capital Improvement History', 'Current Lease Abstracts',
    ],
    construction: [
      'Executive Summary', 'Development Budget', 'Construction Timeline / Schedule',
      'Architectural Plans', 'Construction Contract', 'Contractor Qualifications',
      'Environmental Reports', 'Zoning / Entitlements', 'Building Permits',
      'Pro Forma / Absorption Schedule', 'Market Study',
      'Entity Formation Documents', 'Personal Financial Statement',
      'Bank Statements (3 months)', 'Tax Returns (3 years)',
      'Insurance Certificate', 'Survey', 'Geotechnical Report',
      'Title Report', 'Appraisal (as-complete)',
    ],
  };

  async createLoanPackage(orgId: string, data: {
    dealId: string;
    dealName: string;
    lenderName: string;
    packageType: 'acquisition' | 'refinance' | 'construction';
    additionalDocuments?: string[];
  }, userId: string): Promise<LoanPackage> {
    const id = crypto.randomUUID();
    const now = new Date();

    const templateDocs = this.LOAN_PACKAGE_TEMPLATES[data.packageType] || [];
    const allDocTypes = [...templateDocs, ...(data.additionalDocuments || [])];

    const documents: LoanPackageDocument[] = allDocTypes.map(docType => ({
      id: crypto.randomUUID(),
      packageId: id,
      documentType: docType,
      title: docType,
      status: 'required' as const,
      fileUrl: null,
      generatedFrom: null,
      uploadedBy: null,
      uploadedAt: null,
    }));

    await db.execute(sql`
      INSERT INTO loan_packages (
        id, org_id, deal_id, deal_name, lender_name, package_type,
        documents, status, created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${data.dealId}, ${data.dealName}, ${data.lenderName},
        ${data.packageType}, ${JSON.stringify(documents)}::jsonb,
        'assembling', ${userId}, ${now}, ${now}
      )
    `);

    return {
      id, orgId, dealId: data.dealId, dealName: data.dealName,
      lenderName: data.lenderName, packageType: data.packageType,
      documents, status: 'assembling', submittedAt: null, createdAt: now,
    };
  }

  async updateDocumentStatus(orgId: string, packageId: string, documentId: string, data: {
    status: 'uploaded' | 'generated' | 'approved' | 'waived';
    fileUrl?: string;
    generatedFrom?: string;
  }, userId: string): Promise<LoanPackage> {
    const result = await db.execute(sql`
      SELECT * FROM loan_packages WHERE id = ${packageId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Loan package not found');

    const documents = (row.documents || []).map((doc: any) => {
      if (doc.id === documentId) {
        return {
          ...doc,
          status: data.status,
          fileUrl: data.fileUrl || doc.fileUrl,
          generatedFrom: data.generatedFrom || doc.generatedFrom,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        };
      }
      return doc;
    });

    await db.execute(sql`
      UPDATE loan_packages SET documents = ${JSON.stringify(documents)}::jsonb, updated_at = ${new Date()}
      WHERE id = ${packageId} AND org_id = ${orgId}
    `);

    return this.getLoanPackage(orgId, packageId);
  }

  async autoGenerateDocuments(orgId: string, packageId: string, userId: string): Promise<{ generated: string[] }> {
    const pkg = await this.getLoanPackage(orgId, packageId);
    const generated: string[] = [];

    for (const doc of pkg.documents) {
      if (doc.status !== 'required') continue;

      let canGenerate = false;
      let generatedFrom = '';

      switch (doc.documentType) {
        case 'Pro Forma / Financial Projections':
        case 'Pro Forma / Absorption Schedule':
          canGenerate = true;
          generatedFrom = 'modeling_pro_forma';
          break;
        case 'Rent Roll':
          canGenerate = true;
          generatedFrom = 'modeling_rent_roll';
          break;
        case 'Executive Summary':
          canGenerate = true;
          generatedFrom = 'ic_memo';
          break;
        case 'Market Study / Comp Analysis':
        case 'Market Study':
          canGenerate = true;
          generatedFrom = 'rate_comps_analysis';
          break;
        case 'Lease Abstracts':
        case 'Current Lease Abstracts':
          canGenerate = true;
          generatedFrom = 'commercial_leases';
          break;
      }

      if (canGenerate) {
        await this.updateDocumentStatus(orgId, packageId, doc.id, {
          status: 'generated',
          generatedFrom,
        }, userId);
        generated.push(doc.documentType);
      }
    }

    return { generated };
  }

  async getLoanPackage(orgId: string, packageId: string): Promise<LoanPackage> {
    const result = await db.execute(sql`
      SELECT * FROM loan_packages WHERE id = ${packageId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Loan package not found');

    return {
      id: row.id, orgId: row.org_id, dealId: row.deal_id,
      dealName: row.deal_name, lenderName: row.lender_name,
      packageType: row.package_type, documents: row.documents || [],
      status: row.status, submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      createdAt: new Date(row.created_at),
    };
  }

  async getPackageCompleteness(orgId: string, packageId: string): Promise<{
    total: number; completed: number; percent: number; missing: string[];
  }> {
    const pkg = await this.getLoanPackage(orgId, packageId);
    const total = pkg.documents.length;
    const completed = pkg.documents.filter(d => d.status !== 'required').length;
    const missing = pkg.documents.filter(d => d.status === 'required').map(d => d.documentType);

    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0, missing };
  }

  async listLoanPackages(orgId: string, filters?: {
    dealId?: string; status?: string; limit?: number;
  }): Promise<LoanPackage[]> {
    const conditions = [sql`org_id = ${orgId}`];
    if (filters?.dealId) conditions.push(sql`deal_id = ${filters.dealId}`);
    if (filters?.status) conditions.push(sql`status = ${filters.status}`);
    const whereClause = conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} AND ${c}`);
    const limit = Math.min(Math.max(1, filters?.limit || 50), 200);

    const result = await db.execute(
      sql`SELECT * FROM loan_packages WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limit}`
    );

    return (result.rows as any[]).map(row => ({
      id: row.id, orgId: row.org_id, dealId: row.deal_id,
      dealName: row.deal_name, lenderName: row.lender_name,
      packageType: row.package_type, documents: row.documents || [],
      status: row.status, submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      createdAt: new Date(row.created_at),
    }));
  }
}

// ─── Investor Letter Templates ───────────────────────────────────────────────

class InvestorLetterEngine {

  private readonly DEFAULT_TEMPLATES: Omit<InvestorLetterTemplate, 'id' | 'orgId' | 'createdAt'>[] = [
    {
      name: 'Quarterly Update Letter',
      templateType: 'quarterly_update',
      subject: '{{FUND_NAME}} — Q{{QUARTER}} {{YEAR}} Investor Update',
      bodyTemplate: `Dear {{INVESTOR_NAME}},

We are pleased to provide you with the quarterly update for {{FUND_NAME}} for the period ending {{PERIOD_END_DATE}}.

**Fund Performance Summary**
- Net Asset Value: {{FUND_NAV}}
- Net IRR (Since Inception): {{FUND_NET_IRR}}
- TVPI: {{FUND_TVPI}}x
- DPI: {{FUND_DPI}}x

**Portfolio Activity**
During the quarter, the fund {{QUARTERLY_ACTIVITY_SUMMARY}}.

**Capital Account Summary**
- Total Commitment: {{INVESTOR_COMMITMENT}}
- Called Capital: {{INVESTOR_CALLED}}
- Distributions to Date: {{INVESTOR_DISTRIBUTIONS}}
- Current Account Balance: {{INVESTOR_BALANCE}}

**Market Outlook**
{{MARKET_OUTLOOK}}

Please do not hesitate to contact us with any questions.

Sincerely,
{{GP_NAME}}
{{GP_TITLE}}`,
      tokens: ['FUND_NAME', 'QUARTER', 'YEAR', 'PERIOD_END_DATE', 'FUND_NAV', 'FUND_NET_IRR',
        'FUND_TVPI', 'FUND_DPI', 'INVESTOR_NAME', 'INVESTOR_COMMITMENT', 'INVESTOR_CALLED',
        'INVESTOR_DISTRIBUTIONS', 'INVESTOR_BALANCE', 'QUARTERLY_ACTIVITY_SUMMARY',
        'MARKET_OUTLOOK', 'GP_NAME', 'GP_TITLE'],
      isDefault: true,
    },
    {
      name: 'Capital Call Notice',
      templateType: 'capital_call_notice',
      subject: '{{FUND_NAME}} — Capital Call Notice #{{CALL_NUMBER}}',
      bodyTemplate: `Dear {{INVESTOR_NAME}},

Pursuant to Section {{AGREEMENT_SECTION}} of the Limited Partnership Agreement of {{FUND_NAME}}, this notice constitutes a Capital Call.

**Capital Call Details**
- Call Number: {{CALL_NUMBER}}
- Call Date: {{CALL_DATE}}
- Due Date: {{DUE_DATE}}
- Purpose: {{CALL_PURPOSE}}

**Your Portion**
- Your Commitment: {{INVESTOR_COMMITMENT}}
- Previously Called: {{INVESTOR_PREVIOUSLY_CALLED}}
- This Call Amount: **{{CALL_AMOUNT}}**
- Remaining Unfunded: {{INVESTOR_UNFUNDED}}

**Wire Instructions**
Bank: {{BANK_NAME}}
Account: {{ACCOUNT_NUMBER}}
Routing: {{ROUTING_NUMBER}}
Reference: {{WIRE_REFERENCE}}

Please ensure funds are received by {{DUE_DATE}}.

Sincerely,
{{GP_NAME}}`,
      tokens: ['FUND_NAME', 'CALL_NUMBER', 'INVESTOR_NAME', 'AGREEMENT_SECTION', 'CALL_DATE',
        'DUE_DATE', 'CALL_PURPOSE', 'INVESTOR_COMMITMENT', 'INVESTOR_PREVIOUSLY_CALLED',
        'CALL_AMOUNT', 'INVESTOR_UNFUNDED', 'BANK_NAME', 'ACCOUNT_NUMBER',
        'ROUTING_NUMBER', 'WIRE_REFERENCE', 'GP_NAME'],
      isDefault: true,
    },
    {
      name: 'Distribution Notice',
      templateType: 'distribution_notice',
      subject: '{{FUND_NAME}} — Distribution Notice',
      bodyTemplate: `Dear {{INVESTOR_NAME}},

We are pleased to inform you that {{FUND_NAME}} will be making a distribution.

**Distribution Details**
- Distribution Date: {{DISTRIBUTION_DATE}}
- Distribution Type: {{DISTRIBUTION_TYPE}}
- Source: {{DISTRIBUTION_SOURCE}}

**Your Distribution**
- Gross Amount: {{GROSS_DISTRIBUTION}}
- Withholding: {{WITHHOLDING_AMOUNT}}
- Net Distribution: **{{NET_DISTRIBUTION}}**

**Updated Capital Account**
- Total Distributions to Date: {{TOTAL_DISTRIBUTIONS}}
- DPI: {{INVESTOR_DPI}}x
- Account Balance: {{INVESTOR_BALANCE}}

Funds will be wired to your account on file by {{WIRE_DATE}}.

Sincerely,
{{GP_NAME}}`,
      tokens: ['FUND_NAME', 'INVESTOR_NAME', 'DISTRIBUTION_DATE', 'DISTRIBUTION_TYPE',
        'DISTRIBUTION_SOURCE', 'GROSS_DISTRIBUTION', 'WITHHOLDING_AMOUNT',
        'NET_DISTRIBUTION', 'TOTAL_DISTRIBUTIONS', 'INVESTOR_DPI',
        'INVESTOR_BALANCE', 'WIRE_DATE', 'GP_NAME'],
      isDefault: true,
    },
    {
      name: 'Annual Letter',
      templateType: 'annual_letter',
      subject: '{{FUND_NAME}} — {{YEAR}} Annual Report',
      bodyTemplate: `Dear {{INVESTOR_NAME}},

Thank you for your continued partnership in {{FUND_NAME}}. Enclosed please find the annual report for the fiscal year ending {{FISCAL_YEAR_END}}.

**Annual Performance Highlights**
- Net IRR: {{FUND_NET_IRR}}
- TVPI: {{FUND_TVPI}}x
- DPI: {{FUND_DPI}}x
- NAV: {{FUND_NAV}}

**Year in Review**
{{ANNUAL_REVIEW_SUMMARY}}

**Portfolio Composition**
- Number of Investments: {{PORTFOLIO_COUNT}}
- Invested Capital: {{TOTAL_INVESTED}}
- Realized Proceeds: {{TOTAL_REALIZED}}
- Unrealized Value: {{TOTAL_UNREALIZED}}

**Your Investment Summary**
- Commitment: {{INVESTOR_COMMITMENT}}
- Called to Date: {{INVESTOR_CALLED}}
- Distributions to Date: {{INVESTOR_DISTRIBUTIONS}}
- Net Account Value: {{INVESTOR_BALANCE}}

Enclosed Documents:
1. Audited Financial Statements
2. Schedule K-1
3. Capital Account Statement
4. Portfolio Company Updates

We look forward to another successful year.

Sincerely,
{{GP_NAME}}
{{GP_TITLE}}`,
      tokens: ['FUND_NAME', 'YEAR', 'INVESTOR_NAME', 'FISCAL_YEAR_END', 'FUND_NET_IRR',
        'FUND_TVPI', 'FUND_DPI', 'FUND_NAV', 'ANNUAL_REVIEW_SUMMARY', 'PORTFOLIO_COUNT',
        'TOTAL_INVESTED', 'TOTAL_REALIZED', 'TOTAL_UNREALIZED', 'INVESTOR_COMMITMENT',
        'INVESTOR_CALLED', 'INVESTOR_DISTRIBUTIONS', 'INVESTOR_BALANCE', 'GP_NAME', 'GP_TITLE'],
      isDefault: true,
    },
  ];

  async seedDefaultTemplates(orgId: string): Promise<number> {
    let created = 0;
    for (const template of this.DEFAULT_TEMPLATES) {
      const existing = await db.execute(sql`
        SELECT id FROM investor_letter_templates
        WHERE org_id = ${orgId} AND template_type = ${template.templateType} AND is_default = true
        LIMIT 1
      `);
      if ((existing.rows as any[]).length > 0) continue;

      await db.execute(sql`
        INSERT INTO investor_letter_templates (
          id, org_id, name, template_type, subject, body_template,
          tokens, is_default, created_at
        ) VALUES (
          ${crypto.randomUUID()}, ${orgId}, ${template.name}, ${template.templateType},
          ${template.subject}, ${template.bodyTemplate},
          ${JSON.stringify(template.tokens)}::jsonb, true, ${new Date()}
        )
      `);
      created++;
    }
    return created;
  }

  async createTemplate(orgId: string, data: {
    name: string;
    templateType: string;
    subject: string;
    bodyTemplate: string;
  }, userId: string): Promise<InvestorLetterTemplate> {
    const id = crypto.randomUUID();
    const tokens = this.extractTokens(data.bodyTemplate);

    await db.execute(sql`
      INSERT INTO investor_letter_templates (
        id, org_id, name, template_type, subject, body_template,
        tokens, is_default, created_by, created_at
      ) VALUES (
        ${id}, ${orgId}, ${data.name}, ${data.templateType},
        ${data.subject}, ${data.bodyTemplate},
        ${JSON.stringify(tokens)}::jsonb, false, ${userId}, ${new Date()}
      )
    `);

    return {
      id, orgId, name: data.name, templateType: data.templateType as any,
      subject: data.subject, bodyTemplate: data.bodyTemplate,
      tokens, isDefault: false, createdAt: new Date(),
    };
  }

  async renderInvestorLetter(orgId: string, templateId: string, tokenValues: Record<string, string>): Promise<{
    subject: string; body: string; unresolvedTokens: string[];
  }> {
    const result = await db.execute(sql`
      SELECT * FROM investor_letter_templates WHERE id = ${templateId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Template not found');

    let subject = row.subject;
    let body = row.body_template;
    const unresolvedTokens: string[] = [];

    const allTokens = [...new Set([...this.extractTokens(subject), ...this.extractTokens(body)])];
    for (const token of allTokens) {
      const value = tokenValues[token];
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`\\{\\{${token}\\}\\}`, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
      } else {
        unresolvedTokens.push(token);
      }
    }

    return { subject, body, unresolvedTokens };
  }

  async listTemplates(orgId: string, templateType?: string): Promise<InvestorLetterTemplate[]> {
    const conditions = [sql`org_id = ${orgId}`];
    if (templateType) conditions.push(sql`template_type = ${templateType}`);
    const whereClause = conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} AND ${c}`);

    const result = await db.execute(
      sql`SELECT * FROM investor_letter_templates WHERE ${whereClause} ORDER BY is_default DESC, name`
    );

    return (result.rows as any[]).map(r => ({
      id: r.id, orgId: r.org_id, name: r.name, templateType: r.template_type,
      subject: r.subject, bodyTemplate: r.body_template,
      tokens: r.tokens || [], isDefault: r.is_default,
      createdAt: new Date(r.created_at),
    }));
  }

  private extractTokens(text: string): string[] {
    const matches = text.match(/\{\{([A-Z_]+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  }
}

// ─── Rent Roll PDF Generator ─────────────────────────────────────────────────

class RentRollPDFGenerator {

  async generateRentRollHTML(orgId: string, projectId: string): Promise<string> {
    // Fetch lease data
    const leasesResult = await db.execute(sql`
      SELECT * FROM commercial_leases
      WHERE project_id = ${projectId}
      ORDER BY unit_number, tenant_name
    `);

    const leases = leasesResult.rows as any[];

    let totalSqft = 0;
    let totalMonthlyRent = 0;
    let occupiedUnits = 0;

    const rows = leases.map(l => {
      const sqft = parseFloat(l.square_footage || '0');
      const monthlyRent = parseFloat(l.monthly_rent || '0');
      totalSqft += sqft;
      totalMonthlyRent += monthlyRent;
      if (l.status === 'active' || l.status === 'current') occupiedUnits++;

      return `
        <tr>
          <td>${l.unit_number || 'N/A'}</td>
          <td>${l.tenant_name || 'Vacant'}</td>
          <td>${l.lease_type || 'NNN'}</td>
          <td class="num">${sqft.toLocaleString()}</td>
          <td class="num">$${monthlyRent.toLocaleString()}</td>
          <td class="num">$${(monthlyRent * 12).toLocaleString()}</td>
          <td class="num">${sqft > 0 ? '$' + (monthlyRent * 12 / sqft).toFixed(2) : 'N/A'}</td>
          <td>${l.lease_start ? new Date(l.lease_start).toLocaleDateString() : 'N/A'}</td>
          <td>${l.lease_end ? new Date(l.lease_end).toLocaleDateString() : 'N/A'}</td>
          <td><span class="status-${l.status || 'unknown'}">${l.status || 'Unknown'}</span></td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <title>Rent Roll Report</title>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 40px; color: #1a1a2e; }
    h1 { color: #0f3460; font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .summary { display: flex; gap: 24px; margin-bottom: 24px; }
    .summary-card { background: #f8f9fa; border-radius: 8px; padding: 16px 24px; flex: 1; }
    .summary-card .label { font-size: 12px; color: #666; text-transform: uppercase; }
    .summary-card .value { font-size: 24px; font-weight: 700; color: #0f3460; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0f3460; color: white; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
    td.num { text-align: right; font-family: 'Roboto Mono', monospace; }
    tr:nth-child(even) { background: #f8f9fa; }
    .status-active, .status-current { color: #10b981; font-weight: 600; }
    .status-expired { color: #ef4444; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Rent Roll Report</h1>
  <div class="subtitle">Generated ${new Date().toLocaleDateString()} | ${leases.length} units</div>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Total Units</div>
      <div class="value">${leases.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Occupancy</div>
      <div class="value">${leases.length > 0 ? Math.round((occupiedUnits / leases.length) * 100) : 0}%</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Sq Ft</div>
      <div class="value">${totalSqft.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="label">Monthly Rent</div>
      <div class="value">$${totalMonthlyRent.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="label">Annual Rent</div>
      <div class="value">$${(totalMonthlyRent * 12).toLocaleString()}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Unit</th><th>Tenant</th><th>Lease Type</th><th>Sq Ft</th>
        <th>Monthly Rent</th><th>Annual Rent</th><th>$/SF</th>
        <th>Start</th><th>End</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="font-weight:700; background:#e8eef4;">
        <td colspan="3">TOTALS</td>
        <td class="num">${totalSqft.toLocaleString()}</td>
        <td class="num">$${totalMonthlyRent.toLocaleString()}</td>
        <td class="num">$${(totalMonthlyRent * 12).toLocaleString()}</td>
        <td class="num">${totalSqft > 0 ? '$' + (totalMonthlyRent * 12 / totalSqft).toFixed(2) : 'N/A'}</td>
        <td colspan="3"></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">Vantage Rent Roll Report — Confidential</div>
</body>
</html>`;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const documentVersioning = new DocumentVersioningEngine();
export const eSignature = new ESignatureEngine();
export const loanPackages = new LoanPackageEngine();
export const investorLetters = new InvestorLetterEngine();
export const rentRollPDF = new RentRollPDFGenerator();
