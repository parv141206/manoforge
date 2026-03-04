"use client";

import { motion, AnimatePresence } from "motion/react";
import { useThemeStore } from "@/stores/theme-store";
import { VscClose } from "react-icons/vsc";
import { useState } from "react";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "memory" | "register" | "io";

const memoryInstructions = [
  {
    mnemonic: "AND",
    opcode: "0xxx / 8xxx",
    description: "AND memory word to AC",
    operation: "AC <- AC ∧ M[effective address]",
  },
  {
    mnemonic: "ADD",
    opcode: "1xxx / 9xxx",
    description: "Add memory word to AC",
    operation: "AC <- AC + M[effective address], E <- carry",
  },
  {
    mnemonic: "LDA",
    opcode: "2xxx / Axxx",
    description: "Load AC from memory",
    operation: "AC <- M[effective address]",
  },
  {
    mnemonic: "STA",
    opcode: "3xxx / Bxxx",
    description: "Store AC to memory",
    operation: "M[effective address] <- AC",
  },
  {
    mnemonic: "BUN",
    opcode: "4xxx / Cxxx",
    description: "Branch unconditionally",
    operation: "PC <- effective address",
  },
  {
    mnemonic: "BSA",
    opcode: "5xxx / Dxxx",
    description: "Branch and save return address",
    operation: "M[effective address] <- PC, PC <- effective address + 1",
  },
  {
    mnemonic: "ISZ",
    opcode: "6xxx / Exxx",
    description: "Increment and skip if zero",
    operation:
      "M[effective address] <- M[effective address] + 1; if result = 0 then PC <- PC + 1",
  },
];

const registerInstructions = [
  {
    mnemonic: "CLA",
    opcode: "7800",
    description: "Clear AC",
    operation: "AC <- 0",
  },
  {
    mnemonic: "CLE",
    opcode: "7400",
    description: "Clear E (carry flag)",
    operation: "E <- 0",
  },
  {
    mnemonic: "CMA",
    opcode: "7200",
    description: "Complement AC",
    operation: "AC <- AC'",
  },
  {
    mnemonic: "CME",
    opcode: "7100",
    description: "Complement E",
    operation: "E <- E'",
  },
  {
    mnemonic: "CIR",
    opcode: "7080",
    description: "Circulate right AC and E",
    operation: "AC <- shr AC, AC(15) <- E, E <- AC(0)",
  },
  {
    mnemonic: "CIL",
    opcode: "7040",
    description: "Circulate left AC and E",
    operation: "AC <- shl AC, AC(0) <- E, E <- AC(15)",
  },
  {
    mnemonic: "INC",
    opcode: "7020",
    description: "Increment AC",
    operation: "AC <- AC + 1",
  },
  {
    mnemonic: "SPA",
    opcode: "7010",
    description: "Skip if positive AC",
    operation: "if AC(15) = 0 then PC <- PC + 1",
  },
  {
    mnemonic: "SNA",
    opcode: "7008",
    description: "Skip if negative AC",
    operation: "if AC(15) = 1 then PC <- PC + 1",
  },
  {
    mnemonic: "SZA",
    opcode: "7004",
    description: "Skip if AC is zero",
    operation: "if AC = 0 then PC <- PC + 1",
  },
  {
    mnemonic: "SZE",
    opcode: "7002",
    description: "Skip if E is zero",
    operation: "if E = 0 then PC <- PC + 1",
  },
  {
    mnemonic: "HLT",
    opcode: "7001",
    description: "Halt computer",
    operation: "S <- 0 (stop execution)",
  },
];

const ioInstructions = [
  {
    mnemonic: "INP",
    opcode: "F800",
    description: "Input character to AC",
    operation: "AC(0-7) <- INPR, FGI <- 0",
  },
  {
    mnemonic: "OUT",
    opcode: "F400",
    description: "Output character from AC",
    operation: "OUTR <- AC(0-7), FGO <- 0",
  },
  {
    mnemonic: "SKI",
    opcode: "F200",
    description: "Skip if input flag",
    operation: "if FGI = 1 then PC <- PC + 1",
  },
  {
    mnemonic: "SKO",
    opcode: "F100",
    description: "Skip if output flag",
    operation: "if FGO = 1 then PC <- PC + 1",
  },
  {
    mnemonic: "ION",
    opcode: "F080",
    description: "Interrupt on",
    operation: "IEN <- 1",
  },
  {
    mnemonic: "IOF",
    opcode: "F040",
    description: "Interrupt off",
    operation: "IEN <- 0",
  },
];

