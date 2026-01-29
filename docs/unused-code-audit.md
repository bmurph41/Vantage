# Unused Code Audit - January 2026

## Classification Summary

### DELETE - Confirmed Dead Code
These components have no imports anywhere in the codebase:

| File | Component | Status | Reason |
|------|-----------|--------|--------|
| `components/calendar/calendar-sync-button.tsx` | CalendarSyncButton | DELETE | No imports found |
| `components/vdr/DuplicateDetector.tsx` | DuplicateDetector | DELETE | No imports found |

### KEEP - UI Primitives (Move to _primitives)
Reusable UI components that may be used in future development:

| File | Component | Status | Action |
|------|-----------|--------|--------|
| `components/ui/responsive-table.tsx` | ResponsiveTable | KEEP | Move to _primitives |
| `components/ui/bulk-action-bar.tsx` | BulkActionBar | KEEP | Move to _primitives |
| `components/ui/feature-highlight.tsx` | FeatureHighlight | KEEP | Move to _primitives |
| `components/ui/testimonial-quote.tsx` | TestimonialQuote | KEEP | Move to _primitives |
| `components/ui/enhanced-empty-state.tsx` | EnhancedEmptyState | KEEP | Move to _primitives |
| `components/ui/wizard-dialog-shell.tsx` | WizardDialogShell | KEEP | Move to _primitives |

### DEFER/WIP - CRM Experimental Panels (Move to _wip)
Feature panels aligned with roadmap but not yet integrated:

| File | Component | Status | Action |
|------|-----------|--------|--------|
| `components/crm/smart-search.tsx` | SmartSearch | WIP | Move to _wip |
| `components/crm/StageTemplateEditor.tsx` | StageTemplateEditor | WIP | Move to _wip |
| `components/crm/CrmListsManager.tsx` | CrmListsManager | WIP | Move to _wip |
| `components/crm/related-entities-panel.tsx` | RelatedEntitiesPanel | WIP | Move to _wip |
| `components/crm/deal-playbook-panel.tsx` | DealPlaybookPanel | WIP | Move to _wip |
| `components/crm/pipeline-forecasting-panel.tsx` | PipelineForecastingPanel | WIP | Move to _wip |
| `components/crm/phase-gates-panel.tsx` | PhaseGatesPanel | WIP | Move to _wip |
| `components/crm/red-flags-panel.tsx` | RedFlagsPanel | WIP | Move to _wip |
| `components/crm/sla-tracking-panel.tsx` | SlaTrackingPanel | WIP | Move to _wip |
| `components/crm/comment-threads-panel.tsx` | CommentThreadsPanel | WIP | Move to _wip |
| `components/crm/DealMetricsDashboard.tsx` | DealMetricsDashboard | WIP | Move to _wip |
| `components/crm/PropertyStatusPanel.tsx` | PropertyStatusPanel | WIP | Move to _wip |

### FALSE POSITIVES - Actually Used
| File | Component | Status | Where Used |
|------|-----------|--------|------------|
| `components/analytics/unified-analytics-panel.tsx` | UnifiedAnalyticsPanel | KEEP | `pages/analytics.tsx` |

## Console Logs to Remove

| File | Line | Type | Action |
|------|------|------|--------|
| `components/doc-intel/PLReviewGrid.tsx` | 236-245 | console.log (5x) | REMOVE |
| `contexts/SettingsContext.tsx` | 137 | console.log | REMOVE |

## TODOs Requiring Action
See `docs/todos.md` for tracked work items.
