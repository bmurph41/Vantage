"""
Smart Equity Layer — Auto-Populate & Dynamic Partners
======================================================
1. Auto-calculate Total Equity = Purchase Price - Total Debt
2. Solo investor → 100% ownership auto-set
3. Partnership/JV/GP-LP → dynamic partner rows with add/remove
4. Reactively updates when debt or purchase price changes

Run from workspace root: python3 apply-smart-equity.py
"""
import os

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
CS = "client/src/pages/modeling/projects/workspace/capital-stack.tsx"
c = read(CS)

# ================================================================
# 1. Add computed equity values + reactive auto-populate
# ================================================================
print("=== 1. Add computed equity + auto-populate logic ===")

old_layer_type = "  const layerType = equityForm.watch('layerType');"
new_layer_type = """  const layerType = equityForm.watch('layerType');

  // ── Smart Equity: Auto-calculate from purchase price & debt ──
  const purchasePrice = parseNumber(stackDetails?.stack?.purchasePrice) || 0;
  const computedEquity = Math.max(0, purchasePrice - totalDebt);
  const hasComputedEquity = purchasePrice > 0;

  // Dynamic partner rows for Partnership/JV structures
  const [equityPartners, setEquityPartners] = useState<{
    id: string;
    name: string;
    role: 'gp' | 'lp' | 'partner';
    amount: string;
    ownershipPct: string;
  }[]>([]);

  // Initialize partner rows when equity type changes
  useEffect(() => {
    if (layerType === 'solo' && !editingEquity) {
      // Solo: auto-fill total equity and 100% ownership
      if (hasComputedEquity) {
        equityForm.setValue('commitmentAmount', String(Math.round(computedEquity)));
      }
      equityForm.setValue('ownershipPct', '100');
      setEquityPartners([]);
    } else if (layerType === 'partnership' && !editingEquity) {
      // Partnership: 2 partners, split equity evenly
      if (equityPartners.length === 0) {
        const halfEquity = Math.round(computedEquity / 2);
        setEquityPartners([
          { id: crypto.randomUUID(), name: 'Partner 1', role: 'partner', amount: hasComputedEquity ? String(halfEquity) : '', ownershipPct: '50' },
          { id: crypto.randomUUID(), name: 'Partner 2', role: 'partner', amount: hasComputedEquity ? String(halfEquity) : '', ownershipPct: '50' },
        ]);
      }
      if (hasComputedEquity) {
        equityForm.setValue('commitmentAmount', String(Math.round(computedEquity)));
      }
    } else if ((layerType === 'promote' || layerType === 'co_invest') && !editingEquity) {
      // GP/LP structures: default GP 10% / LP 90%
      if (equityPartners.length === 0) {
        const gpAmount = Math.round(computedEquity * 0.1);
        const lpAmount = Math.round(computedEquity * 0.9);
        setEquityPartners([
          { id: crypto.randomUUID(), name: 'GP Sponsor', role: 'gp', amount: hasComputedEquity ? String(gpAmount) : '', ownershipPct: '10' },
          { id: crypto.randomUUID(), name: 'LP Investor', role: 'lp', amount: hasComputedEquity ? String(lpAmount) : '', ownershipPct: '90' },
        ]);
      }
      if (hasComputedEquity) {
        equityForm.setValue('commitmentAmount', String(Math.round(computedEquity)));
      }
    }
  }, [layerType]);

  // Reactively update commitment when debt or purchase price changes
  useEffect(() => {
    if (hasComputedEquity && !editingEquity) {
      const currentType = equityForm.getValues('layerType');
      equityForm.setValue('commitmentAmount', String(Math.round(computedEquity)));
      
      // Redistribute among partners
      if (equityPartners.length > 0) {
        setEquityPartners(prev => prev.map(p => {
          const pct = parseFloat(p.ownershipPct) || 0;
          return { ...p, amount: String(Math.round(computedEquity * pct / 100)) };
        }));
      }
    }
  }, [computedEquity]);

  // Partner helper functions
  const addEquityPartner = () => {
    const remaining = 100 - equityPartners.reduce((s, p) => s + (parseFloat(p.ownershipPct) || 0), 0);
    setEquityPartners([...equityPartners, {
      id: crypto.randomUUID(),
      name: layerType === 'promote' || layerType === 'co_invest'
        ? `LP Investor ${equityPartners.filter(p => p.role === 'lp').length + 1}`
        : `Partner ${equityPartners.length + 1}`,
      role: layerType === 'promote' || layerType === 'co_invest' ? 'lp' : 'partner',
      amount: hasComputedEquity ? String(Math.round(computedEquity * Math.max(0, remaining) / 100)) : '',
      ownershipPct: String(Math.max(0, remaining).toFixed(1)),
    }]);
  };

  const removeEquityPartner = (id: string) => {
    if (equityPartners.length > 2) {
      setEquityPartners(equityPartners.filter(p => p.id !== id));
    }
  };

  const updateEquityPartner = (id: string, field: string, value: string) => {
    setEquityPartners(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      // When ownership % changes, recalc amount
      if (field === 'ownershipPct' && hasComputedEquity) {
        updated.amount = String(Math.round(computedEquity * (parseFloat(value) || 0) / 100));
      }
      // When amount changes, recalc ownership %
      if (field === 'amount' && computedEquity > 0) {
        updated.ownershipPct = ((parseFloat(value) || 0) / computedEquity * 100).toFixed(1);
      }
      return updated;
    }));
  };

  const totalPartnerOwnership = equityPartners.reduce((s, p) => s + (parseFloat(p.ownershipPct) || 0), 0);
  const totalPartnerAmount = equityPartners.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);"""

