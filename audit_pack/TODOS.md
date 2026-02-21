# TODO / FIXME Items

This document lists all TODO and FIXME comments found in the codebase.

## Server-Side TODOs

### server/routes.ts
| Line | Comment |
|------|---------|
| 3048 | `TODO: Fix audit_logs table to allow null projectId for org-level operations` |
| 3143 | `TODO: Fix audit_logs table to allow null projectId for org-level operations` |
| 22165 | `TODO: Add to storage interface` |
| 22180 | `TODO: Add to storage interface` |
| 22195 | `TODO: Add to storage interface` |
| 22243 | `TODO: Add to storage interface` |
| 22330 | `TODO: Add to storage interface` |
| 22350 | `TODO: Add to storage interface` |
| 22393 | `TODO: Add to storage interface` |

### server/services/dashboard-service.ts
| Line | Comment |
|------|---------|
| 770 | `TODO: Add orgId field to ship store tables for multi-tenant support` |

### server/notification-service.ts
| Line | Comment |
|------|---------|
| 401 | `TODO: Determine based on context` (recipientType) |
| 402 | `TODO: Use proper recipient ID` |
| 568 | `TODO: Implement more sophisticated deadline monitoring` |

### server/routes/marina-comp-routes.ts
| Line | Comment |
|------|---------|
| 592 | `TODO: Implement Excel export with xlsx library` |

### server/routes/opssos/statement-routes.ts
| Line | Comment |
|------|---------|
| 78 | `TODO: Generate actual XLSX file here` |

### server/ship-store-router.ts
| Line | Comment |
|------|---------|
| 96 | `TODO: Fetch CRM contacts and Rent Roll tenants` |

### server/docket/storage.ts
| Line | Comment |
|------|---------|
| 20 | `TODO: When implementing user-scoped visibility:` |

### server/services/fuel/fuel-route-utils.ts
| Line | Comment |
|------|---------|
| 154 | `TODO: Check if this operation requires approval` |

### server/services/rent-roll-v2/leaseEconomics/leaseEconomics.engine.ts
| Line | Comment |
|------|---------|
| 231 | `TODO: Integrate other income from existing contract charges system` |
| 259 | `TODO: Add rent step tracking` (activeRentStep) |

---

## Client-Side TODOs

### client/src/components/modals/week-prospecting-modal.tsx
| Line | Comment |
|------|---------|
| 1130 | `TODO: Use actual user ID` |
| 1132 | `TODO: Use actual prospecting entry ID` |

### client/src/components/modals/contact-form-modal.tsx
| Line | Comment |
|------|---------|
| 159 | `TODO: Load from contact's assigned deals when backend supports it` |

### client/src/components/contact-management.tsx
| Line | Comment |
|------|---------|
| 19 | `TODO: Future CRM Integration Framework` |
| 31 | `TODO: Implement these when connecting to actual CRM` |
| 358 | `TODO: Implement CRM search when connecting to external CRM` |

### client/src/components/project-header.tsx
| Line | Comment |
|------|---------|
| 30 | `TODO: Enable when risk API endpoints are implemented` |

### client/src/pages/analysis/sales-comps/Index.tsx
| Line | Comment |
|------|---------|
| 31 | `TODO: Replace with actual MarinaMatch auth when available` |

### client/src/pages/analysis/sales-comps/BulkEdit.tsx
| Line | Comment |
|------|---------|
| 1 | `TODO: Missing SalesComps-specific utilities` |

### client/src/pages/analysis/projects/Report.tsx
| Line | Comment |
|------|---------|
| 1 | `TODO: Missing SalesComps-specific components and utilities` |
| 23 | `TODO: Fetch report data when useProjectReport hook is available` |
| 28 | `TODO: Get user from MarinaMatch auth context` |
| 123 | `TODO: Import report components when available` |

### client/src/pages/analysis/rate-comps/Detail.tsx
| Line | Comment |
|------|---------|
| 28 | `TODO: Implement data fetching when API is available` |
| 32 | `TODO: Get user from MarinaMatch auth context` |

---

## Modules TODOs

### modules/dockit/server/notifications.ts
| Line | Comment |
|------|---------|
| 2 | `TODO: Add SendGrid API key when ready to launch for production email notifications` |
| 34 | `TODO: When ready to launch, uncomment and implement SendGrid` |
| 62 | `TODO: When ready to launch, implement email/SMS to staff` |

### modules/dockit/server/routes.ts
| Line | Comment |
|------|---------|
| 1137 | `TODO: Send real-time notification to marina staff` |
| 1138 | `TODO: Send confirmation SMS/email to customer` |
| 1223 | `TODO: Update queue positions for remaining boats` |
| 1224 | `TODO: Send status update notification to customer` |
| 1356 | `TODO: Send confirmation email to customer` |
| 1357 | `TODO: Send notification to marina staff` |
| 1409 | `TODO: Send cancellation email to customer` |
| 1410 | `TODO: Process refund if applicable` |

---

## Summary by Category

| Category | Count |
|----------|-------|
| Storage/Interface additions | 7 |
| Notifications/Email | 10 |
| Auth/User context | 6 |
| CRM integration | 3 |
| Data fetching | 3 |
| Multi-tenant support | 1 |
| Excel export | 2 |
| Deadline monitoring | 1 |
| Misc | 5 |
| **Total** | **~38** |

---

## Priority Recommendations

### High Priority (Blocking Features)
1. Audit logs null projectId fix (affects org-level operations)
2. Ship store multi-tenant orgId support
3. Dockit email/SMS notifications for production

### Medium Priority (Feature Completeness)
1. CRM external integration framework
2. Excel export implementations
3. Risk API endpoints

### Low Priority (Polish)
1. Report page component imports
2. Deadline monitoring sophistication
3. Rent step tracking
