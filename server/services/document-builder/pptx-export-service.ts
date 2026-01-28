/**
 * PPTX Export Service
 * Generates PowerPoint presentations from Document Builder documents
 * 
 * Uses PptxGenJS for cross-platform PowerPoint generation
 */

import PptxGenJS from 'pptxgenjs';
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

export interface PptxExportOptions {
  layout?: '16x9' | '4x3';
  theme?: PptxTheme;
  includeNotes?: boolean;
  includeAppendix?: boolean;
  companyName?: string;
  companyLogo?: string | Buffer;
  confidentialityNotice?: string;
}

export interface PptxTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  textLightColor: string;
  titleFont: string;
  bodyFont: string;
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
}

export interface DocumentData {
  id: string;
  title: string;
  documentType: DocumentType;
  audience?: AudiencePersona;
  sections: DocumentSection[];
  theme?: PptxTheme;
  metadata?: Record<string, any>;
}

// =============================================================================
// Default Theme
// =============================================================================

const DEFAULT_THEME: PptxTheme = {
  primaryColor: '0C5486', // Navy blue
  secondaryColor: '2E8BAB', // Teal
  accentColor: 'F5A623', // Gold
  backgroundColor: 'FFFFFF',
  textColor: '1A1A1A',
  textLightColor: '666666',
  titleFont: 'Arial',
  bodyFont: 'Calibri',
};

// =============================================================================
// PPTX Export Service
// =============================================================================

class PptxExportService {
  /**
   * Generate a PPTX presentation from document data
   */
  async generatePresentation(
    document: DocumentData,
    options: PptxExportOptions = {}
  ): Promise<Buffer> {
    const theme = { ...DEFAULT_THEME, ...document.theme, ...options.theme };
    const layout = options.layout || '16x9';

    // Create presentation
    const pptx = new PptxGenJS();

    // Set presentation properties
    pptx.author = options.companyName || 'MarinaMatch';
    pptx.title = document.title;
    pptx.subject = this.getSubjectFromDocType(document.documentType);
    pptx.company = options.companyName || 'MarinaMatch';

    // Set layout
    pptx.layout = layout === '4x3' ? 'LAYOUT_4x3' : 'LAYOUT_16x9';

    // Define master slide
    this.defineMasterSlides(pptx, theme, options);

    // Add title slide
    this.addTitleSlide(pptx, document, theme, options);

    // Add agenda/TOC slide
    this.addAgendaSlide(pptx, document, theme);

    // Add content slides for each section
    for (const section of document.sections.filter(s => s.enabled)) {
      await this.addSectionSlides(pptx, section, document, theme, options);
    }

    // Add disclaimer slide if applicable
    if (document.documentType === DocumentType.OFFERING_MEMORANDUM ||
        document.documentType === DocumentType.INVESTMENT_COMMITTEE_MEMO) {
      this.addDisclaimerSlide(pptx, theme, options);
    }

    // Add contact/closing slide
    this.addClosingSlide(pptx, document, theme, options);

    // Generate buffer
    const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    return buffer;
  }

