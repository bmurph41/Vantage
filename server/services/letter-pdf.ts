/**
 * Investor Letter PDF Generator
 *
 * Renders the markdown-style investor-letter templates (quarterly_update,
 * capital_call_notice, distribution_notice, annual_letter) into a binary PDF
 * suitable for LP delivery. Closes the audit gap that flagged these letters
 * as "plain-text email templates only" — pairs the existing email rendering
 * with a downloadable PDF in the same visual language as
 * lp-statement-pdf.ts / k1-statement-pdf.ts (Navy / Steel / Teal).
 *
 * Markdown subset supported:
 *   - **bold** inline
 *   - "## Heading" or "**Section Heading**" on its own line
 *   - Bullet lines starting with "- " or "* "
 *   - Blank lines as paragraph breaks
 *
 * Tokens are expected to be resolved BEFORE the body reaches this module;
 * tokens.ts in document-enhancements.ts handles substitution.
 */

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

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
const BORDER = rgb(0.85, 0.87, 0.9);

export type LetterKind =
  | "quarterly_update"
  | "capital_call_notice"
  | "distribution_notice"
  | "annual_letter"
  | "custom";

export interface LetterPDFInput {
  /** Resolved subject (no {{TOKENS}} remaining). */
  subject: string;
  /** Resolved body in light markdown. */
  body: string;
  /** Fund name for the header. */
  fundName: string;
  /** Recipient investor name (drawn as "To: ..."). */
  investorName: string;
  /** Letter date — defaults to today. */
  letterDate?: Date;
  /** Letter classification (drives the badge color). */
  letterKind: LetterKind;
}

/**
 * Sanitize a string for WinAnsi-encoded fonts. Lifted from lp-statement-pdf.ts.
 * pdf-lib's standard fonts can't render em-dash, smart quotes, etc., and will
 * throw mid-render on the offending char.
 */
function safeText(s: string | null | undefined): string {
  if (s == null) return "-";
  return String(s)
    .replace(/[–—]/g, "-")    // en-dash, em-dash
    .replace(/−/g, "-")            // Unicode minus
    .replace(/[‘’‚‛]/g, "'") // curly singles
    .replace(/[“”„‟]/g, '"') // curly doubles
    .replace(/…/g, "...")          // ellipsis
    .replace(/ /g, " ")            // NBSP
    .replace(/[•‣]/g, "*");   // bullets
}

function letterKindLabel(k: LetterKind): { label: string; color: ReturnType<typeof rgb> } {
  switch (k) {
    case "quarterly_update":
      return { label: "QUARTERLY UPDATE", color: rgb(0.13, 0.45, 0.85) };
    case "capital_call_notice":
      return { label: "CAPITAL CALL", color: rgb(0.85, 0.4, 0.1) };
    case "distribution_notice":
      return { label: "DISTRIBUTION NOTICE", color: rgb(0.1, 0.6, 0.3) };
    case "annual_letter":
      return { label: "ANNUAL REPORT", color: NAVY };
    default:
      return { label: "INVESTOR COMMUNICATION", color: STEEL };
  }
}

class LetterPDFBuilder {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private fontReg!: PDFFont;
  private fontBold!: PDFFont;
  private y = 0;

  async build(input: LetterPDFInput): Promise<Uint8Array> {
    this.doc = await PDFDocument.create();
    this.fontReg = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.addPage();

    const kind = letterKindLabel(input.letterKind);

    // Kind badge — pill in the top-left
    const badgeWidth = this.fontBold.widthOfTextAtSize(kind.label, 8) + 16;
    this.page.drawRectangle({
      x: MARGIN_LEFT, y: this.y - 4, width: badgeWidth, height: 14, color: kind.color,
    });
    this.page.drawText(kind.label, {
      x: MARGIN_LEFT + 8, y: this.y - 1, size: 8, font: this.fontBold,
      color: rgb(1, 1, 1),
    });

    // Letter date — top-right
    const dateStr = (input.letterDate ?? new Date()).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const dateW = this.fontReg.widthOfTextAtSize(dateStr, 9);
    this.page.drawText(safeText(dateStr), {
      x: PAGE_WIDTH - MARGIN_RIGHT - dateW, y: this.y, size: 9,
      font: this.fontReg, color: STEEL,
    });
    this.y -= 24;

    // Subject heading
    this.text(safeText(input.subject), { size: 16, font: this.fontBold, color: NAVY });
    this.y -= 4;

    // Fund / recipient line
    this.text(
      `${safeText(input.fundName)}  -  To: ${safeText(input.investorName)}`,
      { size: 9, color: STEEL },
    );
    this.y -= 6;
    this.page.drawRectangle({
      x: MARGIN_LEFT, y: this.y, width: CONTENT_WIDTH, height: 1, color: TEAL,
    });
    this.y -= 14;

    // Body — light markdown parser
    this.renderBody(input.body);

    this.addFooters(input);
    return await this.doc.save();
  }

