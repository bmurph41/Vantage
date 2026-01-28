/**
 * Document Builder PDF Export Service
 * Generates professional PDFs from Document Builder documents
 * 
 * Uses pdf-lib for cross-platform PDF generation
 */

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  DocumentType,
  SectionDefinition,
  SectionCategory,
  DataBindingValue,
  AudiencePersona,
} from '@shared/document-builder/types';
import { SECTION_LIBRARY } from '@shared/document-builder/section-library';

// =============================================================================
// Types
// =============================================================================

export interface PdfExportOptions {
  pageSize?: 'letter' | 'a4';
  theme?: PdfTheme;
  includeTableOfContents?: boolean;
  includePageNumbers?: boolean;
  includeHeaders?: boolean;
  includeFooters?: boolean;
  companyName?: string;
  companyLogo?: Buffer;
  confidentialityNotice?: string;
  watermark?: string;
}

export interface PdfTheme {
  primaryColor: { r: number; g: number; b: number };
  secondaryColor: { r: number; g: number; b: number };
  accentColor: { r: number; g: number; b: number };
  textColor: { r: number; g: number; b: number };
  textLightColor: { r: number; g: number; b: number };
  backgroundColor: { r: number; g: number; b: number };
}

export interface DocumentSection {
  id: string;
  sectionKey: string;
  order: number;
  enabled: boolean;
  content: Record<string, any>;
  dataBindings: Record<string, DataBindingValue>;
  media: Record<string, MediaAttachment>;
  completionStatus: {
    isComplete: boolean;
    percentage: number;
  };
}

export interface MediaAttachment {
  url?: string;
  s3Key?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  caption?: string;
  data?: Buffer;
}

export interface DocumentData {
  id: string;
  title: string;
  documentType: DocumentType;
  audience?: AudiencePersona;
  sections: DocumentSection[];
  theme?: PdfTheme;
  metadata?: Record<string, any>;
}

interface PdfContext {
  doc: PDFDocument;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
    italic: PDFFont;
    boldItalic: PDFFont;
  };
  theme: PdfTheme;
  pageSize: readonly [number, number];
  margins: { top: number; bottom: number; left: number; right: number };
  currentPage: PDFPage;
  pageNumber: number;
  yPosition: number;
  options: PdfExportOptions;
}

// =============================================================================
// Default Theme
// =============================================================================

const DEFAULT_THEME: PdfTheme = {
  primaryColor: { r: 0.047, g: 0.329, b: 0.533 }, // Navy blue
  secondaryColor: { r: 0.180, g: 0.545, b: 0.671 }, // Teal
  accentColor: { r: 0.961, g: 0.651, b: 0.137 }, // Gold
  textColor: { r: 0.1, g: 0.1, b: 0.1 },
  textLightColor: { r: 0.4, g: 0.4, b: 0.4 },
  backgroundColor: { r: 0.98, g: 0.98, b: 0.98 },
};

// =============================================================================
// PDF Export Service
// =============================================================================

class PdfExportService {
  /**
   * Generate a PDF document from document data
   */
  async generateDocument(
    documentData: DocumentData,
    options: PdfExportOptions = {}
  ): Promise<Buffer> {
    const theme = { ...DEFAULT_THEME, ...documentData.theme, ...options.theme };
    const pageSize = options.pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter;

    // Create PDF document
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    // Embed fonts
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
    const boldItalicFont = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

    // Initialize context
    const ctx: PdfContext = {
      doc,
      fonts: {
        regular: regularFont,
        bold: boldFont,
        italic: italicFont,
        boldItalic: boldItalicFont,
      },
      theme,
      pageSize,
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      currentPage: doc.addPage(pageSize),
      pageNumber: 1,
      yPosition: pageSize[1] - 72,
      options,
    };

    // Create title page
    this.createTitlePage(ctx, documentData);

    // Create table of contents
    if (options.includeTableOfContents !== false) {
      ctx.currentPage = doc.addPage(pageSize);
      ctx.pageNumber++;
      ctx.yPosition = pageSize[1] - ctx.margins.top;
      this.createTableOfContents(ctx, documentData);
    }

    // Create section pages
    const enabledSections = documentData.sections.filter(s => s.enabled);
    for (const section of enabledSections) {
      // Start new page for each section
      ctx.currentPage = doc.addPage(pageSize);
      ctx.pageNumber++;
      ctx.yPosition = pageSize[1] - ctx.margins.top;
      await this.createSectionContent(ctx, section, documentData);
    }

    // Add disclaimer if applicable
    if (
      documentData.documentType === DocumentType.OFFERING_MEMORANDUM ||
      documentData.documentType === DocumentType.INVESTMENT_COMMITTEE_MEMO
    ) {
      ctx.currentPage = doc.addPage(pageSize);
      ctx.pageNumber++;
      ctx.yPosition = pageSize[1] - ctx.margins.top;
      this.createDisclaimer(ctx);
    }

    // Add headers and footers to all pages
    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      if (options.includeHeaders !== false && i > 0) {
        this.addHeader(pages[i], documentData.title, theme, ctx.fonts.regular);
      }
      if (options.includeFooters !== false) {
        this.addFooter(pages[i], i + 1, pages.length, theme, ctx.fonts.regular, options);
      }
    }

