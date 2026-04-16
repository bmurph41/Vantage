/**
 * K-1 Tax Document — PDF Generation
 *
 * Renders the K1Data interface (from lp-portal-service.ts) into a
 * professional binary PDF using pdf-lib. Follows the same visual language
 * as lp-statement-pdf.ts (Navy / Steel / Teal palette, Helvetica fonts,
 * striped data tables, confidential footer).
 *
 * Output: a simplified partner's K-1 summary suitable for LP distribution.
 * NOT the IRS Form 1065 Schedule K-1 (which requires specialized tax forms);
 * this is a summary report showing the LP's allocated income, deductions,
 * credits, and capital account for the tax year.
 */

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { K1Data } from "./lp-portal-service";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const NAVY = rgb(0.09, 0.12, 0.22);
const STEEL = rgb(0.38, 0.44, 0.53);
const TEAL = rgb(0.176, 0.831, 0.749);
const LIGHT_BG = rgb(0.96, 0.97, 0.98);
const BORDER = rgb(0.85, 0.87, 0.9);
const WHITE = rgb(1, 1, 1);

class K1PDFBuilder {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private fontReg!: PDFFont;
  private fontBold!: PDFFont;
  private y = 0;

  async build(data: K1Data): Promise<Uint8Array> {
    this.doc = await PDFDocument.create();
    this.fontReg = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold);

    this.addPage();

    // Header
    this.text(`Schedule K-1 Summary — Tax Year ${data.taxYear}`, { size: 18, font: this.fontBold, color: NAVY });
    this.y -= 2;
    this.text(data.fundName, { size: 12, color: STEEL });
    this.y -= 4;
    this.page.drawRectangle({ x: MARGIN_LEFT, y: this.y, width: CONTENT_WIDTH, height: 2, color: TEAL });
    this.y -= 18;

    // Partnership info
    this.section("Partnership Information");
    this.kvTable([
      ["Fund / Partnership Name", data.fundName],
      ["Fund EIN", data.fundEIN || "—"],
    ]);
    this.y -= 8;

    // Partner info
    this.section("Partner Information");
    this.kvTable([
      ["Partner Name", data.investorName],
      ["Tax ID (SSN/EIN)", data.investorTaxId || "[On file]"],
      ["Address", data.investorAddress || "—"],
      ["Partner's Share of Profit/Loss", data.partnersShare || "—"],
    ]);
    this.y -= 8;

    // Income / loss
    this.section("Allocable Share of Income / (Loss)");
    this.kvTable([
      ["Ordinary Business Income (Line 1)", data.ordinaryIncome],
      ["Net Rental Real Estate Income (Line 2)", data.rentalIncome],
      ["Interest Income (Line 5)", data.interestIncome],
      ["Dividend Income (Line 6a)", data.dividendIncome],
      ["Short-Term Capital Gain (Line 8)", data.shortTermCapitalGain],
      ["Long-Term Capital Gain (Line 9a)", data.longTermCapitalGain],
      ["Section 1231 Gain/Loss (Line 10)", data.section1231Gain],
    ], true);
    this.y -= 8;

    // Deductions
    this.section("Deductions");
    this.kvTable([
      ["Section 179 Deduction (Line 12)", data.section179Deduction],
      ["Depreciation (Other Deductions)", data.depreciation],
      ["Other Deductions (Line 13)", data.otherDeductions],
    ], true);
    this.y -= 8;

    // Credits / AMT
    this.section("Credits & AMT");
    this.kvTable([
      ["Foreign Taxes Paid (Line 16)", data.foreignTaxesPaid],
      ["Alternative Minimum Tax Items (Line 17)", data.alternativeMinimumTax],
    ], true);
    this.y -= 8;

    // Distributions
    this.section("Distributions");
    this.kvTable([
      ["Cash Distributions (Line 19a)", data.distributionsOfCash],
      ["Property Distributions", data.distributionsOfProperty],
    ], true);
    this.y -= 8;

    // Capital account
    this.section("Partner's Capital Account Analysis");
    this.kvTable([
      ["Beginning Capital Account", data.beginningCapitalAccount],
      ["Ending Capital Account", data.endingCapitalAccount],
    ], true);
    this.y -= 16;

    // Disclaimer
    this.ensure(50);
    this.page.drawRectangle({
      x: MARGIN_LEFT - 4, y: this.y - 4, width: CONTENT_WIDTH + 8, height: 42,
      color: LIGHT_BG,
    });
    this.text(
      "This summary is provided for informational purposes. It does not constitute",
      { size: 7, color: STEEL },
    );
    this.text(
      "tax advice. Consult your tax advisor regarding the treatment of these items.",
      { size: 7, color: STEEL },
    );
    this.text(
      "The official IRS Schedule K-1 (Form 1065) will be filed separately.",
      { size: 7, color: STEEL },
    );

    // Footer on all pages
    this.addFooters(data);

    return this.doc.save();
  }

  // ─── Primitives (mirror lp-statement-pdf.ts) ─────────────────────

  private addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private ensure(h: number) {
    if (this.y - h < MARGIN_BOTTOM) this.addPage();
  }

  private text(t: string, o: { size?: number; font?: PDFFont; color?: any; x?: number } = {}) {
    const sz = o.size || 10;
    this.ensure(sz + 4);
    this.page.drawText(t, {
      x: o.x || MARGIN_LEFT,
      y: this.y,
      size: sz,
      font: o.font || this.fontReg,
      color: o.color || STEEL,
    });
    this.y -= sz + 4;
  }

  private section(title: string) {
    this.ensure(30);
    this.y -= 4;
    this.page.drawRectangle({ x: MARGIN_LEFT, y: this.y - 2, width: CONTENT_WIDTH, height: 0.5, color: BORDER });
    this.y -= 6;
    this.text(title, { size: 12, font: this.fontBold, color: NAVY });
    this.y -= 2;
  }

  private kvTable(rows: [string, string][], striped = false) {
    const labelW = 280;
    const valX = MARGIN_LEFT + labelW;
    for (let i = 0; i < rows.length; i++) {
      this.ensure(16);
      if (striped && i % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN_LEFT - 4, y: this.y - 4, width: CONTENT_WIDTH + 8, height: 16, color: LIGHT_BG,
        });
      }
      this.page.drawText(rows[i][0], { x: MARGIN_LEFT, y: this.y, size: 9, font: this.fontReg, color: STEEL });
      this.page.drawText(rows[i][1] || "—", { x: valX, y: this.y, size: 9, font: this.fontBold, color: NAVY });
      this.y -= 16;
    }
  }

  private addFooters(data: K1Data) {
    const pages = this.doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      p.drawRectangle({ x: MARGIN_LEFT, y: MARGIN_BOTTOM - 10, width: CONTENT_WIDTH, height: 0.5, color: BORDER });
      p.drawText("CONFIDENTIAL — For the exclusive use of the named partner.", {
        x: MARGIN_LEFT, y: MARGIN_BOTTOM - 24, size: 7, font: this.fontReg, color: STEEL,
      });
      const pg = `Page ${i + 1} of ${pages.length}`;
      const w = this.fontReg.widthOfTextAtSize(pg, 7);
      p.drawText(pg, { x: PAGE_WIDTH - MARGIN_RIGHT - w, y: MARGIN_BOTTOM - 24, size: 7, font: this.fontReg, color: STEEL });
    }
  }
}

export async function generateK1PDF(data: K1Data): Promise<Uint8Array> {
  return new K1PDFBuilder().build(data);
}
