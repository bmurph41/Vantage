# OM Builder Integration Guide

This document describes how to integrate the OM Builder module into your larger application.

## API Namespace

All OM Builder endpoints are mounted under `/api/om/*`:

### OMs (Offering Memorandums)
- `GET /api/om/oms/project/:projectId` - List all OMs for a project
- `GET /api/om/oms/:id` - Get single OM
- `POST /api/om/oms` - Create new OM
- `PATCH /api/om/oms/:id` - Update OM
- `DELETE /api/om/oms/:id` - Delete OM
- `POST /api/om/oms/:id/clone` - Clone OM

### Pages
- `GET /api/om/oms/:omId/pages` - List pages for an OM (nested route)
- `GET /api/om/pages/:id` - Get single page
- `POST /api/om/pages` - Create page
- `PATCH /api/om/pages/:id` - Update page
- `DELETE /api/om/pages/:id` - Delete page
- `POST /api/om/oms/:omId/pages/reorder` - Reorder pages (nested route)
- `POST /api/om/pages/:pageId/save-as-template` - Save page as template

### Blocks
- `GET /api/om/pages/:pageId/blocks` - List blocks for a page (nested route)
- `GET /api/om/blocks/:id` - Get single block
- `POST /api/om/blocks` - Create block
- `PATCH /api/om/blocks/:id` - Update block
- `DELETE /api/om/blocks/:id` - Delete block
- `POST /api/om/pages/:pageId/blocks/reorder` - Reorder blocks (nested route)

### Templates
- `GET /api/om/templates` - List templates (optional filters: scope, category)
- `POST /api/om/templates` - Create template
- `DELETE /api/om/templates/:id` - Delete template
- `POST /api/om/templates/:id/apply` - Apply template to create new page

### Datasets (Excel/CSV Upload)
- `GET /api/om/datasets/project/:projectId` - List datasets for project
- `GET /api/om/datasets/:id` - Get dataset
- `POST /api/om/datasets/upload` - Upload Excel/CSV file
- `PATCH /api/om/datasets/:id` - Update dataset
- `DELETE /api/om/datasets/:id` - Delete dataset
- `GET /api/om/datasets/:id/sheet/:sheetName` - Get specific sheet data

### Data Facade
- `GET /api/om/data-facade/sources/:projectId` - List all data sources
- `GET /api/om/data-facade/data/:sourceId` - Get data from any source

### AI Content Generation
- `POST /api/om/ai/generate` - Generate OM content
- `POST /api/om/ai/improve` - Improve existing content
- `POST /api/om/ai/suggest-layout` - Get AI layout suggestions

## Authentication Integration

The OM Builder uses a flexible authentication middleware that can integrate with your parent app's auth system.

### Option 1: Header-Based Context (Recommended for API Gateway)

Pass user context via HTTP headers:

```
X-OM-User-Id: user_123
X-OM-User-Email: user@example.com
X-OM-User-Name: John Doe
X-OM-User-Role: editor  (admin | editor | viewer)
X-OM-Org-Id: org_456
X-OM-Project-Id: project_789
```

### Option 2: Express Session Integration

If using express-session, the middleware will look for `req.user` populated by your auth middleware.

### Option 3: Custom Extractor

Configure custom user extraction in your integration:

```typescript
import { createOmAuthMiddleware } from './server/middleware/auth';

const customAuth = createOmAuthMiddleware({
  extractUser: (req) => {
    // Your custom logic to extract user from JWT, session, etc.
    return req.session?.user || req.jwtPayload?.user;
  },
  extractProjectId: (req) => {
    return req.params.projectId || req.body.projectId;
  },
  requireAuth: true, // Set to true to require authentication
});

app.use('/api/om', customAuth, omRouter);
```

## Role-Based Access

Available roles:
- `admin` - Full access to all operations
- `editor` - Can create, edit, delete OMs, pages, blocks
- `viewer` - Read-only access

Use role guards on protected routes:

```typescript
import { requireRole } from './server/middleware/auth';

router.delete('/:id', requireRole('admin', 'editor'), deleteHandler);
```

## Database Schema

The OM Builder uses these tables (defined in `shared/schema.ts`):

- `oms` - Main OM documents
- `om_pages` - Pages within OMs
- `om_blocks` - Content blocks
- `om_templates` - Reusable templates
- `datasets` - Uploaded Excel/CSV data

All tables use UUID primary keys for easy cross-system integration.

## Frontend Integration

Mount the OM Builder React components in your app:

```tsx
import OMBuilder from '@/pages/om-builder';
import { OmProvider } from '@/lib/om-context';

function App() {
  return (
    <OmProvider>
      <Route path="/om-builder" component={OMBuilder} />
    </OmProvider>
  );
}
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key for AI features
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI API base URL

## Shared Types

Import shared types from `shared/schema.ts`:

```typescript
import { 
  Om, InsertOm,
  OmPage, InsertOmPage,
  OmBlock, InsertOmBlock,
  OmTemplate, InsertOmTemplate,
  Dataset, InsertDataset
} from '@shared/schema';
```

Frontend types are in `client/src/lib/types.ts`.