    // Generate buffer
    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Create title page
   */
  private createTitlePage(ctx: PdfContext, document: DocumentData): void {
    const { currentPage, fonts, theme, pageSize, options } = ctx;
    const [width, height] = pageSize;

    // Background color bar at top
    currentPage.drawRectangle({
      x: 0,
      y: height - 200,
      width,
      height: 200,
      color: rgb(theme.primaryColor.r, theme.primaryColor.g, theme.primaryColor.b),
    });

    // Document type label
    const docTypeLabel = this.getDocumentTypeLabel(document.documentType).toUpperCase();
    currentPage.drawText(docTypeLabel, {
      x: 72,
      y: height - 100,
      size: 12,
      font: fonts.regular,
      color: rgb(1, 1, 1),
    });

    // Title
    const titleLines = this.wrapText(document.title, fonts.bold, 36, width - 144);
    let titleY = height - 260;
    for (const line of titleLines) {
      currentPage.drawText(line, {
        x: 72,
        y: titleY,
        size: 36,
        font: fonts.bold,
        color: rgb(theme.primaryColor.r, theme.primaryColor.g, theme.primaryColor.b),
      });
      titleY -= 44;
    }

    // Subtitle / audience
    if (document.audience) {
      currentPage.drawText(`Prepared for ${this.formatAudience(document.audience)}`, {
        x: 72,
        y: titleY - 20,
        size: 14,
        font: fonts.italic,
        color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
      });
    }

    // Date
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
    currentPage.drawText(dateStr, {
      x: 72,
      y: 150,
      size: 12,
      font: fonts.regular,
      color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
    });

    // Company name
    if (options.companyName) {
      currentPage.drawText(options.companyName, {
        x: 72,
        y: 120,
        size: 14,
        font: fonts.bold,
        color: rgb(theme.primaryColor.r, theme.primaryColor.g, theme.primaryColor.b),
      });
    }

    // Confidentiality notice
    if (options.confidentialityNotice) {
      const noticeLines = this.wrapText(options.confidentialityNotice, fonts.italic, 8, width - 144);
      let noticeY = 80;
      for (const line of noticeLines) {
        currentPage.drawText(line, {
          x: 72,
          y: noticeY,
          size: 8,
          font: fonts.italic,
          color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
        });
        noticeY -= 10;
      }
    }
  }

  /**
   * Create table of contents
   */
  private createTableOfContents(ctx: PdfContext, document: DocumentData): void {
    const { currentPage, fonts, theme, pageSize, margins } = ctx;
    const [width] = pageSize;

    // Title
    currentPage.drawText('Table of Contents', {
      x: margins.left,
      y: ctx.yPosition,
      size: 24,
      font: fonts.bold,
      color: rgb(theme.primaryColor.r, theme.primaryColor.g, theme.primaryColor.b),
    });

    ctx.yPosition -= 50;

    // Section entries
    const enabledSections = document.sections.filter(s => s.enabled);
    let pageNum = 3; // Start after title and TOC pages

    for (const section of enabledSections) {
      const sectionDef = SECTION_LIBRARY[section.sectionKey];
      const name = sectionDef?.name || section.sectionKey;

      // Section name
      currentPage.drawText(name, {
        x: margins.left,
        y: ctx.yPosition,
        size: 12,
        font: fonts.regular,
        color: rgb(theme.textColor.r, theme.textColor.g, theme.textColor.b),
      });

      // Page number
      const pageNumText = pageNum.toString();
      const pageNumWidth = fonts.regular.widthOfTextAtSize(pageNumText, 12);
      currentPage.drawText(pageNumText, {
        x: width - margins.right - pageNumWidth,
        y: ctx.yPosition,
        size: 12,
        font: fonts.regular,
        color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
      });

      // Dotted line
      const nameWidth = fonts.regular.widthOfTextAtSize(name, 12);
      const dotsStart = margins.left + nameWidth + 10;
      const dotsEnd = width - margins.right - pageNumWidth - 10;
      let dotX = dotsStart;
      while (dotX < dotsEnd) {
        currentPage.drawText('.', {
          x: dotX,
          y: ctx.yPosition,
          size: 12,
          font: fonts.regular,
          color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
        });
        dotX += 6;
      }

      ctx.yPosition -= 24;
      pageNum++;
    }
  }

