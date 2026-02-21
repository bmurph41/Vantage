"""
Capital Stack: Refinance Scenario Modeling
============================================
- New "Refi" tab in capital stack inner tabs
- User picks refi year (1-N of hold period)
- Shows which tranches get called (bridge/mezz first, then senior)
- Input new permanent debt terms
- Shows before/after comparison: DSCR, cash flow, IRR impact

Run from workspace root: python3 apply-refi-scenario.py
"""

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
CS = "client/src/pages/modeling/projects/workspace/capital-stack.tsx"
c = read(CS)

# ================================================================
# 1. Add Refi tab trigger
# ================================================================
print("=== 1. Add Refi tab trigger ===")

old_sensitivity_trigger = """                    <TabsTrigger value="sensitivity" className="gap-1.5 text-xs">
                      <Calculator className="h-3.5 w-3.5" />
                      Sensitivity
                    </TabsTrigger>"""

new_sensitivity_trigger = """                    <TabsTrigger value="sensitivity" className="gap-1.5 text-xs">
                      <Calculator className="h-3.5 w-3.5" />
                      Sensitivity
                    </TabsTrigger>
                    <TabsTrigger value="refi" className="gap-1.5 text-xs">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refi Scenario
                    </TabsTrigger>"""

if 'value="refi"' not in c and old_sensitivity_trigger in c:
    c = c.replace(old_sensitivity_trigger, new_sensitivity_trigger, 1)
    changes += 1
    print("  OK Added Refi tab trigger")

# ================================================================
# 2. Add refi state variables
# ================================================================
print("\n=== 2. Add refi state ===")

old_equity_partners = "  // Dynamic partner rows for Partnership/JV structures"
new_equity_partners = """  // ── Refi Scenario State ──
  const [refiYear, setRefiYear] = useState<number>(3);
  const [refiRate, setRefiRate] = useState<string>('5.5');
  const [refiTermYears, setRefiTermYears] = useState<string>('10');
  const [refiAmortYears, setRefiAmortYears] = useState<string>('30');
  const [refiLtv, setRefiLtv] = useState<string>('65');
  const [refiIoMonths, setRefiIoMonths] = useState<string>('0');

  // Dynamic partner rows for Partnership/JV structures"""

if 'refiYear' not in c and old_equity_partners in c:
    c = c.replace(old_equity_partners, new_equity_partners, 1)
    changes += 1
    print("  OK Added refi state variables")

# ================================================================
# 3. Add Refi tab content before Sources & Uses
# ================================================================
print("\n=== 3. Add Refi tab content ===")