if 'computedEquity' not in c and old_layer_type in c:
    c = c.replace(old_layer_type, new_layer_type, 1)
    changes += 1
    print("  ✓ Added computed equity, auto-populate, reactive updates, partner helpers")

# ================================================================
# 2. Replace the Contribution tab content with smart version
# ================================================================
print("\n=== 2. Upgrade Contribution tab with smart equity ===")

old_contribution_tab = """                                <TabsContent value="contribution" className="space-y-4 mt-0">
                                  <Card className="p-4 bg-blue-50/50">
                                    <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
                                      <DollarSign className="h-4 w-4 text-blue-600" />
                                      {layerType === 'solo' ? 'Your Equity Investment' : layerType === 'partnership' ? 'Partnership Equity' : 'Capital Contribution Details'}
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                      <FormField control={equityForm.control} name="commitmentAmount" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>{layerType === 'solo' || layerType === 'partnership' ? 'Total Equity *' : 'Capital Commitment *'}</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" placeholder="5,000,000" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>{layerType === 'solo' || layerType === 'partnership' ? 'Purchase price minus debt' : 'Total committed capital'}</FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                      {needsAdvancedTabs(layerType) && (
                                      <FormField control={equityForm.control} name="fundedAmount" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Funded to Date</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" placeholder="5,000,000" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>Capital already called</FormDescription>
                                        </FormItem>
                                      )} />
                                      )}
                                      <FormField control={equityForm.control} name="ownershipPct" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Ownership Percentage *</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" step="0.01" placeholder="90" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>Enter as % (e.g., 90 for 90%)</FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                    </div>

                                    {/* Funding Progress */}
                                    <div className="mt-4 p-3 bg-white rounded-lg border">
                                      <div className="flex justify-between text-sm mb-2">
                                        <span className="text-muted-foreground">Funding Progress</span>
                                        <span className="font-medium">
                                          {equityForm.watch('fundedAmount') && equityForm.watch('commitmentAmount') 
                                            ? `${((parseFloat(equityForm.watch('fundedAmount') || '0') / parseFloat(equityForm.watch('commitmentAmount') || '1')) * 100).toFixed(0)}%`
                                            : '0%'}
                                        </span>
                                      </div>
                                      <Progress 
                                        value={
                                          equityForm.watch('fundedAmount') && equityForm.watch('commitmentAmount')
                                            ? (parseFloat(equityForm.watch('fundedAmount') || '0') / parseFloat(equityForm.watch('commitmentAmount') || '1')) * 100
                                            : 0
                                        } 
                                        className="h-2"
                                      />
                                    </div>
                                  </Card>
                                </TabsContent>"""