  /**
   * Create section content
   */
  private async createSectionContent(
    ctx: PdfContext,
    section: DocumentSection,
    document: DocumentData
  ): Promise<void> {
    const sectionDef = SECTION_LIBRARY[section.sectionKey];
    if (!sectionDef) return;

    // Section header
    this.drawSectionHeader(ctx, sectionDef.name);

    // Content based on category
    switch (sectionDef.category) {
      case SectionCategory.SUMMARY:
        this.drawSummaryContent(ctx, section);
        break;

      case SectionCategory.PROPERTY:
        this.drawPropertyContent(ctx, section);
        break;

      case SectionCategory.MARKET:
        this.drawMarketContent(ctx, section);
        break;

      case SectionCategory.FINANCIAL:
        this.drawFinancialContent(ctx, section);
        break;

      case SectionCategory.UNDERWRITING:
        this.drawUnderwritingContent(ctx, section);
        break;

      case SectionCategory.DUE_DILIGENCE:
        this.drawDueDiligenceContent(ctx, section);
        break;

      default:
        this.drawGenericContent(ctx, section);
    }
  }

  /**
   * Draw section header
   */
  private drawSectionHeader(ctx: PdfContext, title: string): void {
    const { currentPage, fonts, theme, pageSize, margins } = ctx;
    const [width] = pageSize;

    // Header bar
    currentPage.drawRectangle({
      x: 0,
      y: ctx.yPosition - 10,
      width,
      height: 50,
      color: rgb(theme.primaryColor.r, theme.primaryColor.g, theme.primaryColor.b),
    });

    // Title text
    currentPage.drawText(title, {
      x: margins.left,
      y: ctx.yPosition + 5,
      size: 20,
      font: fonts.bold,
      color: rgb(1, 1, 1),
    });

    ctx.yPosition -= 70;
  }

  /**
   * Draw summary content
   */
  private drawSummaryContent(ctx: PdfContext, section: DocumentSection): void {
    const { currentPage, fonts, theme, pageSize, margins } = ctx;
    const [width] = pageSize;
    const content = section.content as any;
    const contentWidth = width - margins.left - margins.right;

    // Executive summary
    if (content?.executiveSummary || content?.summary || content?.overview) {
      const summaryText = content.executiveSummary || content.summary || content.overview;
      ctx.yPosition = this.drawParagraph(ctx, summaryText, contentWidth);
    }

    // Investment highlights
    if (content?.investmentHighlights && Array.isArray(content.investmentHighlights)) {
      ctx.yPosition -= 30;
      currentPage.drawText('Investment Highlights', {
        x: margins.left,
        y: ctx.yPosition,
        size: 14,
        font: fonts.bold,
        color: rgb(theme.secondaryColor.r, theme.secondaryColor.g, theme.secondaryColor.b),
      });
      ctx.yPosition -= 20;

      for (const highlight of content.investmentHighlights) {
        // Bullet point
        currentPage.drawText('•', {
          x: margins.left,
          y: ctx.yPosition,
          size: 12,
          font: fonts.regular,
          color: rgb(theme.accentColor.r, theme.accentColor.g, theme.accentColor.b),
        });

        // Highlight text
        const lines = this.wrapText(highlight, fonts.regular, 11, contentWidth - 20);
        for (const line of lines) {
          currentPage.drawText(line, {
            x: margins.left + 15,
            y: ctx.yPosition,
            size: 11,
            font: fonts.regular,
            color: rgb(theme.textColor.r, theme.textColor.g, theme.textColor.b),
          });
          ctx.yPosition -= 14;
        }
        ctx.yPosition -= 4;
      }
    }
  }

