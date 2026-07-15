import React from "react";
import type { CircuitComponentKind, LogicValue } from "@/lib/circuit/types";

export function ComponentSymbol({
  type,
  size = 24,
}: {
  type: CircuitComponentKind;
  size?: number;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
  };
  const isGate = [
    "and",
    "nand",
    "or",
    "nor",
    "xor",
    "xnor",
    "not",
    "buffer",
    "odd-parity",
    "even-parity",
  ].includes(type);

  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {type === "input-pin" || type === "output-pin" ? (
        <>
          <rect {...common} height="10" rx="1" width="13" x="3" y="7" />
          <path {...common} d="M16 12h5" />
          {type === "output-pin" && <path {...common} d="m18 9 3 3-3 3" />}
        </>
      ) : type === "clock" ? (
        <path {...common} d="M3 15h4V9h5v6h5V9h4" />
      ) : type === "splitter" ? (
        <path {...common} d="M3 12h7m0 0v-6m0 6v6m0-12h11m-11 12h11" />
      ) : type === "led" ? (
        <>
          <path {...common} d="M3 12h5" />
          <circle {...common} cx="14" cy="12" r="5" />
          <path {...common} d="m18 6 3-3m-1 6 3-3" />
        </>
      ) : type === "led-bar" || type === "seven-segment" ? (
        <>
          <rect {...common} height="16" rx="1" width="14" x="5" y="4" />
          <path {...common} d="M8 7h8M8 12h8M8 17h8" />
        </>
      ) : isGate ? (
        <>
          <path {...common} d="M3 7h5m-5 10h5m8-5h5" />
          {type === "not" || type === "buffer" ? (
            <path {...common} d="m8 5 9 7-9 7Z" />
          ) : (
            <path {...common} d="M8 5h4c4 0 6 3 6 7s-2 7-6 7H8Z" />
          )}
          {["not", "nand", "nor", "xnor"].includes(type) && (
            <circle {...common} cx="19" cy="12" r="1.5" />
          )}
        </>
      ) : (
        <>
          <rect {...common} height="14" rx="1" width="16" x="4" y="5" />
          <path {...common} d="M1 9h3m-3 6h3m16-3h3" />
        </>
      )}
    </svg>
  );
}

const segmentShapes = [
  "4,2 16,2 14,4 6,4",
  "16,3 18,5 18,11 16,12 15,10 15,5",
  "16,13 18,14 18,20 16,22 15,20 15,15",
  "4,23 16,23 14,21 6,21",
  "2,13 4,14 5,15 5,20 4,22 2,20",
  "2,5 4,3 5,5 5,10 4,12 2,11",
  "4,12 6,11 14,11 16,12 14,14 6,14",
];

export function SegmentDisplay({
  value,
  activeColor,
  inactiveColor,
}: {
  value: LogicValue | undefined;
  activeColor: string;
  inactiveColor: string;
}) {
  const bits = value?.bits ?? [];
  return (
    <svg
      aria-label="Eight segment display"
      className="mt-auto h-12 w-10"
      viewBox="0 0 24 28"
    >
      {segmentShapes.map((points, index) => (
        <polygon
          key={points}
          fill={bits[index] === 1 ? activeColor : inactiveColor}
          points={points}
        />
      ))}
      <circle
        cx="21"
        cy="22"
        fill={bits[7] === 1 ? activeColor : inactiveColor}
        r="1.8"
      />
    </svg>
  );
}
