#!/bin/bash
set -e

FILE="client/src/components/onboarding/OnboardingWizard.tsx"
BACKUP="backups/doc-type-dropdown-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
cp "$FILE" "$BACKUP/OnboardingWizard.tsx.bak"
echo "✅ Backup saved to $BACKUP"

# ─────────────────────────────────────────────────
# PATCH 1: Add getDocumentTypesForAsset to import
# ─────────────────────────────────────────────────
python3 -c "
with open('$FILE', 'r') as f:
    content = f.read()

old = \"import { getWizardConfig } from '@shared/wizard-enhancement-config';\"
new = \"import { getWizardConfig, getDocumentTypesForAsset } from '@shared/wizard-enhancement-config';\"

if 'getDocumentTypesForAsset' not in content:
    content = content.replace(old, new)
    print('  ✅ P1: Added getDocumentTypesForAsset import')
else:
    print('  ⏭️  P1: Already imported')

with open('$FILE', 'w') as f:
    f.write(content)
"

# ─────────────────────────────────────────────────
# PATCH 2: Widen DocTypeEnum to string
# ─────────────────────────────────────────────────
python3 -c "
with open('$FILE', 'r') as f:
    content = f.read()

old = 'type DocTypeEnum = \"pnl\" | \"t12\" | \"rent_roll\" | \"balance_sheet\" | \"rate_sheet\" | \"invoice\" | \"other\";'
new = '''// Widened to string to support asset-class-specific doc types from wizard config
type DocTypeEnum = string;'''

if '\"pnl\" | \"t12\" | \"rent_roll\"' in content:
    content = content.replace(old, new)
    print('  ✅ P2: Widened DocTypeEnum to string')
else:
    print('  ⏭️  P2: DocTypeEnum already widened')

with open('$FILE', 'w') as f:
    f.write(content)
"

# ─────────────────────────────────────────────────
# PATCH 3: Enhance guessDocType with more patterns
# ─────────────────────────────────────────────────
python3 << 'PYEOF'
with open("client/src/components/onboarding/OnboardingWizard.tsx", "r") as f:
    content = f.read()

old_guess = '''function guessDocType(filename: string): DocTypeEnum {
  const lower = filename.toLowerCase();
  if (lower.includes("t12") || lower.includes("trailing")) return "t12";
  if (lower.includes("p&l") || lower.includes("pnl") || lower.includes("profit") || lower.includes("income")) return "pnl";
  if (lower.includes("rent") || lower.includes("roll") || lower.includes("tenant")) return "rent_roll";
  if (lower.includes("balance")) return "balance_sheet";
  if (lower.includes("rate")) return "rate_sheet";
  if (lower.includes("invoice")) return "invoice";
  return "other";
}'''

new_guess = '''function guessDocType(filename: string): DocTypeEnum {
  const lower = filename.toLowerCase();
  if (lower.includes("t12") || lower.includes("trailing")) return "t12";
  if (lower.includes("p&l") || lower.includes("pnl") || lower.includes("profit") || lower.includes("income")) return "pnl";
  if (lower.includes("rent") || lower.includes("roll") || lower.includes("tenant")) return "rent_roll";
  if (lower.includes("balance")) return "balance_sheet";
  if (lower.includes("rate")) return "rate_sheet";
  if (lower.includes("invoice")) return "invoice";
  if (lower.includes("payout") || lower.includes("airbnb") || lower.includes("vrbo")) return "payout";
  if (lower.includes("occupancy") || lower.includes("occ")) return "occupancy";
  if (lower.includes("operating") || lower.includes("ops")) return "operating_statement";
  if (lower.includes("lease") || lower.includes("abstract")) return "lease_abstract";
  if (lower.includes("cam") || lower.includes("reconcil")) return "cam_reconciliation";
  if (lower.includes("tax return") || lower.includes("schedule e") || lower.includes("k-1") || lower.includes("k1")) return "tax_return";
  if (lower.includes("insurance") || lower.includes("declaration")) return "insurance";
  if (lower.includes("property tax") || lower.includes("tax bill")) return "property_tax";
  if (lower.includes("appraisal")) return "appraisal";
  if (lower.includes("environment") || lower.includes("phase i") || lower.includes("phase ii")) return "environmental";
  if (lower.includes("fuel")) return "fuel_sales";
  if (lower.includes("wash") || lower.includes("machine")) return "wash_count";
  if (lower.includes("smith travel") || lower.includes("str report")) return "smith_travel";
  if (lower.includes("franchise")) return "franchise";
  if (lower.includes("debt") || lower.includes("loan") || lower.includes("mortgage")) return "debt_schedule";
  if (lower.includes("capex") || lower.includes("capital")) return "capex_log";
  if (lower.includes("unit mix")) return "unit_mix";
  if (lower.includes("bank statement")) return "bank_statement";
  return "other";
}'''

if 'lower.includes("payout")' not in content:
    content = content.replace(old_guess, new_guess)
    print('  ✅ P3: Enhanced guessDocType with 15+ new patterns')
else:
    print('  ⏭️  P3: guessDocType already enhanced')

with open("client/src/components/onboarding/OnboardingWizard.tsx", "w") as f:
    f.write(content)
PYEOF