const directives = [
  { mnemonic: "ORG", description: "Set origin address for assembly" },
  { mnemonic: "END", description: "End of assembly" },
  { mnemonic: "DEC", description: "Decimal constant" },
  { mnemonic: "HEX", description: "Hexadecimal constant" },
];

export function DocsModal({ isOpen, onClose }: DocsModalProps) {
  const { colorScheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState<TabType>("memory");

  const tabs: { key: TabType; label: string }[] = [
    { key: "memory", label: "Memory Reference" },
    { key: "register", label: "Register Reference" },
    { key: "io", label: "I/O Instructions" },
  ];

  const getInstructions = () => {
    switch (activeTab) {
      case "memory":
        return memoryInstructions;
      case "register":
        return registerInstructions;
      case "io":
        return ioInstructions;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-4 z-50 flex items-center justify-center sm:inset-8 md:inset-16"
          >
            <div
              className="relative flex h-full max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl shadow-2xl"
              style={{
                backgroundColor: colorScheme.background,
                border: `1px solid ${colorScheme.border}`,
              }}
            >
              <div
                className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4"
                style={{ borderColor: colorScheme.border }}
              >
                <h2
                  className="text-lg font-bold sm:text-xl"
                  style={{ color: colorScheme.text }}
                >
                  Mano Computer Reference
                </h2>
                <button
                  onClick={onClose}
                  className="rounded p-1.5 transition-colors"
                  style={{ color: colorScheme.textMuted }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = colorScheme.hover)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <VscClose size={20} />
                </button>
              </div>

              <div
                className="flex gap-1 overflow-x-auto border-b px-2 py-2 sm:px-4"
                style={{ borderColor: colorScheme.border }}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="shrink-0 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm"
                    style={{
                      backgroundColor:
                        activeTab === tab.key
                          ? colorScheme.accent
                          : "transparent",
                      color:
                        activeTab === tab.key ? "#fff" : colorScheme.textMuted,
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== tab.key) {
                        e.currentTarget.style.backgroundColor =
                          colorScheme.hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== tab.key) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto p-2 sm:p-4">
                <div
                  className="mb-6 overflow-hidden rounded-lg"
                  style={{ border: `1px solid ${colorScheme.border}` }}
                >
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr style={{ backgroundColor: colorScheme.panel }}>
                        <th
                          className="px-2 py-2 font-semibold sm:px-4 sm:py-3"
                          style={{ color: colorScheme.accent }}
                        >
                          Mnemonic
                        </th>
                        <th
                          className="px-2 py-2 font-semibold sm:px-4 sm:py-3"
                          style={{ color: colorScheme.accent }}
                        >
                          Opcode
                        </th>
                        <th
                          className="hidden px-2 py-2 font-semibold sm:table-cell sm:px-4 sm:py-3"
                          style={{ color: colorScheme.accent }}
                        >
                          Description
                        </th>
                        <th
                          className="hidden px-2 py-2 font-semibold sm:px-4 sm:py-3 md:table-cell"
                          style={{ color: colorScheme.accent }}
                        >
                          Operation
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getInstructions().map((inst, idx) => (
                        <tr
                          key={inst.mnemonic}
                          style={{
                            backgroundColor:
                              idx % 2 === 0 ? "transparent" : colorScheme.panel,
                            borderTop: `1px solid ${colorScheme.border}`,
                          }}
                        >
                          <td
                            className="px-2 py-2 font-mono font-bold sm:px-4 sm:py-3"
                            style={{ color: colorScheme.syntax.keyword }}
                          >
                            {inst.mnemonic}
                          </td>
                          <td
                            className="px-2 py-2 font-mono sm:px-4 sm:py-3"
                            style={{ color: colorScheme.syntax.number }}
                          >
                            {inst.opcode}
                          </td>
                          <td
                            className="hidden px-2 py-2 sm:table-cell sm:px-4 sm:py-3"
                            style={{ color: colorScheme.text }}
                          >
                            {inst.description}
                          </td>
                          <td
                            className="hidden px-2 py-2 font-mono text-xs sm:px-4 sm:py-3 md:table-cell"
                            style={{ color: colorScheme.syntax.label }}
                          >
                            {inst.operation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2 sm:hidden">
                  {getInstructions().map((inst) => (
                    <div
                      key={inst.mnemonic}
                      className="rounded-lg p-3"
                      style={{
                        backgroundColor: colorScheme.panel,
                        border: `1px solid ${colorScheme.border}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="font-mono font-bold"
                          style={{ color: colorScheme.syntax.keyword }}
                        >
                          {inst.mnemonic}
                        </span>
                        <span
                          className="font-mono text-xs"
                          style={{ color: colorScheme.syntax.number }}
                        >
                          {inst.opcode}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-xs"
                        style={{ color: colorScheme.textMuted }}
                      >
                        {inst.description}
                      </p>
                      <p
                        className="mt-1 font-mono text-xs"
                        style={{ color: colorScheme.syntax.label }}
                      >
                        {inst.operation}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h3
                    className="mb-3 text-sm font-semibold sm:text-base"
                    style={{ color: colorScheme.text }}
                  >
                    Assembler Directives
                  </h3>
                  <div
                    className="overflow-hidden rounded-lg"
                    style={{ border: `1px solid ${colorScheme.border}` }}
                  >
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr style={{ backgroundColor: colorScheme.panel }}>
                          <th
                            className="px-2 py-2 font-semibold sm:px-4 sm:py-3"
                            style={{ color: colorScheme.accent }}
                          >
                            Directive
                          </th>
                          <th
                            className="px-2 py-2 font-semibold sm:px-4 sm:py-3"
                            style={{ color: colorScheme.accent }}
                          >
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {directives.map((dir, idx) => (
                          <tr
                            key={dir.mnemonic}
                            style={{
                              backgroundColor:
                                idx % 2 === 0
                                  ? "transparent"
                                  : colorScheme.panel,
                              borderTop: `1px solid ${colorScheme.border}`,
                            }}
                          >
                            <td
                              className="px-2 py-2 font-mono font-bold sm:px-4 sm:py-3"
                              style={{ color: colorScheme.syntax.keyword }}
                            >
                              {dir.mnemonic}
                            </td>
                            <td
                              className="px-2 py-2 sm:px-4 sm:py-3"
                              style={{ color: colorScheme.text }}
                            >
                              {dir.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6">
                  <h3
                    className="mb-3 text-sm font-semibold sm:text-base"
                    style={{ color: colorScheme.text }}
                  >
                    Addressing Modes
                  </h3>
                  <div
                    className="space-y-2 rounded-lg p-3 text-xs sm:p-4 sm:text-sm"
                    style={{
                      backgroundColor: colorScheme.panel,
                      border: `1px solid ${colorScheme.border}`,
                    }}
                  >
                    <div className="flex gap-2">
                      <span
                        className="font-mono font-bold"
                        style={{ color: colorScheme.syntax.keyword }}
                      >
                        Direct:
                      </span>
                      <span style={{ color: colorScheme.text }}>
                        <code
                          className="rounded px-1"
                          style={{ backgroundColor: colorScheme.hover }}
                        >
                          LDA 100
                        </code>{" "}
                        — Address 100 contains the operand
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className="font-mono font-bold"
                        style={{ color: colorScheme.syntax.keyword }}
                      >
                        Indirect:
                      </span>
                      <span style={{ color: colorScheme.text }}>
                        <code
                          className="rounded px-1"
                          style={{ backgroundColor: colorScheme.hover }}
                        >
                          LDA 100 I
                        </code>{" "}
                        — Address 100 contains a pointer to the operand
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h3
                    className="mb-3 text-sm font-semibold sm:text-base"
                    style={{ color: colorScheme.text }}
                  >
                    Quick Tips
                  </h3>
                  <ul
                    className="list-inside list-disc space-y-1 rounded-lg p-3 text-xs sm:p-4 sm:text-sm"
                    style={{
                      backgroundColor: colorScheme.panel,
                      border: `1px solid ${colorScheme.border}`,
                      color: colorScheme.textMuted,
                    }}
                  >
                    <li>
                      Labels must end with a comma (e.g.,{" "}
                      <code
                        className="rounded px-1"
                        style={{ backgroundColor: colorScheme.hover }}
                      >
                        LOOP,
                      </code>
                      )
                    </li>
                    <li>
                      Use{" "}
                      <code
                        className="rounded px-1"
                        style={{ backgroundColor: colorScheme.hover }}
                      >
                        I
                      </code>{" "}
                      suffix for indirect addressing
                    </li>
                    <li>
                      Comments start with{" "}
                      <code
                        className="rounded px-1"
                        style={{ backgroundColor: colorScheme.hover }}
                      >
                        /
                      </code>
                    </li>
                    <li>
                      Press{" "}
                      <code
                        className="rounded px-1"
                        style={{ backgroundColor: colorScheme.hover }}
                      >
                        Ctrl+Shift+F
                      </code>{" "}
                      to format code
                    </li>
                    <li>
                      Press{" "}
                      <code
                        className="rounded px-1"
                        style={{ backgroundColor: colorScheme.hover }}
                      >
                        Tab
                      </code>{" "}
                      for autocomplete suggestions
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default DocsModal;
