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
  VscCircuitBoard,
  VscDebug,
  VscDebugStepBack,
  VscDebugContinueSmall,
  VscPulse,
} from "react-icons/vsc";
import { TbAssembly } from "react-icons/tb";
import { DocsModal } from "./docs-modal";
import { ThemeModal } from "./theme-modal";
import { Parser } from "@/lib/parser";
import { Assembler } from "@/lib/assembler";
import { tokenize } from "@/lib/tokenizer";
import { I8085Assembler } from "@/lib/8085/assembler";
import {
  step8085,
  type I8085Registers,
  type I8085StepResult,
} from "@/lib/8085/cpu";
import { useShallow } from "zustand/react/shallow";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type WorkspaceMode = "assembly" | "circuit";

type HeaderProps = {
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  timingPanelOpen: boolean;
  onTimingPanelToggle: () => void;
};

export function Header({
  workspaceMode,
  onWorkspaceModeChange,
  timingPanelOpen,
  onTimingPanelToggle,
}: HeaderProps) {
  const {
    activeFileId,
    architecture,
    isRunning,
    isAssembled,
    delay,
    debugCursor,
    debugHistoryLength,
    executionComplete,
    setDelay,
    setRunning,
    setAssembled,
    setCurrentLine,
    setMachineCode,
    setAddressToLine,
    setAddressInfo,
    set8085Timing,
    set8085ActiveCycle,
    setExecutionComplete,
    setMemoryWord,
    setMemoryBulk,
    setRegister,
    addNotation,
    apply8085Step,
    step8085Backward,
    step8085Forward,
    clearNotations,
    resetExecution,
    setArchitecture,
  } = useFileStore(
    useShallow((state) => ({
      activeFileId: state.activeFileId,
      architecture: state.architecture,
      isRunning: state.execution.isRunning,
      isAssembled: state.execution.isAssembled,
      delay: state.execution.delay,
      debugCursor: state.execution.i8085Cursor,
      debugHistoryLength: state.execution.i8085History?.length ?? 0,
      executionComplete: state.execution.executionComplete,
      setDelay: state.setDelay,
      setRunning: state.setRunning,
      setAssembled: state.setAssembled,
      setCurrentLine: state.setCurrentLine,
      setMachineCode: state.setMachineCode,
      setAddressToLine: state.setAddressToLine,
      setAddressInfo: state.setAddressInfo,
      set8085Timing: state.set8085Timing,
      set8085ActiveCycle: state.set8085ActiveCycle,
      setExecutionComplete: state.setExecutionComplete,
      setMemoryWord: state.setMemoryWord,
      setMemoryBulk: state.setMemoryBulk,
      setRegister: state.setRegister,
      addNotation: state.addNotation,
      apply8085Step: state.apply8085Step,
      step8085Backward: state.step8085Backward,
      step8085Forward: state.step8085Forward,
      clearNotations: state.clearNotations,
      resetExecution: state.resetExecution,
      setArchitecture: state.setArchitecture,
    })),
  );

  const { colorScheme } = useThemeStore();
  const { layoutMode, executionLogMode, debugStepMode, setDebugStepMode } =
    useUiStore(
      useShallow((state) => ({
        layoutMode: state.layoutMode,
        executionLogMode: state.executionLogMode,
        debugStepMode: state.debugStepMode,
        setDebugStepMode: state.setDebugStepMode,
      })),
    );
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [hasPendingCycle, setHasPendingCycle] = useState(false);
  const executorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isExecutingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const pending8085StepRef = useRef<I8085StepResult | null>(null);
  const pendingCycleIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const intervalId = executorRef.current;
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (architecture !== "8085") {
      setDebugMode(false);
      pending8085StepRef.current = null;
      pendingCycleIndexRef.current = null;
      set8085ActiveCycle(null);
    }
  }, [architecture, set8085ActiveCycle]);

  const emitAssembleError = (
    error: unknown,
    source: string,
    fileName: string,
  ) => {
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

    const lines = source.split("\n");
    const lineText = lines[maybe.line - 1] ?? "";
    const pointer = " ".repeat(Math.max(0, maybe.column - 1)) + "^";

    addNotation(` --> ${maybe.file ?? fileName}:${maybe.line}:${maybe.column}`);
    addNotation("  |");
    addNotation(`${maybe.line} | ${lineText}`);
    addNotation(`  | ${pointer}`);
  };

  const clearPending8085Step = () => {
    pending8085StepRef.current = null;
    pendingCycleIndexRef.current = null;
    setHasPendingCycle(false);
    set8085ActiveCycle(null);
  };

  const assembleActiveFile = () => {
    const state = useFileStore.getState();
    const activeFile = state.files.find(
      (file) => file.id === state.activeFileId,
    );
    if (!activeFile) return false;

    try {
      clearPending8085Step();
      resetExecution();
      clearNotations();
      if (architecture === "8085") {
        const assembler = new I8085Assembler(activeFile.content);
        const bytes = assembler.assemble();
        const addressToLineRecord: Record<number, number> = {};
        assembler.addressToLine.forEach((line, address) => {
          addressToLineRecord[address] = line;
        });
        const addressInfoRecord: Record<
          number,
          { label?: string; instruction?: string }
        > = {};
        assembler.addressInfo.forEach((info, address) => {
          addressInfoRecord[address] = info;
        });
        setAddressToLine(addressToLineRecord);
        setAddressInfo(addressInfoRecord);
        setMemoryBulk(
          [...assembler.addressToCode].map(([address, value]) => ({
            address,
            value,
          })),
        );
        setMachineCode(
          [...assembler.addressToCode].map(
            ([address, value]) =>
              `${address.toString(16).toUpperCase().padStart(4, "0")}: ${value.toString(16).toUpperCase().padStart(2, "0")}`,
          ),
        );
        setAssembled(true);
        setRegister("PC", assembler.startAddress);
        setCurrentLine(null);
        addNotation(`Assembled successfully: ${bytes.length} bytes`);
        return true;
      }
      const tokens = tokenize(activeFile.content);
      const parser = new Parser(tokens, activeFile.content);
      const ast = parser.parse();

      if (!ast || ast.length === 0) {
        addNotation("Error: No valid code to assemble");
        return false;
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
      return true;
    } catch (error) {
      emitAssembleError(error, activeFile.content, activeFile.name);
      setAssembled(false);
      return false;
    }
  };

  const handleAssemble = () => {
    stopRequestedRef.current = true;
    isExecutingRef.current = false;
    setRunning(false);
    assembleActiveFile();
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

      if (state.architecture === "8085") {
        if (!state.execution.addressInfo[pc]?.instruction) {
          setExecutionComplete(true);
          setRunning(false);
          return false;
        }
        setCurrentLine(pc);
        const result = step8085(
          state.registers as I8085Registers,
          state.memory,
          state.ports,
        );
        apply8085Step(
          result.registers,
          result.memoryWrites,
          result.portWrites,
          result.timing,
          result.halted,
        );
        if (delay > 0) await sleep(delay);
        if (stopRequestedRef.current) return false;
        if (result.halted) {
          setExecutionComplete(true);
          setRunning(false);
          return false;
        }
        return true;
      }

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
    if (isRunning || isExecutingRef.current) {
      stopRequestedRef.current = true;
      setRunning(false);
      return;
    }

    if (!assembleActiveFile()) return;

    stopRequestedRef.current = false;
    isExecutingRef.current = true;
    setRunning(true);

    const runLoop = async () => {
      while (!stopRequestedRef.current) {
        const shouldContinue = await executeStep(delay);
        if (!shouldContinue) break;
      }
      isExecutingRef.current = false;
      setRunning(false);
    };

    void runLoop();
  };

  const commit8085Step = (result: I8085StepResult) => {
    apply8085Step(
      result.registers,
      result.memoryWrites,
      result.portWrites,
      result.timing,
      result.halted,
    );
    if (result.halted) setExecutionComplete(true);
  };

  const handle8085MachineCycleStep = () => {
    const pending = pending8085StepRef.current;
    const currentCycle = pendingCycleIndexRef.current;

    if (!pending || currentCycle === null) {
      const state = useFileStore.getState();
      const pc = state.registers.PC;
      if (!state.execution.addressInfo[pc]?.instruction) {
        setExecutionComplete(true);
        return;
      }
      const result = step8085(
        state.registers as I8085Registers,
        state.memory,
        state.ports,
      );
      setCurrentLine(pc);
      set8085Timing(result.timing);
      if (result.timing.machineCycles.length <= 1) {
        commit8085Step(result);
        set8085ActiveCycle(0);
        return;
      }
      pending8085StepRef.current = result;
      pendingCycleIndexRef.current = 0;
      setHasPendingCycle(true);
      set8085ActiveCycle(0);
      return;
    }

    const nextCycle = currentCycle + 1;
    if (nextCycle >= pending.timing.machineCycles.length - 1) {
      pending8085StepRef.current = null;
      pendingCycleIndexRef.current = null;
      setHasPendingCycle(false);
      commit8085Step(pending);
      set8085ActiveCycle(nextCycle);
      return;
    }
    pendingCycleIndexRef.current = nextCycle;
    set8085ActiveCycle(nextCycle);
  };

  const handleStep = async () => {
    if (!isAssembled) return;
    if (isExecutingRef.current) return;
    if (architecture === "8085" && debugCursor < debugHistoryLength) {
      clearPending8085Step();
      step8085Forward();
      return;
    }
    if (
      architecture === "8085" &&
      debugMode &&
      debugStepMode === "machine-cycle"
    ) {
      handle8085MachineCycleStep();
      return;
    }
    isExecutingRef.current = true;
    await executeStep(delay);
    isExecutingRef.current = false;
  };

  const handleDebugBack = () => {
    if (isRunning) return;
    if (pending8085StepRef.current) {
      clearPending8085Step();
      return;
    }
    if (debugCursor <= 0) return;
    step8085Backward();
  };

  const handleDebugForward = () => {
    if (isRunning || debugCursor >= debugHistoryLength) return;
    step8085Forward();
  };

  const toggleDebugMode = () => {
    stopRequestedRef.current = true;
    isExecutingRef.current = false;
    setRunning(false);
    clearPending8085Step();
    setDebugMode((enabled) => !enabled);
  };

  const handleReset = () => {
    stopRequestedRef.current = true;
    isExecutingRef.current = false;
    clearPending8085Step();
    resetExecution();
  };

  return (
    <div
      className={`flex h-full min-w-0 items-center justify-start gap-1 overflow-x-auto px-1.5 sm:justify-between sm:overflow-visible sm:px-4 ${layoutMode === "compact" ? "rounded-none" : "rounded-lg"}`}
      style={{
        backgroundColor: colorScheme.sidebar,
        border:
          layoutMode === "compact"
            ? `1px solid ${colorScheme.border}66`
            : `1px solid ${colorScheme.border}`,
      }}
    >
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <h1
          className="font-title hidden text-lg font-bold tracking-wide sm:block"
          style={{ color: colorScheme.accent }}
        >
          MANO FORGE
        </h1>
        <div
          className="flex items-center gap-1 rounded border p-1"
          style={{
            backgroundColor: colorScheme.panel,
            borderColor: colorScheme.border,
          }}
        >
          <button
            onClick={() => onWorkspaceModeChange("assembly")}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor:
                workspaceMode === "assembly"
                  ? colorScheme.active
                  : "transparent",
              color:
                workspaceMode === "assembly"
                  ? colorScheme.text
                  : colorScheme.textMuted,
            }}
          >
            <TbAssembly size={14} />
            <span className="hidden sm:inline">Assembly</span>
          </button>
          <button
            onClick={() => onWorkspaceModeChange("circuit")}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor:
                workspaceMode === "circuit"
                  ? colorScheme.active
                  : "transparent",
              color:
                workspaceMode === "circuit"
                  ? colorScheme.text
                  : colorScheme.textMuted,
            }}
          >
            <VscCircuitBoard size={14} />
            <span className="hidden sm:inline">Circuit</span>
          </button>
        </div>
        {workspaceMode === "circuit" && (
          <div
            className="hidden items-center gap-1 text-xs sm:flex"
            style={{ color: colorScheme.textMuted }}
          >
            <VscCircuitBoard size={12} />
            <span>Circuit Designer</span>
          </div>
        )}
        {workspaceMode === "assembly" && (
          <div
            className="flex items-center gap-1 rounded border p-1"
            style={{
              backgroundColor: colorScheme.panel,
              borderColor: colorScheme.border,
            }}
          >
            <button
              onClick={() => setArchitecture("mano")}
              className="rounded px-2 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor:
                  architecture === "mano" ? colorScheme.active : "transparent",
                color:
                  architecture === "mano"
                    ? colorScheme.text
                    : colorScheme.textMuted,
              }}
            >
              Mano
            </button>
            <button
              onClick={() => setArchitecture("8085")}
              className="rounded px-2 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor:
                  architecture === "8085" ? colorScheme.active : "transparent",
                color:
                  architecture === "8085"
                    ? colorScheme.text
                    : colorScheme.textMuted,
              }}
            >
              8085
            </button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {workspaceMode === "assembly" && (
          <>
            <div className="mr-4 hidden items-center gap-1 sm:flex">
              <span
                className="text-xs"
                style={{ color: colorScheme.textMuted }}
              >
                Delay
              </span>
              <input
                type="range"
                min="1"
                max="5000"
                step="50"
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
                className="w-20 accent-current"
                style={{ accentColor: colorScheme.accent }}
              />
              <span
                className="w-14 text-xs"
                style={{ color: colorScheme.textMuted }}
              >
                {delay}ms
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
              disabled={!activeFileId}
              className="flex items-center gap-1 rounded p-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:gap-1.5 sm:px-3 sm:py-1.5"
              style={{
                backgroundColor: isRunning ? "#ef4444" : "#22c55e",
                color: "#fff",
              }}
              title={isRunning ? "Pause" : "Run"}
            >
              {isRunning ? (
                <VscDebugPause size={16} />
              ) : (
                <VscDebugStart size={16} />
              )}
              <span className="hidden sm:inline">
                {isRunning ? "Pause" : "Run"}
              </span>
            </button>

            {architecture === "8085" ? (
              <button
                onClick={toggleDebugMode}
                className="flex items-center gap-1 rounded p-2 text-sm font-medium transition-colors sm:gap-1.5 sm:px-3 sm:py-1.5"
                style={{
                  backgroundColor: debugMode
                    ? `${colorScheme.accent}28`
                    : colorScheme.hover,
                  color: debugMode ? colorScheme.accent : colorScheme.text,
                  border: `1px solid ${
                    debugMode ? colorScheme.accent : "transparent"
                  }`,
                }}
                title="Toggle reversible debug mode"
              >
                <VscDebug size={16} />
                <span className="hidden lg:inline">Debug</span>
              </button>
            ) : null}

            {architecture === "8085" ? (
              <button
                onClick={onTimingPanelToggle}
                className="hidden items-center gap-1 rounded p-2 text-sm font-medium transition-colors sm:px-2.5 sm:py-1.5 md:flex"
                style={{
                  backgroundColor: timingPanelOpen
                    ? `${colorScheme.accent}28`
                    : colorScheme.hover,
                  color: timingPanelOpen
                    ? colorScheme.accent
                    : colorScheme.text,
                  border: `1px solid ${
                    timingPanelOpen ? colorScheme.accent : "transparent"
                  }`,
                }}
                title={
                  timingPanelOpen ? "Close 8085 timing" : "Open 8085 timing"
                }
                aria-pressed={timingPanelOpen}
              >
                <VscPulse size={16} />
                <span className="hidden xl:inline">Timing</span>
              </button>
            ) : null}

            {architecture === "8085" && debugMode ? (
              <div
                className="flex items-center rounded border p-0.5"
                style={{
                  backgroundColor: colorScheme.panel,
                  borderColor: colorScheme.border,
                }}
              >
                {(["instruction", "machine-cycle"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      clearPending8085Step();
                      setDebugStepMode(mode);
                    }}
                    className="rounded px-1.5 py-1 text-[9px] font-medium transition-colors"
                    style={{
                      backgroundColor:
                        debugStepMode === mode
                          ? colorScheme.active
                          : "transparent",
                      color:
                        debugStepMode === mode
                          ? colorScheme.text
                          : colorScheme.textMuted,
                    }}
                    title={
                      mode === "instruction"
                        ? "Step one instruction"
                        : "Step one machine cycle"
                    }
                  >
                    {mode === "instruction" ? "INST" : "M-CYCLE"}
                  </button>
                ))}
              </div>
            ) : null}

            {architecture === "8085" && debugMode ? (
              <button
                onClick={handleDebugBack}
                disabled={isRunning || (debugCursor <= 0 && !hasPendingCycle)}
                className="flex items-center rounded p-2 transition-opacity disabled:cursor-not-allowed disabled:opacity-35 sm:px-2.5 sm:py-1.5"
                style={{
                  backgroundColor: colorScheme.hover,
                  color: colorScheme.text,
                }}
                title="Step backward"
              >
                <VscDebugStepBack size={16} />
              </button>
            ) : null}

            <button
              onClick={handleStep}
              disabled={!isAssembled || isRunning || executionComplete}
              className="flex items-center gap-1 rounded p-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:gap-1.5 sm:px-3 sm:py-1.5"
              style={{
                backgroundColor: colorScheme.hover,
                color: colorScheme.text,
              }}
              title={
                architecture === "8085" &&
                debugMode &&
                debugStepMode === "machine-cycle"
                  ? "Step one machine cycle"
                  : "Step one instruction"
              }
            >
              <VscDebugStepOver size={16} />
              <span className="hidden sm:inline">Step</span>
            </button>

            {architecture === "8085" && debugMode ? (
              <button
                onClick={handleDebugForward}
                disabled={isRunning || debugCursor >= debugHistoryLength}
                className="flex items-center gap-1 rounded p-2 font-mono text-[10px] transition-opacity disabled:cursor-not-allowed disabled:opacity-35 sm:px-2.5 sm:py-1.5"
                style={{
                  backgroundColor: colorScheme.hover,
                  color: colorScheme.text,
                }}
                title="Replay next recorded instruction"
              >
                <VscDebugContinueSmall size={16} />
                <span className="hidden xl:inline">
                  {debugCursor}/{debugHistoryLength}
                </span>
              </button>
            ) : null}

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
          </>
        )}

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

        {workspaceMode === "assembly" && (
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
        )}
      </div>

      <DocsModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        architecture={architecture}
      />
      <ThemeModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </div>
  );
}

export default Header;
