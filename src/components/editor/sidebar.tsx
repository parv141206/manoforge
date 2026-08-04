"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useFileStore } from "@/stores/file-store";
import { useShallow } from "zustand/react/shallow";
import { useThemeStore } from "@/stores/theme-store";
import { useUiStore } from "@/stores/ui-store";
import {
  VscNewFile,
  VscEdit,
  VscTrash,
  VscCloudDownload,
  VscCloudUpload,
} from "react-icons/vsc";
import { TbAssembly } from "react-icons/tb";
import JSZip from "jszip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function SidebarInner() {
  const fileIds = useFileStore(
    useShallow((state) => state.files.map((file) => file.id)),
  );
  const fileNames = useFileStore(
    useShallow((state) => state.files.map((file) => file.name)),
  );
  const files = useMemo(
    () => fileIds.map((id, index) => ({ id, name: fileNames[index] ?? "" })),
    [fileIds, fileNames],
  );
  const {
    activeFileId,
    setActiveFile,
    createFile,
    createFiles,
    renameFile,
    deleteFile,
    deleteFiles,
    downloadFile,
    downloadFiles,
    architecture,
  } = useFileStore(
    useShallow((state) => ({
      activeFileId: state.activeFileId,
      setActiveFile: state.setActiveFile,
      createFile: state.createFile,
      createFiles: state.createFiles,
      renameFile: state.renameFile,
      deleteFile: state.deleteFile,
      deleteFiles: state.deleteFiles,
      downloadFile: state.downloadFile,
      downloadFiles: state.downloadFiles,
      architecture: state.architecture,
    })),
  );
  const { colorScheme } = useThemeStore();
  const layoutMode = useUiStore((state) => state.layoutMode);
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [contextFileId, setContextFileId] = useState<string | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );
  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const createCommittedRef = useRef(false);

  useEffect(() => {
    if (isCreating && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleCreate = () => {
    const name = newFileName.trim();
    if (!name || createCommittedRef.current) return;
    createCommittedRef.current = true;
    createFile(name);
    setNewFileName("");
    setIsCreating(false);
    window.requestAnimationFrame(() => {
      createCommittedRef.current = false;
    });
  };

  const handleRename = (id: string) => {
    if (editingName.trim()) {
      renameFile(id, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const clearSelection = () => {
    setSelectedFileIds([]);
    setLastSelectedIndex(null);
  };

  const handleImportZipClick = () => {
    importInputRef.current?.click();
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const asmEntries = Object.values(zip.files).filter(
        (entry) => !entry.dir && /\.(asm|a85)$/i.test(entry.name.toLowerCase()),
      );

      const importedFiles: { name: string; content: string }[] = [];
      for (const entry of asmEntries) {
        const content = await entry.async("string");
        const name = entry.name.split("/").pop() ?? entry.name;
        importedFiles.push({ name, content });
      }

      if (importedFiles.length > 0) {
        createFiles(importedFiles);
      }
    } finally {
      e.target.value = "";
    }
  };

  const handleExportZip = async (ids?: string[]) => {
    const currentFiles = useFileStore.getState().files;
    const chosen = ids && ids.length > 0 ? ids : currentFiles.map((f) => f.id);
    if (chosen.length === 0) return;

    const selected = currentFiles.filter((f) => chosen.includes(f.id));
    const zip = new JSZip();
    for (const file of selected) {
      zip.file(file.name, file.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mano-forge-programs.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileClick = (
    e: React.MouseEvent<HTMLDivElement>,
    fileId: string,
    index: number,
  ) => {
    const isRange = e.shiftKey;
    const isToggle = e.ctrlKey || e.metaKey;

    if (isRange && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = files.slice(start, end + 1).map((f) => f.id);
      setSelectedFileIds(rangeIds);
      setActiveFile(fileId);
      return;
    }

    if (isToggle) {
      setSelectedFileIds((prev) =>
        prev.includes(fileId)
          ? prev.filter((id) => id !== fileId)
          : [...prev, fileId],
      );
      setLastSelectedIndex(index);
      setActiveFile(fileId);
      return;
    }

    setSelectedFileIds([fileId]);
    setLastSelectedIndex(index);
    setActiveFile(fileId);
  };

  const ensureContextSelection = (id: string, index: number) => {
    if (!selectedFileIds.includes(id)) {
      setSelectedFileIds([id]);
      setLastSelectedIndex(index);
      setActiveFile(id);
    }
  };

  const selectedCount = selectedFileIds.length;

  return (
    <div
      className={`flex h-full flex-col overflow-hidden ${layoutMode === "compact" ? "rounded-none" : "rounded-lg"}`}
      style={{
        backgroundColor: colorScheme.sidebar,
        border:
          layoutMode === "compact"
            ? `1px solid ${colorScheme.border}66`
            : `1px solid ${colorScheme.border}`,
      }}
    >
      <div
        className="flex items-center justify-between border-b p-3"
        style={{ borderColor: colorScheme.border }}
      >
        <span
          className="text-sm font-medium tracking-wide uppercase"
          style={{ color: colorScheme.textMuted }}
        >
          Files {selectedCount > 0 ? `(${selectedCount})` : ""}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleImportZipClick}
            className="rounded p-1 transition-colors"
            style={{ color: colorScheme.textMuted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colorScheme.hover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            title="Import zip"
          >
            <VscCloudUpload size={16} />
          </button>
          <button
            onClick={() => void handleExportZip()}
            className="rounded p-1 transition-colors"
            style={{ color: colorScheme.textMuted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colorScheme.hover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            title="Export zip"
          >
            <VscCloudDownload size={16} />
          </button>
          <button
            onClick={() => {
              createCommittedRef.current = false;
              setIsCreating(true);
            }}
            className="rounded p-1 transition-colors"
            style={{ color: colorScheme.textMuted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colorScheme.hover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            title="New File"
          >
            <VscNewFile size={16} />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => void handleImportZip(e)}
          />
        </div>
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex-1 space-y-1 overflow-y-auto p-2"
            onContextMenuCapture={(e) => {
              const row = (e.target as HTMLElement).closest<HTMLElement>(
                "[data-file-id]",
              );
              const id = row?.dataset.fileId ?? null;
              setContextFileId(id);
              if (id) {
                const index = files.findIndex((file) => file.id === id);
                if (index >= 0) ensureContextSelection(id, index);
              }
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                clearSelection();
              }
            }}
          >
            {isCreating && (
              <div className="flex items-center gap-2 px-2 py-1">
                <TbAssembly
                  size={14}
                  style={{ color: colorScheme.textMuted }}
                />
                <input
                  ref={createInputRef}
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onBlur={() => {
                    if (!newFileName.trim()) setIsCreating(false);
                    else handleCreate();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setNewFileName("");
                    }
                  }}
                  placeholder={
                    architecture === "8085" ? "filename.a85" : "filename.asm"
                  }
                  className="flex-1 rounded bg-transparent px-1 text-sm outline-none"
                  style={{
                    color: colorScheme.text,
                    border: `1px solid ${colorScheme.accent}`,
                  }}
                />
              </div>
            )}

            {files.map((file, index) => {
              const isSelected = selectedFileIds.includes(file.id);
              return (
                <div
                  key={file.id}
                  data-file-id={file.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "copyMove";
                    e.dataTransfer.setData(
                      "application/x-mano-file-id",
                      file.id,
                    );
                    e.dataTransfer.setData("text/plain", file.id);
                  }}
                  style={{
                    backgroundColor: isSelected
                      ? `${colorScheme.accent}28`
                      : activeFileId === file.id
                        ? colorScheme.active
                        : "transparent",
                    color:
                      activeFileId === file.id
                        ? colorScheme.text
                        : colorScheme.textMuted,
                  }}
                  onClick={(e) => handleFileClick(e, file.id, index)}
                  onMouseEnter={(e) => {
                    if (!isSelected && activeFileId !== file.id) {
                      e.currentTarget.style.backgroundColor = colorScheme.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && activeFileId !== file.id) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <TbAssembly size={14} />
                  {editingId === file.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRename(file.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(file.id);
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditingName("");
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded bg-transparent px-1 text-sm outline-none"
                      style={{
                        color: colorScheme.text,
                        border: `1px solid ${colorScheme.accent}`,
                      }}
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm">{file.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          style={{
            backgroundColor: colorScheme.panel,
            borderColor: colorScheme.border,
          }}
        >
          {contextFileId ? (
            <>
              <ContextMenuItem
                onClick={() => {
                  const ids = selectedFileIds.includes(contextFileId)
                    ? selectedFileIds
                    : [contextFileId];
                  void handleExportZip(ids);
                }}
                style={{ color: colorScheme.text }}
              >
                <VscCloudDownload size={14} className="mr-2" />
                Export selected as zip
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const file = files.find((item) => item.id === contextFileId);
                  if (file) startRename(file.id, file.name);
                }}
                style={{ color: colorScheme.text }}
              >
                <VscEdit size={14} className="mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const ids = selectedFileIds.includes(contextFileId)
                    ? selectedFileIds
                    : [contextFileId];
                  if (ids.length > 1) downloadFiles(ids);
                  else downloadFile(ids[0]!);
                }}
                style={{ color: colorScheme.text }}
              >
                <VscCloudDownload size={14} className="mr-2" />
                Download {selectedFileIds.length > 1 ? "selected" : "file"}
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  const ids = selectedFileIds.includes(contextFileId)
                    ? selectedFileIds
                    : [contextFileId];
                  if (ids.length > 1) deleteFiles(ids);
                  else deleteFile(ids[0]!);
                  clearSelection();
                }}
                style={{ color: "#ef4444" }}
              >
                <VscTrash size={14} className="mr-2" />
                Delete {selectedFileIds.length > 1 ? "selected" : "file"}
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem
                onClick={() => {
                  createCommittedRef.current = false;
                  setIsCreating(true);
                }}
                style={{ color: colorScheme.text }}
              >
                <VscNewFile size={14} className="mr-2" />
                New file
              </ContextMenuItem>
              <ContextMenuItem
                onClick={handleImportZipClick}
                style={{ color: colorScheme.text }}
              >
                <VscCloudUpload size={14} className="mr-2" />
                Import zip
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => void handleExportZip()}
                style={{ color: colorScheme.text }}
              >
                <VscCloudDownload size={14} className="mr-2" />
                Export all as zip
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  if (selectedFileIds.length > 0) {
                    deleteFiles(selectedFileIds);
                    clearSelection();
                  }
                }}
                style={{
                  color:
                    selectedFileIds.length > 0
                      ? "#ef4444"
                      : colorScheme.textMuted,
                }}
              >
                <VscTrash size={14} className="mr-2" />
                Delete selected
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

export function Sidebar() {
  return (
    <ErrorBoundary>
      <SidebarInner />
    </ErrorBoundary>
  );
}
