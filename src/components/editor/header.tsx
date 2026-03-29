"use client";

import { useState, useRef, useEffect } from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import { useUiStore } from "@/stores/ui-store";
import {
  VscDebugStart,
  VscDebugStepOver,
  VscDebugRestart,
  VscSettingsGear,
  VscDebugPause,
  VscBook,
} from "react-icons/vsc";
import { TbAssembly } from "react-icons/tb";
import { DocsModal } from "./docs-modal";
import { ThemeModal } from "./theme-modal";
import { Parser } from "@/lib/parser";
import { Assembler } from "@/lib/assembler";
import { tokenize } from "@/lib/tokenizer";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function Header() {
  const {
    files,
    activeFileId,
    execution,
    setDelay,
    setRunning,
    setAssembled,
    setCurrentLine,
    setMachineCode,
    setAddressToLine,
    setAddressInfo,
    setMemoryWord,
    setRegister,
    addNotation,
    clearNotations,
    resetExecution,
  } = useFileStore();

  const { colorScheme } = useThemeStore();
  const { layoutMode, executionLogMode } = useUiStore();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const executorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isExecutingRef = useRef(false);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    const intervalId = executorRef.current;
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const activeFile = files.find((f) => f.id === activeFileId);

  const emitAssembleError = (error: unknown) => {
    const fallback = error instanceof Error ? error.message : "Assembly failed";
    addNotation(`Error: ${fallback}`);

    const maybe = error as {
      message?: string;
      line?: number;
      column?: number;
      file?: string;
    };

    if (typeof maybe.line !== "number" || typeof maybe.column !== "number") {
      return;
    }

    const source = activeFile?.content ?? "";
    const lines = source.split("\n");
    const lineText = lines[maybe.line - 1] ?? "";
    const pointer = " ".repeat(Math.max(0, maybe.column - 1)) + "^";

    addNotation(
      ` --> ${maybe.file ?? activeFile?.name ?? "program.asm"}:${maybe.line}:${maybe.column}`,
    );
    addNotation("  |");
    addNotation(`${maybe.line} | ${lineText}`);
    addNotation(`  | ${pointer}`);
  };

  const handleAssemble = () => {
    if (!activeFile) return;

    try {
      clearNotations();
      const tokens = tokenize(activeFile.content);
      const parser = new Parser(tokens, activeFile.content);
      const ast = parser.parse();

      if (!ast || ast.length === 0) {
        addNotation("Error: No valid code to assemble");
        return;
      }

      const assembler = new Assembler(ast);
      const machineCodeStrings = assembler.assemble();

      const addressToLineRecord: Record<number, number> = {};
      assembler.addressToLine.forEach((line, addr) => {
        addressToLineRecord[addr] = line;
      });
      setAddressToLine(addressToLineRecord);

      const addressInfoRecord: Record<
        number,
        { label?: string; instruction?: string }
      > = {};
      assembler.addressInfo.forEach((info, addr) => {
        addressInfoRecord[addr] = info;
      });
      setAddressInfo(addressInfoRecord);

      assembler.addressToCode.forEach((code, address) => {
        const value = parseInt(code, 16);
        if (!isNaN(value)) {
          setMemoryWord(address, value);
        }
      });

      const codeLines: string[] = [];
      assembler.addressToCode.forEach((code, addr) => {
        codeLines.push(
          `${addr.toString(16).toUpperCase().padStart(3, "0")}: ${code}`,
        );
      });

      setMachineCode(codeLines);
      setAssembled(true);
      setRegister("PC", assembler.startAddress);
      setCurrentLine(null);
      addNotation(`Assembled successfully: ${machineCodeStrings.length} words`);
    } catch (error) {
      emitAssembleError(error);
      setAssembled(false);
    }
  };

  const toHex = (n: number, pad = 4) =>
    n.toString(16).toUpperCase().padStart(pad, "0");

  const memoryInstructionNames = [
    "AND",
    "ADD",
    "LDA",
    "STA",
    "BUN",
    "BSA",
    "ISZ",
  ] as const;

  const getRegisterInstructionNames = (ir: number) => {
    const bit = ir & 0xfff;
    const names: string[] = [];
    if (bit & 0x800) names.push("CLA");
    if (bit & 0x400) names.push("CLE");
    if (bit & 0x200) names.push("CMA");
    if (bit & 0x100) names.push("CME");
    if (bit & 0x080) names.push("CIR");
    if (bit & 0x040) names.push("CIL");
    if (bit & 0x020) names.push("INC");
    if (bit & 0x010) names.push("SPA");
    if (bit & 0x008) names.push("SNA");
    if (bit & 0x004) names.push("SZA");
    if (bit & 0x002) names.push("SZE");
    return names;
  };

  const executeStep = async (delay = 0): Promise<boolean> => {
    const detailedMode = executionLogMode === "detailed";

    const note = async (msg: string) => {
      if (detailedMode) {
        addNotation(msg);
        if (delay > 0) await sleep(delay);
      }
      if (stopRequestedRef.current) return false;
      return true;
    };

    const noteInstruction = async (msg: string) => {
      addNotation(msg);
      if (delay > 0) await sleep(delay);
      if (stopRequestedRef.current) return false;
      return true;
    };

    try {
      const state = useFileStore.getState();
      const pc = state.registers.PC;

      if (pc >= 4096) {
        addNotation("Error: PC out of bounds");
        return false;
      }

      setCurrentLine(pc);

      if (!(await note(`T0: AR <- PC (${toHex(pc, 3)})`))) return false;
      setRegister("AR", pc);

      const ir = state.memory[pc] ?? 0;
      if (
        !(await note(
          `T1: IR <- M[AR] (${toHex(ir)}), PC <- PC + 1 (${toHex(pc + 1, 3)})`,
        ))
      )
        return false;
      setRegister("IR", ir);

      if (ir === 0x7001 || ir === 0) {
        setRunning(false);
        addNotation("HLT: Execution halted");
        if (detailedMode) {
          addNotation("────────────────────");
        }
        return false;
      }

      const opcode = (ir >> 12) & 0x7;
      const indirect = (ir >> 15) & 1;
      const address = ir & 0xfff;

      if (
        !(await note(
          `T2: Decode IR: opcode=${opcode}, addr=${toHex(address, 3)}, I=${indirect}`,
        ))
      )
        return false;

      let effectiveAddress = address;
      if (indirect && opcode < 7) {
        if (
          !(await note(
            `T3: Indirect: AR <- M[${toHex(address, 3)}] (${toHex(state.memory[address] ?? 0, 3)})`,
          ))
        )
          return false;
        effectiveAddress = state.memory[address] ?? 0;
      } else if (opcode < 7) {
        if (!(await note(`T3: Direct: AR = ${toHex(address, 3)}`)))
          return false;
      }

      setRegister("AR", effectiveAddress);

      if (opcode < 7) {
        const drValue = state.memory[effectiveAddress] ?? 0;
        if (
          !(await note(
            `T4: DR <- M[${toHex(effectiveAddress, 3)}] (${toHex(drValue)})`,
          ))
        )
          return false;
        setRegister("DR", drValue);
      }

      let instructionLogged = false;

      switch (opcode) {
        case 0: {
          const operand = state.memory[effectiveAddress] ?? 0;
          setRegister("AC", state.registers.AC & operand);
          if (!(await note(`T5: AND: AC <- AC & DR`))) return false;
          if (!detailedMode) {
            if (
              !(await noteInstruction(
                `AND ${toHex(effectiveAddress, 3)} => AC=${toHex(state.registers.AC & operand & 0xffff)}`,
              ))
            )
              return false;
            instructionLogged = true;
          }
          break;
        }
        case 1: {
          const operand = state.memory[effectiveAddress] ?? 0;
          const sum = state.registers.AC + operand;
          setRegister("AC", sum & 0xffff);
          setRegister("E", sum > 0xffff ? 1 : 0);
          if (!(await note(`T5: ADD: AC <- AC + DR`))) return false;
          if (!detailedMode) {
            if (
              !(await noteInstruction(
                `ADD ${toHex(effectiveAddress, 3)} => AC=${toHex(sum & 0xffff)}, E=${sum > 0xffff ? 1 : 0}`,
              ))
            )
              return false;
            instructionLogged = true;
          }
          break;
        }
        case 2: {
          const operand = state.memory[effectiveAddress] ?? 0;
          setRegister("DR", operand);
          setRegister("AC", operand);
          if (!(await note(`T5: LDA: AC <- DR`))) return false;
          if (!detailedMode) {
            if (
              !(await noteInstruction(
                `LDA ${toHex(effectiveAddress, 3)} => AC=${toHex(operand)}`,
              ))
            )
              return false;
            instructionLogged = true;
          }
          break;
        }
        case 3: {
          setMemoryWord(effectiveAddress, state.registers.AC);
          if (!(await note(`T5: STA: M[AR] <- AC`))) return false;
          if (!detailedMode) {
            if (
              !(await noteInstruction(
                `STA ${toHex(effectiveAddress, 3)} <= AC(${toHex(state.registers.AC)})`,
              ))
            )
              return false;
            instructionLogged = true;
          }
          break;
        }
        case 4: {
          setRegister("PC", effectiveAddress);
          if (!(await note(`T4: BUN: PC <- AR`))) return false;
          if (!detailedMode) {
            if (
              !(await noteInstruction(
                `BUN ${toHex(effectiveAddress, 3)} => PC=${toHex(effectiveAddress, 3)}`,
              ))
            )
              return false;
          }
          if (detailedMode) {
            addNotation("────────────────────");
          }
          return true;
        }
        case 5: {
          setMemoryWord(effectiveAddress, state.registers.PC + 1);
          setRegister("PC", effectiveAddress + 1);
          if (!(await note(`T4: BSA: M[AR] <- PC, PC <- AR + 1`))) return false;
          if (!detailedMode) {
            if (
              !(await noteInstruction(
                `BSA ${toHex(effectiveAddress, 3)} => M[${toHex(effectiveAddress, 3)}]=${toHex((state.registers.PC + 1) & 0xffff)}, PC=${toHex((effectiveAddress + 1) & 0xfff, 3)}`,
              ))
            )
              return false;
          }
          if (detailedMode) {
            addNotation("────────────────────");
          }
          return true;
        }
        case 6: {
          const operand = state.memory[effectiveAddress] ?? 0;
          setRegister("DR", operand);
          const newValue = (operand + 1) & 0xffff;
          setMemoryWord(effectiveAddress, newValue);
          const nextPc =
            newValue === 0 ? state.registers.PC + 2 : state.registers.PC + 1;
          if (newValue === 0) {
            setRegister("PC", nextPc);
            if (!(await note(`T5: ISZ: M[AR]++ = 0, PC <- PC + 1`)))
              return false;
          } else {
            setRegister("PC", nextPc);
            if (!(await note(`T5: ISZ: M[AR]++ (${toHex(newValue)})`)))
              return false;
          }
          if (!detailedMode) {
            if (
              !(await noteInstruction(
                `ISZ ${toHex(effectiveAddress, 3)} => M=${toHex(newValue)}, PC=${toHex(nextPc & 0xfff, 3)}`,
              ))
            )
              return false;
          }
          if (detailedMode) {
            addNotation("────────────────────");
          }
          return true;
        }
        case 7: {
          setRegister("PC", pc + 1);
          await handleRegisterInstruction(ir, note);
          if (!detailedMode) {
            const names = getRegisterInstructionNames(ir);
            const instructionLabel = names.length > 0 ? names.join("+") : "REG";
            if (
              !(await noteInstruction(
                `${instructionLabel} => AC=${toHex(useFileStore.getState().registers.AC)}, E=${useFileStore.getState().registers.E}, PC=${toHex(useFileStore.getState().registers.PC & 0xfff, 3)}`,
              ))
            )
              return false;
          }
          if (detailedMode) {
            addNotation("────────────────────");
          }
          return true;
        }
      }

      setRegister("PC", pc + 1);
      if (!detailedMode && !instructionLogged) {
        const opName = memoryInstructionNames[opcode] ?? `OP${opcode}`;
        if (
          !(await noteInstruction(
            `${opName} ${toHex(effectiveAddress, 3)} => PC=${toHex((pc + 1) & 0xfff, 3)}`,
          ))
        )
          return false;
      }
      if (detailedMode) {
        addNotation("────────────────────");
      }
      return true;
    } catch {
      addNotation("Error: Execution failed");
      return false;
    }
  };

  const handleRegisterInstruction = async (
    ir: number,
    note: (msg: string) => Promise<boolean>,
  ) => {
    const bit = ir & 0xfff;

    await note(`T3: Register reference instruction`);
    if (bit & 0x800) {
      setRegister("AC", 0);
      await note("T3: CLA: AC <- 0");
    }
    if (bit & 0x400) {
      setRegister("E", 0);
      await note("T3: CLE: E <- 0");
    }
    if (bit & 0x200) {
      setRegister("AC", ~useFileStore.getState().registers.AC & 0xffff);
      await note("T3: CMA: AC <- ~AC");
    }
    if (bit & 0x100) {
      setRegister("E", useFileStore.getState().registers.E ^ 1);
      await note("T3: CME: E <- ~E");
    }
    if (bit & 0x080) {
      const ac = useFileStore.getState().registers.AC;
      const e = useFileStore.getState().registers.E;
      const newAC = ((e << 15) | (ac >> 1)) & 0xffff;
      setRegister("AC", newAC);
      setRegister("E", ac & 1);
      await note("T3: CIR: AC <- shr AC, AC[15] <- E, E <- AC[0]");
    }
    if (bit & 0x040) {
      const ac = useFileStore.getState().registers.AC;
      const e = useFileStore.getState().registers.E;
      const newAC = ((ac << 1) | e) & 0xffff;
      setRegister("AC", newAC);
      setRegister("E", (ac >> 15) & 1);
      await note("T3: CIL: AC <- shl AC, AC[0] <- E, E <- AC[15]");
    }
    if (bit & 0x020) {
      setRegister("AC", (useFileStore.getState().registers.AC + 1) & 0xffff);
      await note("T3: INC: AC <- AC + 1");
    }
    if (bit & 0x010) {
      if (
        (useFileStore.getState().registers.AC & 0x8000) === 0 &&
        useFileStore.getState().registers.AC !== 0
      ) {
        setRegister("PC", useFileStore.getState().registers.PC + 1);
      }
      await note("T3: SPA: if AC[15]=0 then PC <- PC + 1");
    }
    if (bit & 0x008) {
      if (useFileStore.getState().registers.AC & 0x8000) {
        setRegister("PC", useFileStore.getState().registers.PC + 1);
      }
      await note("T3: SNA: if AC[15]=1 then PC <- PC + 1");
    }
    if (bit & 0x004) {
      if (useFileStore.getState().registers.AC === 0) {
        setRegister("PC", useFileStore.getState().registers.PC + 1);
      }
      await note("T3: SZA: if AC=0 then PC <- PC + 1");
    }
    if (bit & 0x002) {
      if (useFileStore.getState().registers.E === 0) {
        setRegister("PC", useFileStore.getState().registers.PC + 1);
      }
      await note("T3: SZE: if E=0 then PC <- PC + 1");
    }
  };

  const handleRun = async () => {
    if (!execution.isAssembled) return;

    if (execution.isRunning || isExecutingRef.current) {
      stopRequestedRef.current = true;
      setRunning(false);
      return;
    }

    stopRequestedRef.current = false;
    isExecutingRef.current = true;
    setRunning(true);

    const runLoop = async () => {
      while (!stopRequestedRef.current) {
        const shouldContinue = await executeStep(execution.delay);
        if (!shouldContinue) break;
      }
      isExecutingRef.current = false;
      setRunning(false);
    };

    void runLoop();
  };

  const handleStep = async () => {
    if (!execution.isAssembled) return;
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    await executeStep(execution.delay);
    isExecutingRef.current = false;
  };

  const handleReset = () => {
    stopRequestedRef.current = true;
    isExecutingRef.current = false;
    resetExecution();
  };

  return (
    <div
      className={`flex h-full items-center justify-between px-2 sm:px-4 ${layoutMode === "compact" ? "rounded-none" : "rounded-lg"}`}
      style={{
        backgroundColor: colorScheme.sidebar,
        border:
          layoutMode === "compact"
            ? `1px solid ${colorScheme.border}66`
            : `1px solid ${colorScheme.border}`,
      }}
    >
      <div className="hidden items-center gap-4 sm:flex">
        <h1
          className="font-title text-lg font-bold tracking-wide"
          style={{ color: colorScheme.accent }}
        >
          MANO FORGE
        </h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="mr-4 hidden items-center gap-1 sm:flex">
          <span className="text-xs" style={{ color: colorScheme.textMuted }}>
            Delay
          </span>
          <input
            type="range"
            min="1"
            max="5000"
            step="50"
            value={execution.delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            className="w-20 accent-current"
            style={{ accentColor: colorScheme.accent }}
          />
          <span
            className="w-14 text-xs"
            style={{ color: colorScheme.textMuted }}
          >
            {execution.delay}ms
          </span>
        </div>

        <button
          onClick={handleAssemble}
          className="flex items-center gap-1 rounded p-2 text-sm font-medium transition-opacity sm:gap-1.5 sm:px-3 sm:py-1.5"
          style={{
            backgroundColor: colorScheme.accent,
            color: colorScheme.background,
          }}
          title="Assemble"
        >
          <TbAssembly size={16} />
          <span className="hidden sm:inline">Assemble</span>
        </button>

        <button
          onClick={handleRun}
          disabled={!execution.isAssembled}
          className="flex items-center gap-1 rounded p-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:gap-1.5 sm:px-3 sm:py-1.5"
          style={{
            backgroundColor: execution.isRunning ? "#ef4444" : "#22c55e",
            color: "#fff",
          }}
          title={execution.isRunning ? "Pause" : "Run"}
        >
          {execution.isRunning ? (
            <VscDebugPause size={16} />
          ) : (
            <VscDebugStart size={16} />
          )}
          <span className="hidden sm:inline">
            {execution.isRunning ? "Pause" : "Run"}
          </span>
        </button>

        <button
          onClick={handleStep}
          disabled={!execution.isAssembled || execution.isRunning}
          className="flex items-center gap-1 rounded p-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:gap-1.5 sm:px-3 sm:py-1.5"
          style={{
            backgroundColor: colorScheme.hover,
            color: colorScheme.text,
          }}
          title="Step"
        >
          <VscDebugStepOver size={16} />
          <span className="hidden sm:inline">Step</span>
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-1 rounded p-2 text-sm font-medium transition-opacity sm:gap-1.5 sm:px-3 sm:py-1.5"
          style={{
            backgroundColor: colorScheme.hover,
            color: colorScheme.text,
          }}
          title="Reset"
        >
          <VscDebugRestart size={16} />
          <span className="hidden sm:inline">Reset</span>
        </button>

        <button
          onClick={() => setShowThemeModal(true)}
          className="ml-1 rounded p-2 transition-colors sm:ml-2"
          style={{ color: colorScheme.textMuted }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = colorScheme.hover)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          title="Appearance settings"
        >
          <VscSettingsGear size={18} />
        </button>

        <button
          onClick={() => setShowDocsModal(true)}
          className="rounded p-2 transition-colors"
          style={{ color: colorScheme.textMuted }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = colorScheme.hover)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          title="Documentation"
        >
          <VscBook size={18} />
        </button>
      </div>

      <DocsModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
      />
      <ThemeModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </div>
  );
}

export default Header;
