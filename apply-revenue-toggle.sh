#!/usr/bin/env bash
set -euo pipefail

ENGINE="server/services/pro-forma-engine-service.ts"
MAIN_ROUTES="server/routes.ts"

echo "=== Revenue Source Toggle ==="

# STEP 1: Patch engine
echo "Patching $ENGINE ..."
cp "$ENGINE" "${ENGINE}.pre-toggle.bak"

python3 << 'PY_ENGINE'
import sys
FILE = "server/services/pro-forma-engine-service.ts"
with open(FILE, "r") as f:
    content = f.read()

OLD_START = """  private async enrichFromProfitCenters(
    projectId: string,
    revenueBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>,
    cogsBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>,
    expensesBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>
  ): Promise<void> {
    const addRevenue = (name: string, amount: number, dept?: string) => {
      if (amount <= 0) return;
      const key = \`PC: \${name}\`;
      if (!revenueBySubcat[key]) {
        revenueBySubcat[key] = { amount: 0, category: 'Revenue', subcategory: key, department: dept };
      }
      revenueBySubcat[key].amount += amount;
    };

    const addCOGS = (name: string, amount: number, dept?: string) => {
      if (amount <= 0) return;
      const key = \`PC: \${name} COGS\`;
      if (!cogsBySubcat[key]) {
        cogsBySubcat[key] = { amount: 0, category: 'COGS', subcategory: key, department: dept };
      }
      cogsBySubcat[key].amount += amount;
    };

    try {"""

NEW_START = """  private async enrichFromProfitCenters(
    projectId: string,
    revenueBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>,
    cogsBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>,
    expensesBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>
  ): Promise<void> {
    // ── Read per-department revenue source toggle ──────────────
    let revenueSourceByDept: Record<string, string> = {};
    try {
      const [proj] = await db.select({ customMetrics: modelingProjects.customMetrics })
        .from(modelingProjects)
        .where(eq(modelingProjects.id, projectId));
      const cfg = (proj?.customMetrics as any) || {};
      revenueSourceByDept = cfg.revenueSourceByDept || {};
    } catch {}

    const useProfitCenter = (dept: string): boolean => {
      return revenueSourceByDept[dept] !== 'pnl_actuals';
    };

    const removePnlActualsForDept = (dept: string) => {
      for (const [key, entry] of Object.entries(revenueBySubcat)) {
        if (entry.department === dept && !key.startsWith('PC: ')) delete revenueBySubcat[key];
      }
      for (const [key, entry] of Object.entries(cogsBySubcat)) {
        if (entry.department === dept && !key.startsWith('PC: ')) delete cogsBySubcat[key];
      }
      for (const [key, entry] of Object.entries(expensesBySubcat)) {
        if (entry.department === dept && !key.startsWith('PC: ')) delete expensesBySubcat[key];
      }
    };

    const addRevenue = (name: string, amount: number, dept?: string) => {
      if (amount <= 0) return;
      const key = \`PC: \${name}\`;
      if (!revenueBySubcat[key]) {
        revenueBySubcat[key] = { amount: 0, category: 'Revenue', subcategory: key, department: dept };
      }
      revenueBySubcat[key].amount += amount;
    };

    const addCOGS = (name: string, amount: number, dept?: string) => {
      if (amount <= 0) return;
      const key = \`PC: \${name} COGS\`;
      if (!cogsBySubcat[key]) {
        cogsBySubcat[key] = { amount: 0, category: 'COGS', subcategory: key, department: dept };
      }
      cogsBySubcat[key].amount += amount;
    };

    try {"""

if OLD_START not in content:
    print("ERROR: enrichFromProfitCenters start not found"); sys.exit(1)
content = content.replace(OLD_START, NEW_START, 1)

# Now wrap each profit center block with useProfitCenter check
PAIRS = [
    ("      if (fuelRows.length > 0) {", "      if (fuelRows.length > 0 && useProfitCenter('Fuel')) {\n        removePnlActualsForDept('Fuel');"),
    ("      if (storeRows.length > 0) {", "      if (storeRows.length > 0 && useProfitCenter('Ship Store')) {\n        removePnlActualsForDept('Ship Store');"),
    ("      if (serviceRows.length > 0) {", "      if (serviceRows.length > 0 && useProfitCenter('Service')) {\n        removePnlActualsForDept('Service');"),
    ("      if (rentalRows.length > 0) {", "      if (rentalRows.length > 0 && useProfitCenter('Boat Rentals')) {\n        removePnlActualsForDept('Boat Rentals');"),
    ("      if (clubRows.length > 0) {", "      if (clubRows.length > 0 && useProfitCenter('Boat Club')) {\n        removePnlActualsForDept('Boat Club');"),
    ("      if (salesRows.length > 0) {", "      if (salesRows.length > 0 && useProfitCenter('Boat Sales')) {\n        removePnlActualsForDept('Boat Sales');"),
    ("      if (tenantRows.length > 0) {", "      if (tenantRows.length > 0 && useProfitCenter('Commercial')) {"),
    ("      if (bkRows.length > 0) {", "      if (bkRows.length > 0 && useProfitCenter('Bookkeeping')) {\n        removePnlActualsForDept('Bookkeeping');"),
]

