export const I8085_INSTRUCTIONS = [
  "MOV",
  "MVI",
  "LXI",
  "LDA",
  "STA",
  "LHLD",
  "SHLD",
  "LDAX",
  "STAX",
  "XCHG",
  "ADD",
  "ADC",
  "ADI",
  "ACI",
  "SUB",
  "SBB",
  "SUI",
  "SBI",
  "INR",
  "DCR",
  "INX",
  "DCX",
  "DAD",
  "DAA",
  "ANA",
  "ANI",
  "XRA",
  "XRI",
  "ORA",
  "ORI",
  "CMP",
  "CPI",
  "RLC",
  "RRC",
  "RAL",
  "RAR",
  "CMA",
  "CMC",
  "STC",
  "JMP",
  "JNZ",
  "JZ",
  "JNC",
  "JC",
  "JPO",
  "JPE",
  "JP",
  "JM",
  "CALL",
  "CNZ",
  "CZ",
  "CNC",
  "CC",
  "CPO",
  "CPE",
  "CP",
  "CM",
  "RET",
  "RNZ",
  "RZ",
  "RNC",
  "RC",
  "RPO",
  "RPE",
  "RP",
  "RM",
  "RST",
  "PCHL",
  "PUSH",
  "POP",
  "XTHL",
  "SPHL",
  "IN",
  "OUT",
  "EI",
  "DI",
  "SIM",
  "RIM",
  "NOP",
  "HLT",
] as const;

export const I8085_DIRECTIVES = [
  "ORG",
  "DB",
  "DW",
  "DS",
  "EQU",
  "SET",
  "END",
] as const;

const registers: Record<string, number> = {
  B: 0,
  C: 1,
  D: 2,
  E: 3,
  H: 4,
  L: 5,
  M: 6,
  A: 7,
};
const pairs: Record<string, number> = {
  B: 0,
  BC: 0,
  D: 1,
  DE: 1,
  H: 2,
  HL: 2,
  SP: 3,
};
const stackPairs: Record<string, number> = {
  B: 0,
  BC: 0,
  D: 1,
  DE: 1,
  H: 2,
  HL: 2,
  PSW: 3,
};
const fixed: Record<string, number> = {
  NOP: 0x00,
  RLC: 0x07,
  RRC: 0x0f,
  RAL: 0x17,
  RAR: 0x1f,
  RIM: 0x20,
  DAA: 0x27,
  CMA: 0x2f,
  SIM: 0x30,
  STC: 0x37,
  CMC: 0x3f,
  HLT: 0x76,
  RNZ: 0xc0,
  RZ: 0xc8,
  RET: 0xc9,
  RNC: 0xd0,
  RC: 0xd8,
  RPO: 0xe0,
  XTHL: 0xe3,
  RPE: 0xe8,
  PCHL: 0xe9,
  XCHG: 0xeb,
  RP: 0xf0,
  DI: 0xf3,
  RM: 0xf8,
  SPHL: 0xf9,
  EI: 0xfb,
};
const direct16: Record<string, number> = {
  SHLD: 0x22,
  LHLD: 0x2a,
  STA: 0x32,
  LDA: 0x3a,
  JNZ: 0xc2,
  JMP: 0xc3,
  CNZ: 0xc4,
  JZ: 0xca,
  CZ: 0xcc,
  CALL: 0xcd,
  JNC: 0xd2,
  CNC: 0xd4,
  JC: 0xda,
  CC: 0xdc,
  JPO: 0xe2,
  CPO: 0xe4,
  JPE: 0xea,
  CPE: 0xec,
  JP: 0xf2,
  CP: 0xf4,
  JM: 0xfa,
  CM: 0xfc,
};
const immediate8: Record<string, number> = {
  ADI: 0xc6,
  ACI: 0xce,
  OUT: 0xd3,
  SUI: 0xd6,
  IN: 0xdb,
  SBI: 0xde,
  ANI: 0xe6,
  XRI: 0xee,
  ORI: 0xf6,
  CPI: 0xfe,
};
const aluBase: Record<string, number> = {
  ADD: 0x80,
  ADC: 0x88,
  SUB: 0x90,
  SBB: 0x98,
  ANA: 0xa0,
  XRA: 0xa8,
  ORA: 0xb0,
  CMP: 0xb8,
};

export class I8085AssemblyError extends Error {
  constructor(
    message: string,
    public line: number,
    public column = 1,
    public file = "program.a85",
  ) {
    super(message);
  }
}

const requireOperand = (
  operands: string[],
  index: number,
  mnemonic: string,
  line: number,
) => {
  const value = operands[index]?.toUpperCase();
  if (!value)
    throw new I8085AssemblyError(`Missing operand for ${mnemonic}`, line);
  return value;
};

