import re

with open('client/src/pages/modeling/projects/workspace/capital-stack.tsx') as f:
    c = f.read()

print("=== Fixing Capital Stack JSX ===")

# PROBLEM 1: Orphaned old hardcoded returns content
# Our new Returns IIFE ends with })()}  then old Tier 2-4 rows are dangling
# Need to remove from after our IIFE close to before the WATERFALL TAB

# Find our IIFE close followed by old orphaned Tier 2
marker = '})()}\n                                <TableCell><Badge variant="outline">Tier 2</Badge></TableCell>'
idx = c.find(marker)

if idx > 0:
    print(f"  Found orphaned content at char {idx}")
    
    # Keep everything up to and including })()}
    keep_end = idx + len('})()}')
    
    # Find the WATERFALL TAB comment
    waterfall_marker = '                  {/* WATERFALL TAB'
    waterfall_idx = c.find(waterfall_marker, keep_end)
    
    if waterfall_idx > 0:
        orphan_size = waterfall_idx - keep_end
        print(f"  Removing {orphan_size} chars of orphaned old returns content")
        
        # Insert proper closing for our new returns tab
        proper_close = """
                      </CardContent>
                    </Card>
                  </TabsContent>

"""
        c = c[:keep_end] + proper_close + c[waterfall_idx:]
        print("  OK: Removed orphaned rows, added proper Returns tab closure")
    else:
        print("  WARN: Could not find WATERFALL TAB marker")
else:
    print("  Returns tab appears clean (no orphaned content found)")


# PROBLEM 2: Sources & Uses and Sensitivity tabs not inserted
if '<TabsContent value="sources-uses"' not in c:
    print("\n  Inserting Sources & Uses + Sensitivity tabs...")
    
    # Find inner </Tabs> followed by delete button
    # Use a unique anchor: the delete stack button
    anchor = '                <div className="flex justify-end">\n                  <Button\n                    variant="destructive"'
    idx = c.find(anchor)
    
    if idx > 0:
        # Go back to find </Tabs> before the anchor
        tabs_close = '                </Tabs>\n'
        tabs_idx = c.rfind(tabs_close, 0, idx)
        
        if tabs_idx > 0:
            # Insert before </Tabs>
            insert_point = tabs_idx
            
            new_tabs = """
                  {/* SOURCES & USES TAB */}
                  <TabsContent value="sources-uses" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Sources &amp; Uses of Funds
                        </CardTitle>
                        <CardDescription>Closing statement auto-balanced from capital stack</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-6">
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
                        {(() => {
                          const totalSources = totalDebt + totalEquity;
                          const origFees = debtTranches.reduce((sum, t) => sum + parseNumber(t.principal) * parseNumber(t.originationFeePct), 0);
                          const totalUses = purchasePrice + parseNumber(stack?.closingCosts) + parseNumber(stack?.capexReserves) + parseNumber(stack?.workingCapital) + origFees;
                          const gap = totalSources - totalUses;
                          return (
                            <div className={`mt-4 p-3 rounded-lg border text-sm flex justify-between items-center ${Math.abs(gap) < 100 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                              <span>Sources - Uses = {formatCurrency(gap)}</span>
                              {Math.abs(gap) < 100 ? (
                                <Badge className="bg-green-600">Balanced</Badge>
                              ) : gap > 0 ? (
                                <Badge variant="outline" className="border-amber-500 text-amber-700">Excess: {formatCurrency(gap)}</Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-500 text-red-700">Gap: {formatCurrency(Math.abs(gap))}</Badge>
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
                        <CardDescription>How returns change with different cap rates and LTV</CardDescription>
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
                              <p className="text-xs text-muted-foreground mb-3">Estimated Levered IRR. Green 15%+, yellow 10%+, red below.</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs font-bold">Exit Cap / LTV</TableHead>
                                    {ltvLevels.map(l => (
                                      <TableHead key={l} className="text-xs text-center">{(l * 100).toFixed(0)}%</TableHead>
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
                                          if (eqAmt <= 0) return <TableCell key={ltvPct} className="text-center text-xs">-</TableCell>;
                                          const avgRate = debtTranches.length > 0
                                            ? debtTranches.reduce((s, t) => s + parseNumber(t.interestRate), 0) / debtTranches.length / 100 : 0.06;
                                          const annualDS = debtAmt * (avgRate + 0.02);
                                          const holdYears = parseInt(stack?.holdPeriodYears?.toString() || '5');
                                          const cfs = [-eqAmt];
                                          for (let yr = 1; yr <= holdYears; yr++) {
                                            const yrNoi = baseNoi * Math.pow(1.02, yr);
                                            const cf = yrNoi - annualDS;
                                            cfs.push(yr === holdYears ? cf + exitVal - debtAmt * 0.92 : cf);
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
                                            <TableCell key={ltvPct} className={`text-center text-xs font-medium ${isBase ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${irrPct >= 15 ? 'text-green-700 bg-green-50/50' : irrPct >= 10 ? 'text-yellow-700 bg-yellow-50/50' : 'text-red-700 bg-red-50/50'}`}>
                                              {irrPct.toFixed(1)}%
                                            </TableCell>
                                          );
                                        })}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                              <p className="text-xs text-muted-foreground mt-2">Blue ring = current position.</p>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </TabsContent>

"""
            c = c[:insert_point] + new_tabs + c[insert_point:]
            print("  OK: Inserted Sources & Uses + Sensitivity tab content")
        else:
            print(f"  WARN: Could not find </Tabs> before delete button (tabs_idx={tabs_idx})")
    else:
        print(f"  WARN: Could not find delete button anchor")
else:
    print("\n  Sources & Uses tab already present")


with open('client/src/pages/modeling/projects/workspace/capital-stack.tsx', 'w') as f:
    f.write(c)

print("\n=== Fix complete ===")
