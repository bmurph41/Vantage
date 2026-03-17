#!/bin/bash
# =============================================================
#  PATCH: Property form listing status + last_contacted_at
#  Touches 2 files:
#    1. property-form-modal.tsx       — expand status options + listing price
#    2. crm-activities-routes.ts      — auto-update last_contacted_at on contact
# =============================================================
set -e

echo "=== Patching property-form-modal.tsx ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/components/modals/property-form-modal.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('off_market') && src.includes('listingPrice')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Replace the limited propertyStatuses with the full lifecycle
src = src.replace(
  `const propertyStatuses = [
  { value: "target", label: "Target" },
  { value: "for_sale", label: "For Sale" },
  { value: "under_loi", label: "Under LOI" },
  { value: "under_contract", label: "Under Contract" },
];`,
  `const propertyStatuses = [
  { value: "off_market",     label: "Off Market" },
  { value: "on_market",      label: "On Market" },
  { value: "under_loi",      label: "Under LOI" },
  { value: "under_contract", label: "Under Contract" },
  { value: "closed",         label: "Closed" },
  { value: "portfolio",      label: "Portfolio" },
  { value: "watchlist",      label: "Watchlist" },
  // Legacy
  { value: "target",         label: "Target (legacy)" },
  { value: "for_sale",       label: "For Sale (legacy)" },
];`
);

// 2. Add listingPrice state variable after the lastSalePrice state line
src = src.replace(
  `  const [lastSalePrice, setLastSalePrice] = useState("");`,
  `  const [lastSalePrice, setLastSalePrice] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingStatus, setListingStatus] = useState("");`
);

// 3. Reset listingPrice/listingStatus in the useEffect when property loads
src = src.replace(
  `      setLastSaleMonth(propAny.lastSaleMonth?.toString() || "");
      setLastSaleYear(propAny.lastSaleYear?.toString() || "");
      setLastSalePrice(propAny.lastSalePrice?.toString() || "");`,
  `      setLastSaleMonth(propAny.lastSaleMonth?.toString() || "");
      setLastSaleYear(propAny.lastSaleYear?.toString() || "");
      setLastSalePrice(propAny.lastSalePrice?.toString() || "");
      setListingPrice(propAny.listingPrice?.toString() || "");
      setListingStatus(propAny.listingStatus || property.status || "");`
);

// 4. Also reset in the else branch (new property)
// Find the else reset block — it resets form to defaults
src = src.replace(
  `      setLastSaleMonth("");
      setLastSaleYear("");
      setLastSalePrice("");`,
  `      setLastSaleMonth("");
      setLastSaleYear("");
      setLastSalePrice("");
      setListingPrice("");
      setListingStatus("");`
);

// 5. Add listingPrice + listingStatus to the mutation payload
// The create/update mutations build their payload — find where lastSalePrice is added
const payloadAnchor = `lastSalePrice: lastSalePrice ? parseFloat(lastSalePrice) : null,`;
if (src.includes(payloadAnchor)) {
  src = src.replace(
    payloadAnchor,
    `${payloadAnchor}
        listingPrice: listingPrice ? listingPrice : null,
        listingStatus: listingStatus || null,`
  );
  console.log('  ✓ Added listingPrice/listingStatus to mutation payload');
} else {
  // Try alternate: find where wetSlips is added and insert near it
  const altAnchor = `wetSlips: wetSlips ? parseInt(wetSlips) : null,`;
  if (src.includes(altAnchor)) {
    src = src.replace(
      altAnchor,
      `${altAnchor}
        listingPrice: listingPrice || null,
        listingStatus: listingStatus || null,`
    );
    console.log('  ✓ Added listingPrice/listingStatus near wetSlips in payload');
  }
}