const requireOperandCount = (
  operands: string[],
  count: number,
  mnemonic: string,
  line: number,
) => {
  if (operands.length !== count)
    throw new I8085AssemblyError(
      `${mnemonic} expects ${count} operand${count === 1 ? "" : "s"}`,
      line,
    );
};

const regCode = (value: string, line: number) => {
  const code = registers[value];
  if (code === undefined)
    throw new I8085AssemblyError(`Invalid register: ${value}`, line);
  return code;
};

const pairCode = (value: string, line: number, stack = false) => {
  const code = (stack ? stackPairs : pairs)[value];
  if (code === undefined)
    throw new I8085AssemblyError(`Invalid register pair: ${value}`, line);
  return code;
};

export const instructionSize = (mnemonic: string) => {
  const upper = mnemonic.toUpperCase();
  if (upper in direct16 || upper === "LXI") return 3;
  if (upper in immediate8 || upper === "MVI") return 2;
  return 1;
};

export function encodeInstruction(
  mnemonic: string,
  operands: string[],
  line: number,
  resolve: (expression: string) => number,
) {
  const op = mnemonic.toUpperCase();
  if (fixed[op] !== undefined) {
    requireOperandCount(operands, 0, op, line);
    return [fixed[op]];
  }
  if (direct16[op] !== undefined) {
    requireOperandCount(operands, 1, op, line);
    const value = resolve(requireOperand(operands, 0, op, line)) & 0xffff;
    return [direct16[op], value & 0xff, value >> 8];
  }
  if (immediate8[op] !== undefined) {
    requireOperandCount(operands, 1, op, line);
    const value = resolve(requireOperand(operands, 0, op, line));
    if (value < -128 || value > 255)
      throw new I8085AssemblyError(
        `${op} operand is outside 8-bit range`,
        line,
      );
    return [immediate8[op], value & 0xff];
  }
  if (op === "MOV") {
    requireOperandCount(operands, 2, op, line);
    const dest = regCode(requireOperand(operands, 0, op, line), line);
    const source = regCode(requireOperand(operands, 1, op, line), line);
    if (dest === 6 && source === 6)
      throw new I8085AssemblyError("MOV M,M is HLT and is not valid", line);
    return [0x40 | (dest << 3) | source];
  }
  if (op === "MVI") {
    requireOperandCount(operands, 2, op, line);
    const dest = regCode(requireOperand(operands, 0, op, line), line);
    const value = resolve(requireOperand(operands, 1, op, line));
    if (value < -128 || value > 255)
      throw new I8085AssemblyError("MVI operand is outside 8-bit range", line);
    return [0x06 | (dest << 3), value & 0xff];
  }
  if (op === "LXI") {
    requireOperandCount(operands, 2, op, line);
    const pair = pairCode(requireOperand(operands, 0, op, line), line);
    const value = resolve(requireOperand(operands, 1, op, line)) & 0xffff;
    return [0x01 | (pair << 4), value & 0xff, value >> 8];
  }
  if (op === "LDAX" || op === "STAX") {
    requireOperandCount(operands, 1, op, line);
    const pair = pairCode(requireOperand(operands, 0, op, line), line);
    if (pair > 1)
      throw new I8085AssemblyError(`${op} only accepts B or D`, line);
    return [(op === "LDAX" ? 0x0a : 0x02) | (pair << 4)];
  }
  if (op === "INR" || op === "DCR") {
    requireOperandCount(operands, 1, op, line);
    return [
      (op === "INR" ? 0x04 : 0x05) |
        (regCode(requireOperand(operands, 0, op, line), line) << 3),
    ];
  }
  if (op === "INX" || op === "DCX" || op === "DAD") {
    requireOperandCount(operands, 1, op, line);
    const base = op === "INX" ? 0x03 : op === "DCX" ? 0x0b : 0x09;
    return [
      base | (pairCode(requireOperand(operands, 0, op, line), line) << 4),
    ];
  }
  if (aluBase[op] !== undefined) {
    requireOperandCount(operands, 1, op, line);
    return [aluBase[op] | regCode(requireOperand(operands, 0, op, line), line)];
  }
  if (op === "PUSH" || op === "POP") {
    requireOperandCount(operands, 1, op, line);
    return [
      (op === "PUSH" ? 0xc5 : 0xc1) |
        (pairCode(requireOperand(operands, 0, op, line), line, true) << 4),
    ];
  }
  if (op === "RST") {
    requireOperandCount(operands, 1, op, line);
    const value = resolve(requireOperand(operands, 0, op, line));
    if (value < 0 || value > 7)
      throw new I8085AssemblyError("RST operand must be 0 through 7", line);
    return [0xc7 | (value << 3)];
  }
  throw new I8085AssemblyError(`Unknown 8085 instruction: ${mnemonic}`, line);
}
