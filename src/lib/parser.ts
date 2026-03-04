/**
 * @file This file is responsible for taking the array of tokens from the tokenizer and converting it into an Abstract Syntax Tree (AST) that the code generator can use to generate the final machine code.
 * @author parv141206
 *
 * BIGGGGG DISCLAIMER,
 *
 * I would never in my life use OOP by will but here i would have to. the whole "maintaining state" from one place to other was a bigggg headache. i gave up.
 *
 * So it is what it is
 *
 * This time once!
 *
 * Also it has many things which i thought earlier but i found that better alternatives were theres , still i have kept them , idk why , it would make me better ? idk
 *
 * Enjoy the trauma :p
 */

import type { ASTNode, ParserState } from "@/types/parser";
import type { Token } from "@/types/token";
import { tokenize } from "./tokenizer";

/**
 * CUSTOM ERROR YESSSSSSSSSSIR
 * too smart hahahaaaaaaaaa
 */
class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public file: string,
  ) {
    super(message);
  }
}
export class Parser {
  private state: ParserState;
  private lines: string[];
  constructor(tokens: Token[], source: string) {
    this.state = {
      tokens,
      position: 0,
    };
    this.lines = source.split("\n").map((line) => line.trim());
  }

  /**
   * yes, a sexy error
   * @param message the message to scare user
   */
  private error(message: string): never {
    const token = this.peek();

    // static file name for now, jo hoga dekha jayega
    throw new ParseError(message, token.line, token.column, "program.asm");
  }

  private formatError(e: ParseError) {
    const lineText = this.lines[e.line - 1] ?? "";
    const pointer = " ".repeat(e.column - 1) + "^";

    console.error(`Error: ${e.message}`);
    console.error(` --> ${e.file}:${e.line}:${e.column}`);
    console.error("  |");
    console.error(`${e.line} | ${lineText}`);
    console.error(`  | ${pointer}`);
  }
  // UTILITY functions to make my work easier :p

  /**
   * Use common sense
   * @param state
   * @returns the current token without advancing the position
   */
  private peek(): Token {
    if (this.state.position >= this.state.tokens.length) {
      return {
        type: "EOF",
        value: "",
        line: this.state.tokens[this.state.tokens.length - 1]?.line || 1,
        column: this.state.tokens[this.state.tokens.length - 1]?.column || 1,
      };
    }
    const token = this.state.tokens[this.state.position];
    if (!token) {
      this.error("Token is undefined");
    }
    return token;
  }

  /**
   * Use common sense
   * @param state
   * @returns the next token without advancing the position
   */
  private peekNext(): Token {
    if (this.state.position + 1 >= this.state.tokens.length) {
      return {
        type: "EOF",
        value: "",
        line: this.state.tokens[this.state.tokens.length - 1]?.line || 1,
        column: this.state.tokens[this.state.tokens.length - 1]?.column || 1,
      };
    }
    const token = this.state.tokens[this.state.position + 1];
    if (!token) {
      this.error("Unexpected end of line. ");
    }
    return token;
  }

  /**
   * Use common sense
   * @param state
   * @returns the previous token without advancing the position
   */
  private previous(): Token {
    if (this.state.position - 1 < 0) {
      this.error("Cannot go back past the beginning of tokens");
    }
    const token = this.state.tokens[this.state.position - 1];
    if (!token) {
      this.error("Previous token is undefined");
    }
    return token;
  }

  /**
   * Use common sense
   * @param state
   * @param type the type of token to check for
   * @returns whether the current token is of the given type
   */
  private check(token: Token, type: string): boolean {
    return token.type === type;
  }

  /**
   * Use common sense
   * @param state
   * @returns the new state after advancing a step forward
   */
  private advance(): void {
    if (this.peek().type === "EOF") {
      this.error("Cannot advance past EOF");
    }
    this.state.position += 1;
  }

  /**
   * Use common sense
   * @param state
   * @returns whether the current token is the end of file token
   */
  //   private isAtEnd(): boolean {
  //     const token = this.peek();
  //     if (!token) {
  //       this.error("Unexpected end of line.");
  //     }
  //     return token.type === "EOF";
  //   }