  /**
   * Draw property content
   */
  private drawPropertyContent(ctx: PdfContext, section: DocumentSection): void {
    const { pageSize, margins } = ctx;
    const [width] = pageSize;
    const content = section.content as any;
    const contentWidth = width - margins.left - margins.right;

    // Property metrics
    const metrics = [
      { label: 'Property Name', value: content?.propertyName || 'N/A' },
      { label: 'Location', value: this.formatLocation(content) },
      { label: 'Total Slips', value: this.formatNumber(content?.totalSlips) },
      { label: 'Wet Slips', value: this.formatNumber(content?.wetSlips) },
      { label: 'Dry Storage', value: this.formatNumber(content?.dryStorage) },
      { label: 'Acreage', value: content?.acreage ? `${content.acreage} acres` : 'N/A' },
      { label: 'Year Built', value: content?.yearBuilt?.toString() || 'N/A' },
      { label: 'Water Frontage', value: content?.waterFrontage ? `${content.waterFrontage} ft` : 'N/A' },
    ];

    ctx.yPosition = this.drawMetricsGrid(ctx, metrics, 2, 4);

    // Property description
    if (content?.description) {
      ctx.yPosition -= 30;
      this.drawSubheading(ctx, 'Property Description');
      ctx.yPosition = this.drawParagraph(ctx, content.description, contentWidth);
    }
  }

  /**
   * Draw market content
   */
  private drawMarketContent(ctx: PdfContext, section: DocumentSection): void {
    const { currentPage, fonts, theme, pageSize, margins } = ctx;
    const [width] = pageSize;
    const content = section.content as any;
    const contentWidth = width - margins.left - margins.right;

    // Market overview text
    if (content?.marketOverview) {
      ctx.yPosition = this.drawParagraph(ctx, content.marketOverview, contentWidth * 0.6);
    }

    // Demographics
    ctx.yPosition -= 20;
    this.drawSubheading(ctx, 'Demographics');

    const demographics = [
      { label: 'Population', value: this.formatNumber(content?.population) },
      { label: 'Median Household Income', value: this.formatCurrency(content?.medianIncome) },
      { label: 'Boat Registrations', value: this.formatNumber(content?.boatRegistrations) },
      { label: 'Population Growth', value: this.formatPercent(content?.populationGrowth) },
    ];

    ctx.yPosition = this.drawMetricsList(ctx, demographics);
  }

  /**
   * Draw financial content
   */
  private drawFinancialContent(ctx: PdfContext, section: DocumentSection): void {
    const content = section.content as any;

    // Key financial metrics
    const metrics = [
      { label: 'Asking Price', value: this.formatCurrency(content?.askingPrice) },
      { label: 'Net Operating Income', value: this.formatCurrency(content?.noi) },
      { label: 'Cap Rate', value: this.formatPercent(content?.capRate) },
      { label: 'Price per Slip', value: this.formatCurrency(content?.pricePerSlip) },
      { label: 'Total Revenue', value: this.formatCurrency(content?.totalRevenue) },
      { label: 'Operating Expenses', value: this.formatCurrency(content?.operatingExpenses) },
      { label: 'Expense Ratio', value: this.formatPercent(content?.expenseRatio) },
      { label: 'Cash on Cash', value: this.formatPercent(content?.cashOnCash) },
    ];

    ctx.yPosition = this.drawMetricsGrid(ctx, metrics, 2, 4);

    // Revenue breakdown
    if (content?.revenueBreakdown) {
      ctx.yPosition -= 30;
      this.drawSubheading(ctx, 'Revenue Breakdown');

      const breakdown = Object.entries(content.revenueBreakdown).map(([key, value]) => ({
        label: this.formatLabel(key),
        value: this.formatCurrency(value as number),
      }));

      ctx.yPosition = this.drawMetricsList(ctx, breakdown);
    }
  }

