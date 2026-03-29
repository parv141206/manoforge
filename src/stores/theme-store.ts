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
  rosePine: {
    background: "#191724",
    panel: "#16141f",
    sidebar: "#13111b",
    border: "#403d52",
    text: "#e0def4",
    textMuted: "#908caa",
    accent: "#eb6f92",
    hover: "#1f1d2e",
    active: "#26233a",
    syntax: {
      keyword: "#eb6f92",
      instruction: "#9ccfd8",
      label: "#f6c177",
      number: "#c4a7e7",
      comment: "#6e6a86",
      directive: "#31748f",
    },
  },
  nord: {
    background: "#2e3440",
    panel: "#2b313c",
    sidebar: "#252b36",
    border: "#434c5e",
    text: "#e5e9f0",
    textMuted: "#81a1c1",
    accent: "#88c0d0",
    hover: "#3b4252",
    active: "#4c566a",
    syntax: {
      keyword: "#b48ead",
      instruction: "#88c0d0",
      label: "#a3be8c",
      number: "#d08770",
      comment: "#616e88",
      directive: "#ebcb8b",
    },
  },
  gruvbox: {
    background: "#282828",
    panel: "#242424",
    sidebar: "#1f1f1f",
    border: "#504945",
    text: "#ebdbb2",
    textMuted: "#a89984",
    accent: "#fe8019",
    hover: "#32302f",
    active: "#3c3836",
    syntax: {
      keyword: "#fb4934",
      instruction: "#83a598",
      label: "#b8bb26",
      number: "#d3869b",
      comment: "#928374",
      directive: "#fabd2f",
    },
  },
  tokyoNight: {
    background: "#1a1b26",
    panel: "#171822",
    sidebar: "#14151e",
    border: "#2f3549",
    text: "#c0caf5",
    textMuted: "#7a88cf",
    accent: "#7aa2f7",
    hover: "#222436",
    active: "#2f334d",
    syntax: {
      keyword: "#bb9af7",
      instruction: "#7aa2f7",
      label: "#9ece6a",
      number: "#ff9e64",
      comment: "#565f89",
      directive: "#e0af68",
    },
  },
  everforest: {
    background: "#2b3339",
    panel: "#252c31",
    sidebar: "#1f2529",
    border: "#4f5b58",
    text: "#d3c6aa",
    textMuted: "#859289",
    accent: "#a7c080",
    hover: "#343f44",
    active: "#3d484d",
    syntax: {
      keyword: "#e67e80",
      instruction: "#7fbbb3",
      label: "#a7c080",
      number: "#d699b6",
      comment: "#7a8478",
      directive: "#dbbc7f",
    },
  },
  materialOcean: {
    background: "#0f111a",
    panel: "#10131c",
    sidebar: "#0b0e14",
    border: "#2a3243",
    text: "#a6accd",
    textMuted: "#717cb4",
    accent: "#82aaff",
    hover: "#1a1f2b",
    active: "#242c3b",
    syntax: {
      keyword: "#c792ea",
      instruction: "#82aaff",
      label: "#c3e88d",
      number: "#f78c6c",
      comment: "#616f9a",
      directive: "#ffcb6b",
    },
  },
  solarizedDark: {
    background: "#002b36",
    panel: "#042a33",
    sidebar: "#00232c",
    border: "#1f4d56",
    text: "#93a1a1",
    textMuted: "#657b83",
    accent: "#2aa198",
    hover: "#073642",
    active: "#0f4250",
    syntax: {
      keyword: "#b58900",
      instruction: "#268bd2",
      label: "#859900",
      number: "#d33682",
      comment: "#586e75",
      directive: "#cb4b16",
    },
  },
} as const;

export type SchemeName = keyof typeof colorSchemes;
export type ThemeMode = "dark" | "light";

const clamp = (value: number) => Math.max(0, Math.min(255, value));

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;

  const num = parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g)
    .toString(16)
    .padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;

const mix = (a: string, b: string, amountOfA: number) => {
  const p = Math.max(0, Math.min(1, amountOfA));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(
    Math.round(ca.r * p + cb.r * (1 - p)),
    Math.round(ca.g * p + cb.g * (1 - p)),
    Math.round(ca.b * p + cb.b * (1 - p)),
  );
};

const getAmoledVariant = (scheme: ColorScheme): ColorScheme => ({
  ...scheme,
  background: "#000000",
  panel: "#050505",
  sidebar: "#000000",
  border: "#161616",
  hover: "#0d0d0d",
  active: "#1b1b1b",
});

const getLightVariant = (scheme: ColorScheme): ColorScheme => {
  const accent = mix(scheme.accent, "#1f2937", 0.6);

  return {
    ...scheme,
    background: mix(scheme.accent, "#f8fafc", 0.08),
    panel: mix(scheme.accent, "#ffffff", 0.05),
    sidebar: mix(scheme.accent, "#ffffff", 0.03),
    border: mix(scheme.accent, "#cbd5e1", 0.15),
    text: "#0f172a",
    textMuted: "#64748b",
    accent,
    hover: mix(scheme.accent, "#eef2ff", 0.12),
    active: mix(scheme.accent, "#e2e8f0", 0.18),
    syntax: {
      keyword: "#7c3aed",
      instruction: "#2563eb",
      label: "#0f766e",
      number: "#b45309",
      comment: "#64748b",
      directive: "#c2410c",
    },
  };
};

const resolveScheme = (
  name: SchemeName,
  amoled: boolean,
  themeMode: ThemeMode,
): ColorScheme => {
  const base = colorSchemes[name] as ColorScheme;
  if (themeMode === "light") return getLightVariant(base);
  return amoled ? getAmoledVariant(base) : base;
};

interface ThemeStore {
  schemeName: SchemeName;
  colorScheme: ColorScheme;
  amoled: boolean;
  themeMode: ThemeMode;
  setScheme: (name: SchemeName) => void;
  setAmoled: (enabled: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      schemeName: "dracula",
      colorScheme: resolveScheme("dracula", false, "dark"),
      amoled: false,
      themeMode: "dark",
      setScheme: (name) =>
        set({
          schemeName: name,
          colorScheme: resolveScheme(name, get().amoled, get().themeMode),
        }),
      setAmoled: (enabled) =>
        set((state) => ({
          amoled: enabled,
          colorScheme: resolveScheme(
            state.schemeName,
            enabled,
            state.themeMode,
          ),
        })),
      setThemeMode: (mode) =>
        set((state) => ({
          themeMode: mode,
          colorScheme: resolveScheme(state.schemeName, state.amoled, mode),
        })),
    }),
    {
      name: "mano-forge-theme",
      onRehydrateStorage: () => (state) => {
        if (state?.schemeName) {
          state.colorScheme = resolveScheme(
            state.schemeName,
            state.amoled ?? false,
            state.themeMode ?? "dark",
          );
        }
      },
    },
  ),
);
