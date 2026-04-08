import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { OMData, PropertyOverview, FinancialSummary, RentRollSummary, OperationsSummary, CompAnalytics, MarketDemographics } from './om-builder-service';

export type PDFTemplateType = 'standard' | 'premium' | 'executive';

export interface PDFGeneratorOptions {
  templateType: PDFTemplateType;
  includeWatermark?: boolean;
  watermarkText?: string;
  companyName?: string;
  companyLogo?: Uint8Array | null;
  primaryColor?: { r: number; g: number; b: number };
  accentColor?: { r: number; g: number; b: number };
}

interface PDFContext {
  doc: PDFDocument;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
    italic: PDFFont;
  };
  colors: {
    primary: ReturnType<typeof rgb>;
    accent: ReturnType<typeof rgb>;
    text: ReturnType<typeof rgb>;
    textLight: ReturnType<typeof rgb>;
    background: ReturnType<typeof rgb>;
    border: ReturnType<typeof rgb>;
  };
  pageSize: readonly [number, number];
  margins: { top: number; bottom: number; left: number; right: number };
  currentPage: PDFPage;
  pageNumber: number;
  totalPages: number;
  yPosition: number;
  options: PDFGeneratorOptions;
}

const DEFAULT_OPTIONS: PDFGeneratorOptions = {
  templateType: 'standard',
  includeWatermark: false,
  companyName: 'Vantage',
  primaryColor: { r: 0.047, g: 0.329, b: 0.533 }, // Navy blue
  accentColor: { r: 0.180, g: 0.545, b: 0.671 }, // Teal
};

