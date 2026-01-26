# Integration Guide - Applying Tier 2 Upgrades

Since automated patching requires seeing your exact codebase structure, this guide shows you exactly what changes to make to your existing files.

---

## Files to Create (Copy from Package)

These are new files - just copy them:

```bash
# Security middleware
mkdir -p server/middleware
cp ~/upgrade/security/rate-limiting.ts server/middleware/
cp ~/upgrade/security/error-handler.ts server/middleware/
cp ~/upgrade/security/input-validation.ts server/middleware/
cp ~/upgrade/security/session-management.ts server/middleware/
cp ~/upgrade/security/file-upload-security.ts server/security/

# Storage
mkdir -p server/storage
cp ~/upgrade/storage/s3-client.ts server/storage/

# AI
mkdir -p server/services/ai
cp ~/upgrade/ai/spending-guard.ts server/services/ai/

# Database
mkdir -p server/database
cp ~/upgrade/database/connection-pooling.ts server/database/
```

---

## File #1: server/index.ts

### Step 1: Add imports at top

```typescript
// ADD THESE IMPORTS:
import { globalRateLimit } from './middleware/rate-limiting';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { testS3Connection } from './storage/s3-client';
import { configureConnectionPooling } from './database/connection-pooling';
```

### Step 2: Replace database configuration

**FIND THIS:**
```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**REPLACE WITH:**
```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { configureConnectionPooling } from './database/connection-pooling';

// Configure connection pooling
const pool = configureConnectionPooling();
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

### Step 3: Add rate limiting middleware

**FIND THIS:**
```typescript
app.use(helmet());
```

**ADD AFTER IT:**
```typescript
// Global rate limiting
app.use(globalRateLimit);
```

### Step 4: Add error handlers

**FIND THIS** (usually at end of file, before app.listen):
```typescript
// Existing routes...
app.get('/api/something', ...);

// Server listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**ADD BEFORE app.listen:**
```typescript
// Existing routes...
app.get('/api/something', ...);

// ===== ADD THESE =====
// 404 handler (after all routes)
app.use(notFoundHandler);

// Error handler (must be last middleware)
app.use(errorHandler);
// =====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 5: Test S3 on startup

**ADD THIS AFTER** app.listen():
```typescript
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Test S3 connection
  const s3Test = await testS3Connection();
  if (s3Test.success) {
    console.log(s3Test.message);
  } else {
    console.error('⚠️  S3 connection failed:', s3Test.error);
    console.error('   File uploads may not work correctly');
  }
});
```

---

## File #2: server/routes/auth-routes.ts

### Step 1: Add imports

```typescript
// ADD THESE:
import { loginRateLimit } from '../middleware/rate-limiting';
import { invalidateAllUserSessions } from '../middleware/session-management';
import { validate, schemas } from '../middleware/input-validation';
```

### Step 2: Add rate limiting to login

**FIND THIS:**
```typescript
router.post('/login', async (req, res) => {
  // ... login logic
});
```

**REPLACE WITH:**
```typescript
router.post('/login',
  loginRateLimit,  // ADD THIS
  validate(schemas.login),  // ADD THIS
  async (req, res) => {
    // ... existing login logic
  }
);
```

### Step 3: Add session invalidation to password reset

**FIND THIS:**
```typescript
router.post('/reset-password', async (req, res) => {
  // ... validate token, update password ...
  
  await db.update(users)
    .set({ password: hashedPassword })
    .where(eq(users.id, userId));
  
  res.json({ success: true });
});
```

**ADD AFTER password update:**
```typescript
router.post('/reset-password', 
  validate(schemas.passwordReset),  // ADD THIS
  async (req, res) => {
    // ... validate token, update password ...
    
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
    
    // ===== ADD THIS =====
    // Invalidate all sessions after password reset
    await invalidateAllUserSessions(userId);
    // ====================
    
    res.json({ success: true, message: 'Password reset. Please login again.' });
  }
);
```

---

## File #3: server/routes.ts (or your main routes file)

### Step 1: Update file upload routes

**FIND upload routes** (look for `multer` or file upload code):
```typescript
import multer from 'multer';

const upload = multer({ dest: 'server/uploads/' });

app.post('/api/dd/projects/:id/cdd-documents',
  upload.single('file'),
  async (req, res) => {
    // Save file locally
  }
);
```

