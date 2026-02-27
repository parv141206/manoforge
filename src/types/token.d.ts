/**
 * Defines all the tokens that the lexer can produce.
 * This includes both compound tokens (like whole ass instructions and labels) and raw tokens (like numbers, commas, newlines, and EOF).
 */
export type Token =
  | { type: "IDENTIFIER"; value: string }
  | { type: "NUMBER"; value: string }
  | { type: "OPCODE"; value: string }
  | { type: "DATATYPE"; value: string }
  | { type: "COMMA"; value: "," }
  | { type: "NEWLINE"; value: "\n" }
  | { type: "EOF"; value: "" };
