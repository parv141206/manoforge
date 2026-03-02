/**
 *
 */

import { Assembler } from "./assembler";
import { Parser } from "./parser";
import { tokenize } from "./tokenizer";
import { hexToNum, numToHex } from "./utility";

class Executor {
  machineCode: string[];
  PC: string = "0";
  AC: string = "0";
  DR: string = "0";
  IR: string = "";
  AR: string = "0";
  I: string = "0";
  E: string = "0";
  INPR: string = "0";
  OUTPR: string = "0";

  delay: number = 0;
  memory: string[] = new Array(4096).fill("0000");
  constructor(machineCode: string[]) {
    this.machineCode = machineCode;
    /** loading the program (machine code) into the memory starting from origin (but right now 0): */
    for (let i = 0; i < machineCode.length; i += 1) {
      this.memory[i] = machineCode[i]!;
    }
    /** initializing the PC to the origin (but right now 0): */
    this.PC = "0";
  }

  private fetch() {
    /** T0: AR <- PC */
    this.AR = this.PC;
    /** T1: IR <- M[AR], PC <- PC + 1 */
    this.IR = this.memory[hexToNum(this.AR)]!;
    this.PC = numToHex(hexToNum(this.PC) + 1, 1);
  }

  private decode() {
    /**
     * T2:
     * decoding the instruction in form of:
     *  IR = [12...14] the opcode (in hex, last MSB)
     *  AR = [0...11] the address (in hex, first 3 bits)
     *  I = [15] the indirect bit (in hex, last MSB)
     */
    let opcode = this.IR.slice(0, 1);
    let address = this.IR.slice(1, 4);
    this.AR = address;
    this.I = ["8", "9", "A", "B", "C", "D", "E", "F"].includes(
      this.IR.charAt(0),
    )
      ? "1"
      : "0";
    console.log(
      `${this.PC} | Decoded instruction: opcode=${opcode}, address=${address}`,
    );
  }

