/**
 * Theme Service
 * Manages document themes for the Document Builder
 */

import { db } from '../../db';
import { omThemes } from '../../../shared/document-builder/schema';
import { eq, and, or } from 'drizzle-orm';

// =============================================================================
// Types
// =============================================================================

export interface ThemeData {
  id: string;
  name: string;
  description?: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  branding: ThemeBranding;
  spacing: ThemeSpacing;
  scope: 'global' | 'organization' | 'user';
  ownerId?: string;
  organizationId?: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textLight: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeTypography {
  titleFont: string;
  headingFont: string;
  bodyFont: string;
  titleSize: number;
  h1Size: number;
  h2Size: number;
  h3Size: number;
  bodySize: number;
  smallSize: number;
  lineHeight: number;
}

export interface ThemeBranding {
  logoUrl?: string;
  logoPosition?: 'header' | 'footer' | 'both' | 'none';
  companyName?: string;
  tagline?: string;
  confidentialityNotice?: string;
  footerText?: string;
}

export interface ThemeSpacing {
  pageMarginTop: number;
  pageMarginBottom: number;
  pageMarginLeft: number;
  pageMarginRight: number;
  sectionSpacing: number;
  paragraphSpacing: number;
  lineSpacing: number;
}

export interface CreateThemeInput {
  name: string;
  description?: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  branding?: ThemeBranding;
  spacing?: ThemeSpacing;
  scope?: 'global' | 'organization' | 'user';
  ownerId?: string;
  organizationId?: string;
}

export interface UpdateThemeInput {
  name?: string;
  description?: string;
  colors?: Partial<ThemeColors>;
  typography?: Partial<ThemeTypography>;
  branding?: Partial<ThemeBranding>;
  spacing?: Partial<ThemeSpacing>;
  isDefault?: boolean;
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_COLORS: ThemeColors = {
  primary: '#0C5486',
  secondary: '#2E8BAB',
  accent: '#F5A623',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  text: '#1A202C',
  textLight: '#4A5568',
  textMuted: '#A0AEC0',
  border: '#E2E8F0',
  success: '#38A169',
  warning: '#DD6B20',
  error: '#E53E3E',
};

const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  titleFont: 'Arial',
  headingFont: 'Arial',
  bodyFont: 'Calibri',
  titleSize: 36,
  h1Size: 28,
  h2Size: 22,
  h3Size: 18,
  bodySize: 11,
  smallSize: 9,
  lineHeight: 1.5,
};

const DEFAULT_BRANDING: ThemeBranding = {
  logoPosition: 'header',
  confidentialityNotice: 'CONFIDENTIAL - For Authorized Recipients Only',
};

const DEFAULT_SPACING: ThemeSpacing = {
  pageMarginTop: 72,
  pageMarginBottom: 72,
  pageMarginLeft: 72,
  pageMarginRight: 72,
  sectionSpacing: 24,
  paragraphSpacing: 12,
  lineSpacing: 1.5,
};

// =============================================================================
// Default Themes
// =============================================================================

const DEFAULT_THEMES: Omit<CreateThemeInput, 'scope'>[] = [
  {
    name: 'Marina Blue',
    description: 'Professional navy blue theme ideal for marina investments',
    colors: {
      ...DEFAULT_COLORS,
      primary: '#0C5486',
      secondary: '#2E8BAB',
      accent: '#F5A623',
    },
    typography: DEFAULT_TYPOGRAPHY,
    branding: DEFAULT_BRANDING,
    spacing: DEFAULT_SPACING,
  },
  {
    name: 'Corporate Gray',
    description: 'Clean, professional gray theme for institutional documents',
    colors: {
      ...DEFAULT_COLORS,
      primary: '#2D3748',
      secondary: '#4A5568',
      accent: '#3182CE',
      surface: '#F7FAFC',
    },
    typography: {
      ...DEFAULT_TYPOGRAPHY,
      bodyFont: 'Times New Roman',
    },
    branding: DEFAULT_BRANDING,
    spacing: DEFAULT_SPACING,
  },
  {
    name: 'Coastal Teal',
    description: 'Fresh teal theme with coastal vibes',
    colors: {
      ...DEFAULT_COLORS,
      primary: '#234E52',
      secondary: '#38B2AC',
      accent: '#ED8936',
      surface: '#F0FFF4',
    },
    typography: DEFAULT_TYPOGRAPHY,
    branding: DEFAULT_BRANDING,
    spacing: DEFAULT_SPACING,
  },
  {
    name: 'Executive Black',
    description: 'Elegant black theme for premium presentations',
    colors: {
      ...DEFAULT_COLORS,
      primary: '#1A202C',
      secondary: '#2D3748',
      accent: '#D69E2E',
      background: '#FFFFFF',
      surface: '#F7FAFC',
    },
    typography: {
      ...DEFAULT_TYPOGRAPHY,
      titleFont: 'Georgia',
      headingFont: 'Georgia',
    },
    branding: DEFAULT_BRANDING,
    spacing: DEFAULT_SPACING,
  },
  {
    name: 'Sunset Orange',
    description: 'Warm orange theme for engaging presentations',
    colors: {
      ...DEFAULT_COLORS,
      primary: '#C05621',
      secondary: '#DD6B20',
      accent: '#2B6CB0',
      surface: '#FFFAF0',
    },
    typography: DEFAULT_TYPOGRAPHY,
    branding: DEFAULT_BRANDING,
    spacing: DEFAULT_SPACING,
  },
  {
    name: 'Forest Green',
    description: 'Natural green theme for sustainability-focused content',
    colors: {
      ...DEFAULT_COLORS,
      primary: '#276749',
      secondary: '#38A169',
      accent: '#B7791F',
      surface: '#F0FFF4',
    },
    typography: DEFAULT_TYPOGRAPHY,
    branding: DEFAULT_BRANDING,
    spacing: DEFAULT_SPACING,
  },
];

// =============================================================================
// Theme Service
// =============================================================================

class ThemeService {
  /**
   * Get all themes available to a user
   */
  async getThemes(
    userId?: string,
    organizationId?: string
  ): Promise<ThemeData[]> {
    const conditions = [];

    // Global themes
    conditions.push(eq(omThemes.scope, 'global'));

    // Organization themes
    if (organizationId) {
      conditions.push(
        and(
          eq(omThemes.scope, 'organization'),
          eq(omThemes.organizationId, organizationId)
        )
      );
    }

    // User themes
    if (userId) {
      conditions.push(
        and(
          eq(omThemes.scope, 'user'),
          eq(omThemes.ownerId, userId)
        )
      );
    }

    const themes = await db
      .select()
      .from(omThemes)
      .where(or(...conditions));

    return themes.map(this.mapTheme);
  }

