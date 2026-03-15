"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  openFileIds: string[];
  memory: number[];
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
  clearNotations: () => void;
  setMachineCode: (code: string[]) => void;
  setAddressToLine: (mapping: Record<number, number>) => void;
  setAddressInfo: (info: Record<number, AddressInfo>) => void;

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
      openFileIds: ["default-file"],
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
        addressInfo: {},
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
          openFileIds: state.openFileIds.includes(newFile.id)
            ? state.openFileIds
            : [...state.openFileIds, newFile.id],
        }));
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
        set((state) => ({
          activeFileId: id,
          openFileIds:
            id && !state.openFileIds.includes(id)
              ? [...state.openFileIds, id]
              : state.openFileIds,
        }));
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
          const baseName = item.name.endsWith(".asm")
            ? item.name
            : `${item.name}.asm`;
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
        }));
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
            addressInfo: {},
          },
        });
      },
    }),
    {
      name: "mano-forge-storage",
      partialize: (state) => ({
        files: state.files,
        activeFileId: state.activeFileId,
        openFileIds: state.openFileIds,
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
        }
      },
    },
  ),
);
