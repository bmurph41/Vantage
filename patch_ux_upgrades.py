#!/usr/bin/env python3
"""
4 UX upgrades:
  #1: Upload page - import status per document  
  #2: Revenue source toggle - show dollar amounts
  #3: Overview - data completeness from real queries
  #4: Validation warnings - real data-driven checks
"""
import os, sys

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

ROUTES = "server/routes.ts"
UPLOADS = "client/src/pages/modeling/projects/workspace/uploads.tsx"
OVERVIEW = "client/src/pages/modeling/projects/workspace/overview.tsx"
VALIDATION = "client/src/pages/modeling/projects/workspace/validation-warnings.tsx"
TOGGLE = "client/src/components/modeling/RevenueSourceToggle.tsx"

changes = 0

# ================================================================
# #1: Upload page - import status per document
# ================================================================
print("\n=== #1: Upload import status ===")

# 1a: Backend - add imported count to stats query
c = read(ROUTES)

old_q = """          lowConfidence: sql<number>`count(*) filter (where ${docIntelExtractedItems.confidenceScore}::numeric < 0.8)::int`,
        })"""
new_q = """          lowConfidence: sql<number>`count(*) filter (where ${docIntelExtractedItems.confidenceScore}::numeric < 0.8)::int`,
          imported: sql<number>`count(*) filter (where ${docIntelExtractedItems.targetRecordId} is not null)::int`,
        })"""
if old_q in c and 'imported:' not in c.split('lowConfidence')[1].split('})')[0]:
    c = c.replace(old_q, new_q, 1)
    changes += 1
    print("  ✓ Added imported count to stats SQL query")

old_map_type = "total: number; pending: number; confirmed: number; rejected: number; needsReview: number; highConfidence: number; lowConfidence: number"
new_map_type = "total: number; pending: number; confirmed: number; rejected: number; needsReview: number; highConfidence: number; lowConfidence: number; imported: number"
if old_map_type in c and new_map_type not in c:
    c = c.replace(old_map_type, new_map_type, 1)
    changes += 1
    print("  ✓ Updated statsMap type")

old_assign = """            highConfidence: row.highConfidence,
            lowConfidence: row.lowConfidence,
          };"""
new_assign = """            highConfidence: row.highConfidence,
            lowConfidence: row.lowConfidence,
            imported: row.imported || 0,
          };"""
if old_assign in c:
    c = c.replace(old_assign, new_assign, 1)
    changes += 1
    print("  ✓ Added imported to statsMap assignment")

write(ROUTES, c)

# 1b: Frontend - upload cards
c = read(UPLOADS)

old_iface = """  stats?: {
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    needsReview: number;
    highConfidence: number;
    lowConfidence: number;
  };"""
new_iface = """  stats?: {
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    needsReview: number;
    highConfidence: number;
    lowConfidence: number;
    imported: number;
  };"""
if old_iface in c:
    c = c.replace(old_iface, new_iface, 1)
    changes += 1
    print("  ✓ Updated UploadWithStats interface")

# Enhance completed cards
old_completed = """                          ? `${upload.stats.confirmed} of ${upload.stats.total} line items imported`
                          : 'Import complete'}"""
new_completed = """                          ? `${upload.stats.confirmed} confirmed, ${upload.stats.imported || 0} imported to P&L${upload.stats.confirmed > 0 && (upload.stats.imported || 0) < upload.stats.confirmed ? ' \u26a0\ufe0f' : ' \u2713'}`
                          : 'Import complete'}"""
if old_completed in c:
    c = c.replace(old_completed, new_completed, 1)
    changes += 1
    print("  ✓ Enhanced completed card status text")

# Add import indicator to pending cards
old_pending = """                          <Progress value={getProgressValue(upload)} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">"""
new_pending = """                          <Progress value={getProgressValue(upload)} className="h-1.5" />
                        </div>
                      )}
                      {upload.stats && (upload.stats.imported || 0) > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-green-600">{upload.stats.imported} items imported to Historical P&L</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">"""
if old_pending in c:
    c = c.replace(old_pending, new_pending, 1)
    changes += 1
    print("  ✓ Added import count to pending upload cards")

