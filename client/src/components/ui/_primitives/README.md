# UI Primitives

Reusable UI components that are not currently referenced in the application but are available for future use.

## Components in this folder:

| Component | Description |
|-----------|-------------|
| `responsive-table.tsx` | Mobile-responsive table component |
| `bulk-action-bar.tsx` | Floating action bar for bulk operations |
| `feature-highlight.tsx` | Feature callout/highlight component |
| `testimonial-quote.tsx` | Testimonial/quote display component |
| `enhanced-empty-state.tsx` | Enhanced empty state with illustrations |
| `wizard-dialog-shell.tsx` | Multi-step wizard dialog container |

## Usage

Import from this folder when needed:

```tsx
import { ResponsiveTable } from '@/components/ui/_primitives/responsive-table';
import { BulkActionBar } from '@/components/ui/_primitives/bulk-action-bar';
```

When a primitive becomes actively used, consider moving it to the main `components/ui/` folder.
