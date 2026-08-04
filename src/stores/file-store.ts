"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  architectureForFile,
  extensionForArchitecture,
  memorySizeForArchitecture,
  type Architecture,
} from "@/lib/architectures";
import type { I8085TimingTrace } from "@/lib/8085/timing";

export interface FileItem {
  id: string;
  name: string;
  content: string;
}

export interface AddressInfo {
  label?: string;
  instruction?: string;
}

export interface ExecutionState {
  isRunning: boolean;
  isAssembled: boolean;
  currentLine: number | null;
  delay: number;
  notations: string[];
  machineCode: string[];
  addressToLine: Record<number, number>;
  addressInfo: Record<number, AddressInfo>;
  i8085Timing: I8085TimingTrace | null;
  i8085ActiveCycle: number | null;
  i8085History: I8085DebugRecord[];
  i8085Cursor: number;
  executionComplete: boolean;
}

export interface I8085DebugRecord {
  instruction: string;
  address: number;
  beforeRegisters: Registers;
  afterRegisters: Registers;
  memoryChanges: { address: number; before: number; after: number }[];
  portChanges: { port: number; before: number; after: number }[];
  timing: I8085TimingTrace;
  halted: boolean;
}

export interface Registers {
  AC: number;
  DR: number;
  AR: number;
  IR: number;
  PC: number;
  TR: number;
  INR: number;
  OUTR: number;
  SC: number;
  E: number;
  S: number;
  I: number;
  IEN: number;
  FGI: number;
  FGO: number;
  R: number;
  A: number;
  B: number;
  C: number;
  D: number;
  E8: number;
  H: number;
  L: number;
  SP: number;
  FS: number;
  FZ: number;
  FAC: number;
  FP: number;
  FCY: number;
  IE: number;
  IM: number;
  SID: number;
  SOD: number;
}

export interface FileStore {
  architecture: Architecture;
  files: FileItem[];
  activeFileId: string | null;
  openFileIds: string[];
  memory: number[];
  ports: number[];
  registers: Registers;
  execution: ExecutionState;

  createFile: (name: string) => void;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  setActiveFile: (id: string | null) => void;
  closeOpenFile: (id: string) => void;
  reorderOpenFiles: (draggedId: string, targetId: string) => void;
  downloadFile: (id: string) => void;
  downloadFiles: (ids: string[]) => void;
  createFiles: (files: { name: string; content: string }[]) => void;
  deleteFiles: (ids: string[]) => void;

  setDelay: (delay: number) => void;
  setRunning: (isRunning: boolean) => void;
  setAssembled: (isAssembled: boolean) => void;
  setCurrentLine: (line: number | null) => void;
  addNotation: (notation: string) => void;
  addNotations: (notations: string[]) => void;
  clearNotations: () => void;
  setMachineCode: (code: string[]) => void;
  setAddressToLine: (mapping: Record<number, number>) => void;
  setAddressInfo: (info: Record<number, AddressInfo>) => void;
  set8085Timing: (timing: I8085TimingTrace | null) => void;
  set8085ActiveCycle: (cycle: number | null) => void;
  setExecutionComplete: (complete: boolean) => void;

  setRegister: (key: keyof Registers, value: number) => void;
  resetRegisters: () => void;

  setMemoryWord: (address: number, value: number) => void;
  setMemoryBulk: (data: { address: number; value: number }[]) => void;
  resetMemory: () => void;

  resetExecution: () => void;
  setArchitecture: (architecture: Architecture) => void;
  setPort: (port: number, value: number) => void;
  apply8085Step: (
    registers: Partial<Registers>,
    memoryWrites: { address: number; value: number }[],
    portWrites: { port: number; value: number }[],
    timing: I8085TimingTrace,
    halted?: boolean,
  ) => void;
  step8085Backward: () => void;
  step8085Forward: () => void;
}

const defaultRegisters: Registers = {
  AC: 0,
  DR: 0,
  AR: 0,
  IR: 0,
  PC: 0,
  TR: 0,
  INR: 0,
  OUTR: 0,
  SC: 0,
  E: 0,
  S: 0,
  I: 0,
  IEN: 0,
  FGI: 0,
  FGO: 0,
  R: 0,
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  E8: 0,
  H: 0,
  L: 0,
  SP: 0xffff,
  FS: 0,
  FZ: 0,
  FAC: 0,
  FP: 0,
  FCY: 0,
  IE: 0,
  IM: 0,
  SID: 0,
  SOD: 0,
};

