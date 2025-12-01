# Marina Management Platform - Design Guidelines

## Design Approach

**Reference-Based**: Drawing from Airbnb's premium booking experience + Notion's operational efficiency. Nautical theme through subtle maritime accents, not literal anchors/ropes everywhere. Professional and sophisticated, not kitschy.

## Typography Hierarchy

**Font Families** (Google Fonts):
- Primary: Inter (clean, professional) - headings, UI elements
- Secondary: Lora (elegant serif) - premium content, testimonials

**Scale**:
- Hero Headlines: text-5xl to text-7xl, font-bold
- Section Headers: text-3xl to text-4xl, font-semibold
- Subheadings: text-xl to text-2xl, font-medium
- Body: text-base, font-normal
- UI Labels: text-sm, font-medium
- Captions: text-xs

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20
- Component padding: p-4, p-6, p-8
- Section spacing: py-16, py-20, py-24
- Grid gaps: gap-4, gap-6, gap-8

**Containers**: max-w-7xl for content sections, max-w-6xl for forms/dashboards

## Component Architecture

### Customer Portal (Public Booking)

**Hero Section** (100vh):
- Full-width premium marina photography (sunset/boats/docks)
- Centered booking card overlay with blur backdrop (backdrop-blur-xl)
- Search inputs: Marina/Date/Boat Size with prominent "Search Availability" CTA
- Subtle wave pattern overlay at bottom edge

**Availability Grid**:
- Card-based slip listings (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Each card: slip photo, location, amenities icons, price, availability badge
- Hover state: slight scale transform, shadow elevation

**Booking Flow**:
- Multi-step form with progress indicator
- Sections: Slip Selection → Boat Details → Services/Amenities → Payment
- Summary sidebar (sticky on desktop) showing live pricing breakdown

**Trust Elements Section**:
- Premium marina photos in 2-column grid
- Testimonials with boat owner photos (2-column)
- Certifications/safety badges row

### Staff Dashboard

**Navigation**:
- Left sidebar (w-64) with icon+label menu items
- Sections: Overview, Slips, Bookings, Launch Schedule, Customers, Reports
- Collapsible on mobile

**Dashboard Widgets** (grid-cols-1 md:grid-cols-2 lg:grid-cols-4):
- Stat cards: Occupancy Rate, Pending Bookings, Revenue Today, Maintenance Alerts
- Each card: large number, trend indicator, sparkline chart

**Slip Management View**:
- Interactive dock map visualization (visual grid showing slip status)
- Color-coded: Available/Reserved/Occupied/Maintenance
- Side panel: Selected slip details, quick actions

**Calendar Views**:
- Full calendar for launch scheduling
- Drag-drop booking cards
- Color-coded by booking type/status
- Day/Week/Month toggle

**Tables**:
- Sortable/filterable booking tables
- Row actions: View, Edit, Cancel, Message Customer
- Inline status badges

## Icons

**Heroicons** (via CDN) for all UI elements:
- Navigation: home, calendar, map, users, chart-bar
- Actions: plus, pencil, trash, check, x-mark
- Status: check-circle, exclamation-triangle, clock

## Images

**Photography Style**: Professional marina shots - golden hour lighting, clean boats, calm water

**Placements**:
1. **Hero**: Large panoramic marina/dock view (1920x1080 minimum)
2. **Features Section**: 3-4 detail shots (modern amenities, security, facilities)
3. **Trust/Premium Section**: Luxury boats at dock, aerial marina view
4. **Staff Dashboard**: Background pattern or subtle maritime texture
5. **Testimonials**: Authentic boat owner portraits

**Treatment**: Slight blue/teal color grading for cohesive nautical feel

## Animations

**Minimal & Purposeful**:
- Smooth page transitions (300ms ease)
- Card hover lifts (transform scale-105)
- Loading skeletons for data fetch
- Toast notifications slide-in

## Unique Design Elements

**Nautical Accents** (subtle):
- Wave pattern SVG dividers between sections
- Rope-texture borders on premium elements (1px, low opacity)
- Compass rose icon as loading indicator
- Tide/weather widget in dashboard header

**Status Indicators**:
- Availability: Green dot (available), Yellow (reserved), Red (occupied), Gray (maintenance)
- Booking status: Color-coded badges with icons

**Forms**:
- Generous spacing (gap-6)
- Floating labels on focus
- Inline validation with icons
- Date/time pickers with maritime blue accent

**Buttons on Images**: Backdrop blur (backdrop-blur-lg bg-white/20) with white text, no additional hover states needed

This design balances premium customer experience with operational efficiency, using clean modern layouts enhanced by strategic nautical theming rather than overwhelming maritime clichés.