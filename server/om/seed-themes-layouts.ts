import { omStorage } from "./storage";

export async function seedSystemThemes(): Promise<void> {
  const existingThemes = await omStorage.getThemes({ includeSystem: true });
  const systemThemes = existingThemes.filter(t => t.isSystemDefault);
  
  if (systemThemes.length > 0) {
    console.log(`[OM] Found ${systemThemes.length} existing system themes, skipping seed`);
    return;
  }

  console.log("[OM] Seeding system themes...");

  const defaultThemes = [
    {
      name: "Institutional Navy",
      description: "Professional institutional-grade theme with navy blue accents",
      isSystemDefault: true,
      isDefault: true,
      baseThemeKey: "institutional-navy",
      colors: {
        primary: "#1a365d",
        secondary: "#2c5282",
        accent: "#3182ce",
        background: "#ffffff",
        surface: "#f7fafc",
        text: "#1a202c",
        textMuted: "#718096",
        headerBackground: "#1a365d",
        footerBackground: "#2d3748",
        metricTileBackground: "#edf2f7",
        chartSeries: ["#3182ce", "#38a169", "#dd6b20", "#805ad5", "#d53f8c"],
        mapOverlay: "rgba(26, 54, 93, 0.7)",
      },
      typography: {
        fontFamilyDisplay: "Georgia, serif",
        fontFamilyHeading: "Georgia, serif",
        fontFamilyBody: "Inter, system-ui, sans-serif",
        fontSizes: {
          title: "48px",
          section: "36px",
          h1: "32px",
          h2: "24px",
          h3: "20px",
          body: "14px",
          disclaimer: "10px",
          metricValue: "28px",
          metricLabel: "12px",
        },
        fontWeights: {
          title: 700,
          heading: 600,
          body: 400,
          bold: 600,
        },
      },
      branding: {
        footerTextTemplate: "Confidential Offering Memorandum | {{propertyName}} | Page {{pageNumber}}",
        coverOverlayStyle: "gradient" as const,
        headerStyle: "branded" as const,
      },
      spacing: {
        defaultSpacingScale: 8,
        defaultBorderRadius: "4px",
        cardShadow: "sm" as const,
        pageMargins: { top: 48, right: 48, bottom: 48, left: 48 },
      },
    },
    {
      name: "Marina Blue",
      description: "Clean marina-focused theme with ocean blue tones",
      isSystemDefault: true,
      isDefault: false,
      baseThemeKey: "marina-blue",
      colors: {
        primary: "#0c4a6e",
        secondary: "#0369a1",
        accent: "#0ea5e9",
        background: "#ffffff",
        surface: "#f0f9ff",
        text: "#0f172a",
        textMuted: "#64748b",
        headerBackground: "#0c4a6e",
        footerBackground: "#1e3a5f",
        metricTileBackground: "#e0f2fe",
        chartSeries: ["#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#3b82f6"],
        mapOverlay: "rgba(12, 74, 110, 0.65)",
      },
      typography: {
        fontFamilyDisplay: "Georgia, serif",
        fontFamilyHeading: "Inter, system-ui, sans-serif",
        fontFamilyBody: "Inter, system-ui, sans-serif",
        fontSizes: {
          title: "48px",
          section: "36px",
          h1: "32px",
          h2: "24px",
          h3: "20px",
          body: "14px",
          disclaimer: "10px",
          metricValue: "28px",
          metricLabel: "12px",
        },
        fontWeights: {
          title: 700,
          heading: 600,
          body: 400,
          bold: 600,
        },
      },
      branding: {
        footerTextTemplate: "{{propertyName}} | Confidential",
        coverOverlayStyle: "solid" as const,
        headerStyle: "minimal" as const,
      },
      spacing: {
        defaultSpacingScale: 8,
        defaultBorderRadius: "6px",
        cardShadow: "md" as const,
        pageMargins: { top: 48, right: 48, bottom: 48, left: 48 },
      },
    },
    {
      name: "Modern Minimal",
      description: "Clean, modern design with minimal visual noise",
      isSystemDefault: true,
      isDefault: false,
      baseThemeKey: "modern-minimal",
      colors: {
        primary: "#0f172a",
        secondary: "#334155",
        accent: "#6366f1",
        background: "#ffffff",
        surface: "#f8fafc",
        text: "#1e293b",
        textMuted: "#64748b",
        headerBackground: "#0f172a",
        footerBackground: "#1e293b",
        metricTileBackground: "#f1f5f9",
        chartSeries: ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e"],
        mapOverlay: "rgba(15, 23, 42, 0.6)",
      },
      typography: {
        fontFamilyDisplay: "Inter, system-ui, sans-serif",
        fontFamilyHeading: "Inter, system-ui, sans-serif",
        fontFamilyBody: "Inter, system-ui, sans-serif",
        fontSizes: {
          title: "44px",
          section: "32px",
          h1: "28px",
          h2: "22px",
          h3: "18px",
          body: "14px",
          disclaimer: "10px",
          metricValue: "26px",
          metricLabel: "11px",
        },
        fontWeights: {
          title: 600,
          heading: 500,
          body: 400,
          bold: 600,
        },
      },
      branding: {
        coverOverlayStyle: "none" as const,
        headerStyle: "minimal" as const,
      },
      spacing: {
        defaultSpacingScale: 8,
        defaultBorderRadius: "8px",
        cardShadow: "lg" as const,
        pageMargins: { top: 56, right: 56, bottom: 56, left: 56 },
      },
    },
  ];

  for (const theme of defaultThemes) {
    try {
      await omStorage.createTheme(theme);
      console.log(`[OM] Created system theme: ${theme.name}`);
    } catch (error) {
      console.error(`[OM] Error creating theme ${theme.name}:`, error);
    }
  }
}