**REPLACE WITH:**
```typescript
import multer from 'multer';
import { uploadToS3 } from './storage/s3-client';
import { validateUpload, getS3Key } from './security/file-upload-security';
import { uploadRateLimit } from './middleware/rate-limiting';

// Use memory storage instead of disk
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.post('/api/dd/projects/:id/cdd-documents',
  authenticateUser,
  enforceTenant,
  uploadRateLimit,  // ADD THIS
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Validate file security
    const validation = await validateUpload({
      originalname: req.file.originalname,
      buffer: req.file.buffer,
      size: req.file.size
    });
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }
    
    // Generate S3 key
    const s3Key = getS3Key({
      orgId: req.user.orgId,
      module: 'cdd',
      filename: validation.secureFilename!,
      userId: req.user.id
    });
    
    // Upload to S3
    const s3Result = await uploadToS3({
      key: s3Key,
      body: req.file.buffer,
      contentType: validation.mimeType!
    });
    
    if (!s3Result.success) {
      return res.status(500).json({ error: 'Failed to upload file' });
    }
    
    // Save metadata to database
    const document = await db.insert(cddDocuments).values({
      projectId: parseInt(req.params.id),
      orgId: req.user.orgId,
      filename: validation.secureFilename,
      path: s3Key,  // S3 key instead of local path
      s3Url: s3Result.url,
      mimeType: validation.mimeType,
      size: req.file.size,
      uploadedBy: req.user.id
    }).returning();
    
    res.json(document[0]);
  }
);
```

### Step 2: Add input validation to create/update routes

**FIND routes like this:**
```typescript
app.post('/api/crm/deals', authenticateUser, async (req, res) => {
  const deal = await db.insert(crmDeals).values(req.body);
  res.json(deal);
});
```

**ADD VALIDATION:**
```typescript
import { validate, schemas } from './middleware/input-validation';

app.post('/api/crm/deals', 
  authenticateUser,
  enforceTenant,
  validate(schemas.createDeal),  // ADD THIS
  async (req, res) => {
    // req.body is now validated!
    const deal = await db.insert(crmDeals).values({
      ...req.body,
      orgId: req.user.orgId  // Ensure orgId is set
    });
    res.json(deal);
  }
);
```

**Repeat for all POST/PUT/PATCH routes** - add appropriate schema validation.

### Step 3: Wrap AI API calls with spending guard

**FIND AI API calls** (OpenAI, Anthropic):
```typescript
app.post('/api/ai-assistant/chat', async (req, res) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: req.body.messages
  });
  
  res.json(response);
});
```

**WRAP WITH SPENDING GUARD:**
```typescript
import { checkAISpendingLimit, trackAIUsage, calculateAICost } from './services/ai/spending-guard';
import { aiRateLimit } from './middleware/rate-limiting';

app.post('/api/ai-assistant/chat', 
  authenticateUser,
  enforceTenant,
  aiRateLimit,  // ADD THIS
  async (req, res) => {
    // Estimate cost before calling
    const estimatedTokens = req.body.messages.reduce((sum, m) => sum + m.content.length / 4, 0);
    const estimatedCost = calculateAICost({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: estimatedTokens,
      outputTokens: estimatedTokens * 0.5  // Rough estimate
    });
    
    // Check spending limit
    const limitCheck = await checkAISpendingLimit(req.user.orgId, estimatedCost);
    if (!limitCheck.allowed) {
      return res.status(429).json({ 
        error: limitCheck.reason,
        currentSpend: (limitCheck.currentSpend! / 100).toFixed(2),
        limit: (limitCheck.limit! / 100).toFixed(2)
      });
    }
    
    // Make API call
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: req.body.messages
    });
    
    // Track actual usage
    await trackAIUsage({
      orgId: req.user.orgId,
      userId: req.user.id,
      operationType: 'chat',
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: response.usage!.prompt_tokens,
      outputTokens: response.usage!.completion_tokens
    });
    
    res.json(response);
  }
);
```

---

## Verification Checklist

After making all changes:

- [ ] App starts without errors
- [ ] Can login (rate limited to 5 attempts)
- [ ] Can upload a file (goes to S3, not local disk)
- [ ] AI features work (spending is tracked)
- [ ] Invalid input is rejected with clear error messages
- [ ] Stack traces are NOT visible in responses (only in server logs)

---

## Testing Your Changes

```bash
# 1. Start the app
npm run dev

# 2. Test login rate limiting
# Try logging in 6 times with wrong password
# 6th attempt should be blocked

# 3. Test file upload
# Upload a .exe file renamed to .pdf
# Should be rejected with "Invalid file type"

# 4. Test AI spending
# Check current spend:
curl http://localhost:5000/api/admin/ai-usage

# 5. Test error handling
# Send invalid data:
curl -X POST http://localhost:5000/api/crm/deals \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'  # Empty name should be rejected
# Should return: {"error": "name: String must contain at least 1 character(s)"}
```

---

## Need Help?

If you're stuck on any integration step:

1. Check TROUBLESHOOTING.md
2. Look at the example code in the files (they have comments)
3. Ask for help with the specific file/line you're stuck on

The package is designed to be integrated manually because every codebase is slightly different. Follow the patterns above and you'll be good!