new_contribution_tab = """                                <TabsContent value="contribution" className="space-y-4 mt-0">
                                  <Card className="p-4 bg-blue-50/50">
                                    <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
                                      <DollarSign className="h-4 w-4 text-blue-600" />
                                      {layerType === 'solo' ? 'Your Equity Investment' : layerType === 'partnership' ? 'Partnership Equity' : 'Capital Contribution Details'}
                                    </h4>

                                    {/* Auto-calculated equity summary */}
                                    {hasComputedEquity && (
                                      <div className="mb-4 p-3 bg-white rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Info className="h-3.5 w-3.5 text-blue-500" />
                                          <span className="text-xs font-medium text-blue-700">Auto-Calculated from Capital Stack</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                          <div>
                                            <span className="text-muted-foreground text-xs">Purchase Price</span>
                                            <p className="font-semibold">${purchasePrice.toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground text-xs">Total Debt</span>
                                            <p className="font-semibold text-red-600">({totalDebt.toLocaleString()})</p>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground text-xs">Required Equity</span>
                                            <p className="font-bold text-green-600">${computedEquity.toLocaleString()}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Total Equity + Ownership (always shown) */}
                                    <div className="grid grid-cols-3 gap-4">
                                      <FormField control={equityForm.control} name="commitmentAmount" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>{layerType === 'solo' || layerType === 'partnership' ? 'Total Equity *' : 'Capital Commitment *'}</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" placeholder="5,000,000" className={`pl-9 bg-white ${hasComputedEquity ? 'border-green-300 bg-green-50/30' : ''}`} />
                                            </div>
                                          </FormControl>
                                          <FormDescription>{hasComputedEquity ? 'Auto-filled: Purchase Price − Debt' : 'Total equity required'}</FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                      {needsAdvancedTabs(layerType) && (
                                      <FormField control={equityForm.control} name="fundedAmount" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Funded to Date</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" placeholder="5,000,000" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>Capital already called</FormDescription>
                                        </FormItem>
                                      )} />
                                      )}
                                      <FormField control={equityForm.control} name="ownershipPct" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Ownership Percentage *</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" step="0.01" placeholder="90" className={`pl-9 bg-white ${layerType === 'solo' ? 'border-green-300 bg-green-50/30' : ''}`}
                                                readOnly={layerType === 'solo'} />
                                            </div>
                                          </FormControl>
                                          <FormDescription>{layerType === 'solo' ? 'Auto-set to 100%' : 'Enter as % (e.g., 90 for 90%)'}</FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                    </div>

                                    {/* Dynamic Partner Rows — for Partnership/JV/GP-LP structures */}
                                    {equityPartners.length > 0 && (
                                      <div className="mt-4">
                                        <div className="flex justify-between items-center mb-3">
                                          <h5 className="text-sm font-medium flex items-center gap-2">
                                            <Users className="h-4 w-4 text-blue-600" />
                                            {layerType === 'partnership' ? 'Partners' : 'Equity Participants'}
                                          </h5>
                                          <Button type="button" variant="outline" size="sm" onClick={addEquityPartner} className="bg-white">
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Add {layerType === 'partnership' ? 'Partner' : 'Investor'}
                                          </Button>
                                        </div>
                                        <div className="space-y-2">
                                          {equityPartners.map((partner, idx) => (
                                            <div key={partner.id} className="p-3 bg-white rounded-lg border flex items-center gap-3">
                                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                                <span className="text-xs font-bold text-blue-700">{idx + 1}</span>
                                              </div>
                                              <div className="flex-1 grid grid-cols-4 gap-3">
                                                <div>
                                                  <Label className="text-xs">Name</Label>
                                                  <Input
                                                    value={partner.name}
                                                    onChange={(e) => updateEquityPartner(partner.id, 'name', e.target.value)}
                                                    placeholder="Partner name"
                                                    className="h-8 text-sm mt-1"
                                                  />
                                                </div>
                                                <div>
                                                  <Label className="text-xs">Role</Label>
                                                  <Select value={partner.role} onValueChange={(v) => updateEquityPartner(partner.id, 'role', v)}>
                                                    <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                      {layerType === 'partnership' ? (
                                                        <SelectItem value="partner">Partner</SelectItem>
                                                      ) : (
                                                        <>
                                                          <SelectItem value="gp">GP</SelectItem>
                                                          <SelectItem value="lp">LP</SelectItem>
                                                        </>
                                                      )}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                                <div>
                                                  <Label className="text-xs">Amount ($)</Label>
                                                  <Input
                                                    type="number"
                                                    value={partner.amount}
                                                    onChange={(e) => updateEquityPartner(partner.id, 'amount', e.target.value)}
                                                    placeholder="0"
                                                    className="h-8 text-sm mt-1"
                                                  />
                                                </div>
                                                <div className="flex items-end gap-1">
                                                  <div className="flex-1">
                                                    <Label className="text-xs">Ownership %</Label>
                                                    <Input
                                                      type="number"
                                                      step="0.1"
                                                      value={partner.ownershipPct}
                                                      onChange={(e) => updateEquityPartner(partner.id, 'ownershipPct', e.target.value)}
                                                      placeholder="0"
                                                      className="h-8 text-sm mt-1"
                                                    />
                                                  </div>
                                                  {equityPartners.length > 2 && (
                                                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                                                      onClick={() => removeEquityPartner(partner.id)}>
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Partner totals validation */}
                                        <div className={`mt-3 p-2 rounded-lg border text-xs flex justify-between items-center ${Math.abs(totalPartnerOwnership - 100) < 0.1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                          <span>
                                            Total: ${totalPartnerAmount.toLocaleString()} commitment / {totalPartnerOwnership.toFixed(1)}% ownership
                                          </span>
                                          {Math.abs(totalPartnerOwnership - 100) >= 0.1 && (
                                            <span className="font-medium">⚠ Ownership must total 100%</span>
                                          )}
                                          {Math.abs(totalPartnerOwnership - 100) < 0.1 && (
                                            <span className="font-medium">✓ Balanced</span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Funding Progress (for advanced types) */}
                                    {needsAdvancedTabs(layerType) && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border">
                                      <div className="flex justify-between text-sm mb-2">
                                        <span className="text-muted-foreground">Funding Progress</span>
                                        <span className="font-medium">
                                          {equityForm.watch('fundedAmount') && equityForm.watch('commitmentAmount') 
                                            ? `${((parseFloat(equityForm.watch('fundedAmount') || '0') / parseFloat(equityForm.watch('commitmentAmount') || '1')) * 100).toFixed(0)}%`
                                            : '0%'}
                                        </span>
                                      </div>
                                      <Progress 
                                        value={
                                          equityForm.watch('fundedAmount') && equityForm.watch('commitmentAmount')
                                            ? (parseFloat(equityForm.watch('fundedAmount') || '0') / parseFloat(equityForm.watch('commitmentAmount') || '1')) * 100
                                            : 0
                                        } 
                                        className="h-2"
                                      />
                                    </div>
                                    )}
                                  </Card>
                                </TabsContent>"""

