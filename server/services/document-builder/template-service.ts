/**
 * Template Service
 * Manages document templates for the Document Builder
 */

import { db } from '../../db';
import { omTemplates } from '@shared/document-builder/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import {
  DocumentType,
  SectionDefinition,
  AudiencePersona,
  AssetClass,
} from '@shared/document-builder/types';
import { SECTION_LIBRARY, DOCUMENT_TYPE_CONFIGS } from '@shared/document-builder/section-library';

// =============================================================================
// Types
// =============================================================================

export interface TemplateData {
  id: string;
  name: string;
  description?: string;
  documentType: DocumentType;
  sections: string[];
  theme?: TemplateTheme;
  defaultBindings?: Record<string, any>;
  metadata?: Record<string, any>;
  scope: 'global' | 'organization' | 'user';
  ownerId?: string;
  organizationId?: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  titleFont: string;
  bodyFont: string;
  logoUrl?: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  documentType: DocumentType;
  sections: string[];
  theme?: TemplateTheme;
  defaultBindings?: Record<string, any>;
  metadata?: Record<string, any>;
  scope?: 'global' | 'organization' | 'user';
  ownerId?: string;
  organizationId?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  sections?: string[];
  theme?: TemplateTheme;
  defaultBindings?: Record<string, any>;
  metadata?: Record<string, any>;
  isDefault?: boolean;
}

// =============================================================================
// Default Templates
// =============================================================================

const DEFAULT_TEMPLATES: Omit<CreateTemplateInput, 'scope'>[] = [
  // Offering Memorandum Templates
  {
    name: 'Standard Offering Memorandum',
    description: 'Comprehensive OM for institutional investors',
    documentType: DocumentType.OFFERING_MEMORANDUM,
    sections: [
      'cover_page',
      'executive_summary',
      'investment_highlights',
      'property_overview',
      'marina_operations',
      'market_analysis',
      'financial_summary',
      'rent_roll_summary',
      'underwriting_assumptions',
      'risk_factors',
      'appendices',
    ],
    theme: {
      primaryColor: '#0C5486',
      secondaryColor: '#2E8BAB',
      accentColor: '#F5A623',
      titleFont: 'Arial',
      bodyFont: 'Calibri',
    },
  },
  {
    name: 'Condensed Offering Memorandum',
    description: 'Shorter OM focusing on key investment points',
    documentType: DocumentType.OFFERING_MEMORANDUM,
    sections: [
      'cover_page',
      'executive_summary',
      'investment_highlights',
      'property_overview',
      'financial_summary',
      'risk_factors',
    ],
    theme: {
      primaryColor: '#1A365D',
      secondaryColor: '#4A5568',
      accentColor: '#DD6B20',
      titleFont: 'Helvetica',
      bodyFont: 'Georgia',
    },
  },

  // IC Memo Templates
  {
    name: 'Standard IC Memo',
    description: 'Investment Committee memo with full analysis',
    documentType: DocumentType.INVESTMENT_COMMITTEE_MEMO,
    sections: [
      'cover_page',
      'executive_summary',
      'investment_thesis',
      'property_overview',
      'market_analysis',
      'financial_analysis',
      'underwriting_assumptions',
      'sensitivity_analysis',
      'risk_assessment',
      'recommendation',
    ],
    theme: {
      primaryColor: '#2D3748',
      secondaryColor: '#4A5568',
      accentColor: '#3182CE',
      titleFont: 'Arial',
      bodyFont: 'Times New Roman',
    },
  },

  // Pitch Deck Templates
  {
    name: 'Investor Pitch Deck',
    description: 'Presentation-style pitch for investors',
    documentType: DocumentType.PITCH_DECK,
    sections: [
      'cover_page',
      'executive_summary',
      'investment_highlights',
      'property_overview',
      'location_analysis',
      'financial_snapshot',
      'investment_returns',
      'next_steps',
    ],
    theme: {
      primaryColor: '#0C5486',
      secondaryColor: '#38B2AC',
      accentColor: '#F6AD55',
      titleFont: 'Arial',
      bodyFont: 'Calibri',
    },
  },

  // Executive Summary Templates
  {
    name: 'One-Page Executive Summary',
    description: 'Concise single-page summary',
    documentType: DocumentType.EXECUTIVE_SUMMARY,
    sections: [
      'executive_summary',
      'investment_highlights',
      'financial_snapshot',
    ],
    theme: {
      primaryColor: '#0C5486',
      secondaryColor: '#2E8BAB',
      accentColor: '#F5A623',
      titleFont: 'Arial',
      bodyFont: 'Calibri',
    },
  },

  // Teaser Templates
  {
    name: 'Investment Teaser',
    description: 'Brief overview to generate interest',
    documentType: DocumentType.TEASER,
    sections: [
      'cover_page',
      'investment_highlights',
      'property_snapshot',
      'financial_snapshot',
    ],
    theme: {
      primaryColor: '#1A365D',
      secondaryColor: '#4299E1',
      accentColor: '#ECC94B',
      titleFont: 'Helvetica',
      bodyFont: 'Calibri',
    },
  },

  // Lender Package Templates
  {
    name: 'Standard Lender Package',
    description: 'Comprehensive package for debt financing',
    documentType: DocumentType.LENDER_PACKAGE,
    sections: [
      'cover_page',
      'executive_summary',
      'borrower_overview',
      'property_overview',
      'market_analysis',
      'financial_summary',
      'rent_roll_summary',
      'underwriting_assumptions',
      'collateral_description',
      'environmental_summary',
    ],
    theme: {
      primaryColor: '#2D3748',
      secondaryColor: '#4A5568',
      accentColor: '#38A169',
      titleFont: 'Arial',
      bodyFont: 'Times New Roman',
    },
  },

  // DD Summary Templates
  {
    name: 'Due Diligence Summary',
    description: 'Summary of due diligence findings',
    documentType: DocumentType.DD_SUMMARY,
    sections: [
      'cover_page',
      'executive_summary',
      'dd_checklist',
      'physical_inspection',
      'environmental_review',
      'legal_review',
      'financial_review',
      'risk_assessment',
      'recommendations',
    ],
    theme: {
      primaryColor: '#744210',
      secondaryColor: '#975A16',
      accentColor: '#C05621',
      titleFont: 'Arial',
      bodyFont: 'Calibri',
    },
  },
];

