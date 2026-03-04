"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FileItem {
  id: string;
  name: string;
  content: string;
}

export interface ExecutionState {
  isRunning: boolean;
  isAssembled: boolean;
  currentLine: number | null;
  delay: number;
  notations: string[];
  machineCode: string[];
  addressToLine: Record<number, number>;
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
}

export interface FileStore {
  files: FileItem[];
  activeFileId: string | null;
  memory: number[];
  registers: Registers;
  execution: ExecutionState;

  createFile: (name: string) => void;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  setActiveFile: (id: string | null) => void;
  downloadFile: (id: string) => void;

  setDelay: (delay: number) => void;
  setRunning: (isRunning: boolean) => void;
  setAssembled: (isAssembled: boolean) => void;
  setCurrentLine: (line: number | null) => void;
  addNotation: (notation: string) => void;
  clearNotations: () => void;
  setMachineCode: (code: string[]) => void;
  setAddressToLine: (mapping: Record<number, number>) => void;

  setRegister: (key: keyof Registers, value: number) => void;
  resetRegisters: () => void;

  setMemoryWord: (address: number, value: number) => void;
  setMemoryBulk: (data: { address: number; value: number }[]) => void;
  resetMemory: () => void;

  resetExecution: () => void;
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
};

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      files: [
        {
          id: "default-file",
          name: "main.asm",
          content:
            "LDA NUM\nADD ONE\nSTA RESULT\nHLT\n\nNUM, DEC 5\nONE, DEC 1\nRESULT, DEC 0\nEND",
        },
      ],
      activeFileId: "default-file",
      memory: new Array<number>(4096).fill(0),
      registers: { ...defaultRegisters },
      execution: {
        isRunning: false,
        isAssembled: false,
        currentLine: null,
        delay: 500,
        notations: [],
        machineCode: [],
        addressToLine: {},
      },

      createFile: (name) => {
        const newFile: FileItem = {
          id: generateId(),
          name: name.endsWith(".asm") ? name : `${name}.asm`,
          content: "",
        };
        set((state) => ({
          files: [...state.files, newFile],
          activeFileId: newFile.id,
        }));
      },

      deleteFile: (id) => {
        set((state) => {
          const newFiles = state.files.filter((f) => f.id !== id);
          const newActiveId =
            state.activeFileId === id
              ? (newFiles[0]?.id ?? null)
              : state.activeFileId;
          return { files: newFiles, activeFileId: newActiveId };
        });
      },

      renameFile: (id, newName) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, name: newName } : f,
          ),
        }));
      },

      updateFileContent: (id, content) => {
        set((state) => ({
          files: state.files.map((f) => (f.id === id ? { ...f, content } : f)),
          execution: { ...state.execution, isAssembled: false },
        }));
      },

      setActiveFile: (id) => {
        set({ activeFileId: id });
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

      setDelay: (delay) => {
        set((state) => ({ execution: { ...state.execution, delay } }));
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
          newMemory[address] = value & 0xffff;
          return { memory: newMemory };
        });
      },

      setMemoryBulk: (data) => {
        set((state) => {
          const newMemory = [...state.memory];
          for (const { address, value } of data) {
            newMemory[address] = value & 0xffff;
          }
          return { memory: newMemory };
        });
      },

      resetMemory: () => {
        set({ memory: new Array<number>(4096).fill(0) });
      },

      resetExecution: () => {
        set({
          registers: { ...defaultRegisters },
          memory: new Array<number>(4096).fill(0),
          execution: {
            isRunning: false,
            isAssembled: false,
            currentLine: null,
            delay: get().execution.delay,
            notations: [],
            machineCode: [],
            addressToLine: {},
          },
        });
      },
    }),
    {
      name: "mano-forge-storage",
      partialize: (state) => ({
        files: state.files,
        activeFileId: state.activeFileId,
        execution: { delay: state.execution.delay },
      }),
    },
  ),
);
