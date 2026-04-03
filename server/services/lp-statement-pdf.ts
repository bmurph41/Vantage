/**
 * LP Investor Statement — PDF Generation
 *
 * Renders the JSON investor statement from fund-service.ts into a professional
 * binary PDF using pdf-lib. Matches institutional PE/RE reporting standards.
 */

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

// ── Types ──────────────────────────────────────────────────────────────────

interface StatementData {
  fund: {
    name: string;
    vintage: number | null;
    status: string;
    targetSize: number;
    committedCapital: number;
  };
  investor: {
    name: string;
    type: string;
    commitmentAmount: number;
    commitmentPct: number;
    calledCapital: number;
    unfundedCommitment: number;
  };
  capitalAccount: {
    openingBalance: number;
    contributions: number;
    distributions: number;
    preferredReturnAccrued: number;
    unrealizedGainLoss: number;
    endingBalance: number;
  };
  distributions: {
    date: Date | string;
    type: string;
    returnOfCapital: number;
    preferredReturn: number;
    carriedInterest: number;
    profitShare: number;
    total: number;
  }[];
  preferredReturn: {
    rate: number;
    totalAccrued: number;
    totalPaid: number;
    unpaidBalance: number;
  };
  performance: {
    grossIrr: number | null;
    netIrr: number | null;
    tvpi: number | null;
    dpi: number | null;
    rvpi: number | null;
    nav: number;
  };
  dealExposure: {
    allocationId: string;
    projectName: string;
    investedAmount: number;
    currentValue: number;
    unrealizedGain: number;
    exitStatus: string;
  }[];
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtMultiple(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(2)}x`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── PDF Document Builder ───────────────────────────────────────────────────

const PAGE_WIDTH = 612;  // Letter
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const COLOR_NAVY = rgb(0.09, 0.12, 0.22);    // #17203A — headings
const COLOR_STEEL = rgb(0.38, 0.44, 0.53);    // #627088 — body text
const COLOR_TEAL = rgb(0.176, 0.831, 0.749);  // #2DD4BF — accents
const COLOR_LIGHT_BG = rgb(0.96, 0.97, 0.98); // #F5F7FA — table stripes
const COLOR_BORDER = rgb(0.85, 0.87, 0.90);   // #D9DEE6 — dividers
const COLOR_BLACK = rgb(0, 0, 0);
const COLOR_WHITE = rgb(1, 1, 1);

class StatementPDFBuilder {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private fontRegular!: PDFFont;
  private fontBold!: PDFFont;
  private y = 0;

  async build(data: StatementData, asOfDate?: Date): Promise<Uint8Array> {
    this.doc = await PDFDocument.create();
    this.fontRegular = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold);

    this.addPage();

    // ── Header ───────────────────────────────────────────────────────
    this.drawText(data.fund.name, { size: 20, font: this.fontBold, color: COLOR_NAVY });
    this.y -= 4;
    this.drawText('LP Capital Account Statement', { size: 12, color: COLOR_STEEL });
    this.y -= 4;

    const dateStr = asOfDate ? fmtDate(asOfDate) : fmtDate(new Date());
    const vintageStr = data.fund.vintage ? ` | Vintage ${data.fund.vintage}` : '';
    this.drawText(`As of ${dateStr}${vintageStr}`, { size: 9, color: COLOR_STEEL });
    this.y -= 6;

    // Teal accent line
    this.page.drawRectangle({
      x: MARGIN_LEFT, y: this.y, width: CONTENT_WIDTH, height: 2,
      color: COLOR_TEAL,
    });
    this.y -= 18;

    // ── Investor Summary ─────────────────────────────────────────────
    this.sectionHeader('Investor Summary');
    this.keyValueTable([
      ['Investor', data.investor.name],
      ['Investor Type', data.investor.type],
      ['Commitment', fmtCurrency(data.investor.commitmentAmount)],
      ['Ownership', fmtPct(data.investor.commitmentPct / 100, 2)],
      ['Called Capital', fmtCurrency(data.investor.calledCapital)],
      ['Unfunded Commitment', fmtCurrency(data.investor.unfundedCommitment)],
    ]);
    this.y -= 12;

    // ── Capital Account ──────────────────────────────────────────────
    this.sectionHeader('Capital Account');
    this.keyValueTable([
      ['Opening Balance', fmtCurrency(data.capitalAccount.openingBalance)],
      ['(+) Contributions', fmtCurrency(data.capitalAccount.contributions)],
      ['(−) Distributions', fmtCurrency(data.capitalAccount.distributions)],
      ['(+) Preferred Return Accrued', fmtCurrency(data.capitalAccount.preferredReturnAccrued)],
      ['(+/−) Unrealized Gain/Loss', fmtCurrency(data.capitalAccount.unrealizedGainLoss)],
    ], true);
    // Bold ending balance
    this.y -= 2;
    this.drawKeyValue('Ending Balance', fmtCurrency(data.capitalAccount.endingBalance), true);
    this.y -= 12;

    // ── Performance Metrics ──────────────────────────────────────────
    this.sectionHeader('Fund Performance');
    this.metricsGrid([
      ['Gross IRR', fmtPct(data.performance.grossIrr)],
      ['Net IRR', fmtPct(data.performance.netIrr)],
      ['TVPI', fmtMultiple(data.performance.tvpi)],
      ['DPI', fmtMultiple(data.performance.dpi)],
      ['RVPI', fmtMultiple(data.performance.rvpi)],
      ['NAV', fmtCurrency(data.performance.nav)],
    ]);
    this.y -= 12;

    // ── Preferred Return ─────────────────────────────────────────────
    this.sectionHeader('Preferred Return');
    this.keyValueTable([
      ['Preferred Rate', fmtPct(data.preferredReturn.rate)],
      ['Total Accrued', fmtCurrency(data.preferredReturn.totalAccrued)],
      ['Total Paid', fmtCurrency(data.preferredReturn.totalPaid)],
      ['Unpaid Balance', fmtCurrency(data.preferredReturn.unpaidBalance)],
    ]);
    this.y -= 12;

    // ── Deal Exposure ────────────────────────────────────────────────
    if (data.dealExposure.length > 0) {
      this.ensureSpace(80);
      this.sectionHeader('Deal-Level Exposure');
      this.dataTable(
        ['Deal', 'Invested', 'Current Value', 'Gain/Loss', 'Status'],
        data.dealExposure.map(d => [
          d.projectName.length > 25 ? d.projectName.substring(0, 22) + '...' : d.projectName,
          fmtCurrency(d.investedAmount),
          fmtCurrency(d.currentValue),
          fmtCurrency(d.unrealizedGain),
          d.exitStatus || 'Active',
        ]),
        [0.30, 0.18, 0.18, 0.18, 0.16],
      );
      this.y -= 12;
    }

    // ── Distribution History ─────────────────────────────────────────
    if (data.distributions.length > 0) {
      this.ensureSpace(80);
      this.sectionHeader('Distribution History');
      this.dataTable(
        ['Date', 'Return of Capital', 'Pref Return', 'Carry', 'Total'],
        data.distributions.slice(0, 20).map(d => [
          fmtDate(d.date),
          fmtCurrency(d.returnOfCapital),
          fmtCurrency(d.preferredReturn),
          fmtCurrency(d.carriedInterest),
          fmtCurrency(d.total),
        ]),
        [0.20, 0.22, 0.20, 0.18, 0.20],
      );
    }

    // ── Footer on each page ──────────────────────────────────────────
    this.addFooters(data);

    return this.doc.save();
  }

  // ── Layout primitives ────────────────────────────────────────────────

  private addPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private ensureSpace(needed: number): void {
    if (this.y - needed < MARGIN_BOTTOM) {
      this.addPage();
    }
  }

  private drawText(
    text: string,
    opts: { size?: number; font?: PDFFont; color?: any; x?: number; maxWidth?: number } = {}
  ): void {
    const size = opts.size || 10;
    const font = opts.font || this.fontRegular;
    const color = opts.color || COLOR_STEEL;
    const x = opts.x || MARGIN_LEFT;

    this.ensureSpace(size + 4);
    this.page.drawText(text, { x, y: this.y, size, font, color });
    this.y -= size + 4;
  }

  private sectionHeader(title: string): void {
    this.ensureSpace(30);
    this.y -= 4;
    this.page.drawRectangle({
      x: MARGIN_LEFT, y: this.y - 2, width: CONTENT_WIDTH, height: 0.5,
      color: COLOR_BORDER,
    });
    this.y -= 6;
    this.drawText(title, { size: 12, font: this.fontBold, color: COLOR_NAVY });
    this.y -= 2;
  }

  private keyValueTable(rows: [string, string][], drawStripes = false): void {
    const labelWidth = 220;
    const valueX = MARGIN_LEFT + labelWidth;

    for (let i = 0; i < rows.length; i++) {
      this.ensureSpace(16);

      if (drawStripes && i % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN_LEFT - 4, y: this.y - 4, width: CONTENT_WIDTH + 8, height: 16,
          color: COLOR_LIGHT_BG,
        });
      }

      this.page.drawText(rows[i][0], {
        x: MARGIN_LEFT, y: this.y, size: 9, font: this.fontRegular, color: COLOR_STEEL,
      });
      this.page.drawText(rows[i][1], {
        x: valueX, y: this.y, size: 9, font: this.fontBold, color: COLOR_NAVY,
      });
      this.y -= 16;
    }
  }

  private drawKeyValue(label: string, value: string, bold = false): void {
    this.ensureSpace(16);
    const labelWidth = 220;
    const valueX = MARGIN_LEFT + labelWidth;

    // Highlight row
    this.page.drawRectangle({
      x: MARGIN_LEFT - 4, y: this.y - 4, width: CONTENT_WIDTH + 8, height: 16,
      color: rgb(0.92, 0.95, 0.98),
    });

    this.page.drawText(label, {
      x: MARGIN_LEFT, y: this.y, size: 10, font: this.fontBold, color: COLOR_NAVY,
    });
    this.page.drawText(value, {
      x: valueX, y: this.y, size: 10, font: this.fontBold, color: COLOR_NAVY,
    });
    this.y -= 16;
  }

  private metricsGrid(items: [string, string][]): void {
    const cols = 3;
    const colWidth = CONTENT_WIDTH / cols;

    for (let i = 0; i < items.length; i += cols) {
      this.ensureSpace(32);

      for (let j = 0; j < cols && i + j < items.length; j++) {
        const x = MARGIN_LEFT + j * colWidth;
        this.page.drawText(items[i + j][1], {
          x, y: this.y, size: 14, font: this.fontBold, color: COLOR_NAVY,
        });
        this.page.drawText(items[i + j][0], {
          x, y: this.y - 14, size: 8, font: this.fontRegular, color: COLOR_STEEL,
        });
      }
      this.y -= 36;
    }
  }

  private dataTable(headers: string[], rows: string[][], colWidths: number[]): void {
    const ROW_HEIGHT = 16;
    const HEADER_HEIGHT = 18;

    this.ensureSpace(HEADER_HEIGHT + ROW_HEIGHT * Math.min(rows.length, 3));

    // Header row
    this.page.drawRectangle({
      x: MARGIN_LEFT - 4, y: this.y - 4, width: CONTENT_WIDTH + 8, height: HEADER_HEIGHT,
      color: COLOR_NAVY,
    });

    let xOffset = MARGIN_LEFT;
    for (let c = 0; c < headers.length; c++) {
      this.page.drawText(headers[c], {
        x: xOffset, y: this.y, size: 8, font: this.fontBold, color: COLOR_WHITE,
      });
      xOffset += CONTENT_WIDTH * colWidths[c];
    }
    this.y -= HEADER_HEIGHT;

    // Data rows
    for (let r = 0; r < rows.length; r++) {
      this.ensureSpace(ROW_HEIGHT);

      if (r % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN_LEFT - 4, y: this.y - 4, width: CONTENT_WIDTH + 8, height: ROW_HEIGHT,
          color: COLOR_LIGHT_BG,
        });
      }

      xOffset = MARGIN_LEFT;
      for (let c = 0; c < rows[r].length; c++) {
        this.page.drawText(rows[r][c] || '—', {
          x: xOffset, y: this.y, size: 8, font: this.fontRegular, color: COLOR_STEEL,
        });
        xOffset += CONTENT_WIDTH * colWidths[c];
      }
      this.y -= ROW_HEIGHT;
    }
  }

  private addFooters(data: StatementData): void {
    const pages = this.doc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];

      // Divider line
      page.drawRectangle({
        x: MARGIN_LEFT, y: MARGIN_BOTTOM - 10, width: CONTENT_WIDTH, height: 0.5,
        color: COLOR_BORDER,
      });

      // Confidential notice
      page.drawText('CONFIDENTIAL — For the exclusive use of the named investor.', {
        x: MARGIN_LEFT, y: MARGIN_BOTTOM - 24, size: 7, font: this.fontRegular, color: COLOR_STEEL,
      });

      // Page number
      const pageText = `Page ${i + 1} of ${totalPages}`;
      const pageTextWidth = this.fontRegular.widthOfTextAtSize(pageText, 7);
      page.drawText(pageText, {
        x: PAGE_WIDTH - MARGIN_RIGHT - pageTextWidth,
        y: MARGIN_BOTTOM - 24,
        size: 7, font: this.fontRegular, color: COLOR_STEEL,
      });
    }
  }
}

// ── Export ──────────────────────────────────────────────────────────────────

export async function generateStatementPDF(
  data: StatementData,
  asOfDate?: Date
): Promise<Uint8Array> {
  const builder = new StatementPDFBuilder();
  return builder.build(data, asOfDate);
}