sources_marker = "                  {/* SOURCES & USES TAB */}"
refi_tab = """                  {/* REFI SCENARIO TAB */}
                  <TabsContent value="refi" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <RefreshCw className="h-5 w-5" />
                          Refinance Scenario
                        </CardTitle>
                        <CardDescription>Model mid-hold refinancing. Bridge/mezz debt is called first, then senior debt is replaced.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Current Debt Stack */}
                        <div>
                          <h4 className="font-medium text-sm mb-3">Current Debt Stack</h4>
                          <div className="space-y-2">
                            {debtTranches.map(t => {
                              const isBridgeMezz = t.trancheType === 'bridge' || t.trancheType === 'mezzanine';
                              return (
                                <div key={t.id} className={`p-3 rounded-lg border flex items-center justify-between ${isBridgeMezz ? 'bg-amber-50 border-amber-200' : 'bg-slate-50'}`}>
                                  <div className="flex items-center gap-3">
                                    <Badge variant={isBridgeMezz ? 'destructive' : 'secondary'} className="text-xs">
                                      {t.trancheType}
                                    </Badge>
                                    <span className="font-medium text-sm">{t.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span>{formatCurrency(parseNumber(t.principal))}</span>
                                    <span className="text-muted-foreground">{parseNumber(t.interestRate).toFixed(2)}%</span>
                                    <span className="text-muted-foreground">{t.termYears}yr</span>
                                    {isBridgeMezz && (
                                      <Badge className="bg-amber-600 text-xs">Called at refi</Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {debtTranches.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No debt tranches configured</p>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Refi Parameters */}
                        <div>
                          <h4 className="font-medium text-sm mb-3">Refinance Parameters</h4>
                          <div className="grid grid-cols-6 gap-4">
                            <div>
                              <Label className="text-xs">Refi Year</Label>
                              <Select value={String(refiYear)} onValueChange={(v) => setRefiYear(parseInt(v))}>
                                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: parseInt(stack?.holdPeriodYears?.toString() || '5') - 1 }, (_, i) => i + 1).map(yr => (
                                    <SelectItem key={yr} value={String(yr)}>Year {yr}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">New Rate (%)</Label>
                              <Input type="number" step="0.1" value={refiRate} onChange={e => setRefiRate(e.target.value)} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">Term (yrs)</Label>
                              <Input type="number" value={refiTermYears} onChange={e => setRefiTermYears(e.target.value)} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">Amort (yrs)</Label>
                              <Input type="number" value={refiAmortYears} onChange={e => setRefiAmortYears(e.target.value)} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">New LTV (%)</Label>
                              <Input type="number" step="1" value={refiLtv} onChange={e => setRefiLtv(e.target.value)} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">I/O Months</Label>
                              <Input type="number" value={refiIoMonths} onChange={e => setRefiIoMonths(e.target.value)} className="h-8 mt-1" />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Before vs After Comparison */}
                        <div>
                          <h4 className="font-medium text-sm mb-3">Before vs After Refinance</h4>
                          {(() => {
                            const holdYears = parseInt(stack?.holdPeriodYears?.toString() || '5');
                            const baseNoi = projections[0]?.noi ? parseNumber(projections[0].noi) : 0;
                            
                            if (baseNoi === 0 || debtTranches.length === 0) {
                              return (
                                <div className="text-center py-6 text-muted-foreground">
                                  <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p>Generate projections and add debt tranches to model refinancing</p>
                                </div>
                              );
                            }

                            // Current debt metrics
                            const currentDS = annualDebtService;
                            const currentDscr = baseNoi > 0 && currentDS > 0 ? baseNoi / currentDS : 0;
                            const currentWeightedRate = debtTranches.reduce((s, t) => s + parseNumber(t.principal) * parseNumber(t.interestRate), 0) / totalDebt;

                            // Bridge/mezz debt to be called
                            const calledTranches = debtTranches.filter(t => t.trancheType === 'bridge' || t.trancheType === 'mezzanine');
                            const calledAmount = calledTranches.reduce((s, t) => s + parseNumber(t.principal), 0);
                            const remainingSenior = debtTranches.filter(t => t.trancheType !== 'bridge' && t.trancheType !== 'mezzanine');
                            const remainingSeniorPrincipal = remainingSenior.reduce((s, t) => s + parseNumber(t.principal), 0);

                            // Refi: new permanent loan replaces everything
                            const refiNoi = baseNoi * Math.pow(1.02, refiYear);
                            const refiPropertyValue = refiNoi / (parseFloat(stack?.exitCapRate?.toString() || '7') / 100);
                            const newLoanAmount = refiPropertyValue * (parseFloat(refiLtv) / 100);
                            const newRate = parseFloat(refiRate) / 100;
                            const newAmort = parseInt(refiAmortYears);
                            const monthlyRate = newRate / 12;
                            const numPayments = newAmort * 12;
                            const monthlyPayment = newLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                            const ioMonths = parseInt(refiIoMonths);
                            const annualDSNew = ioMonths >= 12 ? newLoanAmount * newRate : monthlyPayment * 12;
                            const newDscr = refiNoi / annualDSNew;
                            const cashOutProceeds = newLoanAmount - totalDebt;

                            // IRR impact: simple before/after comparison
                            const calcIrr = (cfs: number[]) => {
                              let lo = -0.99, hi = 5, irr = 0;
                              for (let i = 0; i < 100; i++) {
                                irr = (lo + hi) / 2;
                                let npv = 0;
                                for (let j = 0; j < cfs.length; j++) npv += cfs[j] / Math.pow(1 + irr, j);
                                if (Math.abs(npv) < 1) break;
                                if (npv > 0) lo = irr; else hi = irr;
                              }
                              return irr;
                            };

                            const exitNoi = baseNoi * Math.pow(1.02, holdYears);
                            const exitVal = exitNoi / (parseFloat(stack?.exitCapRate?.toString() || '7') / 100);

                            // Before refi cash flows
                            const cfsBefore = [-totalEquity];
                            for (let yr = 1; yr <= holdYears; yr++) {
                              const yrNoi = baseNoi * Math.pow(1.02, yr);
                              const cf = yrNoi - currentDS;
                              cfsBefore.push(yr === holdYears ? cf + exitVal - totalDebt * 0.92 : cf);
                            }
                            const irrBefore = calcIrr(cfsBefore) * 100;

                            // After refi cash flows
                            const cfsAfter = [-totalEquity];
                            for (let yr = 1; yr <= holdYears; yr++) {
                              const yrNoi = baseNoi * Math.pow(1.02, yr);
                              if (yr < refiYear) {
                                cfsAfter.push(yrNoi - currentDS);
                              } else if (yr === refiYear) {
                                // Refi year: old DS for part, new DS for part, plus cash-out
                                cfsAfter.push(yrNoi - annualDSNew + (cashOutProceeds > 0 ? cashOutProceeds : 0));
                              } else {
                                const cf = yrNoi - annualDSNew;
                                const loanBal = newLoanAmount * 0.95;
                                cfsAfter.push(yr === holdYears ? cf + exitVal - loanBal : cf);
                              }
                            }
                            const irrAfter = calcIrr(cfsAfter) * 100;

                            return (
                              <div className="space-y-4">
                                {/* Called Debt Alert */}
                                {calledTranches.length > 0 && (
                                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                      <AlertCircle className="h-4 w-4 text-amber-600" />
                                      <span className="font-medium text-sm text-amber-800">Debt Called at Year {refiYear}</span>
                                    </div>
                                    <div className="text-xs text-amber-700 space-y-1">
                                      {calledTranches.map(t => (
                                        <div key={t.id} className="flex justify-between">
                                          <span>{t.name} ({t.trancheType})</span>
                                          <span className="font-medium">{formatCurrency(parseNumber(t.principal))}</span>
                                        </div>
                                      ))}
                                      <div className="flex justify-between pt-1 border-t border-amber-300 font-medium">
                                        <span>Total Called</span>
                                        <span>{formatCurrency(calledAmount)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Cash-Out Proceeds */}
                                {cashOutProceeds > 0 && (
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <DollarSign className="h-4 w-4 text-green-600" />
                                      <span className="font-medium text-sm text-green-800">Cash-Out Refi Proceeds</span>
                                    </div>
                                    <span className="font-bold text-green-700">{formatCurrency(cashOutProceeds)}</span>
                                  </div>
                                )}

                                {/* Comparison Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                  <Card className="bg-slate-50">
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm">Before Refi (Acquisition)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                      <div className="flex justify-between"><span className="text-muted-foreground">Total Debt</span><span className="font-medium">{formatCurrency(totalDebt)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Weighted Rate</span><span className="font-medium">{currentWeightedRate.toFixed(2)}%</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Annual D/S</span><span className="font-medium">{formatCurrency(currentDS)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">DSCR</span><span className={`font-medium ${currentDscr >= 1.25 ? 'text-green-600' : 'text-red-600'}`}>{currentDscr.toFixed(2)}x</span></div>
                                      <Separator />
                                      <div className="flex justify-between font-medium"><span>Levered IRR</span><span className={irrBefore >= 15 ? 'text-green-600' : ''}>{irrBefore.toFixed(1)}%</span></div>
                                    </CardContent>
                                  </Card>
                                  <Card className="bg-blue-50/50 border-blue-200">
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm text-blue-700">After Refi (Year {refiYear})</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                      <div className="flex justify-between"><span className="text-muted-foreground">New Loan</span><span className="font-medium">{formatCurrency(newLoanAmount)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span className="font-medium">{refiRate}%</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Annual D/S</span><span className="font-medium">{formatCurrency(annualDSNew)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">DSCR</span><span className={`font-medium ${newDscr >= 1.25 ? 'text-green-600' : 'text-red-600'}`}>{newDscr.toFixed(2)}x</span></div>
                                      <Separator />
                                      <div className="flex justify-between font-medium"><span>Levered IRR</span><span className={irrAfter >= 15 ? 'text-green-600' : ''}>{irrAfter.toFixed(1)}%</span></div>
                                    </CardContent>
                                  </Card>
                                </div>

                                {/* IRR Impact Summary */}
                                <div className={`p-3 rounded-lg border text-sm flex justify-between items-center ${irrAfter > irrBefore ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                  <span className="font-medium">IRR Impact</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{irrBefore.toFixed(1)}%</span>
                                    <span>&#8594;</span>
                                    <span className={`font-bold ${irrAfter > irrBefore ? 'text-green-700' : 'text-red-700'}`}>{irrAfter.toFixed(1)}%</span>
                                    <Badge className={irrAfter > irrBefore ? 'bg-green-600' : 'bg-red-600'}>
                                      {irrAfter > irrBefore ? '+' : ''}{(irrAfter - irrBefore).toFixed(1)}%
                                    </Badge>
                                  </div>
                                </div>

                                {/* Year-by-Year Cash Flow */}
                                <div>
                                  <h5 className="text-sm font-medium mb-2">Year-by-Year Cash Flow Comparison</h5>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Year</TableHead>
                                        <TableHead className="text-xs">NOI</TableHead>
                                        <TableHead className="text-xs">Before Refi CF</TableHead>
                                        <TableHead className="text-xs">After Refi CF</TableHead>
                                        <TableHead className="text-xs">Delta</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {Array.from({ length: holdYears }, (_, i) => i + 1).map(yr => {
                                        const yrNoi = baseNoi * Math.pow(1.02, yr);
                                        const before = cfsBefore[yr];
                                        const after = cfsAfter[yr];
                                        const delta = after - before;
                                        return (
                                          <TableRow key={yr} className={yr === refiYear ? 'bg-blue-50' : ''}>
                                            <TableCell className="text-xs font-medium">
                                              {yr}{yr === refiYear && <Badge className="ml-1 text-[9px] bg-blue-600">REFI</Badge>}
                                            </TableCell>
                                            <TableCell className="text-xs">{formatCurrency(yrNoi)}</TableCell>
                                            <TableCell className="text-xs">{formatCurrency(before)}</TableCell>
                                            <TableCell className="text-xs font-medium">{formatCurrency(after)}</TableCell>
                                            <TableCell className={`text-xs font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : ''}`}>
                                              {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </CardContent>
                    </Card>
                  </TabsContent>

"""

if 'value="refi"' in c and '<TabsContent value="refi"' not in c and sources_marker in c:
    c = c.replace(sources_marker, refi_tab + sources_marker, 1)
    changes += 1
    print("  OK Added Refi tab content")
elif '<TabsContent value="refi"' in c:
    print("  SKIP: Refi tab content already exists")
else:
    print(f"  WARN: Could not find insertion point")

write(CS, c)
print(f"\n=== Refi Scenario: {changes} patches ===")
