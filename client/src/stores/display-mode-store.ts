import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DisplayModeState {
  simplifiedMode: boolean;
  toggleSimplifiedMode: () => void;
}

export const useDisplayMode = create<DisplayModeState>()(
  persist(
    (set) => ({
      simplifiedMode: false,
      toggleSimplifiedMode: () => set((state) => ({ simplifiedMode: !state.simplifiedMode })),
    }),
    { name: 'display-mode' }
  )
);
