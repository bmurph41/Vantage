/**
 * Occupancy Rollup — location-keyed → type-keyed (Step B)
 * ───────────────────────────────────────────────────────────────
 * Pure helper used by:
 *   - UI summary in client/src/pages/modeling/projects/workspace/assumptions.tsx
 *     (replaces the unweighted-arithmetic-mean `getStorageTypeAvgOccupancy`
 *      at the legacy location-roll-up display)
 *   - UI save path (rolls location-keyed input up to the type level before
 *     writing the v3 RevenueDriverBlob dimension)
 *   - Any other future caller that needs to project location-level occupancy
 *     onto a storage-type dimension
 *
 * Canonical math: UNIT-WEIGHTED.
 *   typeOcc[type, year] = Σ(loc.occ[year] × loc.units) / Σ(loc.units)
 * where the sums are taken over all locations whose storageType === type
 * and whose `loc.units > 0`. Locations with `units === 0` drop out entirely
 * (weight zero — they don't bias the average toward whichever value happens
 * to be set on a placeholder row).
 *
 * Why unit-weighted (ratified 2026-05-23):
 *   - 200@90% + 10@30% should NOT report 60% type-level occupancy
 *     (arithmetic mean). The 10-slip outlier is 5% of the capacity; weighting
 *     by units recovers the engineering-correct 87.14%.
 *   - The UI's pre-Step-B `getStorageTypeAvgOccupancy` returned the unweighted
 *     mean (a latent display bug). This helper is the single source of truth
 *     that both the UI summary and the v3 write path now share.
 *
 * Returns `null` for a (type, year) when no location with non-zero units
 * carries that type — caller decides whether to omit, default, or surface.
 */

export interface LocationOccupancyInput {
  /** Location id → year (string) → pct 0..100. */
  locationOccupancyByYear: Record<string, Record<string, number>>;
  /** Location id → unit count (drops the location if `units <= 0`). */
  locationUnitsById: Record<string, number>;
  /** Location id → storage type id (e.g. `wet_slips`, `dry_racks_indoor`). */
  locationToTypeMap: Record<string, string>;
}

/**
 * Roll up location-keyed occupancy to type-keyed occupancy by unit-weighted
 * mean. Returns `Record<typeId, Record<year, pct>>`.
 *
 * Single-location types reduce trivially to the location's own value.
 * Equal-units types reduce to the arithmetic mean (so equal-units fixtures
 * stay numerically stable across formula changes).
 */
export function rollupLocationOccupancyToType(
  input: LocationOccupancyInput,
): Record<string, Record<string, number>> {
  const { locationOccupancyByYear, locationUnitsById, locationToTypeMap } = input;

  // type → year → { weightedSum, totalWeight }
  const acc: Record<string, Record<string, { weightedSum: number; totalWeight: number }>> = {};

  for (const [locId, byYear] of Object.entries(locationOccupancyByYear)) {
    const units = locationUnitsById[locId] ?? 0;
    if (units <= 0) continue;
    const typeId = locationToTypeMap[locId];
    if (!typeId) continue;

    for (const [year, pct] of Object.entries(byYear)) {
      if (typeof pct !== 'number' || !Number.isFinite(pct)) continue;
      if (!acc[typeId]) acc[typeId] = {};
      if (!acc[typeId][year]) acc[typeId][year] = { weightedSum: 0, totalWeight: 0 };
      acc[typeId][year].weightedSum += pct * units;
      acc[typeId][year].totalWeight += units;
    }
  }

  const out: Record<string, Record<string, number>> = {};
  for (const [typeId, byYear] of Object.entries(acc)) {
    out[typeId] = {};
    for (const [year, { weightedSum, totalWeight }] of Object.entries(byYear)) {
      // totalWeight > 0 here because units<=0 locations are filtered above.
      out[typeId][year] = weightedSum / totalWeight;
    }
  }
  return out;
}

/**
 * Sum location units per storage type — used by the UI write path to populate
 * v3 `dimensions[type].totalCapacity.value`. Step B defaults `unit='count'`
 * (rent-roll units, not LF) because no LF-per-slip mapping exists in
 * marina-catalog.ts today. Per-LF capacity is a tracked gap.
 */
export function sumUnitsPerType(input: {
  locationUnitsById: Record<string, number>;
  locationToTypeMap: Record<string, string>;
}): Record<string, number> {
  const { locationUnitsById, locationToTypeMap } = input;
  const out: Record<string, number> = {};
  for (const [locId, units] of Object.entries(locationUnitsById)) {
    if (typeof units !== 'number' || units <= 0) continue;
    const typeId = locationToTypeMap[locId];
    if (!typeId) continue;
    out[typeId] = (out[typeId] ?? 0) + units;
  }
  return out;
}

/**
 * Validate that every COA-line subcategory the caller intends to write
 * occupancy for maps to a storage-type key. Returns the unmappable
 * subcategories so the UI can surface them (fail-loud write per Brett's
 * directive — never silently accept unmappable data).
 *
 * `mapper` is `storageSubcategoryToTypeKey` in production; injected here
 * to keep this module dependency-free.
 */
export function findUnmappableSubcategories(
  subcategories: string[],
  mapper: (s: string) => string | undefined,
): string[] {
  const unmappable: string[] = [];
  for (const sub of subcategories) {
    if (!mapper(sub)) unmappable.push(sub);
  }
  return unmappable;
}