const generateId = () => Math.random().toString(36).substring(2, 15);

const normalizeFileName = (name: string, architecture: Architecture) => {
  const trimmed = name.trim();
  const extension = extensionForArchitecture(architecture);
  return /\.(asm|a85)$/i.test(trimmed) ? trimmed : `${trimmed}${extension}`;
};

const uniqueFileName = (
  name: string,
  files: FileItem[],
  ignoredId?: string,
) => {
  const existing = new Set(
    files
      .filter((file) => file.id !== ignoredId)
      .map((file) => file.name.toLowerCase()),
  );
  const dot = name.lastIndexOf(".");
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  let finalName = name;
  let n = 1;
  while (existing.has(finalName.toLowerCase())) {
    finalName = `${stem} (${n})${ext}`;
    n += 1;
  }
  return finalName;
};

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      architecture: "mano",
      files: [
        {
          id: "default-file",
          name: "main.asm",
          content:
            "LDA NUM\nADD ONE\nSTA RESULT\nHLT\n\nNUM, DEC 5\nONE, DEC 1\nRESULT, DEC 0\nEND",
        },
        {
          id: "default-8085-file",
          name: "sample.a85",
          content:
            "ORG 2000H\nMVI A, 05H\nMVI B, 03H\nADD B\nSTA 3000H\nHLT\nEND",
        },
      ],
      activeFileId: "default-file",
      openFileIds: ["default-file", "default-8085-file"],
      memory: new Array<number>(4096).fill(0),
      ports: new Array<number>(256).fill(0),
      registers: { ...defaultRegisters },
      execution: {
        isRunning: false,
        isAssembled: false,
        currentLine: null,
        delay: 500,
        notations: [],
        machineCode: [],
        addressToLine: {},
        addressInfo: {},
        i8085Timing: null,
        i8085ActiveCycle: null,
        i8085History: [],
        i8085Cursor: 0,
        executionComplete: false,
      },

      createFile: (name) => {
        const newFile: FileItem = {
          id: generateId(),
          name: uniqueFileName(
            normalizeFileName(name, get().architecture),
            get().files,
          ),
          content: "",
        };
        set((state) => ({
          files: [...state.files, newFile],
          activeFileId: newFile.id,
          openFileIds: state.openFileIds.includes(newFile.id)
            ? state.openFileIds
            : [...state.openFileIds, newFile.id],
          execution: {
            ...state.execution,
            currentLine: null,
          },
        }));
        get().setActiveFile(newFile.id);
      },

      deleteFile: (id) => {
        set((state) => {
          const newFiles = state.files.filter((f) => f.id !== id);
          const newOpenFileIds = state.openFileIds.filter(
            (openId) => openId !== id,
          );
          const newActiveId =
            state.activeFileId === id
              ? (newFiles[0]?.id ?? null)
              : state.activeFileId;
          return {
            files: newFiles,
            activeFileId: newActiveId,
            openFileIds:
              newOpenFileIds.length > 0
                ? newOpenFileIds
                : newFiles[0]
                  ? [newFiles[0].id]
                  : [],
          };
        });
      },

      renameFile: (id, newName) => {
        const target = get().files.find((file) => file.id === id);
        const architecture = target
          ? architectureForFile(target.name)
          : get().architecture;
        const finalName = uniqueFileName(
          normalizeFileName(newName, architecture),
          get().files,
          id,
        );
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, name: finalName } : f,
          ),
        }));
        if (get().activeFileId === id) {
          get().setActiveFile(id);
        }
      },

      updateFileContent: (id, content) => {
        set((state) => ({
          files: state.files.map((f) => (f.id === id ? { ...f, content } : f)),
          execution: {
            ...state.execution,
            isAssembled: false,
            currentLine: null,
            i8085Timing: null,
            i8085ActiveCycle: null,
            i8085History: [],
            i8085Cursor: 0,
            executionComplete: false,
          },
        }));
      },

      setActiveFile: (id) => {
        set((state) => {
          const architecture = architectureForFile(
            state.files.find((file) => file.id === id)?.name ?? "main.asm",
          );
          const changed = architecture !== state.architecture;
          return {
            activeFileId: id,
            architecture,
            openFileIds:
              id && !state.openFileIds.includes(id)
                ? [...state.openFileIds, id]
                : state.openFileIds,
            registers: changed ? { ...defaultRegisters } : state.registers,
            memory: changed
              ? new Array<number>(memorySizeForArchitecture(architecture)).fill(
                  0,
                )
              : state.memory,
            ports: changed ? new Array<number>(256).fill(0) : state.ports,
            execution: changed
              ? {
                  isRunning: false,
                  isAssembled: false,
                  currentLine: null,
                  delay: state.execution.delay,
                  notations: [],
                  machineCode: [],
                  addressToLine: {},
                  addressInfo: {},
                  i8085Timing: null,
                  i8085ActiveCycle: null,
                  i8085History: [],
                  i8085Cursor: 0,
                  executionComplete: false,
                }
              : {
                  ...state.execution,
                  currentLine: null,
                },
          };
        });
      },

      closeOpenFile: (id) => {
        set((state) => {
          const nextOpen = state.openFileIds.filter((openId) => openId !== id);
          if (nextOpen.length === 0) {
            const fallback = state.files.find((f) => f.id !== id)?.id;
            return {
              openFileIds: fallback ? [fallback] : [],
              activeFileId: fallback ?? null,
            };
          }

          const nextActive =
            state.activeFileId === id
              ? (nextOpen[nextOpen.length - 1] ?? null)
              : state.activeFileId;

          return {
            openFileIds: nextOpen,
            activeFileId: nextActive,
          };
        });
        get().setActiveFile(get().activeFileId);
      },

      reorderOpenFiles: (draggedId, targetId) => {
        if (draggedId === targetId) return;
        set((state) => {
          const from = state.openFileIds.indexOf(draggedId);
          const to = state.openFileIds.indexOf(targetId);
          if (from < 0 || to < 0) return {};
          const next = [...state.openFileIds];
          const [moved] = next.splice(from, 1);
          if (!moved) return {};
          next.splice(to, 0, moved);
          return { openFileIds: next };
        });
      },

      downloadFile: (id) => {
        const file = get().files.find((f) => f.id === id);
        if (!file) return;
        const blob = new Blob([file.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      },

      downloadFiles: (ids) => {
        const files = get().files.filter((f) => ids.includes(f.id));
        for (const file of files) {
          const blob = new Blob([file.content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        }
      },

      createFiles: (incomingFiles) => {
        if (incomingFiles.length === 0) return;
        const existing = new Set(get().files.map((f) => f.name.toLowerCase()));
        const created: FileItem[] = [];

        for (const item of incomingFiles) {
          const baseName = normalizeFileName(item.name, get().architecture);
          let finalName = baseName;
          let n = 1;
          while (existing.has(finalName.toLowerCase())) {
            const dot = baseName.lastIndexOf(".");
            const stem = dot >= 0 ? baseName.slice(0, dot) : baseName;
            const ext = dot >= 0 ? baseName.slice(dot) : "";
            finalName = `${stem} (${n})${ext}`;
            n += 1;
          }
          existing.add(finalName.toLowerCase());
          created.push({
            id: generateId(),
            name: finalName,
            content: item.content,
          });
        }

        set((state) => ({
          files: [...state.files, ...created],
          activeFileId: created[0]?.id ?? state.activeFileId,
          openFileIds: [
            ...state.openFileIds,
            ...created
              .map((f) => f.id)
              .filter((id) => !state.openFileIds.includes(id)),
          ],
          execution: {
            ...state.execution,
            currentLine: null,
          },
        }));
        if (created[0]) {
          get().setActiveFile(created[0].id);
        }
      },

      deleteFiles: (ids) => {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        set((state) => {
          const newFiles = state.files.filter((f) => !idSet.has(f.id));
          const newOpenFileIds = state.openFileIds.filter(
            (openId) => !idSet.has(openId),
          );
          const newActiveId =
            state.activeFileId && idSet.has(state.activeFileId)
              ? (newFiles[0]?.id ?? null)
              : state.activeFileId;
          return {
            files: newFiles,
            activeFileId: newActiveId,
            openFileIds:
              newOpenFileIds.length > 0
                ? newOpenFileIds
                : newFiles[0]
                  ? [newFiles[0].id]
                  : [],
          };
        });
        get().setActiveFile(get().activeFileId);
      },

      setDelay: (delay) => {
        set((state) => ({
          execution: { ...state.execution, delay: Math.max(1, delay) },
        }));
      },

      setRunning: (isRunning) => {
        set((state) => ({ execution: { ...state.execution, isRunning } }));
      },

      setAssembled: (isAssembled) => {
        set((state) => ({ execution: { ...state.execution, isAssembled } }));
      },

      setCurrentLine: (line) => {
        set((state) => ({
          execution: { ...state.execution, currentLine: line },
        }));
      },

      addNotation: (notation) => {
        set((state) => ({
          execution: {
            ...state.execution,
            notations: [...state.execution.notations, notation],
          },
        }));
      },

      addNotations: (notations) => {
        if (notations.length === 0) return;
        set((state) => ({
          execution: {
            ...state.execution,
            notations: [...state.execution.notations, ...notations],
          },
        }));
      },

      clearNotations: () => {
        set((state) => ({ execution: { ...state.execution, notations: [] } }));
      },

      setMachineCode: (code) => {
        set((state) => ({
          execution: { ...state.execution, machineCode: code },
        }));
      },

      setAddressToLine: (mapping) => {
        set((state) => ({
          execution: { ...state.execution, addressToLine: mapping },
        }));
      },

      setAddressInfo: (info) => {
        set((state) => ({
          execution: { ...state.execution, addressInfo: info },
        }));
      },

      set8085Timing: (i8085Timing) => {
        set((state) => ({
          execution: { ...state.execution, i8085Timing },
        }));
      },

      set8085ActiveCycle: (i8085ActiveCycle) => {
        set((state) => ({
          execution: { ...state.execution, i8085ActiveCycle },
        }));
      },

      setExecutionComplete: (executionComplete) => {
        set((state) => ({
          execution: { ...state.execution, executionComplete },
        }));
      },

      setRegister: (key, value) => {
        set((state) => ({
          registers: { ...state.registers, [key]: value },
        }));
      },

      resetRegisters: () => {
        set({ registers: { ...defaultRegisters } });
      },

      setMemoryWord: (address, value) => {
        set((state) => {
          const newMemory = [...state.memory];
          newMemory[address] =
            value & (state.architecture === "8085" ? 0xff : 0xffff);
          return { memory: newMemory };
        });
      },

      setMemoryBulk: (data) => {
        set((state) => {
          const newMemory = [...state.memory];
          for (const { address, value } of data) {
            newMemory[address] =
              value & (state.architecture === "8085" ? 0xff : 0xffff);
          }
          return { memory: newMemory };
        });
      },

      resetMemory: () => {
        set((state) => ({
          memory: new Array<number>(
            memorySizeForArchitecture(state.architecture),
          ).fill(0),
        }));
      },

      resetExecution: () => {
        set({
          registers: { ...defaultRegisters },
          memory: new Array<number>(
            memorySizeForArchitecture(get().architecture),
          ).fill(0),
          ports: new Array<number>(256).fill(0),
          execution: {
            isRunning: false,
            isAssembled: false,
            currentLine: null,
            delay: get().execution.delay,
            notations: [],
            machineCode: [],
            addressToLine: {},
            addressInfo: {},
            i8085Timing: null,
            i8085ActiveCycle: null,
            i8085History: [],
            i8085Cursor: 0,
            executionComplete: false,
          },
        });
      },

      setArchitecture: (architecture) => {
        if (architecture === get().architecture) return;
        set({
          architecture,
          registers: { ...defaultRegisters },
          memory: new Array<number>(
            memorySizeForArchitecture(architecture),
          ).fill(0),
          ports: new Array<number>(256).fill(0),
          execution: {
            isRunning: false,
            isAssembled: false,
            currentLine: null,
            delay: get().execution.delay,
            notations: [],
            machineCode: [],
            addressToLine: {},
            addressInfo: {},
            i8085Timing: null,
            i8085ActiveCycle: null,
            i8085History: [],
            i8085Cursor: 0,
            executionComplete: false,
          },
        });
      },

      setPort: (port, value) => {
        set((state) => {
          const ports = [...state.ports];
          ports[port & 0xff] = value & 0xff;
          return { ports };
        });
      },

      apply8085Step: (
        registers,
        memoryWrites,
        portWrites,
        timing,
        halted = false,
      ) => {
        set((state) => {
          const memory = [...state.memory];
          const ports = [...state.ports];
          const memoryChanges = memoryWrites.map((write) => ({
            address: write.address & 0xffff,
            before: state.memory[write.address & 0xffff] ?? 0,
            after: write.value & 0xff,
          }));
          const portChanges = portWrites.map((write) => ({
            port: write.port & 0xff,
            before: state.ports[write.port & 0xff] ?? 0,
            after: write.value & 0xff,
          }));
          for (const write of memoryWrites) {
            memory[write.address & 0xffff] = write.value & 0xff;
          }
          for (const write of portWrites) {
            ports[write.port & 0xff] = write.value & 0xff;
          }
          const afterRegisters = { ...state.registers, ...registers };
          const record: I8085DebugRecord = {
            instruction: timing.instruction,
            address: timing.address,
            beforeRegisters: { ...state.registers },
            afterRegisters,
            memoryChanges,
            portChanges,
            timing,
            halted,
          };
          const history = [
            ...state.execution.i8085History.slice(
              0,
              state.execution.i8085Cursor,
            ),
            record,
          ];
          return {
            registers: afterRegisters,
            memory,
            ports,
            execution: {
              ...state.execution,
              i8085Timing: timing,
              i8085ActiveCycle: null,
              i8085History: history,
              i8085Cursor: history.length,
              executionComplete: halted,
            },
          };
        });
      },

      step8085Backward: () => {
        set((state) => {
          const cursor = state.execution.i8085Cursor;
          if (cursor <= 0) return state;
          const record = state.execution.i8085History[cursor - 1];
          if (!record) return state;
          const memory = [...state.memory];
          const ports = [...state.ports];
          for (const change of record.memoryChanges) {
            memory[change.address] = change.before;
          }
          for (const change of record.portChanges) {
            ports[change.port] = change.before;
          }
          const nextCursor = cursor - 1;
          return {
            registers: { ...record.beforeRegisters },
            memory,
            ports,
            execution: {
              ...state.execution,
              isRunning: false,
              currentLine: record.address,
              i8085Cursor: nextCursor,
              i8085ActiveCycle: null,
              executionComplete: false,
              i8085Timing:
                nextCursor > 0
                  ? (state.execution.i8085History[nextCursor - 1]?.timing ??
                    null)
                  : null,
            },
          };
        });
      },

      step8085Forward: () => {
        set((state) => {
          const cursor = state.execution.i8085Cursor;
          const record = state.execution.i8085History[cursor];
          if (!record) return state;
          const memory = [...state.memory];
          const ports = [...state.ports];
          for (const change of record.memoryChanges) {
            memory[change.address] = change.after;
          }
          for (const change of record.portChanges) {
            ports[change.port] = change.after;
          }
          return {
            registers: { ...record.afterRegisters },
            memory,
            ports,
            execution: {
              ...state.execution,
              currentLine: record.address,
              i8085Cursor: cursor + 1,
              i8085Timing: record.timing,
              i8085ActiveCycle: null,
              executionComplete: record.halted,
            },
          };
        });
      },
    }),
    {
      name: "mano-forge-storage",
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<FileStore> & {
          execution?: Partial<ExecutionState>;
        };
        return {
          ...currentState,
          ...persisted,
          execution: {
            ...currentState.execution,
            ...persisted.execution,
          },
        };
      },
      partialize: (state) => ({
        files: state.files,
        activeFileId: state.activeFileId,
        openFileIds: state.openFileIds,
        architecture: state.architecture,
        execution: { delay: state.execution.delay },
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.execution) {
          state.execution.delay = Math.max(1, state.execution.delay ?? 500);
        }
        if (state) {
          const ids = new Set(state.files.map((f) => f.id));
          state.openFileIds = (state.openFileIds ?? []).filter((id) =>
            ids.has(id),
          );
          if (state.openFileIds.length === 0 && state.files[0]) {
            state.openFileIds = [state.files[0].id];
          }
          if (state.activeFileId && !ids.has(state.activeFileId)) {
            state.activeFileId =
              state.openFileIds[0] ?? state.files[0]?.id ?? null;
          }
          state.architecture = architectureForFile(
            state.files.find((file) => file.id === state.activeFileId)?.name ??
              "main.asm",
          );
          state.memory = new Array<number>(
            memorySizeForArchitecture(state.architecture),
          ).fill(0);
          state.ports = new Array<number>(256).fill(0);
          state.registers = { ...defaultRegisters };
        }
      },
    },
  ),
);
