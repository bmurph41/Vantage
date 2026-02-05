# Accessibility Audit Checklist

**Platform:** Marinalytics  
**Standard:** WCAG 2.1 AA  
**Last Updated:** February 2026

---

## 1. Perceivable

### 1.1 Text Alternatives

- [ ] All `<img>` elements have descriptive `alt` attributes
- [ ] Decorative images use `alt=""` or `role="presentation"`
- [ ] Icon buttons have `aria-label` or visible text
- [ ] SVG icons include `<title>` or `aria-label`
- [ ] Charts and graphs have text descriptions or data tables

### 1.2 Color & Contrast

- [ ] Text meets 4.5:1 contrast ratio against background (normal text)
- [ ] Large text (18px+ or 14px+ bold) meets 3:1 contrast ratio
- [ ] UI components (borders, focus rings) meet 3:1 contrast ratio
- [ ] Information is not conveyed by color alone (e.g., error states also have icons/text)
- [ ] Status indicators use icons + text, not just red/green dots
- [ ] Maritime theme colors pass contrast checks (verify teal/navy on white/dark backgrounds)

### 1.3 Content Structure

- [ ] Pages have a single `<h1>` heading
- [ ] Heading hierarchy is logical (h1 → h2 → h3, no skipped levels)
- [ ] Data tables use `<th>` with `scope` attributes
- [ ] Lists use semantic `<ul>`, `<ol>`, `<dl>` elements
- [ ] Content reads in logical order when CSS is disabled

---

## 2. Operable

### 2.1 Keyboard Navigation

- [ ] All interactive elements are reachable via Tab key
- [ ] Tab order follows visual layout (left→right, top→bottom)
- [ ] Focus is visible on all interactive elements (outline or ring)
- [ ] No keyboard traps (user can always Tab out of any component)
- [ ] Modal dialogs trap focus within the dialog (and release on close)
- [ ] Dropdown menus are navigable with Arrow keys
- [ ] Escape key closes modals, drawers, and dropdowns
- [ ] Enter/Space activates buttons and links
- [ ] Sidebar navigation works fully with keyboard
- [ ] CRM Quick View drawers can be opened/closed via keyboard

### 2.2 Focus Management

- [ ] Focus moves to new content when modals/drawers open
- [ ] Focus returns to trigger element when modals/drawers close
- [ ] Page navigation moves focus to main content area
- [ ] Toast notifications don't steal focus
- [ ] Inline editing components manage focus correctly

### 2.3 Timing

- [ ] No content auto-updates without user control
- [ ] Session timeouts provide warning before logout
- [ ] Animations respect `prefers-reduced-motion` media query
- [ ] Loading states don't auto-dismiss too quickly

---

## 3. Understandable

### 3.1 Forms

- [ ] All form fields have visible `<label>` elements (or `aria-label`)
- [ ] Required fields are indicated (not just by asterisk color)
- [ ] Error messages are associated with fields via `aria-describedby`
- [ ] Error messages explain how to fix the problem
- [ ] Form submissions provide clear success/failure feedback
- [ ] Autocomplete attributes are set on address/name/email fields
- [ ] Multi-step wizards show progress and allow back navigation

### 3.2 Consistent Navigation

- [ ] Sidebar navigation is consistent across all pages
- [ ] Breadcrumbs use `<nav aria-label="Breadcrumb">`
- [ ] Active page/section is indicated in navigation
- [ ] Skip-to-content link is present (first focusable element)

### 3.3 Error Prevention

- [ ] Destructive actions (delete) require confirmation
- [ ] Financial data entry has validation before submission
- [ ] Import operations show preview before committing

---

## 4. Robust

### 4.1 ARIA Usage

- [ ] ARIA roles are used correctly (`role="dialog"`, `role="alert"`, etc.)
- [ ] Live regions (`aria-live="polite"`) announce dynamic content changes
- [ ] `aria-expanded` on collapsible sections (sidebar, accordions)
- [ ] `aria-selected` on tab panels and selectable lists
- [ ] `aria-busy` during loading states
- [ ] `aria-disabled` on non-interactive disabled elements
- [ ] Custom components don't override native semantics unnecessarily

### 4.2 Component-Specific Checks

#### Sidebar Navigation
- [ ] Uses `<nav>` with `aria-label`
- [ ] Collapsible sections have `aria-expanded`
- [ ] Module icons have accessible names
- [ ] Subscription-locked items are indicated accessibly

#### CRM Module
- [ ] Data tables are keyboard-navigable
- [ ] Quick View drawers have `role="dialog"` and `aria-label`
- [ ] Contact/Company cards announce their content
- [ ] Timeline items are in an accessible list

#### Valuator Module
- [ ] Financial input fields have clear labels with units
- [ ] Calculation results are announced to screen readers
- [ ] Charts have alternative text descriptions
- [ ] Dynamic column headers are announced on change

#### Document Builder
- [ ] Template selection is keyboard-accessible
- [ ] Rich text editor provides keyboard shortcuts
- [ ] Export format selection uses proper radio/select patterns

---

## 5. Testing Tools & Procedures

### Automated Testing
- [ ] Run axe DevTools browser extension on every page
- [ ] Run Lighthouse accessibility audit (target: 90+ score)
- [ ] Add `eslint-plugin-jsx-a11y` to catch issues at build time

### Manual Testing
- [ ] Navigate entire app using only keyboard (no mouse)
- [ ] Test with screen reader (VoiceOver on Mac, NVDA on Windows)
- [ ] Test with browser zoom at 200%
- [ ] Test with `prefers-reduced-motion` enabled
- [ ] Test with high contrast mode enabled

### ESLint Configuration

```json
{
  "extends": ["plugin:jsx-a11y/recommended"],
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/anchor-is-valid": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn"
  }
}
```

---

## 6. Quick Wins (Implement First)

1. **Add skip-to-content link** — 15 minutes
2. **Add `aria-label` to sidebar `<nav>`** — 5 minutes  
3. **Add focus styles to all buttons** (check Tailwind `focus-visible:ring-2`) — 30 minutes
4. **Add `alt` text to all images** — 1 hour  
5. **Add `aria-live="polite"` to toast container** — 10 minutes
6. **Add `aria-expanded` to sidebar collapsible sections** — 30 minutes
7. **Add `role="dialog"` to all modals/drawers** — 30 minutes
