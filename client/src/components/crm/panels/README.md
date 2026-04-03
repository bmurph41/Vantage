# CRM Work-in-Progress Components

These components are experimental CRM features that are aligned with the product roadmap but not yet integrated into the main application.

## Components in this folder:

| Component | Description | Status |
|-----------|-------------|--------|
| `smart-search.tsx` | Advanced CRM search with filters | Planned |
| `StageTemplateEditor.tsx` | Pipeline stage template editor | Planned |
| `CrmListsManager.tsx` | CRM list management | Planned |
| `related-entities-panel.tsx` | Panel showing related entities | Planned |
| `deal-playbook-panel.tsx` | Deal playbook guidance panel | Planned |
| `pipeline-forecasting-panel.tsx` | Pipeline revenue forecasting | Planned |
| `phase-gates-panel.tsx` | Deal phase gate tracking | Planned |
| `red-flags-panel.tsx` | Deal red flag indicators | Planned |
| `sla-tracking-panel.tsx` | SLA deadline tracking | Planned |
| `comment-threads-panel.tsx` | Threaded comments on deals | Planned |
| `DealMetricsDashboard.tsx` | Deal performance metrics | Planned |
| `PropertyStatusPanel.tsx` | Property status tracking | Planned |

## Usage

These components should NOT be imported into production code until they are reviewed, tested, and moved to the main components folder.

When ready to integrate:
1. Review and update the component code
2. Add tests
3. Move to `client/src/components/crm/`
4. Update any imports