  /**
   * function is only used once lol
   * @param state
   * @returns resets the state back to position 0
   */
  private resetState(): void {
    this.state.position = 0;
  }

  /**
   * This function is used to check if the current token is of any of the given types, and if it is, it advances the position and returns true, otherwise it returns false and does not advance the position.
   * @param state the current state of the parser
   * @param types the types of tokens to check for
   * @returns a tuple of whether the current token is of any of the given types, and the new state after advancing if it is, or the same state if it is not
   */
  //   private match(...types: string[]): boolean {
  //     for (const type of types) {
  //       if (this.check(this.peek(), type)) {
  //         this.advance();
  //         return true;
  //       }
  //     }
  //     return false;
  //   }

  /**
   * This function is used to consume a token of a specific type, and if the current token is not of that type, it throws an error with the given message.
   * @param state the current state of the parser
   * @param type the type of token to consume
   * @param message the error message to throw if the current token is not of the given type
   * @returns a tuple of the consumed token and the new state after advancing
   */
  private consume(type: string, message: string): Token {
    const token = this.peek();

    if (!token) {
      this.error("Unexpected end of line. " + message);
    }
    if (token.type === type) {
      this.advance();
      return token;
    }

    this.error(message);
  }

  // Parsing functions
  private parseLine(): ASTNode {
    let label = null;
    let opcode = "";
    let operand = null;

    let token = this.peek();
    const lineNumber = token.line;
    if (!token) {
      this.error("Unexpected end of line. ");
    }
    // checking if this is a label declaration:
    if (
      this.check(token, "IDENTIFIER") &&
      this.check(this.peekNext(), "COMMA")
    ) {
      label = this.parseLabel();
      // ya this looks dumb but for the future me , this has to be done since we need the newer value in token after consumption
      token = this.peek();
    }

    // checking if this is an instruction:
    if (this.check(token, "OPCODE")) {
      const instructionInfo = this.parseInstruction();
      opcode = instructionInfo.opcode;
      operand = instructionInfo.operand;
      return {
        type: "Instruction",
        label,
        opcode,
        operand,
        indirect: instructionInfo.indirect,
        line: lineNumber,
      };
    }

    // checking if this is data declaration
    else if (this.check(token, "DATATYPE")) {
      if (!label) {
        this.error("Data declaration must have a label");
      }
      const dataInfo = this.parseData();
      return {
        type: "Data",
        label: label,
        datatype: dataInfo.datatype,
        value: dataInfo.value,
        line: lineNumber,
      };
    }

    this.error("chakla koi di baj no bane, jato re pacho tara python uper");
  }

  private parseLabel(): string {
    const name = this.consume(
      "IDENTIFIER",
      "Expected identifier for label declaration",
    ).value;
    this.consume("COMMA", "Expected comma after label");
    return name;
  }

  private parseInstruction(): {
    opcode: string;
    operand: any;
    indirect: boolean;
  } {
    const opcode = this.consume("OPCODE", "Expected opcode").value;
    let operand = null;
    let indirect = false;

    const token = this.peek();
    if (this.check(token, "IDENTIFIER")) {
      operand = this.consume("IDENTIFIER", "Expected identifier operand").value;
    } else if (this.check(token, "NUMBER")) {
      operand = this.consume("NUMBER", "Expected number operand").value;
    }

    // checking for indirect addressing mode
    if (this.check(this.peek(), "INDIRECT")) {
      this.advance();
      indirect = true;
    }

    return { opcode, operand, indirect };
  }

  private parseData(): { datatype: string; value: any } {
    const datatype = this.consume("DATATYPE", "Expected data type").value;
    const value = this.consume(
      "NUMBER",
      "Expected number after data type",
    ).value;

    return { datatype, value };
  }

