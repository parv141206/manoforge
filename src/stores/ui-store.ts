"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LayoutMode = "floating" | "compact";

interface UiStore {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      layoutMode: "floating",
      setLayoutMode: (mode) => set({ layoutMode: mode }),
    }),
    {
      name: "mano-forge-ui",
    },
  ),
);
