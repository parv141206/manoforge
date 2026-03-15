"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ColorScheme {
  background: string;
  panel: string;
  sidebar: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  hover: string;
  active: string;
  syntax: {
    keyword: string;
    instruction: string;
    label: string;
    number: string;
    comment: string;
    directive: string;
  };
}

export const colorSchemes = {
  dracula: {
    background: "#1a1b23",
    panel: "#16171f",
    sidebar: "#121318",
    border: "#343746",
    text: "#f8f8f2",
    textMuted: "#6272a4",
    accent: "#bd93f9",
    hover: "#252630",
    active: "#343746",
    syntax: {
      keyword: "#ff79c6",
      instruction: "#8be9fd",
      label: "#50fa7b",
      number: "#bd93f9",
      comment: "#6272a4",
      directive: "#ffb86c",
    },
  },
  palenight: {
    background: "#1b1e2b",
    panel: "#171a24",
    sidebar: "#12141c",
    border: "#2d3147",
    text: "#a6accd",
    textMuted: "#676e95",
    accent: "#c792ea",
    hover: "#232738",
    active: "#2d3147",
    syntax: {
      keyword: "#c792ea",
      instruction: "#82aaff",
      label: "#c3e88d",
      number: "#f78c6c",
      comment: "#676e95",
      directive: "#ffcb6b",
    },
  },
  githubDark: {
    background: "#0a0c10",
    panel: "#0d1117",
    sidebar: "#010409",
    border: "#21262d",
    text: "#c9d1d9",
    textMuted: "#8b949e",
    accent: "#58a6ff",
    hover: "#161b22",
    active: "#21262d",
    syntax: {
      keyword: "#ff7b72",
      instruction: "#79c0ff",
      label: "#7ee787",
      number: "#a5d6ff",
      comment: "#8b949e",
      directive: "#ffa657",
    },
  },
  oneDark: {
    background: "#1c1e24",
    panel: "#181a1f",
    sidebar: "#14161a",
    border: "#2c313a",
    text: "#abb2bf",
    textMuted: "#5c6370",
    accent: "#61afef",
    hover: "#22252c",
    active: "#2c313a",
    syntax: {
      keyword: "#c678dd",
      instruction: "#61afef",
      label: "#98c379",
      number: "#d19a66",
      comment: "#5c6370",
      directive: "#e5c07b",
    },
  },
  amoled: {
    background: "#000000",
    panel: "#050505",
    sidebar: "#000000",
    border: "#141414",
    text: "#ffffff",
    textMuted: "#555555",
    accent: "#00ff88",
    hover: "#0a0a0a",
    active: "#141414",
    syntax: {
      keyword: "#ff6b9d",
      instruction: "#00ff88",
      label: "#ffcc00",
      number: "#00bfff",
      comment: "#555555",
      directive: "#ff9500",
    },
  },
  catppuccin: {
    background: "#11111b",
    panel: "#0e0e16",
    sidebar: "#09090f",
    border: "#232334",
    text: "#cdd6f4",
    textMuted: "#6c7086",
    accent: "#cba6f7",
    hover: "#181828",
    active: "#232334",
    syntax: {
      keyword: "#cba6f7",
      instruction: "#89b4fa",
      label: "#a6e3a1",
      number: "#fab387",
      comment: "#6c7086",
      directive: "#f9e2af",
    },
  },
} as const;

export type SchemeName = keyof typeof colorSchemes;

const getAmoledVariant = (scheme: ColorScheme): ColorScheme => ({
  ...scheme,
  background: "#000000",
  panel: "#050505",
  sidebar: "#000000",
  border: "#161616",
  hover: "#0d0d0d",
  active: "#1b1b1b",
});

const resolveScheme = (name: SchemeName, amoled: boolean): ColorScheme => {
  const base = colorSchemes[name] as ColorScheme;
  return amoled ? getAmoledVariant(base) : base;
};

interface ThemeStore {
  schemeName: SchemeName;
  colorScheme: ColorScheme;
  amoled: boolean;
  setScheme: (name: SchemeName) => void;
  setAmoled: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      schemeName: "dracula",
      colorScheme: resolveScheme("dracula", false),
      amoled: false,
      setScheme: (name) =>
        set({
          schemeName: name,
          colorScheme: resolveScheme(name, get().amoled),
        }),
      setAmoled: (enabled) =>
        set((state) => ({
          amoled: enabled,
          colorScheme: resolveScheme(state.schemeName, enabled),
        })),
    }),
    {
      name: "mano-forge-theme",
      onRehydrateStorage: () => (state) => {
        if (state?.schemeName) {
          state.colorScheme = resolveScheme(
            state.schemeName,
            state.amoled ?? false,
          );
        }
      },
    },
  ),
);
