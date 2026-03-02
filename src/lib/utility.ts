/**
 * Utility functions for hex/decimal/string conversions
 * Used throughout the Mano Forge system
 */

/**
 * Converts a hex string to a number
 * @param hex the hex string to convert
 * @returns the number
 */
export function hexToNum(hex: string): number {
  return parseInt(hex, 16);
}

/**
 * Converts a decimal string to a number
 * @param dec the decimal string to convert
 * @returns the number
 */
export function decToNum(dec: string): number {
  return parseInt(dec, 10);
}

/**
 * Converts a number to a hex string with specified padding
 * @param num the number to convert
 * @param padLength the length to pad to (default 4)
 * @returns the uppercase hex string
 */
export function numToHex(num: number, padLength: number = 4): string {
  if (num < 0) {
    num = (1 << (padLength * 4)) + num;
  }
  return num.toString(16).padStart(padLength, "0").toUpperCase();
}

/**
 * Parses a value string based on the datatype (HEX or DEC)
 * @param value the value string to parse
 * @param datatype either "HEX" or "DEC"
 * @returns the number
 */
export function parseValueByDatatype(value: string, datatype: string): number {
  return parseInt(value, datatype === "HEX" ? 16 : 10);
}
