# TODO Tracking - January 2026

This document tracks all TODOs in the codebase and their priority/status.

## High Priority (Bugs/Missing Core Features)

| Location | TODO | Category | Priority |
|----------|------|----------|----------|
| `components/modals/week-prospecting-modal.tsx:1136-1138` | Use actual user ID and prospecting entry ID instead of 'temp-user'/'temp-entry' | Bug | HIGH |
| `pages/analysis/sales-comps/Index.tsx:31` | Replace with actual MarinaMatch auth | Missing Integration | HIGH |
| `pages/analysis/projects/Report.tsx:23,28` | Fetch report data and get user from auth context | Missing Integration | HIGH |
| `pages/analysis/rate-comps/Detail.tsx:28,32` | Implement data fetching and auth context | Missing Integration | HIGH |

## Medium Priority (Planned Features)

| Location | TODO | Category | Priority |
|----------|------|----------|----------|
| `components/modals/contact-form-modal.tsx:159` | Load from contact's assigned deals when backend supports | Planned Feature | MEDIUM |
| `components/document-builder/MediaUploadPanel.tsx:318` | Implement actual upload to asset storage | Planned Feature | MEDIUM |
| `components/project-header.tsx:30` | Enable when risk API endpoints are implemented | Planned Feature | MEDIUM |

## Low Priority (Future Enhancements)

| Location | TODO | Category | Priority |
|----------|------|----------|----------|
| `components/contact-management.tsx:19,31,358` | Future CRM Integration Framework and search | Nice-to-have | LOW |
| `pages/analysis/sales-comps/BulkEdit.tsx:1` | Missing SalesComps-specific utilities | Nice-to-have | LOW |
| `pages/analysis/projects/Report.tsx:1` | Missing SalesComps-specific components | Nice-to-have | LOW |

## Resolution Status

- [ ] HIGH priority items should be converted to tickets
- [ ] MEDIUM priority items should be tracked in backlog
- [ ] LOW priority items can remain as TODOs with explicit context

## Notes

TODOs using placeholder values like 'temp-user' or 'temp-entry' should be replaced with properly typed placeholders that make the incomplete status explicit, e.g.:
```typescript
userId: 'TODO_REPLACE_WITH_ACTUAL_USER_ID' as const
```