// =============================================================================
// Template Service
// =============================================================================

class TemplateService {
  /**
   * Get all templates available to a user
   */
  async getTemplates(
    userId?: string,
    organizationId?: string,
    documentType?: DocumentType
  ): Promise<TemplateData[]> {
    // Build query conditions
    const conditions = [];

    // Global templates
    conditions.push(eq(omTemplates.scope, 'global'));

    // Organization templates
    if (organizationId) {
      conditions.push(
        and(
          eq(omTemplates.scope, 'organization'),
          eq(omTemplates.organizationId, organizationId)
        )
      );
    }

    // User templates
    if (userId) {
      conditions.push(
        and(
          eq(omTemplates.scope, 'user'),
          eq(omTemplates.ownerId, userId)
        )
      );
    }

    let query = db
      .select()
      .from(omTemplates)
      .where(or(...conditions));

    // Filter by document type if provided
    if (documentType) {
      query = db
        .select()
        .from(omTemplates)
        .where(
          and(
            or(...conditions),
            eq(omTemplates.documentType, documentType)
          )
        );
    }

    const templates = await query;

    return templates.map(this.mapTemplate);
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: string): Promise<TemplateData | null> {
    const [template] = await db
      .select()
      .from(omTemplates)
      .where(eq(omTemplates.id, templateId))
      .limit(1);

    if (!template) return null;
    return this.mapTemplate(template);
  }

  /**
   * Get default template for a document type
   */
  async getDefaultTemplate(documentType: DocumentType): Promise<TemplateData | null> {
    const [template] = await db
      .select()
      .from(omTemplates)
      .where(
        and(
          eq(omTemplates.documentType, documentType),
          eq(omTemplates.isDefault, true),
          eq(omTemplates.scope, 'global')
        )
      )
      .limit(1);

    if (!template) return null;
    return this.mapTemplate(template);
  }