export async function seedSystemLayouts(): Promise<void> {
  const existingLayouts = await omStorage.getPageLayouts({ includeSystem: true });
  const systemLayouts = existingLayouts.filter(l => l.isSystemDefault);
  
  if (systemLayouts.length > 0) {
    console.log(`[OM] Found ${systemLayouts.length} existing system layouts, skipping seed`);
    return;
  }

  console.log("[OM] Seeding system page layouts...");

  const defaultLayouts = [
    {
      name: "Cover - Full Bleed Hero",
      description: "Full-page hero image with overlay text for cover pages",
      layoutType: "cover" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 1,
        gridGap: "0",
        placeholders: [
          { id: "hero-image", blockType: "image", x: 0, y: 0, width: 100, height: 100, label: "Hero Image" },
          { id: "title", blockType: "heading", x: 10, y: 40, width: 80, height: 15, label: "Property Title" },
          { id: "subtitle", blockType: "text", x: 10, y: 55, width: 80, height: 10, label: "Subtitle/Location" },
          { id: "metrics", blockType: "metricStrip", x: 10, y: 70, width: 80, height: 15, label: "Key Metrics" },
        ],
      },
    },
    {
      name: "Section Divider",
      description: "Large section number with title overlay",
      layoutType: "sectionDivider" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 1,
        gridGap: "0",
        placeholders: [
          { id: "divider", blockType: "sectionDivider", x: 0, y: 0, width: 100, height: 100, label: "Section Divider" },
        ],
      },
    },
    {
      name: "Executive Summary - Hero + Highlights",
      description: "Hero image with investment highlights below",
      layoutType: "execSummary" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 2,
        gridGap: "24px",
        placeholders: [
          { id: "hero", blockType: "image", x: 0, y: 0, width: 100, height: 40, label: "Property Image" },
          { id: "summary", blockType: "text", x: 0, y: 45, width: 48, height: 50, label: "Executive Summary" },
          { id: "highlights", blockType: "list", x: 52, y: 45, width: 48, height: 50, label: "Investment Highlights" },
        ],
      },
    },
    {
      name: "Financials - Metrics + Table",
      description: "Key metrics at top with detailed financials table",
      layoutType: "financials" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 1,
        gridGap: "24px",
        placeholders: [
          { id: "metrics", blockType: "metricStrip", x: 0, y: 0, width: 100, height: 15, label: "Key Financial Metrics" },
          { id: "table", blockType: "table", x: 0, y: 20, width: 100, height: 75, label: "Financial Details" },
        ],
      },
    },
    {
      name: "Market Overview - Map + Stats",
      description: "Regional map with market statistics",
      layoutType: "market" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 2,
        gridGap: "24px",
        placeholders: [
          { id: "map", blockType: "mapPage", x: 0, y: 0, width: 60, height: 100, label: "Market Map" },
          { id: "stats", blockType: "list", x: 65, y: 0, width: 35, height: 45, label: "Market Statistics" },
          { id: "text", blockType: "text", x: 65, y: 50, width: 35, height: 45, label: "Market Commentary" },
        ],
      },
    },
    {
      name: "Photos - Grid Layout",
      description: "Multi-image grid for property photos",
      layoutType: "photos" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 1,
        gridGap: "16px",
        placeholders: [
          { id: "heading", blockType: "heading", x: 0, y: 0, width: 100, height: 8, label: "Section Title" },
          { id: "photos", blockType: "imageGrid", x: 0, y: 10, width: 100, height: 85, label: "Photo Grid" },
        ],
      },
    },
    {
      name: "Portfolio Overview",
      description: "Portfolio summary table with key metrics",
      layoutType: "portfolio" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 1,
        gridGap: "24px",
        placeholders: [
          { id: "heading", blockType: "heading", x: 0, y: 0, width: 100, height: 8, label: "Portfolio Overview" },
          { id: "metrics", blockType: "metricStrip", x: 0, y: 10, width: 100, height: 12, label: "Portfolio Metrics" },
          { id: "table", blockType: "portfolioTable", x: 0, y: 25, width: 100, height: 70, label: "Asset Summary" },
        ],
      },
    },
    {
      name: "Team / Advisors",
      description: "Team member grid with bios",
      layoutType: "team" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 1,
        gridGap: "24px",
        placeholders: [
          { id: "heading", blockType: "heading", x: 0, y: 0, width: 100, height: 10, label: "Advisory Team" },
          { id: "team", blockType: "teamGrid", x: 0, y: 12, width: 100, height: 83, label: "Team Members" },
        ],
      },
    },
    {
      name: "Disclaimer Page",
      description: "Full-page legal disclaimer text",
      layoutType: "disclaimer" as const,
      isSystemDefault: true,
      structure: {
        gridColumns: 1,
        gridGap: "0",
        placeholders: [
          { id: "disclaimer", blockType: "disclaimer", x: 5, y: 5, width: 90, height: 90, label: "Disclaimer Text" },
        ],
      },
    },
  ];

  for (const layout of defaultLayouts) {
    try {
      await omStorage.createPageLayout(layout);
      console.log(`[OM] Created system layout: ${layout.name}`);
    } catch (error) {
      console.error(`[OM] Error creating layout ${layout.name}:`, error);
    }
  }
}

export async function seedOmThemesAndLayouts(): Promise<void> {
  try {
    await seedSystemThemes();
    await seedSystemLayouts();
    console.log("[OM] Theme and layout seeding complete");
  } catch (error) {
    console.error("[OM] Error during theme/layout seeding:", error);
  }
}
