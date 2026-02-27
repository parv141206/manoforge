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
function tokenize(input: string) {
  // getting each line of the input:
  const lines = input.split("\n");

  const tokens: Token[] = [];

  // going through each line and tokenizing it:
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber]!.trim();

    const lineTokens = splitTokens(line);

    // this is for empty lines
    if (
      !lineTokens ||
      lineTokens.length === 0 ||
      (lineTokens.length === 1 && lineTokens[0] === "")
    ) {
      tokens.push({ type: "NEWLINE", value: "\n" });
      continue;
    }

    // now going through each part of the line and tokenizing it:
    for (let i = 0; i < lineTokens.length; i++) {
      const token = lineTokens[i]!;
      const upper = token.toUpperCase();

      // the most basic, comma check
      if (token === ",") {
        tokens.push({ type: "COMMA", value: "," });
        continue;
      }

      // checking if its a data type
      if (upper === "DEC" || upper === "HEX") {
        tokens.push({ type: "DATATYPE", value: upper });
        continue;
      }

      // checking if its an instruction
      if (upper in OPCODES) {
        tokens.push({ type: "OPCODE", value: upper });
        continue;
      }

      // if its a number (either decimal or hexadecimal)
      if (/^\d+$/.test(token)) {
        tokens.push({ type: "NUMBER", value: token });
        continue;
      }

      // otherwise its a label
      tokens.push({ type: "IDENTIFIER", value: token });
    }

    tokens.push({ type: "NEWLINE", value: "\n" });
  }

  tokens.push({ type: "EOF", value: "" });

  return tokens;
}
