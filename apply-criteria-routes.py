"""
Investment Criteria: Backend API Routes
========================================
CRUD endpoints for investment criteria profiles and sub-tables.
Account-level (org-scoped), not deal-specific.

Endpoints created:
  GET    /api/investment-criteria              — list all profiles for org
  GET    /api/investment-criteria/:id          — get profile + all sub-tables
  POST   /api/investment-criteria              — create new profile
  PUT    /api/investment-criteria/:id          — update profile + sub-tables
  DELETE /api/investment-criteria/:id          — delete profile (cascades)
  GET    /api/investment-criteria/default      — get active default profile

Run from workspace root: python3 apply-criteria-routes.py
"""

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
ROUTES = "server/routes.ts"
r = read(ROUTES)

# Find a good insertion point — before the last app.listen or near the end
# We'll add after the last major route block

print("=== Adding Investment Criteria API Routes ===")

criteria_routes = '''
  // ═══════════════════════════════════════════════════════════════
  // INVESTMENT CRITERIA — Account-level buy-box configuration
  // ═══════════════════════════════════════════════════════════════

  // List all criteria profiles for org
  app.get("/api/investment-criteria", async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string || "default";
      const profiles = await db.select()
        .from(investmentCriteriaProfiles)
        .where(eq(investmentCriteriaProfiles.orgId, orgId))
        .orderBy(investmentCriteriaProfiles.createdAt);
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get default active profile with all sub-tables
  app.get("/api/investment-criteria/default", async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string || "default";
      const [profile] = await db.select()
        .from(investmentCriteriaProfiles)
        .where(and(
          eq(investmentCriteriaProfiles.orgId, orgId),
          eq(investmentCriteriaProfiles.isDefault, true),
          eq(investmentCriteriaProfiles.isActive, true),
        ))
        .limit(1);
      
      if (!profile) {
        return res.json(null);
      }
      
      const [location] = await db.select().from(investmentCriteriaLocation).where(eq(investmentCriteriaLocation.profileId, profile.id));
      const [financial] = await db.select().from(investmentCriteriaFinancial).where(eq(investmentCriteriaFinancial.profileId, profile.id));
      const [operational] = await db.select().from(investmentCriteriaOperational).where(eq(investmentCriteriaOperational.profileId, profile.id));
      const [size] = await db.select().from(investmentCriteriaSize).where(eq(investmentCriteriaSize.profileId, profile.id));
      const [capital] = await db.select().from(investmentCriteriaCapital).where(eq(investmentCriteriaCapital.profileId, profile.id));
      const [involvement] = await db.select().from(investmentCriteriaInvolvement).where(eq(investmentCriteriaInvolvement.profileId, profile.id));
      
      res.json({ profile, location, financial, operational, size, capital, involvement });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single profile with all sub-tables
  app.get("/api/investment-criteria/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [profile] = await db.select().from(investmentCriteriaProfiles).where(eq(investmentCriteriaProfiles.id, id));
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      
      const [location] = await db.select().from(investmentCriteriaLocation).where(eq(investmentCriteriaLocation.profileId, id));
      const [financial] = await db.select().from(investmentCriteriaFinancial).where(eq(investmentCriteriaFinancial.profileId, id));
      const [operational] = await db.select().from(investmentCriteriaOperational).where(eq(investmentCriteriaOperational.profileId, id));
      const [size] = await db.select().from(investmentCriteriaSize).where(eq(investmentCriteriaSize.profileId, id));
      const [capital] = await db.select().from(investmentCriteriaCapital).where(eq(investmentCriteriaCapital.profileId, id));
      const [involvement] = await db.select().from(investmentCriteriaInvolvement).where(eq(investmentCriteriaInvolvement.profileId, id));
      
      res.json({ profile, location, financial, operational, size, capital, involvement });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create new criteria profile with sub-tables
  app.post("/api/investment-criteria", async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string || "default";
      const { name, description, isDefault, location, financial, operational, size, capital, involvement, ...weights } = req.body;
      
      // If setting as default, unset existing defaults
      if (isDefault) {
        await db.update(investmentCriteriaProfiles)
          .set({ isDefault: false })
          .where(eq(investmentCriteriaProfiles.orgId, orgId));
      }
      
      const [profile] = await db.insert(investmentCriteriaProfiles).values({
        orgId,
        name: name || "Investment Criteria",
        description,
        isDefault: isDefault ?? true,
        isActive: true,
        ...weights,
      }).returning();
      
      // Insert sub-tables if provided
      if (location) await db.insert(investmentCriteriaLocation).values({ ...location, profileId: profile.id, orgId });
      if (financial) await db.insert(investmentCriteriaFinancial).values({ ...financial, profileId: profile.id, orgId });
      if (operational) await db.insert(investmentCriteriaOperational).values({ ...operational, profileId: profile.id, orgId });
      if (size) await db.insert(investmentCriteriaSize).values({ ...size, profileId: profile.id, orgId });
      if (capital) await db.insert(investmentCriteriaCapital).values({ ...capital, profileId: profile.id, orgId });
      if (involvement) await db.insert(investmentCriteriaInvolvement).values({ ...involvement, profileId: profile.id, orgId });
      
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update profile + upsert sub-tables
  app.put("/api/investment-criteria/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string || "default";
      const { location, financial, operational, size, capital, involvement, ...profileData } = req.body;
      
      // If setting as default, unset existing
      if (profileData.isDefault) {
        await db.update(investmentCriteriaProfiles)
          .set({ isDefault: false })
          .where(and(eq(investmentCriteriaProfiles.orgId, orgId), sql`id != ${id}`));
      }
      
      const [profile] = await db.update(investmentCriteriaProfiles)
        .set({ ...profileData, updatedAt: new Date() })
        .where(eq(investmentCriteriaProfiles.id, id))
        .returning();
      
      // Upsert sub-tables: delete + re-insert
      const upsert = async (table: any, data: any) => {
        if (!data) return;
        await db.delete(table).where(eq(table.profileId, id));
        await db.insert(table).values({ ...data, profileId: id, orgId });
      };
      
      await upsert(investmentCriteriaLocation, location);
      await upsert(investmentCriteriaFinancial, financial);
      await upsert(investmentCriteriaOperational, operational);
      await upsert(investmentCriteriaSize, size);
      await upsert(investmentCriteriaCapital, capital);
      await upsert(investmentCriteriaInvolvement, involvement);
      
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete profile (cascade deletes sub-tables via FK)
  app.delete("/api/investment-criteria/:id", async (req, res) => {
    try {
      await db.delete(investmentCriteriaProfiles).where(eq(investmentCriteriaProfiles.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
'''