  /**
   * Get a single theme by ID
   */
  async getTheme(themeId: string): Promise<ThemeData | null> {
    const [theme] = await db
      .select()
      .from(omThemes)
      .where(eq(omThemes.id, themeId))
      .limit(1);

    if (!theme) return null;
    return this.mapTheme(theme);
  }

  /**
   * Get default theme
   */
  async getDefaultTheme(): Promise<ThemeData | null> {
    const [theme] = await db
      .select()
      .from(omThemes)
      .where(
        and(
          eq(omThemes.isDefault, true),
          eq(omThemes.scope, 'global')
        )
      )
      .limit(1);

    if (!theme) return null;
    return this.mapTheme(theme);
  }

  /**
   * Create a new theme
   */
  async createTheme(input: CreateThemeInput): Promise<ThemeData> {
    const [theme] = await db
      .insert(omThemes)
      .values({
        name: input.name,
        description: input.description,
        colors: input.colors,
        typography: input.typography,
        branding: input.branding || DEFAULT_BRANDING,
        spacing: input.spacing || DEFAULT_SPACING,
        scope: input.scope || 'user',
        ownerId: input.ownerId,
        organizationId: input.organizationId,
      })
      .returning();

    return this.mapTheme(theme);
  }

  /**
   * Update a theme
   */
  async updateTheme(
    themeId: string,
    input: UpdateThemeInput
  ): Promise<ThemeData | null> {
    // Get existing theme to merge partial updates
    const existing = await this.getTheme(themeId);
    if (!existing) return null;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

    if (input.colors) {
      updateData.colors = { ...existing.colors, ...input.colors };
    }
    if (input.typography) {
      updateData.typography = { ...existing.typography, ...input.typography };
    }
    if (input.branding) {
      updateData.branding = { ...existing.branding, ...input.branding };
    }
    if (input.spacing) {
      updateData.spacing = { ...existing.spacing, ...input.spacing };
    }

    const [theme] = await db
      .update(omThemes)
      .set(updateData)
      .where(eq(omThemes.id, themeId))
      .returning();

    if (!theme) return null;
    return this.mapTheme(theme);
  }

