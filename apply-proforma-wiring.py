"""
Frontend Wiring: Deal Pricing + Capital Stack → Pro Forma
==========================================================
1. Deal Pricing: Add "Solve from Pro Forma" button that calls 
   POST /api/deal-pricing/solve-from-pro-forma
2. Capital Stack: Wire the existing "Generate Projections" to 
   also offer the from-pro-forma endpoint

Run from workspace root: python3 apply-proforma-wiring.py
"""

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0

# ================================================================
# DEAL PRICING: Add "Solve from Pro Forma" button
# ================================================================
print("=== 1. Wire Deal Pricing to Pro Forma ===")
DP = "client/src/pages/modeling/projects/workspace/deal-pricing.tsx"
dp = read(DP)

# Find the calculateMutation and add a proFormaSolveMutation after it
old_calc_mutation = """  const calculateMutation = useMutation({
    mutationFn: async (inputs: any) => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/deal-pricing/unified`, inputs);
      return res.json() as Promise<UnifiedPricingResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
    },
  });"""

new_calc_mutation = """  const calculateMutation = useMutation({
    mutationFn: async (inputs: any) => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/deal-pricing/unified`, inputs);
      return res.json() as Promise<UnifiedPricingResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
    },
  });

  // Pro Forma-based pricing: uses actual projected cash flows instead of simple NOI growth
  const proFormaSolveMutation = useMutation({
    mutationFn: async (params: { targetIrr: number; scenario?: string }) => {
      const res = await apiRequest('POST', `/api/deal-pricing/solve-from-pro-forma`, {
        method: 'POST',
        body: JSON.stringify({ projectId, targetIrr: params.targetIrr, scenario: params.scenario || 'base' }),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      if (data.solvedPrice) {
        toast({ title: 'Pro Forma Price Solved', description: `Solved price: $${Math.round(data.solvedPrice).toLocaleString()} at ${(data.targetIrr * 100).toFixed(1)}% IRR` });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Pro Forma solve failed', description: error.message, variant: 'destructive' });
    },
  });"""

if 'proFormaSolveMutation' not in dp and old_calc_mutation in dp:
    dp = dp.replace(old_calc_mutation, new_calc_mutation, 1)
    changes += 1
    print("  OK Added proFormaSolveMutation to deal-pricing.tsx")

# Add a "Solve from Pro Forma" button near the existing Pro Forma Engine badges
# Find the Return Metrics card header where Pro Forma badge is shown
old_proforma_badge = """                {pricingData.usedProFormaData && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Pro Forma Engine
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Purchase Price</p>
                  <p className="num text-2xl font-bold" data-testid="text-result-price">
                    {formatCurrency(pricingData.purchasePrice)}
                  </p>"""

new_proforma_badge = """                {pricingData.usedProFormaData && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Pro Forma Engine
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const targetIrr = parseFloat(pricingData.targetIRR?.toString() || '15') / 100;
                    proFormaSolveMutation.mutate({ targetIrr });
                  }}
                  disabled={proFormaSolveMutation.isPending}
                >
                  {proFormaSolveMutation.isPending ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Calculator className="h-3 w-3 mr-1" />
                  )}
                  Solve from Pro Forma
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Pro Forma solve result */}
              {proFormaSolveMutation.data && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium text-sm text-indigo-800">Pro Forma-Based Price</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Solved Price</span>
                      <p className="font-bold text-indigo-700">{formatCurrency(proFormaSolveMutation.data.solvedPrice)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Target IRR</span>
                      <p className="font-medium">{((proFormaSolveMutation.data.targetIrr || 0) * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Equity Multiple</span>
                      <p className="font-medium">{(proFormaSolveMutation.data.equityMultiple || 0).toFixed(2)}x</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Going-In Cap</span>
                      <p className="font-medium">{((proFormaSolveMutation.data.goingInCapRate || 0) * 100).toFixed(2)}%</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => {
                      const price = proFormaSolveMutation.data.solvedPrice;
                      if (price) saveMutation.mutate({ purchasePrice: Math.round(price) });
                    }}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save as Purchase Price
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Purchase Price</p>
                  <p className="num text-2xl font-bold" data-testid="text-result-price">
                    {formatCurrency(pricingData.purchasePrice)}
                  </p>"""

if 'proFormaSolveMutation' in dp and 'Solve from Pro Forma' not in dp and old_proforma_badge in dp:
    dp = dp.replace(old_proforma_badge, new_proforma_badge, 1)
    changes += 1
    print("  OK Added 'Solve from Pro Forma' button + result display")

# Ensure Save import exists
if "'lucide-react'" in dp and 'Save' not in dp.split("from 'lucide-react'")[0]:
    # Add Save to lucide imports
    lucide_end = dp.find("} from 'lucide-react';")
    if lucide_end > 0 and 'Save,' not in dp[:lucide_end]:
        dp = dp[:lucide_end] + ', Save' + dp[lucide_end:]
        changes += 1
        print("  OK Added Save to lucide-react imports")

write(DP, dp)

# ================================================================
# CAPITAL STACK: Ensure the Pro Forma sync button works correctly
# ================================================================
print("\n=== 2. Verify Capital Stack Pro Forma sync ===")
cs = read("client/src/pages/modeling/projects/workspace/capital-stack.tsx")

# The "Sync from Pro Forma" button was added in Part 1. Check it exists.
if 'Sync from Pro Forma' in cs:
    print("  OK Capital Stack Pro Forma sync already wired")
else:
    print("  WARN: Pro Forma sync button not found in capital stack")

# Check if the button calls the right endpoint
if '/projections/from-pro-forma' in cs:
    print("  OK Endpoint reference found")
else:
    print("  WARN: Endpoint reference not found - may need manual check")

print(f"\n=== Pro Forma Wiring: {changes} patches ===")
