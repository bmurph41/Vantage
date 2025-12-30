import { db } from "../server/db";
import { omThemes, omPageLayouts } from "../shared/schema";

async function seed() {
  console.log("[OM] Starting theme and layout seeding...");
  
  // Check if themes already exist
  const existingThemes = await db.select().from(omThemes);
  if (existingThemes.length > 0) {
    console.log(`[OM] Found ${existingThemes.length} themes, skipping seed`);
    process.exit(0);
    return;
  }

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
        fontSizes: { title: "48px", section: "36px", h1: "32px", h2: "24px", h3: "20px", body: "14px", disclaimer: "10px", metricValue: "28px", metricLabel: "12px" },
        fontWeights: { title: 700, heading: 600, body: 400, bold: 600 },
      },
      branding: { footerTextTemplate: "Confidential Offering Memorandum | {{propertyName}} | Page {{pageNumber}}", coverOverlayStyle: "gradient", headerStyle: "branded" },
      spacing: { defaultSpacingScale: 8, defaultBorderRadius: "4px", cardShadow: "sm", pageMargins: { top: 48, right: 48, bottom: 48, left: 48 } },
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
        fontSizes: { title: "48px", section: "36px", h1: "32px", h2: "24px", h3: "20px", body: "14px", disclaimer: "10px", metricValue: "28px", metricLabel: "12px" },
        fontWeights: { title: 700, heading: 600, body: 400, bold: 600 },
      },
      branding: { footerTextTemplate: "{{propertyName}} | Confidential | Page {{pageNumber}}", coverOverlayStyle: "gradient", headerStyle: "minimal" },
      spacing: { defaultSpacingScale: 8, defaultBorderRadius: "8px", cardShadow: "md", pageMargins: { top: 48, right: 48, bottom: 48, left: 48 } },
    },
    {
      name: "Modern Minimal",
      description: "Clean, minimalist theme with neutral tones",
      isSystemDefault: true,
      isDefault: false,
      baseThemeKey: "modern-minimal",
      colors: {
        primary: "#18181b",
        secondary: "#3f3f46",
        accent: "#a855f7",
        background: "#ffffff",
        surface: "#fafafa",
        text: "#18181b",
        textMuted: "#71717a",
        headerBackground: "#18181b",
        footerBackground: "#27272a",
        metricTileBackground: "#f4f4f5",
        chartSeries: ["#a855f7", "#22d3ee", "#f97316", "#84cc16", "#ef4444"],
        mapOverlay: "rgba(24, 24, 27, 0.6)",
      },
      typography: {
        fontFamilyDisplay: "Inter, system-ui, sans-serif",
        fontFamilyHeading: "Inter, system-ui, sans-serif",
        fontFamilyBody: "Inter, system-ui, sans-serif",
        fontSizes: { title: "42px", section: "32px", h1: "28px", h2: "22px", h3: "18px", body: "14px", disclaimer: "10px", metricValue: "24px", metricLabel: "11px" },
        fontWeights: { title: 600, heading: 500, body: 400, bold: 600 },
      },
      branding: { footerTextTemplate: "{{propertyName}} | Page {{pageNumber}}", coverOverlayStyle: "solid", headerStyle: "none" },
      spacing: { defaultSpacingScale: 8, defaultBorderRadius: "0px", cardShadow: "none", pageMargins: { top: 60, right: 60, bottom: 60, left: 60 } },
    },
  ];

  for (const theme of defaultThemes) {
    const [inserted] = await db.insert(omThemes).values(theme).returning();
    console.log("[OM] Created theme:", inserted.name);
  }

  console.log("[OM] Theme and layout seeding complete");
  process.exit(0);
}

seed().catch(err => {
  console.error("[OM] Seed error:", err);
  process.exit(1);
});
