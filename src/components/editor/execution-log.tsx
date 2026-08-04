"use client";

import { useEffect, useRef, useState } from "react";
import type { I8085DebugRecord } from "@/stores/file-store";
import type { ExecutionLogMode } from "@/stores/ui-store";
import { VscChevronDown, VscChevronRight } from "react-icons/vsc";

type ExecutionLogProps = {
  history: I8085DebugRecord[];
  cursor: number;
  notations: string[];
  mode: ExecutionLogMode;
  accent: string;
  border: string;
  panel: string;
  text: string;
  textMuted: string;
};

const hex = (value: number, digits: number) =>
  value.toString(16).toUpperCase().padStart(digits, "0");

export function ExecutionLog({
  history,
  cursor,
  notations,
  mode,
  accent,
  border,
  panel,
  text,
  textMuted,
}: ExecutionLogProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpandedIndex(cursor > 0 ? cursor - 1 : null);
    if (cursor === history.length) {
      endRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor, history.length]);

  return (
    <div className="space-y-1 p-1">
      {notations.map((note, index) => {
        const isError = note.startsWith("Error");
        return (
          <div
            key={`${note}-${index}`}
            className="rounded px-2 py-1 font-mono text-[9px] leading-4"
            style={{
              color: isError ? "#ef4444" : textMuted,
              backgroundColor: isError ? "#ef44441a" : panel,
              border: `1px solid ${isError ? "#ef444455" : border}`,
            }}
          >
            {note}
          </div>
        );
      })}

      {history.map((record, index) => {
        const expanded = mode === "detailed" && expandedIndex === index;
        const applied = index < cursor;
        const current = index === cursor - 1;
        return (
          <div
            key={`${record.address}-${index}`}
            className="overflow-hidden rounded"
            style={{
              border: `1px solid ${current ? accent : border}`,
              backgroundColor: applied ? panel : "transparent",
              opacity: applied ? 1 : 0.55,
              contentVisibility: "auto",
            }}
          >
            <button
              onClick={() =>
                setExpandedIndex((value) => (value === index ? null : index))
              }
              className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left"
              style={{ color: text }}
            >
              {mode === "detailed" ? (
                expanded ? (
                  <VscChevronDown size={11} />
                ) : (
                  <VscChevronRight size={11} />
                )
              ) : null}
              <span className="font-mono text-[9px]" style={{ color: accent }}>
                I{index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[9px] font-medium">
                {record.instruction}
              </span>
              <span
                className="font-mono text-[8px]"
                style={{ color: textMuted }}
              >
                @{hex(record.address, 4)}
              </span>
              <span
                className="rounded px-1 py-px font-mono text-[8px]"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                {record.timing.machineCycles.length}M ·{" "}
                {record.timing.totalTStates}T
              </span>
            </button>

            {expanded ? (
              <div
                className="space-y-1 border-t p-1.5"
                style={{ borderColor: border }}
              >
                {record.timing.machineCycles.map((cycle, cycleIndex) => (
                  <div
                    key={`${cycle.kind}-${cycleIndex}`}
                    className="rounded px-2 py-1.5"
                    style={{ backgroundColor: `${accent}0d` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-[8px] font-semibold"
                        style={{ color: accent }}
                      >
                        M{cycleIndex + 1}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate text-[9px]"
                        style={{ color: text }}
                      >
                        {cycle.label}
                      </span>
                      <span
                        className="font-mono text-[8px]"
                        style={{ color: textMuted }}
                      >
                        {cycle.tStates}T
                      </span>
                    </div>
                    <div
                      className="mt-1 pl-5 font-mono text-[8px] leading-3.5"
                      style={{ color: textMuted }}
                    >
                      {cycle.address === undefined
                        ? "Internal bus idle"
                        : `${cycle.ioM ? "PORT" : "ADDR"} ${hex(cycle.address, cycle.ioM ? 2 : 4)}${
                            cycle.data === undefined
                              ? ""
                              : ` · DATA ${hex(cycle.data, 2)}`
                          }`}
                      <span className="block">
                        IO/M={cycle.ioM} · S1={cycle.s1} · S0={cycle.s0} · RD̅=
                        {cycle.rd ? 0 : 1} · WR̅={cycle.wr ? 0 : 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
