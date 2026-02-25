#!/bin/bash
set -e

FILE="client/src/components/onboarding/OnboardingWizard.tsx"
BACKUP="backups/wizard-config-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
cp "$FILE" "$BACKUP/OnboardingWizard.tsx.bak"
echo "✅ Backup saved to $BACKUP"

# ─────────────────────────────────────────────────
# PATCH 1: Add import for wizard config
# ─────────────────────────────────────────────────
python3 -c "
with open('$FILE', 'r') as f:
    content = f.read()

old = \"import { getAssetClassCatalog } from '@shared/asset-class-catalog';\"
new_imp = old + '''
import { getWizardConfig } from '@shared/wizard-enhancement-config';'''

if 'getWizardConfig' not in content:
    content = content.replace(old, new_imp)
    print('  ✅ P1: Added wizard config import')
else:
    print('  ⏭️  P1: Import already present')

with open('$FILE', 'w') as f:
    f.write(content)
"

# ─────────────────────────────────────────────────
# PATCH 2: Add propertySizeValues to WizardState + initial state
# ─────────────────────────────────────────────────
python3 -c "
with open('$FILE', 'r') as f:
    content = f.read()

changed = False

old_iface = '  acreage: WizardAcreage;'
new_iface = '  acreage: WizardAcreage;\n  propertySizeValues: Record<string, string>;'
if 'propertySizeValues' not in content:
    content = content.replace(old_iface, new_iface, 1)
    changed = True

old_init = \"    acreage: { totalAcres: '', uplandAcres: '', submergedAcres: '' },\"
new_init = old_init + '\n    propertySizeValues: {},'
if 'propertySizeValues: {}' not in content:
    content = content.replace(old_init, new_init, 1)
    changed = True

print('  ✅ P2: Added propertySizeValues to state' if changed else '  ⏭️  P2: Already present')

with open('$FILE', 'w') as f:
    f.write(content)
"

# ─────────────────────────────────────────────────
# PATCH 3: Add property size fields to Property Details (single asset)
# ─────────────────────────────────────────────────
python3 << 'PYEOF'
with open("client/src/components/onboarding/OnboardingWizard.tsx", "r") as f:
    content = f.read()

old_end = '''            <div className="space-y-2">
              <Label htmlFor="zip">Zip</Label>
              <Input id="zip" placeholder="33139" maxLength={10} value={state.marinaAddress.zip} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, zip: e.target.value } }))} />
            </div>
          </div>
        </div>
      </div>
    );
  };'''

new_end = '''            <div className="space-y-2">
              <Label htmlFor="zip">Zip</Label>
              <Input id="zip" placeholder="33139" maxLength={10} value={state.marinaAddress.zip} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, zip: e.target.value } }))} />
            </div>
          </div>

          {/* Property Size — driven by asset class config */}
          {state.assetClass && (() => {
            const wizCfg = getWizardConfig(state.assetClass);
            if (!wizCfg.propertySizeFields.length) return null;
            return (
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Property Size</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {wizCfg.propertySizeFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step={field.suffix === 'acres' ? '0.01' : '1'}
                          placeholder="0"
                          value={state.propertySizeValues[field.id] || ''}
                          onChange={(e) => setState(s => ({
                            ...s,
                            propertySizeValues: { ...s.propertySizeValues, [field.id]: e.target.value }
                          }))}
                          className={field.suffix ? 'pr-12' : ''}
                        />
                        {field.suffix && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {field.suffix}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };'''

if 'Property Size' not in content:
    if old_end in content:
        content = content.replace(old_end, new_end, 1)
        print('  ✅ P3: Added property size fields to Property Details')
    else:
        print('  ⚠️  P3: Could not find zip field pattern — check manually')
else:
    print('  ⏭️  P3: Property size fields already present')

with open("client/src/components/onboarding/OnboardingWizard.tsx", "w") as f:
    f.write(content)
PYEOF

# ─────────────────────────────────────────────────
# PATCH 4: Wire dynamic upload label + description
# ─────────────────────────────────────────────────
python3 << 'PYEOF'
with open("client/src/components/onboarding/OnboardingWizard.tsx", "r") as f:
    content = f.read()

old_header = '''      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Upload Documents</h3>
        <p className="text-sm text-muted-foreground">
          Upload P&L statements, rent rolls, or other financials. They'll be auto-processed by AI when your project is created.
        </p>
      </div>'''

new_header = '''      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">
          {state.assetClass ? getWizardConfig(state.assetClass).uploadLabel : 'Upload Documents'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {state.assetClass
            ? `${getWizardConfig(state.assetClass).uploadDescription} They'll be auto-processed by AI when your project is created.`
            : "Upload P&L statements, rent rolls, or other financials. They'll be auto-processed by AI when your project is created."}
        </p>
      </div>'''

if 'getWizardConfig(state.assetClass).uploadLabel' not in content:
    if old_header in content:
        content = content.replace(old_header, new_header, 1)
        print('  ✅ P4: Wired dynamic upload label/description')
    else:
        print('  ⚠️  P4: Could not find upload header — check manually')
else:
    print('  ⏭️  P4: Upload label already wired')

with open("client/src/components/onboarding/OnboardingWizard.tsx", "w") as f:
    f.write(content)
PYEOF

# ─────────────────────────────────────────────────
# PATCH 5: Wire propertySizeValues into project creation payload
# ─────────────────────────────────────────────────
python3 << 'PYEOF'
with open("client/src/components/onboarding/OnboardingWizard.tsx", "r") as f:
    content = f.read()

changed = False

old_has = 'const hasData = Object.keys(departments).length > 0 || profitCenters.length > 0 || amenities.length > 0 || acreageData || ownershipData;'
new_has = '''const propertySizeData = Object.keys(state.propertySizeValues).some(k => state.propertySizeValues[k] !== '')
          ? state.propertySizeValues : undefined;
        const hasData = Object.keys(departments).length > 0 || profitCenters.length > 0 || amenities.length > 0 || acreageData || ownershipData || propertySizeData;'''

if 'propertySizeData' not in content:
    content = content.replace(old_has, new_has, 1)
    changed = True

old_spread = '...(acreageData ? { acreage: acreageData } : {}),'
new_spread = '''...(acreageData ? { acreage: acreageData } : {}),
            ...(propertySizeData ? { propertySize: propertySizeData } : {}),'''

if 'propertySize: propertySizeData' not in content:
    content = content.replace(old_spread, new_spread, 1)
    changed = True

print('  ✅ P5: Wired propertySizeValues into payload' if changed else '  ⏭️  P5: Already in payload')

with open("client/src/components/onboarding/OnboardingWizard.tsx", "w") as f:
    f.write(content)
PYEOF

# ─────────────────────────────────────────────────
# PATCH 6: Add to hasProgress check
# ─────────────────────────────────────────────────
python3 -c "
with open('$FILE', 'r') as f:
    content = f.read()

old = \"state.acreage.totalAcres !== '' || state.acreage.uplandAcres !== '' || state.acreage.submergedAcres !== '' ||\"
new = old.rstrip(' ||') + \" || Object.values(state.propertySizeValues).some(v => v !== '') ||\"

if 'propertySizeValues).some' not in content:
    content = content.replace(old, new, 1)
    print('  ✅ P6: Added to hasProgress check')
else:
    print('  ⏭️  P6: Already in hasProgress')

with open('$FILE', 'w') as f:
    f.write(content)
"

echo ""
echo "═══════════════════════════════════════════════"
echo "  All patches applied. Running build..."
echo "═══════════════════════════════════════════════"

npm run build 2>&1 | tail -20
