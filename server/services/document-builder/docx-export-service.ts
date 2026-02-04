/**
 * DOCX Export Service
 * Generates Word documents from Document Builder documents
 * 
 * Uses docx library for cross-platform Word generation
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageBreak,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ImageRun,
  TableOfContents,
  StyleLevel,
  convertInchesToTwip,
} from 'docx';
import {
  DocumentType,
  SectionDefinition,
  SectionCategory,
  AudiencePersona,
} from '../../../shared/document-builder/types';
import { SECTION_LIBRARY } from '../../../shared/document-builder/section-library';

// =============================================================================
// Types
// =============================================================================

export interface DocxExportOptions {
  theme?: DocxTheme;
  includeTableOfContents?: boolean;
  includePageNumbers?: boolean;
  includeHeaders?: boolean;
  includeFooters?: boolean;
  companyName?: string;
  companyLogo?: Buffer;
  confidentialityNotice?: string;
  watermark?: string;
}

export interface DocxTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  titleFont: string;
  bodyFont: string;
  headingSize: number;
  bodySize: number;
}

export interface DocumentSection {
  id: string;
  sectionKey: string;
  order: number;
  enabled: boolean;
  content: Record<string, any>;
  dataBindings: Record<string, any>;
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
  theme?: DocxTheme;
  metadata?: Record<string, any>;
}

// =============================================================================
// Default Theme
// =============================================================================

const DEFAULT_THEME: DocxTheme = {
  primaryColor: '0C5486',
  secondaryColor: '2E8BAB',
  accentColor: 'F5A623',
  titleFont: 'Arial',
  bodyFont: 'Calibri',
  headingSize: 28,
  bodySize: 22,
};

// =============================================================================
// DOCX Export Service
// =============================================================================

class DocxExportService {
  /**
   * Generate a DOCX document from document data
   */
  async generateDocument(
    documentData: DocumentData,
    options: DocxExportOptions = {}
  ): Promise<Buffer> {
    const theme = { ...DEFAULT_THEME, ...documentData.theme, ...options.theme };
    const enabledSections = documentData.sections.filter(s => s.enabled);

    // Build document children
    const children: (Paragraph | Table)[] = [];

    // Title page
    children.push(...this.createTitlePage(documentData, theme, options));

    // Table of contents
    if (options.includeTableOfContents !== false) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...this.createTableOfContents(theme));
    }

    // Content sections
    for (const section of enabledSections) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...await this.createSectionContent(section, documentData, theme, options));
    }

    // Disclaimer (for certain document types)
    if (
      documentData.documentType === 'offering_memorandum' ||
      documentData.documentType === 'ic_memo'
    ) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...this.createDisclaimer(theme, options));
    }

    // Create document
    const doc = new Document({
      title: documentData.title,
      subject: this.getSubjectFromDocType(documentData.documentType),
      creator: options.companyName || 'MarinaMatch',
      description: `${this.getDocumentTypeLabel(documentData.documentType)} - ${documentData.title}`,
      styles: {
        default: {
          document: {
            run: {
              font: theme.bodyFont,
              size: theme.bodySize,
            },
            paragraph: {
              spacing: { after: 200 },
            },
          },
          heading1: {
            run: {
              font: theme.titleFont,
              size: theme.headingSize * 2,
              bold: true,
              color: theme.primaryColor,
            },
            paragraph: {
              spacing: { before: 400, after: 200 },
            },
          },
          heading2: {
            run: {
              font: theme.titleFont,
              size: Math.round(theme.headingSize * 1.5),
              bold: true,
              color: theme.secondaryColor,
            },
            paragraph: {
              spacing: { before: 360, after: 160 },
            },
          },
          heading3: {
            run: {
              font: theme.titleFont,
              size: Math.round(theme.headingSize * 1.2),
              bold: true,
              color: theme.primaryColor,
            },
            paragraph: {
              spacing: { before: 280, after: 120 },
            },
          },
        },
        paragraphStyles: [
          {
            id: 'MetricLabel',
            name: 'Metric Label',
            basedOn: 'Normal',
            run: {
              font: theme.bodyFont,
              size: 20,
              color: '666666',
            },
          },
          {
            id: 'MetricValue',
            name: 'Metric Value',
            basedOn: 'Normal',
            run: {
              font: theme.titleFont,
              size: 28,
              bold: true,
              color: theme.primaryColor,
            },
          },
          {
            id: 'Disclaimer',
            name: 'Disclaimer',
            basedOn: 'Normal',
            run: {
              font: theme.bodyFont,
              size: 18,
              color: '666666',
              italics: true,
            },
            paragraph: {
              spacing: { after: 100 },
            },
          },
          {
            id: 'TOCHeading',
            name: 'TOC Heading',
            basedOn: 'Heading1',
            run: {
              size: 32,
            },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          headers: options.includeHeaders !== false ? {
            default: this.createHeader(documentData.title, theme, options),
          } : undefined,
          footers: options.includeFooters !== false ? {
            default: this.createFooter(theme, options),
          } : undefined,
          children,
        },
      ],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }

  /**
   * Create title page
   */
  private createTitlePage(
    document: DocumentData,
    theme: DocxTheme,
    options: DocxExportOptions
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Spacer
    paragraphs.push(
      new Paragraph({
        spacing: { before: 2400 },
        children: [],
      })
    );

    // Document type label
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: this.getDocumentTypeLabel(document.documentType).toUpperCase(),
            font: theme.titleFont,
            size: 24,
            color: theme.secondaryColor,
            allCaps: true,
          }),
        ],
      })
    );

    // Title
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
        children: [
          new TextRun({
            text: document.title,
            font: theme.titleFont,
            size: 72,
            bold: true,
            color: theme.primaryColor,
          }),
        ],
      })
    );

    // Subtitle / audience
    if (document.audience) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [
            new TextRun({
              text: `Prepared for ${this.formatAudience(document.audience)}`,
              font: theme.bodyFont,
              size: 24,
              color: '666666',
              italics: true,
            }),
          ],
        })
      );
    }

    // Date
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [
          new TextRun({
            text: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
            }),
            font: theme.bodyFont,
            size: 22,
            color: '666666',
          }),
        ],
      })
    );

    // Company name
    if (options.companyName) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 800 },
          children: [
            new TextRun({
              text: options.companyName,
              font: theme.titleFont,
              size: 28,
              bold: true,
              color: theme.primaryColor,
            }),
          ],
        })
      );
    }

    // Confidentiality notice
    if (options.confidentialityNotice) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1200 },
          children: [
            new TextRun({
              text: options.confidentialityNotice,
              font: theme.bodyFont,
              size: 16,
              color: '999999',
              italics: true,
            }),
          ],
        })
      );
    }

    return paragraphs;
  }

  /**
   * Create table of contents
   */
  private createTableOfContents(theme: DocxTheme): Paragraph[] {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: 'Table of Contents',
            font: theme.titleFont,
            bold: true,
          }),
        ],
      }),
      new TableOfContents('Table of Contents', {
        hyperlink: true,
        headingStyleRange: '1-3',
        stylesWithLevels: [
          new StyleLevel('Heading1', 1),
          new StyleLevel('Heading2', 2),
          new StyleLevel('Heading3', 3),
        ],
      }),
    ];
  }

  /**
   * Create section content
   */
  private async createSectionContent(
    section: DocumentSection,
    document: DocumentData,
    theme: DocxTheme,
    options: DocxExportOptions
  ): Promise<(Paragraph | Table)[]> {
    const sectionDef = SECTION_LIBRARY[section.sectionKey];
    if (!sectionDef) return [];

    const elements: (Paragraph | Table)[] = [];

    // Section heading
    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: sectionDef.name,
            font: theme.titleFont,
            bold: true,
          }),
        ],
      })
    );

    // Content based on section category
    switch (sectionDef.category) {
      case 'summary':
        elements.push(...this.createSummaryContent(section, theme));
        break;

      case 'property':
        elements.push(...this.createPropertyContent(section, theme));
        break;

      case 'market':
        elements.push(...this.createMarketContent(section, theme));
        break;

      case 'financial':
        elements.push(...this.createFinancialContent(section, theme));
        break;

      case 'operations':
        elements.push(...this.createUnderwritingContent(section, theme));
        break;

      case 'due_diligence':
        elements.push(...this.createDueDiligenceContent(section, theme));
        break;

      default:
        elements.push(...this.createGenericContent(section, theme));
    }

    return elements;
  }

  /**
   * Create summary section content
   */
  private createSummaryContent(
    section: DocumentSection,
    theme: DocxTheme
  ): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    const content = section.content as any;

    // Executive summary
    if (content?.executiveSummary || content?.summary || content?.overview) {
      const summaryText = content.executiveSummary || content.summary || content.overview;
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: summaryText,
              font: theme.bodyFont,
              size: theme.bodySize,
            }),
          ],
        })
      );
    }

    // Investment highlights
    if (content?.investmentHighlights && Array.isArray(content.investmentHighlights)) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Investment Highlights',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      content.investmentHighlights.forEach((highlight: string) => {
        elements.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: highlight,
                font: theme.bodyFont,
                size: theme.bodySize,
              }),
            ],
          })
        );
      });
    }

    // Key metrics if present
    if (content?.keyMetrics) {
      elements.push(...this.createMetricsTable(content.keyMetrics, theme));
    }

    return elements;
  }

  /**
   * Create property section content
   */
  private createPropertyContent(
    section: DocumentSection,
    theme: DocxTheme
  ): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    const content = section.content as any;

    // Property overview metrics
    const propertyMetrics = [
      { label: 'Property Name', value: content?.propertyName || 'N/A' },
      { label: 'Location', value: this.formatLocation(content) },
      { label: 'Total Slips', value: this.formatNumber(content?.totalSlips) },
      { label: 'Wet Slips', value: this.formatNumber(content?.wetSlips) },
      { label: 'Dry Storage', value: this.formatNumber(content?.dryStorage) },
      { label: 'Acreage', value: content?.acreage ? `${content.acreage} acres` : 'N/A' },
      { label: 'Year Built', value: content?.yearBuilt?.toString() || 'N/A' },
      { label: 'Water Frontage', value: content?.waterFrontage ? `${content.waterFrontage} ft` : 'N/A' },
    ];

    elements.push(...this.createMetricsTable(propertyMetrics, theme));

    // Property description
    if (content?.description) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Property Description',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: content.description,
              font: theme.bodyFont,
              size: theme.bodySize,
            }),
          ],
        })
      );
    }

    // Amenities
    if (content?.amenities && Array.isArray(content.amenities) && content.amenities.length > 0) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Amenities',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      content.amenities.forEach((amenity: string) => {
        elements.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: amenity,
                font: theme.bodyFont,
                size: theme.bodySize,
              }),
            ],
          })
        );
      });
    }

    return elements;
  }

  /**
   * Create market section content
   */
  private createMarketContent(
    section: DocumentSection,
    theme: DocxTheme
  ): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    const content = section.content as any;

    // Market overview text
    if (content?.marketOverview) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: content.marketOverview,
              font: theme.bodyFont,
              size: theme.bodySize,
            }),
          ],
        })
      );
    }

    // Demographics
    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: 'Demographics',
            font: theme.titleFont,
            bold: true,
          }),
        ],
      })
    );

    const demographics = [
      { label: 'Population', value: this.formatNumber(content?.population) },
      { label: 'Median Household Income', value: this.formatCurrency(content?.medianIncome) },
      { label: 'Boat Registrations', value: this.formatNumber(content?.boatRegistrations) },
      { label: 'Population Growth', value: this.formatPercent(content?.populationGrowth) },
      { label: 'Employment Growth', value: this.formatPercent(content?.employmentGrowth) },
    ];

    elements.push(...this.createMetricsTable(demographics, theme));

    // Competition
    if (content?.competitors && Array.isArray(content.competitors) && content.competitors.length > 0) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Competitive Landscape',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      elements.push(this.createCompetitorTable(content.competitors, theme));
    }

    return elements;
  }

  /**
   * Create financial section content
   */
  private createFinancialContent(
    section: DocumentSection,
    theme: DocxTheme
  ): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    const content = section.content as any;

    // Key financial metrics
    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: 'Financial Overview',
            font: theme.titleFont,
            bold: true,
          }),
        ],
      })
    );

    const financials = [
      { label: 'Asking Price', value: this.formatCurrency(content?.askingPrice) },
      { label: 'Net Operating Income', value: this.formatCurrency(content?.noi) },
      { label: 'Cap Rate', value: this.formatPercent(content?.capRate) },
      { label: 'Price per Slip', value: this.formatCurrency(content?.pricePerSlip) },
      { label: 'Total Revenue', value: this.formatCurrency(content?.totalRevenue) },
      { label: 'Operating Expenses', value: this.formatCurrency(content?.operatingExpenses) },
      { label: 'Expense Ratio', value: this.formatPercent(content?.expenseRatio) },
    ];

    elements.push(...this.createMetricsTable(financials, theme));

    // Revenue breakdown
    if (content?.revenueBreakdown) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Revenue Breakdown',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      const breakdown = Object.entries(content.revenueBreakdown).map(([key, value]) => ({
        label: this.formatLabel(key),
        value: this.formatCurrency(value as number),
      }));

      elements.push(...this.createMetricsTable(breakdown, theme));
    }

    // Operating expenses breakdown
    if (content?.expenseBreakdown) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Operating Expenses',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      const expenses = Object.entries(content.expenseBreakdown).map(([key, value]) => ({
        label: this.formatLabel(key),
        value: this.formatCurrency(value as number),
      }));

      elements.push(...this.createMetricsTable(expenses, theme));
    }

    return elements;
  }

  /**
   * Create underwriting section content
   */
  private createUnderwritingContent(
    section: DocumentSection,
    theme: DocxTheme
  ): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    const content = section.content as any;

    // Investment returns
    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: 'Investment Returns',
            font: theme.titleFont,
            bold: true,
          }),
        ],
      })
    );

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

    elements.push(...this.createMetricsTable(returns, theme));

    // Financing assumptions
    if (content?.financing) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Financing Assumptions',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      const financing = [
        { label: 'Loan Amount', value: this.formatCurrency(content.financing?.loanAmount) },
        { label: 'LTV', value: this.formatPercent(content.financing?.ltv) },
        { label: 'Interest Rate', value: this.formatPercent(content.financing?.interestRate) },
        { label: 'Loan Term', value: content.financing?.term ? `${content.financing.term} years` : 'N/A' },
        { label: 'Amortization', value: content.financing?.amortization ? `${content.financing.amortization} years` : 'N/A' },
      ];

      elements.push(...this.createMetricsTable(financing, theme));
    }

    // Projections table
    if (content?.projections && content.projections.years) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Financial Projections',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      elements.push(this.createProjectionsTable(content.projections, theme));
    }

    return elements;
  }

  /**
   * Create due diligence section content
   */
  private createDueDiligenceContent(
    section: DocumentSection,
    theme: DocxTheme
  ): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    const content = section.content as any;

    // Risk factors
    if (content?.riskFactors && Array.isArray(content.riskFactors)) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Risk Factors',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      content.riskFactors.forEach((risk: any, index: number) => {
        const riskText = typeof risk === 'string' ? risk : risk.description;
        elements.push(
          new Paragraph({
            numbering: { reference: 'risk-list', level: 0 },
            children: [
              new TextRun({
                text: riskText,
                font: theme.bodyFont,
                size: theme.bodySize,
              }),
            ],
          })
        );
      });
    }

    // Mitigants
    if (content?.mitigants && Array.isArray(content.mitigants)) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Risk Mitigants',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      content.mitigants.forEach((mitigant: any) => {
        const mitigantText = typeof mitigant === 'string' ? mitigant : mitigant.description;
        elements.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: mitigantText,
                font: theme.bodyFont,
                size: theme.bodySize,
              }),
            ],
          })
        );
      });
    }

    // Due diligence checklist
    if (content?.checklist && Array.isArray(content.checklist)) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: 'Due Diligence Checklist',
              font: theme.titleFont,
              bold: true,
            }),
          ],
        })
      );

      elements.push(this.createChecklistTable(content.checklist, theme));
    }

    return elements;
  }

  /**
   * Create generic content
   */
  private createGenericContent(
    section: DocumentSection,
    theme: DocxTheme
  ): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = [];
    const content = section.content as any;

    // Extract and render text content
    const textContent = this.extractTextContent(content);
    if (textContent) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: textContent,
              font: theme.bodyFont,
              size: theme.bodySize,
            }),
          ],
        })
      );
    }

    // Render any lists
    if (content?.items && Array.isArray(content.items)) {
      content.items.forEach((item: string) => {
        elements.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: item,
                font: theme.bodyFont,
                size: theme.bodySize,
              }),
            ],
          })
        );
      });
    }

    return elements;
  }

  /**
   * Create metrics table
   */
  private createMetricsTable(
    metrics: Array<{ label: string; value: string }>,
    theme: DocxTheme
  ): (Paragraph | Table)[] {
    const rows = metrics.map(
      metric =>
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: 'F5F5F5', type: ShadingType.CLEAR },
              width: { size: 4000, type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: metric.label,
                      font: theme.bodyFont,
                      size: 20,
                      color: '666666',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4000, type: WidthType.DXA },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: metric.value,
                      font: theme.titleFont,
                      size: 22,
                      bold: true,
                      color: theme.primaryColor,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
    );

    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
        },
        rows,
      }),
      new Paragraph({ children: [] }), // Spacer
    ];
  }

  /**
   * Create competitor table
   */
  private createCompetitorTable(competitors: any[], theme: DocxTheme): Table {
    const headerRow = new TableRow({
      children: [
        this.createTableHeaderCell('Property', theme),
        this.createTableHeaderCell('Distance', theme),
        this.createTableHeaderCell('Slips', theme),
        this.createTableHeaderCell('Avg Rate', theme),
      ],
    });

    const dataRows = competitors.slice(0, 5).map(
      comp =>
        new TableRow({
          children: [
            this.createTableDataCell(comp.name || 'N/A', theme),
            this.createTableDataCell(comp.distance ? `${comp.distance} mi` : 'N/A', theme),
            this.createTableDataCell(comp.slips?.toString() || 'N/A', theme),
            this.createTableDataCell(comp.avgRate ? `$${comp.avgRate}/ft` : 'N/A', theme),
          ],
        })
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      rows: [headerRow, ...dataRows],
    });
  }

  /**
   * Create projections table
   */
  private createProjectionsTable(projections: any, theme: DocxTheme): Table {
    const years = projections.years || ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];

    const headerRow = new TableRow({
      children: [
        this.createTableHeaderCell('Metric', theme),
        ...years.map((year: string) => this.createTableHeaderCell(year, theme)),
      ],
    });

    const rows: TableRow[] = [headerRow];

    // Revenue row
    if (projections.revenue) {
      rows.push(
        new TableRow({
          children: [
            this.createTableDataCell('Revenue', theme),
            ...projections.revenue.map((v: number) =>
              this.createTableDataCell(this.formatCurrency(v), theme)
            ),
          ],
        })
      );
    }

    // NOI row
    if (projections.noi) {
      rows.push(
        new TableRow({
          children: [
            this.createTableDataCell('NOI', theme),
            ...projections.noi.map((v: number) =>
              this.createTableDataCell(this.formatCurrency(v), theme)
            ),
          ],
        })
      );
    }

    // Cash flow row
    if (projections.cashFlow) {
      rows.push(
        new TableRow({
          children: [
            this.createTableDataCell('Cash Flow', theme),
            ...projections.cashFlow.map((v: number) =>
              this.createTableDataCell(this.formatCurrency(v), theme)
            ),
          ],
        })
      );
    }

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      rows,
    });
  }

  /**
   * Create checklist table
   */
  private createChecklistTable(checklist: any[], theme: DocxTheme): Table {
    const headerRow = new TableRow({
      children: [
        this.createTableHeaderCell('Item', theme),
        this.createTableHeaderCell('Status', theme),
        this.createTableHeaderCell('Notes', theme),
      ],
    });

    const dataRows = checklist.map(
      item =>
        new TableRow({
          children: [
            this.createTableDataCell(item.item || item.name || 'N/A', theme),
            this.createTableDataCell(item.status || 'Pending', theme),
            this.createTableDataCell(item.notes || '', theme),
          ],
        })
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      rows: [headerRow, ...dataRows],
    });
  }

  /**
   * Create table header cell
   */
  private createTableHeaderCell(text: string, theme: DocxTheme): TableCell {
    return new TableCell({
      shading: { fill: theme.primaryColor, type: ShadingType.CLEAR },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              font: theme.titleFont,
              size: 20,
              bold: true,
              color: 'FFFFFF',
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Create table data cell
   */
  private createTableDataCell(text: string, theme: DocxTheme): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              font: theme.bodyFont,
              size: 20,
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Create disclaimer content
   */
  private createDisclaimer(theme: DocxTheme, options: DocxExportOptions): Paragraph[] {
    const companyName = options.companyName || 'MarinaMatch';

    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: 'Important Disclosures',
            font: theme.titleFont,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        style: 'Disclaimer',
        children: [
          new TextRun({
            text: `This document has been prepared by ${companyName} for informational purposes only. The information contained herein is confidential and is being provided to you solely for the purpose of evaluating the potential acquisition of the property described herein.`,
          }),
        ],
      }),
      new Paragraph({
        style: 'Disclaimer',
        children: [
          new TextRun({
            text: 'This document is not intended to provide any investment, tax, accounting, or legal advice. Recipients should consult with their own advisors regarding investment, tax, accounting, and legal matters.',
          }),
        ],
      }),
      new Paragraph({
        style: 'Disclaimer',
        children: [
          new TextRun({
            text: 'The information contained in this document has been obtained from sources believed to be reliable, but no representation or warranty, express or implied, is made as to the accuracy or completeness of such information.',
          }),
        ],
      }),
      new Paragraph({
        style: 'Disclaimer',
        children: [
          new TextRun({
            text: 'Past performance is not indicative of future results. Actual results may differ materially from any projections or forward-looking statements contained herein.',
          }),
        ],
      }),
      new Paragraph({
        style: 'Disclaimer',
        children: [
          new TextRun({
            text: 'This document does not constitute an offer to sell or a solicitation of an offer to buy any securities. Any such offer may only be made pursuant to definitive transaction documents.',
          }),
        ],
      }),
    ];
  }

  /**
   * Create header
   */
  private createHeader(
    title: string,
    theme: DocxTheme,
    options: DocxExportOptions
  ): Header {
    return new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: title,
              font: theme.bodyFont,
              size: 18,
              color: '999999',
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Create footer
   */
  private createFooter(theme: DocxTheme, options: DocxExportOptions): Footer {
    const children: Paragraph[] = [];

    // Confidential notice
    if (options.confidentialityNotice) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: options.confidentialityNotice,
              font: theme.bodyFont,
              size: 16,
              color: '999999',
              italics: true,
            }),
          ],
        })
      );
    }

    // Page number
    if (options.includePageNumbers !== false) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Page ',
              font: theme.bodyFont,
              size: 18,
              color: '666666',
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              font: theme.bodyFont,
              size: 18,
              color: '666666',
            }),
            new TextRun({
              text: ' of ',
              font: theme.bodyFont,
              size: 18,
              color: '666666',
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              font: theme.bodyFont,
              size: 18,
              color: '666666',
            }),
          ],
        })
      );
    }

    return new Footer({ children });
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private getSubjectFromDocType(docType: DocumentType): string {
    const subjects: Record<DocumentType, string> = {
      offering_memorandum: 'Investment Offering Memorandum',
      ic_memo: 'Investment Committee Memorandum',
      pitch_deck: 'Investment Pitch Deck',
      executive_summary: 'Executive Summary',
      teaser: 'Investment Teaser',
      lender_package: 'Lender Package',
      due_diligence_summary: 'Due Diligence Summary',
      custom: 'Custom Document',
    };
    return subjects[docType] || 'Investment Document';
  }

  private getDocumentTypeLabel(docType: DocumentType): string {
    const labels: Record<DocumentType, string> = {
      offering_memorandum: 'Offering Memorandum',
      ic_memo: 'Investment Committee Memo',
      pitch_deck: 'Pitch Deck',
      executive_summary: 'Executive Summary',
      teaser: 'Investment Teaser',
      lender_package: 'Lender Package',
      due_diligence_summary: 'Due Diligence Summary',
      custom: 'Custom Document',
    };
    return labels[docType] || 'Document';
  }

  private formatAudience(audience: AudiencePersona): string {
    const labels: Record<AudiencePersona, string> = {
      institutional_investor: 'Institutional Investors',
      private_equity: 'Private Equity',
      family_office: 'Family Offices',
      lender: 'Lenders',
      investment_committee: 'Investment Committee',
      board_of_directors: 'Board of Directors',
      potential_buyer: 'Potential Buyers',
      broker: 'Brokers',
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

export const docxExportService = new DocxExportService();
