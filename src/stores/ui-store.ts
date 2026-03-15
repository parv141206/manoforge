"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LayoutMode = "floating" | "compact";

interface UiStore {
  layoutMode: LayoutMode;
  editorFontSize: number;
  tabSize: number;
  setLayoutMode: (mode: LayoutMode) => void;
  setEditorFontSize: (size: number) => void;
  setTabSize: (size: number) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      layoutMode: "floating",
      editorFontSize: 14,
      tabSize: 4,
      setLayoutMode: (mode) => set({ layoutMode: mode }),
      setEditorFontSize: (size) =>
        set({ editorFontSize: Math.min(24, Math.max(11, size)) }),
      setTabSize: (size) => {
        const allowed = [2, 4, 8];
        set({ tabSize: allowed.includes(size) ? size : 4 });
      },
    }),
    {
      name: "mano-forge-ui",
    },
  ),
);