write(UPLOADS, c)

# ================================================================
# #2: Revenue source toggle - show dollar amounts
# ================================================================
print("\n=== #2: Revenue source dollar amounts ===")

# 2a: Backend - add amounts to revenue-source-config
c = read(ROUTES)

old_dept_list = """      const departments = [
        { dept: 'Fuel', label: 'Fuel Sales', hasProfitCenterData: fuel.length > 0, source: revenueSourceByDept['Fuel'] || 'profit_center' },
        { dept: 'Ship Store', label: 'Ship Store', hasProfitCenterData: store.length > 0, source: revenueSourceByDept['Ship Store'] || 'profit_center' },
        { dept: 'Service', label: 'Service Department', hasProfitCenterData: service.length > 0, source: revenueSourceByDept['Service'] || 'profit_center' },
        { dept: 'Boat Rentals', label: 'Boat Rentals', hasProfitCenterData: rentals.length > 0, source: revenueSourceByDept['Boat Rentals'] || 'profit_center' },
        { dept: 'Boat Club', label: 'Boat Club', hasProfitCenterData: club.length > 0, source: revenueSourceByDept['Boat Club'] || 'profit_center' },
        { dept: 'Boat Sales', label: 'Boat Sales', hasProfitCenterData: sales.length > 0, source: revenueSourceByDept['Boat Sales'] || 'profit_center' },
        { dept: 'Commercial', label: 'Commercial Tenants', hasProfitCenterData: tenants.length > 0, source: revenueSourceByDept['Commercial'] || 'profit_center' },
        { dept: 'Bookkeeping', label: 'Bookkeeping', hasProfitCenterData: bk.length > 0, source: revenueSourceByDept['Bookkeeping'] || 'profit_center' },
      ];

      res.json({ departments, revenueSourceByDept });"""

new_dept_list = """      // Compute PC revenue totals
      const pcAmounts: Record<string, number> = {};
      pcAmounts['Fuel'] = fuel.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
      pcAmounts['Ship Store'] = store.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
      pcAmounts['Service'] = service.reduce((s: number, r: any) => s + Number(r.totalRevenue || 0), 0);
      pcAmounts['Boat Rentals'] = rentals.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
      pcAmounts['Boat Club'] = club.reduce((s: number, r: any) => s + Number(r.monthlyRecurringRevenue || 0), 0);
      pcAmounts['Boat Sales'] = sales.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
      pcAmounts['Commercial'] = tenants.reduce((s: number, r: any) => s + Number(r.totalRevenue || 0), 0);
      pcAmounts['Bookkeeping'] = bk.reduce((s: number, r: any) => s + Number(r.revenueTotalOverride || 0), 0);

      // Compute P&L actuals totals per department
      const { modelingActuals } = await import('@shared/schema');
      const pnlRows = await db.select({
        department: modelingActuals.department,
        total: sql<number>`sum(${modelingActuals.amount}::numeric)::float`,
      })
        .from(modelingActuals)
        .where(and(
          eq(modelingActuals.modelingProjectId, projectId),
          eq(modelingActuals.category, 'Revenue')
        ))
        .groupBy(modelingActuals.department);

      const pnlAmounts: Record<string, number> = {};
      for (const row of pnlRows) {
        if (row.department) pnlAmounts[row.department] = Math.round(row.total || 0);
      }

      const departments = [
        { dept: 'Fuel', label: 'Fuel Sales', hasProfitCenterData: fuel.length > 0, source: revenueSourceByDept['Fuel'] || 'profit_center', pcAmount: pcAmounts['Fuel'] || 0, pnlAmount: pnlAmounts['Fuel'] || 0 },
        { dept: 'Ship Store', label: 'Ship Store', hasProfitCenterData: store.length > 0, source: revenueSourceByDept['Ship Store'] || 'profit_center', pcAmount: pcAmounts['Ship Store'] || 0, pnlAmount: pnlAmounts['Ship Store'] || 0 },
        { dept: 'Service', label: 'Service Department', hasProfitCenterData: service.length > 0, source: revenueSourceByDept['Service'] || 'profit_center', pcAmount: pcAmounts['Service'] || 0, pnlAmount: pnlAmounts['Service'] || 0 },
        { dept: 'Boat Rentals', label: 'Boat Rentals', hasProfitCenterData: rentals.length > 0, source: revenueSourceByDept['Boat Rentals'] || 'profit_center', pcAmount: pcAmounts['Boat Rentals'] || 0, pnlAmount: pnlAmounts['Boat Rentals'] || 0 },
        { dept: 'Boat Club', label: 'Boat Club', hasProfitCenterData: club.length > 0, source: revenueSourceByDept['Boat Club'] || 'profit_center', pcAmount: pcAmounts['Boat Club'] || 0, pnlAmount: pnlAmounts['Boat Club'] || 0 },
        { dept: 'Boat Sales', label: 'Boat Sales', hasProfitCenterData: sales.length > 0, source: revenueSourceByDept['Boat Sales'] || 'profit_center', pcAmount: pcAmounts['Boat Sales'] || 0, pnlAmount: pnlAmounts['Boat Sales'] || 0 },
        { dept: 'Commercial', label: 'Commercial Tenants', hasProfitCenterData: tenants.length > 0, source: revenueSourceByDept['Commercial'] || 'profit_center', pcAmount: pcAmounts['Commercial'] || 0, pnlAmount: pnlAmounts['Commercial'] || 0 },
        { dept: 'Bookkeeping', label: 'Bookkeeping', hasProfitCenterData: bk.length > 0, source: revenueSourceByDept['Bookkeeping'] || 'profit_center', pcAmount: pcAmounts['Bookkeeping'] || 0, pnlAmount: pnlAmounts['Bookkeeping'] || 0 },
      ];

      res.json({ departments, revenueSourceByDept });"""

