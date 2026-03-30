# Feature Spec: Email Send Integration for CRM Workflow Automation

## Overview

Wire the existing `send_email` stub in the Workflow Automation engine to the production email service (`server/services/email-service.ts`), add a managed email template system, expose a template CRUD UI, and add an "email" activity type to CRM activity logging so every workflow-sent email is auditable.

**Scope:** Backend wiring + email template management + workflow rule builder UI enhancement + activity logging.
**Not in scope:** Marketing automation (Constant Contact/Mailchimp), bulk email campaigns (already built), LP portal emails, or SMS.

---

## User Story

**As a** deal team member configuring workflow automations,
**I want to** define "send email" actions that use branded templates with token substitution,
**so that** contacts, deal owners, and team members automatically receive contextual emails when workflow triggers fire (e.g., deal stage change, stale deal, new deal created).

---

## Database Changes Required

### 1. New table: `workflow_email_templates`

```sql
CREATE TABLE IF NOT EXISTS workflow_email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  name          VARCHAR(255) NOT NULL,
  subject       VARCHAR(500) NOT NULL,
  body_html     TEXT NOT NULL,
  body_text     TEXT,                       -- plain-text fallback (auto-generated if null)
  category      VARCHAR(50) NOT NULL DEFAULT 'workflow',
                -- workflow | notification | follow_up | custom
  tokens_used   TEXT[] DEFAULT '{}',        -- e.g. {deal.propertyName, deal.stage, contact.firstName}
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wet_org ON workflow_email_templates(org_id);
CREATE INDEX idx_wet_category ON workflow_email_templates(org_id, category);
```

### 2. New table: `workflow_email_log`

```sql
CREATE TABLE IF NOT EXISTS workflow_email_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  rule_id         UUID,                      -- FK to workflow_rules (nullable for manual sends)
  execution_id    UUID,                      -- FK to workflow_executions
  template_id     UUID REFERENCES workflow_email_templates(id),
  recipient_email VARCHAR(320) NOT NULL,
  recipient_name  VARCHAR(255),
  recipient_type  VARCHAR(50) NOT NULL,      -- deal_owner | contact | team_member | custom
  subject         VARCHAR(500) NOT NULL,     -- after token interpolation
  body_preview    TEXT,                       -- first 500 chars of rendered body
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                  -- pending | sent | failed | bounced
  provider        VARCHAR(50),               -- sendgrid | resend | console
  provider_id     VARCHAR(255),              -- provider message ID for tracking
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wel_org ON workflow_email_log(org_id);
CREATE INDEX idx_wel_rule ON workflow_email_log(rule_id);
CREATE INDEX idx_wel_status ON workflow_email_log(org_id, status);
CREATE INDEX idx_wel_recipient ON workflow_email_log(recipient_email);
```

### 3. Seed data: Default workflow email templates

Insert 5 starter templates per org on first access (lazy seeding):

| Name | Subject | Category | Tokens |
|------|---------|----------|--------|
| Deal Stage Update | `{{deal.propertyName}} moved to {{deal.stage}}` | workflow | deal.propertyName, deal.stage, deal.value |
| Stale Deal Reminder | `Action needed: {{deal.propertyName}} has been idle` | workflow | deal.propertyName, deal.daysInStage, deal.stage |
| New Deal Assigned | `New deal assigned: {{deal.propertyName}}` | notification | deal.propertyName, deal.value, deal.assetClass |
| Deal Won Notification | `Congratulations! {{deal.propertyName}} closed` | notification | deal.propertyName, deal.value, deal.stage |
| Follow-Up Reminder | `Follow up on {{deal.propertyName}}` | follow_up | deal.propertyName, contact.firstName, contact.email |

---

## API Routes Required

All routes scoped to authenticated user's `orgId`. Mount at `/api/workflow-email/`.

### Template CRUD

#### `GET /api/workflow-email/templates`
- **Auth:** Authenticated
- **Query params:** `category?`, `isActive?`, `search?`
- **Response:** `{ templates: WorkflowEmailTemplate[] }`
- **Logic:** Query `workflow_email_templates` by org_id. If zero rows, lazy-seed defaults then return.

#### `GET /api/workflow-email/templates/:id`
- **Auth:** Authenticated
- **Response:** `{ template: WorkflowEmailTemplate }`