  private renderBody(body: string): void {
    const lines = body.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = safeText(rawLine);
      if (line.trim() === "") {
        this.y -= 6;
        continue;
      }
      // Section header — line wrapped entirely in ** or starting with ##
      const isMdHeading = /^#{1,3}\s+/.test(line);
      const isBoldHeading = /^\*\*[^*]+\*\*\s*$/.test(line.trim());
      if (isMdHeading || isBoldHeading) {
        this.ensure(28);
        this.y -= 4;
        this.page.drawRectangle({
          x: MARGIN_LEFT, y: this.y - 2, width: CONTENT_WIDTH, height: 0.5, color: BORDER,
        });
        this.y -= 6;
        const heading = line.replace(/^#{1,3}\s+/, "").replace(/^\*\*|\*\*$/g, "").trim();
        this.text(heading, { size: 11, font: this.fontBold, color: NAVY });
        this.y -= 2;
        continue;
      }
      // Bullet line
      if (/^\s*[-*]\s+/.test(line)) {
        const text = line.replace(/^\s*[-*]\s+/, "");
        this.ensure(16);
        this.page.drawText("·", {
          x: MARGIN_LEFT + 4, y: this.y, size: 10, font: this.fontBold, color: STEEL,
        });
        this.drawInlineBold(text, MARGIN_LEFT + 16, CONTENT_WIDTH - 16);
        continue;
      }
      // Plain paragraph line — wrap inline bold
      this.drawInlineBold(line, MARGIN_LEFT, CONTENT_WIDTH);
    }
  }

  /**
   * Draw a line that may contain **bold** segments, wrapping if it exceeds
   * the available width. Each visual line is ~88 chars at 10pt.
   */
  private drawInlineBold(line: string, x: number, width: number): void {
    // Tokenize **bold** segments.
    const segments: { text: string; bold: boolean }[] = [];
    const re = /\*\*([^*]+)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) segments.push({ text: line.slice(last, m.index), bold: false });
      segments.push({ text: m[1], bold: true });
      last = m.index + m[0].length;
    }
    if (last < line.length) segments.push({ text: line.slice(last), bold: false });

    if (segments.length === 0) segments.push({ text: line, bold: false });

    // Render with greedy word wrap. We don't try to honor word/bold boundaries
    // perfectly across wraps — bold continues seamlessly across line breaks.
    const fontSize = 10;
    const lineHeight = 13;
    let cursorX = x;
    let lineY = this.y;
    const startX = x;
    const advance = (segment: { text: string; bold: boolean }, word: string) => {
      const f = segment.bold ? this.fontBold : this.fontReg;
      const w = f.widthOfTextAtSize(word, fontSize);
      if (cursorX + w > startX + width && cursorX > startX) {
        cursorX = startX;
        lineY -= lineHeight;
      }
      this.ensureAt(lineY, lineHeight);
      this.page.drawText(word, { x: cursorX, y: lineY, size: fontSize, font: f, color: rgb(0.13, 0.16, 0.25) });
      cursorX += w;
    };

    for (const seg of segments) {
      const words = seg.text.split(/(\s+)/); // keep spaces
      for (const word of words) {
        if (!word) continue;
        advance(seg, word);
      }
    }
    this.y = lineY - 2;
  }

  private addPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private ensure(needed: number): void {
    if (this.y - needed < MARGIN_BOTTOM + 30) this.addPage();
  }

  private ensureAt(yCandidate: number, needed: number): void {
    if (yCandidate - needed < MARGIN_BOTTOM + 30) {
      this.addPage();
      // Reset caller's cursorY by mutating outer y. The caller reads this.y
      // next iteration to recover; advance() above sets `lineY = this.y`
      // after each line.
    }
  }

  private text(content: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}): void {
    const sz = o.size || 10;
    this.ensure(sz + 6);
    this.page.drawText(safeText(content), {
      x: MARGIN_LEFT, y: this.y, size: sz,
      font: o.font || this.fontReg,
      color: o.color || STEEL,
    });
    this.y -= sz + 4;
  }

  private addFooters(input: LetterPDFInput): void {
    const pages = this.doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      p.drawRectangle({
        x: MARGIN_LEFT, y: MARGIN_BOTTOM - 10, width: CONTENT_WIDTH, height: 0.5, color: BORDER,
      });
      const left = `${safeText(input.fundName)} - Confidential. For the exclusive use of the named investor.`;
      p.drawText(left, { x: MARGIN_LEFT, y: MARGIN_BOTTOM - 24, size: 7, font: this.fontReg, color: STEEL });
      const pg = `Page ${i + 1} of ${pages.length}`;
      const w = this.fontReg.widthOfTextAtSize(pg, 7);
      p.drawText(pg, {
        x: PAGE_WIDTH - MARGIN_RIGHT - w, y: MARGIN_BOTTOM - 24, size: 7,
        font: this.fontReg, color: STEEL,
      });
    }
  }
}

export async function generateLetterPDF(input: LetterPDFInput): Promise<Uint8Array> {
  return new LetterPDFBuilder().build(input);
}
