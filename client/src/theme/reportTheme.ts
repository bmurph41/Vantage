// Professional Offering Memorandum Design System
// Inspired by CBRE, Marcus & Millichap standards

export const reportTheme = {
  // Color Palette - Neutral with configurable accent
  colors: {
    // Primary neutrals (gray/sand base)
    neutral: {
      50: '#fafaf9',
      100: '#f5f5f4', 
      200: '#e7e5e4',
      300: '#d6d3d1',
      400: '#a8a29e',
      500: '#78716c',
      600: '#57534e',
      700: '#44403c',
      800: '#292524',
      900: '#1c1917',
      950: '#0c0a09',
    },
    
    // Configurable accent colors
    accent: {
      emerald: {
        50: '#ecfdf5',
        100: '#d1fae5',
        200: '#a7f3d0',
        300: '#6ee7b7',
        400: '#34d399',
        500: '#10b981',
        600: '#059669',
        700: '#047857',
        800: '#065f46',
        900: '#064e3b',
        950: '#022c22',
      },
      blue: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
        950: '#172554',
      },
    },
    
    // Semantic colors
    semantic: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    
    // Print-optimized colors
    print: {
      black: '#000000',
      darkGray: '#374151',
      mediumGray: '#6b7280',
      lightGray: '#d1d5db',
      background: '#ffffff',
    },
  },
  
  // Typography System
  typography: {
    // Font families
    fonts: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      serif: ['IBM Plex Serif', 'ui-serif', 'Georgia', 'serif'],
      mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
    },
    
    // Type scale (modular scale 1.25 - Major Third)
    scale: {
      xs: '0.75rem',     // 12px
      sm: '0.875rem',    // 14px  
      base: '1rem',      // 16px
      lg: '1.125rem',    // 18px
      xl: '1.25rem',     // 20px
      '2xl': '1.5rem',   // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
      '5xl': '3rem',     // 48px
      '6xl': '3.75rem',  // 60px
    },
    
    // Font weights
    weights: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    
    // Line heights
    leading: {
      none: '1',
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },
    
    // Letter spacing
    tracking: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0em',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
  },
  
  // Spacing System (8px baseline grid)
  spacing: {
    px: '1px',
    0: '0px',
    0.5: '2px',   // 0.125rem
    1: '4px',     // 0.25rem
    1.5: '6px',   // 0.375rem
    2: '8px',     // 0.5rem
    2.5: '10px',  // 0.625rem
    3: '12px',    // 0.75rem
    3.5: '14px',  // 0.875rem
    4: '16px',    // 1rem
    5: '20px',    // 1.25rem
    6: '24px',    // 1.5rem
    7: '28px',    // 1.75rem
    8: '32px',    // 2rem
    9: '36px',    // 2.25rem
    10: '40px',   // 2.5rem
    11: '44px',   // 2.75rem
    12: '48px',   // 3rem
    14: '56px',   // 3.5rem
    16: '64px',   // 4rem
    20: '80px',   // 5rem
    24: '96px',   // 6rem
    28: '112px',  // 7rem
    32: '128px',  // 8rem
    36: '144px',  // 9rem
    40: '160px',  // 10rem
    44: '176px',  // 11rem
    48: '192px',  // 12rem
    52: '208px',  // 13rem
    56: '224px',  // 14rem
    60: '240px',  // 15rem
    64: '256px',  // 16rem
    72: '288px',  // 18rem
    80: '320px',  // 20rem
    96: '384px',  // 24rem
  },
  
  // Layout System
  layout: {
    // Page constraints
    page: {
      letter: {
        width: '8.5in',
        height: '11in',
        maxWidth: '816px',
      },
      a4: {
        width: '210mm',
        height: '297mm', 
        maxWidth: '840px',
      },
    },
    
    // Container sizes
    container: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      report: '840px',
    },
    
    // Grid system
    grid: {
      cols2: 'repeat(2, 1fr)',
      cols3: 'repeat(3, 1fr)',
      cols4: 'repeat(4, 1fr)',
      cols12: 'repeat(12, 1fr)',
    },
    
    // Common aspect ratios
    aspectRatio: {
      square: '1 / 1',
      video: '16 / 9',
      photo: '4 / 3',
      portrait: '3 / 4',
      golden: '1.618 / 1',
    },
  },
  
  // Border Radius
  borderRadius: {
    none: '0px',
    sm: '2px',
    base: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    '2xl': '16px',
    '3xl': '24px',
    full: '9999px',
  },
  
  // Box Shadows
  shadows: {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    none: '0 0 #0000',
  },
  
  // Animation & Transitions
  animation: {
    duration: {
      75: '75ms',
      100: '100ms',
      150: '150ms',
      200: '200ms',
      300: '300ms',
      500: '500ms',
      700: '700ms',
      1000: '1000ms',
    },
    
    timing: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  
  // Z-Index Scale
  zIndex: {
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
    auto: 'auto',
  },
  
  // Breakpoints for responsive design
  screens: {
    xs: '475px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
    print: { raw: 'print' },
  },
} as const;

// Type exports for TypeScript
export type ReportTheme = typeof reportTheme;
export type AccentColor = keyof typeof reportTheme.colors.accent;

// Helper functions for theme usage
export const getAccentColor = (accent: AccentColor = 'emerald', shade: keyof typeof reportTheme.colors.accent.emerald = 600) => {
  return reportTheme.colors.accent[accent][shade];
};

export const getSpacing = (size: keyof typeof reportTheme.spacing) => {
  return reportTheme.spacing[size];
};

export const getTypographyClass = (size: keyof typeof reportTheme.typography.scale, weight?: keyof typeof reportTheme.typography.weights) => {
  const weightClass = weight ? `font-${weight}` : '';
  return `text-${size} ${weightClass}`.trim();
};

// CSS Custom Properties generator for dynamic theming
export const generateCSSCustomProperties = (accent: AccentColor = 'emerald') => {
  const accentColors = reportTheme.colors.accent[accent];
  
  return {
    '--report-accent-50': accentColors[50],
    '--report-accent-100': accentColors[100],
    '--report-accent-200': accentColors[200],
    '--report-accent-300': accentColors[300],
    '--report-accent-400': accentColors[400],
    '--report-accent-500': accentColors[500],
    '--report-accent-600': accentColors[600],
    '--report-accent-700': accentColors[700],
    '--report-accent-800': accentColors[800],
    '--report-accent-900': accentColors[900],
    '--report-accent-950': accentColors[950],
  };
};

export default reportTheme;