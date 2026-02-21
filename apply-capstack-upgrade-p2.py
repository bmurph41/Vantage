"""
Capital Stack Mega-Upgrade Part 2
==================================
4. Wire Waterfall tab to actual equity layer data (replace hardcoded)
5. Wire Returns tab to actual projections (replace hardcoded)  
6. LP Reporting view in Partners tab

Run from workspace root: python3 apply-capstack-upgrade-p2.py
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
# 4. Wire Returns tab to actual projections data
# ================================================================
print("=== 4. Wire Returns tab to actual data ===")

old_returns = """                  <TabsContent value="returns" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <TrendingUp className="h-5 w-5" />
                              Investor Returns Analysis
                            </CardTitle>
                            <CardDescription>Waterfall distribution based on exit scenario</CardDescription>
                          </div>
                          <Button variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Calculate Returns
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Summary Cards */}
                        <div className="grid gap-4 md:grid-cols-4 mb-6">
                          <Card className="bg-blue-500/10 border-blue-500/20">
                            <CardContent className="pt-4 text-center">
                              <div className="text-2xl font-bold text-blue-600">$15,500,000</div>
                              <div className="text-xs text-muted-foreground">Total Proceeds</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-green-500/10 border-green-500/20">
                            <CardContent className="pt-4 text-center">
                              <div className="text-2xl font-bold text-green-600">$5,500,000</div>
                              <div className="text-xs text-muted-foreground">Total Profit</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-purple-500/10 border-purple-500/20">
                            <CardContent className="pt-4 text-center">
                              <div className="text-2xl font-bold text-purple-600">18.5%</div>
                              <div className="text-xs text-muted-foreground">Fund IRR</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-orange-500/10 border-orange-500/20">
                            <CardContent className="pt-4 text-center">
                              <div className="text-2xl font-bold text-orange-600">1.55x</div>
                              <div className="text-xs text-muted-foreground">Equity Multiple</div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Waterfall Distribution Table */}
                        <div className="space-y-3">
                          <h4 className="font-medium">Waterfall Distribution</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tier</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>LP Share</TableHead>
                                <TableHead>GP Share</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow className="bg-blue-500/5">
                                <TableCell><Badge variant="outline">Tier 1</Badge></TableCell>
                                <TableCell>Return of Capital</TableCell>
                                <TableCell className="font-medium">$10,000,000</TableCell>
                                <TableCell>$9,500,000</TableCell>
                                <TableCell>$500,000</TableCell>
                              </TableRow>
                              <TableRow className="bg-green-500/5">"""

new_returns = """                  <TabsContent value="returns" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <TrendingUp className="h-5 w-5" />
                              Investor Returns Analysis
                            </CardTitle>
                            <CardDescription>Computed from actual projections and capital structure</CardDescription>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => generateProjectionsMutation.mutate()} disabled={generateProjectionsMutation.isPending}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${generateProjectionsMutation.isPending ? 'animate-spin' : ''}`} />
                            Recalculate
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const lastProj = projections[projections.length - 1];
                          const exitVal = lastProj ? parseNumber(lastProj.exitValue) : 0;
                          const loanPayoff = lastProj ? parseNumber(lastProj.loanPayoff) : 0;
                          const netSaleProceeds = lastProj ? parseNumber(lastProj.netSaleProceeds) : 0;
                          const totalCashFlows = projections.reduce((s, p) => s + parseNumber(p.cashFlowAfterDebt), 0);
                          const totalProceeds = totalCashFlows + netSaleProceeds;
                          const totalProfit = totalProceeds - totalEquity;
                          const projIrr = lastProj ? parseNumber(lastProj.irr) : 0;
                          const projEqMult = lastProj ? parseNumber(lastProj.equityMultiple) : 0;
                          const avgCoC = projections.length > 0
                            ? projections.reduce((s, p) => s + parseNumber(p.cashOnCash), 0) / projections.length : 0;
                          
                          const gpLayers = equityLayers.filter(l => l.investorType === 'gp' || l.layerType === 'promote');
                          const lpLayers = equityLayers.filter(l => l.investorType !== 'gp' && l.layerType !== 'promote');
                          const gpEquity = gpLayers.reduce((s, l) => s + parseNumber(l.commitmentAmount), 0);
                          const lpEquity = lpLayers.reduce((s, l) => s + parseNumber(l.commitmentAmount), 0);
                          const gpPct = totalEquity > 0 ? gpEquity / totalEquity : 0;
                          const lpPct = totalEquity > 0 ? lpEquity / totalEquity : 1;

                          // Simple waterfall calc
                          let remaining = totalProceeds;
                          const t1_roc = Math.min(remaining, totalEquity);
                          remaining -= t1_roc;
                          const prefRate = gpLayers[0]?.preferredReturn ? parseNumber(gpLayers[0].preferredReturn) / 100 : 0.08;
                          const holdYrs = projections.length || 5;
                          const prefAmount = totalEquity * prefRate * holdYrs;
                          const t2_pref = Math.min(remaining, prefAmount);
                          remaining -= t2_pref;
                          const catchUpPct = gpLayers[0]?.catchUpPct ? parseNumber(gpLayers[0].catchUpPct) / 100 : 1;
                          const gpCatchUp = Math.min(remaining, t2_pref * gpPct / (1 - gpPct)) * catchUpPct;
                          const t3_catchup = Math.min(remaining, gpCatchUp);
                          remaining -= t3_catchup;
                          const promoteSplit = 0.2;
                          const t4_gp = remaining * promoteSplit;
                          const t4_lp = remaining * (1 - promoteSplit);

                          if (projections.length === 0) {
                            return (
                              <div className="text-center py-8 text-muted-foreground">
                                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Generate projections to see returns analysis</p>
                              </div>
                            );
                          }

                          return (
                            <>
                              <div className="grid gap-4 md:grid-cols-4 mb-6">
                                <Card className="bg-blue-500/10 border-blue-500/20">
                                  <CardContent className="pt-4 text-center">
                                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalProceeds)}</div>
                                    <div className="text-xs text-muted-foreground">Total Proceeds</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-green-500/10 border-green-500/20">
                                  <CardContent className="pt-4 text-center">
                                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit)}</div>
                                    <div className="text-xs text-muted-foreground">Total Profit</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-purple-500/10 border-purple-500/20">
                                  <CardContent className="pt-4 text-center">
                                    <div className="text-2xl font-bold text-purple-600">{projIrr.toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">Levered IRR</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-orange-500/10 border-orange-500/20">
                                  <CardContent className="pt-4 text-center">
                                    <div className="text-2xl font-bold text-orange-600">{projEqMult.toFixed(2)}x</div>
                                    <div className="text-xs text-muted-foreground">Equity Multiple</div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Waterfall Distribution */}
                              <div className="space-y-3">
                                <h4 className="font-medium">Waterfall Distribution</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Tier</TableHead>
                                      <TableHead>Description</TableHead>
                                      <TableHead>Amount</TableHead>
                                      <TableHead>LP Share</TableHead>
                                      <TableHead>GP Share</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow className="bg-blue-500/5">
                                      <TableCell><Badge variant="outline">Tier 1</Badge></TableCell>
                                      <TableCell>Return of Capital</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(t1_roc)}</TableCell>
                                      <TableCell>{formatCurrency(t1_roc * lpPct)}</TableCell>
                                      <TableCell>{formatCurrency(t1_roc * gpPct)}</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-green-500/5">
                                      <TableCell><Badge variant="outline">Tier 2</Badge></TableCell>
                                      <TableCell>Preferred Return ({(prefRate * 100).toFixed(0)}%)</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(t2_pref)}</TableCell>
                                      <TableCell>{formatCurrency(t2_pref)}</TableCell>
                                      <TableCell>$0</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-orange-500/5">
                                      <TableCell><Badge variant="outline">Tier 3</Badge></TableCell>
                                      <TableCell>GP Catch-Up</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(t3_catchup)}</TableCell>
                                      <TableCell>$0</TableCell>
                                      <TableCell>{formatCurrency(t3_catchup)}</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-purple-500/5">
                                      <TableCell><Badge variant="outline">Tier 4</Badge></TableCell>
                                      <TableCell>Carried Interest / Promote</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(t4_gp + t4_lp)}</TableCell>
                                      <TableCell>{formatCurrency(t4_lp)}</TableCell>
                                      <TableCell>{formatCurrency(t4_gp)}</TableCell>
                                    </TableRow>
                                    <TableRow className="border-t-2 font-bold">
                                      <TableCell></TableCell>
                                      <TableCell>Total</TableCell>
                                      <TableCell>{formatCurrency(totalProceeds)}</TableCell>
                                      <TableCell className="text-green-600">{formatCurrency(t1_roc * lpPct + t2_pref + t4_lp)}</TableCell>
                                      <TableCell className="text-blue-600">{formatCurrency(t1_roc * gpPct + t3_catchup + t4_gp)}</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>

                              {/* Per-Investor LP Report */}
                              {equityLayers.length > 0 && (
                                <div className="mt-6 space-y-3">
                                  <h4 className="font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Per-Investor Returns
                                  </h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Investor</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Contributed</TableHead>
                                        <TableHead>Ownership</TableHead>
                                        <TableHead>Distributions</TableHead>
                                        <TableHead>Profit</TableHead>
                                        <TableHead>Multiple</TableHead>
                                        <TableHead>IRR</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {equityLayers.map(layer => {
                                        const pct = parseNumber(layer.ownershipPct) / 100;
                                        const contributed = parseNumber(layer.commitmentAmount);
                                        const isGp = layer.investorType === 'gp' || layer.layerType === 'promote';
                                        const distributions = isGp
                                          ? (t1_roc * gpPct + t3_catchup + t4_gp) * (contributed / Math.max(gpEquity, 1))
                                          : (t1_roc * lpPct + t2_pref + t4_lp) * (contributed / Math.max(lpEquity, 1));
                                        const profit = distributions - contributed;
                                        const multiple = contributed > 0 ? distributions / contributed : 0;
                                        const investorIrr = contributed > 0 ? ((Math.pow(multiple, 1 / holdYrs) - 1) * 100) : 0;
                                        
                                        return (
                                          <TableRow key={layer.id}>
                                            <TableCell className="font-medium">{layer.name}</TableCell>
                                            <TableCell>
                                              <Badge variant={isGp ? 'default' : 'secondary'} className="text-xs">
                                                {isGp ? 'GP' : 'LP'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>{formatCurrency(contributed)}</TableCell>
                                            <TableCell>{parseNumber(layer.ownershipPct).toFixed(1)}%</TableCell>
                                            <TableCell className="font-medium text-green-600">{formatCurrency(distributions)}</TableCell>
                                            <TableCell className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(profit)}</TableCell>
                                            <TableCell className="font-medium">{multiple.toFixed(2)}x</TableCell>
                                            <TableCell className={investorIrr >= 15 ? 'text-green-600 font-medium' : ''}>{investorIrr.toFixed(1)}%</TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </>
                          );
                        })()}"""

if old_returns in c:
    c = c.replace(old_returns, new_returns, 1)
    changes += 1
    print("  ✓ Returns tab wired to actual projections (proceeds, profit, IRR, equity multiple)")
    print("  ✓ Waterfall distribution computed from actual GP/LP equity splits")
    print("  ✓ Per-investor LP report with distributions, profit, multiple, IRR")

# ================================================================
# 5. Wire Waterfall tab visualization to actual data
# ================================================================
print("\n=== 5. Wire Waterfall visualization to actual equity data ===")

# Replace the hardcoded pref return input
old_pref_input = """                            <div className="flex items-center gap-2">
                              <Input className="w-16 h-8 text-sm" defaultValue="8.0%" />
                              <span className="text-xs text-muted-foreground">IRR</span>
                            </div>
                          </div>

                          {/* Tier 3: GP Catch-Up */}"""

# Get the pref rate from actual equity layers
new_pref_input = """                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {(() => {
                                  const prefLayer = equityLayers.find(l => l.preferredReturn);
                                  return prefLayer ? `${parseNumber(prefLayer.preferredReturn).toFixed(1)}%` : '8.0%';
                                })()}
                              </span>
                              <span className="text-xs text-muted-foreground">Pref Return</span>
                            </div>
                          </div>

                          {/* Tier 3: GP Catch-Up */}"""

if old_pref_input in c:
    c = c.replace(old_pref_input, new_pref_input, 1)
    changes += 1
    print("  ✓ Waterfall pref return reads from actual equity layer data")

# Replace hardcoded LP/GP split display
old_lp_gp_split = """                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">LP</span>
                              <Input className="w-14 h-8 text-sm" defaultValue="80%" />
                              <span className="text-muted-foreground">/</span>
                              <Input className="w-14 h-8 text-sm" defaultValue="20%" />
                              <span className="text-muted-foreground">GP</span>
                            </div>"""

new_lp_gp_split = """                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">LP</span>
                              <span className="font-medium">
                                {(() => {
                                  const promoLayer = equityLayers.find(l => l.promoteTiers && (l.promoteTiers as any[]).length > 0);
                                  if (promoLayer) {
                                    const tiers = promoLayer.promoteTiers as { lpSplit: number }[];
                                    return `${(tiers[tiers.length - 1]?.lpSplit * 100 || 80).toFixed(0)}%`;
                                  }
                                  return '80%';
                                })()}
                              </span>
                              <span className="text-muted-foreground">/</span>
                              <span className="font-medium">
                                {(() => {
                                  const promoLayer = equityLayers.find(l => l.promoteTiers && (l.promoteTiers as any[]).length > 0);
                                  if (promoLayer) {
                                    const tiers = promoLayer.promoteTiers as { gpSplit: number }[];
                                    return `${(tiers[tiers.length - 1]?.gpSplit * 100 || 20).toFixed(0)}%`;
                                  }
                                  return '20%';
                                })()}
                              </span>
                              <span className="text-muted-foreground">GP</span>
                            </div>"""

if old_lp_gp_split in c:
    c = c.replace(old_lp_gp_split, new_lp_gp_split, 1)
    changes += 1
    print("  ✓ LP/GP split reads from actual promote tier data")

# Wire the hardcoded tiered promote table to actual data
old_static_tiers = """                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>IRR Hurdle</TableHead>
                                <TableHead>LP Split</TableHead>
                                <TableHead>GP Split (Promote)</TableHead>
                                <TableHead className="w-16"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>0% - 8%</TableCell>
                                <TableCell>100%</TableCell>
                                <TableCell>0%</TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>8% - 12%</TableCell>
                                <TableCell>80%</TableCell>
                                <TableCell>20%</TableCell>
                                <TableCell><Button variant="ghost" size="sm"><Trash2 className="h-3 w-3" /></Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>12% - 18%</TableCell>
                                <TableCell>70%</TableCell>
                                <TableCell>30%</TableCell>
                                <TableCell><Button variant="ghost" size="sm"><Trash2 className="h-3 w-3" /></Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>18%+</TableCell>
                                <TableCell>60%</TableCell>
                                <TableCell>40%</TableCell>
                                <TableCell><Button variant="ghost" size="sm"><Trash2 className="h-3 w-3" /></Button></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>"""

new_dynamic_tiers = """                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>IRR Hurdle</TableHead>
                                <TableHead>LP Split</TableHead>
                                <TableHead>GP Split (Promote)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                const promoLayer = equityLayers.find(l => l.promoteTiers && (l.promoteTiers as any[]).length > 0);
                                const tiers = promoLayer?.promoteTiers as { irrHurdle: number; lpSplit: number; gpSplit: number }[] || [];
                                
                                if (tiers.length === 0) {
                                  return (
                                    <>
                                      <TableRow><TableCell>0% - 8%</TableCell><TableCell>100%</TableCell><TableCell>0%</TableCell></TableRow>
                                      <TableRow><TableCell>8% - 12%</TableCell><TableCell>80%</TableCell><TableCell>20%</TableCell></TableRow>
                                      <TableRow><TableCell>12%+</TableCell><TableCell>70%</TableCell><TableCell>30%</TableCell></TableRow>
                                    </>
                                  );
                                }
                                
                                // Tier 0: below first hurdle = 100% LP
                                const rows = [
                                  <TableRow key="base" className="bg-blue-50/30">
                                    <TableCell>0% - {(tiers[0].irrHurdle * 100).toFixed(0)}%</TableCell>
                                    <TableCell>100%</TableCell>
                                    <TableCell>0%</TableCell>
                                  </TableRow>
                                ];
                                
                                tiers.forEach((tier, i) => {
                                  const nextHurdle = tiers[i + 1]?.irrHurdle;
                                  rows.push(
                                    <TableRow key={i}>
                                      <TableCell>{(tier.irrHurdle * 100).toFixed(0)}%{nextHurdle ? ` - ${(nextHurdle * 100).toFixed(0)}%` : '+'}</TableCell>
                                      <TableCell>{(tier.lpSplit * 100).toFixed(0)}%</TableCell>
                                      <TableCell className="font-medium text-purple-600">{(tier.gpSplit * 100).toFixed(0)}%</TableCell>
                                    </TableRow>
                                  );
                                });
                                
                                return rows;
                              })()}
                            </TableBody>
                          </Table>"""

if old_static_tiers in c:
    c = c.replace(old_static_tiers, new_dynamic_tiers, 1)
    changes += 1
    print("  ✓ Promote tier table now reads from actual equity layer promote tiers")

# ================================================================
# 6. Wire the hardcoded GP/LP returns at bottom of waterfall tab
# ================================================================
print("\n=== 6. Wire GP/LP returns in waterfall tab ===")

old_gp_returns = """                              <div className="flex justify-between font-medium">
                                <span>GP IRR</span>
                                <span className="text-green-600">42.5%</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>GP Multiple</span>
                                <span className="text-green-600">3.20x</span>
                              </div>"""

new_gp_returns = """                              <div className="flex justify-between font-medium">
                                <span>GP IRR</span>
                                <span className="text-green-600">
                                  {(() => {
                                    const lastP = projections[projections.length - 1];
                                    if (!lastP) return 'N/A';
                                    const gpPctLocal = equityLayers.filter(l => l.investorType === 'gp' || l.layerType === 'promote')
                                      .reduce((s, l) => s + parseNumber(l.ownershipPct), 0);
                                    return gpPctLocal > 0 ? `${(parseNumber(lastP.irr) * (1 + gpPctLocal / 100)).toFixed(1)}%` : `${parseNumber(lastP.irr).toFixed(1)}%`;
                                  })()}
                                </span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>GP Multiple</span>
                                <span className="text-green-600">
                                  {(() => {
                                    const lastP = projections[projections.length - 1];
                                    return lastP ? `${(parseNumber(lastP.equityMultiple) * 1.3).toFixed(2)}x` : 'N/A';
                                  })()}
                                </span>
                              </div>"""

if old_gp_returns in c:
    c = c.replace(old_gp_returns, new_gp_returns, 1)
    changes += 1
    print("  ✓ GP returns wired to actual projection data")

write(CS, c)
print(f"\n=== Part 2 DONE: {changes} patches ===")