if old_dept_list in c:
    c = c.replace(old_dept_list, new_dept_list, 1)
    write(ROUTES, c)
    changes += 1
    print("  ✓ Added pcAmount/pnlAmount to revenue-source-config response")
else:
    print("  SKIP 2a: department list pattern not found in routes")

# 2b: Frontend - show amounts in toggle
if os.path.exists(TOGGLE):
    c = read(TOGGLE)

    old_dept_iface = """  hasProfitCenterData: boolean;
  source: 'profit_center' | 'pnl_actuals';
}"""
    new_dept_iface = """  hasProfitCenterData: boolean;
  source: 'profit_center' | 'pnl_actuals';
  pcAmount?: number;
  pnlAmount?: number;
}"""
    if 'pcAmount' not in c and old_dept_iface in c:
        c = c.replace(old_dept_iface, new_dept_iface, 1)
        changes += 1
        print("  ✓ Updated DeptConfig interface with amounts")

    # Add formatK helper after imports
    if 'formatK' not in c:
        old_import_end = "import { Database, FileSpreadsheet, Loader2 } from 'lucide-react';"
        new_import_end = """import { Database, FileSpreadsheet, Loader2 } from 'lucide-react';

const formatK = (n: number) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};"""
        if old_import_end in c:
            c = c.replace(old_import_end, new_import_end, 1)
            changes += 1
            print("  ✓ Added formatK helper")

    # Add amount display after badge
    old_badge_block = """                <Badge variant={dept.source === 'profit_center' ? 'default' : 'secondary'} className="text-xs">
                  {dept.source === 'profit_center' ? (
                    <><Database className="h-3 w-3 mr-1" /> Profit Center</>
                  ) : (
                    <><FileSpreadsheet className="h-3 w-3 mr-1" /> P&L Actuals</>
                  )}
                </Badge>
              </div>"""
    new_badge_block = """                <Badge variant={dept.source === 'profit_center' ? 'default' : 'secondary'} className="text-xs">
                  {dept.source === 'profit_center' ? (
                    <><Database className="h-3 w-3 mr-1" /> Profit Center</>
                  ) : (
                    <><FileSpreadsheet className="h-3 w-3 mr-1" /> P&L Actuals</>
                  )}
                </Badge>
                {((dept.pcAmount || 0) > 0 || (dept.pnlAmount || 0) > 0) && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    PC {formatK(dept.pcAmount || 0)} / P&L {formatK(dept.pnlAmount || 0)}
                  </span>
                )}
              </div>"""
    if old_badge_block in c:
        c = c.replace(old_badge_block, new_badge_block, 1)
        changes += 1
        print("  ✓ Added dollar amounts to toggle rows")

    write(TOGGLE, c)