  /**
   * Define master slide layouts
   */
  private defineMasterSlides(
    pptx: PptxGenJS,
    theme: PptxTheme,
    options: PptxExportOptions
  ): void {
    // Title master
    pptx.defineSlideMaster({
      title: 'TITLE_SLIDE',
      background: { color: theme.primaryColor },
      objects: [
        {
          placeholder: {
            options: {
              name: 'title',
              type: 'title',
              x: 0.5,
              y: 2.5,
              w: 9,
              h: 1.5,
              fontFace: theme.titleFont,
              fontSize: 44,
              color: 'FFFFFF',
              align: 'center',
            },
            text: '',
          },
        },
        {
          placeholder: {
            options: {
              name: 'subtitle',
              type: 'body',
              x: 0.5,
              y: 4.2,
              w: 9,
              h: 0.8,
              fontFace: theme.bodyFont,
              fontSize: 20,
              color: 'FFFFFF',
              align: 'center',
            },
            text: '',
          },
        },
      ],
    });

    // Section header master
    pptx.defineSlideMaster({
      title: 'SECTION_HEADER',
      background: { color: theme.secondaryColor },
      objects: [
        {
          rect: {
            x: 0,
            y: 0,
            w: '100%',
            h: 0.15,
            fill: { color: theme.accentColor },
          },
        },
        {
          placeholder: {
            options: {
              name: 'title',
              type: 'title',
              x: 0.5,
              y: 2.5,
              w: 9,
              h: 1.2,
              fontFace: theme.titleFont,
              fontSize: 36,
              color: 'FFFFFF',
              align: 'left',
              bold: true,
            },
            text: '',
          },
        },
      ],
    });

    // Content master
    pptx.defineSlideMaster({
      title: 'CONTENT_SLIDE',
      background: { color: theme.backgroundColor },
      objects: [
        // Header bar
        {
          rect: {
            x: 0,
            y: 0,
            w: '100%',
            h: 0.6,
            fill: { color: theme.primaryColor },
          },
        },
        // Footer
        {
          rect: {
            x: 0,
            y: 5.15,
            w: '100%',
            h: 0.35,
            fill: { color: 'F5F5F5' },
          },
        },
        // Title placeholder
        {
          placeholder: {
            options: {
              name: 'title',
              type: 'title',
              x: 0.5,
              y: 0.1,
              w: 8,
              h: 0.4,
              fontFace: theme.titleFont,
              fontSize: 18,
              color: 'FFFFFF',
              bold: true,
            },
            text: '',
          },
        },
      ],
    });

    // Metrics master (for KPI slides)
    pptx.defineSlideMaster({
      title: 'METRICS_SLIDE',
      background: { color: theme.backgroundColor },
      objects: [
        {
          rect: {
            x: 0,
            y: 0,
            w: '100%',
            h: 0.6,
            fill: { color: theme.primaryColor },
          },
        },
        {
          placeholder: {
            options: {
              name: 'title',
              type: 'title',
              x: 0.5,
              y: 0.1,
              w: 8,
              h: 0.4,
              fontFace: theme.titleFont,
              fontSize: 18,
              color: 'FFFFFF',
              bold: true,
            },
            text: '',
          },
        },
      ],
    });
  }

  /**
   * Add title slide
   */
  private addTitleSlide(
    pptx: PptxGenJS,
    document: DocumentData,
    theme: PptxTheme,
    options: PptxExportOptions
  ): void {
    const slide = pptx.addSlide({ masterName: 'TITLE_SLIDE' });

    // Title
    slide.addText(document.title, {
      x: 0.5,
      y: 2.2,
      w: 9,
      h: 1.2,
      fontSize: 40,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      align: 'center',
      bold: true,
    });

    // Document type subtitle
    const docTypeLabel = this.getDocumentTypeLabel(document.documentType);
    slide.addText(docTypeLabel, {
      x: 0.5,
      y: 3.5,
      w: 9,
      h: 0.6,
      fontSize: 24,
      fontFace: theme.bodyFont,
      color: 'FFFFFF',
      align: 'center',
    });

    // Date
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
    slide.addText(dateStr, {
      x: 0.5,
      y: 4.3,
      w: 9,
      h: 0.4,
      fontSize: 16,
      fontFace: theme.bodyFont,
      color: 'FFFFFF',
      align: 'center',
    });

    // Company logo if provided
    if (options.companyLogo) {
      slide.addImage({
        data: options.companyLogo as string,
        x: 0.5,
        y: 4.8,
        w: 1.5,
        h: 0.5,
      });
    }

    // Confidentiality notice
    if (options.confidentialityNotice) {
      slide.addText(options.confidentialityNotice, {
        x: 0.5,
        y: 5.1,
        w: 9,
        h: 0.3,
        fontSize: 8,
        fontFace: theme.bodyFont,
        color: 'FFFFFF',
        align: 'center',
        italic: true,
      });
    }
  }

