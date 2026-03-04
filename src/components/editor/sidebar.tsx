"use client";

import { useState, useRef, useEffect } from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import {
  VscNewFile,
  VscFile,
  VscEdit,
  VscTrash,
  VscCloudDownload,
} from "react-icons/vsc";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function SidebarInner() {
  const {
    files,
    activeFileId,
    setActiveFile,
    createFile,
    renameFile,
    deleteFile,
    downloadFile,
  } = useFileStore();
  const { colorScheme } = useThemeStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
    if (newFileName.trim()) {
      createFile(newFileName.trim());
      setNewFileName("");
      setIsCreating(false);
    }
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

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ backgroundColor: colorScheme.sidebar }}
    >
      <div
        className="flex items-center justify-between border-b p-3"
        style={{ borderColor: colorScheme.border }}
      >
        <span
          className="text-sm font-medium tracking-wide uppercase"
          style={{ color: colorScheme.textMuted }}
        >
          Files
        </span>
        <button
          onClick={() => setIsCreating(true)}
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
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {isCreating && (
          <div className="flex items-center gap-2 px-2 py-1">
            <VscFile size={14} style={{ color: colorScheme.textMuted }} />
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
              placeholder="filename.asm"
              className="flex-1 rounded bg-transparent px-1 text-sm outline-none"
              style={{
                color: colorScheme.text,
                border: `1px solid ${colorScheme.accent}`,
              }}
            />
          </div>
        )}

        {files.map((file) => (
          <ContextMenu key={file.id}>
            <ContextMenuTrigger asChild>
              <div
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors"
                style={{
                  backgroundColor:
                    activeFileId === file.id
                      ? colorScheme.active
                      : "transparent",
                  color:
                    activeFileId === file.id
                      ? colorScheme.text
                      : colorScheme.textMuted,
                }}
                onClick={() => setActiveFile(file.id)}
                onMouseEnter={(e) => {
                  if (activeFileId !== file.id) {
                    e.currentTarget.style.backgroundColor = colorScheme.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeFileId !== file.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <VscFile size={14} />
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
            </ContextMenuTrigger>
            <ContextMenuContent
              style={{
                backgroundColor: colorScheme.panel,
                borderColor: colorScheme.border,
              }}
            >
              <ContextMenuItem
                onClick={() => startRename(file.id, file.name)}
                style={{ color: colorScheme.text }}
              >
                <VscEdit size={14} className="mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => downloadFile(file.id)}
                style={{ color: colorScheme.text }}
              >
                <VscCloudDownload size={14} className="mr-2" />
                Download
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => deleteFile(file.id)}
                style={{ color: "#ef4444" }}
              >
                <VscTrash size={14} className="mr-2" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
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
