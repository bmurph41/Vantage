/**
 * Project derivation service (Phase 3 Session 3).
 *
 * The Overview KPI cards read stored root scalars on modeling_projects
 * (total_storage_units, ebitda, ...). The Phase 3 Session 2 diagnostic showed
 * those columns are not populated by the data pipelines, so the cards render
 * "—" even when the underlying data exists (slip counts in customMetrics). This
 * service derives those scalars from the canonical sources at WRITE time
 * (project save), with *_computed_at provenance — NOT at render time.
 *
 * Marina-only for now (the only asset class with a wired writeback path). Other
 * asset classes add their own branch / source mapping when prioritized.
 *
 * NOTE: the EBITDA writeback (Part B of the Session 3 brief) is intentionally
 * NOT implemented here — the B1 trace found modeling_actuals categories are
 * semantically polluted (revenue lines like "Used Boat Sales" filed under
 * category='Expenses'), so a computed EBITDA would be confidently wrong. That
 * fix is gated on an upstream classification diagnostic. See the journal.
 */

/**
 * Derive total storage units from a project's customMetrics.
 *
 * Marina: sum the `count` of every department whose `section === 'storage'`
 * (wet_slips, dry_racks_*, moorings, lift_slips, land_storage, …) — matching the
 * column's own definition, "wet slips + dry racks, etc." This deliberately
 * EXCLUDES `section: 'designated'` departments (service, fuel_dock, restaurant,
 * ship_store, boat_sales, commercial_tenants, …) which are not storage capacity.
 *
 * Verified against live data: Keystone → 312 (30 wet + 282 dry racks),
 * Test Marina → 300 (wet only), Sunset Harbor → null (departments declared but
 * all counts null). A wet_slips-only sum would have undercounted Keystone by 282,
 * which is why we sum by section rather than a fixed wet/dry key pair.
 *
 * @returns the summed count, or null if there is no positive storage count.
 */
export function deriveTotalStorageUnits(
  assetClass: string | null | undefined,
  customMetrics: any,
): number | null {
  if (assetClass === 'marina') {
    const departments = customMetrics?.config?.departments;
    if (!departments || typeof departments !== 'object') return null;

    let total = 0;
    for (const dept of Object.values<any>(departments)) {
      if (dept?.section === 'storage') {
        const n = Number(dept?.count);
        if (Number.isFinite(n) && n > 0) total += n;
      }
    }
    return total > 0 ? total : null;
  }

  // Future asset classes wire their own size source here.
  return null;
}