# ─────────────────────────────────────────────────
# PATCH 4: Convert renderDocumentUploadStep to block fn + swap dropdown
# ─────────────────────────────────────────────────
python3 << 'PYEOF'
with open("client/src/components/onboarding/OnboardingWizard.tsx", "r") as f:
    content = f.read()

# 4a: Convert arrow to block function
old_arrow = '  const renderDocumentUploadStep = () => ('
new_arrow = '''  const renderDocumentUploadStep = () => {
    const assetDocTypes = state.assetClass
      ? getDocumentTypesForAsset(state.assetClass)
      : getDocumentTypesForAsset('business');
    return ('''

if 'assetDocTypes' not in content:
    content = content.replace(old_arrow, new_arrow, 1)
    print('  ✅ P4a: Converted to block function with assetDocTypes')
else:
    print('  ⏭️  P4a: Already converted')

with open("client/src/components/onboarding/OnboardingWizard.tsx", "w") as f:
    f.write(content)
PYEOF

# ─────────────────────────────────────────────────
# PATCH 4b: Close the block function (add }; after the return's closing)
# ─────────────────────────────────────────────────
python3 << 'PYEOF'
import re

with open("client/src/components/onboarding/OnboardingWizard.tsx", "r") as f:
    content = f.read()

# We need to find where renderDocumentUploadStep's JSX ends
# The original was () => (...) which ends with );
# Now it's () => { ... return (...); } so we need the closing brace

# Find the assetDocTypes line to confirm we're in the right function
if 'assetDocTypes' in content and 'const renderDocumentUploadStep = () => {' in content:
    # Find the renderDealInfoStep or renderMarinaDetailsStep that comes after
    # The document upload step is followed by other render functions
    # Look for the pattern: closing of JSX );\n\n  const render
    
    # Find the start of our function
    func_start = content.index('const renderDocumentUploadStep = () => {')
    
    # Find the next "const render" after our function start
    next_render = content.find('\n  const render', func_start + 50)
    if next_render == -1:
        next_render = content.find('\n  const getStepContent', func_start + 50)
    
    if next_render > 0:
        # Look backward from next_render to find the ); that closes our return
        # The pattern should be: ...JSX...</div>\n  );\n\n  const render...
        # We need to insert }; between ); and the next const
        
        before_next = content[func_start:next_render]
        
        # Check if there's already a closing brace
        # Look at the last few chars before next_render
        trailing = content[next_render-10:next_render].strip()
        if trailing.endswith('};'):
            print('  ⏭️  P4b: Closing brace already present')
        elif trailing.endswith(');'):
            # Insert }; after the );
            last_semicolon = content.rfind(');', func_start, next_render)
            if last_semicolon > 0:
                insert_pos = last_semicolon + 2
                content = content[:insert_pos] + '\n  };' + content[insert_pos:]
                print('  ✅ P4b: Added closing brace for block function')
            else:
                print('  ⚠️  P4b: Could not find closing ); pattern')
        else:
            print(f'  ⚠️  P4b: Unexpected trailing pattern: {trailing}')
    else:
        print('  ⚠️  P4b: Could not find next render function')
else:
    print('  ⏭️  P4b: Block function not detected')

with open("client/src/components/onboarding/OnboardingWizard.tsx", "w") as f:
    f.write(content)
PYEOF

# ─────────────────────────────────────────────────
# PATCH 5: Replace the doc type dropdown options
# ─────────────────────────────────────────────────
python3 << 'PYEOF'
with open("client/src/components/onboarding/OnboardingWizard.tsx", "r") as f:
    content = f.read()

old_dropdown = '''                    {Object.entries(WIZARD_DOC_TYPES_NO_T12).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}'''

new_dropdown = '''                    {assetDocTypes
                      .filter(dt => dt.id !== 't12')
                      .map((dt) => (
                      <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>
                    ))}'''

if 'WIZARD_DOC_TYPES_NO_T12' in content:
    content = content.replace(old_dropdown, new_dropdown, 1)
    print('  ✅ P5: Replaced doc type dropdown with asset-filtered types')
else:
    print('  ⏭️  P5: Dropdown already replaced')

with open("client/src/components/onboarding/OnboardingWizard.tsx", "w") as f:
    f.write(content)
PYEOF

# ─────────────────────────────────────────────────
# PATCH 6: Widen the SelectTrigger for longer labels
# ─────────────────────────────────────────────────
python3 -c "
with open('$FILE', 'r') as f:
    content = f.read()

# The doc type select trigger is w-[140px] which may be too narrow for longer labels
old = '<SelectTrigger className=\"h-7 w-[140px] text-xs\">'
new = '<SelectTrigger className=\"h-7 w-[180px] text-xs\">'

# Only replace the one in the doc type dropdown (first occurrence in staged files section)
if 'w-[140px]' in content:
    content = content.replace(old, new, 1)
    print('  ✅ P6: Widened doc type dropdown to 180px')
else:
    print('  ⏭️  P6: Already widened')

with open('$FILE', 'w') as f:
    f.write(content)
"

echo ""
echo "═══════════════════════════════════════════════"
echo "  All patches applied. Running build..."
echo "═══════════════════════════════════════════════"

npm run build 2>&1 | tail -20
