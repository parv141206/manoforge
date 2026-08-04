"use client";

import { useEffect, useState } from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import { useUiStore } from "@/stores/ui-store";
import { TimingDiagram } from "./timing-diagram";
import { PinDiagram } from "./pin-diagram";
import { VscPulse, VscCircuitBoard } from "react-icons/vsc";

export function TimingPanel() {
  const timing = useFileStore((state) => state.execution.i8085Timing);
  const activeCycle = useFileStore((state) => state.execution.i8085ActiveCycle);
  const registers = useFileStore((state) => state.registers);
  const colorScheme = useThemeStore((state) => state.colorScheme);
  const layoutMode = useUiStore((state) => state.layoutMode);
  const [selectedCycle, setSelectedCycle] = useState(0);
  const [selectedTState, setSelectedTState] = useState(1);

  useEffect(() => {
    setSelectedCycle(0);
    setSelectedTState(1);
  }, [timing]);

  useEffect(() => {
    if (activeCycle !== null) {
      setSelectedCycle(activeCycle);
      setSelectedTState(1);
    }
  }, [activeCycle]);

  const cycle = timing?.machineCycles[selectedCycle];

  return (
    <div
      className={`flex h-full min-w-0 flex-col overflow-hidden ${layoutMode === "compact" ? "rounded-none" : "rounded-lg"}`}
      style={{
        backgroundColor: colorScheme.sidebar,
        border:
          layoutMode === "compact"
            ? `1px solid ${colorScheme.border}66`
            : `1px solid ${colorScheme.border}`,
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: colorScheme.border }}
      >
        <div className="flex items-center gap-2">
          <VscPulse size={14} style={{ color: colorScheme.accent }} />
          <span className="text-[11px] font-medium tracking-wide uppercase">
            8085 Timing
          </span>
        </div>
        {timing ? (
          <span
            className="font-mono text-[10px]"
            style={{ color: colorScheme.textMuted }}
          >
            {timing.machineCycles.length}M · {timing.totalTStates}T
          </span>
        ) : null}
      </div>

      {!timing || !cycle ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-xs"
          style={{ color: colorScheme.textMuted }}
        >
          <VscCircuitBoard size={30} />
          <span>
            Step or run an 8085 instruction to inspect its bus timing and pins.
          </span>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span
                className="truncate font-mono text-xs"
                style={{ color: colorScheme.text }}
              >
                {timing.instruction}
              </span>
              <span
                className="shrink-0 font-mono text-[9px]"
                style={{ color: colorScheme.textMuted }}
              >
                @{timing.address.toString(16).toUpperCase().padStart(4, "0")}
              </span>
            </div>
            <div className="mt-1.5 flex gap-1 overflow-x-auto pb-1">
              {timing.machineCycles.map((item, index) => (
                <button
                  key={`${item.kind}-${index}`}
                  onClick={() => {
                    setSelectedCycle(index);
                    setSelectedTState(1);
                  }}
                  className="shrink-0 rounded px-2 py-1 font-mono text-[9px] transition-colors"
                  style={{
                    color:
                      selectedCycle === index
                        ? colorScheme.text
                        : colorScheme.textMuted,
                    backgroundColor:
                      selectedCycle === index
                        ? colorScheme.active
                        : colorScheme.panel,
                    border: `1px solid ${
                      selectedCycle === index
                        ? colorScheme.accent
                        : colorScheme.border
                    }`,
                  }}
                  title={item.label}
                >
                  M{index + 1} · {item.tStates}T
                </button>
              ))}
            </div>
          </div>

          <div
            className="rounded p-1.5"
            style={{
              backgroundColor: colorScheme.panel,
              border: `1px solid ${colorScheme.border}`,
            }}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span
                className="truncate text-[10px] font-medium"
                style={{ color: colorScheme.text }}
              >
                M{selectedCycle + 1} · {cycle.label}
              </span>
              <span
                className="font-mono text-[9px]"
                style={{ color: colorScheme.textMuted }}
              >
                IO/M {cycle.ioM} · S1 {cycle.s1} · S0 {cycle.s0}
              </span>
            </div>
            <TimingDiagram
              cycle={cycle}
              selectedTState={selectedTState}
              onTStateChange={setSelectedTState}
              accent={colorScheme.accent}
              border={colorScheme.border}
              panel={colorScheme.sidebar}
              text={colorScheme.text}
              textMuted={colorScheme.textMuted}
            />
          </div>

          <div
            className="rounded p-2"
            style={{
              backgroundColor: colorScheme.panel,
              border: `1px solid ${colorScheme.border}`,
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="text-[10px] font-medium"
                style={{ color: colorScheme.text }}
              >
                40-pin activity
              </span>
              <span
                className="font-mono text-[9px]"
                style={{ color: colorScheme.textMuted }}
              >
                M{selectedCycle + 1} · T{selectedTState}
              </span>
            </div>
            <PinDiagram
              cycle={cycle}
              tState={selectedTState}
              registers={registers}
              accent={colorScheme.accent}
              border={colorScheme.border}
              panel={colorScheme.sidebar}
              text={colorScheme.text}
              textMuted={colorScheme.textMuted}
            />
          </div>
        </div>
      )}
    </div>
  );
}