  /**
   * Create a new template
   */
  async createTemplate(input: CreateTemplateInput): Promise<TemplateData> {
    const [template] = await db
      .insert(omTemplates)
      .values({
        name: input.name,
        description: input.description,
        documentType: input.documentType,
        sections: input.sections,
        theme: input.theme || {},
        defaultBindings: input.defaultBindings || {},
        metadata: input.metadata || {},
        scope: input.scope || 'user',
        ownerId: input.ownerId,
        organizationId: input.organizationId,
      })
      .returning();

    return this.mapTemplate(template);
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: string,
    input: UpdateTemplateInput
  ): Promise<TemplateData | null> {
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.sections !== undefined) updateData.sections = input.sections;
    if (input.theme !== undefined) updateData.theme = input.theme;
    if (input.defaultBindings !== undefined) updateData.defaultBindings = input.defaultBindings;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

    updateData.updatedAt = new Date();

    const [template] = await db
      .update(omTemplates)
      .set(updateData)
      .where(eq(omTemplates.id, templateId))
      .returning();

    if (!template) return null;
    return this.mapTemplate(template);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    const result = await db
      .delete(omTemplates)
      .where(eq(omTemplates.id, templateId))
      .returning({ id: omTemplates.id });

    return result.length > 0;
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(
    templateId: string,
    newName: string,
    ownerId?: string
  ): Promise<TemplateData | null> {
    const original = await this.getTemplate(templateId);
    if (!original) return null;

    return this.createTemplate({
      name: newName,
      description: original.description,
      documentType: original.documentType,
      sections: [...original.sections],
      theme: original.theme ? { ...original.theme } : undefined,
      defaultBindings: original.defaultBindings ? { ...original.defaultBindings } : undefined,
      metadata: original.metadata ? { ...original.metadata } : undefined,
      scope: 'user',
      ownerId,
    });
  }

  /**
   * Seed default templates
   */
  async seedDefaultTemplates(): Promise<void> {
    // Check if default templates already exist
    const existing = await db
      .select({ id: omTemplates.id })
      .from(omTemplates)
      .where(eq(omTemplates.scope, 'global'))
      .limit(1);

    if (existing.length > 0) {
      console.log('Default templates already exist, skipping seed');
      return;
    }

    console.log('Seeding default templates...');

    for (const template of DEFAULT_TEMPLATES) {
      await this.createTemplate({
        ...template,
        scope: 'global',
      });
    }

    // Mark first template of each type as default
    for (const docType of Object.values(DocumentType)) {
      const [first] = await db
        .select({ id: omTemplates.id })
        .from(omTemplates)
        .where(
          and(
            eq(omTemplates.documentType, docType),
            eq(omTemplates.scope, 'global')
          )
        )
        .limit(1);

      if (first) {
        await db
          .update(omTemplates)
          .set({ isDefault: true })
          .where(eq(omTemplates.id, first.id));
      }
    }

    console.log('Default templates seeded successfully');
  }

  /**
   * Get sections for a template
   */
  async getTemplateSections(templateId: string): Promise<SectionDefinition[]> {
    const template = await this.getTemplate(templateId);
    if (!template) return [];

    return template.sections
      .map(key => SECTION_LIBRARY[key])
      .filter(Boolean);
  }

  /**
   * Validate template sections
   */
  validateTemplateSections(
    documentType: DocumentType,
    sections: string[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = DOCUMENT_TYPE_CONFIGS[documentType];

    if (!config) {
      errors.push(`Invalid document type: ${documentType}`);
      return { valid: false, errors };
    }

    // Check required sections
    for (const required of config.requiredSections) {
      if (!sections.includes(required)) {
        const sectionDef = SECTION_LIBRARY[required];
        errors.push(`Missing required section: ${sectionDef?.name || required}`);
      }
    }

    // Check all sections are valid for this document type
    for (const sectionKey of sections) {
      if (!config.availableSections.includes(sectionKey)) {
        const sectionDef = SECTION_LIBRARY[sectionKey];
        errors.push(`Section not available for this document type: ${sectionDef?.name || sectionKey}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private mapTemplate(template: any): TemplateData {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      documentType: template.documentType as DocumentType,
      sections: template.sections as string[],
      theme: template.theme as TemplateTheme | undefined,
      defaultBindings: template.defaultBindings as Record<string, any> | undefined,
      metadata: template.metadata as Record<string, any> | undefined,
      scope: template.scope as 'global' | 'organization' | 'user',
      ownerId: template.ownerId,
      organizationId: template.organizationId,
      isDefault: template.isDefault,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

export const templateService = new TemplateService();