  /**
   * Add agenda/table of contents slide
   */
  private addAgendaSlide(
    pptx: PptxGenJS,
    document: DocumentData,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText('Agenda', {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Build agenda items from sections
    const enabledSections = document.sections.filter(s => s.enabled);
    const agendaItems: Array<{ text: string; options: PptxGenJS.TextPropsOptions }> = [];

    enabledSections.forEach((section, index) => {
      const sectionDef = SECTION_LIBRARY[section.sectionKey];
      const name = sectionDef?.name || section.sectionKey;

      agendaItems.push({
        text: `${index + 1}. ${name}`,
        options: {
          fontSize: 18,
          fontFace: theme.bodyFont,
          color: theme.textColor,
          bullet: false,
          paraSpaceAfter: 12,
        },
      });
    });

    slide.addText(agendaItems, {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 4,
      valign: 'top',
    });
  }

  /**
   * Add section slides based on section type
   */
  private async addSectionSlides(
    pptx: PptxGenJS,
    section: DocumentSection,
    document: DocumentData,
    theme: PptxTheme,
    options: PptxExportOptions
  ): Promise<void> {
    const sectionDef = SECTION_LIBRARY[section.sectionKey];
    if (!sectionDef) return;

    // Add section header slide
    this.addSectionHeaderSlide(pptx, sectionDef.name, theme);

    // Add content slides based on section category
    switch (sectionDef.category) {
      case SectionCategory.COVER:
        // Already handled by title slide
        break;

      case SectionCategory.SUMMARY:
        this.addSummarySlides(pptx, section, sectionDef, theme);
        break;

      case SectionCategory.PROPERTY:
        this.addPropertySlides(pptx, section, sectionDef, theme);
        break;

      case SectionCategory.MARKET:
        this.addMarketSlides(pptx, section, sectionDef, theme);
        break;

      case SectionCategory.FINANCIAL:
        this.addFinancialSlides(pptx, section, sectionDef, theme);
        break;

      case SectionCategory.UNDERWRITING:
        this.addUnderwritingSlides(pptx, section, sectionDef, theme);
        break;

      case SectionCategory.DUE_DILIGENCE:
        this.addDueDiligenceSlides(pptx, section, sectionDef, theme);
        break;

      default:
        this.addGenericContentSlide(pptx, section, sectionDef, theme);
    }
  }

  /**
   * Add section header slide
   */
  private addSectionHeaderSlide(
    pptx: PptxGenJS,
    sectionName: string,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'SECTION_HEADER' });

    slide.addText(sectionName, {
      x: 0.8,
      y: 2.3,
      w: 8.4,
      h: 1.2,
      fontSize: 36,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });
  }

