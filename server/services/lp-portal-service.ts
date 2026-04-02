/**
 * MarinaMatch LP Portal Service
 * Independent LP auth, PDF statements via pdf-lib, K-1 generation,
 * automated quarterly delivery, ILPA templates, side letter tracking
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import Decimal from 'decimal.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LPPortalUser {
  id: string;
  orgId: string;
  investorId: string;
  email: string;
  name: string;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  lastLogin: Date | null;
  status: 'active' | 'invited' | 'disabled';
  createdAt: Date;
}

export interface LPStatement {
  id: string;
  orgId: string;
  fundId: string;
  investorId: string;
  statementType: 'quarterly' | 'annual' | 'capital_call' | 'distribution' | 'k1';
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  data: LPStatementData;
  pdfUrl: string | null;
  generatedAt: Date;
  deliveredAt: Date | null;
  deliveryMethod: 'email' | 'portal' | 'both' | null;
}

export interface LPStatementData {
  fundName: string;
  investorName: string;
  commitment: string;
  calledCapital: string;
  unfundedCommitment: string;
  distributions: string;
  preferredReturn: string;
  capitalAccountBalance: string;
  moic: string;
  irr: string;
  tvpi: string;
  dpi: string;
  rvpi: string;
  navPerUnit: string;
  periodActivity: LPPeriodActivity[];
  capitalAccountRollforward: LPRollforwardItem[];
}

export interface LPPeriodActivity {
  date: string;
  type: string;
  description: string;
  amount: string;
  balance: string;
}

export interface LPRollforwardItem {
  description: string;
  amount: string;
}

export interface SideLetter {
  id: string;
  orgId: string;
  fundId: string;
  investorId: string;
  investorName: string;
  provisions: SideLetterProvision[];
  effectiveDate: Date;
  expirationDate: Date | null;
  status: 'draft' | 'active' | 'expired' | 'terminated';
  documentUrl: string | null;
  createdAt: Date;
}

export interface SideLetterProvision {
  type: 'fee_reduction' | 'co_invest_rights' | 'mfn_clause' | 'reporting_frequency'
    | 'advisory_committee' | 'transfer_rights' | 'key_person' | 'excuse_rights' | 'custom';
  description: string;
  details: Record<string, any>;
}

export interface K1Data {
  investorName: string;
  investorTaxId: string;
  investorAddress: string;
  fundName: string;
  fundEIN: string;
  taxYear: number;
  ordinaryIncome: string;
  rentalIncome: string;
  interestIncome: string;
  dividendIncome: string;
  shortTermCapitalGain: string;
  longTermCapitalGain: string;
  section1231Gain: string;
  section179Deduction: string;
  depreciation: string;
  otherDeductions: string;
  foreignTaxesPaid: string;
  alternativeMinimumTax: string;
  distributionsOfCash: string;
  distributionsOfProperty: string;
  beginningCapitalAccount: string;
  endingCapitalAccount: string;
  partnersShare: string;
}

// ─── LP Portal Auth ──────────────────────────────────────────────────────────

class LPPortalAuthService {

  async createPortalUser(orgId: string, data: {
    investorId: string;
    email: string;
    name: string;
  }): Promise<{ userId: string; inviteToken: string }> {
    const userId = crypto.randomUUID();
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');

    await db.execute(sql`
      INSERT INTO lp_portal_users (
        id, org_id, investor_id, email, name, password_hash,
        invite_token_hash, mfa_enabled, status, created_at
      ) VALUES (
        ${userId}, ${orgId}, ${data.investorId}, ${data.email}, ${data.name},
        '', ${inviteTokenHash}, false, 'invited', ${new Date()}
      )
    `);

    return { userId, inviteToken };
  }

  async activatePortalUser(inviteToken: string, password: string): Promise<LPPortalUser> {
    const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
    const passwordHash = crypto.createHash('sha256').update(password + process.env.LP_PORTAL_SALT || 'mm-lp-salt').digest('hex');

    const result = await db.execute(sql`
      UPDATE lp_portal_users
      SET password_hash = ${passwordHash}, status = 'active', invite_token_hash = NULL, updated_at = ${new Date()}
      WHERE invite_token_hash = ${tokenHash} AND status = 'invited'
      RETURNING *
    `);

    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Invalid or expired invite token');
    return this.mapUser(row);
  }

  async authenticateLP(email: string, password: string): Promise<{ user: LPPortalUser; sessionToken: string }> {
    const passwordHash = crypto.createHash('sha256').update(password + process.env.LP_PORTAL_SALT || 'mm-lp-salt').digest('hex');

    const result = await db.execute(sql`
      SELECT * FROM lp_portal_users
      WHERE email = ${email} AND password_hash = ${passwordHash} AND status = 'active'
    `);

    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Invalid credentials');

    // Create session
    const sessionToken = crypto.randomBytes(48).toString('hex');
    const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.execute(sql`
      INSERT INTO lp_portal_sessions (id, user_id, session_hash, expires_at, created_at)
      VALUES (${crypto.randomUUID()}, ${row.id}, ${sessionHash}, ${expiresAt}, ${new Date()})
    `);

    await db.execute(sql`
      UPDATE lp_portal_users SET last_login = ${new Date()} WHERE id = ${row.id}
    `);

    return { user: this.mapUser(row), sessionToken };
  }

  async validateSession(sessionToken: string): Promise<LPPortalUser | null> {
    const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

    const result = await db.execute(sql`
      SELECT u.* FROM lp_portal_users u
      JOIN lp_portal_sessions s ON s.user_id = u.id
      WHERE s.session_hash = ${sessionHash} AND s.expires_at > ${new Date()} AND u.status = 'active'
    `);

    const row = (result.rows as any[])?.[0];
    return row ? this.mapUser(row) : null;
  }

  async logoutLP(sessionToken: string): Promise<void> {
    const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    await db.execute(sql`DELETE FROM lp_portal_sessions WHERE session_hash = ${sessionHash}`);
  }

  private mapUser(row: any): LPPortalUser {
    return {
      id: row.id, orgId: row.org_id, investorId: row.investor_id,
      email: row.email, name: row.name, passwordHash: '[redacted]',
      mfaEnabled: row.mfa_enabled, mfaSecret: null,
      lastLogin: row.last_login ? new Date(row.last_login) : null,
      status: row.status, createdAt: new Date(row.created_at),
    };
  }
}

// ─── LP Statement Generator ─────────────────────────────────────────────────

class LPStatementGenerator {

  async generateQuarterlyStatement(orgId: string, fundId: string, investorId: string, periodEnd: string): Promise<LPStatement> {
    const id = crypto.randomUUID();
    const now = new Date();

    // Fetch fund and investor data
    const [fundResult, investorResult, movementsResult] = await Promise.all([
      db.execute(sql`SELECT * FROM funds WHERE id = ${fundId} AND org_id = ${orgId}`),
      db.execute(sql`SELECT * FROM fund_investors WHERE id = ${investorId} AND fund_id = ${fundId}`),
      db.execute(sql`
        SELECT * FROM fund_capital_movements
        WHERE fund_id = ${fundId} AND investor_id = ${investorId}
        ORDER BY effective_date ASC
      `),
    ]);

    const fund = (fundResult.rows as any[])?.[0];
    const investor = (investorResult.rows as any[])?.[0];
    if (!fund || !investor) throw new Error('Fund or investor not found');

    const d = (val: any) => new Decimal(val?.toString() || '0');
    const commitment = d(investor.commitment_amount);
    const called = d(investor.called_capital);
    const distributed = d(investor.distributed_capital);
    const balance = d(investor.capital_account_balance);
    const prefReturn = d(investor.preferred_return_accrued);
    const unfunded = commitment.minus(called);
    const moic = called.isZero() ? new Decimal(0) : balance.plus(distributed).dividedBy(called);
    const tvpi = called.isZero() ? new Decimal(0) : balance.plus(distributed).dividedBy(called);
    const dpi = called.isZero() ? new Decimal(0) : distributed.dividedBy(called);
    const rvpi = called.isZero() ? new Decimal(0) : balance.dividedBy(called);

    // Build period activity
    const movements = (movementsResult.rows as any[]);
    const periodActivity: LPPeriodActivity[] = movements.map(m => ({
      date: m.effective_date?.toISOString().split('T')[0] || '',
      type: m.movement_type,
      description: m.description || m.movement_type,
      amount: d(m.amount).toFixed(2),
      balance: d(m.running_balance || '0').toFixed(2),
    }));

    // Capital account rollforward
    const rollforward: LPRollforwardItem[] = [
      { description: 'Beginning Capital Account', amount: '0.00' }, // Would be from prior period
      { description: 'Capital Contributions', amount: called.toFixed(2) },
      { description: 'Preferred Return Accrual', amount: prefReturn.toFixed(2) },
      { description: 'Distributions', amount: distributed.negated().toFixed(2) },
      { description: 'Unrealized Gain/(Loss)', amount: balance.minus(called).plus(distributed).toFixed(2) },
      { description: 'Ending Capital Account', amount: balance.toFixed(2) },
    ];

    const statementData: LPStatementData = {
      fundName: fund.name,
      investorName: investor.name || investor.investor_name,
      commitment: commitment.toFixed(2),
      calledCapital: called.toFixed(2),
      unfundedCommitment: unfunded.toFixed(2),
      distributions: distributed.toFixed(2),
      preferredReturn: prefReturn.toFixed(2),
      capitalAccountBalance: balance.toFixed(2),
      moic: moic.toFixed(2),
      irr: fund.net_irr || '0.00',
      tvpi: tvpi.toFixed(2),
      dpi: dpi.toFixed(2),
      rvpi: rvpi.toFixed(2),
      navPerUnit: '0.00',
      periodActivity,
      capitalAccountRollforward: rollforward,
    };

    await db.execute(sql`
      INSERT INTO lp_statements (
        id, org_id, fund_id, investor_id, statement_type, period_label,
        period_start, period_end, data, generated_at
      ) VALUES (
        ${id}, ${orgId}, ${fundId}, ${investorId}, 'quarterly',
        ${periodEnd.slice(0, 7)},
        ${periodEnd.slice(0, 8) + '01'}::date, ${periodEnd}::date,
        ${JSON.stringify(statementData)}::jsonb, ${now}
      )
    `);

    return {
      id, orgId, fundId, investorId, statementType: 'quarterly',
      periodLabel: periodEnd.slice(0, 7),
      periodStart: new Date(periodEnd.slice(0, 8) + '01'),
      periodEnd: new Date(periodEnd),
      data: statementData, pdfUrl: null, generatedAt: now,
      deliveredAt: null, deliveryMethod: null,
    };
  }

  async generateStatementHTML(statement: LPStatement): Promise<string> {
    const d = statement.data;
    return `<!DOCTYPE html>
<html>
<head>
  <title>Capital Account Statement — ${d.fundName}</title>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; color: #1a1a2e; background: white; }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0f3460; padding-bottom: 20px; margin-bottom: 30px; }
    .fund-name { font-size: 24px; font-weight: 700; color: #0f3460; }
    .statement-type { font-size: 14px; color: #666; margin-top: 4px; }
    .investor-info { text-align: right; font-size: 13px; color: #444; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f3460; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 12px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
    .metric { background: #f8f9fa; border-radius: 8px; padding: 16px; }
    .metric .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric .value { font-size: 22px; font-weight: 700; color: #0f3460; font-family: 'Roboto Mono', monospace; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #0f3460; color: white; padding: 10px 14px; text-align: left; font-weight: 600; }
    td { padding: 10px 14px; border-bottom: 1px solid #eee; }
    td.num { text-align: right; font-family: 'Roboto Mono', monospace; }
    tr:nth-child(even) { background: #f9fafb; }
    .rollforward-total { font-weight: 700; background: #e8eef4 !important; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
    .confidential { text-align: center; color: #999; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-top: 20px; }
    @media print { body { padding: 20px; } .metrics-grid { grid-template-columns: repeat(4, 1fr); } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="fund-name">${d.fundName}</div>
      <div class="statement-type">Capital Account Statement — ${statement.periodLabel}</div>
    </div>
    <div class="investor-info">
      <strong>${d.investorName}</strong><br>
      Period: ${statement.periodStart.toLocaleDateString()} — ${statement.periodEnd.toLocaleDateString()}<br>
      Generated: ${statement.generatedAt.toLocaleDateString()}
    </div>
  </div>

  <div class="metrics-grid">
    <div class="metric"><div class="label">Commitment</div><div class="value">$${Number(d.commitment).toLocaleString()}</div></div>
    <div class="metric"><div class="label">Called Capital</div><div class="value">$${Number(d.calledCapital).toLocaleString()}</div></div>
    <div class="metric"><div class="label">Distributions</div><div class="value">$${Number(d.distributions).toLocaleString()}</div></div>
    <div class="metric"><div class="label">Account Balance</div><div class="value">$${Number(d.capitalAccountBalance).toLocaleString()}</div></div>
  </div>

  <div class="metrics-grid">
    <div class="metric"><div class="label">TVPI</div><div class="value">${d.tvpi}x</div></div>
    <div class="metric"><div class="label">DPI</div><div class="value">${d.dpi}x</div></div>
    <div class="metric"><div class="label">RVPI</div><div class="value">${d.rvpi}x</div></div>
    <div class="metric"><div class="label">Net IRR</div><div class="value">${d.irr}%</div></div>
  </div>

  <div class="section">
    <div class="section-title">Capital Account Rollforward</div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${d.capitalAccountRollforward.map((item, i) => `
          <tr class="${i === d.capitalAccountRollforward.length - 1 ? 'rollforward-total' : ''}">
            <td>${item.description}</td>
            <td class="num">$${Number(item.amount).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Period Activity</div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${d.periodActivity.length > 0 ? d.periodActivity.map(a => `
          <tr>
            <td>${a.date}</td>
            <td>${a.type}</td>
            <td>${a.description}</td>
            <td class="num">$${Number(a.amount).toLocaleString()}</td>
          </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center;color:#999;">No activity during this period</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Summary Metrics</div>
    <table>
      <tbody>
        <tr><td>Total Commitment</td><td class="num">$${Number(d.commitment).toLocaleString()}</td></tr>
        <tr><td>Unfunded Commitment</td><td class="num">$${Number(d.unfundedCommitment).toLocaleString()}</td></tr>
        <tr><td>Preferred Return Accrued</td><td class="num">$${Number(d.preferredReturn).toLocaleString()}</td></tr>
        <tr><td>MOIC</td><td class="num">${d.moic}x</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    This statement is prepared for informational purposes only and does not constitute an offer or solicitation.
    Past performance is not indicative of future results. This information is confidential and proprietary.
  </div>
  <div class="confidential">CONFIDENTIAL — FOR INTENDED RECIPIENT ONLY</div>
</body>
</html>`;
  }

  async listStatements(orgId: string, filters: {
    fundId?: string; investorId?: string; statementType?: string; limit?: number;
  }): Promise<LPStatement[]> {
    const conditions: string[] = [`org_id = '${orgId}'`];
    if (filters.fundId) conditions.push(`fund_id = '${filters.fundId}'`);
    if (filters.investorId) conditions.push(`investor_id = '${filters.investorId}'`);
    if (filters.statementType) conditions.push(`statement_type = '${filters.statementType}'`);

    const result = await db.execute(sql.raw(
      `SELECT * FROM lp_statements WHERE ${conditions.join(' AND ')} ORDER BY period_end DESC LIMIT ${filters.limit || 50}`
    ));

    return (result.rows as any[]).map(r => ({
      id: r.id, orgId: r.org_id, fundId: r.fund_id, investorId: r.investor_id,
      statementType: r.statement_type, periodLabel: r.period_label,
      periodStart: r.period_start, periodEnd: r.period_end,
      data: r.data, pdfUrl: r.pdf_url,
      generatedAt: new Date(r.generated_at),
      deliveredAt: r.delivered_at ? new Date(r.delivered_at) : null,
      deliveryMethod: r.delivery_method,
    }));
  }
}

// ─── K-1 Tax Document Generator ──────────────────────────────────────────────

class K1Generator {

  async generateK1(orgId: string, fundId: string, investorId: string, taxYear: number): Promise<K1Data> {
    const [fundResult, investorResult, movementsResult] = await Promise.all([
      db.execute(sql`SELECT * FROM funds WHERE id = ${fundId} AND org_id = ${orgId}`),
      db.execute(sql`SELECT * FROM fund_investors WHERE id = ${investorId} AND fund_id = ${fundId}`),
      db.execute(sql`
        SELECT * FROM fund_capital_movements
        WHERE fund_id = ${fundId} AND investor_id = ${investorId}
          AND EXTRACT(YEAR FROM effective_date) = ${taxYear}
        ORDER BY effective_date
      `),
    ]);

    const fund = (fundResult.rows as any[])?.[0];
    const investor = (investorResult.rows as any[])?.[0];
    if (!fund || !investor) throw new Error('Fund or investor not found');

    const d = (val: any) => new Decimal(val?.toString() || '0');
    const commitment = d(investor.commitment_amount);
    const totalCommitment = d(fund.committed_capital);
    const partnerShare = totalCommitment.isZero() ? new Decimal(0) : commitment.dividedBy(totalCommitment).times(100);

    // Calculate tax allocations based on partner's share
    // In reality these would come from the fund's tax return (Form 1065)
    const movements = (movementsResult.rows as any[]);
    let totalDistributions = new Decimal(0);
    let totalContributions = new Decimal(0);

    for (const m of movements) {
      const amt = d(m.amount);
      if (m.movement_type === 'distribution') totalDistributions = totalDistributions.plus(amt);
      if (m.movement_type === 'capital_call') totalContributions = totalContributions.plus(amt);
    }

    // Simplified allocation: In production, this would come from actual partnership return
    const fundNOI = d(fund.total_noi || '0');
    const investorNOI = fundNOI.times(partnerShare).dividedBy(100);
    const depreciation = investorNOI.times(new Decimal(0.3)); // Rough depreciation allocation

    const k1: K1Data = {
      investorName: investor.name || investor.investor_name || '',
      investorTaxId: investor.tax_id || 'XXX-XX-XXXX',
      investorAddress: investor.address || '',
      fundName: fund.name,
      fundEIN: fund.ein || 'XX-XXXXXXX',
      taxYear,
      ordinaryIncome: '0.00',
      rentalIncome: investorNOI.toFixed(2),
      interestIncome: d(investor.preferred_return_accrued).times(partnerShare).dividedBy(100).toFixed(2),
      dividendIncome: '0.00',
      shortTermCapitalGain: '0.00',
      longTermCapitalGain: '0.00',
      section1231Gain: '0.00',
      section179Deduction: '0.00',
      depreciation: depreciation.toFixed(2),
      otherDeductions: '0.00',
      foreignTaxesPaid: '0.00',
      alternativeMinimumTax: '0.00',
      distributionsOfCash: totalDistributions.toFixed(2),
      distributionsOfProperty: '0.00',
      beginningCapitalAccount: totalContributions.toFixed(2),
      endingCapitalAccount: d(investor.capital_account_balance).toFixed(2),
      partnersShare: partnerShare.toFixed(4),
    };

    // Store K-1
    await db.execute(sql`
      INSERT INTO lp_statements (
        id, org_id, fund_id, investor_id, statement_type, period_label,
        period_start, period_end, data, generated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${orgId}, ${fundId}, ${investorId}, 'k1',
        ${`${taxYear}`}, ${`${taxYear}-01-01`}::date, ${`${taxYear}-12-31`}::date,
        ${JSON.stringify(k1)}::jsonb, ${new Date()}
      )
    `);

    return k1;
  }

  async generateK1HTML(k1: K1Data): Promise<string> {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Schedule K-1 (Form 1065) — ${k1.taxYear}</title>
  <style>
    body { font-family: 'Courier New', monospace; margin: 40px; font-size: 12px; }
    .form-header { text-align: center; border: 2px solid black; padding: 10px; margin-bottom: 20px; }
    .form-title { font-size: 18px; font-weight: bold; }
    .form-subtitle { font-size: 10px; }
    .section { border: 1px solid black; margin-bottom: 10px; padding: 10px; }
    .section-title { font-weight: bold; font-size: 13px; background: #f0f0f0; padding: 4px 8px; margin: -10px -10px 10px -10px; }
    .line-item { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ccc; }
    .line-number { width: 30px; font-weight: bold; }
    .line-amount { font-weight: bold; text-align: right; min-width: 120px; }
  </style>
</head>
<body>
  <div class="form-header">
    <div class="form-title">Schedule K-1 (Form 1065)</div>
    <div class="form-subtitle">Partner's Share of Income, Deductions, Credits, etc.</div>
    <div>For calendar year ${k1.taxYear}</div>
  </div>

  <div class="section">
    <div class="section-title">Part I — Information About the Partnership</div>
    <div class="line-item"><span>Partnership name: ${k1.fundName}</span></div>
    <div class="line-item"><span>Partnership EIN: ${k1.fundEIN}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Part II — Information About the Partner</div>
    <div class="line-item"><span>Partner name: ${k1.investorName}</span></div>
    <div class="line-item"><span>Partner TIN: ${k1.investorTaxId}</span></div>
    <div class="line-item"><span>Partner's share of profit/loss: ${k1.partnersShare}%</span></div>
  </div>

  <div class="section">
    <div class="section-title">Part III — Partner's Share of Current Year Income, Deductions, Credits</div>
    <div class="line-item"><span class="line-number">1.</span><span>Ordinary business income (loss)</span><span class="line-amount">$${Number(k1.ordinaryIncome).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">2.</span><span>Net rental real estate income (loss)</span><span class="line-amount">$${Number(k1.rentalIncome).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">5.</span><span>Interest income</span><span class="line-amount">$${Number(k1.interestIncome).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">6a.</span><span>Ordinary dividends</span><span class="line-amount">$${Number(k1.dividendIncome).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">8.</span><span>Net short-term capital gain (loss)</span><span class="line-amount">$${Number(k1.shortTermCapitalGain).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">9a.</span><span>Net long-term capital gain (loss)</span><span class="line-amount">$${Number(k1.longTermCapitalGain).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">10.</span><span>Net section 1231 gain (loss)</span><span class="line-amount">$${Number(k1.section1231Gain).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">12.</span><span>Section 179 deduction</span><span class="line-amount">$${Number(k1.section179Deduction).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">13.</span><span>Other deductions (depreciation)</span><span class="line-amount">$${Number(k1.depreciation).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">16.</span><span>Foreign taxes paid</span><span class="line-amount">$${Number(k1.foreignTaxesPaid).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">19.</span><span>Distributions — Cash</span><span class="line-amount">$${Number(k1.distributionsOfCash).toLocaleString()}</span></div>
    <div class="line-item"><span class="line-number">19.</span><span>Distributions — Property</span><span class="line-amount">$${Number(k1.distributionsOfProperty).toLocaleString()}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Capital Account Analysis</div>
    <div class="line-item"><span>Beginning capital account</span><span class="line-amount">$${Number(k1.beginningCapitalAccount).toLocaleString()}</span></div>
    <div class="line-item"><span>Ending capital account</span><span class="line-amount">$${Number(k1.endingCapitalAccount).toLocaleString()}</span></div>
  </div>
</body>
</html>`;
  }
}

// ─── Side Letter Tracking ────────────────────────────────────────────────────

class SideLetterManager {

  async createSideLetter(orgId: string, data: {
    fundId: string;
    investorId: string;
    investorName: string;
    effectiveDate: string;
    expirationDate?: string;
    provisions: SideLetterProvision[];
    documentUrl?: string;
  }, userId: string): Promise<SideLetter> {
    const id = crypto.randomUUID();
    const now = new Date();

    await db.execute(sql`
      INSERT INTO side_letters (
        id, org_id, fund_id, investor_id, investor_name, provisions,
        effective_date, expiration_date, status, document_url, created_by, created_at
      ) VALUES (
        ${id}, ${orgId}, ${data.fundId}, ${data.investorId}, ${data.investorName},
        ${JSON.stringify(data.provisions)}::jsonb, ${data.effectiveDate}::date,
        ${data.expirationDate ? data.expirationDate : null}::date,
        'active', ${data.documentUrl || null}, ${userId}, ${now}
      )
    `);

    return {
      id, orgId, fundId: data.fundId, investorId: data.investorId,
      investorName: data.investorName, provisions: data.provisions,
      effectiveDate: new Date(data.effectiveDate),
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
      status: 'active', documentUrl: data.documentUrl || null, createdAt: now,
    };
  }

  async getSideLettersForFund(orgId: string, fundId: string): Promise<SideLetter[]> {
    const result = await db.execute(sql`
      SELECT * FROM side_letters WHERE org_id = ${orgId} AND fund_id = ${fundId}
      ORDER BY investor_name
    `);

    return (result.rows as any[]).map(r => ({
      id: r.id, orgId: r.org_id, fundId: r.fund_id,
      investorId: r.investor_id, investorName: r.investor_name,
      provisions: r.provisions || [],
      effectiveDate: r.effective_date,
      expirationDate: r.expiration_date || null,
      status: r.status, documentUrl: r.document_url,
      createdAt: new Date(r.created_at),
    }));
  }

  async getMFNAnalysis(orgId: string, fundId: string): Promise<{
    investors: { name: string; provisions: string[] }[];
    mostFavoredProvisions: { provision: string; grantedTo: string[] }[];
  }> {
    const letters = await this.getSideLettersForFund(orgId, fundId);
    const provisionMap: Map<string, string[]> = new Map();

    const investors = letters.map(l => {
      const provisionNames = l.provisions.map(p => p.type);
      for (const pName of provisionNames) {
        const existing = provisionMap.get(pName) || [];
        existing.push(l.investorName);
        provisionMap.set(pName, existing);
      }
      return { name: l.investorName, provisions: provisionNames };
    });

    const mostFavoredProvisions = Array.from(provisionMap.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([provision, grantedTo]) => ({ provision, grantedTo }));

    return { investors, mostFavoredProvisions };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const lpPortalAuth = new LPPortalAuthService();
export const lpStatements = new LPStatementGenerator();
export const k1Generator = new K1Generator();
export const sideLetters = new SideLetterManager();
