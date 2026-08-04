"use client";

import { useState } from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import { useUiStore } from "@/stores/ui-store";
import { VscSymbolNumeric, VscCode } from "react-icons/vsc";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ExecutionLog } from "./execution-log";

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
  const { registers, execution, architecture } = useFileStore();
  const { colorScheme } = useThemeStore();
  const { layoutMode, executionLogMode } = useUiStore();
  const [displayMode, setDisplayMode] = useState<DisplayMode>("HEX");
  const [activeTab, setActiveTab] = useState<TabMode>("registers");

  const manoMainRegisters: {
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
  const i8085MainRegisters: {
    name: string;
    key: keyof typeof registers;
    bits: number;
  }[] = [
    { name: "A", key: "A", bits: 8 },
    { name: "B", key: "B", bits: 8 },
    { name: "C", key: "C", bits: 8 },
    { name: "D", key: "D", bits: 8 },
    { name: "E", key: "E8", bits: 8 },
    { name: "H", key: "H", bits: 8 },
    { name: "L", key: "L", bits: 8 },
    { name: "IR", key: "IR", bits: 8 },
    { name: "PC", key: "PC", bits: 16 },
    { name: "SP", key: "SP", bits: 16 },
  ];
  const mainRegisters =
    architecture === "8085" ? i8085MainRegisters : manoMainRegisters;

  const ioRegisters: {
    name: string;
    key: keyof typeof registers;
    bits: number;
  }[] = [
    // { name: "INR", key: "INR", bits: 8 },
    // { name: "OUTR", key: "OUTR", bits: 8 },
    // { name: "SC", key: "SC", bits: 3 },
  ];

  const flags: { name: string; key: keyof typeof registers }[] =
    architecture === "8085"
      ? [
          { name: "S", key: "FS" },
          { name: "Z", key: "FZ" },
          { name: "AC", key: "FAC" },
          { name: "P", key: "FP" },
          { name: "CY", key: "FCY" },
        ]
      : [
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
      style={{
        backgroundColor: colorScheme.panel,
        border:
          layoutMode === "compact"
            ? `1px solid ${colorScheme.border}66`
            : `1px solid ${colorScheme.border}`,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-2 py-1"
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
          <div
            className="flex"
            style={{
              backgroundColor: colorScheme.sidebar,
              border: `1px solid ${colorScheme.border}`,
            }}
          >
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
          <div className="flex h-full flex-col space-y-1">
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

            <div
              className={`grid gap-1 ${architecture === "8085" ? "grid-cols-5" : "grid-cols-1"}`}
            >
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

            {(execution?.notations?.length > 0 ||
              (architecture === "8085" &&
                execution.i8085History.length > 0)) && (
              <div
                className="flex min-h-0 flex-1 flex-col border-t pt-1.5"
                style={{ borderColor: colorScheme.border }}
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] font-semibold tracking-wide"
                      style={{ color: colorScheme.textMuted }}
                    >
                      EXECUTION LOG
                    </span>
                    <span
                      className="rounded border px-1 py-px text-[8px] uppercase"
                      style={{
                        borderColor: colorScheme.border,
                        color: colorScheme.textMuted,
                      }}
                    >
                      {executionLogMode === "detailed"
                        ? "cycle"
                        : "instruction"}
                    </span>
                  </div>
                  <span
                    className="font-mono text-[9px]"
                    style={{ color: colorScheme.textMuted }}
                  >
                    {architecture === "8085"
                      ? `${execution.i8085Cursor}/${execution.i8085History.length}`
                      : execution.notations.length}
                  </span>
                </div>
                <div
                  className="mt-1 flex-1 overflow-y-auto rounded border"
                  style={{
                    borderColor: colorScheme.border,
                    backgroundColor: colorScheme.sidebar,
                  }}
                >
                  {architecture === "8085" ? (
                    <ExecutionLog
                      history={execution.i8085History}
                      cursor={execution.i8085Cursor}
                      notations={execution.notations}
                      mode={executionLogMode}
                      accent={colorScheme.accent}
                      border={colorScheme.border}
                      panel={colorScheme.panel}
                      text={colorScheme.text}
                      textMuted={colorScheme.textMuted}
                    />
                  ) : (
                    execution.notations.map((note, i) => {
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
                          {note === "────────────────────" ? "" : note}
                        </div>
                      );
                    })
                  )}
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
