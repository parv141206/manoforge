import {
  encodeInstruction,
  I8085AssemblyError,
  I8085_DIRECTIVES,
  I8085_INSTRUCTIONS,
  instructionSize,
} from "./instruction-set";

type SourceLine = {
  line: number;
  label?: string;
  mnemonic?: string;
  operands: string[];
  source: string;
};

const instructionSet = new Set<string>(I8085_INSTRUCTIONS);
const directiveSet = new Set<string>(I8085_DIRECTIVES);

const splitValues = (value: string) => {
  const values: string[] = [];
  let current = "";
  let quote = "";
  for (const char of value) {
    if ((char === "'" || char === '"') && (!quote || quote === char))
      quote = quote ? "" : char;
    if (char === "," && !quote) {
      values.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) values.push(current.trim());
  return values;
};

const parseLines = (source: string): SourceLine[] =>
  source.split("\n").map((raw, index) => {
    const sourceLine = raw.split(";")[0]?.trim() ?? "";
    if (!sourceLine) return { line: index + 1, operands: [], source: "" };
    let rest = sourceLine;
    let label: string | undefined;
    const colon = /^([A-Za-z_?$@][\w?$@]*):\s*(.*)$/.exec(rest);
    if (colon) {
      label = colon[1]?.toUpperCase();
      rest = colon[2] ?? "";
    }
    const parts = rest.trim().split(/\s+/, 2);
    let mnemonic = parts[0]?.toUpperCase();
    if (
      !label &&
      mnemonic &&
      !instructionSet.has(mnemonic) &&
      !directiveSet.has(mnemonic)
    ) {
      label = mnemonic.replace(/,$/, "");
      rest = rest.slice(parts[0]?.length ?? 0).trim();
      mnemonic = rest.split(/\s+/, 1)[0]?.toUpperCase();
    }
    if (!mnemonic)
      return { line: index + 1, label, operands: [], source: sourceLine };
    const operandText = rest
      .slice(rest.toUpperCase().indexOf(mnemonic) + mnemonic.length)
      .trim();
    return {
      line: index + 1,
      label,
      mnemonic,
      operands: splitValues(operandText),
      source: sourceLine,
    };
  });

const stringBytes = (value: string) => {
  const match = /^(['"])(.*)\1$/.exec(value.trim());
  return match
    ? Array.from(match[2] ?? "", (char) => char.charCodeAt(0) & 0xff)
    : null;
};

export class I8085Assembler {
  symbolTable = new Map<string, number>();
  addressToCode = new Map<number, number>();
  addressToLine = new Map<number, number>();
  addressInfo = new Map<number, { label?: string; instruction?: string }>();
  machineCode: number[] = [];
  startAddress = 0;
  private lines: SourceLine[];

  constructor(private source: string) {
    this.lines = parseLines(source);
  }

  private resolve(
    expression: string,
    location = 0,
    allowUnknown = false,
  ): number {
    const source = expression
      .trim()
      .toUpperCase()
      .replace(/\$/g, String(location));
    const highLow = /^(HIGH|LOW)\s+(.+)$/.exec(source);
    if (highLow) {
      const value = this.resolve(highLow[2] ?? "0", location, allowUnknown);
      return highLow[1] === "HIGH" ? (value >> 8) & 0xff : value & 0xff;
    }
    const terms = source.match(/[+-]?[^+-]+/g) ?? [];
    let total = 0;
    for (const rawTerm of terms) {
      const sign = rawTerm.startsWith("-") ? -1 : 1;
      const term = rawTerm.replace(/^[+-]/, "").trim();
      let value: number | undefined;
      if (/^0X[0-9A-F]+$/.test(term)) value = parseInt(term.slice(2), 16);
      else if (/^[0-9][0-9A-F]*H$/.test(term))
        value = parseInt(term.slice(0, -1), 16);
      else if (/^[01]+B$/.test(term)) value = parseInt(term.slice(0, -1), 2);
      else if (/^[0-7]+[OQ]$/.test(term))
        value = parseInt(term.slice(0, -1), 8);
      else if (/^\d+D?$/.test(term))
        value = parseInt(term.replace(/D$/, ""), 10);
      else if (/^'.'$/.test(term)) value = term.charCodeAt(1);
      else value = this.symbolTable.get(term);
      if (value === undefined) {
        if (allowUnknown) value = 0;
        else throw new Error(`Undefined symbol: ${term}`);
      }
      total += sign * value;
    }
    return total;
  }

  private dataSize(node: SourceLine, location: number) {
    if (node.mnemonic === "DB")
      return node.operands.reduce(
        (sum, value) => sum + (stringBytes(value)?.length ?? 1),
        0,
      );
    if (node.mnemonic === "DW") return node.operands.length * 2;
    if (node.mnemonic === "DS")
      return this.resolve(node.operands[0] ?? "0", location, true);
    return instructionSize(node.mnemonic ?? "");
  }

  assemble() {
    let location = 0;
    let hasStart = false;
    for (const node of this.lines) {
      if (!node.mnemonic) continue;
      if (node.mnemonic === "END") break;
      if (node.mnemonic === "ORG") {
        location = this.resolve(node.operands[0] ?? "0", location, true);
        if (!hasStart) {
          this.startAddress = location;
          hasStart = true;
        }
        continue;
      }
      if (node.mnemonic === "EQU" || node.mnemonic === "SET") {
        if (!node.label)
          throw new I8085AssemblyError(
            `${node.mnemonic} requires a symbol`,
            node.line,
          );
        this.symbolTable.set(
          node.label,
          this.resolve(node.operands[0] ?? "0", location, true),
        );
        continue;
      }
      if (node.label) {
        if (this.symbolTable.has(node.label))
          throw new I8085AssemblyError(
            `Duplicate symbol: ${node.label}`,
            node.line,
          );
        this.symbolTable.set(node.label, location);
      }
      if (!hasStart) {
        this.startAddress = location;
        hasStart = true;
      }
      location += this.dataSize(node, location);
      if (location > 65536)
        throw new I8085AssemblyError(
          "Program exceeds 8085 address space",
          node.line,
        );
    }

    location = 0;
    for (const node of this.lines) {
      if (!node.mnemonic) continue;
      if (node.mnemonic === "END") {
        if (node.operands[0])
          this.startAddress = this.resolve(node.operands[0], location);
        break;
      }
      if (node.mnemonic === "ORG") {
        location = this.resolve(node.operands[0] ?? "0", location);
        continue;
      }
      if (node.mnemonic === "EQU" || node.mnemonic === "SET") continue;
      let bytes: number[] = [];
      try {
        if (node.mnemonic === "DB") {
          bytes = node.operands.flatMap(
            (value) =>
              stringBytes(value) ?? [this.resolve(value, location) & 0xff],
          );
        } else if (node.mnemonic === "DW") {
          bytes = node.operands.flatMap((value) => {
            const word = this.resolve(value, location) & 0xffff;
            return [word & 0xff, word >> 8];
          });
        } else if (node.mnemonic === "DS") {
          bytes = new Array(
            this.resolve(node.operands[0] ?? "0", location),
          ).fill(0) as number[];
        } else {
          bytes = encodeInstruction(
            node.mnemonic,
            node.operands,
            node.line,
            (value) => this.resolve(value, location),
          );
        }
      } catch (error) {
        if (error instanceof I8085AssemblyError) throw error;
        throw new I8085AssemblyError(
          error instanceof Error ? error.message : "Assembly failed",
          node.line,
        );
      }
      bytes.forEach((byte, offset) => {
        const address = location + offset;
        this.addressToCode.set(address, byte);
        this.addressToLine.set(address, node.line - 1);
        this.addressInfo.set(address, {
          label: offset === 0 ? node.label : undefined,
          instruction: offset === 0 ? node.source : undefined,
        });
        this.machineCode.push(byte);
      });
      location += bytes.length;
    }
    return this.machineCode;
  }
}
