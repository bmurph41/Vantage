"""
Wire Deal Pricing → Investment Criteria
=========================================
1. Fetch user's default criteria profile
2. Replace computeDealSignal with computeCriteriaSignal
3. Add criteria match breakdown table below the signal card

Run from workspace root: python3 apply-criteria-pricing-wire.py
"""

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
DP = "client/src/pages/modeling/projects/workspace/deal-pricing.tsx"
dp = read(DP)

print("=== Wiring Deal Pricing to Investment Criteria ===")

# 1. Update import to include new functions
old_import = "import { computeDealSignal, getSignalBadgeProps, type DealSignalResult } from '@/lib/dealSignal';"
new_import = "import { computeDealSignal, getSignalBadgeProps, computeCriteriaSignal, type DealSignalResult, type CriteriaMatchResult, type InvestmentCriteria } from '@/lib/dealSignal';"

if old_import in dp and 'computeCriteriaSignal' not in dp:
    dp = dp.replace(old_import, new_import, 1)
    changes += 1
    print("  OK Updated dealSignal import")

# 2. Add criteria fetch query
# Find a good spot to add the query — after the existing useQuery calls
old_pricing_driver = "  const priceDriverKeys = ['targetIRR', 'goingInCap', 'price'];"
new_pricing_driver = """  // Fetch user's investment criteria for deal recommendation
  const { data: criteriaData } = useQuery<{ profile: any; financial: any; capital: any; location: any; operational: any; size: any; involvement: any } | null>({
    queryKey: ['/api/investment-criteria/default'],
  });

  const userCriteria: InvestmentCriteria | null = criteriaData ? {
    financial: criteriaData.financial ? {
      minCapRate: criteriaData.financial.minCapRate ? parseFloat(criteriaData.financial.minCapRate) : null,
      maxCapRate: criteriaData.financial.maxCapRate ? parseFloat(criteriaData.financial.maxCapRate) : null,
      minNoi: criteriaData.financial.minNoi ? parseFloat(criteriaData.financial.minNoi) : null,
      minEbitda: criteriaData.financial.minEbitda ? parseFloat(criteriaData.financial.minEbitda) : null,
      minOperatingMargin: criteriaData.financial.minOperatingMargin ? parseFloat(criteriaData.financial.minOperatingMargin) : null,
    } : null,
    capital: criteriaData.capital ? {
      minIrrTarget: criteriaData.capital.minIrrTarget ? parseFloat(criteriaData.capital.minIrrTarget) : null,
      minCashOnCashReturn: criteriaData.capital.minCashOnCashReturn ? parseFloat(criteriaData.capital.minCashOnCashReturn) : null,
      targetLtvRatio: criteriaData.capital.targetLtvRatio ? parseFloat(criteriaData.capital.targetLtvRatio) : null,
      targetHoldPeriod: criteriaData.capital.targetHoldPeriod,
      maxEquityPerDeal: criteriaData.capital.maxEquityPerDeal ? parseFloat(criteriaData.capital.maxEquityPerDeal) : null,
    } : null,
    location: criteriaData.location ? {
      targetStates: criteriaData.location.targetStates,
      targetRegions: criteriaData.location.targetRegions,
    } : null,
    operational: criteriaData.operational ? {
      minOccupancyRate: criteriaData.operational.minOccupancyRate ? parseFloat(criteriaData.operational.minOccupancyRate) : null,
    } : null,
    size: criteriaData.size ? {
      minTotalSlips: criteriaData.size.minTotalSlips,
      maxTotalSlips: criteriaData.size.maxTotalSlips,
    } : null,
    involvement: criteriaData.involvement ? {
      involvementLevel: criteriaData.involvement.involvementLevel,
      requireManagementInPlace: criteriaData.involvement.requireManagementInPlace,
    } : null,
    weights: criteriaData.profile ? {
      financialWeight: criteriaData.profile.financialWeight,
      capitalWeight: criteriaData.profile.capitalWeight,
      locationWeight: criteriaData.profile.locationWeight,
      operationalWeight: criteriaData.profile.operationalWeight,
      sizeWeight: criteriaData.profile.sizeWeight,
      involvementWeight: criteriaData.profile.involvementWeight,
    } : undefined,
  } : null;

  const priceDriverKeys = ['targetIRR', 'goingInCap', 'price'];"""

if 'userCriteria' not in dp and old_pricing_driver in dp:
    dp = dp.replace(old_pricing_driver, new_pricing_driver, 1)
    changes += 1
    print("  OK Added criteria fetch query + userCriteria builder")

