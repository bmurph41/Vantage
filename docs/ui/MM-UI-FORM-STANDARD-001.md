# MM-UI Form & Component Standard (MM-UI-FORM-STANDARD-001)

**Version:** 1.0  
**Status:** Active  
**Last Updated:** January 2026

## Purpose

This document extends the modal standard to define universal UI patterns for all form elements, interactive components, and common UI patterns across MarinaMatch.

## Input Components

### MMInput

Standard text input with variants for common types.

```tsx
import { MMInput, MMEmailInput, MMPhoneInput, MMCurrencyInput } from '@/components/mm-ui';

// Basic
<MMInput label="Project Name" placeholder="Enter name..." required />

// Email variant
<MMEmailInput label="Email Address" />

// Phone variant  
<MMPhoneInput label="Phone Number" />

// Currency variant
<MMCurrencyInput label="Price" currency="$" />

// With icons
<MMInput label="Search" leftIcon={<SearchIcon />} />
```

### MMSelect

Dropdown selection with consistent styling.

```tsx
import { MMSelect, MMStateSelect } from '@/components/mm-ui';

<MMSelect
  label="Category"
  placeholder="Select..."
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]}
  required
/>

// Pre-built state selector
<MMStateSelect label="State" />
```

### MMTextarea

Multi-line text input.

```tsx
<MMTextarea
  label="Notes"
  placeholder="Enter notes..."
  rows={4}
  maxLength={500}
  showCharCount
/>
```

### MMComboBox

Searchable autocomplete input.

```tsx
<MMComboBox
  label="Company"
  placeholder="Search companies..."
  options={companies}
  onSearch={handleSearch}
  loading={isSearching}
/>
```

### MMRadioCardGroup

Visual card selection for step-based workflows.

```tsx
<MMRadioCardGroup
  label="Select Project Type"
  options={[
    { value: 'acquisition', label: 'Acquisition', icon: <Building />, description: 'Buy a marina' },
    { value: 'disposition', label: 'Disposition', icon: <DollarSign />, description: 'Sell a marina' },
  ]}
  value={selected}
  onChange={setSelected}
/>
```

## Form Layouts

### Single Column (Default)

```tsx
<div className="mm-form-stack">
  <MMInput label="Name" />
  <MMInput label="Email" />
  <MMTextarea label="Notes" />
</div>
```

### Two Column Grid

```tsx
<MMFormGrid cols={2}>
  <MMInput label="First Name" />
  <MMInput label="Last Name" />
  <MMInput label="City" />
  <MMStateSelect label="State" />
</MMFormGrid>
```

### Three Column Grid

```tsx
<MMFormGrid cols={3}>
  <MMInput label="City" />
  <MMStateSelect label="State" />
  <MMInput label="Zip Code" />
</MMFormGrid>
```

## Button Hierarchy

### Primary Button
Main action, one per view.
```tsx
<button className="mm-btn mm-btn-primary">Save Project</button>
```

### Secondary Button
Secondary actions.
```tsx
<button className="mm-btn mm-btn-secondary">Cancel</button>
```

### Danger Button
Destructive actions (delete, remove).
```tsx
<button className="mm-btn mm-btn-danger">Delete</button>
```

### Ghost Button
Tertiary/link-style actions.
```tsx
<button className="mm-btn mm-btn-ghost">Learn More</button>
```

### Icon Button
Icon-only actions.
```tsx
<button className="mm-btn mm-btn-icon"><TrashIcon /></button>
```

## Common Patterns

### Inline Filters (Chip/Tags)

```tsx
<div className="mm-filter-chips">
  <button className="mm-chip mm-chip-active">All</button>
  <button className="mm-chip">Active</button>
  <button className="mm-chip">Pending</button>
</div>
```

### Search Bar

```tsx
<MMInput
  placeholder="Search..."
  leftIcon={<SearchIcon />}
  rightIcon={query && <ClearIcon onClick={clear} />}
  className="mm-search-bar"
/>
```

### Table Filter Row

```tsx
<div className="mm-table-filters">
  <MMInput placeholder="Search..." leftIcon={<SearchIcon />} />
  <MMSelect placeholder="Status" options={statusOptions} />
  <MMSelect placeholder="Date Range" options={dateOptions} />
  <button className="mm-btn mm-btn-secondary">Reset</button>
</div>
```

### Toast Notifications

```tsx
// Success
toast.success("Project saved successfully");

// Error
toast.error("Failed to save project");

// Warning
toast.warning("Unsaved changes will be lost");

// Info
toast.info("New features available");
```

### Empty States

```tsx
<div className="mm-empty-state">
  <FolderIcon className="mm-empty-icon" />
  <h3>No projects yet</h3>
  <p>Create your first project to get started</p>
  <button className="mm-btn mm-btn-primary">Create Project</button>
</div>
```

### Loading Skeletons

```tsx
// Table skeleton
<MMSkeletonTable rows={5} cols={4} />

// Card skeleton
<MMSkeletonCard />

// Form skeleton
<MMSkeletonForm fields={3} />
```

### Confirmation Dialogs

```tsx
<MMModal
  open={confirmOpen}
  onOpenChange={setConfirmOpen}
  title="Delete Project?"
  subtitle="This action cannot be undone"
  icon={<AlertTriangle />}
  size="sm"
  footerLeft={<button className="mm-btn mm-btn-secondary">Cancel</button>}
  footerRight={<button className="mm-btn mm-btn-danger">Delete</button>}
>
  <p>Are you sure you want to delete "Marina Bay Project"?</p>
</MMModal>
```

## Do's and Don'ts

### DO

- Use MM-UI components for all new modals and forms
- Maintain consistent spacing (16px/24px grid)
- Show loading states during async operations
- Provide clear validation messages
- Use appropriate button hierarchy
- Test on mobile devices

### DON'T

- Create one-off modal styles
- Use different input styles in different modals
- Skip loading states on buttons
- Use multiple primary buttons in one view
- Hard-code colors instead of using tokens
- Forget accessibility (labels, focus, keyboard)

## Component Expansion Roadmap

Future MM-UI components to be added:

| Component | Status | Description |
|-----------|--------|-------------|
| `MMDatePicker` | Planned | Date selection |
| `MMTimePicker` | Planned | Time selection |
| `MMFileUpload` | Planned | Drag-drop file upload |
| `MMToggle` | Planned | On/off switch |
| `MMSlider` | Planned | Range slider |
| `MMTabs` | Planned | Tab navigation |
| `MMAccordion` | Planned | Collapsible sections |
| `MMTooltip` | Planned | Hover tooltips |
| `MMPopover` | Planned | Click popovers |
| `MMDrawer` | Planned | Side panel drawer |

## Styling Guidelines

### Spacing Scale

```
4px   - xs (tight spacing)
8px   - sm (element gaps)
16px  - md (section spacing)
24px  - lg (major sections)
32px  - xl (page sections)
```

### Typography

```
Headings: font-semibold
Labels: font-medium text-sm
Body: font-normal
Muted: text-muted-foreground
```

### Colors

Always use CSS variables:
```css
color: var(--mm-primary);
background: var(--mm-bg);
border-color: var(--mm-border);
```

## Mobile Responsiveness

All MM-UI components MUST be mobile responsive:

1. **Modals**: Near-fullscreen on small devices
2. **Grids**: Collapse to single column on mobile
3. **Buttons**: Full-width on mobile
4. **Touch Targets**: Minimum 44x44px
5. **Footer**: Remains pinned and accessible
