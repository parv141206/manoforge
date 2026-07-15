"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LayoutMode = "floating" | "compact";
export type ExecutionLogMode = "detailed" | "instruction";
export type EditorFontFamily =
  | "monaspaceArgon"
  | "monaspaceKrypton"
  | "monaspaceNeon"
  | "monaspaceRadon"
  | "monaspaceXenon";

export const editorFontStacks: Record<EditorFontFamily, string> = {
  monaspaceArgon:
    '"MF Monaspace Argon", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  monaspaceKrypton:
    '"MF Monaspace Krypton", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  monaspaceNeon:
    '"MF Monaspace Neon", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  monaspaceRadon:
    '"MF Monaspace Radon", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  monaspaceXenon:
    '"MF Monaspace Xenon", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

export const editorFontOptions: Array<{
  key: EditorFontFamily;
  label: string;
}> = [
  { key: "monaspaceArgon", label: "Monaspace Argon" },
  { key: "monaspaceKrypton", label: "Monaspace Krypton" },
  { key: "monaspaceNeon", label: "Monaspace Neon" },
  { key: "monaspaceRadon", label: "Monaspace Radon" },
  { key: "monaspaceXenon", label: "Monaspace Xenon" },
];

interface UiStore {
  layoutMode: LayoutMode;
  executionLogMode: ExecutionLogMode;
  editorFontFamily: EditorFontFamily;
  editorFontSize: number;
  tabSize: number;
  setLayoutMode: (mode: LayoutMode) => void;
  setExecutionLogMode: (mode: ExecutionLogMode) => void;
  setEditorFontFamily: (font: EditorFontFamily) => void;
  setEditorFontSize: (size: number) => void;
  setTabSize: (size: number) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      layoutMode: "floating",
      executionLogMode: "detailed",
      editorFontFamily: "monaspaceKrypton",
      editorFontSize: 14,
      tabSize: 4,
      setLayoutMode: (mode) => set({ layoutMode: mode }),
      setExecutionLogMode: (mode) => set({ executionLogMode: mode }),
      setEditorFontFamily: (font) => set({ editorFontFamily: font }),
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
