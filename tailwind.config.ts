import type { Config } from "tailwindcss";
import { reportTheme } from "./client/src/theme/reportTheme";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // Report theme colors
        neutral: reportTheme.colors.neutral,
        emerald: reportTheme.colors.accent.emerald,
        blue: reportTheme.colors.accent.blue,
        report: {
          black: reportTheme.colors.print.black,
          darkGray: reportTheme.colors.print.darkGray,
          mediumGray: reportTheme.colors.print.mediumGray,
          lightGray: reportTheme.colors.print.lightGray,
          background: reportTheme.colors.print.background,
          success: reportTheme.colors.semantic.success,
          warning: reportTheme.colors.semantic.warning,
          error: reportTheme.colors.semantic.error,
          info: reportTheme.colors.semantic.info,
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
        // Report-specific fonts
        'report-sans': [...reportTheme.typography.fonts.sans],
        'report-serif': [...reportTheme.typography.fonts.serif],
        'report-mono': [...reportTheme.typography.fonts.mono],
      },
      // Extended spacing for reports
      spacing: {
        ...reportTheme.spacing,
        // Report-specific measurements
        'page-letter-w': '8.5in',
        'page-letter-h': '11in',
        'page-a4-w': '210mm',
        'page-a4-h': '297mm',
        'container-report': '840px',
      },
      // Report-specific max widths
      maxWidth: {
        'report': '840px',
        'page-letter': '816px',
        'page-a4': '794px',
      },
      // Typography scale
      fontSize: reportTheme.typography.scale,
      fontWeight: reportTheme.typography.weights,
      lineHeight: reportTheme.typography.leading,
      letterSpacing: reportTheme.typography.tracking,
      // Aspect ratios for report images
      aspectRatio: reportTheme.layout.aspectRatio,
      // Report-specific breakpoints
      screens: {
        ...reportTheme.screens,
      },
      // Box shadows for reports
      boxShadow: reportTheme.shadows,
      // Z-index scale
      zIndex: reportTheme.zIndex,
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Report-specific animations
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      // Print-specific utilities
      printColorAdjust: {
        exact: 'exact',
        economy: 'economy',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"), 
    require("@tailwindcss/typography"),
    // Custom report utilities plugin
    function({ addUtilities, theme }) {
      const newUtilities = {
        // Page break utilities
        '.pb-break': {
          'page-break-before': 'always',
          'break-before': 'page',
        },
        '.pb-break-after': {
          'page-break-after': 'always',
          'break-after': 'page',
        },
        '.no-break': {
          'page-break-inside': 'avoid',
          'break-inside': 'avoid',
        },
        '.keep-with-next': {
          'page-break-after': 'avoid',
          'break-after': 'avoid',
        },
        
        // Print-specific utilities
        '.print-exact': {
          'print-color-adjust': 'exact',
          '-webkit-print-color-adjust': 'exact',
        },
        '.print-economy': {
          'print-color-adjust': 'economy',
          '-webkit-print-color-adjust': 'economy',
        },
        
        // Typography utilities
        '.tabular-nums': {
          'font-variant-numeric': 'tabular-nums',
        },
        '.text-right-num': {
          'text-align': 'right',
          'font-variant-numeric': 'tabular-nums',
        },
        
        // Layout utilities for reports
        '.report-container': {
          'max-width': '840px',
          'margin': '0 auto',
          'padding': '0 1rem',
        },
        '.report-grid-2': {
          'display': 'grid',
          'grid-template-columns': 'repeat(2, 1fr)',
          'gap': '1.5rem',
        },
        '.report-grid-3': {
          'display': 'grid',
          'grid-template-columns': 'repeat(3, 1fr)',
          'gap': '1rem',
        },
        
        // Table utilities
        '.table-fixed-layout': {
          'table-layout': 'fixed',
          'width': '100%',
        },
        '.table-zebra': {
          '& tbody tr:nth-child(even)': {
            'background-color': theme('colors.neutral.50'),
          },
        },
        '.table-sticky-header': {
          '& thead th': {
            'position': 'sticky',
            'top': '0',
            'background-color': theme('colors.neutral.100'),
            'z-index': '10',
          },
        },
      };
      
      addUtilities(newUtilities);
    },
  ],
} satisfies Config;
