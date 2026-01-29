# MM-UI Modal Standard (MM-UI-MODAL-001)

**Version:** 1.0  
**Status:** Active  
**Last Updated:** January 2026

## Purpose

This document establishes the canonical modal design standard for MarinaMatch. All modals in the application MUST conform to this specification to ensure visual consistency, accessibility compliance, and maintainable code.

## Reference Materials

- Style of Modal.mp4 (MarinaMatch modal reference video)
- Style of Modal 2.mp4 (MarinaMatch wizard modal reference video)

## Universal Modal Requirements

### Layout Structure

Every modal MUST follow this layout:

```
┌─────────────────────────────────────────────┐
│  [Icon] Title                          [X]  │
│         Subtitle (optional)                 │
├─────────────────────────────────────────────┤ ← Blue divider line
│                                             │
│              Content Area                   │
│         (scrollable if needed)              │
│                                             │
├─────────────────────────────────────────────┤
│  [Footer Left]           [Footer Right]     │ ← Pinned footer
└─────────────────────────────────────────────┘
```

### Required Features

1. **Overlay**: Semi-transparent dark background (rgba(0,0,0,0.5))
2. **Header**: Icon + Title + optional Subtitle
3. **Close Button**: Top-right X button (dismisses modal)
4. **Blue Divider**: Thick blue line under header (MarinaMatch brand)
5. **Content Area**: Standard padding, scrollable for long content
6. **Pinned Footer**: Never scrolls away, contains action buttons
7. **Focus Trap**: Tab navigation stays within modal
8. **Keyboard Support**: ESC closes modal (unless disabled)

### Size Variants

| Size | Max Width | Use Case |
|------|-----------|----------|
| `sm` | 400px | Simple confirmations |
| `md` | 540px | Single-step forms |
| `lg` | 720px | Complex forms (default) |
| `xl` | 920px | Wizard modals, large content |

### Component Props

```typescript
interface MMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  showClose?: boolean; // default: true
  dismissOnOverlayClick?: boolean; // default: true
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'; // default: 'lg'
  children: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  disableEscClose?: boolean; // default: false
}
```

## Wizard Modal Requirements

Multi-step modals MUST use `MMModalWizard` which extends `MMModal`.

### Additional Features

1. **Progress Indicator**: Dots or steps showing current position
2. **Step Labels**: Clear indication of each step's purpose
3. **Navigation Buttons**: Back/Next in footer
4. **Validation**: Next button disabled until step is valid
5. **Loading State**: Show spinner on final submit

### Wizard Props

```typescript
interface MMModalWizardProps extends MMModalProps {
  steps: Array<{ label: string; title?: string; subtitle?: string }>;
  activeStep: number;
  onBack?: () => void;
  onNext?: () => void;
  isStepValid?: boolean;
  isLoading?: boolean;
  submitLabel?: string; // default: 'Submit'
}
```

## Input Requirements

All form inputs within modals MUST use MM-UI components:

| Component | Use Case |
|-----------|----------|
| `MMInput` | Text, email, phone, currency |
| `MMSelect` | Dropdown selection |
| `MMTextarea` | Multi-line text |
| `MMComboBox` | Searchable/autocomplete |
| `MMRadioCardGroup` | Visual card selection |

### Input Styling Rules

- Background: Light gray fill (#f9fafb)
- Border: Subtle gray (1px solid #e5e7eb)
- Border Radius: 8-12px
- Height: 44-48px (consistent)
- Focus: Blue ring + blue border
- Error: Red border + red ring + error text below
- Placeholder: Muted gray text

## Accessibility Requirements

1. **ARIA Labels**: All interactive elements labeled
2. **Focus Management**: Initial focus on first input
3. **Keyboard Navigation**: Full keyboard support
4. **Screen Reader**: Proper announcements for modal open/close
5. **Color Contrast**: WCAG AA compliant

## Design Tokens

```css
:root {
  --mm-primary: #2563eb;      /* MarinaMatch blue */
  --mm-surface: #ffffff;       /* Modal background */
  --mm-bg: #f9fafb;           /* Input background */
  --mm-muted: #6b7280;        /* Muted text */
  --mm-border: #e5e7eb;       /* Border color */
  --mm-ring: rgba(37,99,235,0.5); /* Focus ring */
  --mm-radius: 12px;          /* Border radius */
  --mm-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  --mm-field-height: 44px;    /* Input height */
}
```

## Folder Structure

```
client/src/components/mm-ui/
├── index.ts              # Exports all components
├── types.ts              # TypeScript types
├── MMModal.tsx           # Base modal
├── MMModalWizard.tsx     # Multi-step wizard
├── MMField.tsx           # Field wrapper (label/error)
├── MMInput.tsx           # Text inputs
├── MMSelect.tsx          # Dropdown
├── MMTextarea.tsx        # Multi-line text
├── MMComboBox.tsx        # Autocomplete
└── MMRadioCardGroup.tsx  # Card selection
```

## Compliance Checklist

Before submitting a modal implementation, verify:

- [ ] Uses `MMModal` or `MMModalWizard` shell
- [ ] Has proper header with icon, title, subtitle
- [ ] Blue divider line present
- [ ] Footer is pinned (doesn't scroll)
- [ ] Uses MM-UI input components
- [ ] Focus trap implemented
- [ ] ESC key closes modal
- [ ] Overlay click closes (unless intentionally disabled)
- [ ] Loading states shown during async operations
- [ ] Validation prevents premature submission
- [ ] Mobile responsive (near-fullscreen on small devices)

## Demo Page

Navigate to `/mm-ui-demo` to see working examples:

1. **3-Step Project Wizard**: Radio card selection → Form fields → Review
2. **New Contact Modal**: 2-column form with validation

## Migration Guide

To update an existing modal to MM standard:

1. Replace `Dialog` with `MMModal`
2. Move content to children prop
3. Update inputs to use `MMInput`, `MMSelect`, etc.
4. Add proper header props (title, subtitle, icon)
5. Move buttons to footer props
6. Test accessibility and keyboard navigation