  /**
   * Draw underwriting content
   */
  private drawUnderwritingContent(ctx: PdfContext, section: DocumentSection): void {
    const content = section.content as any;

    // Investment returns
    const returns = [
      { label: 'Purchase Price', value: this.formatCurrency(content?.purchasePrice) },
      { label: 'Equity Required', value: this.formatCurrency(content?.equityRequired) },
      { label: 'Levered IRR', value: this.formatPercent(content?.leveredIrr) },
      { label: 'Unlevered IRR', value: this.formatPercent(content?.unleveredIrr) },
      { label: 'Equity Multiple', value: content?.equityMultiple ? `${content.equityMultiple.toFixed(2)}x` : 'N/A' },
      { label: 'Hold Period', value: content?.holdPeriod ? `${content.holdPeriod} years` : 'N/A' },
      { label: 'Exit Cap Rate', value: this.formatPercent(content?.exitCapRate) },
      { label: 'DSCR', value: content?.dscr ? content.dscr.toFixed(2) : 'N/A' },
    ];

    ctx.yPosition = this.drawMetricsGrid(ctx, returns, 2, 4);

    // Financing assumptions
    if (content?.financing) {
      ctx.yPosition -= 30;
      this.drawSubheading(ctx, 'Financing Assumptions');

      const financing = [
        { label: 'Loan Amount', value: this.formatCurrency(content.financing?.loanAmount) },
        { label: 'LTV', value: this.formatPercent(content.financing?.ltv) },
        { label: 'Interest Rate', value: this.formatPercent(content.financing?.interestRate) },
        { label: 'Loan Term', value: content.financing?.term ? `${content.financing.term} years` : 'N/A' },
      ];

      ctx.yPosition = this.drawMetricsList(ctx, financing);
    }
  }

  /**
   * Draw due diligence content
   */
  private drawDueDiligenceContent(ctx: PdfContext, section: DocumentSection): void {
    const { currentPage, fonts, theme, pageSize, margins } = ctx;
    const [width] = pageSize;
    const content = section.content as any;
    const contentWidth = width - margins.left - margins.right;

    // Risk factors
    if (content?.riskFactors && Array.isArray(content.riskFactors)) {
      this.drawSubheading(ctx, 'Risk Factors');

      for (const risk of content.riskFactors) {
        const riskText = typeof risk === 'string' ? risk : risk.description;

        // Red bullet
        currentPage.drawText('•', {
          x: margins.left,
          y: ctx.yPosition,
          size: 12,
          font: fonts.regular,
          color: rgb(0.8, 0, 0),
        });

        // Risk text
        const lines = this.wrapText(riskText, fonts.regular, 10, contentWidth - 20);
        for (const line of lines) {
          currentPage.drawText(line, {
            x: margins.left + 15,
            y: ctx.yPosition,
            size: 10,
            font: fonts.regular,
            color: rgb(theme.textColor.r, theme.textColor.g, theme.textColor.b),
          });
          ctx.yPosition -= 12;
        }
        ctx.yPosition -= 4;
      }
    }

    // Mitigants
    if (content?.mitigants && Array.isArray(content.mitigants)) {
      ctx.yPosition -= 20;
      this.drawSubheading(ctx, 'Risk Mitigants');

      for (const mitigant of content.mitigants) {
        const mitigantText = typeof mitigant === 'string' ? mitigant : mitigant.description;

        // Green bullet
        currentPage.drawText('•', {
          x: margins.left,
          y: ctx.yPosition,
          size: 12,
          font: fonts.regular,
          color: rgb(0, 0.6, 0),
        });

        // Mitigant text
        const lines = this.wrapText(mitigantText, fonts.regular, 10, contentWidth - 20);
        for (const line of lines) {
          currentPage.drawText(line, {
            x: margins.left + 15,
            y: ctx.yPosition,
            size: 10,
            font: fonts.regular,
            color: rgb(theme.textColor.r, theme.textColor.g, theme.textColor.b),
          });
          ctx.yPosition -= 12;
        }
        ctx.yPosition -= 4;
      }
    }
  }

  /**
   * Draw generic content
   */
  private drawGenericContent(ctx: PdfContext, section: DocumentSection): void {
    const { pageSize, margins } = ctx;
    const [width] = pageSize;
    const content = section.content as any;
    const contentWidth = width - margins.left - margins.right;

    const textContent = this.extractTextContent(content);
    if (textContent) {
      ctx.yPosition = this.drawParagraph(ctx, textContent, contentWidth);
    }
  }

