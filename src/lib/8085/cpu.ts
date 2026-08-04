import {
  create8085MachineCycle,
  finalize8085TimingTrace,
  type I8085MachineCycle,
  type I8085TimingTrace,
} from "./timing";

export interface I8085Registers {
  A: number;
  B: number;
  C: number;
  D: number;
  E8: number;
  H: number;
  L: number;
  PC: number;
  SP: number;
  IR: number;
  FS: number;
  FZ: number;
  FAC: number;
  FP: number;
  FCY: number;
  IE: number;
  IM: number;
  SID: number;
  SOD: number;
}

export interface I8085StepResult {
  registers: I8085Registers;
  memoryWrites: { address: number; value: number }[];
  portWrites: { port: number; value: number }[];
  halted: boolean;
  instruction: string;
  notations: string[];
  timing: I8085TimingTrace;
}

const parity = (value: number) => {
  let bits = value & 0xff;
  let count = 0;
  while (bits) {
    count += bits & 1;
    bits >>= 1;
  }
  return count % 2 === 0 ? 1 : 0;
};

export function step8085(
  current: I8085Registers,
  memory: number[],
  ports: number[],
): I8085StepResult {
  const r = { ...current };
  const memoryWrites: { address: number; value: number }[] = [];
  const portWrites: { port: number; value: number }[] = [];
  const start = r.PC & 0xffff;
  const opcode = memory[start] ?? 0;
  const machineCycles: I8085MachineCycle[] = [
    create8085MachineCycle("opcode-fetch", "Opcode fetch", start, opcode),
  ];
  r.IR = opcode;
  r.PC = (start + 1) & 0xffff;
  let halted = false;
  let instruction = "NOP";
  const notations = [
    `T1: Address bus <- PC (${start.toString(16).toUpperCase().padStart(4, "0")})`,
    `T2-T3: IR <- M[PC] (${opcode.toString(16).toUpperCase().padStart(2, "0")}), PC <- PC + 1`,
  ];

  const peek8 = (address: number) => memory[address & 0xffff] ?? 0;
  const read8 = (address: number, label = "Memory read") => {
    const normalized = address & 0xffff;
    const value = peek8(normalized);
    machineCycles.push(
      create8085MachineCycle("memory-read", label, normalized, value),
    );
    return value;
  };
  const write8 = (address: number, value: number, label = "Memory write") => {
    const normalized = address & 0xffff;
    const byte = value & 0xff;
    memoryWrites.push({ address: normalized, value: byte });
    machineCycles.push(
      create8085MachineCycle("memory-write", label, normalized, byte),
    );
  };
  const next8 = () => {
    const value = read8(r.PC, "Read instruction byte");
    r.PC = (r.PC + 1) & 0xffff;
    return value;
  };
  const next16 = () => {
    const low = next8();
    return low | (next8() << 8);
  };
  const getHL = () => ((r.H << 8) | r.L) & 0xffff;
  const setHL = (value: number) => {
    r.H = (value >> 8) & 0xff;
    r.L = value & 0xff;
  };
  const getPair = (code: number) =>
    code === 0
      ? (r.B << 8) | r.C
      : code === 1
        ? (r.D << 8) | r.E8
        : code === 2
          ? getHL()
          : r.SP;
  const setPair = (code: number, value: number) => {
    const word = value & 0xffff;
    if (code === 0) {
      r.B = word >> 8;
      r.C = word & 0xff;
    } else if (code === 1) {
      r.D = word >> 8;
      r.E8 = word & 0xff;
    } else if (code === 2) setHL(word);
    else r.SP = word;
  };
  const getReg = (code: number) => {
    if (code === 0) return r.B;
    if (code === 1) return r.C;
    if (code === 2) return r.D;
    if (code === 3) return r.E8;
    if (code === 4) return r.H;
    if (code === 5) return r.L;
    if (code === 6) return read8(getHL(), "Read operand from M");
    return r.A;
  };
  const setReg = (code: number, value: number) => {
    const byte = value & 0xff;
    if (code === 0) r.B = byte;
    else if (code === 1) r.C = byte;
    else if (code === 2) r.D = byte;
    else if (code === 3) r.E8 = byte;
    else if (code === 4) r.H = byte;
    else if (code === 5) r.L = byte;
    else if (code === 6) write8(getHL(), byte, "Write result to M");
    else r.A = byte;
  };
  const setSZP = (value: number) => {
    const byte = value & 0xff;
    r.FS = byte >> 7;
    r.FZ = byte === 0 ? 1 : 0;
    r.FP = parity(byte);
  };
  const add = (value: number, carry = 0) => {
    const result = r.A + value + carry;
    r.FAC = (r.A & 0xf) + (value & 0xf) + carry > 0xf ? 1 : 0;
    r.FCY = result > 0xff ? 1 : 0;
    r.A = result & 0xff;
    setSZP(r.A);
  };
  const subtract = (value: number, borrow = 0, store = true) => {
    const result = r.A - value - borrow;
    r.FAC = (r.A & 0xf) < (value & 0xf) + borrow ? 1 : 0;
    r.FCY = result < 0 ? 1 : 0;
    setSZP(result);
    if (store) r.A = result & 0xff;
  };
  const flagsByte = () =>
    (r.FS << 7) | (r.FZ << 6) | (r.FAC << 4) | (r.FP << 2) | 0x02 | r.FCY;
  const setFlagsByte = (value: number) => {
    r.FS = (value >> 7) & 1;
    r.FZ = (value >> 6) & 1;
    r.FAC = (value >> 4) & 1;
    r.FP = (value >> 2) & 1;
    r.FCY = value & 1;
  };
  const push = (value: number) => {
    r.SP = (r.SP - 1) & 0xffff;
    write8(r.SP, value >> 8, "Stack write high byte");
    r.SP = (r.SP - 1) & 0xffff;
    write8(r.SP, value, "Stack write low byte");
  };
  const pop = () => {
    const low = read8(r.SP, "Stack read low byte");
    r.SP = (r.SP + 1) & 0xffff;
    const high = read8(r.SP, "Stack read high byte");
    r.SP = (r.SP + 1) & 0xffff;
    return low | (high << 8);
  };
  const condition = (code: number) =>
    [!r.FZ, !!r.FZ, !r.FCY, !!r.FCY, !r.FP, !!r.FP, !r.FS, !!r.FS][code] ??
    false;
  const regName = ["B", "C", "D", "E", "H", "L", "M", "A"];
  const pairName = ["B", "D", "H", "SP"];
  const conditionName = ["NZ", "Z", "NC", "C", "PO", "PE", "P", "M"];

  if (opcode >= 0x40 && opcode <= 0x7f) {
    if (opcode === 0x76) {
      instruction = "HLT";
      halted = true;
    } else {
      const dest = (opcode >> 3) & 7;
      const source = opcode & 7;
      setReg(dest, getReg(source));
      instruction = `MOV ${regName[dest]},${regName[source]}`;
    }
  } else if (opcode >= 0x80 && opcode <= 0xbf) {
    const group = (opcode >> 3) & 7;
    const source = opcode & 7;
    const value = getReg(source);
    const names = ["ADD", "ADC", "SUB", "SBB", "ANA", "XRA", "ORA", "CMP"];
    instruction = `${names[group]} ${regName[source]}`;
    if (group === 0) add(value);
    else if (group === 1) add(value, r.FCY);
    else if (group === 2) subtract(value);
    else if (group === 3) subtract(value, r.FCY);
    else if (group === 4) {
      r.A &= value;
      r.FCY = 0;
      r.FAC = 1;
      setSZP(r.A);
    } else if (group === 5) {
      r.A ^= value;
      r.FCY = 0;
      r.FAC = 0;
      setSZP(r.A);
    } else if (group === 6) {
      r.A |= value;
      r.FCY = 0;
      r.FAC = 0;
      setSZP(r.A);
    } else subtract(value, 0, false);
  } else if ((opcode & 0xc7) === 0x04 || (opcode & 0xc7) === 0x05) {
    const code = (opcode >> 3) & 7;
    const before = getReg(code);
    const value = opcode & 1 ? (before - 1) & 0xff : (before + 1) & 0xff;
    r.FAC =
      opcode & 1
        ? (before & 0xf) === 0
          ? 1
          : 0
        : (before & 0xf) === 0xf
          ? 1
          : 0;
    setReg(code, value);
    setSZP(value);
    instruction = `${opcode & 1 ? "DCR" : "INR"} ${regName[code]}`;
  } else if ((opcode & 0xc7) === 0x06) {
    const code = (opcode >> 3) & 7;
    const value = next8();
    setReg(code, value);
    instruction = `MVI ${regName[code]},${value.toString(16).toUpperCase().padStart(2, "0")}H`;
  } else if ((opcode & 0xcf) === 0x01) {
    const code = (opcode >> 4) & 3;
    const value = next16();
    setPair(code, value);
    instruction = `LXI ${pairName[code]},${value.toString(16).toUpperCase().padStart(4, "0")}H`;
  } else if ((opcode & 0xcf) === 0x03 || (opcode & 0xcf) === 0x0b) {
    const code = (opcode >> 4) & 3;
    setPair(code, getPair(code) + (opcode & 8 ? -1 : 1));
    instruction = `${opcode & 8 ? "DCX" : "INX"} ${pairName[code]}`;
  } else if ((opcode & 0xcf) === 0x09) {
    const code = (opcode >> 4) & 3;
    const result = getHL() + getPair(code);
    r.FCY = result > 0xffff ? 1 : 0;
    setHL(result);
    instruction = `DAD ${pairName[code]}`;
  } else if (
    opcode === 0x02 ||
    opcode === 0x12 ||
    opcode === 0x0a ||
    opcode === 0x1a
  ) {
    const pair = opcode & 0x10 ? 1 : 0;
    if (opcode & 0x08) r.A = read8(getPair(pair), "Read indirect operand");
    else write8(getPair(pair), r.A, "Write indirect operand");
    instruction = `${opcode & 0x08 ? "LDAX" : "STAX"} ${pairName[pair]}`;
  } else if ([0x22, 0x2a, 0x32, 0x3a].includes(opcode)) {
    const address = next16();
    if (opcode === 0x22) {
      write8(address, r.L, "Write L direct");
      write8(address + 1, r.H, "Write H direct");
      instruction = "SHLD";
    } else if (opcode === 0x2a) {
      r.L = read8(address, "Read L direct");
      r.H = read8(address + 1, "Read H direct");
      instruction = "LHLD";
    } else if (opcode === 0x32) {
      write8(address, r.A, "Write A direct");
      instruction = "STA";
    } else {
      r.A = read8(address, "Read A direct");
      instruction = "LDA";
    }
    instruction += ` ${address.toString(16).toUpperCase().padStart(4, "0")}H`;
  } else if ([0x07, 0x0f, 0x17, 0x1f].includes(opcode)) {
    const oldCarry = r.FCY;
    if (opcode === 0x07 || opcode === 0x17) {
      r.FCY = r.A >> 7;
      r.A = ((r.A << 1) | (opcode === 0x07 ? r.FCY : oldCarry)) & 0xff;
      instruction = opcode === 0x07 ? "RLC" : "RAL";
    } else {
      r.FCY = r.A & 1;
      r.A = ((r.A >> 1) | ((opcode === 0x0f ? r.FCY : oldCarry) << 7)) & 0xff;
      instruction = opcode === 0x0f ? "RRC" : "RAR";
    }
  } else if (opcode === 0x27) {
    let correction = 0;
    let carry = r.FCY;
    if ((r.A & 0x0f) > 9 || r.FAC) correction |= 0x06;
    if (r.A > 0x99 || r.FCY) {
      correction |= 0x60;
      carry = 1;
    }
    add(correction);
    r.FCY = carry;
    instruction = "DAA";
  } else if (opcode === 0x2f) {
    r.A ^= 0xff;
    instruction = "CMA";
  } else if (opcode === 0x37) {
    r.FCY = 1;
    instruction = "STC";
  } else if (opcode === 0x3f) {
    r.FCY ^= 1;
    instruction = "CMC";
  } else if (
    [0xc6, 0xce, 0xd6, 0xde, 0xe6, 0xee, 0xf6, 0xfe].includes(opcode)
  ) {
    const value = next8();
    const names: Record<number, string> = {
      0xc6: "ADI",
      0xce: "ACI",
      0xd6: "SUI",
      0xde: "SBI",
      0xe6: "ANI",
      0xee: "XRI",
      0xf6: "ORI",
      0xfe: "CPI",
    };
    instruction = `${names[opcode]} ${value.toString(16).toUpperCase().padStart(2, "0")}H`;
    if (opcode === 0xc6) add(value);
    else if (opcode === 0xce) add(value, r.FCY);
    else if (opcode === 0xd6) subtract(value);
    else if (opcode === 0xde) subtract(value, r.FCY);
    else if (opcode === 0xe6) {
      r.A &= value;
      r.FCY = 0;
      r.FAC = 1;
      setSZP(r.A);
    } else if (opcode === 0xee) {
      r.A ^= value;
      r.FCY = 0;
      r.FAC = 0;
      setSZP(r.A);
    } else if (opcode === 0xf6) {
      r.A |= value;
      r.FCY = 0;
      r.FAC = 0;
      setSZP(r.A);
    } else subtract(value, 0, false);
  } else if (opcode === 0xc3 || (opcode & 0xc7) === 0xc2) {
    const address = next16();
    const code = (opcode >> 3) & 7;
    const taken = opcode === 0xc3 || condition(code);
    if (taken) r.PC = address;
    instruction =
      opcode === 0xc3
        ? `JMP ${address.toString(16).toUpperCase().padStart(4, "0")}H`
        : `J${conditionName[code]} ${address.toString(16).toUpperCase().padStart(4, "0")}H${taken ? "" : " (not taken)"}`;
  } else if (opcode === 0xcd || (opcode & 0xc7) === 0xc4) {
    const address = next16();
    const code = (opcode >> 3) & 7;
    const taken = opcode === 0xcd || condition(code);
    if (taken) {
      push(r.PC);
      r.PC = address;
    }
    instruction =
      opcode === 0xcd
        ? `CALL ${address.toString(16).toUpperCase().padStart(4, "0")}H`
        : `C${conditionName[code]} ${address.toString(16).toUpperCase().padStart(4, "0")}H${taken ? "" : " (not taken)"}`;
  } else if (opcode === 0xc9 || (opcode & 0xc7) === 0xc0) {
    const code = (opcode >> 3) & 7;
    const taken = opcode === 0xc9 || condition(code);
    if (taken) r.PC = pop();
    instruction =
      opcode === 0xc9
        ? "RET"
        : `R${conditionName[code]}${taken ? "" : " (not taken)"}`;
  } else if ((opcode & 0xc7) === 0xc7) {
    const vector = (opcode >> 3) & 7;
    push(r.PC);
    r.PC = vector * 8;
    instruction = `RST ${vector}`;
  } else if ((opcode & 0xcf) === 0xc5 || (opcode & 0xcf) === 0xc1) {
    const code = (opcode >> 4) & 3;
    const names = ["B", "D", "H", "PSW"];
    if ((opcode & 4) !== 0)
      push(code === 3 ? (r.A << 8) | flagsByte() : getPair(code));
    else {
      const value = pop();
      if (code === 3) {
        r.A = value >> 8;
        setFlagsByte(value & 0xff);
      } else setPair(code, value);
    }
    instruction = `${opcode & 4 ? "PUSH" : "POP"} ${names[code]}`;
  } else if (opcode === 0xe3) {
    const low = read8(r.SP, "Read stack low byte"),
      high = read8(r.SP + 1, "Read stack high byte");
    write8(r.SP, r.L, "Write L to stack");
    write8(r.SP + 1, r.H, "Write H to stack");
    r.L = low;
    r.H = high;
    instruction = "XTHL";
  } else if (opcode === 0xe9) {
    r.PC = getHL();
    instruction = "PCHL";
  } else if (opcode === 0xeb) {
    [r.D, r.H] = [r.H, r.D];
    [r.E8, r.L] = [r.L, r.E8];
    instruction = "XCHG";
  } else if (opcode === 0xf9) {
    r.SP = getHL();
    instruction = "SPHL";
  } else if (opcode === 0xdb || opcode === 0xd3) {
    const port = next8();
    if (opcode === 0xdb) {
      r.A = ports[port] ?? 0;
      machineCycles.push(
        create8085MachineCycle("io-read", "I/O read", port, r.A),
      );
    } else {
      portWrites.push({ port, value: r.A });
      machineCycles.push(
        create8085MachineCycle("io-write", "I/O write", port, r.A),
      );
    }
    instruction = `${opcode === 0xdb ? "IN" : "OUT"} ${port.toString(16).toUpperCase().padStart(2, "0")}H`;
  } else if (opcode === 0xf3) {
    r.IE = 0;
    instruction = "DI";
  } else if (opcode === 0xfb) {
    r.IE = 1;
    instruction = "EI";
  } else if (opcode === 0x20) {
    r.A = (r.SID << 7) | (r.IE << 3) | (r.IM & 7);
    instruction = "RIM";
  } else if (opcode === 0x30) {
    if (r.A & 0x08) r.IM = r.A & 7;
    if (r.A & 0x40) r.SOD = (r.A >> 7) & 1;
    instruction = "SIM";
  } else if (opcode === 0x00) instruction = "NOP";
  else
    throw new Error(
      `Reserved 8085 opcode ${opcode.toString(16).toUpperCase().padStart(2, "0")} at ${start.toString(16).toUpperCase().padStart(4, "0")}`,
    );

  notations.push(`Execute: ${instruction}`);
  const timing = finalize8085TimingTrace(
    start,
    opcode,
    instruction,
    machineCycles,
  );
  return {
    registers: r,
    memoryWrites,
    portWrites,
    halted,
    instruction,
    notations,
    timing,
  };
}
