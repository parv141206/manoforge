/**
 * @file This file is responsible for taking the raw input from the user and converting it into an array of tokens that the parser can use to create the AST.
 * @author parv141206
 *
 * ITS NOT VIBE CODED and IS FULLY HANDMADE, improvements are welcomed!
 */

import { OPCODES } from "@/constants/opcodes";
import type { Token } from "@/types/token";

/**
 * This basically splits a line into tokens, separating by spaces and commas. It also handles multiple spaces and tabs correctly.
 * @param line the current line to split
 * @returns the token!
 */
function splitTokens(line: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === " " || char === "\t") {
      if (current !== "") {
        tokens.push(current);
        current = "";
      }
    } else if (char === ",") {
      if (current !== "") {
        tokens.push(current);
        current = "";
      }
      tokens.push(",");
    } else {
      current += char;
    }
  }

  if (current !== "") {
    tokens.push(current);
  }

  return tokens;
}

/**
 * This function takes the raw input from the user and basically creates an array of tokens that the parser can use to create the AST.
 * Ideally i would have used some library but nevermind, manual labour works for this.
 * @param input The literal raw input of the user
 */
export function tokenize(input: string) {
  const lines = input.split("\n");

  const tokens: Token[] = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    let line = lines[lineNumber]!;

    const commentIndex = line.indexOf(";");
    if (commentIndex !== -1) {
      line = line.slice(0, commentIndex);
    }

    line = line.trim();

    const lineTokens = splitTokens(line);

    // this is for empty lines
    if (
      !lineTokens ||
      lineTokens.length === 0 ||
      (lineTokens.length === 1 && lineTokens[0] === "")
    ) {
      tokens.push({
        type: "NEWLINE",
        value: "\n",
        line: lineNumber + 1,
        column: 1,
      });
      continue;
    }

    // now going through each part of the line and tokenizing it:
    for (let i = 0; i < lineTokens.length; i++) {
      const token = lineTokens[i]!;
      const upper = token.toUpperCase();

      // the most basic, comma check
      if (token === ",") {
        tokens.push({
          type: "COMMA",
          value: ",",
          line: lineNumber + 1,
          column: i + 1,
        });
        continue;
      }

      // checking if its a data type
      if (upper === "DEC" || upper === "HEX") {
        tokens.push({
          type: "DATATYPE",
          value: upper,
          line: lineNumber + 1,
          column: i + 1,
        });
        continue;
      }

      // checking if its a directive (END, ORG)
      if (upper === "END" || upper === "ORG") {
        tokens.push({
          type: "DIRECTIVE",
          value: upper,
          line: lineNumber + 1,
          column: i + 1,
        });
        continue;
      }

      // checking if its indirect addressing mode
      if (upper === "I") {
        tokens.push({
          type: "INDIRECT",
          value: "I",
          line: lineNumber + 1,
          column: i + 1,
        });
        continue;
      }

      // checking if its an instruction
      if (upper in OPCODES) {
        tokens.push({
          type: "OPCODE",
          value: upper,
          line: lineNumber + 1,
          column: i + 1,
        });
        continue;
      }

      // if its a number (either decimal or hexadecimal)
      if (/^-?\d+$/.test(token)) {
        tokens.push({
          type: "NUMBER",
          value: token,
          line: lineNumber + 1,
          column: i + 1,
        });
        continue;
      }

      // otherwise its a label
      tokens.push({
        type: "IDENTIFIER",
        value: token,
        line: lineNumber + 1,
        column: i + 1,
      });
    }

    tokens.push({
      type: "NEWLINE",
      value: "\n",
      line: lineNumber + 1,
      column: 1,
    });
  }

  tokens.push({ type: "EOF", value: "", line: lines.length + 1, column: 1 });

  return tokens;
}

// console.log(
//   tokenize(`
//   LDA A
//   ADD B
//   STA RES
//   A, HEX 0002
//   B, HEX 0005
//   RES, HEX 0000
// `),
// );

// console.log(
//   tokenize(`
//   LBL, LDA A
//   ADD B
//   STA RES
//   BUN LBL
//   A, HEX 0002
//   B, HEX 0005
//   RES, HEX 0000
// `),
// );

// console.log(
//   tokenize(`
//     CLA
//     LDA A
//     ADD B
//     STA RES
//     A, HEX 0002
//     B, DEC 0005
//     RES, HEX 0000
// `),
// );