  /**
   * Draw subheading
   */
  private drawSubheading(ctx: PdfContext, text: string): void {
    const { currentPage, fonts, theme, margins } = ctx;

    currentPage.drawText(text, {
      x: margins.left,
      y: ctx.yPosition,
      size: 14,
      font: fonts.bold,
      color: rgb(theme.secondaryColor.r, theme.secondaryColor.g, theme.secondaryColor.b),
    });

    ctx.yPosition -= 24;
  }

  /**
   * Draw paragraph
   */
  private drawParagraph(ctx: PdfContext, text: string, width: number): number {
    const { currentPage, fonts, theme, margins } = ctx;
    const lines = this.wrapText(text, fonts.regular, 11, width);

    for (const line of lines) {
      currentPage.drawText(line, {
        x: margins.left,
        y: ctx.yPosition,
        size: 11,
        font: fonts.regular,
        color: rgb(theme.textColor.r, theme.textColor.g, theme.textColor.b),
      });
      ctx.yPosition -= 14;
    }

    return ctx.yPosition;
  }

  /**
   * Draw metrics grid
   */
  private drawMetricsGrid(
    ctx: PdfContext,
    metrics: Array<{ label: string; value: string }>,
    cols: number,
    rows: number
  ): number {
    const { currentPage, fonts, theme, pageSize, margins } = ctx;
    const [width] = pageSize;
    const contentWidth = width - margins.left - margins.right;
    const cellWidth = (contentWidth - 20) / cols;
    const cellHeight = 50;

    metrics.forEach((metric, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      if (row >= rows) return;

      const x = margins.left + col * (cellWidth + 10);
      const y = ctx.yPosition - row * (cellHeight + 10);

      // Background
      currentPage.drawRectangle({
        x,
        y: y - cellHeight + 15,
        width: cellWidth,
        height: cellHeight,
        color: rgb(theme.backgroundColor.r, theme.backgroundColor.g, theme.backgroundColor.b),
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 0.5,
      });

      // Label
      currentPage.drawText(metric.label, {
        x: x + 8,
        y: y - 8,
        size: 9,
        font: fonts.regular,
        color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
      });

      // Value
      currentPage.drawText(metric.value, {
        x: x + 8,
        y: y - 28,
        size: 14,
        font: fonts.bold,
        color: rgb(theme.primaryColor.r, theme.primaryColor.g, theme.primaryColor.b),
      });
    });

    const totalRows = Math.ceil(metrics.length / cols);
    return ctx.yPosition - totalRows * (cellHeight + 10);
  }

  /**
   * Draw metrics list
   */
  private drawMetricsList(
    ctx: PdfContext,
    metrics: Array<{ label: string; value: string }>
  ): number {
    const { currentPage, fonts, theme, margins } = ctx;

    for (const metric of metrics) {
      // Label
      currentPage.drawText(metric.label + ':', {
        x: margins.left,
        y: ctx.yPosition,
        size: 10,
        font: fonts.regular,
        color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
      });

      // Value
      currentPage.drawText(metric.value, {
        x: margins.left + 180,
        y: ctx.yPosition,
        size: 10,
        font: fonts.bold,
        color: rgb(theme.textColor.r, theme.textColor.g, theme.textColor.b),
      });

      ctx.yPosition -= 16;
    }

    return ctx.yPosition;
  }

  /**
   * Create disclaimer page
   */
  private createDisclaimer(ctx: PdfContext): void {
    const { currentPage, fonts, theme, pageSize, margins, options } = ctx;
    const [width] = pageSize;
    const contentWidth = width - margins.left - margins.right;
    const companyName = options.companyName || 'MarinaMatch';

    // Title
    currentPage.drawText('Important Disclosures', {
      x: margins.left,
      y: ctx.yPosition,
      size: 20,
      font: fonts.bold,
      color: rgb(theme.primaryColor.r, theme.primaryColor.g, theme.primaryColor.b),
    });

    ctx.yPosition -= 40;

    const disclaimers = [
      `This document has been prepared by ${companyName} for informational purposes only. The information contained herein is confidential and is being provided to you solely for the purpose of evaluating the potential acquisition of the property described herein.`,
      'This document is not intended to provide any investment, tax, accounting, or legal advice. Recipients should consult with their own advisors regarding investment, tax, accounting, and legal matters.',
      'The information contained in this document has been obtained from sources believed to be reliable, but no representation or warranty, express or implied, is made as to the accuracy or completeness of such information.',
      'Past performance is not indicative of future results. Actual results may differ materially from any projections or forward-looking statements contained herein.',
      'This document does not constitute an offer to sell or a solicitation of an offer to buy any securities. Any such offer may only be made pursuant to definitive transaction documents.',
    ];

    for (const disclaimer of disclaimers) {
      const lines = this.wrapText(disclaimer, fonts.italic, 10, contentWidth);
      for (const line of lines) {
        currentPage.drawText(line, {
          x: margins.left,
          y: ctx.yPosition,
          size: 10,
          font: fonts.italic,
          color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
        });
        ctx.yPosition -= 13;
      }
      ctx.yPosition -= 10;
    }
  }

