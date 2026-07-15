"use client";

import { AnimatePresence, motion } from "motion/react";
import { VscClose, VscLinkExternal } from "react-icons/vsc";
import { useThemeStore } from "@/stores/theme-store";

const groups = [
  {
    name: "Data transfer",
    instructions: "MOV MVI LXI LDA STA LHLD SHLD LDAX STAX XCHG",
  },
  {
    name: "Arithmetic",
    instructions: "ADD ADC ADI ACI SUB SBB SUI SBI INR DCR INX DCX DAD DAA",
  },
  {
    name: "Logical",
    instructions: "ANA ANI XRA XRI ORA ORI CMP CPI RLC RRC RAL RAR CMA CMC STC",
  },
  {
    name: "Branch",
    instructions:
      "JMP JNZ JZ JNC JC JPO JPE JP JM CALL CNZ CZ CNC CC CPO CPE CP CM RET RNZ RZ RNC RC RPO RPE RP RM RST PCHL",
  },
  {
    name: "Stack, I/O & control",
    instructions: "PUSH POP XTHL SPHL IN OUT EI DI SIM RIM NOP HLT",
  },
];

const addressing = [
  ["Register", "MOV A,B", "The operand lives in a CPU register."],
  ["Immediate 8-bit", "MVI A,3EH", "The next byte is the operand."],
  ["Immediate 16-bit", "LXI H,2050H", "Low byte is stored before high byte."],
  ["Direct", "LDA 2050H", "The instruction contains a 16-bit address."],
  ["Register indirect", "MOV A,M", "M means the byte at the address in HL."],
  ["I/O direct", "IN 20H", "The next byte selects one of 256 ports."],
];

export function Docs8085({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { colorScheme } = useThemeStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 z-50 flex items-center justify-center sm:inset-8 md:inset-16"
          >
            <div
              className="flex h-full max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl shadow-2xl"
              style={{
                backgroundColor: colorScheme.background,
                border: `1px solid ${colorScheme.border}`,
              }}
            >
              <div
                className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4"
                style={{ borderColor: colorScheme.border }}
              >
                <div>
                  <h2
                    className="text-lg font-bold sm:text-xl"
                    style={{ color: colorScheme.text }}
                  >
                    Intel 8085 Reference
                  </h2>
                  <span
                    className="text-xs"
                    style={{ color: colorScheme.textMuted }}
                  >
                    8-bit data, 16-bit addresses, 64 KB memory
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="rounded p-1.5 transition-colors"
                  style={{ color: colorScheme.textMuted }}
                >
                  <VscClose size={20} />
                </button>
              </div>
              <div className="flex-1 space-y-6 overflow-auto p-3 sm:p-5">
                <div className="grid gap-2 sm:grid-cols-2">
                  {groups.map((group) => (
                    <div
                      key={group.name}
                      className="rounded-lg p-3"
                      style={{
                        backgroundColor: colorScheme.panel,
                        border: `1px solid ${colorScheme.border}`,
                      }}
                    >
                      <h3
                        className="mb-2 text-sm font-semibold"
                        style={{ color: colorScheme.accent }}
                      >
                        {group.name}
                      </h3>
                      <p
                        className="font-mono text-xs leading-6"
                        style={{ color: colorScheme.text }}
                      >
                        {group.instructions}
                      </p>
                    </div>
                  ))}
                </div>
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ border: `1px solid ${colorScheme.border}` }}
                >
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead style={{ backgroundColor: colorScheme.panel }}>
                      <tr>
                        <th
                          className="px-3 py-2"
                          style={{ color: colorScheme.accent }}
                        >
                          Mode
                        </th>
                        <th
                          className="px-3 py-2"
                          style={{ color: colorScheme.accent }}
                        >
                          Example
                        </th>
                        <th
                          className="hidden px-3 py-2 sm:table-cell"
                          style={{ color: colorScheme.accent }}
                        >
                          Meaning
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {addressing.map(([mode, example, meaning]) => (
                        <tr
                          key={mode}
                          style={{
                            borderTop: `1px solid ${colorScheme.border}`,
                          }}
                        >
                          <td
                            className="px-3 py-2"
                            style={{ color: colorScheme.text }}
                          >
                            {mode}
                          </td>
                          <td
                            className="px-3 py-2 font-mono"
                            style={{ color: colorScheme.syntax.number }}
                          >
                            {example}
                          </td>
                          <td
                            className="hidden px-3 py-2 sm:table-cell"
                            style={{ color: colorScheme.textMuted }}
                          >
                            {meaning}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div
                  className="rounded-lg p-4 text-sm"
                  style={{
                    backgroundColor: colorScheme.panel,
                    border: `1px solid ${colorScheme.border}`,
                    color: colorScheme.textMuted,
                  }}
                >
                  Use <code>ORG</code>, <code>DB</code>, <code>DW</code>,{" "}
                  <code>DS</code>, <code>EQU</code>, and <code>END</code>. Hex
                  numbers use the Intel suffix, like <code>2050H</code>. Labels
                  use a colon. Also, M is memory through HL—not a tiny mystery
                  register hiding behind the others.
                </div>
                <a
                  href="/docs/intel_8085_complete_reference.md"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: colorScheme.accent,
                    color: colorScheme.background,
                  }}
                >
                  Open the complete 8085 reference
                  <VscLinkExternal size={14} />
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
