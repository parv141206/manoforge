import { step8085, type I8085Registers } from "./cpu";

const base: I8085Registers = {
  A: 0x12,
  B: 0x20,
  C: 0,
  D: 0x30,
  E8: 0,
  H: 0x40,
  L: 0,
  PC: 0x1000,
  SP: 0x5000,
  IR: 0,
  FS: 0,
  FZ: 0,
  FAC: 0,
  FP: 0,
  FCY: 0,
  IE: 0,
  IM: 0,
  SID: 0,
  SOD: 0,
};

const cases: [number, number, number][] = [
  [0x00, 1, 4],
  [0x76, 2, 7],
  [0x41, 1, 4],
  [0x46, 2, 7],
  [0x70, 2, 7],
  [0x06, 2, 7],
  [0x36, 3, 10],
  [0x01, 3, 10],
  [0x03, 1, 6],
  [0x09, 3, 10],
  [0x0a, 2, 7],
  [0x02, 2, 7],
  [0x3a, 4, 13],
  [0x32, 4, 13],
  [0x2a, 5, 16],
  [0x22, 5, 16],
  [0x80, 1, 4],
  [0x86, 2, 7],
  [0x34, 3, 10],
  [0xc6, 2, 7],
  [0xc3, 3, 10],
  [0xcd, 5, 18],
  [0xc9, 3, 10],
  [0xc7, 3, 12],
  [0xc5, 3, 12],
  [0xc1, 3, 10],
  [0xe3, 5, 18],
  [0xe9, 1, 5],
  [0xf9, 1, 6],
  [0xdb, 3, 10],
  [0xd3, 3, 10],
];

let assertions = 0;

for (const [opcode, machineCycles, tStates] of cases) {
  const memory = new Array<number>(65536).fill(0);
  memory[0x1000] = opcode;
  memory[0x1001] = 0;
  memory[0x1002] = 0x20;
  memory[0x2000] = 0x55;
  memory[0x4000] = 0x33;
  memory[0x5000] = 0x34;
  memory[0x5001] = 0x12;
  const result = step8085({ ...base }, memory, new Array(256).fill(0x5a));
  if (result.timing.machineCycles.length !== machineCycles) {
    throw new Error(`${opcode.toString(16)} machine-cycle mismatch`);
  }
  if (result.timing.totalTStates !== tStates) {
    throw new Error(`${opcode.toString(16)} T-state mismatch`);
  }
  const tracedTStates = result.timing.machineCycles.reduce(
    (sum, cycle) => sum + cycle.tStates,
    0,
  );
  if (tracedTStates !== tStates) {
    throw new Error(`${opcode.toString(16)} trace total mismatch`);
  }
  assertions += 3;
}

const conditionalCases: [number, number, number][] = [
  [0xc2, 3, 10],
  [0xca, 2, 7],
  [0xc4, 5, 18],
  [0xcc, 2, 9],
  [0xc0, 3, 12],
  [0xc8, 1, 6],
];

for (const [opcode, machineCycles, tStates] of conditionalCases) {
  const memory = new Array<number>(65536).fill(0);
  memory[0x1000] = opcode;
  memory[0x1001] = 0;
  memory[0x1002] = 0x20;
  memory[0x5000] = 0x34;
  memory[0x5001] = 0x12;
  const result = step8085({ ...base, FZ: 0 }, memory, []);
  if (
    result.timing.machineCycles.length !== machineCycles ||
    result.timing.totalTStates !== tStates
  ) {
    throw new Error(`${opcode.toString(16)} conditional timing mismatch`);
  }
  assertions += 2;
}

console.log(`8085 timing tests passed ${assertions} assertions`);