for old, new in PAIRS:
    if old in content:
        content = content.replace(old, new, 1)

# Add removePnlActualsForDept before Commercial Tenants addRevenue
content = content.replace(
    "          const totalRev = tenantRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);\n          addRevenue('Commercial Tenants', totalRev, 'Commercial');",
    "          removePnlActualsForDept('Commercial');\n          const totalRev = tenantRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);\n          addRevenue('Commercial Tenants', totalRev, 'Commercial');",
    1
)

print("  ✓ Patched enrichFromProfitCenters with toggle logic")
with open(FILE, "w") as f:
    f.write(content)
PY_ENGINE

# STEP 2: Patch main routes
echo "Patching $MAIN_ROUTES ..."
cp "$MAIN_ROUTES" "${MAIN_ROUTES}.pre-toggle.bak"

python3 << 'PY_ROUTES'
import sys
FILE = "server/routes.ts"
with open(FILE, "r") as f:
    content = f.read()

MARKER = "res.status(500).json({ error: 'Failed to delete document' });"
if MARKER not in content:
    print("  ERROR: Could not find delete document error handler"); sys.exit(1)

idx = content.index(MARKER)
close_idx = content.index("  });", idx)
insert_at = close_idx + len("  });")

ENDPOINTS = """

  // ─── Revenue Source Toggle (Profit Center vs P&L Actuals per dept) ────
  app.get('/api/modeling/projects/:projectId/revenue-source-config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const cm = (project.customMetrics as any) || {};
      const revenueSourceByDept = cm.revenueSourceByDept || {};

      const { asmpFuel, asmpShipStore, asmpService, asmpBoatRentals,
              asmpBoatClub, asmpBoatSales, asmpCommercialTenants, asmpBookkeeping } = await import('@shared/schema');

      const [fuel, store, service, rentals, club, sales, tenants, bk] = await Promise.all([
        db.select({ id: asmpFuel.id }).from(asmpFuel).where(eq(asmpFuel.projectId, projectId)).limit(1),
        db.select({ id: asmpShipStore.id }).from(asmpShipStore).where(eq(asmpShipStore.projectId, projectId)).limit(1),
        db.select({ id: asmpService.id }).from(asmpService).where(eq(asmpService.projectId, projectId)).limit(1),
        db.select({ id: asmpBoatRentals.id }).from(asmpBoatRentals).where(eq(asmpBoatRentals.projectId, projectId)).limit(1),
        db.select({ id: asmpBoatClub.id }).from(asmpBoatClub).where(eq(asmpBoatClub.projectId, projectId)).limit(1),
        db.select({ id: asmpBoatSales.id }).from(asmpBoatSales).where(eq(asmpBoatSales.projectId, projectId)).limit(1),
        db.select({ id: asmpCommercialTenants.id }).from(asmpCommercialTenants).where(eq(asmpCommercialTenants.projectId, projectId)).limit(1),
        db.select({ id: asmpBookkeeping.id }).from(asmpBookkeeping).where(eq(asmpBookkeeping.projectId, projectId)).limit(1),
      ]);

      const departments = [
        { dept: 'Fuel', label: 'Fuel Sales', hasProfitCenterData: fuel.length > 0, source: revenueSourceByDept['Fuel'] || 'profit_center' },
        { dept: 'Ship Store', label: 'Ship Store', hasProfitCenterData: store.length > 0, source: revenueSourceByDept['Ship Store'] || 'profit_center' },
        { dept: 'Service', label: 'Service Department', hasProfitCenterData: service.length > 0, source: revenueSourceByDept['Service'] || 'profit_center' },
        { dept: 'Boat Rentals', label: 'Boat Rentals', hasProfitCenterData: rentals.length > 0, source: revenueSourceByDept['Boat Rentals'] || 'profit_center' },
        { dept: 'Boat Club', label: 'Boat Club', hasProfitCenterData: club.length > 0, source: revenueSourceByDept['Boat Club'] || 'profit_center' },
        { dept: 'Boat Sales', label: 'Boat Sales', hasProfitCenterData: sales.length > 0, source: revenueSourceByDept['Boat Sales'] || 'profit_center' },
        { dept: 'Commercial', label: 'Commercial Tenants', hasProfitCenterData: tenants.length > 0, source: revenueSourceByDept['Commercial'] || 'profit_center' },
        { dept: 'Bookkeeping', label: 'Bookkeeping', hasProfitCenterData: bk.length > 0, source: revenueSourceByDept['Bookkeeping'] || 'profit_center' },
      ];

      res.json({ departments, revenueSourceByDept });
    } catch (error: any) {
      console.error('Failed to get revenue source config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/modeling/projects/:projectId/revenue-source-config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { revenueSourceByDept } = req.body;

      if (!revenueSourceByDept || typeof revenueSourceByDept !== 'object') {
        return res.status(400).json({ error: 'revenueSourceByDept object is required' });
      }

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const existingMetrics = (project.customMetrics as any) || {};
      const updatedMetrics = { ...existingMetrics, revenueSourceByDept };
      await storage.updateModelingProject(projectId, { customMetrics: updatedMetrics, updatedBy: userId }, orgId);

      res.json({ success: true, revenueSourceByDept });
    } catch (error: any) {
      console.error('Failed to update revenue source config:', error);
      res.status(500).json({ error: error.message });
    }
  });"""

