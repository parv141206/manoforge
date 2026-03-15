"use client";

import { useState } from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import { useUiStore } from "@/stores/ui-store";
import { VscSymbolNumeric, VscCode } from "react-icons/vsc";
import { ErrorBoundary } from "@/components/ui/error-boundary";

type DisplayMode = "HEX" | "DEC" | "BIN";
type TabMode = "registers" | "machine";

const formatValue = (value: number, mode: DisplayMode, bits = 16): string => {
  switch (mode) {
    case "HEX":
      return value
        .toString(16)
        .toUpperCase()
        .padStart(Math.ceil(bits / 4), "0");
    case "DEC":
      return value.toString();
    case "BIN":
      return value.toString(2).padStart(bits, "0");
  }
};

function RegistersPanelInner() {
  const { registers, execution } = useFileStore();
  const { colorScheme } = useThemeStore();
  const { layoutMode } = useUiStore();
  const [displayMode, setDisplayMode] = useState<DisplayMode>("HEX");
  const [activeTab, setActiveTab] = useState<TabMode>("registers");

  const mainRegisters: {
    name: string;
    key: keyof typeof registers;
    bits: number;
  }[] = [
    { name: "AC", key: "AC", bits: 16 },
    { name: "DR", key: "DR", bits: 16 },
    { name: "AR", key: "AR", bits: 12 },
    { name: "IR", key: "IR", bits: 16 },
    { name: "PC", key: "PC", bits: 12 },
    { name: "TR", key: "TR", bits: 16 },
  ];

  const ioRegisters: {
    name: string;
    key: keyof typeof registers;
    bits: number;
  }[] = [
    // { name: "INR", key: "INR", bits: 8 },
    // { name: "OUTR", key: "OUTR", bits: 8 },
    // { name: "SC", key: "SC", bits: 3 },
  ];

  const flags: { name: string; key: keyof typeof registers }[] = [
    { name: "E", key: "E" },
    // { name: "S", key: "S" },
    // { name: "I", key: "I" },
    // { name: "R", key: "R" },
  ];

  const ioFlags: { name: string; key: keyof typeof registers }[] = [
    // { name: "IEN", key: "IEN" },
    // { name: "FGI", key: "FGI" },
    // { name: "FGO", key: "FGO" },
  ];

  return (
    <div
      className={`flex h-full flex-col overflow-hidden ${layoutMode === "compact" ? "rounded-none" : "rounded-lg"}`}
      style={{ backgroundColor: colorScheme.panel }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-2 py-1.5"
        style={{ borderColor: colorScheme.border }}
      >
        <div className="flex">
          <button
            onClick={() => setActiveTab("registers")}
            className="flex items-center gap-1 rounded-l px-2 py-1 text-[11px] transition-colors"
            style={{
              backgroundColor:
                activeTab === "registers" ? colorScheme.active : "transparent",
              color:
                activeTab === "registers"
                  ? colorScheme.text
                  : colorScheme.textMuted,
            }}
          >
            <VscSymbolNumeric size={11} />
            Regs
          </button>
          <button
            onClick={() => setActiveTab("machine")}
            className="flex items-center gap-1 rounded-r px-2 py-1 text-[11px] transition-colors"
            style={{
              backgroundColor:
                activeTab === "machine" ? colorScheme.active : "transparent",
              color:
                activeTab === "machine"
                  ? colorScheme.text
                  : colorScheme.textMuted,
            }}
          >
            <VscCode size={11} />
            Code
          </button>
        </div>

        {activeTab === "registers" && (
          <div className="flex">
            {(["HEX", "DEC", "BIN"] as DisplayMode[]).map((mode, i) => (
              <button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                className={`px-1.5 py-0.5 text-[10px] transition-colors ${i === 0 ? "rounded-l" : ""} ${i === 2 ? "rounded-r" : ""}`}
                style={{
                  backgroundColor:
                    displayMode === mode ? colorScheme.accent : "transparent",
                  color:
                    displayMode === mode
                      ? colorScheme.background
                      : colorScheme.textMuted,
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {activeTab === "registers" ? (
          <div className="flex h-full flex-col space-y-2">
            <div className="grid grid-cols-2 gap-1">
              {mainRegisters.map(({ name, key, bits }) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded px-1.5 py-0.5"
                  style={{ backgroundColor: colorScheme.sidebar }}
                >
                  <span
                    className="font-mono text-[10px] font-medium"
                    style={{ color: colorScheme.accent }}
                  >
                    {name}
                  </span>
                  <span
                    className="scrollbar-none max-w-16 overflow-x-auto font-mono text-[10px]"
                    style={{ color: colorScheme.text }}
                  >
                    {formatValue(registers?.[key] ?? 0, displayMode, bits)}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1">
              {ioRegisters.map(({ name, key, bits }) => (
                <div
                  key={name}
                  className="flex flex-col items-center rounded py-0.5"
                  style={{ backgroundColor: colorScheme.sidebar }}
                >
                  <span
                    className="font-mono text-[9px]"
                    style={{ color: colorScheme.textMuted }}
                  >
                    {name}
                  </span>
                  <span
                    className="font-mono text-[10px]"
                    style={{ color: colorScheme.text }}
                  >
                    {formatValue(registers?.[key] ?? 0, displayMode, bits)}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-1">
              {flags.map(({ name, key }) => (
                <div
                  key={name}
                  className="flex flex-col items-center rounded py-0.5"
                  style={{ backgroundColor: colorScheme.sidebar }}
                >
                  <span
                    className="font-mono text-[9px]"
                    style={{ color: colorScheme.textMuted }}
                  >
                    {name}
                  </span>
                  <span
                    className="font-mono text-[10px] font-bold"
                    style={{
                      color:
                        (registers?.[key] ?? 0)
                          ? colorScheme.accent
                          : colorScheme.text,
                    }}
                  >
                    {registers?.[key] ?? 0}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1">
              {ioFlags.map(({ name, key }) => (
                <div
                  key={name}
                  className="flex flex-col items-center rounded py-0.5"
                  style={{ backgroundColor: colorScheme.sidebar }}
                >
                  <span
                    className="font-mono text-[9px]"
                    style={{ color: colorScheme.textMuted }}
                  >
                    {name}
                  </span>
                  <span
                    className="font-mono text-[10px] font-bold"
                    style={{
                      color:
                        (registers?.[key] ?? 0)
                          ? colorScheme.accent
                          : colorScheme.text,
                    }}
                  >
                    {registers?.[key] ?? 0}
                  </span>
                </div>
              ))}
            </div>

            {execution?.notations?.length > 0 && (
              <div
                className="flex min-h-0 flex-1 flex-col border-t pt-1.5"
                style={{ borderColor: colorScheme.border }}
              >
                <div className="flex items-center justify-between px-1">
                  <span
                    className="text-[10px] font-semibold tracking-wide"
                    style={{ color: colorScheme.textMuted }}
                  >
                    EXECUTION LOG
                  </span>
                  <span
                    className="font-mono text-[9px]"
                    style={{ color: colorScheme.textMuted }}
                  >
                    {execution.notations.length}
                  </span>
                </div>
                <div
                  className="mt-1 flex-1 overflow-y-auto rounded border"
                  style={{
                    borderColor: colorScheme.border,
                    backgroundColor: colorScheme.sidebar,
                  }}
                >
                  {execution.notations.map((note, i) => {
                    const isError = note.startsWith("Error");
                    const isStep = note.startsWith("T");
                    return (
                      <div
                        key={i}
                        className="px-1.5 py-1 font-mono text-[9px] leading-4"
                        style={{
                          borderBottom:
                            i === execution.notations.length - 1
                              ? "none"
                              : `1px solid ${colorScheme.border}`,
                          backgroundColor: isError
                            ? "#ef44441a"
                            : isStep
                              ? `${colorScheme.accent}12`
                              : "transparent",
                          color: isError
                            ? "#ef4444"
                            : isStep
                              ? colorScheme.text
                              : colorScheme.textMuted,
                        }}
                      >
                        {note}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {!execution?.machineCode?.length ? (
              <div
                className="py-4 text-center text-[11px]"
                style={{ color: colorScheme.textMuted }}
              >
                Assemble to see machine code
              </div>
            ) : (
              execution.machineCode.map((line, i) => (
                <div
                  key={i}
                  className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                  style={{
                    backgroundColor: colorScheme.sidebar,
                    color: colorScheme.text,
                  }}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function RegistersPanel() {
  return (
    <ErrorBoundary>
      <RegistersPanelInner />
    </ErrorBoundary>
  );
}

export default RegistersPanel;