  private executeMemoryReferenceInstructions() {
    let opcodeChar = this.IR.slice(0, 1);
    let opcode = hexToNum(opcodeChar) & 7;
    let address = this.AR;
    let indirect = this.I;
    /** T3:  */
    if (indirect === "0") {
      /** eat 5 star, do nothing */
    } else {
      /** indirect */
      this.AR = this.memory[hexToNum(this.AR)]!;
    }

    /** T4: DR <- M[AR] */
    this.DR = this.memory[hexToNum(this.AR)]!;

    if (opcode === 0) {
      /** AND: AC <- AC & DR */
      this.AC = numToHex(hexToNum(this.AC) & hexToNum(this.DR), 4);
    } else if (opcode === 1) {
      /** ADD: AC <- AC + DR */
      this.AC = numToHex((hexToNum(this.AC) + hexToNum(this.DR)) & 0xffff, 4);
    } else if (opcode === 2) {
      /** LDA: AC <- DR */
      this.AC = this.DR;
    } else if (opcode === 3) {
      /** STA: M[AR] <- AC */
      this.memory[hexToNum(this.AR)] = this.AC;
    } else if (opcode === 4) {
      /** BUN: PC <- AR */
      this.PC = this.AR;
    } else if (opcode === 5) {
      /** BSA: M[AR] <- PC, PC <- AR + 1 */
      this.memory[hexToNum(this.AR)] = this.PC;
      this.PC = numToHex(hexToNum(this.AR) + 1, 1);
    } else if (opcode === 6) {
      /** ISZ: M[AR] <- M[AR] + 1, if M[AR] == 0 then PC <- PC + 1 */
      let value = numToHex(
        (hexToNum(this.memory[hexToNum(this.AR)]!) + 1) & 0xffff,
        4,
      );
      this.memory[hexToNum(this.AR)] = value;
      if (value === "0000") {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    }
    console.log(
      `Executing memory reference instruction: opcode=${opcode}, address=${address}, indirect=${indirect}`,
    );
  }
  private executeRegisterReferenceInstructions() {
    let instruction = this.IR;
    if (instruction === "7800") {
      /** CLA: AC <- 0 */
      this.AC = "0000";
    } else if (instruction === "7400") {
      /** CLE: E <- 0 */
      this.E = "0";
    } else if (instruction === "7200") {
      /** CMA: AC <- ~AC */
      this.AC = numToHex(~hexToNum(this.AC), 4);
    } else if (instruction === "7100") {
      /** CME: E <- ~E */
      this.E = this.E === "0" ? "1" : "0";
    } else if (instruction === "7080") {
      /** CIR: AC <- (E, AC) >> 1, E <- AC[0] */
      let newE = this.AC.charAt(3);
      this.AC = this.E + this.AC.slice(0, 3);
      this.E = newE;
    } else if (instruction === "7040") {
      /** CIL: AC <- (AC, E) << 1, E <- AC[3] */
      let newE = this.AC.charAt(0);
      this.AC = this.AC.slice(1) + this.E;
      this.E = newE;
    } else if (instruction === "7020") {
      /** INC: AC <- AC + 1 */
      this.AC = numToHex((hexToNum(this.AC) + 1) & 0xffff, 4);
    } else if (instruction === "7010") {
      /** SPA: if AC[0] == 0 then PC <- PC + 1 */
      if (this.AC.charAt(0) === "0") {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    } else if (instruction === "7008") {
      /** SNA: if AC[0] == 1 then PC <- PC + 1 */
      if (this.AC.charAt(0) === "1") {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    } else if (instruction === "7004") {
      /** SZA: if AC == 0 then PC <- PC + 1 */
      if (this.AC === "0000") {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    } else if (instruction === "7002") {
      /** SZE: if E == 0 then PC <- PC + 1 */
      if (this.E === "0") {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    } else if (instruction === "7001") {
      /** HLT: halt the execution */
    }
    console.log(
      `Executing register reference instruction: instruction=${instruction}`,
    );
  }
  private executeInputOutputInstructions() {
    /** idk what to do here, how do i emulate it */
  }

  private execute() {
    if (this.IR.charAt(0) === "7") {
      this.executeRegisterReferenceInstructions();
    } else if (this.IR.charAt(0) === "F") {
      this.executeInputOutputInstructions();
    } else {
      this.executeMemoryReferenceInstructions();
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  public async run() {
    while (true) {
      this.fetch();
      this.decode();
      this.execute();
      if (this.IR === "7001") {
        console.log("HLT encountered, stopping execution.");
        break;
      }
    }
    // console.log(`PC: ${this.PC}`);
    // console.log(`AC: ${this.AC}`);
    // console.log(`DR: ${this.DR}`);
    // console.log(`IR: ${this.IR}`);
    // console.log(`AR: ${this.AR}`);
    // console.log(`I: ${this.I}`);
    // console.log(`E: ${this.E}`);
    // console.log(`INPR: ${this.INPR}`);
    // console.log(`OUTPR: ${this.OUTPR}`);
    // console.log("Memory:");
    // for (let i = 0; i < 16; i += 1) {
    //   let row = this.memory.slice(i * 16, (i + 1) * 16).join(" ");
    //   console.log(`${numToHex(i * 16, 3)}: ${row}`);
    // }
  }
}

// const code = `
//     CLA
//     STA RES

// LOP, LDA RES
//     ADD NUM
//     STA RES
//     ISZ COUNT
//     BUN LOP

//     HLT

// NUM,   DEC 2
// COUNT, DEC -5
// RES,   HEX 0000
// `;

// const ast = new Parser(tokenize(code), code).parse();
// console.log(ast);
// const assembler = new Assembler(ast!);
// const machineCode = assembler.assemble();
// console.log(machineCode);
// const executor = new Executor(machineCode);
// executor.run();