if old_contribution_tab in c:
    c = c.replace(old_contribution_tab, new_contribution_tab, 1)
    changes += 1
    print("  ✓ Upgraded Contribution tab: auto-calc summary, smart fields, dynamic partner rows")

# ================================================================
# 3. Reset partner rows when dialog closes
# ================================================================
print("\n=== 3. Reset partner rows on dialog close ===")

old_dialog_close = """                        setShowAddEquity(open);
                        if (!open) {
                          setEditingEquity(null);
                          equityForm.reset();
                          setPromoteTiers([{ irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }]);
                        }"""

new_dialog_close = """                        setShowAddEquity(open);
                        if (!open) {
                          setEditingEquity(null);
                          equityForm.reset();
                          setPromoteTiers([{ irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }]);
                          setEquityPartners([]);
                        }"""

if old_dialog_close in c and 'setEquityPartners([])' not in c:
    c = c.replace(old_dialog_close, new_dialog_close, 1)
    changes += 1
    print("  ✓ Partner rows reset when dialog closes")

# ================================================================
# 4. Add Users import if missing
# ================================================================
print("\n=== 4. Ensure Users icon imported ===")

if 'Users' not in c.split('from')[0] and 'Users' not in c[:3000]:
    # Find the lucide-react import
    lucide_import = "} from 'lucide-react';"
    if lucide_import in c:
        # Check if Users is already in the import
        import_block_end = c.find(lucide_import)
        import_block_start = c.rfind('import {', 0, import_block_end)
        import_block = c[import_block_start:import_block_end + len(lucide_import)]
        if 'Users' not in import_block:
            c = c[:import_block_end] + ', Users' + c[import_block_end:]
            changes += 1
            print("  ✓ Added Users to lucide-react imports")
        else:
            print("  ✓ Users already imported")
    else:
        print("  ⚠ Could not find lucide-react import block")
else:
    print("  ✓ Users already imported")

write(CS, c)

print(f"\n=== DONE: {changes} patches ===")
print("")
print("  Features added:")
print("  ✓ Auto-calc banner: Purchase Price − Debt = Required Equity")
print("  ✓ Solo investor: Total Equity auto-filled, Ownership locked at 100%")
print("  ✓ Partnership: 2 partner rows (50/50), add/remove button, name/role/amount/pct")
print("  ✓ GP/LP (promote/co_invest): GP 10% / LP 90% default split")
print("  ✓ Bidirectional sync: change % → recalc $, change $ → recalc %")
print("  ✓ Ownership validation: green ✓ when 100%, amber ⚠ otherwise")
print("  ✓ Reactive: amounts recalc when debt tranches or purchase price change")
print("  ✓ Dialog reset: partner rows clear on close")
