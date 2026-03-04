import type { Token } from "./token";

/**
 * Represents the state of the parser, including the list of tokens and the current position.
 */
type ParserState = {
  tokens: Token[];
  position: number;
};

/**
 * Making something like this:
 * {
  type: "Program",
  body: [
    { type: "Data", label: "X", datatype: "DEC", value: "10" },
    { type: "Instruction", label: null, opcode: "LDA", operand: "X" },
    { type: "Instruction", label: null, opcode: "HLT", operand: null }
  ]
}
 */
type ASTNode =
  | {
      type: "Program";
      body: ASTNode[];
    }
  | {
      type: "Data";
      label: string;
      datatype: string;
      value: string;
      line: number;
    }
  | {
      type: "Instruction";
      label: string | null;
      opcode: string;
      operand: string | null;
      indirect: boolean;
      line: number;
    }
  | {
      type: "ORG";
      address: number;
      line: number;
    };
