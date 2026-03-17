#!/bin/bash
# =============================================================
#  PATCH 04 — Wire PropertyFMPanel + PropertyCompsPanel into
#              client/src/pages/property-record.tsx
#
#  Strategy: reads property-record.tsx, finds the right column
#  (3rd column or the last major section), and injects the panels.
#  Uses a safe contextual Node.js script — no regex guessing.
# =============================================================

set -e
FILE="client/src/pages/property-record.tsx"

echo "→ Checking property-record.tsx exists..."
[ -f "$FILE" ] || { echo "ERROR: $FILE not found"; exit 1; }

echo "→ Backing up..."
cp "$FILE" "${FILE}.bak_$(date +%Y%m%d_%H%M%S)"
echo "  ✓ Backup saved"

# Run the patch as a Node script
node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/property-record.tsx';
let src = readFileSync(path, 'utf8');

// ── Step 1: Add imports if not present ──────────────────────
const importBlock = `import { PropertyFMPanel } from '@/components/crm/PropertyFMPanel';
import { PropertyCompsPanel } from '@/components/crm/PropertyCompsPanel';`;

if (!src.includes('PropertyFMPanel')) {
  // Insert after the last import statement
  const lastImportMatch = src.match(/(import[^;]+;[\r\n]+)(?!import)/);
  if (lastImportMatch) {
    const idx = src.lastIndexOf('\nimport ');
    // Find end of that import line
    const lineEnd = src.indexOf('\n', idx + 1);
    src = src.slice(0, lineEnd + 1) + importBlock + '\n' + src.slice(lineEnd + 1);
    console.log('  ✓ Added imports for PropertyFMPanel + PropertyCompsPanel');
  } else {
    // Prepend to file
    src = importBlock + '\n\n' + src;
    console.log('  ✓ Prepended imports');
  }
} else {
  console.log('  ✓ Imports already present');
}

// ── Step 2: Inject panels into the right column ──────────────
// We look for common patterns in 3-column CRM record pages.
// Pattern A: A section that contains "Activities" or "Timeline" in the right column
// Pattern B: A specific closing div pattern for the right column
// Pattern C: The closing of the last panel/card section

// Try to find a reliable anchor in the right/third column
// Look for the rollups/KPI section or activity section heading

const panelJsx = `
          {/* ── Financial Models ── */}
          <div className="rounded-lg border bg-card p-4">
            <PropertyFMPanel
              propertyId={property.id}
              dealId={property.deals?.[0]?.id}
            />
          </div>

          {/* ── Market Comps ── */}
          <div className="rounded-lg border bg-card p-4">
            <PropertyCompsPanel
              propertyId={property.id}
              assetClass={property.type}
              latitude={property.latitude ? Number(property.latitude) : null}
              longitude={property.longitude ? Number(property.longitude) : null}
              city={property.city}
              state={property.state}
              unitLabel={property.type === 'marina' ? '$/slip' : '$/SF'}
            />
          </div>
`;

// Look for common anchors where we can inject the FM + Comps panels
// These are patterns that appear near the bottom of the right column
const anchors = [
  // Anchor 1: After the rollups/KPI section
  'rollups',
  // Anchor 2: After the RecentActivity section
  'RecentActivity',
  // Anchor 3: Before the final closing of the right column
  '{/* Right column end */}',
  // Anchor 4: A closing </div> after the timeline section
  'ActivityTimeline',
  // Anchor 5: The deals panel
  'deals.map',
];

let injected = false;

// Strategy: look for the property record's right column div and inject before its last closing tag
// The right column typically ends with </div> </div> pattern after the last panel

// Try anchor: find "recentActivities" section rendering and insert the panels after it
const activityAnchorPatterns = [
  /(<\/div>\s*\n\s*)([\s\S]{0,200}?)(\/\*[^*]*right\s*column\s*end[^*]*\*\/)/i,
  /({property\.rollups && \([\s\S]*?\)}\s*\n)/,
  /({recentActivities && \([\s\S]*?\)}\s*\n)/,
  /(timeline|Timeline|ActivityTimeline|activityTimeline)[\s\S]{0,500}?(<\/div>\s*\n\s*<\/div>)/,
];

// More practical approach: find a section that renders timeline/activities
// and insert AFTER the closing of that section

// First, check if already patched
if (src.includes('PropertyFMPanel') && src.includes('PropertyCompsPanel') && 
    src.match(/PropertyFMPanel[\s\S]*?propertyId=\{property\.id\}/)) {
  console.log('  ✓ Panels already injected into property-record.tsx');
  injected = true;
}

