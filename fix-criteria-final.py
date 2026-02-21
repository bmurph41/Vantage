"""
Fix: Criteria grid insertion + management page copy
Run from workspace root: python3 fix-criteria-final.py
"""

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

import os, shutil

changes = 0

# ================================================================
# 1. Copy management page if not already in place
# ================================================================
print("=== 1. Copy investment-criteria.tsx ===")
dest = "client/src/pages/modeling/investment-criteria.tsx"
if not os.path.exists(dest):
    src = "investment-criteria.tsx"
    if os.path.exists(src):
        shutil.copy(src, dest)
        changes += 1
        print(f"  OK Copied {src} → {dest}")
    else:
        print(f"  WARN: {src} not found in workspace root. Place it there first.")
else:
    print("  SKIP: Already exists")

# ================================================================
# 2. Add criteria match grid to deal-pricing.tsx
# ================================================================
print("\n=== 2. Add criteria match grid to signal card ===")
DP = "client/src/pages/modeling/projects/workspace/deal-pricing.tsx"
dp = read(DP)

if 'criteriaMatches' in dp:
    print("  SKIP: Criteria matches already present")
else:
    # Find the exact pattern around the reasons rendering
    # Look for the score bar closing followed by the reasons check
    lines = dp.split('\n')
    
    # Find the line with "dealSignal.reasons.length > 0"
    reasons_line = None
    for i, line in enumerate(lines):
        if 'dealSignal.reasons.length > 0' in line:
            reasons_line = i
            break
    
    if reasons_line is not None:
        print(f"  Found reasons check at line {reasons_line + 1}")
        
        # Insert criteria grid BEFORE the reasons check
        criteria_grid = '''
              {/* Criteria Match Breakdown */}
              {'criteriaMatches' in dealSignal && (dealSignal as any).criteriaMatches && (dealSignal as any).criteriaMatches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investment Criteria Match</p>
                    <span className="text-xs text-muted-foreground">
                      {(dealSignal as any).criteriaMatches.filter((m: any) => m.met).length}/{(dealSignal as any).criteriaMatches.length} criteria met
                    </span>
                  </div>
                  <div className="grid gap-1.5">
                    {(dealSignal as any).criteriaMatches.map((match: any, i: number) => (
                      <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-xs border", match.met ? "bg-green-50/50 border-green-200 dark:bg-green-950/20" : "bg-red-50/50 border-red-200 dark:bg-red-950/20")}>
                        <div className="flex items-center gap-2">
                          {match.met ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                          ) : (
                            <AlertCircleIcon className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                          )}
                          <span className="text-muted-foreground">{match.category}</span>
                          <span className="font-medium">{match.criterion}</span>
                          {match.mustHave && <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-bold">MUST</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Target: {match.target}</span>
                          <span className={cn("font-medium", match.met ? "text-green-700" : "text-red-700")}>{match.actual}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
'''
        
        # Insert before the reasons line
        lines.insert(reasons_line, criteria_grid)
        dp = '\n'.join(lines)
        changes += 1
        print("  OK Inserted criteria match grid before Key Factors")
    else:
        print("  WARN: Could not find dealSignal.reasons.length check")

write(DP, dp)
print(f"\n=== Fix complete: {changes} changes ===")