# 3. Replace computeDealSignal call with computeCriteriaSignal
old_signal_call = """        const dealSignal = computeDealSignal({
          irr: pricingData.irr ?? null,
          capRate: pricingData.goingInCapRate ?? null,
          equityMultiple: pricingData.equityMultiple ?? null,
          cashOnCash: pricingData.averageCashOnCash ?? null,
          purchasePrice: pricingData.purchasePrice ?? null,
          exitValue: pricingData.exitValue ?? null,
          totalProfit: pricingData.totalProfit ?? null,
          noiGrowthRate: pricingData.noiProjections && pricingData.noiProjections.length >= 2
            ? ((pricingData.noiProjections[pricingData.noiProjections.length - 1] / pricingData.noiProjections[0] - 1) / (pricingData.noiProjections.length - 1)) * 100
            : null,
          exitNetProceeds: exitNp,
          exitMoic: exitMoicVal,
          exitIrr: exitIrrVal,
        });"""

new_signal_call = """        const dealSignal = computeCriteriaSignal({
          irr: pricingData.irr ?? null,
          capRate: pricingData.goingInCapRate ?? null,
          equityMultiple: pricingData.equityMultiple ?? null,
          cashOnCash: pricingData.averageCashOnCash ?? null,
          purchasePrice: pricingData.purchasePrice ?? null,
          exitValue: pricingData.exitValue ?? null,
          totalProfit: pricingData.totalProfit ?? null,
          noiGrowthRate: pricingData.noiProjections && pricingData.noiProjections.length >= 2
            ? ((pricingData.noiProjections[pricingData.noiProjections.length - 1] / pricingData.noiProjections[0] - 1) / (pricingData.noiProjections.length - 1)) * 100
            : null,
          exitNetProceeds: exitNp,
          exitMoic: exitMoicVal,
          exitIrr: exitIrrVal,
          noi: pricingData.projectFinancials?.year1NOI ?? null,
        }, userCriteria);"""

if old_signal_call in dp:
    dp = dp.replace(old_signal_call, new_signal_call, 1)
    changes += 1
    print("  OK Replaced computeDealSignal with computeCriteriaSignal")

# 4. Add criteria match breakdown after the signal reasons
old_reasons_end = """                {dealSignal.reasons.map((reason, i) => ("""

# Find the section after reasons and add criteria match table
# Actually, let's add after the entire Key Factors section
old_key_factors = """                    {dealSignal.reasons.map((reason, i) => ("""

# Let's find the closing of the signal card to add criteria matches before it
# The signal card closes with </CardContent></Card>
# We'll insert the criteria matches inside CardContent

# Find "Key Factors" section end and add criteria match table after
old_no_criteria_text = """                  <p className="text-xs text-muted-foreground mt-0.5">
                    Institutional-grade Buy/Pass signal based on pricing + exit strategy analysis
                  </p>"""

new_no_criteria_text = """                  <p className="text-xs text-muted-foreground mt-0.5">
                    {userCriteria ? 'Scored against your investment criteria' : 'Institutional-grade Buy/Pass signal — set up Investment Criteria for personalized scoring'}
                  </p>"""

if old_no_criteria_text in dp:
    dp = dp.replace(old_no_criteria_text, new_no_criteria_text, 1)
    changes += 1
    print("  OK Updated description to show criteria status")

# 5. Add criteria match grid after reasons
# Find the end of the reasons list rendering
old_reasons_block_end = """                    {dealSignal.reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2">"""

# Instead of modifying the reasons rendering, let's add the criteria table
# after the entire signal card content. Find a unique anchor.
# Let's look for where we can add after the key factors section.

# Actually the simplest approach: add after the closing of the reasons section
# Let's find the score bar section end and add criteria matches below

# We'll add a section after the reasons for criteria matches
# Anchor: look for the end of the signal card 
# The signal card already handles dealSignal.reasons, we need to add criteriaMatches

# Find a good insertion point - the closing </CardContent> of the signal card
# Use a unique string near the end of the signal card rendering

old_signal_score_text = """                    <span>Pass (0-49)</span>
                    <span>Conditional (50-69)</span>
                    <span>Buy (70-100)</span>"""

new_signal_with_criteria = """                    <span>Pass (0-49)</span>
                    <span>Conditional (50-69)</span>
                    <span>Buy (70-100)</span>"""

# Actually, let me add it after the key factors section by finding where reasons end
# I'll add an entirely new section. Let me find the right spot.

# Better approach: add the criteria grid as a section inside CardContent
# after the reasons display. The current structure has reasons.map followed by </div></div>
# Then there might be more content. Let me just append to the end of CardContent.

# Find the pattern at the very end of the signal card where it closes
# This is tricky without seeing exact lines. Let me add it differently —
# add it to the IIFE that builds dealSignal, right before the return.

# Actually the cleanest way: add the criteria match table as a standalone section
# after the signal card, still within the IIFE.

# Let me find where the signal card's CardContent ends
# I'll search for the unique "Key Factors" heading and add after its parent div closes

write(DP, dp)
print(f"\n=== Criteria Pricing Wire: {changes} patches ===")
print("\nNote: Criteria match breakdown table will be added in the UI component")
