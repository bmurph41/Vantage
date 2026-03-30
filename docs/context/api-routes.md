# MarinaMatch — API Routes & Express Patterns

## Dev Server Management

### Kill the Server (always use this exact command)
```bash
pkill -f 'tsx server'
```

### Restart
```bash
npm run dev
```

### Why This Matters
After any route registration change or new route file is added, **the server must be
manually killed and restarted**. There is no auto-reload for route changes. Forgetting
this is the #1 cause of "my new route returns 404" confusion.

### Verify Server is Running
```bash
curl http://localhost:5000/api/health
# or check the Replit webview
```

---

## Route Registration Pattern

### File Location
All API routes live in `server/routes/` with feature-based naming:
```
server/routes/
├── marinamatch/
│   ├── workspace-routes.ts
│   ├── workspace-investment-routes.ts
│   ├── crm-routes.ts
│   ├── workflow-routes.ts
│   ├── ai-advisor-routes.ts
│   └── marketplace-routes.ts
└── index.ts  ← central registration point
```

### Adding a New Route File
**Step 1:** Create the route file with an Express Router:
```typescript
// server/routes/marinamatch/my-feature-routes.ts
import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const result = await pool.query(
      `SELECT * FROM my_table WHERE org_id = $1`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

**Step 2:** Register in the central routes index:
```typescript
// server/routes/index.ts (or wherever routes are registered)
import myFeatureRoutes from './marinamatch/my-feature-routes';
app.use('/api/marinamatch/my-feature', myFeatureRoutes);
```

**Step 3:** Kill and restart the server.

---

## Auth Middleware

### requireAuth Pattern
```typescript
import { requireAuth } from '../../middleware/auth';

// Protect a route
router.get('/protected', requireAuth, async (req, res) => {
  const orgId = req.user!.orgId;   // always available after requireAuth
  const userId = req.user!.id;
  // ...
});
```

### User Object Shape (req.user)
```typescript
{
  id: string;       // user UUID
  orgId: string;    // organization UUID — ALWAYS scope queries to this
  email: string;
  role: string;     // 'admin' | 'member' | etc.
}
```

**Always scope every DB query to `orgId`.** Never query without an org_id filter.

---

## Standard Route Patterns

### GET List
```typescript
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `SELECT * FROM crm_deals WHERE org_id = $1`;
    const params: any[] = [orgId];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows.map(mapToCamelCase));
  } catch (err) {
    console.error('GET list error:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});
```

### GET Single by ID
```typescript
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.orgId;

    const result = await pool.query(
      `SELECT * FROM crm_deals WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(mapToCamelCase(result.rows[0]));
  } catch (err) {
    console.error('GET by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});
```

### POST Create
```typescript
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const { name, stageId, dealValue } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(
      `INSERT INTO crm_deals (org_id, created_by, name, stage_id, deal_value)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgId, userId, name, stageId, dealValue]
    );

    res.status(201).json(mapToCamelCase(result.rows[0]));
  } catch (err) {
    console.error('POST create error:', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});
```

### PUT Update
```typescript
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.orgId;
    const { name, stageId } = req.body;

    const result = await pool.query(
      `UPDATE crm_deals
       SET name = COALESCE($1, name),
           stage_id = COALESCE($2, stage_id),
           updated_at = NOW()
       WHERE id = $3 AND org_id = $4
       RETURNING *`,
      [name, stageId, id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(mapToCamelCase(result.rows[0]));
  } catch (err) {
    console.error('PUT update error:', err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});
```

### DELETE
```typescript
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.orgId;

    const result = await pool.query(
      `DELETE FROM crm_deals WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error('DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});
```

---

## camelCase Mapping Helper

Define this once per route file or in a shared util:

```typescript
function mapToCamelCase(row: Record<string, any>): Record<string, any> {
  return Object.entries(row).reduce((acc, [key, value]) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = value;
    return acc;
  }, {} as Record<string, any>);
}
```

Or import from a shared utility if one exists in `server/utils/`.

---

## Known Route Paths

| Feature | Base Path |
|---|---|
| Workspace / modeling | `/api/marinamatch/workspace` |
| Investment materials | `/api/marinamatch/workspace/investment` |
| Sourced deals / marketplace | `/api/marinamatch/sourced-deals` |
| CRM (all entities) | `/api/marinamatch/crm` |
| Workflow automation | `/api/marinamatch/workflows` |
| AI advisor | `/api/marinamatch/ai-advisor` |
| Marina map | `/api/marinamatch/marina-map` |

---

## Error Handling Standards

Always use this pattern for route error handling:

```typescript
try {
  // route logic
} catch (err) {
  console.error('[route-name] operation failed:', err);
  res.status(500).json({
    error: 'Human-readable message',
    details: process.env.NODE_ENV === 'development' ? String(err) : undefined
  });
}
```

Never let errors propagate uncaught from route handlers.

---

## File Upload Routes

```typescript
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  // req.file.buffer — file contents
  // req.file.originalname — original filename
  // req.file.mimetype — content type
});
```

**Watch for:** Silent upload failures caused by malformed `console.log` tagged template
literals anywhere in the upload handler chain. If uploads silently fail, check all
`console.log` statements for syntax errors.

---

## TypeScript Tips

```typescript
// Augment Express Request to include user
// (should already exist in server/types/express.d.ts or similar)
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        orgId: string;
        email: string;
        role: string;
      };
    }
  }
}
```

Check `npx tsc --noEmit` after any route file changes before restarting the server.
