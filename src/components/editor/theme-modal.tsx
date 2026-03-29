"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  useThemeStore,
  colorSchemes,
  type SchemeName,
} from "@/stores/theme-store";
import {
  useUiStore,
  editorFontOptions,
  editorFontStacks,
} from "@/stores/ui-store";
import { VscCheck, VscClose } from "react-icons/vsc";

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const toLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

export function ThemeModal({ isOpen, onClose }: ThemeModalProps) {
  const {
    colorScheme,
    schemeName,
    setScheme,
    amoled,
    setAmoled,
    themeMode,
    setThemeMode,
  } = useThemeStore();
  const {
    layoutMode,
    setLayoutMode,
    executionLogMode,
    setExecutionLogMode,
    editorFontFamily,
    setEditorFontFamily,
  } = useUiStore();

  const schemeKeys = Object.keys(colorSchemes) as SchemeName[];
  const selectedScheme = colorSchemes[schemeName];
  const previewFontFamily = editorFontStacks[editorFontFamily];
  const previewLogs =
    executionLogMode === "detailed"
      ? [
          "T0: AR ← PC (001)",
          "T1: IR ← M[AR] (2004)",
          "T2: Decode opcode=2, addr=004",
        ]
      : [
          "LDA 004 => AC=0005",
          "ADD 005 => AC=0006, E=0",
          "STA 006 <= AC(0006)",
        ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-1 sm:p-4 md:p-8"
          >
            <div
              className="relative my-auto flex h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-xl shadow-2xl md:h-auto md:max-h-[88vh] md:flex-row md:rounded-2xl"
              style={{
                backgroundColor: colorScheme.background,
                border: `1px solid ${colorScheme.border}`,
              }}
            >
              <aside
                className="flex h-[34%] min-h-0 w-full shrink-0 flex-col border-b md:h-auto md:w-64 md:border-r md:border-b-0"
                style={{
                  backgroundColor: colorScheme.sidebar,
                  borderColor: colorScheme.border,
                }}
              >
                <div
                  className="border-b px-3 py-3 md:px-4 md:py-4"
                  style={{ borderColor: colorScheme.border }}
                >
                  <h2
                    className="text-sm font-semibold tracking-wide"
                    style={{ color: colorScheme.text }}
                  >
                    Color schemes
                  </h2>
                  <p
                    className="text-xs"
                    style={{ color: colorScheme.textMuted }}
                  >
                    Pick a palette
                  </p>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-2 sm:grid-cols-3 md:block md:p-3">
                  {schemeKeys.map((key) => {
                    const scheme = colorSchemes[key];
                    const selected = schemeName === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setScheme(key)}
                        className="w-full rounded-lg border px-2 py-2 text-left transition-colors md:mb-2 md:px-2.5 md:py-2.5"
                        style={{
                          borderColor: selected
                            ? colorScheme.accent
                            : colorScheme.border,
                          backgroundColor: selected
                            ? `${colorScheme.accent}18`
                            : colorScheme.panel,
                        }}
                      >
                        <div className="mb-1.5 flex items-center justify-between md:mb-2">
                          <span
                            className="truncate text-[11px] font-medium md:text-xs"
                            style={{ color: colorScheme.text }}
                          >
                            {toLabel(key)}
                          </span>
                          {selected && (
                            <VscCheck
                              size={14}
                              style={{ color: colorScheme.accent }}
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <span
                            className="h-2.5 flex-1 rounded-sm"
                            style={{ backgroundColor: scheme.accent }}
                          />
                          <span
                            className="h-2.5 flex-1 rounded-sm"
                            style={{ backgroundColor: scheme.syntax.keyword }}
                          />
                          <span
                            className="h-2.5 flex-1 rounded-sm"
                            style={{
                              backgroundColor: scheme.syntax.instruction,
                            }}
                          />
                          <span
                            className="h-2.5 flex-1 rounded-sm"
                            style={{ backgroundColor: scheme.syntax.label }}
                          />
                          <span
                            className="h-2.5 flex-1 rounded-sm"
                            style={{ backgroundColor: scheme.syntax.directive }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div
                  className="flex items-center justify-between border-b px-3 py-3 md:px-5 md:py-4"
                  style={{ borderColor: colorScheme.border }}
                >
                  <div>
                    <h3
                      className="text-base font-semibold md:text-lg"
                      style={{ color: colorScheme.text }}
                    >
                      Appearance settings
                    </h3>
                    <p
                      className="text-[11px] md:text-xs"
                      style={{ color: colorScheme.textMuted }}
                    >
                      {toLabel(schemeName)} · theme, mode, preview and color
                      tokens
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded p-1.5 transition-colors"
                    style={{ color: colorScheme.textMuted }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        colorScheme.hover)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <VscClose size={20} />
                  </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto overscroll-contain p-3 md:gap-4 md:p-5 lg:grid-cols-[340px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: colorScheme.border,
                        backgroundColor: colorScheme.panel,
                      }}
                    >
                      <div
                        className="mb-2 text-[11px] font-semibold uppercase"
                        style={{ color: colorScheme.textMuted }}
                      >
                        Mode
                      </div>
                      <div
                        className="flex items-center rounded border p-0.5"
                        style={{ borderColor: colorScheme.border }}
                      >
                        <button
                          onClick={() => setThemeMode("dark")}
                          className="flex-1 rounded px-2 py-1 text-xs"
                          style={{
                            backgroundColor:
                              themeMode === "dark"
                                ? colorScheme.active
                                : "transparent",
                            color: colorScheme.text,
                          }}
                        >
                          Dark
                        </button>
                        <button
                          onClick={() => setThemeMode("light")}
                          className="flex-1 rounded px-2 py-1 text-xs"
                          style={{
                            backgroundColor:
                              themeMode === "light"
                                ? colorScheme.active
                                : "transparent",
                            color: colorScheme.text,
                          }}
                        >
                          Light
                        </button>
                      </div>

                      <button
                        onClick={() => setAmoled(!amoled)}
                        disabled={themeMode === "light"}
                        className="mt-2 flex w-full items-center justify-between rounded border px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          borderColor: colorScheme.border,
                          backgroundColor:
                            amoled && themeMode === "dark"
                              ? `${colorScheme.accent}20`
                              : "transparent",
                          color: colorScheme.text,
                        }}
                      >
                        <span>AMOLED mode</span>
                        <span
                          style={{
                            color:
                              amoled && themeMode === "dark"
                                ? colorScheme.accent
                                : colorScheme.textMuted,
                          }}
                        >
                          {amoled && themeMode === "dark" ? "ON" : "OFF"}
                        </span>
                      </button>
                    </div>

                    <div
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: colorScheme.border,
                        backgroundColor: colorScheme.panel,
                      }}
                    >
                      <div
                        className="mb-2 text-[11px] font-semibold uppercase"
                        style={{ color: colorScheme.textMuted }}
                      >
                        Workspace
                      </div>
                      <div
                        className="mb-2 flex items-center rounded border p-0.5"
                        style={{ borderColor: colorScheme.border }}
                      >
                        <button
                          onClick={() => setLayoutMode("floating")}
                          className="flex-1 rounded px-2 py-1 text-xs"
                          style={{
                            backgroundColor:
                              layoutMode === "floating"
                                ? colorScheme.active
                                : "transparent",
                            color: colorScheme.text,
                          }}
                        >
                          Floating
                        </button>
                        <button
                          onClick={() => setLayoutMode("compact")}
                          className="flex-1 rounded px-2 py-1 text-xs"
                          style={{
                            backgroundColor:
                              layoutMode === "compact"
                                ? colorScheme.active
                                : "transparent",
                            color: colorScheme.text,
                          }}
                        >
                          Compact
                        </button>
                      </div>

                      <div
                        className="flex items-center rounded border p-0.5"
                        style={{ borderColor: colorScheme.border }}
                      >
                        <button
                          onClick={() => setExecutionLogMode("detailed")}
                          className="flex-1 rounded px-2 py-1 text-xs"
                          style={{
                            backgroundColor:
                              executionLogMode === "detailed"
                                ? colorScheme.active
                                : "transparent",
                            color: colorScheme.text,
                          }}
                        >
                          Detailed log
                        </button>
                        <button
                          onClick={() => setExecutionLogMode("instruction")}
                          className="flex-1 rounded px-2 py-1 text-xs"
                          style={{
                            backgroundColor:
                              executionLogMode === "instruction"
                                ? colorScheme.active
                                : "transparent",
                            color: colorScheme.text,
                          }}
                        >
                          High level
                        </button>
                      </div>
                    </div>

                    <div
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: colorScheme.border,
                        backgroundColor: colorScheme.panel,
                      }}
                    >
                      <div
                        className="mb-2 text-[11px] font-semibold uppercase"
                        style={{ color: colorScheme.textMuted }}
                      >
                        Editor font
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                        {editorFontOptions.map((font) => (
                          <button
                            key={font.key}
                            onClick={() => setEditorFontFamily(font.key)}
                            className="rounded border px-2 py-1.5 text-left text-[11px]"
                            style={{
                              borderColor:
                                editorFontFamily === font.key
                                  ? colorScheme.accent
                                  : colorScheme.border,
                              backgroundColor:
                                editorFontFamily === font.key
                                  ? `${colorScheme.accent}16`
                                  : "transparent",
                              color:
                                editorFontFamily === font.key
                                  ? colorScheme.text
                                  : colorScheme.textMuted,
                              fontFamily: editorFontStacks[font.key],
                            }}
                          >
                            {font.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: colorScheme.border,
                        backgroundColor: colorScheme.panel,
                      }}
                    >
                      <div
                        className="mb-2 text-[11px] font-semibold uppercase"
                        style={{ color: colorScheme.textMuted }}
                      >
                        Selected scheme
                      </div>
                      <div className="mb-2" style={{ color: colorScheme.text }}>
                        <div className="text-sm font-medium">
                          {toLabel(schemeName)}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: colorScheme.textMuted }}
                        >
                          Elegant palette with syntax-aware accents
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        <span
                          className="h-5 rounded-md md:h-6"
                          style={{ backgroundColor: selectedScheme.accent }}
                        />
                        <span
                          className="h-5 rounded-md md:h-6"
                          style={{
                            backgroundColor: selectedScheme.syntax.keyword,
                          }}
                        />
                        <span
                          className="h-5 rounded-md md:h-6"
                          style={{
                            backgroundColor: selectedScheme.syntax.instruction,
                          }}
                        />
                        <span
                          className="h-5 rounded-md md:h-6"
                          style={{
                            backgroundColor: selectedScheme.syntax.label,
                          }}
                        />
                        <span
                          className="h-5 rounded-md md:h-6"
                          style={{
                            backgroundColor: selectedScheme.syntax.directive,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: colorScheme.border,
                        backgroundColor: colorScheme.panel,
                      }}
                    >
                      <div
                        className="mb-2 text-[11px] font-semibold uppercase"
                        style={{ color: colorScheme.textMuted }}
                      >
                        Preview
                      </div>

                      <div
                        className="rounded border"
                        style={{
                          borderColor: colorScheme.border,
                          backgroundColor: colorScheme.background,
                        }}
                      >
                        <div
                          className="border-b px-3 py-2 text-xs"
                          style={{
                            borderColor: colorScheme.border,
                            color: colorScheme.text,
                          }}
                        >
                          main.asm
                        </div>
                        <div
                          className="space-y-1 px-3 py-2 font-mono text-xs"
                          style={{ fontFamily: previewFontFamily }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span style={{ color: colorScheme.syntax.label }}>
                                LOOP,
                              </span>
                              <span
                                style={{
                                  color: colorScheme.syntax.instruction,
                                }}
                              >
                                {" "}
                                LDA
                              </span>
                              <span style={{ color: colorScheme.syntax.label }}>
                                {" "}
                                NUM
                              </span>
                            </div>
                            <span style={{ color: colorScheme.textMuted }}>
                              001
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span
                                style={{
                                  color: colorScheme.syntax.instruction,
                                }}
                              >
                                ADD
                              </span>
                              <span
                                style={{ color: colorScheme.syntax.number }}
                              >
                                {" "}
                                001
                              </span>
                            </div>
                            <span style={{ color: colorScheme.textMuted }}>
                              002
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span
                                style={{ color: colorScheme.syntax.directive }}
                              >
                                END
                              </span>
                              <span
                                style={{ color: colorScheme.syntax.comment }}
                              >
                                {" "}
                                ; done
                              </span>
                            </div>
                            <span style={{ color: colorScheme.textMuted }}>
                              003
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="mt-3 rounded border"
                        style={{
                          borderColor: colorScheme.border,
                          backgroundColor: colorScheme.sidebar,
                        }}
                      >
                        <div
                          className="flex items-center justify-between border-b px-3 py-2 text-[11px] font-medium uppercase"
                          style={{
                            borderColor: colorScheme.border,
                            color: colorScheme.textMuted,
                          }}
                        >
                          <span>Execution log</span>
                          <span>
                            {executionLogMode === "detailed"
                              ? "cycle"
                              : "instruction"}
                          </span>
                        </div>
                        <div
                          className="space-y-1 px-3 py-2 font-mono text-[11px]"
                          style={{ fontFamily: previewFontFamily }}
                        >
                          {previewLogs.map((line, idx) => (
                            <div
                              key={line}
                              style={{
                                color:
                                  idx === 0
                                    ? colorScheme.syntax.instruction
                                    : idx === 1
                                      ? colorScheme.text
                                      : colorScheme.textMuted,
                              }}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: colorScheme.border,
                        backgroundColor: colorScheme.panel,
                      }}
                    >
                      <div
                        className="mb-2 text-[11px] font-semibold uppercase"
                        style={{ color: colorScheme.textMuted }}
                      >
                        Palette
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] xl:grid-cols-3">
                        {[
                          ["Background", colorScheme.background],
                          ["Panel", colorScheme.panel],
                          ["Sidebar", colorScheme.sidebar],
                          ["Border", colorScheme.border],
                          ["Text", colorScheme.text],
                          ["Muted", colorScheme.textMuted],
                          ["Accent", colorScheme.accent],
                          ["Hover", colorScheme.hover],
                          ["Active", colorScheme.active],
                          ["Keyword", colorScheme.syntax.keyword],
                          ["Instruction", colorScheme.syntax.instruction],
                          ["Label", colorScheme.syntax.label],
                          ["Number", colorScheme.syntax.number],
                          ["Comment", colorScheme.syntax.comment],
                          ["Directive", colorScheme.syntax.directive],
                        ].map(([name, value]) => (
                          <div
                            key={name}
                            className="flex items-center gap-2 rounded border px-2 py-1"
                            style={{ borderColor: colorScheme.border }}
                          >
                            <span
                              className="h-3 w-3 rounded-sm border"
                              style={{
                                backgroundColor: String(value),
                                borderColor: colorScheme.border,
                              }}
                            />
                            <span style={{ color: colorScheme.textMuted }}>
                              {name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: colorScheme.border,
                        backgroundColor: colorScheme.panel,
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div
                          className="text-[11px] font-semibold uppercase"
                          style={{ color: colorScheme.textMuted }}
                        >
                          Playground
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${colorScheme.accent}20`,
                            color: colorScheme.accent,
                          }}
                        >
                          Live preview
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div
                          className="rounded-lg border p-2"
                          style={{ borderColor: colorScheme.border }}
                        >
                          <div
                            className="mb-2 text-[10px] uppercase"
                            style={{ color: colorScheme.textMuted }}
                          >
                            UI chips
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{
                                backgroundColor: `${colorScheme.accent}24`,
                                color: colorScheme.accent,
                              }}
                            >
                              Running
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{
                                backgroundColor: colorScheme.hover,
                                color: colorScheme.text,
                              }}
                            >
                              Assembled
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{
                                backgroundColor: `${colorScheme.syntax.directive}22`,
                                color: colorScheme.syntax.directive,
                              }}
                            >
                              Step mode
                            </span>
                          </div>
                        </div>

                        <div
                          className="rounded-lg border p-2"
                          style={{ borderColor: colorScheme.border }}
                        >
                          <div
                            className="mb-2 text-[10px] uppercase"
                            style={{ color: colorScheme.textMuted }}
                          >
                            Memory cells
                          </div>
                          <div
                            className="grid grid-cols-3 gap-1 font-mono text-[10px]"
                            style={{ fontFamily: previewFontFamily }}
                          >
                            {["2004", "1005", "3006"].map((cell, i) => (
                              <div
                                key={cell}
                                className="rounded border px-1.5 py-1 text-center"
                                style={{
                                  borderColor: colorScheme.border,
                                  backgroundColor:
                                    i === 0
                                      ? `${colorScheme.accent}20`
                                      : colorScheme.sidebar,
                                  color:
                                    i === 0
                                      ? colorScheme.text
                                      : colorScheme.textMuted,
                                }}
                              >
                                {cell}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div
                          className="rounded-lg border p-2"
                          style={{ borderColor: colorScheme.border }}
                        >
                          <div
                            className="mb-2 text-[10px] uppercase"
                            style={{ color: colorScheme.textMuted }}
                          >
                            Palette ribbon
                          </div>
                          <div
                            className="h-3 rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${selectedScheme.accent}, ${selectedScheme.syntax.keyword}, ${selectedScheme.syntax.instruction}, ${selectedScheme.syntax.label}, ${selectedScheme.syntax.directive})`,
                            }}
                          />
                          <div
                            className="mt-2 text-[10px]"
                            style={{ color: colorScheme.textMuted }}
                          >
                            Try switching dark/light and watch the whole mood
                            shift.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ThemeModal;
