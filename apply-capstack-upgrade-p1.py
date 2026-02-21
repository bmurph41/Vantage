"""
Capital Stack Mega-Upgrade Part 1
==================================
1. Sources & Uses table (auto-balanced from actual stack data)
2. Wire Projections tab to Pro Forma engine (replace manual NOI input)
3. Sensitivity Matrix (cap rate × LTV grid)

Run from workspace root: python3 apply-capstack-upgrade-p1.py
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
# 1. Add Sources & Uses tab to the inner tab list
# ================================================================
print("=== 1. Add Sources & Uses + Sensitivity tabs ===")

old_tabs = """                    <TabsTrigger value="projections" className="gap-1.5 text-xs">
                      <Calculator className="h-3.5 w-3.5" />
                      Projections
                    </TabsTrigger>
                  </TabsList>"""

new_tabs = """                    <TabsTrigger value="projections" className="gap-1.5 text-xs">
                      <Calculator className="h-3.5 w-3.5" />
                      Projections
                    </TabsTrigger>
                    <TabsTrigger value="sources-uses" className="gap-1.5 text-xs">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Sources & Uses
                    </TabsTrigger>
                    <TabsTrigger value="sensitivity" className="gap-1.5 text-xs">
                      <Calculator className="h-3.5 w-3.5" />
                      Sensitivity
                    </TabsTrigger>
                  </TabsList>"""

if 'sources-uses' not in c and old_tabs in c:
    c = c.replace(old_tabs, new_tabs, 1)
    changes += 1
    print("  ✓ Added Sources & Uses + Sensitivity tab triggers")

# ================================================================
# 2. Wire Projections tab to Pro Forma data
# ================================================================
print("\n=== 2. Wire Projections to Pro Forma ===")

old_projections = """                  <TabsContent value="projections" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Generate Projections</CardTitle>
                        <CardDescription>Calculate cash flows and returns based on NOI assumptions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 items-end">
                          <div>
                            <Label htmlFor="noi">Starting NOI ($)</Label>
                            <Input
                              id="noi"
                              type="number"
                              value={noi}
                              onChange={(e) => setNoi(e.target.value)}
                              placeholder="1000000"
                            />
                          </div>
                          <div>
                            <Label htmlFor="noiGrowth">Annual Growth Rate</Label>
                            <Input
                              id="noiGrowth"
                              type="number"
                              step="0.01"
                              value={noiGrowthRate}
                              onChange={(e) => setNoiGrowthRate(e.target.value)}
                              placeholder="0.02"
                            />
                          </div>
                          <Button
                            onClick={() => generateProjectionsMutation.mutate()}
                            disabled={generateProjectionsMutation.isPending}
                            data-testid="button-generate-projections"
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${generateProjectionsMutation.isPending ? 'animate-spin' : ''}`} />
                            Generate
                          </Button>
                        </div>
                      </CardContent>
                    </Card>"""

new_projections = """                  <TabsContent value="projections" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">Cash Flow Projections</CardTitle>
                            <CardDescription>Auto-generated from Pro Forma engine or manual NOI input</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await apiRequest(`/api/capital-stack/${selectedStackId}/projections/from-pro-forma`, {
                                    method: 'POST',
                                    body: JSON.stringify({ projectId, scenario: 'base' }),
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
                                  toast({ title: 'Projections synced from Pro Forma' });
                                } catch (e: any) {
                                  toast({ title: 'Pro Forma sync failed', description: e.message, variant: 'destructive' });
                                }
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Sync from Pro Forma
                            </Button>
                            <Button
                              onClick={() => generateProjectionsMutation.mutate()}
                              disabled={generateProjectionsMutation.isPending}
                              size="sm"
                              variant="secondary"
                              data-testid="button-generate-projections"
                            >
                              <Calculator className="h-4 w-4 mr-2" />
                              Manual Generate
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 items-end mb-4 p-3 bg-muted/30 rounded-lg">
                          <div>
                            <Label htmlFor="noi" className="text-xs">Starting NOI ($)</Label>
                            <Input
                              id="noi"
                              type="number"
                              value={noi}
                              onChange={(e) => setNoi(e.target.value)}
                              placeholder="1000000"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label htmlFor="noiGrowth" className="text-xs">Annual Growth</Label>
                            <Input
                              id="noiGrowth"
                              type="number"
                              step="0.01"
                              value={noiGrowthRate}
                              onChange={(e) => setNoiGrowthRate(e.target.value)}
                              placeholder="0.02"
                              className="h-8"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground pb-2">Used for manual generation only. "Sync from Pro Forma" uses actual projected values.</p>
                        </div>
                      </CardContent>
                    </Card>"""

if old_projections in c:
    c = c.replace(old_projections, new_projections, 1)
    changes += 1
    print("  ✓ Wired Projections tab with Pro Forma sync button")

# ================================================================
# 3. Add Sources & Uses + Sensitivity tab content
# ================================================================
print("\n=== 3. Add Sources & Uses + Sensitivity tab content ===")

# Find the closing of the last TabsContent before </Tabs> at the inner level
# We'll insert before the closing </Tabs> of the inner tabs
# The inner tabs close is followed by delete stack button
old_inner_tabs_close = """                </Tabs>

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Delete this capital stack?')) {
                        deleteStackMutation.mutate(selectedStackId);
                      }
                    }}
                    data-testid="button-delete-stack"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Stack
                  </Button>
                </div>"""

new_inner_tabs_close = """                  {/* SOURCES & USES TAB */}
                  <TabsContent value="sources-uses" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Sources & Uses of Funds
                        </CardTitle>
                        <CardDescription>Closing statement — auto-balanced from capital stack</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-6">
                          {/* SOURCES */}
                          <div>
                            <h4 className="font-semibold text-sm mb-3 text-green-700 flex items-center gap-2">
                              <DollarSign className="h-4 w-4" /> Sources
                            </h4>
                            <Table>
                              <TableBody>
                                {debtTranches.map((t) => (
                                  <TableRow key={t.id}>
                                    <TableCell className="text-sm">{t.name}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(parseNumber(t.principal))}</TableCell>
                                  </TableRow>
                                ))}
                                {equityLayers.map((l) => (
                                  <TableRow key={l.id}>
                                    <TableCell className="text-sm">{l.name} (Equity)</TableCell>
                                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(parseNumber(l.commitmentAmount))}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="border-t-2 font-bold">
                                  <TableCell>Total Sources</TableCell>
                                  <TableCell className="text-right">{formatCurrency(totalDebt + totalEquity)}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>

                          {/* USES */}
                          <div>
                            <h4 className="font-semibold text-sm mb-3 text-blue-700 flex items-center gap-2">
                              <Building2 className="h-4 w-4" /> Uses
                            </h4>
                            <Table>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-sm">Purchase Price</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(purchasePrice)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="text-sm">Closing Costs</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(parseNumber(stack?.closingCosts))}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="text-sm">CapEx Reserves</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(parseNumber(stack?.capexReserves))}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="text-sm">Working Capital</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(parseNumber(stack?.workingCapital))}</TableCell>
                                </TableRow>
                                {(() => {
                                  const totalUses = purchasePrice + parseNumber(stack?.closingCosts) + parseNumber(stack?.capexReserves) + parseNumber(stack?.workingCapital);
                                  const origFees = debtTranches.reduce((sum, t) => sum + parseNumber(t.principal) * parseNumber(t.originationFeePct), 0);
                                  return (
                                    <>
                                      {origFees > 0 && (
                                        <TableRow>
                                          <TableCell className="text-sm">Loan Origination Fees</TableCell>
                                          <TableCell className="text-right font-medium">{formatCurrency(origFees)}</TableCell>
                                        </TableRow>
                                      )}
                                      <TableRow className="border-t-2 font-bold">
                                        <TableCell>Total Uses</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totalUses + origFees)}</TableCell>
                                      </TableRow>
                                    </>
                                  );
                                })()}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* Balance Check */}
                        {(() => {
                          const totalSources = totalDebt + totalEquity;
                          const origFees = debtTranches.reduce((sum, t) => sum + parseNumber(t.principal) * parseNumber(t.originationFeePct), 0);
                          const totalUses = purchasePrice + parseNumber(stack?.closingCosts) + parseNumber(stack?.capexReserves) + parseNumber(stack?.workingCapital) + origFees;
                          const gap = totalSources - totalUses;
                          return (
                            <div className={`mt-4 p-3 rounded-lg border text-sm flex justify-between items-center ${Math.abs(gap) < 100 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                              <span>Sources − Uses = {formatCurrency(gap)}</span>
                              {Math.abs(gap) < 100 ? (
                                <Badge className="bg-green-600">✓ Balanced</Badge>
                              ) : gap > 0 ? (
                                <Badge variant="outline" className="border-amber-500 text-amber-700">⚠ Excess capital: {formatCurrency(gap)}</Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-500 text-red-700">⚠ Funding gap: {formatCurrency(Math.abs(gap))}</Badge>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* SENSITIVITY MATRIX TAB */}
                  <TabsContent value="sensitivity" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          Sensitivity Matrix
                        </CardTitle>
                        <CardDescription>How returns change with different cap rates and LTV levels</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const baseCapRate = parseFloat(stack?.exitCapRate?.toString() || '7') / 100;
                          const capRates = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(d => baseCapRate + d / 100);
                          const ltvLevels = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80];
                          const baseNoi = projections[0]?.noi ? parseNumber(projections[0].noi) : 0;
                          
                          if (baseNoi === 0) {
                            return (
                              <div className="text-center py-8 text-muted-foreground">
                                <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Generate projections first to see the sensitivity matrix</p>
                              </div>
                            );
                          }

                          return (
                            <div className="overflow-x-auto">
                              <p className="text-xs text-muted-foreground mb-3">Cell values show estimated Levered IRR (%). Green = above target, red = below.</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs font-bold">Exit Cap ↓ / LTV →</TableHead>
                                    {ltvLevels.map(ltv => (
                                      <TableHead key={ltv} className="text-xs text-center">{(ltv * 100).toFixed(0)}%</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {capRates.map(cr => {
                                    const exitNoi = baseNoi * Math.pow(1 + parseFloat(stack?.noiGrowthRate?.toString() || '0.02'), parseInt(stack?.holdPeriodYears?.toString() || '5'));
                                    const exitVal = exitNoi / cr;
                                    return (
                                      <TableRow key={cr}>
                                        <TableCell className="text-xs font-semibold">{(cr * 100).toFixed(1)}%</TableCell>
                                        {ltvLevels.map(ltvPct => {
                                          const debtAmt = purchasePrice * ltvPct;
                                          const eqAmt = purchasePrice - debtAmt;
                                          if (eqAmt <= 0) return <TableCell key={ltvPct} className="text-center text-xs text-muted-foreground">-</TableCell>;
                                          
                                          const avgRate = debtTranches.length > 0
                                            ? debtTranches.reduce((s, t) => s + parseNumber(t.interestRate), 0) / debtTranches.length / 100
                                            : 0.06;
                                          const annualDS = debtAmt * (avgRate + 0.02);
                                          
                                          const holdYears = parseInt(stack?.holdPeriodYears?.toString() || '5');
                                          const cfs = [-eqAmt];
                                          for (let yr = 1; yr <= holdYears; yr++) {
                                            const yrNoi = baseNoi * Math.pow(1.02, yr);
                                            const cf = yrNoi - annualDS;
                                            if (yr === holdYears) {
                                              const loanBal = debtAmt * 0.92;
                                              cfs.push(cf + exitVal - loanBal);
                                            } else {
                                              cfs.push(cf);
                                            }
                                          }
                                          
                                          let lo = -0.99, hi = 5, irr = 0;
                                          for (let i = 0; i < 100; i++) {
                                            irr = (lo + hi) / 2;
                                            let npv = 0;
                                            for (let j = 0; j < cfs.length; j++) npv += cfs[j] / Math.pow(1 + irr, j);
                                            if (Math.abs(npv) < 1) break;
                                            if (npv > 0) lo = irr; else hi = irr;
                                          }
                                          const irrPct = irr * 100;
                                          const isBase = Math.abs(cr - baseCapRate) < 0.001 && Math.abs(ltvPct - ltv / 100) < 0.03;
                                          
                                          return (
                                            <TableCell
                                              key={ltvPct}
                                              className={`text-center text-xs font-medium ${isBase ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${irrPct >= 15 ? 'text-green-700 bg-green-50/50' : irrPct >= 10 ? 'text-yellow-700 bg-yellow-50/50' : 'text-red-700 bg-red-50/50'}`}
                                            >
                                              {irrPct.toFixed(1)}%
                                            </TableCell>
                                          );
                                        })}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                              <p className="text-xs text-muted-foreground mt-2">Blue ring = current deal position. Green ≥ 15% IRR, Yellow ≥ 10%, Red {'<'} 10%.</p>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </TabsContent>

                </Tabs>

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Delete this capital stack?')) {
                        deleteStackMutation.mutate(selectedStackId);
                      }
                    }}
                    data-testid="button-delete-stack"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Stack
                  </Button>
                </div>"""

if 'sources-uses' not in c and old_inner_tabs_close in c:
    c = c.replace(old_inner_tabs_close, new_inner_tabs_close, 1)
    changes += 1
    print("  ✓ Added Sources & Uses tab (auto-balanced, gap detection)")
    print("  ✓ Added Sensitivity Matrix tab (cap rate × LTV grid, IRR coloring)")

write(CS, c)
print(f"\n=== Part 1 DONE: {changes} patches ===")
