/**
 * Operations Asset Context Store
 *
 * Tracks the currently selected asset in the Operations section.
 * When null, shows portfolio-wide (all assets) data.
 * When set to an asset ID, operations pages filter to that specific asset.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OpsAssetState {
  /** Currently selected asset ID, or null for portfolio-wide view */
  selectedAssetId: string | null;
  /** Name of the selected asset (for display) */
  selectedAssetName: string | null;
  /** Set the active asset */
  setSelectedAsset: (id: string | null, name?: string | null) => void;
  /** Clear selection (back to portfolio view) */
  clearSelection: () => void;
}

export const useOpsAssetStore = create<OpsAssetState>()(
  persist(
    (set) => ({
      selectedAssetId: null,
      selectedAssetName: null,
      setSelectedAsset: (id, name = null) => set({ selectedAssetId: id, selectedAssetName: name }),
      clearSelection: () => set({ selectedAssetId: null, selectedAssetName: null }),
    }),
    {
      name: 'ops-asset-context',
    }
  )
);