export class PDFGeneratorService {
  private formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(2)}%`;
  }

  private formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US').format(value);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  private async createContext(options: Partial<PDFGeneratorOptions> = {}): Promise<PDFContext> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

    const { primaryColor, accentColor } = mergedOptions;

    return {
      doc,
      fonts: { regular, bold, italic },
      colors: {
        primary: rgb(primaryColor!.r, primaryColor!.g, primaryColor!.b),
        accent: rgb(accentColor!.r, accentColor!.g, accentColor!.b),
        text: rgb(0.1, 0.1, 0.1),
        textLight: rgb(0.4, 0.4, 0.4),
        background: rgb(0.98, 0.98, 0.98),
        border: rgb(0.8, 0.8, 0.8),
      },
      pageSize: PageSizes.Letter,
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      currentPage: null as any,
      pageNumber: 0,
      totalPages: 0,
      yPosition: 0,
      options: mergedOptions,
    };
  }

  private addPage(ctx: PDFContext): PDFPage {
    const page = ctx.doc.addPage(ctx.pageSize);
    ctx.currentPage = page;
    ctx.pageNumber++;
    ctx.yPosition = ctx.pageSize[1] - ctx.margins.top;
    return page;
  }

  private addHeader(ctx: PDFContext, data: OMData): void {
    const page = ctx.currentPage;
    const { width } = page.getSize();
    
    if (ctx.pageNumber > 1) {
      page.drawText(data.propertyOverview.name, {
        x: ctx.margins.left,
        y: ctx.pageSize[1] - 40,
        size: 10,
        font: ctx.fonts.bold,
        color: ctx.colors.primary,
      });

      page.drawText('OFFERING MEMORANDUM', {
        x: width - ctx.margins.right - 120,
        y: ctx.pageSize[1] - 40,
        size: 8,
        font: ctx.fonts.regular,
        color: ctx.colors.textLight,
      });

      page.drawLine({
        start: { x: ctx.margins.left, y: ctx.pageSize[1] - 50 },
        end: { x: width - ctx.margins.right, y: ctx.pageSize[1] - 50 },
        thickness: 1,
        color: ctx.colors.border,
      });
    }
  }

  private addFooter(ctx: PDFContext, totalPages: number): void {
    const page = ctx.currentPage;
    const { width } = page.getSize();
    
    page.drawLine({
      start: { x: ctx.margins.left, y: 50 },
      end: { x: width - ctx.margins.right, y: 50 },
      thickness: 0.5,
      color: ctx.colors.border,
    });

    page.drawText(`Page ${ctx.pageNumber} of ${totalPages}`, {
      x: width / 2 - 30,
      y: 35,
      size: 9,
      font: ctx.fonts.regular,
      color: ctx.colors.textLight,
    });

    if (ctx.options.companyName) {
      page.drawText(`Prepared by ${ctx.options.companyName}`, {
        x: ctx.margins.left,
        y: 35,
        size: 8,
        font: ctx.fonts.italic,
        color: ctx.colors.textLight,
      });
    }

    page.drawText('CONFIDENTIAL', {
      x: width - ctx.margins.right - 80,
      y: 35,
      size: 8,
      font: ctx.fonts.bold,
      color: ctx.colors.textLight,
    });
  }

  private drawTitle(ctx: PDFContext, text: string, size: number = 18): number {
    const page = ctx.currentPage;
    
    page.drawText(text, {
      x: ctx.margins.left,
      y: ctx.yPosition,
      size,
      font: ctx.fonts.bold,
      color: ctx.colors.primary,
    });
    
    ctx.yPosition -= size + 8;
    return ctx.yPosition;
  }

  private drawSubtitle(ctx: PDFContext, text: string, size: number = 14): number {
    const page = ctx.currentPage;
    
    page.drawText(text, {
      x: ctx.margins.left,
      y: ctx.yPosition,
      size,
      font: ctx.fonts.bold,
      color: ctx.colors.text,
    });
    
    ctx.yPosition -= size + 6;
    return ctx.yPosition;
  }

  private drawParagraph(ctx: PDFContext, text: string, options: { size?: number; maxWidth?: number; lineHeight?: number } = {}): number {
    const page = ctx.currentPage;
    const { size = 10, lineHeight = 14 } = options;
    const maxWidth = options.maxWidth || (ctx.pageSize[0] - ctx.margins.left - ctx.margins.right);
    
    const words = text.split(' ');
    let currentLine = '';
    const lines: string[] = [];

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = ctx.fonts.regular.widthOfTextAtSize(testLine, size);
      
      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    for (const line of lines) {
      if (ctx.yPosition < ctx.margins.bottom + 50) {
        this.addPage(ctx);
      }
      
      page.drawText(line, {
        x: ctx.margins.left,
        y: ctx.yPosition,
        size,
        font: ctx.fonts.regular,
        color: ctx.colors.text,
      });
      ctx.yPosition -= lineHeight;
    }

    return ctx.yPosition;
  }

  private drawBulletPoint(ctx: PDFContext, text: string, indent: number = 0): number {
    const page = ctx.currentPage;
    const bulletX = ctx.margins.left + indent;
    
    page.drawText('•', {
      x: bulletX,
      y: ctx.yPosition,
      size: 10,
      font: ctx.fonts.regular,
      color: ctx.colors.accent,
    });

    page.drawText(text, {
      x: bulletX + 15,
      y: ctx.yPosition,
      size: 10,
      font: ctx.fonts.regular,
      color: ctx.colors.text,
    });
    
    ctx.yPosition -= 16;
    return ctx.yPosition;
  }

  private drawKeyValue(ctx: PDFContext, label: string, value: string, options: { labelWidth?: number; valueAlign?: 'left' | 'right' } = {}): number {
    const page = ctx.currentPage;
    const { labelWidth = 180, valueAlign = 'left' } = options;
    
    page.drawText(label, {
      x: ctx.margins.left,
      y: ctx.yPosition,
      size: 10,
      font: ctx.fonts.regular,
      color: ctx.colors.textLight,
    });

    const valueX = valueAlign === 'right' 
      ? ctx.pageSize[0] - ctx.margins.right - ctx.fonts.bold.widthOfTextAtSize(value, 10)
      : ctx.margins.left + labelWidth;

    page.drawText(value, {
      x: valueX,
      y: ctx.yPosition,
      size: 10,
      font: ctx.fonts.bold,
      color: ctx.colors.text,
    });
    
    ctx.yPosition -= 18;
    return ctx.yPosition;
  }

  private drawHorizontalRule(ctx: PDFContext): number {
    const page = ctx.currentPage;
    const { width } = page.getSize();
    
    page.drawLine({
      start: { x: ctx.margins.left, y: ctx.yPosition },
      end: { x: width - ctx.margins.right, y: ctx.yPosition },
      thickness: 0.5,
      color: ctx.colors.border,
    });
    
    ctx.yPosition -= 15;
    return ctx.yPosition;
  }

  private drawKPIBox(ctx: PDFContext, label: string, value: string, x: number, width: number): void {
    const page = ctx.currentPage;
    const boxHeight = 60;
    
    page.drawRectangle({
      x,
      y: ctx.yPosition - boxHeight,
      width,
      height: boxHeight,
      color: ctx.colors.background,
      borderColor: ctx.colors.border,
      borderWidth: 1,
    });

    const labelWidth = ctx.fonts.regular.widthOfTextAtSize(label, 9);
    page.drawText(label, {
      x: x + (width - labelWidth) / 2,
      y: ctx.yPosition - 20,
      size: 9,
      font: ctx.fonts.regular,
      color: ctx.colors.textLight,
    });

    const valueWidth = ctx.fonts.bold.widthOfTextAtSize(value, 14);
    page.drawText(value, {
      x: x + (width - valueWidth) / 2,
      y: ctx.yPosition - 45,
      size: 14,
      font: ctx.fonts.bold,
      color: ctx.colors.primary,
    });
  }

  private drawTable(ctx: PDFContext, headers: string[], rows: string[][], options: { columnWidths?: number[] } = {}): number {
    const page = ctx.currentPage;
    const tableWidth = ctx.pageSize[0] - ctx.margins.left - ctx.margins.right;
    const columnCount = headers.length;
    const defaultColumnWidth = tableWidth / columnCount;
    const columnWidths = options.columnWidths || Array(columnCount).fill(defaultColumnWidth);
    const rowHeight = 24;

    page.drawRectangle({
      x: ctx.margins.left,
      y: ctx.yPosition - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: ctx.colors.primary,
    });

    let xPos = ctx.margins.left;
    for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i], {
        x: xPos + 8,
        y: ctx.yPosition - 16,
        size: 9,
        font: ctx.fonts.bold,
        color: rgb(1, 1, 1),
      });
      xPos += columnWidths[i];
    }
    ctx.yPosition -= rowHeight;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const bgColor = rowIndex % 2 === 0 ? rgb(1, 1, 1) : ctx.colors.background;
      
      page.drawRectangle({
        x: ctx.margins.left,
        y: ctx.yPosition - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: bgColor,
        borderColor: ctx.colors.border,
        borderWidth: 0.5,
      });

      xPos = ctx.margins.left;
      for (let i = 0; i < row.length; i++) {
        const cellText = row[i] || '';
        const truncated = cellText.length > 30 ? cellText.substring(0, 27) + '...' : cellText;
        page.drawText(truncated, {
          x: xPos + 8,
          y: ctx.yPosition - 16,
          size: 9,
          font: ctx.fonts.regular,
          color: ctx.colors.text,
        });
        xPos += columnWidths[i];
      }
      ctx.yPosition -= rowHeight;
    }

    ctx.yPosition -= 10;
    return ctx.yPosition;
  }

  private drawSimpleBarChart(ctx: PDFContext, data: { label: string; value: number; color?: ReturnType<typeof rgb> }[], title: string): number {
    const page = ctx.currentPage;
    const chartWidth = ctx.pageSize[0] - ctx.margins.left - ctx.margins.right;
    const chartHeight = 120;
    const barWidth = Math.min(60, (chartWidth - 40) / data.length - 10);
    const maxValue = Math.max(...data.map(d => d.value), 1);

    page.drawText(title, {
      x: ctx.margins.left,
      y: ctx.yPosition,
      size: 12,
      font: ctx.fonts.bold,
      color: ctx.colors.text,
    });
    ctx.yPosition -= 20;

    const chartTop = ctx.yPosition;
    const chartBottom = ctx.yPosition - chartHeight;

    page.drawLine({
      start: { x: ctx.margins.left, y: chartBottom },
      end: { x: ctx.margins.left + chartWidth, y: chartBottom },
      thickness: 1,
      color: ctx.colors.border,
    });

    let barX = ctx.margins.left + 30;
    for (const item of data) {
      const barHeight = (item.value / maxValue) * (chartHeight - 30);
      const barColor = item.color || ctx.colors.accent;
      
      page.drawRectangle({
        x: barX,
        y: chartBottom,
        width: barWidth,
        height: barHeight,
        color: barColor,
      });

      const labelText = item.label.length > 8 ? item.label.substring(0, 6) + '..' : item.label;
      const labelWidth = ctx.fonts.regular.widthOfTextAtSize(labelText, 8);
      page.drawText(labelText, {
        x: barX + (barWidth - labelWidth) / 2,
        y: chartBottom - 12,
        size: 8,
        font: ctx.fonts.regular,
        color: ctx.colors.textLight,
      });

      const valueText = this.formatCurrency(item.value);
      const valueWidth = ctx.fonts.regular.widthOfTextAtSize(valueText, 7);
      page.drawText(valueText, {
        x: barX + (barWidth - valueWidth) / 2,
        y: chartBottom + barHeight + 5,
        size: 7,
        font: ctx.fonts.regular,
        color: ctx.colors.text,
      });

      barX += barWidth + 15;
    }

    ctx.yPosition = chartBottom - 25;
    return ctx.yPosition;
  }

  private drawCoverPage(ctx: PDFContext, data: OMData): void {
    const page = ctx.currentPage;
    const { width, height } = page.getSize();

    page.drawRectangle({
      x: 0,
      y: height - 200,
      width,
      height: 200,
      color: ctx.colors.primary,
    });

    page.drawRectangle({
      x: 0,
      y: height - 205,
      width,
      height: 5,
      color: ctx.colors.accent,
    });

    const marinaName = data.propertyOverview.name;
    const nameWidth = ctx.fonts.bold.widthOfTextAtSize(marinaName, 36);
    page.drawText(marinaName, {
      x: (width - nameWidth) / 2,
      y: height - 120,
      size: 36,
      font: ctx.fonts.bold,
      color: rgb(1, 1, 1),
    });

    const subtitle = 'OFFERING MEMORANDUM';
    const subtitleWidth = ctx.fonts.regular.widthOfTextAtSize(subtitle, 16);
    page.drawText(subtitle, {
      x: (width - subtitleWidth) / 2,
      y: height - 160,
      size: 16,
      font: ctx.fonts.regular,
      color: rgb(0.9, 0.9, 0.9),
    });

    const locationParts = [
      data.propertyOverview.city,
      data.propertyOverview.state,
    ].filter(Boolean);
    const location = locationParts.join(', ') || 'Location TBD';
    const locationWidth = ctx.fonts.regular.widthOfTextAtSize(location, 14);
    page.drawText(location, {
      x: (width - locationWidth) / 2,
      y: height - 250,
      size: 14,
      font: ctx.fonts.regular,
      color: ctx.colors.text,
    });

    const highlights = [
      data.propertyOverview.totalSlips ? `${data.propertyOverview.totalSlips} Total Slips` : null,
      data.financialSummary.purchasePrice ? `Asking: ${this.formatCurrency(data.financialSummary.purchasePrice)}` : null,
      data.financialSummary.capRate ? `Cap Rate: ${this.formatPercent(data.financialSummary.capRate)}` : null,
    ].filter(Boolean) as string[];

    let highlightY = height - 350;
    for (const highlight of highlights) {
      const highlightWidth = ctx.fonts.bold.widthOfTextAtSize(highlight, 14);
      page.drawText(highlight, {
        x: (width - highlightWidth) / 2,
        y: highlightY,
        size: 14,
        font: ctx.fonts.bold,
        color: ctx.colors.primary,
      });
      highlightY -= 30;
    }

    const dateText = this.formatDate(data.generatedAt);
    const dateWidth = ctx.fonts.regular.widthOfTextAtSize(dateText, 12);
    page.drawText(dateText, {
      x: (width - dateWidth) / 2,
      y: 120,
      size: 12,
      font: ctx.fonts.regular,
      color: ctx.colors.textLight,
    });

    if (ctx.options.companyName) {
      const preparedBy = `Prepared by ${ctx.options.companyName}`;
      const preparedWidth = ctx.fonts.italic.widthOfTextAtSize(preparedBy, 11);
      page.drawText(preparedBy, {
        x: (width - preparedWidth) / 2,
        y: 100,
        size: 11,
        font: ctx.fonts.italic,
        color: ctx.colors.textLight,
      });
    }

    page.drawText('CONFIDENTIAL', {
      x: (width - ctx.fonts.bold.widthOfTextAtSize('CONFIDENTIAL', 10)) / 2,
      y: 60,
      size: 10,
      font: ctx.fonts.bold,
      color: ctx.colors.textLight,
    });
  }

  private drawPropertyOverview(ctx: PDFContext, data: PropertyOverview): void {
    this.drawTitle(ctx, 'Property Overview');
    ctx.yPosition -= 10;

    this.drawKeyValue(ctx, 'Property Name:', data.name);
    
    const address = [data.address, data.city, data.state, data.zipCode]
      .filter(Boolean)
      .join(', ') || 'Address TBD';
    this.drawKeyValue(ctx, 'Location:', address);
    
    if (data.totalSlips) this.drawKeyValue(ctx, 'Total Slips:', this.formatNumber(data.totalSlips));
    if (data.wetSlips) this.drawKeyValue(ctx, 'Wet Slips:', this.formatNumber(data.wetSlips));
    if (data.drySlips) this.drawKeyValue(ctx, 'Dry Storage:', this.formatNumber(data.drySlips));
    if (data.yearBuilt) this.drawKeyValue(ctx, 'Year Built:', String(data.yearBuilt));
    if (data.waterFrontage) this.drawKeyValue(ctx, 'Water Frontage:', `${this.formatNumber(data.waterFrontage)} ft`);
    if (data.acreage) this.drawKeyValue(ctx, 'Acreage:', `${data.acreage.toFixed(2)} acres`);
    
    ctx.yPosition -= 10;

    if (data.amenities && data.amenities.length > 0) {
      this.drawSubtitle(ctx, 'Amenities & Features');
      for (const amenity of data.amenities.slice(0, 10)) {
        this.drawBulletPoint(ctx, amenity);
      }
    }

    if (data.description) {
      ctx.yPosition -= 10;
      this.drawSubtitle(ctx, 'Description');
      this.drawParagraph(ctx, data.description);
    }
  }

  private drawFinancialSummary(ctx: PDFContext, data: FinancialSummary): void {
    this.drawTitle(ctx, 'Financial Summary');
    ctx.yPosition -= 10;

    const kpiWidth = 120;
    const startX = ctx.margins.left;
    
    this.drawKPIBox(ctx, 'Purchase Price', this.formatCurrency(data.purchasePrice), startX, kpiWidth);
    this.drawKPIBox(ctx, 'NOI', this.formatCurrency(data.noiEstimate), startX + kpiWidth + 10, kpiWidth);
    this.drawKPIBox(ctx, 'Cap Rate', this.formatPercent(data.capRate), startX + (kpiWidth + 10) * 2, kpiWidth);
    this.drawKPIBox(ctx, 'Cash-on-Cash', this.formatPercent(data.cashOnCash), startX + (kpiWidth + 10) * 3, kpiWidth);
    
    ctx.yPosition -= 80;

    this.drawSubtitle(ctx, 'Key Financial Metrics');
    ctx.yPosition -= 5;
    
    if (data.operatingExpenses) this.drawKeyValue(ctx, 'Operating Expenses:', this.formatCurrency(data.operatingExpenses));
    if (data.debtService) this.drawKeyValue(ctx, 'Annual Debt Service:', this.formatCurrency(data.debtService));
    if (data.irr) this.drawKeyValue(ctx, 'Projected IRR:', this.formatPercent(data.irr));

    ctx.yPosition -= 10;
    this.drawHorizontalRule(ctx);
  }

  private drawFinancialProjections(ctx: PDFContext, data: FinancialSummary): void {
    this.drawSubtitle(ctx, 'Revenue Projections');
    ctx.yPosition -= 5;

    const projections = data.revenueProjections;
    const chartData = [
      { label: 'Year 1', value: projections.year1 || 0 },
      { label: 'Year 2', value: projections.year2 || 0 },
      { label: 'Year 3', value: projections.year3 || 0 },
    ].filter(d => d.value > 0);

    if (chartData.length > 0) {
      this.drawSimpleBarChart(ctx, chartData, 'Projected Revenue');
    } else {
      this.drawParagraph(ctx, 'Revenue projections not available.');
    }
  }

  private drawRentRollSummary(ctx: PDFContext, data: RentRollSummary): void {
    this.drawTitle(ctx, 'Rent Roll Summary');
    ctx.yPosition -= 10;

    const kpiWidth = 110;
    const startX = ctx.margins.left;
    
    this.drawKPIBox(ctx, 'Total Units', this.formatNumber(data.totalUnits), startX, kpiWidth);
    this.drawKPIBox(ctx, 'Occupancy Rate', `${data.occupancyRate}%`, startX + kpiWidth + 8, kpiWidth);
    this.drawKPIBox(ctx, 'Annual Revenue', this.formatCurrency(data.totalAnnualRevenue), startX + (kpiWidth + 8) * 2, kpiWidth);
    this.drawKPIBox(ctx, 'Avg Rent/Slip', this.formatCurrency(data.avgRentPerSlip), startX + (kpiWidth + 8) * 3, kpiWidth);
    
    ctx.yPosition -= 80;

    this.drawKeyValue(ctx, 'Occupied Units:', this.formatNumber(data.occupiedUnits));
    this.drawKeyValue(ctx, 'Vacant Units:', this.formatNumber(data.vacantUnits));

    if (data.byType && data.byType.length > 0) {
      ctx.yPosition -= 10;
      this.drawSubtitle(ctx, 'Revenue by Unit Type');
      ctx.yPosition -= 5;
      
      const headers = ['Unit Type', 'Count', 'Avg Rent', 'Total Monthly'];
      const rows = data.byType.map(t => [
        t.type,
        this.formatNumber(t.count),
        this.formatCurrency(t.avgRent),
        this.formatCurrency(t.totalRent),
      ]);
      
      this.drawTable(ctx, headers, rows, { columnWidths: [150, 80, 120, 120] });
    }
  }

  private drawOperationsSummary(ctx: PDFContext, data: OperationsSummary): void {
    this.drawTitle(ctx, 'Operations Overview');
    ctx.yPosition -= 10;

    const revenueStreams = [
      { label: 'Fuel Sales', value: data.fuelSalesAnnual || 0 },
      { label: 'Ship Store', value: data.shipStoreSalesAnnual || 0 },
      { label: 'Service', value: data.serviceRevenue || 0 },
      { label: 'Other', value: data.otherRevenue || 0 },
    ].filter(d => d.value > 0);

    if (revenueStreams.length > 0) {
      this.drawSimpleBarChart(ctx, revenueStreams, 'Ancillary Revenue Streams');
      ctx.yPosition -= 10;
    }

    if (data.staffCount) this.drawKeyValue(ctx, 'Staff Count:', this.formatNumber(data.staffCount));
    if (data.seasonalFactors) {
      ctx.yPosition -= 5;
      this.drawSubtitle(ctx, 'Seasonal Considerations');
      this.drawParagraph(ctx, data.seasonalFactors);
    }
    if (data.managementNotes) {
      ctx.yPosition -= 5;
      this.drawSubtitle(ctx, 'Management Notes');
      this.drawParagraph(ctx, data.managementNotes);
    }
  }

  private drawCompAnalysis(ctx: PDFContext, compAnalytics: CompAnalytics): void {
    if (!compAnalytics) return;

    // Sales Comps Section
    if (compAnalytics.salesComps.length > 0) {
      this.drawTitle(ctx, 'Comparable Sales Analysis');
      ctx.yPosition -= 10;

      // Stats summary
      const stats = compAnalytics.salesCompStats;
      const kpiWidth = 110;
      const startX = ctx.margins.left;

      this.drawKPIBox(ctx, 'Comps Found', String(stats.count), startX, kpiWidth);
      this.drawKPIBox(ctx, 'Avg Sale Price', this.formatCurrency(stats.avgPrice), startX + kpiWidth + 8, kpiWidth);
      this.drawKPIBox(ctx, 'Avg Cap Rate', this.formatPercent(stats.avgCapRate ? stats.avgCapRate * 100 : null), startX + (kpiWidth + 8) * 2, kpiWidth);
      this.drawKPIBox(ctx, 'Avg $/Slip', this.formatCurrency(stats.avgPricePerSlip), startX + (kpiWidth + 8) * 3, kpiWidth);

      ctx.yPosition -= 80;

      // Comps table
      const headers = ['Marina', 'Sale Price', 'Cap Rate', '$/Slip', 'Location', 'Year'];
      const rows = compAnalytics.salesComps.slice(0, 12).map(c => [
        c.marina || 'N/A',
        this.formatCurrency(c.salePrice),
        c.capRate ? this.formatPercent(c.capRate * 100) : 'N/A',
        this.formatCurrency(c.pricePerSlip),
        [c.city, c.state].filter(Boolean).join(', ') || 'N/A',
        c.saleYear ? String(c.saleYear) : 'N/A',
      ]);

      this.drawTable(ctx, headers, rows, {
        columnWidths: [120, 85, 70, 75, 85, 45],
      });

      ctx.yPosition -= 10;
    }

    // Rate Comps Section
    if (compAnalytics.rateComps.length > 0) {
      if (ctx.yPosition < 300) {
        this.addPage(ctx);
      }

      this.drawTitle(ctx, 'Comparable Rate Analysis');
      ctx.yPosition -= 10;

      const rStats = compAnalytics.rateCompStats;
      const kpiW = 140;
      const sX = ctx.margins.left;

      this.drawKPIBox(ctx, 'Rate Comps', String(rStats.count), sX, kpiW);
      this.drawKPIBox(ctx, 'Avg Rate', this.formatCurrency(rStats.avgRate), sX + kpiW + 10, kpiW);
      if (rStats.rateRange) {
        this.drawKPIBox(ctx, 'Rate Range', `${this.formatCurrency(rStats.rateRange.min)} - ${this.formatCurrency(rStats.rateRange.max)}`, sX + (kpiW + 10) * 2, kpiW + 20);
      }

      ctx.yPosition -= 80;

      const headers = ['Marina', 'Rate', 'Type', 'Slips', 'Season', 'Location'];
      const rows = compAnalytics.rateComps.slice(0, 12).map(c => [
        c.marina || 'N/A',
        this.formatCurrency(c.rateAmount),
        c.rateType || 'N/A',
        c.wetSlips ? String(c.wetSlips) : 'N/A',
        c.seasonality || 'N/A',
        [c.city, c.state].filter(Boolean).join(', ') || 'N/A',
      ]);

      this.drawTable(ctx, headers, rows, {
        columnWidths: [120, 75, 70, 50, 80, 85],
      });
    }
  }

  private drawDemographics(ctx: PDFContext, demographics: MarketDemographics): void {
    if (!demographics) return;

    this.drawTitle(ctx, `Market Demographics — ${demographics.state}`);
    ctx.yPosition -= 10;

    // Economic indicators
    this.drawSubtitle(ctx, 'Economic Indicators');
    ctx.yPosition -= 5;

    if (demographics.population) {
      this.drawKeyValue(ctx, 'Population:', this.formatNumber(demographics.population));
    }
    if (demographics.medianIncome) {
      this.drawKeyValue(ctx, 'Median Household Income:', this.formatCurrency(demographics.medianIncome));
    }
    if (demographics.unemploymentRate != null) {
      this.drawKeyValue(ctx, 'Unemployment Rate:', `${demographics.unemploymentRate.toFixed(1)}%`);
    }
    if (demographics.populationGrowth != null) {
      this.drawKeyValue(ctx, 'Population Growth:', `${demographics.populationGrowth > 0 ? '+' : ''}${demographics.populationGrowth.toFixed(1)}%`);
    }

    ctx.yPosition -= 10;
    this.drawHorizontalRule(ctx);

    // Market stats
    this.drawSubtitle(ctx, 'Marina Market Statistics');
    ctx.yPosition -= 5;

    if (demographics.transactionCount != null) {
      this.drawKeyValue(ctx, 'Recent Transactions:', String(demographics.transactionCount));
    }
    if (demographics.avgSalePrice) {
      this.drawKeyValue(ctx, 'Avg Market Sale Price:', this.formatCurrency(demographics.avgSalePrice));
    }
    if (demographics.avgCapRate) {
      this.drawKeyValue(ctx, 'Market Cap Rate:', this.formatPercent(demographics.avgCapRate));
    }
    if (demographics.avgPricePerSlip) {
      this.drawKeyValue(ctx, 'Market Avg $/Slip:', this.formatCurrency(demographics.avgPricePerSlip));
    }
  }

  private drawInvestmentHighlights(ctx: PDFContext, data: OMData): void {
    this.drawTitle(ctx, 'Investment Highlights');
    ctx.yPosition -= 10;

    const highlights: string[] = [];

    if (data.propertyOverview.totalSlips) {
      highlights.push(`${data.propertyOverview.totalSlips} slip marina with strong occupancy`);
    }
    if (data.financialSummary.capRate) {
      highlights.push(`Attractive ${this.formatPercent(data.financialSummary.capRate)} cap rate`);
    }
    if (data.rentRoll.occupancyRate >= 90) {
      highlights.push(`High ${data.rentRoll.occupancyRate}% occupancy demonstrates strong demand`);
    }
    if (data.propertyOverview.waterFrontage) {
      highlights.push(`${this.formatNumber(data.propertyOverview.waterFrontage)} feet of prime waterfront`);
    }
    if (data.operations.fuelSalesAnnual && data.operations.fuelSalesAnnual > 100000) {
      highlights.push(`Strong fuel sales revenue of ${this.formatCurrency(data.operations.fuelSalesAnnual)} annually`);
    }
    if (data.propertyOverview.amenities && data.propertyOverview.amenities.length > 5) {
      highlights.push('Full-service marina with comprehensive amenities');
    }
    highlights.push('Strategic location with growth potential');
    highlights.push('Stable cash flow with upside opportunities');
    highlights.push('Professional management opportunity available');

    for (const highlight of highlights.slice(0, 8)) {
      this.drawBulletPoint(ctx, highlight);
    }
  }

  private drawDisclaimer(ctx: PDFContext): void {
    ctx.yPosition -= 20;
    this.drawHorizontalRule(ctx);
    
    const page = ctx.currentPage;
    const disclaimer = 'DISCLAIMER: This Offering Memorandum has been prepared by the owner or their agents and is provided for informational purposes only. The information contained herein has been obtained from sources believed to be reliable, but no warranty or representation is made as to its accuracy or completeness. Prospective purchasers should conduct their own due diligence and consult with appropriate legal, tax, and financial advisors before making any investment decision.';
    
    const words = disclaimer.split(' ');
    let currentLine = '';
    const lines: string[] = [];
    const maxWidth = ctx.pageSize[0] - ctx.margins.left - ctx.margins.right;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = ctx.fonts.italic.widthOfTextAtSize(testLine, 8);
      
      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    for (const line of lines) {
      page.drawText(line, {
        x: ctx.margins.left,
        y: ctx.yPosition,
        size: 8,
        font: ctx.fonts.italic,
        color: ctx.colors.textLight,
      });
      ctx.yPosition -= 10;
    }
  }

  async generateStandardPDF(data: OMData, options: Partial<PDFGeneratorOptions> = {}): Promise<Uint8Array> {
    const ctx = await this.createContext({ ...options, templateType: 'standard' });

    this.addPage(ctx);
    this.drawCoverPage(ctx, data);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawPropertyOverview(ctx, data.propertyOverview);
    ctx.yPosition -= 20;
    this.drawFinancialSummary(ctx, data.financialSummary);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawRentRollSummary(ctx, data.rentRoll);

    // Comp Analysis pages
    if (data.compAnalytics && (data.compAnalytics.salesComps.length > 0 || data.compAnalytics.rateComps.length > 0)) {
      this.addPage(ctx);
      this.addHeader(ctx, data);
      this.drawCompAnalysis(ctx, data.compAnalytics);
    }

    // Demographics page
    if (data.demographics) {
      this.addPage(ctx);
      this.addHeader(ctx, data);
      this.drawDemographics(ctx, data.demographics);
    }

    ctx.yPosition -= 20;
    this.drawInvestmentHighlights(ctx, data);
    this.drawDisclaimer(ctx);

    const totalPages = ctx.doc.getPageCount();
    for (let i = 1; i < totalPages; i++) {
      ctx.currentPage = ctx.doc.getPage(i);
      ctx.pageNumber = i + 1;
      this.addFooter(ctx, totalPages);
    }

    return ctx.doc.save();
  }

  async generatePremiumPDF(data: OMData, options: Partial<PDFGeneratorOptions> = {}): Promise<Uint8Array> {
    const ctx = await this.createContext({ ...options, templateType: 'premium' });

    this.addPage(ctx);
    this.drawCoverPage(ctx, data);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawTitle(ctx, 'Executive Summary');
    ctx.yPosition -= 10;
    this.drawInvestmentHighlights(ctx, data);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawPropertyOverview(ctx, data.propertyOverview);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawFinancialSummary(ctx, data.financialSummary);
    ctx.yPosition -= 15;
    this.drawFinancialProjections(ctx, data.financialSummary);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawRentRollSummary(ctx, data.rentRoll);

    // Comp Analysis pages
    if (data.compAnalytics && (data.compAnalytics.salesComps.length > 0 || data.compAnalytics.rateComps.length > 0)) {
      this.addPage(ctx);
      this.addHeader(ctx, data);
      this.drawCompAnalysis(ctx, data.compAnalytics);
    }

    // Demographics page
    if (data.demographics) {
      this.addPage(ctx);
      this.addHeader(ctx, data);
      this.drawDemographics(ctx, data.demographics);
    }

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawOperationsSummary(ctx, data.operations);
    this.drawDisclaimer(ctx);

    const totalPages = ctx.doc.getPageCount();
    for (let i = 1; i < totalPages; i++) {
      ctx.currentPage = ctx.doc.getPage(i);
      ctx.pageNumber = i + 1;
      this.addFooter(ctx, totalPages);
    }

    return ctx.doc.save();
  }

  async generateExecutivePDF(data: OMData, options: Partial<PDFGeneratorOptions> = {}): Promise<Uint8Array> {
    const ctx = await this.createContext({ ...options, templateType: 'executive' });

    this.addPage(ctx);
    this.drawCoverPage(ctx, data);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawTitle(ctx, 'Table of Contents');
    ctx.yPosition -= 20;
    const tocItems = [
      { title: 'Executive Summary', page: 3 },
      { title: 'Property Overview', page: 4 },
      { title: 'Financial Summary', page: 5 },
      { title: 'Revenue Projections', page: 6 },
      { title: 'Rent Roll Analysis', page: 7 },
      { title: 'Operations Overview', page: 8 },
      { title: 'Investment Highlights', page: 9 },
      { title: 'Disclaimer & Terms', page: 10 },
    ];
    for (const item of tocItems) {
      const page = ctx.currentPage;
      page.drawText(item.title, {
        x: ctx.margins.left,
        y: ctx.yPosition,
        size: 12,
        font: ctx.fonts.regular,
        color: ctx.colors.text,
      });
      page.drawText(String(item.page), {
        x: ctx.pageSize[0] - ctx.margins.right - 20,
        y: ctx.yPosition,
        size: 12,
        font: ctx.fonts.regular,
        color: ctx.colors.textLight,
      });
      ctx.yPosition -= 24;
    }

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawTitle(ctx, 'Executive Summary');
    ctx.yPosition -= 10;
    this.drawInvestmentHighlights(ctx, data);
    ctx.yPosition -= 20;
    
    const execSummaryText = `This Offering Memorandum presents ${data.propertyOverview.name}, a ${data.propertyOverview.totalSlips || 'premier'} slip marina located in ${data.propertyOverview.city || 'a strategic waterfront location'}, ${data.propertyOverview.state || ''}. The property represents an exceptional investment opportunity with strong fundamentals and significant upside potential.`;
    this.drawParagraph(ctx, execSummaryText);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawPropertyOverview(ctx, data.propertyOverview);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawFinancialSummary(ctx, data.financialSummary);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawTitle(ctx, 'Revenue Projections & Analysis');
    ctx.yPosition -= 10;
    this.drawFinancialProjections(ctx, data.financialSummary);
    ctx.yPosition -= 20;
    
    this.drawSubtitle(ctx, 'Revenue Growth Assumptions');
    ctx.yPosition -= 5;
    this.drawBulletPoint(ctx, 'Conservative 3% annual rent escalation');
    this.drawBulletPoint(ctx, 'Occupancy stabilization at market rates');
    this.drawBulletPoint(ctx, 'Ancillary revenue growth aligned with industry trends');
    this.drawBulletPoint(ctx, 'Operating expense inflation at 2.5% annually');

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawRentRollSummary(ctx, data.rentRoll);

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawOperationsSummary(ctx, data.operations);
    
    ctx.yPosition -= 20;
    this.drawSubtitle(ctx, 'Operational Highlights');
    ctx.yPosition -= 5;
    this.drawBulletPoint(ctx, 'Full-service marina with experienced staff');
    this.drawBulletPoint(ctx, 'Modern fuel dock with competitive pricing');
    this.drawBulletPoint(ctx, 'Well-stocked ship store and marine supplies');
    this.drawBulletPoint(ctx, 'Comprehensive maintenance and repair services');

    // Comp Analysis pages
    if (data.compAnalytics && (data.compAnalytics.salesComps.length > 0 || data.compAnalytics.rateComps.length > 0)) {
      this.addPage(ctx);
      this.addHeader(ctx, data);
      this.drawCompAnalysis(ctx, data.compAnalytics);
    }

    // Demographics page
    if (data.demographics) {
      this.addPage(ctx);
      this.addHeader(ctx, data);
      this.drawDemographics(ctx, data.demographics);
    }

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawTitle(ctx, 'Investment Highlights & Value Proposition');
    ctx.yPosition -= 10;
    this.drawInvestmentHighlights(ctx, data);

    ctx.yPosition -= 20;
    this.drawSubtitle(ctx, 'Value-Add Opportunities');
    ctx.yPosition -= 5;
    this.drawBulletPoint(ctx, 'Potential for slip rate increases to market levels');
    this.drawBulletPoint(ctx, 'Expansion of ancillary services and revenue streams');
    this.drawBulletPoint(ctx, 'Facility improvements to attract premium tenants');
    this.drawBulletPoint(ctx, 'Operational efficiencies through technology adoption');

    this.addPage(ctx);
    this.addHeader(ctx, data);
    this.drawTitle(ctx, 'Terms & Disclaimer');
    ctx.yPosition -= 20;
    this.drawDisclaimer(ctx);

    const totalPages = ctx.doc.getPageCount();
    for (let i = 1; i < totalPages; i++) {
      ctx.currentPage = ctx.doc.getPage(i);
      ctx.pageNumber = i + 1;
      this.addFooter(ctx, totalPages);
    }

    return ctx.doc.save();
  }

  async generatePDF(data: OMData, options: Partial<PDFGeneratorOptions> = {}): Promise<Uint8Array> {
    const templateType = options.templateType || 'standard';
    
    switch (templateType) {
      case 'premium':
        return this.generatePremiumPDF(data, options);
      case 'executive':
        return this.generateExecutivePDF(data, options);
      case 'standard':
      default:
        return this.generateStandardPDF(data, options);
    }
  }
}

export const pdfGeneratorService = new PDFGeneratorService();
