/**
 * The heart of the system!
 * Uses the AST and converts the code to machine code
 * It would work in two passes, the first would simply resolve all the labels and store them to a symbol table
 * and the second pass would convert everything to machine code
 *
 * sounds fair
 * @author parv141206
 */

import type { ASTNode } from "@/types/parser";
// import { Parser } from "./parser";
// import { tokenize } from "./tokenizer";
import { OPCODES } from "@/constants/opcodes";

export class Assembler {
  /** represents the ast */
  ast: ASTNode[];
  /** represents the symbol table, each label assigned to its corresponding address(hex) */
  symbolTable: Map<string, number> = new Map();
  /** represents the machine code which is finally generated */
  machineCode: string[] = [];
  /** location counter */
  locationCounter: number = 0;

  constructor(ast: ASTNode[]) {
    this.ast = ast;
  }

  /**
   * as i wrote above, this simply creates the symbol table
   */
  public firstPass() {
    for (const node of this.ast) {
      /** first case is that if the instruction itself has a starting label. i mean like for BUN and controlling loops we do add labels to instructions, so this is that */
      if (node.type === "Instruction" && node.label) {
        this.symbolTable.set(node.label, this.locationCounter);
      } else if (node.type === "Data") {
        /** second case is that if the instruction is a data declaration, then i obviously add the label to the symbol table with the current location counter */
        this.symbolTable.set(node.label, this.locationCounter);
      }
      this.locationCounter += 1;
    }
  }

  /**
   * the instructions are finally converted to the machine code in this pass, the symbol table is used to resolve the labels to their corresponding addresses
   */
  public secondPass() {
    for (const node of this.ast) {
      let machineCode = "";
      if (node.type === "Instruction") {
        let instruction = node.opcode as keyof typeof OPCODES;
        let instructionCode = OPCODES[instruction];

        /** now i have the instruction code.
         * but it could be anything.
         * so i can so a simple thing of doing 'ifs' to check the first character of the instruction.
         * if its
         *  0: its memory reference. i simply convert it to number (would give me 0 to 6), check if its indirect and then add the operand address to it
         *  7: its register reference. i simply convert it to number (would give me 1 to 15) and add it to 7000
         *  F: its input output. i simply convert it to number (would give me 1 to 8) and add it to F000
         */

        if (instructionCode.startsWith("0")) {
          // memory reference instruction
          let instructionNumber = parseInt(instructionCode, 16);
          if (node.indirect) {
            instructionNumber += 8;
          }
          // pushing the address, it would be label, so i guess i need to look into the table , get the address, convert it to string and push it
          let add = this.symbolTable
            .get(node.operand!)!
            .toString(16)
            .padStart(3, "0")
            .toUpperCase();
          machineCode =
            instructionNumber.toString(16).padStart(1, "0").toUpperCase() + add;
        } else if (instructionCode.startsWith("7")) {
          // register reference instruction
          machineCode = instructionCode;
        } else if (instructionCode.startsWith("F")) {
          // input output instruction
          machineCode = instructionCode;
        } else {
          throw new Error("Invalid instruction code");
        }
      } else if (node.type === "Data") {
        let value = parseInt(node.value, node.datatype === "HEX" ? 16 : 10);
        machineCode = value.toString(16).padStart(4, "0").toUpperCase();
      }
      this.machineCode.push(machineCode);
    }
  }

  /**
   * combines first and second pass and returns the machine code
   * @returns an array of machine code
   */
  public assemble() {
    this.firstPass();
    this.secondPass();
    return this.machineCode;
  }
}

// const code = `
//     CLA
//     LDA A
//     ADD B
//     STA RES
//     A, HEX 0002
//     B, DEC 0005
//     RES, HEX 0000`;
// const ast = new Parser(tokenize(code), code).parse();
// console.log(ast);
// const assembler = new Assembler(ast!);
// assembler.firstPass();
// console.log(assembler.symbolTable);
// assembler.secondPass();
// console.log(assembler.machineCode);
