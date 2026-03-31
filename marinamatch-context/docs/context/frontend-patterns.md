# MarinaMatch — Frontend Patterns & Conventions

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS + FM Design System v2 (CSS layer for financial components)
- **State:** TanStack Query (server state) + React state (local UI state)
- **Forms:** React Hook Form
- **Icons:** Lucide React
- **Charts:** Recharts
- **Tables:** TanStack Table

---

## Directory Structure

```
client/src/
├── components/
│   ├── ui/                  # Base UI: Button, Input, Modal, etc.
│   ├── marinamatch/         # Feature components
│   │   ├── crm/
│   │   ├── workspace/       # Deal Room / financial model
│   │   ├── marketplace/
│   │   ├── map/
│   │   ├── workflow/
│   │   └── ai-advisor/
│   └── shared/              # Cross-feature: EmptyState, LoadingSpinner, etc.
├── hooks/                   # Custom hooks
├── pages/                   # Top-level route pages
├── lib/
│   ├── api/                 # API client functions
│   ├── utils/               # Pure utility functions
│   └── types/               # Shared TypeScript types
└── styles/
    ├── globals.css
    └── fm-design-system-v2.css
```

---

## FM Design System v2

The Financial Model Design System v2 is a CSS layer applied to all financial model
components. It provides consistent visual treatment for numbers, tables, and charts.

```css
/* Import in financial model components */
@import '@/styles/fm-design-system-v2.css';
```

### Key CSS Classes
```css
.fm-number         /* Right-aligned monospace number */
.fm-number-positive /* Green tint for positive values */
.fm-number-negative /* Red tint for negative values */
.fm-currency       /* Currency formatted number */
.fm-percentage     /* Percentage with % symbol */
.fm-table          /* Financial table base styles */
.fm-table-header   /* Sticky header row */
.fm-section-label  /* Bold section separator row */
.fm-subtotal       /* Subtotal row (light gray bg) */
.fm-total          /* Total row (dark bg, white text) */
.fm-chart-container /* Consistent chart wrapper */
.fm-kpi-chip       /* KPI metric pill */
.fm-assumption     /* Editable assumption field */
```

### Number Formatting in FM Components
Always use the FM formatting utilities, not raw `Intl.NumberFormat`:
```typescript
import { fmCurrency, fmPercent, fmMultiple, fmNumber } from '@/lib/utils/fm-format';

fmCurrency(1234567)    // "$1,234,567"
fmCurrency(1234567, { compact: true })  // "$1.2M"
fmPercent(0.0725)      // "7.25%"
fmMultiple(2.34)       // "2.34x"
fmNumber(42500)        // "42,500"
```

---

## Design Tokens

```typescript
// Brand colors — use CSS variables, not hardcoded hex
// --color-marine-blue:    #0A2342
// --color-maritime-steel: #2E4057
// --color-harbor-teal:    #4ECDC4
// --color-harbor-light:   #E8F4FD
// --color-accent-gold:    #F7C948

// In Tailwind, these map to:
// text-marine-blue, bg-maritime-steel, border-harbor-teal, etc.
```

---

## Component Conventions

### File Naming
```
PascalCase.tsx         for components
camelCase.ts           for utilities and hooks
kebab-case.css         for stylesheets
```

### Component Template
```typescript
import { type FC } from 'react';

interface MyComponentProps {
  // Always define a Props interface
  title: string;
  onAction?: () => void;
}

export const MyComponent: FC<MyComponentProps> = ({ title, onAction }) => {
  return (
    <div className="...">
      {/* component content */}
    </div>
  );
};

// Default export for page-level components, named export for shared components
```

### Always Export Named + Default for Pages
```typescript
// pages/CrmPage.tsx
export const CrmPage = () => { ... };
export default CrmPage;
```

---

## Data Fetching Pattern (TanStack Query)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch list
export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: () => fetch('/api/marinamatch/crm/deals').then(r => r.json()),
  });
}