else:
    print(f"  SKIP 2b: {TOGGLE} not found")

# ================================================================
# #3: Overview - real data completeness
# ================================================================
print("\n=== #3: Overview data completeness ===")

c = read(OVERVIEW)

# Add actualsYears query
old_queries = """  const { data: uploads = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', project.id, 'documents'],
  });"""
new_queries = """  const { data: uploads = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', project.id, 'documents'],
  });

  const { data: actualsYears = [] } = useQuery<string[]>({
    queryKey: ['/api/modeling/projects', project.id, 'actuals/years'],
    enabled: !!project.id,
  });"""
if 'actualsYears' not in c and old_queries in c:
    c = c.replace(old_queries, new_queries, 1)
    changes += 1
    print("  ✓ Added actualsYears query")

# Update completeness flags
old_flags = """  const hasConfig = config?.holdPeriod && config?.seasonMonths?.length > 0;
  const hasUploads = uploads.length > 0;
  const hasCompletedUploads = uploads.some((u: any) => u.status === 'completed');
  const hasAssumptions = assumptions?.growthRates && Object.keys(assumptions.growthRates).length > 0;
  const hasHistoricalData = hasCompletedUploads;"""
new_flags = """  const hasConfig = config?.holdPeriod && config?.seasonMonths?.length > 0;
  const hasUploads = uploads.length > 0;
  const hasCompletedUploads = uploads.some((u: any) => u.status === 'completed');
  const hasReviewedUploads = uploads.some((u: any) => u.stats?.imported > 0);
  const hasAssumptions = assumptions?.growthRates && Object.keys(assumptions.growthRates).length > 0;
  const hasHistoricalData = actualsYears.length > 0;"""
if old_flags in c:
    c = c.replace(old_flags, new_flags, 1)
    changes += 1
    print("  ✓ Enhanced completeness checks with real data")

# Update upload step
old_upload_step = """      id: 'uploads',
      title: 'Upload Documents',
      description: 'Upload P&L statements and rent rolls for AI parsing',
      tab: 'uploads',
      icon: <Upload className="h-5 w-5" />,
      status: hasCompletedUploads ? 'complete' : hasUploads ? 'in-progress' : 'pending',"""
new_upload_step = """      id: 'uploads',
      title: 'Upload Documents',
      description: uploads.length > 0 ? `${uploads.length} document${uploads.length > 1 ? 's' : ''} uploaded${hasReviewedUploads ? ', imported to P&L' : ''}` : 'Upload P&L statements and rent rolls for AI parsing',
      tab: 'uploads',
      icon: <Upload className="h-5 w-5" />,
      status: hasReviewedUploads ? 'complete' : hasCompletedUploads ? 'in-progress' : hasUploads ? 'in-progress' : 'pending',"""
if old_upload_step in c:
    c = c.replace(old_upload_step, new_upload_step, 1)
    changes += 1
    print("  ✓ Upload step shows document count")

# Update historical step
old_hist_step = """      id: 'historical',
      title: 'Review Historical P&L',
      description: 'Verify categorized historical data by month',
      tab: 'historical',
      icon: <FileSpreadsheet className="h-5 w-5" />,
      status: hasHistoricalData ? 'complete' : hasAssumptions ? 'in-progress' : 'pending',"""
new_hist_step = """      id: 'historical',
      title: 'Review Historical P&L',
      description: actualsYears.length > 0 ? `Historical data for ${actualsYears.join(', ')}` : 'Verify categorized historical data by month',
      tab: 'historical',
      icon: <FileSpreadsheet className="h-5 w-5" />,
      status: hasHistoricalData ? 'complete' : hasReviewedUploads ? 'in-progress' : 'pending',"""
if old_hist_step in c:
    c = c.replace(old_hist_step, new_hist_step, 1)
    changes += 1
    print("  ✓ Historical step shows available years")

write(OVERVIEW, c)

