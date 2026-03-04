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
import { Parser } from "./parser";
import { tokenize } from "./tokenizer";
import { OPCODES } from "@/constants/opcodes";
import { hexToNum, numToHex, parseValueByDatatype } from "./utility";

export class Assembler {
  /** represents the ast */
  ast: ASTNode[];
  /** represents the symbol table, each label assigned to its corresponding address(hex) */
  symbolTable: Map<string, number> = new Map();
  /** represents the machine code which is finally generated */
  machineCode: string[] = [];
  /** mapping from memory address to machine code */
  addressToCode: Map<number, string> = new Map();
  /** mapping from memory address to source line number (0-indexed) */
  addressToLine: Map<number, number> = new Map();
  /** location counter */
  locationCounter: number = 0;
  /** starting address for execution */
  startAddress: number = 0;

  constructor(ast: ASTNode[]) {
    this.ast = ast;
  }

  /**
   * as i wrote above, this simply creates the symbol table
   */
  public firstPass() {
    for (const node of this.ast) {
      if (node.type === "ORG") {
        this.locationCounter = node.address;
        continue;
      }
      if (node.type === "Program") {
        continue;
      }
      /** first case is that if the instruction itself has a starting label. i mean like for BUN and controlling loops we do add labels to instructions, so this is that */
      if (node.type === "Instruction" && node.label) {
        this.symbolTable.set(node.label, this.locationCounter);
      } else if (node.type === "Data") {
        /** second case is that if the instruction is a data declaration, then i obviously add the label to the symbol table with the current location counter */
        this.symbolTable.set(node.label, this.locationCounter);
      }
      this.addressToLine.set(this.locationCounter, node.line - 1);
      this.locationCounter += 1;
    }
  }

  /**
   * the instructions are finally converted to the machine code in this pass, the symbol table is used to resolve the labels to their corresponding addresses
   */
  public secondPass() {
    this.locationCounter = 0;
    for (const node of this.ast) {
      if (node.type === "ORG") {
        this.locationCounter = node.address;
        continue;
      }
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
          let instructionNumber = hexToNum(instructionCode);
          if (node.indirect) {
            instructionNumber += 8;
          }
          if (!node.operand) {
            throw new Error(`Missing operand for instruction: ${instruction}`);
          }
          const operandAddress = this.symbolTable.get(node.operand);
          if (operandAddress === undefined) {
            throw new Error(`Undefined symbol: ${node.operand}`);
          }
          // pushing the address, it would be label, so i guess i need to look into the table , get the address, convert it to string and push it
          let add = numToHex(operandAddress, 3);
          machineCode = numToHex(instructionNumber, 1) + add;
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
        let value = parseValueByDatatype(node.value, node.datatype);
        machineCode = numToHex(value, 4);
      }
      if (machineCode) {
        this.addressToCode.set(this.locationCounter, machineCode);
        this.machineCode.push(machineCode);
        this.locationCounter += 1;
      }
    }
  }

  /**
   * combines first and second pass and returns the machine code
   * @returns an array of machine code
   */
  public assemble() {
    this.startAddress = 0;
    for (const node of this.ast) {
      if (node.type === "ORG") {
        this.startAddress = node.address;
        break;
      }
      if (node.type === "Instruction" || node.type === "Data") {
        break;
      }
    }
    this.firstPass();
    this.secondPass();
    return this.machineCode;
  }
}

const code = `
    CLA
    LDA A
    ADD B
    STA RES
    A, HEX 0002
    B, DEC 0005
    RES, HEX 0000`;
const ast = new Parser(tokenize(code), code).parse();
console.log(ast);
const assembler = new Assembler(ast!);
assembler.firstPass();
console.log(assembler.symbolTable);
assembler.secondPass();
console.log(assembler.machineCode);