# Check if routes already exist
if '/api/investment-criteria' not in r:
    # Find the last route section — insert before the final closing
    # Look for a good anchor point
    anchor = r.rfind('app.get("/')
    if anchor < 0:
        anchor = r.rfind('app.post("/')
    
    # Find the end of that route handler
    insert_point = r.find('\n  });', anchor) + len('\n  });')
    
    if insert_point > 10:
        r = r[:insert_point] + '\n' + criteria_routes + r[insert_point:]
        changes += 1
        print("  OK Added 6 investment criteria API routes")
    else:
        print("  WARN: Could not find insertion point in routes.ts")
else:
    print("  SKIP: Investment criteria routes already exist")

# Add imports for the criteria tables
if 'investmentCriteriaProfiles' not in r:
    # Find the schema import block
    schema_import = r.find("from '@shared/schema'")
    if schema_import < 0:
        schema_import = r.find('from "@shared/schema"')
    
    if schema_import > 0:
        # Find the closing of the import
        import_end = r.find(';', schema_import)
        if import_end > 0:
            new_imports = ', investmentCriteriaProfiles, investmentCriteriaLocation, investmentCriteriaFinancial, investmentCriteriaOperational, investmentCriteriaSize, investmentCriteriaCapital, investmentCriteriaInvolvement'
            # Insert before the closing quote
            close_brace = r.rfind('}', 0, schema_import + 50)
            if close_brace < 0:
                close_brace = r.rfind("'", 0, schema_import)
            
            # Actually just append to the import destructure
            r = r[:import_end] + '\n// Investment Criteria tables\nimport { investmentCriteriaProfiles, investmentCriteriaLocation, investmentCriteriaFinancial, investmentCriteriaOperational, investmentCriteriaSize, investmentCriteriaCapital, investmentCriteriaInvolvement } from "@shared/schema";\n' + r[import_end:]
            changes += 1
            print("  OK Added schema imports for criteria tables")
else:
    print("  SKIP: Criteria table imports already present")

write(ROUTES, r)
print(f"\n=== Criteria Routes: {changes} patches ===")