content = content[:insert_at] + ENDPOINTS + content[insert_at:]
print("  ✓ Added revenue source config endpoints")

with open(FILE, "w") as f:
    f.write(content)
print(f"  Patched: {FILE}")
PY_ROUTES

# STEP 3: Create React component
mkdir -p client/src/components/modeling
cat > client/src/components/modeling/RevenueSourceToggle.tsx << 'TSX_EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Database, FileSpreadsheet, Loader2 } from 'lucide-react';

interface DeptConfig {
  dept: string;
  label: string;
  hasProfitCenterData: boolean;
  source: 'profit_center' | 'pnl_actuals';
}

interface RevenueSourceConfigResponse {
  departments: DeptConfig[];
  revenueSourceByDept: Record<string, string>;
}

export function RevenueSourceToggle({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<RevenueSourceConfigResponse>({
    queryKey: ['/api/modeling/projects', projectId, 'revenue-source-config'],
    enabled: !!projectId,
  });

  const mutation = useMutation({
    mutationFn: (revenueSourceByDept: Record<string, string>) =>
      apiRequest('PATCH', `/api/modeling/projects/${projectId}/revenue-source-config`, { revenueSourceByDept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'revenue-source-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      toast({ title: 'Updated', description: 'Revenue source preference saved. Pro Forma will update.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update revenue source.', variant: 'destructive' });
    },
  });

  const handleToggle = (dept: string, useProfitCenter: boolean) => {
    const current = data?.revenueSourceByDept || {};
    const updated = { ...current, [dept]: useProfitCenter ? 'profit_center' : 'pnl_actuals' };
    mutation.mutate(updated);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const activeDepts = (data?.departments || []).filter(d => d.hasProfitCenterData);
  if (activeDepts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" />
          Revenue Data Source
        </CardTitle>
        <CardDescription>
          Choose whether each department uses data from Profit Center modules or uploaded P&amp;L documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeDepts.map((dept) => (
            <div key={dept.dept} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{dept.label}</span>
                <Badge variant={dept.source === 'profit_center' ? 'default' : 'secondary'} className="text-xs">
                  {dept.source === 'profit_center' ? (
                    <><Database className="h-3 w-3 mr-1" /> Profit Center</>
                  ) : (
                    <><FileSpreadsheet className="h-3 w-3 mr-1" /> P&L Actuals</>
                  )}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">P&amp;L</span>
                <Switch
                  checked={dept.source === 'profit_center'}
                  onCheckedChange={(checked) => handleToggle(dept.dept, checked)}
                  disabled={mutation.isPending}
                />
                <span className="text-xs text-muted-foreground">PC</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
TSX_EOF
echo "✓ Created RevenueSourceToggle component"

echo ""
echo "Done! Verify: npx tsc --noEmit"
echo ""
echo "To add the toggle to your Pro Forma tab:"
echo "  import { RevenueSourceToggle } from '@/components/modeling/RevenueSourceToggle';"
echo "  <RevenueSourceToggle projectId={projectId} />"