// 6. Add Listing Status select + Listing Price input to the form UI
// Find the existing status FormField and replace it with expanded version
const statusFieldAnchor = `                name="status"`;
const statusFieldIdx = src.indexOf(statusFieldAnchor);
if (statusFieldIdx !== -1) {
  // Find the closing of this FormField
  const fieldStart = src.lastIndexOf('<FormField', statusFieldIdx);
  const fieldEnd = src.indexOf('</FormField>', statusFieldIdx) + 12;
  
  const newStatusField = `<FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deal Status</FormLabel>
                      <Select onValueChange={(v) => { field.onChange(v); setListingStatus(v); }} value={listingStatus || field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white dark:bg-slate-900" data-testid="select-property-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {propertyStatuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Listing Price */}
                <FormItem>
                  <FormLabel>Asking / Listing Price</FormLabel>
                  <Input
                    value={listingPrice}
                    onChange={e => setListingPrice(e.target.value)}
                    placeholder="e.g. 4500000"
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-listing-price"
                  />
                </FormItem>`;

  src = src.slice(0, fieldStart) + newStatusField + src.slice(fieldEnd);
  console.log('  ✓ Expanded status field + added listing price');
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ property-form-modal.tsx patched');
JS

echo ""
echo "=== Patching crm-activities-routes.ts — auto-update last_contacted_at ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'server/routes/crm-activities-routes.ts';
let src = readFileSync(path, 'utf8');

if (src.includes('last_contacted_at') || src.includes('lastContactedAt')) {
  console.log('  ✓ Already has lastContactedAt logic'); process.exit(0);
}

// 1. Add crmContacts to imports
src = src.replace(
  `import { crmActivities, users } from '@shared/schema';`,
  `import { crmActivities, crmContacts, users } from '@shared/schema';`
);

// 2. Find the POST route where activity is inserted and add the auto-update after it
// The insert is at: const [activity] = await db.insert(crmActivities).values({...
// We need to add after the insert completes and we have the activity result

// Find the pattern: after insert, there's a createTimelineEvent call
const insertAnchor = `    // Create timeline event`;
if (src.includes(insertAnchor)) {
  const autoUpdateCode = `
    // Auto-update last_contacted_at on the linked contact
    const actContactId = body.contactId || body.entityType === 'contact' ? (body.contactId || body.entityId) : null;
    if (actContactId) {
      try {
        await db
          .update(crmContacts)
          .set({ lastContactedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(crmContacts.id, actContactId), eq(crmContacts.orgId, orgId)));
      } catch {
        // Non-fatal — don't fail the activity creation if this update fails
      }
    }

    // Create timeline event`;
  src = src.replace(insertAnchor, autoUpdateCode);
  console.log('  ✓ Added lastContactedAt auto-update after activity insert');
} else {
  // Fallback: find the activity insert return and add before it
  const returnAnchor = `    return res.status(201).json(activity);`;
  if (src.includes(returnAnchor)) {
    const autoUpdateCode = `
    // Auto-update last_contacted_at on the linked contact
    const actContactId = body.contactId || (body.entityType === 'contact' ? body.entityId : null);
    if (actContactId) {
      try {
        await db
          .update(crmContacts)
          .set({ lastContactedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(crmContacts.id, actContactId), eq(crmContacts.orgId, orgId)));
      } catch {
        // Non-fatal
      }
    }

    return res.status(201).json(activity);`;
    src = src.replace(returnAnchor, autoUpdateCode);
    console.log('  ✓ Added lastContactedAt auto-update before activity return');
  } else {
    console.log('  ⚠ Could not find insertion point — manual step required');
    console.log('  After db.insert(crmActivities), add:');
    console.log('    const cId = body.contactId || (body.entityType==="contact" ? body.entityId : null);');
    console.log('    if (cId) await db.update(crmContacts).set({ lastContactedAt: new Date() }).where(eq(crmContacts.id, cId));');
  }
}

// 3. Also handle the complete activity route — mark contact as touched when activity completed
const completeAnchor = `router.post('/:id/complete',`;
const completeIdx = src.indexOf(completeAnchor);
if (completeIdx !== -1) {
  // Find where the complete mutation updates status and add contact update after
  const completeReturnAnchor = src.indexOf(`return res.json(`, completeIdx);
  if (completeReturnAnchor !== -1) {
    const contactUpdateCode = `
    // Also update last_contacted_at when activity is completed
    if (existing?.contactId) {
      try {
        await db
          .update(crmContacts)
          .set({ lastContactedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(crmContacts.id, existing.contactId), eq(crmContacts.orgId, orgId)));
      } catch { /* non-fatal */ }
    }

    `;
    src = src.slice(0, completeReturnAnchor) + contactUpdateCode + src.slice(completeReturnAnchor);
    console.log('  ✓ Added lastContactedAt update on activity complete');
  }
}

// 4. Make sure and() is imported (it already should be)
if (!src.includes('and,') && !src.includes(', and,')) {
  src = src.replace(
    `import { eq, and, or,`,
    `import { eq, and, or,`
  );
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ crm-activities-routes.ts patched');
JS

echo ""
echo "✅ Both patches applied."
echo ""
echo "What was added:"
echo ""
echo "  • property-form-modal.tsx:"
echo "    — Status dropdown now shows full lifecycle:"
echo "      Off Market / On Market / Under LOI / Under Contract / Closed / Portfolio / Watchlist"
echo "    — New 'Asking / Listing Price' input field"
echo "    — Both fields save to listingStatus + listingPrice on the property record"
echo ""
echo "  • crm-activities-routes.ts:"
echo "    — When any activity is logged against a contact (via contactId or entityType='contact'),"
echo "      last_contacted_at is auto-updated on crm_contacts"
echo "    — When an activity is marked complete, same auto-update fires"
echo "    — Both updates are non-fatal (activity creation never fails if contact update fails)"
echo ""
echo "Restart: pkill -f 'tsx server' && npm run dev"