# ================================================================
# #4: Validation warnings - real endpoint + remove simulated
# ================================================================
print("\n=== #4: Real validation warnings ===")

# 4a: Backend endpoint
c = read(ROUTES)
if "validation-warnings" not in c:
    marker = "res.json({ success: true, revenueSourceByDept });"
    idx = c.rfind(marker)
    if idx > 0:
        close_idx = c.index("  });", idx)
        insert_at = close_idx + len("  });")

        VALIDATION_ENDPOINT = '''

  // ─── Model Validation Warnings (data-driven) ────
  app.get('/api/modeling/projects/:projectId/validation-warnings', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const warnings: Array<{id: string; severity: string; category: string; title: string; message: string; recommendation?: string; value?: string; threshold?: string}> = [];
      let warnId = 0;
      const warn = (severity: string, category: string, title: string, message: string, recommendation?: string, value?: string, threshold?: string) => {
        warnings.push({ id: String(++warnId), severity, category, title, message, recommendation, value, threshold });
      };

      const { modelingActuals, docIntelUploads, docIntelExtractedItems } = await import('@shared/schema');

      // Check 1: No actuals at all
      const actualsCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(modelingActuals)
        .where(and(eq(modelingActuals.modelingProjectId, projectId), eq(modelingActuals.orgId, orgId)));
      const totalActuals = actualsCount[0]?.count || 0;

      if (totalActuals === 0) {
        warn('warning', 'inputs', 'No Historical Data', 'No actuals have been imported yet. Upload and review P&L documents to populate historical data.', 'Go to Uploads tab and upload your P&L statements.');
      }

      // Check 2: Confirmed but not imported items per upload
      const uploads = await db.select({
        id: docIntelUploads.id,
        name: docIntelUploads.originalName,
      }).from(docIntelUploads).where(and(
        eq(docIntelUploads.modelingProjectId, projectId),
        eq(docIntelUploads.orgId, orgId)
      ));

      for (const upload of uploads) {
        const itemStats = await db.select({
          confirmed: sql<number>`count(*) filter (where ${docIntelExtractedItems.status} = 'confirmed')::int`,
          imported: sql<number>`count(*) filter (where ${docIntelExtractedItems.targetRecordId} is not null)::int`,
          pending: sql<number>`count(*) filter (where ${docIntelExtractedItems.status} = 'pending')::int`,
        }).from(docIntelExtractedItems).where(eq(docIntelExtractedItems.uploadId, upload.id));

        const stats = itemStats[0] || { confirmed: 0, imported: 0, pending: 0 };
        if (stats.confirmed > 0 && stats.imported === 0) {
          warn('critical', 'inputs', 'Confirmed Items Not Imported',
            (upload.name || 'Document') + ' has ' + stats.confirmed + ' confirmed items that have not been imported to actuals.',
            'Click "Refresh Actuals" on the Historical P&L tab to reimport.',
            stats.confirmed + ' confirmed', '0 imported');
        }
        if (stats.pending > 5) {
          warn('info', 'inputs', 'Items Pending Review',
            (upload.name || 'Document') + ' has ' + stats.pending + ' items still pending review.',
            'Review remaining items to ensure all data is captured.');
        }
      }

      // Check 3: Missing department assignments
      const noDeptActuals = await db.select({ count: sql<number>`count(*)::int` })
        .from(modelingActuals)
        .where(and(
          eq(modelingActuals.modelingProjectId, projectId),
          or(isNull(modelingActuals.department), eq(modelingActuals.department, ''))
        ));
      const noDeptCount = noDeptActuals[0]?.count || 0;
      if (noDeptCount > 0) {
        warn('warning', 'inputs', 'Missing Department Assignments',
          noDeptCount + ' actuals line items have no department assigned, which affects department-level Pro Forma projections.',
          'Review document classifications in doc-intel and re-import.',
          noDeptCount + ' items', 'All should be assigned');
      }

      // Check 4: Revenue source toggle conflicts
      const project = await storage.getModelingProject(projectId, orgId);
      const cm = (project?.customMetrics as any) || {};
      const revenueSourceByDept = cm.revenueSourceByDept || {};
      for (const [dept, src] of Object.entries(revenueSourceByDept)) {
        if (src !== 'pnl_actuals') continue;
        const deptActuals = await db.select({ count: sql<number>`count(*)::int` })
          .from(modelingActuals)
          .where(and(
            eq(modelingActuals.modelingProjectId, projectId),
            eq(modelingActuals.department, dept),
            eq(modelingActuals.category, 'Revenue')
          ));
        if ((deptActuals[0]?.count || 0) === 0) {
          warn('warning', 'revenue', dept + ' Set to P&L but No Data',
            dept + ' is configured to use P&L actuals, but no revenue data exists for this department.',
            'Either upload P&L data with ' + dept + ' line items, or switch back to Profit Center.');
        }
      }

      // Check 5: Negative revenue items (likely miscategorized)
      const suspiciousRevenue = await db.select({ count: sql<number>`count(*)::int` })
        .from(modelingActuals)
        .where(and(
          eq(modelingActuals.modelingProjectId, projectId),
          eq(modelingActuals.category, 'Revenue'),
          sql`${modelingActuals.amount}::numeric < -1000`
        ));
      if ((suspiciousRevenue[0]?.count || 0) > 3) {
        warn('warning', 'inputs', 'Negative Revenue Items',
          (suspiciousRevenue[0]?.count || 0) + ' revenue line items have large negative values, which may indicate miscategorized expenses.',
          'Review these items in doc-intel and correct category assignments.',
          (suspiciousRevenue[0]?.count || 0) + ' items', '0 expected');
      }

      const score = Math.max(0, 100
        - (warnings.filter(w => w.severity === 'critical').length * 20)
        - (warnings.filter(w => w.severity === 'warning').length * 10)
        - (warnings.filter(w => w.severity === 'info').length * 2));

      res.json({
        isValid: warnings.filter(w => w.severity === 'critical').length === 0,
        score,
        warnings,
        summary: {
          critical: warnings.filter(w => w.severity === 'critical').length,
          warning: warnings.filter(w => w.severity === 'warning').length,
          info: warnings.filter(w => w.severity === 'info').length,
        }
      });
    } catch (error: any) {
      console.error('Failed to generate validation warnings:', error);
      res.status(500).json({ error: error.message });
    }
  });'''

        c = c[:insert_at] + VALIDATION_ENDPOINT + c[insert_at:]
        write(ROUTES, c)
        changes += 1
        print("  ✓ Added /validation-warnings endpoint with 5 real data checks")
    else:
        print("  SKIP 4a: insertion point not found")
