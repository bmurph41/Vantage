# Quick Start - 5 Minute Setup

**Get started in 5 minutes, complete in 2 days.**

---

## 1. Download Package (1 minute)

Download `marinamatch-tier2-package.zip` and upload to Replit:

```bash
# In Replit Shell:
unzip marinamatch-tier2-package.zip
cd marinamatch-tier2-package
```

---

## 2. Add Secrets (2 minutes)

Click 🔒 Secrets in Replit sidebar, add these:

### AWS S3
```
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=us-east-1
S3_BUCKET_NAME=<your-bucket>
```

### Upstash Redis
```
REDIS_URL=rediss://default:password@host.upstash.io:6379
```

**Don't have these yet?**
- S3: Go to AWS Console → S3 → Create bucket
- Redis: Go to upstash.com → Create database (free)

---

## 3. Run Setup (2 minutes)

```bash
./setup.sh
```

This will:
- ✅ Check your environment
- ✅ Test S3 connection
- ✅ Test Redis connection
- ✅ Install npm dependencies

---

## 4. What's Next?

**If setup succeeded:**
```
✓ Environment validated successfully

Next steps:
  1. Review INSTALL.md for detailed instructions
  2. Create database backup
  3. Run migrations
```

**Follow the 2-day plan in INSTALL.md**

---

## 5. If Something Failed

**Check TROUBLESHOOTING.md** for common issues:
- Missing secrets → Add them in Replit
- S3 connection failed → Check AWS credentials
- Redis connection failed → Check Upstash URL

---

## Files You'll Use

**Start here:**
1. `INSTALL.md` - Full installation guide (follow this!)
2. `INTEGRATION_GUIDE.md` - How to integrate with your code
3. `TROUBLESHOOTING.md` - Common issues

**Reference:**
- `ROLLBACK.md` - If something goes wrong
- `PACKAGE_MANIFEST.md` - Complete file list

**Scripts:**
- `setup.sh` - Run this first
- `testing/run-tests.sh` - Test tenant isolation
- `database/migrations/run-migrations.ts` - Apply database changes

---

## The 2-Day Timeline

### Day 1 (6 hours)
- Morning: Setup + database migrations
- Afternoon: Copy files + integrate code
- Evening: Test manually

### Day 2 (6 hours)  
- Morning: Run automated tests
- Afternoon: Migrate files to S3
- Evening: Monitor + verify

**Total:** 12 active hours over 2 days

---

## Support

**Stuck?** 
1. Check the error message
2. Search TROUBLESHOOTING.md
3. Run `node verify-installation.ts` for diagnostics

**Ready?**

```bash
# Start installation:
open INSTALL.md
```

Let's make your platform production-ready! 🚀