  /**
   * THE WHOLE POINT OF THE COMPILER!
   * Takes me motivation to make it
   * @param tokens the tokens to parse
   * @returns the AST!
   */
  public parse() {
    const ast = [];

    // making it so that theres an array in which tokens are line wise, so that i can easily parse them:
    // let currentLine: Token[] = [];
    // let lines = [] as Token[][];

    // constructing lines from tokens without isAtEnd because i need to reset the state after this and i dont want to lose the tokens

    // I AM AWARE THAT THIS IS BAD
    // IDEALLY I WOULD USE THE WHOLE SEQUENCE

    // while (this.peek().type !== "EOF") {
    //   const token = this.peek();
    //   if (!token) {
    //     this.error("Unexpected end of line. ");
    //   }
    //   if (token.type === "NEWLINE") {
    //     lines.push(currentLine);
    //     currentLine = [];
    //     this.advance();
    //   } else {
    //     currentLine.push(token);
    //     this.advance();
    //   }
    // }
    // this.resetState();

    // // building the AST, finally:
    // for (const line of lines) {
    //   if (line.length === 0) continue;

    //   this.state = {
    //     tokens: line,
    //     position: 0,
    //   };

    //   ast.push(this.parseLine());
    // }

    // ------------------------------------------

    // NEVERMIND, this is better
    while (this.peek().type !== "EOF") {
      if (this.peek().type === "NEWLINE") {
        this.advance();
        continue;
      }
      try {
        const astNode = this.parseLine();
        ast.push(astNode);
      } catch (e) {
        if (e instanceof ParseError) {
          // again , sexy errrrrrorrrrrrrrrrrrrrrrrrrrrrrrr
          this.formatError(e);
        }
        return;
      }

      if (this.peek().type === "NEWLINE") {
        this.advance();
      }
    }
    return ast;
  }
}

// console.log("-------------------------------");

// console.log(
//   new Parser(
//     tokenize(`
//   LDA A
//   ADD B
//   STA RES
//   A, HEX 0002
//   B, HEX 0005
//   RES, HEX 0000
// `),
//   ).parse(),
// );

// console.log(
//   new Parser(
//     tokenize(`
//   LDA A,
//   ADD B
//   STA RES
//   A, HEX 0002
//   B, HEX 0005
//   RES, HEX 0000
// `),
//   ).parse(),
// );

const code = `
    CLA
    LDA A
    ADD B I
    STA RES
    A, HEX 0002
    B, DEC 0005
    RES, HEX 0000`;
// console.log(new Parser(tokenize(code), code).parse());

// console.log(
//   new Parser([
//     { type: "NEWLINE", value: "\n" },
//     { type: "OPCODE", value: "LDA" },
//     { type: "IDENTIFIER", value: "A" },
//     { type: "NEWLINE", value: "\n" },
//     { type: "OPCODE", value: "ADD" },
//     { type: "IDENTIFIER", value: "B" },
//     { type: "NEWLINE", value: "\n" },
//     { type: "OPCODE", value: "STA" },
//     { type: "IDENTIFIER", value: "RES" },
//     { type: "NEWLINE", value: "\n" },
//     { type: "IDENTIFIER", value: "A" },
//     { type: "COMMA", value: "," },
//     { type: "DATATYPE", value: "HEX" },
//     { type: "NUMBER", value: "0002" },
//     { type: "NEWLINE", value: "\n" },
//     { type: "IDENTIFIER", value: "B" },
//     { type: "COMMA", value: "," },
//     { type: "DATATYPE", value: "HEX" },
//     { type: "NUMBER", value: "0005" },
//     { type: "NEWLINE", value: "\n" },
//     { type: "IDENTIFIER", value: "RES" },
//     { type: "COMMA", value: "," },
//     { type: "DATATYPE", value: "HEX" },
//     { type: "NUMBER", value: "0000" },
//     { type: "NEWLINE", value: "\n" },
//     { type: "NEWLINE", value: "\n" },
//     { type: "EOF", value: "" },
//   ]).parse(),
// );

// OLD and to be honest, potential implementation

// import type { ASTNode, ParserState } from "@/types/parser";
// import type { Token } from "@/types/token";