  /**
   * Add header to page
   */
  private addHeader(
    page: PDFPage,
    title: string,
    theme: PdfTheme,
    font: PDFFont
  ): void {
    const { width } = page.getSize();
    const titleWidth = font.widthOfTextAtSize(title, 9);

    page.drawText(title, {
      x: width - 72 - titleWidth,
      y: page.getHeight() - 36,
      size: 9,
      font,
      color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
    });
  }

  /**
   * Add footer to page
   */
  private addFooter(
    page: PDFPage,
    pageNum: number,
    totalPages: number,
    theme: PdfTheme,
    font: PDFFont,
    options: PdfExportOptions
  ): void {
    const { width } = page.getSize();

    // Page number
    const pageText = `Page ${pageNum} of ${totalPages}`;
    const pageTextWidth = font.widthOfTextAtSize(pageText, 9);

    page.drawText(pageText, {
      x: (width - pageTextWidth) / 2,
      y: 36,
      size: 9,
      font,
      color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
    });

    // Confidentiality notice
    if (options.confidentialityNotice) {
      const noticeWidth = font.widthOfTextAtSize(options.confidentialityNotice, 7);
      page.drawText(options.confidentialityNotice, {
        x: (width - noticeWidth) / 2,
        y: 24,
        size: 7,
        font,
        color: rgb(theme.textLightColor.r, theme.textLightColor.g, theme.textLightColor.b),
      });
    }
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private getDocumentTypeLabel(docType: DocumentType): string {
    const labels: Record<DocumentType, string> = {
      [DocumentType.OFFERING_MEMORANDUM]: 'Offering Memorandum',
      [DocumentType.INVESTMENT_COMMITTEE_MEMO]: 'Investment Committee Memo',
      [DocumentType.PITCH_DECK]: 'Pitch Deck',
      [DocumentType.EXECUTIVE_SUMMARY]: 'Executive Summary',
      [DocumentType.TEASER]: 'Investment Teaser',
      [DocumentType.LENDER_PACKAGE]: 'Lender Package',
      [DocumentType.DD_SUMMARY]: 'Due Diligence Summary',
      [DocumentType.CUSTOM]: 'Custom Document',
    };
    return labels[docType] || 'Document';
  }

  private formatAudience(audience: AudiencePersona): string {
    const labels: Record<AudiencePersona, string> = {
      [AudiencePersona.INSTITUTIONAL_INVESTOR]: 'Institutional Investors',
      [AudiencePersona.LENDER]: 'Lenders',
      [AudiencePersona.BROKER]: 'Brokers',
      [AudiencePersona.OWNER_OPERATOR]: 'Owner-Operators',
      [AudiencePersona.MANAGEMENT_COMPANY]: 'Management Companies',
      [AudiencePersona.INTERNAL_TEAM]: 'Internal Review',
    };
    return labels[audience] || 'Investors';
  }

  private formatCurrency(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }

  private formatPercent(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return `${num.toFixed(2)}%`;
  }

  private formatNumber(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('en-US').format(num);
  }

  private formatLocation(content: any): string {
    const parts = [];
    if (content?.city) parts.push(content.city);
    if (content?.state) parts.push(content.state);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }

  private formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
      .trim();
  }

  private extractTextContent(content: any): string {
    if (typeof content === 'string') return content;

    const textFields = ['content', 'text', 'body', 'description', 'summary', 'overview', 'narrative'];
    for (const field of textFields) {
      if (content?.[field] && typeof content[field] === 'string') {
        return content[field];
      }
    }

    return '';
  }
}

export const pdfExportService = new PdfExportService();