else:
    print("  SKIP 4a: validation-warnings endpoint already exists")

# 4b: Frontend - remove simulated fallback
c = read(VALIDATION)

old_query = """    queryFn: async () => {
      const response = await fetch(`/api/modeling/projects/${projectId}/validation-warnings`);
      if (!response.ok) {
        return generateSimulatedValidation();
      }
      return response.json();
    },"""
new_query = """    queryFn: async () => {
      const response = await fetch(`/api/modeling/projects/${projectId}/validation-warnings`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch validation');
      return response.json();
    },"""
if old_query in c:
    c = c.replace(old_query, new_query, 1)
    changes += 1
    print("  ✓ Switched to real endpoint (removed simulated fallback)")

# Remove the generateSimulatedValidation function
sim_start = "\n  const generateSimulatedValidation = (): ValidationResult => {"
sim_end = "  };\n\n  const toggleCategory"
if sim_start in c and sim_end in c:
    idx_start = c.index(sim_start)
    idx_end = c.index(sim_end)
    replacement_end = idx_end + len("  };\n")
    c = c[:idx_start] + "\n" + c[replacement_end:]
    changes += 1
    print("  ✓ Removed generateSimulatedValidation function")

write(VALIDATION, c)

print(f"\n=== COMPLETE: {changes} patches applied ===")
print("  #1: Upload cards show imported count + status indicator")
print("  #2: Revenue toggle shows PC $X / P&L $Y per department")
print("  #3: Overview steps show real document counts and years")
print("  #4: Validation warnings driven by actual DB state (5 checks)")
print("\nVerify: NODE_OPTIONS=\"--max-old-space-size=8192\" npx tsc --noEmit")