// Fetch single
export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deals', id],
    queryFn: () => fetch(`/api/marinamatch/crm/deals/${id}`).then(r => r.json()),
    enabled: !!id,
  });
}

// Mutation with cache invalidation
export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Deal> }) =>
      fetch(`/api/marinamatch/crm/deals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deals', id] });
    },
  });
}
```

---

## Key Custom Hooks

### useWizardDraft
Persists wizard state across sessions via localStorage + debounced server sync.
```typescript
const { draftData, updateDraft, clearDraft } = useWizardDraft('create-deal');
// draftData — current draft state
// updateDraft(partial) — merge partial update into draft
// clearDraft() — clear on submit or discard
```

### useEntitlements
```typescript
const { hasFeature, tier, isLoading } = useEntitlements();
```

### useDebounce
```typescript
import { useDebounce } from '@/hooks/useDebounce';
const debouncedSearch = useDebounce(searchQuery, 300);
```

---

## Form Pattern (React Hook Form)

```typescript
import { useForm } from 'react-hook-form';

interface DealFormData {
  name: string;
  dealValue: number;
  stageId: string;
}

export function DealForm({ onSubmit }: { onSubmit: (data: DealFormData) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DealFormData>();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('name', { required: 'Deal name is required' })}
        placeholder="Deal name"
      />
      {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Deal'}
      </button>
    </form>
  );
}
```

**Never use HTML `<form>` submit without React Hook Form or an explicit `e.preventDefault()`.**

---

## Empty State Pattern

All data views must have an empty state. Never show blank white space.

```typescript
import { EmptyState } from '@/components/shared/EmptyState';

// In list/table components:
if (!data || data.length === 0) {
  return (
    <EmptyState
      icon={<FolderOpen className="h-8 w-8" />}
      title="No deals yet"
      description="Add your first deal to get started."
      action={
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" /> Add Deal
        </Button>
      }
    />
  );
}
```

---

## Loading State Pattern

```typescript
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

if (isLoading) {
  return (
    <div className="flex items-center justify-center h-48">
      <LoadingSpinner size="lg" />
    </div>
  );
}
```

---

## Error State Pattern

```typescript
if (error) {
  return (
    <ErrorState
      message="Failed to load deals"
      onRetry={() => refetch()}
    />
  );
}
```

---

## TypeScript Rules

- **Always type component props** with an interface, never `any`
- **Never suppress TS errors** with `// @ts-ignore` — fix the type instead
- **Use `type` for unions/intersections**, `interface` for object shapes
- Run `npx tsc --noEmit` before committing or restarting server

```typescript
// Good — explicit types
const deals: Deal[] = data ?? [];
const handler = (e: React.ChangeEvent<HTMLInputElement>) => { ... };

// Bad — implicit any
const deals = data;
const handler = (e) => { ... };
```

---

## Navigation & Routing

```typescript
// Sidebar navigation hierarchy (consolidated):
CRM
  └─ Contacts, Companies, Deals, Tasks, Activity Log

Deal Room (workspace — linked from deal record)
  └─ Overview, Financial Model, Documents, Comparables, Investment Materials

Marketplace
Marina Map
Workflow Automation
AI Advisor
Settings
```

**"Pipeline" is not a top-level nav item** — it lives inside CRM > Deals (Kanban view).
**"Deal Workspace" is now "Deal Room"** — update any reference to the old name.

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---|---|
| `console.log` with tagged template literal in upload handlers | Use regular string concatenation |
| Hardcoding colors instead of CSS variables | Use `var(--color-marine-blue)` or Tailwind tokens |
| Using Recharts without `ResponsiveContainer` | Always wrap charts in `<ResponsiveContainer width="100%" height={300}>` |
| Missing `key` props in lists | Every mapped element needs a unique `key` |
| Direct DOM manipulation | Use React state and refs |
| `useEffect` with missing dependencies | Complete the deps array or document why it's intentionally excluded |
