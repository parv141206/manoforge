/**
 * Defines all the tokens that the lexer can produce.
 * This includes both compound tokens (like whole ass instructions and labels) and raw tokens (like numbers, commas, newlines, and EOF).
 */
export type Token =
  | { type: "IDENTIFIER"; value: string; line: number; column: number }
  | { type: "NUMBER"; value: string; line: number; column: number }
  | { type: "OPCODE"; value: string; line: number; column: number }
  | { type: "DATATYPE"; value: string; line: number; column: number }
  | { type: "DIRECTIVE"; value: string; line: number; column: number }
  | { type: "INDIRECT"; value: "I"; line: number; column: number }
  | { type: "COMMA"; value: ","; line: number; column: number }
  | { type: "NEWLINE"; value: "\n"; line: number; column: number }
  | { type: "EOF"; value: ""; line: number; column: number };