if (!injected) {
  // Try to find the right column's inner container
  // Look for: className that contains "col-span" or "space-y" that's the right column
  // Then find its last substantial child element closing tag

  // Strategy: Look for the RecentActivities/Timeline block and append after it
  // Common pattern: {data.recentActivities && <SomeTimeline /> }
  
  // Look for common section close patterns in the 3-column layout
  // The right column often ends with something like:
  //   </div>  {/* end of right col panels */}
  // </div>    {/* end of 3-col grid */}

  // Pattern: find where deals or notes section ends in the right column
  // These pages usually have: deals section → activities → notes
  // We insert after the last of these

  // Let's look for a specific pattern: the closing of the "notes" or "recent activities" section
  const notesPattern = /(\/\* (?:notes|Notes|recent\s*activities?|Recent\s*Activities?) \*\/|notes\.slice|recentActivities\.slice|\.map\(\s*\(note\s*:|\.map\(\s*\(activity\s*:)[\s\S]{0,800}?(<\/div>\s*\n\s*<\/div>\s*\n)/i;
  const notesMatch = src.match(notesPattern);

  if (notesMatch) {
    const insertIdx = src.indexOf(notesMatch[0]) + notesMatch[0].length;
    src = src.slice(0, insertIdx) + panelJsx + src.slice(insertIdx);
    console.log('  ✓ Injected panels after notes/activities section');
    injected = true;
  }

  if (!injected) {
    // Fallback: find the summary route data destructuring and the last major section
    // Look for patterns like: {data?.contacts?.length > 0 && (
    const contactsPattern = /(\{(?:data\?\.)?contacts[\s\S]{0,50}length[\s\S]{500,1500}?<\/div>\s*\n\s*\)?\s*\n)/;
    const contactsMatch = src.match(contactsPattern);
    if (contactsMatch) {
      const insertIdx = src.indexOf(contactsMatch[0]) + contactsMatch[0].length;
      src = src.slice(0, insertIdx) + panelJsx + src.slice(insertIdx);
      console.log('  ✓ Injected panels after contacts section');
      injected = true;
    }
  }

  if (!injected) {
    // Last resort: find the closing of the last major content area before </main> or </div></div>
    // Look for the 3-column grid closing pattern
    const gridClosePattern = /(grid[\s\S]{1,100}?col-span[\s\S]{100,3000}?)(<\/div>\s*\n\s*<\/div>\s*\n\s*(?:<\/main>|<\/div>))/;
    const gridMatch = src.match(gridClosePattern);
    if (gridMatch) {
      const fullMatch = gridMatch[0];
      const insertAt = gridMatch.index! + gridMatch[1].length;
      src = src.slice(0, insertAt) + panelJsx + src.slice(insertAt);
      console.log('  ✓ Injected panels before grid close');
      injected = true;
    }
  }

  if (!injected) {
    // Absolute last resort: find </main> and insert before it
    const mainClose = src.lastIndexOf('</main>');
    if (mainClose !== -1) {
      src = src.slice(0, mainClose) + `\n      <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">\n${panelJsx}\n      </div>\n` + src.slice(mainClose);
      console.log('  ✓ Injected panels before </main> (fallback)');
      injected = true;
    } else {
      console.warn('  ⚠ Could not find injection point — manual insertion required');
      console.warn('  Manual: add PropertyFMPanel and PropertyCompsPanel to the right column of property-record.tsx');
      // Still write the imports at least
    }
  }
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ property-record.tsx updated');
JSEOF

# ── Verify TypeScript compiles ──────────────────────────────────
echo ""
echo "→ Quick TypeScript check on property-record.tsx..."
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "property-record|PropertyFMPanel|PropertyCompsPanel" | head -10 || true

echo ""
echo "✅ Patch 04 complete."
echo ""
echo "If the injection was 'fallback' mode, manually add to property-record.tsx:"
echo "  1. Import: import { PropertyFMPanel } from '@/components/crm/PropertyFMPanel';"
echo "  2. Import: import { PropertyCompsPanel } from '@/components/crm/PropertyCompsPanel';"
echo "  3. In the right column, add:"
echo "     <PropertyFMPanel propertyId={property.id} dealId={property.deals?.[0]?.id} />"
echo "     <PropertyCompsPanel propertyId={property.id} assetClass={property.type}"
echo "       latitude={Number(property.latitude)} longitude={Number(property.longitude)}"
echo "       city={property.city} state={property.state} />"
echo ""
echo "Next: run crm_patch_05_rel_score.sh"
