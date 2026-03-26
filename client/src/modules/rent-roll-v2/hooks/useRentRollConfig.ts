/**
 * Hook to access the current project's rent roll configuration.
 * Returns asset-class-specific terminology, unit types, KPI cards,
 * form fields, and feature flags.
 *
 * Usage:
 *   const { terms, unitTypes, kpiCards, showBoatFields } = useRentRollConfig();
 */

import { useProjectContext } from "../contexts/ProjectContext";
import type { RentRollAssetConfig } from "@shared/rent-roll-config";

export function useRentRollConfig(): RentRollAssetConfig {
  const { rentRollConfig } = useProjectContext();
  return rentRollConfig;
}
