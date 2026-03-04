"use client";

import { useState, useRef, useEffect } from "react";
import { useFileStore } from "@/stores/file-store";
import {
  useThemeStore,
  colorSchemes,
  type SchemeName,
} from "@/stores/theme-store";
import {
  VscDebugStart,
  VscDebugStepOver,
  VscDebugRestart,
  VscSymbolColor,
  VscCheck,
  VscDebugPause,
  VscBook,
} from "react-icons/vsc";
import { TbAssembly } from "react-icons/tb";
import { DocsModal } from "./docs-modal";
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
    setMemoryWord,
    setRegister,
    addNotation,
    clearNotations,
    resetExecution,
  } = useFileStore();

  const { colorScheme, schemeName, setScheme } = useThemeStore();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const executorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isExecutingRef = useRef(false);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(e.target as Node)
      ) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (executorRef.current) clearInterval(executorRef.current);
    };
  }, []);

  const activeFile = files.find((f) => f.id === activeFileId);

  const handleAssemble = () => {
    if (!activeFile) return;

    try {
      clearNotations();
      const tokens = tokenize(activeFile.content);
      const parser = new Parser(tokens, activeFile.content);
      const ast = parser.parse();

      if (!ast) {
        addNotation("Error: Failed to parse code");
        return;
      }

      const assembler = new Assembler(ast);
      const machineCodeStrings = assembler.assemble();

      let address = 0;
      for (const codeStr of machineCodeStrings) {
        const value = parseInt(codeStr, 16);
        if (!isNaN(value)) {
          setMemoryWord(address, value);
          address++;
        }
      }

      const codeLines = machineCodeStrings.map(
        (code, idx) =>
          `${idx.toString(16).toUpperCase().padStart(3, "0")}: ${code}`,
      );

      setMachineCode(codeLines);
      setAssembled(true);
      setRegister("PC", 0);
      addNotation(`Assembled successfully: ${machineCodeStrings.length} words`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Assembly failed";
      addNotation(`Error: ${message}`);
      setAssembled(false);
    }
  };

  const executeStep = async (delay = 0): Promise<boolean> => {
    const note = async (msg: string) => {
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

      const toHex = (n: number, pad = 4) =>
        n.toString(16).toUpperCase().padStart(pad, "0");

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
        addNotation("────────────────────");
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
      setCurrentLine(pc);

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

      switch (opcode) {
        case 0: {
          const operand = state.memory[effectiveAddress] ?? 0;
          setRegister("AC", state.registers.AC & operand);
          if (!(await note(`T5: AND: AC <- AC & DR`))) return false;
          break;
        }
        case 1: {
          const operand = state.memory[effectiveAddress] ?? 0;
          const sum = state.registers.AC + operand;
          setRegister("AC", sum & 0xffff);
          setRegister("E", sum > 0xffff ? 1 : 0);
          if (!(await note(`T5: ADD: AC <- AC + DR`))) return false;
          break;
        }
        case 2: {
          const operand = state.memory[effectiveAddress] ?? 0;
          setRegister("DR", operand);
          setRegister("AC", operand);
          if (!(await note(`T5: LDA: AC <- DR`))) return false;
          break;
        }
        case 3: {
          setMemoryWord(effectiveAddress, state.registers.AC);
          if (!(await note(`T5: STA: M[AR] <- AC`))) return false;
          break;
        }
        case 4: {
          setRegister("PC", effectiveAddress);
          if (!(await note(`T4: BUN: PC <- AR`))) return false;
          addNotation("────────────────────");
          return true;
        }
        case 5: {
          setMemoryWord(effectiveAddress, state.registers.PC + 1);
          setRegister("PC", effectiveAddress + 1);
          if (!(await note(`T4: BSA: M[AR] <- PC, PC <- AR + 1`))) return false;
          addNotation("────────────────────");
          return true;
        }
        case 6: {
          const operand = state.memory[effectiveAddress] ?? 0;
          setRegister("DR", operand);
          const newValue = (operand + 1) & 0xffff;
          setMemoryWord(effectiveAddress, newValue);
          if (newValue === 0) {
            setRegister("PC", state.registers.PC + 2);
            if (!(await note(`T5: ISZ: M[AR]++ = 0, PC <- PC + 1`)))
              return false;
          } else {
            setRegister("PC", state.registers.PC + 1);
            if (!(await note(`T5: ISZ: M[AR]++ (${toHex(newValue)})`)))
              return false;
          }
          addNotation("────────────────────");
          return true;
        }
        case 7: {
          await handleRegisterInstruction(ir, note);
          break;
        }
      }

      setRegister("PC", state.registers.PC + 1);
      addNotation("────────────────────");
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
    const state = useFileStore.getState();
    const bit = ir & 0xfff;

    if (ir & 0x800) {
      await note(`T3: Register reference instruction`);
      if (bit & 0x400) {
        setRegister("AC", 0);
        await note("T3: CLA: AC <- 0");
      }
      if (bit & 0x200) {
        setRegister("E", 0);
        await note("T3: CLE: E <- 0");
      }
      if (bit & 0x100) {
        setRegister("AC", ~state.registers.AC & 0xffff);
        await note("T3: CMA: AC <- ~AC");
      }
      if (bit & 0x080) {
        setRegister("E", state.registers.E ^ 1);
        await note("T3: CME: E <- ~E");
      }
      if (bit & 0x040) {
        const ac = state.registers.AC;
        const e = state.registers.E;
        const newAC = ((e << 15) | (ac >> 1)) & 0xffff;
        setRegister("AC", newAC);
        setRegister("E", ac & 1);
        await note("T3: CIR: AC <- shr AC, AC[15] <- E, E <- AC[0]");
      }
      if (bit & 0x020) {
        const ac = state.registers.AC;
        const e = state.registers.E;
        const newAC = ((ac << 1) | e) & 0xffff;
        setRegister("AC", newAC);
        setRegister("E", (ac >> 15) & 1);
        await note("T3: CIL: AC <- shl AC, AC[0] <- E, E <- AC[15]");
      }
      if (bit & 0x010) {
        setRegister("AC", (state.registers.AC + 1) & 0xffff);
        await note("T3: INC: AC <- AC + 1");
      }
      if (bit & 0x008) {
        if (state.registers.AC & 0x8000) {
          setRegister("PC", state.registers.PC + 2);
        }
        await note("T3: SPA: if AC[15]=0 then PC <- PC + 1");
      }
      if (bit & 0x004) {
        if (state.registers.AC & 0x8000) {
          setRegister("PC", state.registers.PC + 2);
        }
        await note("T3: SNA: if AC[15]=1 then PC <- PC + 1");
      }
      if (bit & 0x002) {
        if (state.registers.AC === 0) {
          setRegister("PC", state.registers.PC + 2);
        }
        await note("T3: SZA: if AC=0 then PC <- PC + 1");
      }
      if (bit & 0x001) {
        if (state.registers.E === 0) {
          setRegister("PC", state.registers.PC + 2);
        }
        await note("T3: SZE: if E=0 then PC <- PC + 1");
      }
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
      className="flex h-full items-center justify-between rounded-lg px-2 sm:px-4"
      style={{ backgroundColor: colorScheme.panel }}
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
            min="50"
            max="2000"
            step="50"
            value={execution.delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            className="w-20 accent-current"
            style={{ accentColor: colorScheme.accent }}
          />
          <span
            className="w-12 text-xs"
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

        <div className="relative ml-1 sm:ml-2" ref={themeMenuRef}>
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="rounded p-2 transition-colors"
            style={{ color: colorScheme.textMuted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colorScheme.hover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            title="Color Scheme"
          >
            <VscSymbolColor size={18} />
          </button>

          {showThemeMenu && (
            <div
              className="absolute top-full right-0 z-50 mt-2 min-w-[140px] rounded-lg py-1 shadow-xl"
              style={{
                backgroundColor: colorScheme.panel,
                border: `1px solid ${colorScheme.border}`,
              }}
            >
              {(Object.keys(colorSchemes) as SchemeName[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setScheme(key);
                    setShowThemeMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                  style={{ color: colorScheme.text }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = colorScheme.hover)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: colorSchemes[key].accent }}
                  />
                  <span className="flex-1 capitalize">{key}</span>
                  {schemeName === key && (
                    <VscCheck size={14} style={{ color: colorScheme.accent }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

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
    </div>
  );
}

export default Header;