#### `POST /api/workflow-email/templates`
- **Auth:** Authenticated
- **Body:** `{ name, subject, bodyHtml, bodyText?, category?, tokensUsed? }`
- **Response:** `{ template: WorkflowEmailTemplate }`
- **Validation:** name required, subject required, bodyHtml required

#### `PATCH /api/workflow-email/templates/:id`
- **Auth:** Authenticated
- **Body:** Partial `{ name?, subject?, bodyHtml?, bodyText?, category?, isActive? }`
- **Response:** `{ template: WorkflowEmailTemplate }`

#### `DELETE /api/workflow-email/templates/:id`
- **Auth:** Authenticated
- **Response:** `{ success: true }`
- **Logic:** Soft-delete (set `is_active = false`) rather than hard delete to preserve log references.

#### `POST /api/workflow-email/templates/:id/preview`
- **Auth:** Authenticated
- **Body:** `{ dealId?: string }` — optional deal to use as sample context
- **Response:** `{ subject: string, bodyHtml: string, bodyText: string }`
- **Logic:** Load template, build a TriggerContext from the given deal (or use sample data), interpolate all tokens, wrap in `wrapEmailTemplate()` from email-service.ts, return rendered result.

### Email Send & Logs

#### `POST /api/workflow-email/send-test`
- **Auth:** Authenticated
- **Body:** `{ templateId: string, recipientEmail: string, dealId?: string }`
- **Response:** `{ success: boolean, messageId?: string, error?: string }`
- **Logic:** Render template with deal context, call `sendEmail()`, log to `workflow_email_log` with `rule_id = null`.

#### `GET /api/workflow-email/logs`
- **Auth:** Authenticated
- **Query params:** `ruleId?`, `status?`, `recipientEmail?`, `startDate?`, `endDate?`, `limit?`, `offset?`
- **Response:** `{ logs: WorkflowEmailLogEntry[], total: number }`

### Token Metadata

#### `GET /api/workflow-email/available-tokens`
- **Auth:** Authenticated
- **Response:** `{ tokens: { key: string, label: string, example: string }[] }`
- **Logic:** Return static list of all supported interpolation tokens with human labels and example values:
  - `deal.propertyName` / "Property Name" / "123 Main St"
  - `deal.stage` / "Current Stage" / "Due Diligence"
  - `deal.value` / "Deal Value" / "$2,500,000"
  - `deal.assetClass` / "Asset Class" / "Multifamily"
  - `deal.daysInStage` / "Days in Stage" / "14"
  - `deal.state` / "State" / "FL"
  - `deal.city` / "City" / "Miami"
  - `deal.assignedToName` / "Assigned To" / "John Smith"
  - `contact.firstName` / "Contact First Name" / "Jane"
  - `contact.lastName` / "Contact Last Name" / "Doe"
  - `contact.email` / "Contact Email" / "jane@example.com"
  - `contact.company` / "Contact Company" / "Acme Corp"
  - `org.name` / "Organization Name" / "MarinaMatch"
  - `user.name` / "Triggered By" / "Brett"
  - `rule.name` / "Rule Name" / "Stale Deal Alert"

---

## Backend Implementation: Wire `send_email` Action

### File: `server/marinamatch/workflow-engine.ts`

Replace the stub at lines 218-224 with:

```typescript
case 'send_email': {
  const { to, subject, body, templateId, recipientType } = action.config;

  // Resolve recipient email
  let recipientEmail: string;
  let recipientName: string | undefined;

  if (to === '{{deal.ownerEmail}}' || to === 'deal_owner') {
    // Look up deal owner email from deal context
    recipientEmail = context.deal?.assignedToEmail || '';
    recipientName = context.deal?.assignedToName;
  } else if (to === '{{contact.email}}' || to === 'primary_contact') {
    recipientEmail = context.contact?.email || '';
    recipientName = `${context.contact?.firstName || ''} ${context.contact?.lastName || ''}`.trim();
  } else {
    recipientEmail = interpolateTemplate(to, context);
    recipientName = undefined;
  }

  if (!recipientEmail) {
    return { status: 'failed', error: 'No recipient email resolved' };
  }

  // Resolve subject and body (template or inline)
  let renderedSubject: string;
  let renderedHtml: string;
  let renderedText: string;
  let usedTemplateId: string | null = null;

  if (templateId) {
    // Load template from workflow_email_templates
    const tplResult = await pool.query(
      'SELECT * FROM workflow_email_templates WHERE id = $1 AND org_id = $2',
      [templateId, orgId]
    );
    if (tplResult.rows.length === 0) {
      return { status: 'failed', error: `Template ${templateId} not found` };
    }
    const tpl = tplResult.rows[0];
    renderedSubject = interpolateTemplate(tpl.subject, context);
    renderedHtml = wrapEmailTemplate(interpolateTemplate(tpl.body_html, context));
    renderedText = tpl.body_text
      ? interpolateTemplate(tpl.body_text, context)
      : stripHtml(renderedHtml);
    usedTemplateId = templateId;
  } else {
    renderedSubject = interpolateTemplate(subject || '', context);
    renderedHtml = wrapEmailTemplate(interpolateTemplate(body || '', context));
    renderedText = stripHtml(renderedHtml);
  }

  // Send via email-service.ts
  const { sendEmail } = await import('../services/email-service.js');
  const sent = await sendEmail({
    to: recipientEmail,
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText,
  });

  // Log to workflow_email_log
  await pool.query(
    `INSERT INTO workflow_email_log
       (org_id, rule_id, execution_id, template_id, recipient_email,
        recipient_name, recipient_type, subject, body_preview, status, provider, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      orgId,
      context.ruleId || null,
      context.executionId || null,
      usedTemplateId,
      recipientEmail,
      recipientName || null,
      recipientType || 'custom',
      renderedSubject,
      renderedHtml.substring(0, 500),
      sent ? 'sent' : 'failed',
      sent ? 'sendgrid' : null,  // email-service handles provider selection
      sent ? new Date() : null,
    ]
  );

  // Log CRM activity
  await pool.query(
    `INSERT INTO crm_activities
       (type, subject, description, direction, status, entity_type, entity_id, user_id, org_id, metadata)
     VALUES ('email', $1, $2, 'outbound', 'completed', $3, $4, $5, $6, $7)`,
    [
      renderedSubject,
      `Automated email sent via workflow rule "${context.ruleName || 'unknown'}"`,
      context.deal ? 'deal' : 'contact',
      context.deal?.id || context.contact?.id || null,
      context.triggeredBy || 'system',
      orgId,
      JSON.stringify({
        workflowRuleId: context.ruleId,
        templateId: usedTemplateId,
        recipientEmail,
        provider: 'workflow_automation',
      }),
    ]
  );

  return {
    status: sent ? 'success' : 'failed',
    result: { to: recipientEmail, subject: renderedSubject, templateId: usedTemplateId },
  };
}
```

### Helper: `stripHtml()`

Add a simple HTML tag stripper for plain-text fallback:

```typescript
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
```

### Extend `TriggerContext` interface

Add optional fields needed for email resolution:

```typescript
interface TriggerContext {
  deal?: {
    id: string;
    propertyName?: string;
    stage?: string;
    status?: string;
    value?: number;
    assetClass?: string;
    state?: string;
    city?: string;
    assignedToName?: string;
    assignedToEmail?: string;  // NEW
    daysInStage?: number;      // NEW
    // ... existing fields
  };
  contact?: {                   // NEW
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
  };
  ruleId?: string;              // NEW
  ruleName?: string;            // NEW
  executionId?: string;         // NEW
  triggeredBy?: string;         // NEW — userId of trigger initiator
}
```

### Enrich context at fire time

In `WorkflowEngine.fire()`, before executing actions, enrich the context:
1. If deal is present, look up `assigned_to` user email from `users` table.
2. If deal has a primary contact, look up contact details from `crm_contacts` via `crm_deal_contacts` join.
3. Attach `ruleId`, `ruleName`, `executionId` to context.

---

## Frontend Components

### 1. `WorkflowEmailTemplateManager` (NEW)

**Location:** `client/src/components/crm/workflow-email-template-manager.tsx`

**UI Description:**
- Accessible from Workflow Automation settings page as a "Email Templates" tab
- Table listing templates: Name, Subject, Category badge, Status (active/inactive), Last Updated
- "New Template" button opens modal
- Row click opens edit modal
- Each row has "Preview" and "Delete" actions

**State:**
- `useQuery` for `GET /api/workflow-email/templates`
- `useMutation` for create/update/delete

### 2. `WorkflowEmailTemplateEditor` (NEW)

**Location:** `client/src/components/crm/workflow-email-template-editor.tsx`

**UI Description:**
- Modal or full-page editor
- Fields: Name (text input), Category (select), Subject (text input with token insertion), Body (rich text area with token insertion)
- Token insertion: "Insert Token" dropdown button that inserts `{{token.path}}` at cursor position in subject or body
- Available tokens fetched from `GET /api/workflow-email/available-tokens`
- Live preview panel (right side or toggle) showing rendered HTML with sample data
- "Send Test" button — prompts for email address, calls `/send-test`
- Save / Cancel buttons

**Props:**
```typescript
{
  templateId?: string;  // null for create
  onSave: () => void;
  onClose: () => void;
}
```

### 3. `WorkflowEmailActionConfig` (NEW)

**Location:** `client/src/components/crm/workflow-email-action-config.tsx`

**UI Description:**
- Renders inside the workflow rule builder when action type is `send_email`
- Fields:
  - **Recipient:** Radio group — "Deal Owner", "Primary Contact", "Custom Email"
    - Custom: text input for email (supports `{{tokens}}`)
  - **Email Content:** Radio group — "Use Template" or "Custom"
    - Template: Searchable select dropdown of active templates
    - Custom: Subject input + Body textarea (both support token insertion)
  - **Preview:** Button to preview rendered email in a popover

**Props:**
```typescript
{
  config: SendEmailActionConfig;
  onChange: (config: SendEmailActionConfig) => void;
}
```

**Types:**
```typescript
interface SendEmailActionConfig {
  to: string;                    // email, 'deal_owner', 'primary_contact', or {{token}}
  recipientType: 'deal_owner' | 'contact' | 'team_member' | 'custom';
  templateId?: string;           // if using a template
  subject?: string;              // if custom (not template)
  body?: string;                 // if custom (not template)
}
```

### 4. `WorkflowEmailLog` (NEW)

**Location:** `client/src/components/crm/workflow-email-log.tsx`

**UI Description:**
- Table showing sent emails: Recipient, Subject, Status badge (sent/failed/pending), Rule Name, Sent At
- Filters: Status dropdown, date range, search by recipient
- Expandable row shows body preview and error message (if failed)
- Accessible from Workflow Automation page as "Email Log" tab

### 5. Modify existing `WorkflowRuleBuilder`

**Location:** Find existing workflow rule builder component

**Changes:**
- Add `send_email` to action type dropdown with mail icon
- When `send_email` is selected, render `WorkflowEmailActionConfig` instead of the generic config fields
- Ensure the builder serializes `SendEmailActionConfig` into `action.config`

---

## Integration Points

### What feeds INTO this feature
| Source | Data | How |
|--------|------|-----|
| Workflow Engine triggers | Deal context, trigger event | `WorkflowEngine.fire()` passes TriggerContext |
| CRM Contacts | Contact email, name | Lookup via `crm_deal_contacts` → `crm_contacts` |
| Users table | Deal owner email | Lookup via `sourced_deals.assigned_to` → `users.email` |
| Email Service | SendGrid/Resend provider | `sendEmail()` from `server/services/email-service.ts` |
| Email Templates | Subject + body HTML | `workflow_email_templates` table |

### What this feature feeds INTO
| Target | Data | How |
|--------|------|-----|
| CRM Activities | Email activity record | INSERT into `crm_activities` with type='email', direction='outbound' |
| Workflow Email Log | Send status, provider ID | INSERT into `workflow_email_log` |
| Workflow Executions | Action result (success/fail) | Returned from `executeAction()` to execution log |
| Global Activity Log | Email sent event | Via `crm_activities` (already consumed by activity feed) |

### CRM Activity Logging
- **YES** — every workflow email creates a `crm_activities` record:
  - `type: 'email'`
  - `direction: 'outbound'`
  - `status: 'completed'`
  - `entity_type: 'deal'` (or 'contact')
  - `metadata`: `{ workflowRuleId, templateId, recipientEmail, provider }`

### Entitlement Gating
- **Not required for v1** — email send is available to all authenticated users with active workflow automation access.
- Future: could gate template count or email volume per billing tier.

---

## Technical Constraints

1. **RLS:** `workflow_email_templates` and `workflow_email_log` are new tables — no RLS needed. Use `pool.query()` anyway to stay consistent with workflow engine pattern.
2. **Snake_case mapping:** All raw SQL returns snake_case. Map to camelCase in route responses (e.g., `body_html` → `bodyHtml`, `created_at` → `createdAt`).
3. **Server restart:** Required after adding new Express routes. `pkill -f 'tsx server' && npm run dev`.
4. **Email provider:** Use existing `sendEmail()` from `server/services/email-service.ts` — do NOT create a new email sending mechanism. The function handles SendGrid → Resend → Console fallback.
5. **Token interpolation:** Reuse existing `interpolateTemplate()` from `server/marinamatch/workflow-engine.ts`. Extend if needed for contact/org/user tokens.
6. **No `npm run db:push`:** All table creation via raw SQL migration scripts using the heredoc pattern.
7. **Import pattern:** The workflow engine file uses `pool.query()` directly. Import `sendEmail` dynamically to avoid circular dependencies.
8. **HTML wrapping:** Use `wrapEmailTemplate()` from `email-service.ts` for consistent MarinaMatch branding on all workflow emails.

---

## Acceptance Criteria

- [ ] `workflow_email_templates` table created via raw SQL migration
- [ ] `workflow_email_log` table created via raw SQL migration
- [ ] 5 default templates seeded on first access per org
- [ ] `send_email` action in workflow-engine.ts calls real `sendEmail()` (no more console stub)
- [ ] Recipient resolution works for: deal_owner, primary_contact, custom email, and `{{token}}` patterns
- [ ] Template-based emails render with all tokens interpolated
- [ ] Custom (inline) subject/body emails render with token interpolation
- [ ] Plain-text fallback generated when `body_text` is null
- [ ] Every sent email logged to `workflow_email_log` with correct status
- [ ] Every sent email creates a `crm_activities` record (type='email', direction='outbound')
- [ ] Template CRUD API works: list, get, create, update, soft-delete
- [ ] Template preview API renders with sample or real deal data
- [ ] Send test API delivers a real email to a specified address
- [ ] Available tokens endpoint returns full token list with labels and examples
- [ ] Email log API returns paginated, filterable results
- [ ] `WorkflowEmailTemplateManager` UI lists/creates/edits/deletes templates
- [ ] `WorkflowEmailTemplateEditor` UI supports token insertion and live preview
- [ ] `WorkflowEmailActionConfig` renders in rule builder for `send_email` actions
- [ ] `WorkflowEmailLog` UI shows sent email history with status badges
- [ ] Failed emails have error messages captured in both log table and execution result
- [ ] Context enrichment: deal owner email and primary contact resolved before action execution
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Dev server runs cleanly after implementation

---

## Implementation Order

1. **DB Migration** — Create `workflow_email_templates` and `workflow_email_log` tables via raw SQL heredoc script
2. **Backend: Template routes** — CRUD + preview + available-tokens endpoints in new `server/routes/workflow-email-routes.ts`
3. **Backend: Wire send_email action** — Replace stub in `server/marinamatch/workflow-engine.ts`, add context enrichment in `fire()`
4. **Backend: Email log route** — GET endpoint for querying `workflow_email_log`
5. **Backend: Send test route** — POST endpoint that renders and sends a test email
6. **Frontend: WorkflowEmailTemplateManager** — Template list page/tab
7. **Frontend: WorkflowEmailTemplateEditor** — Create/edit modal with token insertion + preview
8. **Frontend: WorkflowEmailActionConfig** — Rule builder integration for send_email actions
9. **Frontend: WorkflowEmailLog** — Email log viewer tab
10. **Integration test** — Create a workflow rule with send_email action, trigger it, verify email log + crm_activity created

---

## Estimated Complexity

**Medium-High**

- Backend wiring is straightforward (email service exists, workflow engine exists)
- Template CRUD is standard
- Context enrichment (deal owner email, primary contact) requires join queries
- Frontend template editor with token insertion and live preview is the most complex UI piece
- Total: ~800-1200 lines of new code across 6-8 files