// // UTILITY functions to make my work easier :p

// /**
//  * Use common sense
//  * @param state
//  * @returns the current token without advancing the position
//  */
// function peek(state: ParserState): Token {
//   return state.tokens[state.position]!;
// }

// /**
//  * Use common sense
//  * @param state
//  * @returns the previous token without advancing the position
//  */
// function previous(state: ParserState): Token {
//   return state.tokens[state.position - 1]!;
// }

// /**
//  * Use common sense
//  * @param state
//  * @param type the type of token to check for
//  * @returns whether the current token is of the given type
//  */
// function check(token: Token, type: string): boolean {
//   return token.type === type;
// }

// /**
//  * Use common sense
//  * @param state
//  * @returns the new state after advancing a step forward
//  */
// function advance(state: ParserState): ParserState {
//   return {
//     ...state,
//     position: state.position + 1,
//   };
// }

// /**
//  * Use common sense
//  * @param state
//  * @returns whether the current token is the end of file token
//  */
// function isAtEnd(state: ParserState): boolean {
//   return peek(state).type === "EOF";
// }

// /**
//  * function is only used once lol
//  * @param state
//  * @returns resets the state back to position 0
//  */
// function resetState(state: ParserState): ParserState {
//   return {
//     ...state,
//     position: 0,
//   };
// }

// /**
//  * This function is used to check if the current token is of any of the given types, and if it is, it advances the position and returns true, otherwise it returns false and does not advance the position.
//  * @param state the current state of the parser
//  * @param types the types of tokens to check for
//  * @returns a tuple of whether the current token is of any of the given types, and the new state after advancing if it is, or the same state if it is not
//  */
// function match(state: ParserState, ...types: string[]): [boolean, ParserState] {
//   for (const type of types) {
//     if (check(peek(state), type)) {
//       return [true, advance(state)];
//     }
//   }
//   return [false, state];
// }

// /**
//  * This function is used to consume a token of a specific type, and if the current token is not of that type, it throws an error with the given message.
//  * @param state the current state of the parser
//  * @param type the type of token to consume
//  * @param message the error message to throw if the current token is not of the given type
//  * @returns a tuple of the consumed token and the new state after advancing
//  */
// function consume(
//   state: ParserState,
//   type: string,
//   message: string,
// ): [Token, ParserState] {
//   if (check(peek(state), type)) {
//     return [peek(state), advance(state)];
//   }
//   this.error(message);
// }

// // Parsing functions

// function parseLine(line: Token[]): ASTNode {
//     let label = null;
//     let astNode: ASTNode = {
//         type: "Instruction",
//         label: null,
//         opcode: "",
//         operand: null,
//     };

//     // checking if this is a label declaration:
//     if (check(line[0]!, "IDENTIFIER") && check(line[1]!, "COLON")) {
//         label = parseLabel(line);
//         line = line.slice(2);
//     }
// }

// function parseLabel(line: Token[]): string {
//     const name = consume(line, "IDENTIFIER", "Expected identifier for label declaration")[0]!.value;
// }
// /**
//  * THE WHOLE POINT OF THE COMPILER!
//  * Takes me motivation to make it
//  * @param tokens the tokens to parse
//  * @returns the AST!
//  */
// function parse(tokens: Token[]) {
//   let state: ParserState = {
//     tokens,
//     position: 0,
//   };

//   let ast = [];

//   // making it so that theres an array in which tokens are line wise, so that i can easily parse them:
//   let currentLine: Token[] = [];
//   let lines = [] as Token[][];
//   while (!isAtEnd(state)) {
//     const token = peek(state);
//     if (token.type === "NEWLINE") {
//       lines.push(currentLine);
//       currentLine = [];
//       state = advance(state);
//     } else {
//       currentLine.push(token);
//       state = advance(state);
//     }
//   }
//   state = resetState(state);

//   // building the AST:
//   for (const line of lines) {
//     if (line.length === 0) continue;
//     ast.push(parseLine(line));
//   }
// }
