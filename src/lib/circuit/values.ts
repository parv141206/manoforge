import type { Bit, LogicValue } from "./types";

export const clampWidth = (width: unknown, fallback = 1) => {
  const n =
    typeof width === "number" && Number.isFinite(width) ? width : fallback;
  return Math.min(32, Math.max(1, Math.trunc(n)));
};

export const maskForWidth = (width: number) =>
  width >= 32 ? 0xffffffff : (1 << width) - 1;

export const valueKey = (componentId: string, portId: string) =>
  `${componentId}.${portId}`;

export const makeValue = (bits: Bit[]): LogicValue => ({ bits });

export const unknownValue = (width: number): LogicValue =>
  makeValue(Array.from({ length: clampWidth(width) }, () => "X"));

export const highZValue = (width: number): LogicValue =>
  makeValue(Array.from({ length: clampWidth(width) }, () => "Z"));

export const zeroValue = (width: number): LogicValue =>
  makeValue(Array.from({ length: clampWidth(width) }, () => 0));

export const oneValue = (width: number): LogicValue =>
  fromNumber(1, clampWidth(width));

export const normalizeValue = (
  value: LogicValue | undefined,
  width: number,
) => {
  const targetWidth = clampWidth(width);
  if (!value) return unknownValue(targetWidth);
  const bits = value.bits.slice(0, targetWidth);
  while (bits.length < targetWidth) bits.push(0);
  return makeValue(bits);
};

export const fromNumber = (value: number, width: number): LogicValue => {
  const targetWidth = clampWidth(width);
  const mask = maskForWidth(targetWidth);
  const n = Math.trunc(value) & mask;
  return makeValue(
    Array.from(
      { length: targetWidth },
      (_, index) => ((n >> index) & 1) as Bit,
    ),
  );
};

export const toNumber = (value: LogicValue | undefined) => {
  if (!value) return null;
  let n = 0;
  for (let i = 0; i < value.bits.length; i += 1) {
    const bit = value.bits[i];
    if (bit !== 0 && bit !== 1) return null;
    if (bit === 1) n |= 1 << i;
  }
  return n >>> 0;
};

export const valuesEqual = (
  a: LogicValue | undefined,
  b: LogicValue | undefined,
) => {
  if (!a || !b || a.bits.length !== b.bits.length) return false;
  return a.bits.every((bit, index) => bit === b.bits[index]);
};

export const displayValue = (value: LogicValue | undefined) => {
  if (!value) return "X";
  if (value.bits.length === 1) return String(value.bits[0]);
  const numeric = toNumber(value);
  if (numeric === null) return value.bits.slice().reverse().join("");
  const hexWidth = Math.max(1, Math.ceil(value.bits.length / 4));
  return `0x${numeric.toString(16).toUpperCase().padStart(hexWidth, "0")}`;
};

const mapBinary = (
  a: LogicValue | undefined,
  b: LogicValue | undefined,
  width: number,
  fn: (left: Bit, right: Bit) => Bit,
) => {
  const left = normalizeValue(a, width);
  const right = normalizeValue(b, width);
  return makeValue(
    left.bits.map((bit, index) => fn(bit, right.bits[index] ?? "X")),
  );
};

const invertBit = (bit: Bit): Bit => {
  if (bit === 0) return 1;
  if (bit === 1) return 0;
  return "X";
};

export const notValue = (value: LogicValue | undefined, width: number) =>
  makeValue(normalizeValue(value, width).bits.map(invertBit));

export const andValue = (
  a: LogicValue | undefined,
  b: LogicValue | undefined,
  width: number,
) =>
  mapBinary(a, b, width, (left, right) => {
    if (left === 0 || right === 0) return 0;
    if (left === 1 && right === 1) return 1;
    return "X";
  });

export const orValue = (
  a: LogicValue | undefined,
  b: LogicValue | undefined,
  width: number,
) =>
  mapBinary(a, b, width, (left, right) => {
    if (left === 1 || right === 1) return 1;
    if (left === 0 && right === 0) return 0;
    return "X";
  });

export const xorValue = (
  a: LogicValue | undefined,
  b: LogicValue | undefined,
  width: number,
) =>
  mapBinary(a, b, width, (left, right) => {
    if ((left === 0 || left === 1) && (right === 0 || right === 1)) {
      return (left ^ right) as Bit;
    }
    return "X";
  });

export const resizeValue = (
  value: LogicValue | undefined,
  width: number,
  mode: "zero" | "sign" = "zero",
) => {
  const targetWidth = clampWidth(width);
  const source = value ?? zeroValue(1);
  const fill =
    mode === "sign" && source.bits[source.bits.length - 1] === 1 ? 1 : 0;
  const bits = source.bits.slice(0, targetWidth);
  while (bits.length < targetWidth) bits.push(fill);
  return makeValue(bits);
};

export const valueToBoolean = (value: LogicValue | undefined) =>
  toNumber(value) === 1;
