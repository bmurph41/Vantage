# Ship Store - Enterprise Retail Management Design Guidelines

## Design Approach: Carbon Design System (Enterprise Data Applications)
**Justification:** Financial modeling and analytics dashboard requiring sophisticated data visualization, professional credibility, and information-dense layouts. Carbon excels at enterprise applications with complex data structures.

**Core Principles:** Precision, clarity, data-first hierarchy, professional restraint

---

## Typography System

**Primary Font:** IBM Plex Sans (via Google Fonts CDN)
- Headings: 600 weight, tight letter-spacing (-0.02em)
- Dashboard titles: 24px (1.5rem)
- Card headers: 18px (1.125rem)
- Body text: 400 weight, 14px (0.875rem)
- Data labels: 500 weight, 12px (0.75rem)
- Financial figures: IBM Plex Mono, 500 weight for tabular alignment

**Secondary Font:** IBM Plex Mono for all numerical data, timestamps, financial metrics

---

## Layout System

**Spacing Units:** Tailwind 2, 4, 6, 8, 12 units exclusively
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- Dashboard grid gutters: gap-4

**Grid Structure:**
- Dashboard: 12-column grid (grid-cols-12)
- Main content area: 8-9 columns, sidebar: 3-4 columns
- Financial cards: 3-4 column grid on desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Data tables: Full-width with fixed column widths

---

## Component Library

### Navigation
**Top Navigation Bar:**
- Fixed header with subtle border-bottom
- Company logo left, user profile/settings right
- Global search with keyboard shortcut display (⌘K)
- Notification bell with unread count badge
- Height: 64px (h-16)

**Left Sidebar:**
- Width: 240px (w-60), collapsible to icon-only 64px
- Hierarchical menu with active state indicators
- Icons from Heroicons (via CDN)
- Sections: Dashboard, Financial Models, Analytics, Store Operations, Reports, Settings

### Dashboard Cards
**Metric Cards (KPI Display):**
- Compact height: 120px with p-6
- Metric value: Large (text-3xl), metric label below (text-sm)
- Trend indicator: Arrow icon + percentage change
- Sparkline chart (mini line graph) showing 7-day trend

**Financial Model Cards:**
- Larger canvas: min-h-96
- Header with model name + last updated timestamp
- Chart.js integration for line/area charts
- Interactive legend with data point toggles
- Export button (CSV/PDF) in header

### Data Tables
**Structure:**
- Sticky header row with sort indicators
- Alternating row backgrounds (subtle zebra striping)
- Right-aligned numerical columns
- Left-aligned text columns
- Row actions on hover (edit, delete icons)
- Pagination footer with rows-per-page selector

### Forms (Financial Inputs)
**Layout:**
- Two-column grid for form fields (grid-cols-2 gap-6)
- Full-width for complex inputs (projections, notes)
- Label above input, helper text below
- Required field indicators (*)
- Validation states with inline error messages
- Section dividers with descriptive headers

**Input Types:**
- Text inputs: h-10 with subtle borders
- Number inputs: Monospace font, right-aligned
- Date pickers: Calendar dropdown with range selection
- Dropdowns: Searchable with keyboard navigation
- File uploads: Drag-drop zone with progress indicator

### Charts & Visualizations
**Chart Types:**
- Line charts: Revenue projections, trend analysis
- Bar charts: Comparative metrics, period-over-period
- Donut charts: Portfolio allocation, category breakdown
- Heatmaps: Performance matrices

**Chart Specifications:**
- Use Chart.js library (via CDN)
- Axis labels: 11px, gray text
- Grid lines: Subtle, low opacity
- Tooltips: On hover with precise values
- Legend: Horizontal below chart, clickable to toggle series

---

## Page Layouts

### Main Dashboard
- 3-row structure:
  - Row 1: 4 KPI metric cards (grid-cols-4)
  - Row 2: 2 large charts side-by-side (grid-cols-2)
  - Row 3: Recent transactions table + activity feed (grid-cols-3, 2:1 ratio)

### Financial Modeling Interface
- Split view: Model configuration form (left 40%) + live chart preview (right 60%)
- Tabbed interface for multiple scenarios
- Floating action button for "Run Model" with loading state

### Analytics Dashboard
- Filter bar at top with date range, store selector, category filters
- 2-column metric grid (6 cards total)
- Full-width time-series chart below
- Comparison table at bottom

---

## Interactions & States

**Loading States:**
- Skeleton screens for data tables (pulsing gray blocks)
- Spinner overlays for charts during data fetch
- Progress bars for file uploads

**Interactive Elements:**
- Hover: Subtle background lightening, no dramatic transitions
- Active: Slight scale down (scale-98)
- Focus: 2px outline with offset
- Disabled: 50% opacity, cursor-not-allowed

**Animations:** Minimal - data updates fade in (150ms), modals scale-fade (200ms)

---

## Images Section

**No hero image required** - This is an enterprise application, not a marketing site.

**Dashboard Icons:** Use Heroicons "outline" variant throughout (chart-bar, currency-dollar, trending-up, users, cog)

**Empty States:** Use simple illustrative SVG icons (not photographs) with gray tones for empty tables/charts - obtain from unDraw or similar illustration libraries