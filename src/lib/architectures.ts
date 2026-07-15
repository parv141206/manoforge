export type Architecture = "mano" | "8085";

export const architectureForFile = (name: string): Architecture =>
  name.toLowerCase().endsWith(".a85") ? "8085" : "mano";

export const extensionForArchitecture = (architecture: Architecture) =>
  architecture === "8085" ? ".a85" : ".asm";

export const memorySizeForArchitecture = (architecture: Architecture) =>
  architecture === "8085" ? 65536 : 4096;

export const memoryBitsForArchitecture = (architecture: Architecture) =>
  architecture === "8085" ? 8 : 16;
