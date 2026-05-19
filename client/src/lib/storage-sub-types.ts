import { getModelConfig } from '@shared/asset-class-model-config';

const MARINA_LEGACY_STORAGE_SUB_TYPES = [
  'WET_SLIPS', 'DRY_STACK', 'MOORINGS', 'TRAILER_STORAGE', 'RV_STORAGE', 'SERVICE_BAYS',
  'wet_slips', 'lift_slips', 'moorings', 'dinghies', 'jet_skis',
  'dry_racks_indoor', 'dry_racks_outdoor', 'land_storage',
  'boats_on_trailers', 'trailers', 'carports', 'houseboats', 'rv_sites',
] as const;

// Marina retains legacy STORAGE_SUB_TYPES vocabulary because the write picker
// (STORAGE_TYPE_LABELS in UploadDropzone.tsx) still writes these IDs. Reconciliation
// deferred to post-MVP per BETA_MVP_SPEC.md §3.5. When the subType editor (§3.6)
// ships, taxonomy becomes user-data and this legacy/canonical split resolves.
//
// For non-marina classes, MODEL_CONFIG_REGISTRY[ac].unitMix.types is the closest
// thing to a canonical taxonomy. Returning the IDs from that list means the
// Storage Leases filter shows uploads tagged with current canonical subType IDs —
// correct behavior until those classes get their own dedicated subType lists (§3.6).
export function getStorageSubTypes(assetClass: string | null | undefined): string[] {
  if (assetClass === 'marina') {
    return [...MARINA_LEGACY_STORAGE_SUB_TYPES];
  }
  if (!assetClass) return [];
  try {
    const config = getModelConfig(assetClass);
    return config.unitMix?.types?.map((t) => t.id) ?? [];
  } catch {
    return [];
  }
}

export function getStorageRentRollSubTypes(assetClass: string | null | undefined): Set<string> {
  return new Set(getStorageSubTypes(assetClass));
}