  /**
   * Add summary section slides
   */
  private addSummarySlides(
    pptx: PptxGenJS,
    section: DocumentSection,
    sectionDef: SectionDefinition,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText(sectionDef.name, {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Executive summary content
    const content = section.content as any;
    if (content?.executiveSummary || content?.summary || content?.overview) {
      const summaryText = content.executiveSummary || content.summary || content.overview;
      slide.addText(summaryText, {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 3.5,
        fontSize: 14,
        fontFace: theme.bodyFont,
        color: theme.textColor,
        valign: 'top',
      });
    }

    // Investment highlights if present
    if (content?.investmentHighlights && Array.isArray(content.investmentHighlights)) {
      const highlightsSlide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

      highlightsSlide.addText('Investment Highlights', {
        x: 0.5,
        y: 0.1,
        w: 8,
        h: 0.4,
        fontSize: 18,
        fontFace: theme.titleFont,
        color: 'FFFFFF',
        bold: true,
      });

      const highlights = content.investmentHighlights.map((h: string) => ({
        text: h,
        options: {
          fontSize: 14,
          fontFace: theme.bodyFont,
          color: theme.textColor,
          bullet: { type: 'bullet', color: theme.accentColor },
          paraSpaceAfter: 8,
        },
      }));

      highlightsSlide.addText(highlights, {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 4,
        valign: 'top',
      });
    }
  }

  /**
   * Add property section slides
   */
  private addPropertySlides(
    pptx: PptxGenJS,
    section: DocumentSection,
    sectionDef: SectionDefinition,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'METRICS_SLIDE' });
    const content = section.content as any;

    slide.addText(sectionDef.name, {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Property metrics grid
    const metrics = [
      { label: 'Property Name', value: content?.propertyName || 'N/A' },
      { label: 'Location', value: this.formatLocation(content) },
      { label: 'Total Slips', value: this.formatNumber(content?.totalSlips) },
      { label: 'Wet Slips', value: this.formatNumber(content?.wetSlips) },
      { label: 'Dry Storage', value: this.formatNumber(content?.dryStorage) },
      { label: 'Acreage', value: content?.acreage ? `${content.acreage} acres` : 'N/A' },
      { label: 'Year Built', value: content?.yearBuilt || 'N/A' },
      { label: 'Water Frontage', value: content?.waterFrontage ? `${content.waterFrontage} ft` : 'N/A' },
    ];

    this.addMetricsGrid(slide, metrics, theme, 2, 4);

    // Property description
    if (content?.description) {
      const descSlide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

      descSlide.addText('Property Description', {
        x: 0.5,
        y: 0.1,
        w: 8,
        h: 0.4,
        fontSize: 18,
        fontFace: theme.titleFont,
        color: 'FFFFFF',
        bold: true,
      });

      descSlide.addText(content.description, {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 3.8,
        fontSize: 13,
        fontFace: theme.bodyFont,
        color: theme.textColor,
        valign: 'top',
      });
    }

    // Photo gallery slide if media present
    if (section.media && Object.keys(section.media).length > 0) {
      this.addPhotoGallerySlide(pptx, section.media, theme);
    }
  }

  /**
   * Add market section slides
   */
  private addMarketSlides(
    pptx: PptxGenJS,
    section: DocumentSection,
    sectionDef: SectionDefinition,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });
    const content = section.content as any;

    slide.addText(sectionDef.name, {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Market overview text
    if (content?.marketOverview) {
      slide.addText(content.marketOverview, {
        x: 0.5,
        y: 0.9,
        w: 5.5,
        h: 3.5,
        fontSize: 12,
        fontFace: theme.bodyFont,
        color: theme.textColor,
        valign: 'top',
      });
    }

    // Demographics sidebar
    const demographics = [
      { label: 'Population', value: this.formatNumber(content?.population) },
      { label: 'Median Income', value: this.formatCurrency(content?.medianIncome) },
      { label: 'Boat Registrations', value: this.formatNumber(content?.boatRegistrations) },
      { label: 'Growth Rate', value: this.formatPercent(content?.populationGrowth) },
    ];

    this.addVerticalMetricsList(slide, demographics, theme, 6.3, 0.9, 3.2, 3.5);

    // Competition analysis slide if present
    if (content?.competitors && Array.isArray(content.competitors) && content.competitors.length > 0) {
      this.addCompetitorAnalysisSlide(pptx, content.competitors, theme);
    }
  }

  /**
   * Add financial section slides
   */
  private addFinancialSlides(
    pptx: PptxGenJS,
    section: DocumentSection,
    sectionDef: SectionDefinition,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'METRICS_SLIDE' });
    const content = section.content as any;

    slide.addText(sectionDef.name, {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

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

    this.addMetricsGrid(slide, metrics, theme, 2, 4);

    // Revenue breakdown slide if data present
    if (content?.revenueBreakdown || content?.incomeStatement) {
      this.addRevenueBreakdownSlide(pptx, content, theme);
    }

    // Projections slide if present
    if (content?.projections) {
      this.addProjectionsSlide(pptx, content.projections, theme);
    }
  }

  /**
   * Add underwriting section slides
   */
  private addUnderwritingSlides(
    pptx: PptxGenJS,
    section: DocumentSection,
    sectionDef: SectionDefinition,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'METRICS_SLIDE' });
    const content = section.content as any;

    slide.addText(sectionDef.name, {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Investment returns metrics
    const metrics = [
      { label: 'Purchase Price', value: this.formatCurrency(content?.purchasePrice) },
      { label: 'Equity Required', value: this.formatCurrency(content?.equityRequired) },
      { label: 'Levered IRR', value: this.formatPercent(content?.leveredIrr) },
      { label: 'Unlevered IRR', value: this.formatPercent(content?.unleveredIrr) },
      { label: 'Equity Multiple', value: content?.equityMultiple ? `${content.equityMultiple.toFixed(2)}x` : 'N/A' },
      { label: 'Hold Period', value: content?.holdPeriod ? `${content.holdPeriod} years` : 'N/A' },
      { label: 'Exit Cap Rate', value: this.formatPercent(content?.exitCapRate) },
      { label: 'DSCR', value: content?.dscr ? content.dscr.toFixed(2) : 'N/A' },
    ];

    this.addMetricsGrid(slide, metrics, theme, 2, 4);

    // Sensitivity analysis if present
    if (content?.sensitivityAnalysis) {
      this.addSensitivitySlide(pptx, content.sensitivityAnalysis, theme);
    }
  }

  /**
   * Add due diligence section slides
   */
  private addDueDiligenceSlides(
    pptx: PptxGenJS,
    section: DocumentSection,
    sectionDef: SectionDefinition,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });
    const content = section.content as any;

    slide.addText(sectionDef.name, {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Risk factors if present
    if (content?.riskFactors && Array.isArray(content.riskFactors)) {
      const risks = content.riskFactors.map((risk: any) => ({
        text: typeof risk === 'string' ? risk : risk.description,
        options: {
          fontSize: 12,
          fontFace: theme.bodyFont,
          color: theme.textColor,
          bullet: { type: 'bullet', color: 'CC0000' },
          paraSpaceAfter: 6,
        },
      }));

      slide.addText('Key Risks', {
        x: 0.5,
        y: 0.9,
        w: 4,
        h: 0.4,
        fontSize: 14,
        fontFace: theme.titleFont,
        color: theme.textColor,
        bold: true,
      });

      slide.addText(risks, {
        x: 0.5,
        y: 1.4,
        w: 4.2,
        h: 3.2,
        valign: 'top',
      });
    }

    // Mitigants if present
    if (content?.mitigants && Array.isArray(content.mitigants)) {
      const mitigants = content.mitigants.map((m: any) => ({
        text: typeof m === 'string' ? m : m.description,
        options: {
          fontSize: 12,
          fontFace: theme.bodyFont,
          color: theme.textColor,
          bullet: { type: 'bullet', color: '00AA00' },
          paraSpaceAfter: 6,
        },
      }));

      slide.addText('Mitigants', {
        x: 5.2,
        y: 0.9,
        w: 4,
        h: 0.4,
        fontSize: 14,
        fontFace: theme.titleFont,
        color: theme.textColor,
        bold: true,
      });

      slide.addText(mitigants, {
        x: 5.2,
        y: 1.4,
        w: 4.3,
        h: 3.2,
        valign: 'top',
      });
    }
  }

  /**
   * Add generic content slide
   */
  private addGenericContentSlide(
    pptx: PptxGenJS,
    section: DocumentSection,
    sectionDef: SectionDefinition,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });
    const content = section.content as any;

    slide.addText(sectionDef.name, {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Render any text content found
    const textContent = this.extractTextContent(content);
    if (textContent) {
      slide.addText(textContent, {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 3.8,
        fontSize: 13,
        fontFace: theme.bodyFont,
        color: theme.textColor,
        valign: 'top',
      });
    }
  }

  /**
   * Add photo gallery slide
   */
  private addPhotoGallerySlide(
    pptx: PptxGenJS,
    media: Record<string, MediaAttachment>,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText('Property Photos', {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    const photos = Object.values(media).filter(m => m.url && m.mimeType?.startsWith('image/'));

    // Grid layout for photos (max 4 per slide)
    const positions = [
      { x: 0.5, y: 0.9, w: 4.3, h: 2.0 },
      { x: 5.2, y: 0.9, w: 4.3, h: 2.0 },
      { x: 0.5, y: 3.1, w: 4.3, h: 2.0 },
      { x: 5.2, y: 3.1, w: 4.3, h: 2.0 },
    ];

    photos.slice(0, 4).forEach((photo, index) => {
      if (photo.url) {
        try {
          slide.addImage({
            path: photo.url,
            x: positions[index].x,
            y: positions[index].y,
            w: positions[index].w,
            h: positions[index].h,
          });

          if (photo.caption) {
            slide.addText(photo.caption, {
              x: positions[index].x,
              y: positions[index].y + positions[index].h,
              w: positions[index].w,
              h: 0.25,
              fontSize: 9,
              fontFace: theme.bodyFont,
              color: theme.textLightColor,
              align: 'center',
            });
          }
        } catch (e) {
          // Skip if image can't be loaded
          console.warn(`Failed to load image: ${photo.url}`, e);
        }
      }
    });
  }

  /**
   * Add competitor analysis slide
   */
  private addCompetitorAnalysisSlide(
    pptx: PptxGenJS,
    competitors: any[],
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText('Competitive Analysis', {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Create comparison table
    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Property', options: { bold: true, fill: { color: theme.primaryColor }, color: 'FFFFFF' } },
        { text: 'Distance', options: { bold: true, fill: { color: theme.primaryColor }, color: 'FFFFFF' } },
        { text: 'Slips', options: { bold: true, fill: { color: theme.primaryColor }, color: 'FFFFFF' } },
        { text: 'Avg Rate', options: { bold: true, fill: { color: theme.primaryColor }, color: 'FFFFFF' } },
      ],
    ];

    competitors.slice(0, 5).forEach(comp => {
      tableData.push([
        { text: comp.name || 'N/A' },
        { text: comp.distance ? `${comp.distance} mi` : 'N/A' },
        { text: comp.slips?.toString() || 'N/A' },
        { text: comp.avgRate ? `$${comp.avgRate}/ft` : 'N/A' },
      ]);
    });

    slide.addTable(tableData, {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 3,
      fontFace: theme.bodyFont,
      fontSize: 11,
      color: theme.textColor,
      border: { type: 'solid', pt: 0.5, color: theme.textLightColor },
      valign: 'middle',
    });
  }

  /**
   * Add revenue breakdown slide
   */
  private addRevenueBreakdownSlide(
    pptx: PptxGenJS,
    content: any,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText('Revenue Breakdown', {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Revenue line items
    const breakdown = content.revenueBreakdown || content.incomeStatement?.revenue || {};
    const items = Object.entries(breakdown).map(([key, value]) => ({
      label: this.formatLabel(key),
      value: this.formatCurrency(value as number),
    }));

    this.addVerticalMetricsList(slide, items, theme, 0.5, 0.9, 4.5, 3.5);

    // If we have expense data, show it too
    if (content.expenseBreakdown || content.incomeStatement?.expenses) {
      const expenses = content.expenseBreakdown || content.incomeStatement?.expenses || {};
      const expenseItems = Object.entries(expenses).map(([key, value]) => ({
        label: this.formatLabel(key),
        value: this.formatCurrency(value as number),
      }));

      slide.addText('Operating Expenses', {
        x: 5.2,
        y: 0.9,
        w: 4,
        h: 0.4,
        fontSize: 14,
        fontFace: theme.titleFont,
        color: theme.textColor,
        bold: true,
      });

      this.addVerticalMetricsList(slide, expenseItems, theme, 5.2, 1.4, 4.3, 3);
    }
  }

  /**
   * Add projections slide
   */
  private addProjectionsSlide(
    pptx: PptxGenJS,
    projections: any,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText('Financial Projections', {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Create projections table
    const years = projections.years || ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Metric', options: { bold: true, fill: { color: theme.primaryColor }, color: 'FFFFFF' } },
        ...years.map((y: string) => ({
          text: y,
          options: { bold: true, fill: { color: theme.primaryColor }, color: 'FFFFFF' },
        })),
      ],
    ];

    // Add rows for each metric
    const metrics = ['revenue', 'noi', 'cashFlow'];
    metrics.forEach(metric => {
      if (projections[metric] && Array.isArray(projections[metric])) {
        tableData.push([
          { text: this.formatLabel(metric) },
          ...projections[metric].map((v: number) => ({ text: this.formatCurrency(v) })),
        ]);
      }
    });

    slide.addTable(tableData, {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 2.5,
      fontFace: theme.bodyFont,
      fontSize: 11,
      color: theme.textColor,
      border: { type: 'solid', pt: 0.5, color: theme.textLightColor },
      valign: 'middle',
    });
  }

  /**
   * Add sensitivity analysis slide
   */
  private addSensitivitySlide(
    pptx: PptxGenJS,
    sensitivity: any,
    theme: PptxTheme
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText('Sensitivity Analysis', {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    // Create sensitivity matrix if available
    if (sensitivity.matrix && Array.isArray(sensitivity.matrix)) {
      const tableData: PptxGenJS.TableRow[] = sensitivity.matrix.map((row: any[], index: number) =>
        row.map((cell: any, cellIndex: number) => ({
          text: typeof cell === 'number' ? this.formatPercent(cell) : String(cell),
          options: index === 0 || cellIndex === 0 ? {
            bold: true,
            fill: { color: theme.primaryColor },
            color: 'FFFFFF',
          } : {},
        }))
      );

      slide.addTable(tableData, {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 3,
        fontFace: theme.bodyFont,
        fontSize: 10,
        color: theme.textColor,
        border: { type: 'solid', pt: 0.5, color: theme.textLightColor },
        valign: 'middle',
        align: 'center',
      });
    }
  }

  /**
   * Add disclaimer slide
   */
  private addDisclaimerSlide(
    pptx: PptxGenJS,
    theme: PptxTheme,
    options: PptxExportOptions
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText('Important Disclosures', {
      x: 0.5,
      y: 0.1,
      w: 8,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      bold: true,
    });

    const disclaimerText = `This presentation has been prepared by ${options.companyName || 'MarinaMatch'} for informational purposes only. The information contained herein is confidential and is being provided to you solely for the purpose of evaluating the potential acquisition of the property described herein.

This presentation is not intended to provide any investment, tax, accounting, or legal advice. Recipients should consult with their own advisors regarding investment, tax, accounting, and legal matters.

The information contained in this presentation has been obtained from sources believed to be reliable, but no representation or warranty, express or implied, is made as to the accuracy or completeness of such information.

Past performance is not indicative of future results. Actual results may differ materially from any projections or forward-looking statements contained herein.

This presentation does not constitute an offer to sell or a solicitation of an offer to buy any securities. Any such offer may only be made pursuant to definitive transaction documents.`;

    slide.addText(disclaimerText, {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 4,
      fontSize: 10,
      fontFace: theme.bodyFont,
      color: theme.textLightColor,
      valign: 'top',
    });
  }

  /**
   * Add closing slide
   */
  private addClosingSlide(
    pptx: PptxGenJS,
    document: DocumentData,
    theme: PptxTheme,
    options: PptxExportOptions
  ): void {
    const slide = pptx.addSlide({ masterName: 'TITLE_SLIDE' });

    slide.addText('Thank You', {
      x: 0.5,
      y: 2,
      w: 9,
      h: 0.8,
      fontSize: 36,
      fontFace: theme.titleFont,
      color: 'FFFFFF',
      align: 'center',
      bold: true,
    });

    slide.addText('For More Information', {
      x: 0.5,
      y: 3,
      w: 9,
      h: 0.6,
      fontSize: 20,
      fontFace: theme.bodyFont,
      color: 'FFFFFF',
      align: 'center',
    });

    if (options.companyName) {
      slide.addText(options.companyName, {
        x: 0.5,
        y: 3.8,
        w: 9,
        h: 0.5,
        fontSize: 16,
        fontFace: theme.bodyFont,
        color: 'FFFFFF',
        align: 'center',
      });
    }
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private addMetricsGrid(
    slide: PptxGenJS.Slide,
    metrics: Array<{ label: string; value: string }>,
    theme: PptxTheme,
    cols: number,
    rows: number
  ): void {
    const startX = 0.5;
    const startY = 0.9;
    const cellWidth = 4.4;
    const cellHeight = 0.9;
    const gapX = 0.2;
    const gapY = 0.15;

    metrics.forEach((metric, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      if (row >= rows) return;

      const x = startX + col * (cellWidth + gapX);
      const y = startY + row * (cellHeight + gapY);

      // Metric card background
      slide.addShape('rect', {
        x,
        y,
        w: cellWidth,
        h: cellHeight,
        fill: { color: 'F8F8F8' },
        line: { color: 'E0E0E0', pt: 0.5 },
      });

      // Label
      slide.addText(metric.label, {
        x: x + 0.1,
        y: y + 0.1,
        w: cellWidth - 0.2,
        h: 0.35,
        fontSize: 10,
        fontFace: theme.bodyFont,
        color: theme.textLightColor,
      });

      // Value
      slide.addText(metric.value, {
        x: x + 0.1,
        y: y + 0.45,
        w: cellWidth - 0.2,
        h: 0.4,
        fontSize: 18,
        fontFace: theme.titleFont,
        color: theme.primaryColor,
        bold: true,
      });
    });
  }

  private addVerticalMetricsList(
    slide: PptxGenJS.Slide,
    metrics: Array<{ label: string; value: string }>,
    theme: PptxTheme,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const items = metrics.map(m => ({
      text: `${m.label}: `,
      options: {
        fontSize: 12,
        fontFace: theme.bodyFont,
        color: theme.textLightColor,
        breakLine: false,
      },
    }));

    // Create alternating label/value pairs
    const textItems: any[] = [];
    metrics.forEach(m => {
      textItems.push({
        text: `${m.label}: `,
        options: { fontSize: 11, color: theme.textLightColor, breakLine: false },
      });
      textItems.push({
        text: `${m.value}\n`,
        options: { fontSize: 11, color: theme.textColor, bold: true },
      });
    });

    slide.addText(textItems, {
      x,
      y,
      w,
      h,
      fontFace: theme.bodyFont,
      valign: 'top',
    });
  }

  private getSubjectFromDocType(docType: DocumentType): string {
    const subjects: Record<DocumentType, string> = {
      [DocumentType.OFFERING_MEMORANDUM]: 'Investment Offering Memorandum',
      [DocumentType.INVESTMENT_COMMITTEE_MEMO]: 'Investment Committee Memorandum',
      [DocumentType.PITCH_DECK]: 'Investment Pitch Deck',
      [DocumentType.EXECUTIVE_SUMMARY]: 'Executive Summary',
      [DocumentType.TEASER]: 'Investment Teaser',
      [DocumentType.LENDER_PACKAGE]: 'Lender Package',
      [DocumentType.DD_SUMMARY]: 'Due Diligence Summary',
      [DocumentType.CUSTOM]: 'Custom Document',
    };
    return subjects[docType] || 'Investment Document';
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

    // Try to extract from nested objects
    if (typeof content === 'object' && content !== null) {
      const values = Object.values(content);
      for (const value of values) {
        if (typeof value === 'string' && value.length > 50) {
          return value;
        }
      }
    }

    return '';
  }
}

export const pptxExportService = new PptxExportService();
