export type I8085MachineCycleKind =
  | "opcode-fetch"
  | "memory-read"
  | "memory-write"
  | "io-read"
  | "io-write"
  | "bus-idle";

export interface I8085MachineCycle {
  kind: I8085MachineCycleKind;
  label: string;
  tStates: number;
  address?: number;
  data?: number;
  ioM: 0 | 1;
  s1: 0 | 1;
  s0: 0 | 1;
  rd: boolean;
  wr: boolean;
}

export interface I8085TimingTrace {
  address: number;
  opcode: number;
  instruction: string;
  machineCycles: I8085MachineCycle[];
  totalTStates: number;
}

const cycleSignals: Record<
  I8085MachineCycleKind,
  Pick<I8085MachineCycle, "ioM" | "s1" | "s0" | "rd" | "wr">
> = {
  "opcode-fetch": { ioM: 0, s1: 1, s0: 1, rd: true, wr: false },
  "memory-read": { ioM: 0, s1: 1, s0: 0, rd: true, wr: false },
  "memory-write": { ioM: 0, s1: 0, s0: 1, rd: false, wr: true },
  "io-read": { ioM: 1, s1: 1, s0: 0, rd: true, wr: false },
  "io-write": { ioM: 1, s1: 0, s0: 1, rd: false, wr: true },
  "bus-idle": { ioM: 0, s1: 0, s0: 0, rd: false, wr: false },
};

export function create8085MachineCycle(
  kind: I8085MachineCycleKind,
  label: string,
  address?: number,
  data?: number,
): I8085MachineCycle {
  return {
    kind,
    label,
    tStates: kind === "opcode-fetch" ? 4 : 3,
    address,
    data,
    ...cycleSignals[kind],
  };
}

const isConditionalTaken = (opcode: number, instruction: string) => {
  if ((opcode & 0xc7) === 0xc2) return !instruction.includes("not taken");
  if ((opcode & 0xc7) === 0xc4) return !instruction.includes("not taken");
  if ((opcode & 0xc7) === 0xc0 && opcode !== 0xc9)
    return !instruction.includes("not taken");
  return true;
};

function timingTarget(
  opcode: number,
  instruction: string,
): { cycles: number; tStates: number } {
  if (opcode >= 0x40 && opcode <= 0x7f) {
    if (opcode === 0x76) return { cycles: 2, tStates: 7 };
    return (opcode & 7) === 6 || ((opcode >> 3) & 7) === 6
      ? { cycles: 2, tStates: 7 }
      : { cycles: 1, tStates: 4 };
  }
  if (opcode >= 0x80 && opcode <= 0xbf)
    return (opcode & 7) === 6
      ? { cycles: 2, tStates: 7 }
      : { cycles: 1, tStates: 4 };
  if ((opcode & 0xc7) === 0x04 || (opcode & 0xc7) === 0x05)
    return ((opcode >> 3) & 7) === 6
      ? { cycles: 3, tStates: 10 }
      : { cycles: 1, tStates: 4 };
  if ((opcode & 0xc7) === 0x06)
    return ((opcode >> 3) & 7) === 6
      ? { cycles: 3, tStates: 10 }
      : { cycles: 2, tStates: 7 };
  if ((opcode & 0xcf) === 0x01) return { cycles: 3, tStates: 10 };
  if ((opcode & 0xcf) === 0x03 || (opcode & 0xcf) === 0x0b)
    return { cycles: 1, tStates: 6 };
  if ((opcode & 0xcf) === 0x09) return { cycles: 3, tStates: 10 };
  if ([0x02, 0x12, 0x0a, 0x1a].includes(opcode))
    return { cycles: 2, tStates: 7 };
  if ([0x22, 0x2a].includes(opcode)) return { cycles: 5, tStates: 16 };
  if ([0x32, 0x3a].includes(opcode)) return { cycles: 4, tStates: 13 };
  if ([0xc6, 0xce, 0xd6, 0xde, 0xe6, 0xee, 0xf6, 0xfe].includes(opcode))
    return { cycles: 2, tStates: 7 };
  if (opcode === 0xc3) return { cycles: 3, tStates: 10 };
  if ((opcode & 0xc7) === 0xc2)
    return isConditionalTaken(opcode, instruction)
      ? { cycles: 3, tStates: 10 }
      : { cycles: 2, tStates: 7 };
  if (opcode === 0xcd) return { cycles: 5, tStates: 18 };
  if ((opcode & 0xc7) === 0xc4)
    return isConditionalTaken(opcode, instruction)
      ? { cycles: 5, tStates: 18 }
      : { cycles: 2, tStates: 9 };
  if (opcode === 0xc9) return { cycles: 3, tStates: 10 };
  if ((opcode & 0xc7) === 0xc0)
    return isConditionalTaken(opcode, instruction)
      ? { cycles: 3, tStates: 12 }
      : { cycles: 1, tStates: 6 };
  if ((opcode & 0xc7) === 0xc7) return { cycles: 3, tStates: 12 };
  if ((opcode & 0xcf) === 0xc5) return { cycles: 3, tStates: 12 };
  if ((opcode & 0xcf) === 0xc1) return { cycles: 3, tStates: 10 };
  if (opcode === 0xe3) return { cycles: 5, tStates: 18 };
  if (opcode === 0xe9) return { cycles: 1, tStates: 5 };
  if (opcode === 0xf9) return { cycles: 1, tStates: 6 };
  if (opcode === 0xdb || opcode === 0xd3) return { cycles: 3, tStates: 10 };
  return { cycles: 1, tStates: 4 };
}

export function finalize8085TimingTrace(
  address: number,
  opcode: number,
  instruction: string,
  observedCycles: I8085MachineCycle[],
): I8085TimingTrace {
  const target = timingTarget(opcode, instruction);
  const machineCycles = [...observedCycles];
  while (machineCycles.length < target.cycles) {
    machineCycles.push(
      create8085MachineCycle(
        "bus-idle",
        `Internal execution M${machineCycles.length + 1}`,
      ),
    );
  }
  while (machineCycles.length > target.cycles) machineCycles.pop();
  const baseTStates = machineCycles.reduce(
    (sum, cycle) => sum + cycle.tStates,
    0,
  );
  if (machineCycles[0]) {
    machineCycles[0] = {
      ...machineCycles[0],
      tStates: Math.max(
        1,
        machineCycles[0].tStates + target.tStates - baseTStates,
      ),
    };
  }
  return {
    address,
    opcode,
    instruction,
    machineCycles,
    totalTStates: target.tStates,
  };
}