  /**
   * Delete a theme
   */
  async deleteTheme(themeId: string): Promise<boolean> {
    const result = await db
      .delete(omThemes)
      .where(eq(omThemes.id, themeId))
      .returning({ id: omThemes.id });

    return result.length > 0;
  }

  /**
   * Duplicate a theme
   */
  async duplicateTheme(
    themeId: string,
    newName: string,
    ownerId?: string
  ): Promise<ThemeData | null> {
    const original = await this.getTheme(themeId);
    if (!original) return null;

    return this.createTheme({
      name: newName,
      description: original.description,
      colors: { ...original.colors },
      typography: { ...original.typography },
      branding: original.branding ? { ...original.branding } : undefined,
      spacing: original.spacing ? { ...original.spacing } : undefined,
      scope: 'user',
      ownerId,
    });
  }

  /**
   * Seed default themes
   */
  async seedDefaultThemes(): Promise<void> {
    // Check if default themes already exist
    const existing = await db
      .select({ id: omThemes.id })
      .from(omThemes)
      .where(eq(omThemes.scope, 'global'))
      .limit(1);

    if (existing.length > 0) {
      console.log('Default themes already exist, skipping seed');
      return;
    }

    console.log('Seeding default themes...');

    for (let i = 0; i < DEFAULT_THEMES.length; i++) {
      const theme = DEFAULT_THEMES[i];
      await db.insert(omThemes).values({
        name: theme.name,
        description: theme.description,
        colors: theme.colors,
        typography: theme.typography,
        branding: theme.branding || DEFAULT_BRANDING,
        spacing: theme.spacing || DEFAULT_SPACING,
        scope: 'global',
        isDefault: i === 0, // First theme is default
      });
    }

    console.log('Default themes seeded successfully');
  }

  /**
   * Convert theme to CSS variables
   */
  themeToCssVariables(theme: ThemeData): Record<string, string> {
    return {
      '--color-primary': theme.colors.primary,
      '--color-secondary': theme.colors.secondary,
      '--color-accent': theme.colors.accent,
      '--color-background': theme.colors.background,
      '--color-surface': theme.colors.surface,
      '--color-text': theme.colors.text,
      '--color-text-light': theme.colors.textLight,
      '--color-text-muted': theme.colors.textMuted,
      '--color-border': theme.colors.border,
      '--color-success': theme.colors.success,
      '--color-warning': theme.colors.warning,
      '--color-error': theme.colors.error,
      '--font-title': theme.typography.titleFont,
      '--font-heading': theme.typography.headingFont,
      '--font-body': theme.typography.bodyFont,
      '--font-size-title': `${theme.typography.titleSize}pt`,
      '--font-size-h1': `${theme.typography.h1Size}pt`,
      '--font-size-h2': `${theme.typography.h2Size}pt`,
      '--font-size-h3': `${theme.typography.h3Size}pt`,
      '--font-size-body': `${theme.typography.bodySize}pt`,
      '--font-size-small': `${theme.typography.smallSize}pt`,
      '--line-height': `${theme.typography.lineHeight}`,
      '--spacing-section': `${theme.spacing.sectionSpacing}px`,
      '--spacing-paragraph': `${theme.spacing.paragraphSpacing}px`,
    };
  }

  /**
   * Convert theme to export options format
   */
  themeToExportOptions(theme: ThemeData): any {
    // Convert hex colors to rgb
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      } : { r: 0, g: 0, b: 0 };
    };

    return {
      primaryColor: hexToRgb(theme.colors.primary),
      secondaryColor: hexToRgb(theme.colors.secondary),
      accentColor: hexToRgb(theme.colors.accent),
      textColor: hexToRgb(theme.colors.text),
      textLightColor: hexToRgb(theme.colors.textLight),
      backgroundColor: hexToRgb(theme.colors.background),
      titleFont: theme.typography.titleFont,
      bodyFont: theme.typography.bodyFont,
    };
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private mapTheme(theme: any): ThemeData {
    return {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      colors: theme.colors as ThemeColors,
      typography: theme.typography as ThemeTypography,
      branding: theme.branding as ThemeBranding,
      spacing: theme.spacing as ThemeSpacing,
      scope: theme.scope as 'global' | 'organization' | 'user',
      ownerId: theme.ownerId,
      organizationId: theme.organizationId,
      isDefault: theme.isDefault,
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
    };
  }
}

export const themeService = new ThemeService();
