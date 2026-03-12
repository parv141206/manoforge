/**
 * oof
 * the name says it all.
 * here i am executing the machine code which is given by the assembler.
 *
 * the current architecture includes all the instructions hard mapped but i guess there cant be any better solution.
 *
 * do create a PR if you find one.
 *
 * @author parv141206
 */

// import { Assembler } from "./assembler";
// import { Parser } from "./parser";
// import { tokenize } from "./tokenizer";
import { hexToNum, numToHex } from "./utility";

export class Executor {
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
  /**
   * this is only displaying on the frontend. so it stores things like AR <- PC, IR <- M[AR] etc. which are the current micro-operations being executed
   */
  currentNotation: string = "";
  delay: number = 0;
  memory: string[] = new Array(4096).fill("0000");
  constructor(machineCode: string[], delay: number = 0) {
    this.machineCode = machineCode;
    this.delay = delay;
    /** loading the program (machine code) into the memory starting from origin (but right now 0): */
    for (let i = 0; i < machineCode.length; i += 1) {
      this.memory[i] = machineCode[i]!;
    }
    /** initializing the PC to the origin (but right now 0): */
    this.PC = "0";
  }

  /**
   * i could have updated currentNotation directly but then i would have to call the sleep method each time. so this basically calls sleep method automatically whenever the notation is updated.
   * @param notation the notation to show
   */
  private async updateNotation(notation: string) {
    this.currentNotation = notation;
    if (this.delay > 0) {
      console.log(notation);
      await this.sleep(this.delay);
    }
  }

  private async fetch() {
    /** T0: AR <- PC */
    await this.updateNotation(`T0: AR <- PC (${this.PC})`);
    this.AR = this.PC;
    /** T1: IR <- M[AR], PC <- PC + 1 */
    await this.updateNotation(
      `T1: IR <- M[AR] (M[${this.AR}] = ${this.memory[hexToNum(this.AR)]}), PC <- PC + 1 (${numToHex(hexToNum(this.PC) + 1, 1)})`,
    );
    this.IR = this.memory[hexToNum(this.AR)]!;
    this.PC = numToHex(hexToNum(this.PC) + 1, 1);
  }

  private async decode() {
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
    await this.updateNotation(
      `T2: Decoded instruction: opcode=${opcode}, address=${address}`,
    );
    // console.log(
    //   `${this.PC} | Decoded instruction: opcode=${opcode}, address=${address}`,
    // );
  }

  private async executeMemoryReferenceInstructions() {
    let opcodeChar = this.IR.slice(0, 1);
    let opcode = hexToNum(opcodeChar) & 7;
    let address = this.AR;
    let indirect = this.I;
    /** T3:  */
    if (indirect === "0") {
      /** eat 5 star, do nothing */
      await this.updateNotation(
        `T3: Direct addressing, AR is already set to ${this.AR}`,
      );
    } else {
      /** indirect */
      await this.updateNotation(
        `T3: Indirect addressing, AR <- M[AR] (M[${this.AR}] = ${this.memory[hexToNum(this.AR)]})`,
      );
      this.AR = this.memory[hexToNum(this.AR)]!;
    }

    /** T4: DR <- M[AR] */
    await this.updateNotation(
      `T4: DR <- M[AR] (M[${this.AR}] = ${this.memory[hexToNum(this.AR)]})`,
    );
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
    await this.updateNotation(
      `Executed memory reference instruction: opcode=${opcode}, address=${address}, indirect=${indirect}`,
    );
    // console.log(
    //   `Executing memory reference instruction: opcode=${opcode}, address=${address}, indirect=${indirect}`,
    // );
  }
  private async executeRegisterReferenceInstructions() {
    let instruction = this.IR;
    if (instruction === "7800") {
      this.AC = "0000";
    } else if (instruction === "7400") {
      this.E = "0";
    } else if (instruction === "7200") {
      this.AC = numToHex(~hexToNum(this.AC) & 0xffff, 4);
    } else if (instruction === "7100") {
      this.E = this.E === "0" ? "1" : "0";
    } else if (instruction === "7080") {
      let acVal = hexToNum(this.AC);
      let eVal = parseInt(this.E, 10);
      let lsb = acVal & 1;
      let newAc = (acVal >> 1) | (eVal << 15);
      this.AC = numToHex(newAc & 0xffff, 4);
      this.E = lsb.toString();
    } else if (instruction === "7040") {
      let acVal = hexToNum(this.AC);
      let eVal = parseInt(this.E, 10);
      let msb = (acVal >> 15) & 1;
      let newAc = ((acVal << 1) | eVal) & 0xffff;
      this.AC = numToHex(newAc, 4);
      this.E = msb.toString();
    } else if (instruction === "7020") {
      this.AC = numToHex((hexToNum(this.AC) + 1) & 0xffff, 4);
    } else if (instruction === "7010") {
      let acVal = hexToNum(this.AC);
      if ((acVal & 0x8000) === 0 && acVal !== 0) {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    } else if (instruction === "7008") {
      let acVal = hexToNum(this.AC);
      if ((acVal & 0x8000) !== 0) {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    } else if (instruction === "7004") {
      if (hexToNum(this.AC) === 0) {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    } else if (instruction === "7002") {
      if (this.E === "0") {
        this.PC = numToHex(hexToNum(this.PC) + 1, 1);
      }
    } else if (instruction === "7001") {
    }
    await this.updateNotation(
      `Executed register reference instruction: instruction=${instruction}`,
    );
    // console.log(
    //   `Executing register reference instruction: instruction=${instruction}`,
    // );
  }
  private async executeInputOutputInstructions() {
    /** idk what to do here, how do i emulate it */
  }

  private async execute() {
    if (this.IR.charAt(0) === "7") {
      await this.executeRegisterReferenceInstructions();
    } else if (this.IR.charAt(0) === "F") {
      await this.executeInputOutputInstructions();
    } else {
      await this.executeMemoryReferenceInstructions();
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  public async run() {
    while (true) {
      await this.fetch();
      await this.decode();
      await this.execute();
      if (this.IR === "7001") {
        console.log("HLT encountered, stopping execution.");
        break;
      }
    }
    console.log(`PC: ${this.PC}`);
    console.log(`AC: ${this.AC}`);
    console.log(`DR: ${this.DR}`);
    console.log(`IR: ${this.IR}`);
    console.log(`AR: ${this.AR}`);
    console.log(`I: ${this.I}`);
    console.log(`E: ${this.E}`);
    console.log(`INPR: ${this.INPR}`);
    console.log(`OUTPR: ${this.OUTPR}`);
    console.log("Memory:");
    for (let i = 0; i < 16; i += 1) {
      let row = this.memory.slice(i * 16, (i + 1) * 16).join(" ");
      console.log(`${numToHex(i * 16, 3)}: ${row}`);
    }
  }
}

// const code = `
// MAIN,   LDA NUM
//   BSA IN
//         STA RESULT
//         HLT
// IN,    HEX 0000
//         ADD ONE
//         BUN IN I
// NUM,    DEC 5
// ONE,    DEC 5
// RESULT, HEX 0000
// `;

// const ast = new Parser(tokenize(code), code).parse();
// console.log(ast);
// const assembler = new Assembler(ast!);
// const machineCode = assembler.assemble();
// console.log(machineCode);
// const executor = new Executor(machineCode, 1000);
// executor.run();
