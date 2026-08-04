import type { I8085MachineCycle } from "@/lib/8085/timing";
import type { Registers } from "@/stores/file-store";

type PinDiagramProps = {
  cycle: I8085MachineCycle;
  tState: number;
  registers: Registers;
  accent: string;
  border: string;
  panel: string;
  text: string;
  textMuted: string;
};

const leftPins = [
  "X1",
  "X2",
  "RESET OUT",
  "SOD",
  "SID",
  "TRAP",
  "RST 7.5",
  "RST 6.5",
  "RST 5.5",
  "INTR",
  "INTA̅",
  "AD0",
  "AD1",
  "AD2",
  "AD3",
  "AD4",
  "AD5",
  "AD6",
  "AD7",
  "VSS",
];

const rightPins = [
  "VCC",
  "HOLD",
  "HLDA",
  "CLK OUT",
  "RESET IN̅",
  "READY",
  "IO/M",
  "S1",
  "RD̅",
  "WR̅",
  "ALE",
  "S0",
  "A15",
  "A14",
  "A13",
  "A12",
  "A11",
  "A10",
  "A9",
  "A8",
];

export function PinDiagram({
  cycle,
  tState,
  registers,
  accent,
  border,
  panel,
  text,
  textMuted,
}: PinDiagramProps) {
  const busActive = cycle.kind !== "bus-idle";
  const readActive = cycle.rd && tState > 1 && tState <= 3;
  const writeActive = cycle.wr && tState > 1 && tState <= 3;
  const aleActive = busActive && tState === 1;
  const stateFor = (name: string) => {
    if (["X1", "X2", "CLK OUT", "VCC", "VSS", "READY"].includes(name))
      return { active: true, value: name === "VSS" ? "0V" : "1" };
    if (name.startsWith("AD"))
      return {
        active: busActive,
        value:
          cycle.address === undefined
            ? "Z"
            : tState === 1
              ? String((cycle.address >> Number(name.slice(2))) & 1)
              : cycle.data === undefined
                ? "Z"
                : String((cycle.data >> Number(name.slice(2))) & 1),
      };
    if (/^A(?:8|9|1[0-5])$/.test(name))
      return {
        active: busActive,
        value:
          cycle.address === undefined
            ? "Z"
            : String((cycle.address >> Number(name.slice(1))) & 1),
      };
    if (name === "ALE")
      return { active: aleActive, value: aleActive ? "1" : "0" };
    if (name === "RD̅")
      return { active: readActive, value: readActive ? "0" : "1" };
    if (name === "WR̅")
      return { active: writeActive, value: writeActive ? "0" : "1" };
    if (name === "IO/M") return { active: true, value: String(cycle.ioM) };
    if (name === "S1") return { active: true, value: String(cycle.s1) };
    if (name === "S0") return { active: true, value: String(cycle.s0) };
    if (name === "SOD")
      return { active: registers.SOD === 1, value: String(registers.SOD) };
    if (name === "SID")
      return { active: registers.SID === 1, value: String(registers.SID) };
    if (name === "RESET IN̅") return { active: false, value: "1" };
    return { active: false, value: "0" };
  };

  return (
    <div className="grid grid-cols-[1fr_42px_1fr] gap-x-1 text-[8px]">
      {leftPins.map((left, index) => {
        const right = rightPins[index] ?? "";
        const leftState = stateFor(left);
        const rightState = stateFor(right);
        return [
          <div
            key={`left-${left}`}
            className="mb-0.5 flex items-center justify-end gap-1 rounded-l px-1 py-0.5 font-mono"
            style={{
              color: leftState.active ? text : textMuted,
              backgroundColor: leftState.active ? `${accent}18` : panel,
              border: `1px solid ${leftState.active ? accent : border}`,
            }}
          >
            <span>{left}</span>
            <span style={{ color: leftState.active ? accent : textMuted }}>
              {leftState.value}
            </span>
          </div>,
          <div
            key={`body-${index}`}
            className="mb-0.5 flex items-center justify-center font-mono"
            style={{
              color: textMuted,
              backgroundColor: panel,
              borderTop: `1px solid ${border}`,
              borderBottom: `1px solid ${border}`,
            }}
          >
            {index + 1}·{40 - index}
          </div>,
          <div
            key={`right-${right}`}
            className="mb-0.5 flex items-center gap-1 rounded-r px-1 py-0.5 font-mono"
            style={{
              color: rightState.active ? text : textMuted,
              backgroundColor: rightState.active ? `${accent}18` : panel,
              border: `1px solid ${rightState.active ? accent : border}`,
            }}
          >
            <span style={{ color: rightState.active ? accent : textMuted }}>
              {rightState.value}
            </span>
            <span>{right}</span>
          </div>,
        ];
      })}
    </div>
  );
}
