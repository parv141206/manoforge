/**
 * all the opcodes in the mano simulator
 */
export const OPCODES = {
  // memory reference instructions
  AND: "000",
  ADD: "001",
  LDA: "002",
  STA: "003",
  BUN: "004",
  BSA: "005",
  ISZ: "006",
  // register reference instructions
  CLA: "7800",
  CLE: "7400",
  CMA: "7200",
  CME: "7100",
  CIR: "7080",
  CIL: "7040",
  INC: "7020",
  SPA: "7010",
  SNA: "7008",
  SZA: "7004",
  SZE: "7002",
  HLT: "7001",
  // input output instructions
  INP: "F800",
  OUT: "F400",
  SKI: "F200",
  SKO: "F100",
  ION: "F080",
  IOF: "F040",
} as const;
