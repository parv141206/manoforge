"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { CodeEditor } from "./code-editor";
import { RegistersPanel } from "./registers-panel";
import { MemoryPanel } from "./memory-panel";
import { useThemeStore } from "@/stores/theme-store";
import { useUiStore } from "@/stores/ui-store";
import { useFileStore } from "@/stores/file-store";
import { VscMenu, VscSymbolNumeric, VscClose } from "react-icons/vsc";
import { Resizable, ResizablePanel } from "@/components/ui/resizable";

type MobilePanel = "registers" | "memory" | null;
type SplitDirection = "vertical" | "horizontal";
type DropEdge = "left" | "right" | "top" | "bottom";

export function Editor() {
  const { colorScheme } = useThemeStore();
  const { layoutMode } = useUiStore();
  const { activeFileId, files, setActiveFile } = useFileStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = React.useState(false);
  const [activeMobilePanel, setActiveMobilePanel] =
    React.useState<MobilePanel>(null);
  const [splitFileId, setSplitFileId] = React.useState<string | null>(null);
  const [splitDirection, setSplitDirection] =
    React.useState<SplitDirection>("vertical");
  const [dropEdge, setDropEdge] = React.useState<DropEdge | null>(null);
  const [splitRatio, setSplitRatio] = React.useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = React.useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--scrollbar-thumb", colorScheme.active);
    root.style.setProperty("--scrollbar-track", colorScheme.sidebar);
  }, [colorScheme.active, colorScheme.sidebar]);

  React.useEffect(() => {
    if (!splitFileId) return;
    const exists = files.some((f) => f.id === splitFileId);
    if (!exists) {
      setSplitFileId(null);
    }
  }, [files, splitFileId]);

  React.useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMove = (e: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio =
        splitDirection === "vertical"
          ? ((e.clientX - rect.left) / rect.width) * 100
          : ((e.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.min(80, Math.max(20, ratio));
      setSplitRatio(clamped);
    };

    const handleUp = () => {
      setIsDraggingSplit(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor =
      splitDirection === "vertical" ? "col-resize" : "row-resize";

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDraggingSplit, splitDirection]);

  const handlePanelToggle = () => {
    setMobilePanelOpen(!mobilePanelOpen);
    if (!mobilePanelOpen) {
      setActiveMobilePanel("registers");
    }
  };

  const handleEditorDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const fileId =
      e.dataTransfer.getData("application/x-mano-file-id") ||
      e.dataTransfer.getData("text/plain");
    if (!fileId) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const dist = {
      left: x,
      right: 1 - x,
      top: y,
      bottom: 1 - y,
    };
    const edge = (Object.entries(dist).sort((a, b) => a[1] - b[1])[0]?.[0] ??
      "right") as DropEdge;
    setDropEdge(edge);
  };

  const handleEditorDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fileId =
      e.dataTransfer.getData("application/x-mano-file-id") ||
      e.dataTransfer.getData("text/plain");
    if (!fileId) return;

    const edge = dropEdge ?? "right";
    setDropEdge(null);

    const nextDirection: SplitDirection =
      edge === "left" || edge === "right" ? "vertical" : "horizontal";
    setSplitDirection(nextDirection);

    if (!activeFileId) {
      setActiveFile(fileId);
      return;
    }

    if (edge === "left" || edge === "top") {
      setSplitFileId(activeFileId);
      setActiveFile(fileId);
      return;
    }

    setSplitFileId(fileId);
  };

  const replacePrimaryPaneFile = (fileId: string) => {
    setActiveFile(fileId);
  };

  const replaceSecondaryPaneFile = (fileId: string) => {
    if (!fileId) return;
    setSplitFileId(fileId);
  };

  return (
    <div
      className={`flex h-screen flex-col ${layoutMode === "compact" ? "gap-0 p-0" : "gap-2 p-2 md:gap-3 md:p-3"}`}
      style={{
        backgroundColor: colorScheme.background,
        color: colorScheme.text,
      }}
    >
      <div
        className={`flex h-12 items-center gap-2 md:h-14 ${layoutMode === "compact" ? "px-0" : ""}`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded p-2 transition-colors md:hidden"
          style={{
            backgroundColor: colorScheme.panel,
            color: colorScheme.textMuted,
          }}
        >
          <VscMenu size={20} />
        </button>
        <div className="h-full flex-1">
          <Header />
        </div>
        <button
          onClick={handlePanelToggle}
          className="rounded p-2 transition-colors md:hidden"
          style={{
            backgroundColor: colorScheme.panel,
            color: colorScheme.textMuted,
          }}
        >
          <VscSymbolNumeric size={20} />
        </button>
      </div>

      <div className="hidden flex-1 overflow-hidden md:flex">
        <Resizable
          direction="vertical"
          defaultSizes={[75, 25]}
          minSizes={[30, 15]}
          maxSizes={[90, 70]}
        >
          <ResizablePanel className="h-full">
            <Resizable
              direction="horizontal"
              defaultSizes={[18, 60, 22]}
              minSizes={[10, 30, 15]}
              maxSizes={[30, 80, 35]}
            >
              <ResizablePanel className="h-full">
                <Sidebar />
              </ResizablePanel>

              <ResizablePanel className="h-full">
                <div
                  ref={splitContainerRef}
                  className="relative h-full overflow-hidden"
                  onDragOver={handleEditorDragOver}
                  onDrop={handleEditorDrop}
                  onDragLeave={(e) => {
                    if (e.currentTarget === e.target) {
                      setDropEdge(null);
                    }
                  }}
                >
                  {splitFileId ? (
                    <div
                      className={`flex h-full w-full transition-all duration-200 ${splitDirection === "vertical" ? "flex-row" : "flex-col"}`}
                    >
                      <div
                        className={`transition-all duration-200 ${splitDirection === "vertical" ? "h-full border-r" : "w-full border-b"}`}
                        style={{
                          borderColor: colorScheme.border,
                          width:
                            splitDirection === "vertical"
                              ? `${splitRatio}%`
                              : undefined,
                          height:
                            splitDirection === "horizontal"
                              ? `${splitRatio}%`
                              : undefined,
                        }}
                      >
                        <CodeEditor
                          fileIdOverride={activeFileId ?? undefined}
                          onExternalFileDrop={replacePrimaryPaneFile}
                        />
                      </div>

                      <div
                        onMouseDown={() => setIsDraggingSplit(true)}
                        className={`z-20 shrink-0 transition-colors ${splitDirection === "vertical" ? "h-full w-px cursor-col-resize" : "h-px w-full cursor-row-resize"}`}
                        style={{
                          backgroundColor: isDraggingSplit
                            ? colorScheme.accent
                            : colorScheme.border,
                        }}
                      />

                      <div className="relative min-h-0 min-w-0 flex-1 transition-all duration-200">
                        <div
                          className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded px-1 py-1"
                          style={{
                            backgroundColor: colorScheme.panel,
                            border: `1px solid ${colorScheme.border}`,
                          }}
                        >
                          <button
                            onClick={() =>
                              setSplitDirection((prev) =>
                                prev === "vertical" ? "horizontal" : "vertical",
                              )
                            }
                            className="rounded px-1.5 py-0.5 text-[10px]"
                            style={{ color: colorScheme.textMuted }}
                            title="Toggle split direction"
                          >
                            {splitDirection === "vertical" ? "↕" : "↔"}
                          </button>
                          <button
                            onClick={() => setSplitFileId(null)}
                            className="rounded px-1.5 py-0.5 text-[10px]"
                            style={{ color: colorScheme.textMuted }}
                            title="Close split"
                          >
                            Close split
                          </button>
                        </div>
                        <CodeEditor
                          fileIdOverride={splitFileId}
                          onExternalFileDrop={replaceSecondaryPaneFile}
                        />
                      </div>
                    </div>
                  ) : (
                    <CodeEditor />
                  )}

                  {dropEdge && (
                    <div className="pointer-events-none absolute inset-0 z-30 p-2">
                      <div
                        className="relative h-full w-full rounded border-2 border-dashed p-1.5"
                        style={{ borderColor: colorScheme.accent }}
                      >
                        <div
                          className="absolute inset-y-1.5 left-1.5 flex w-[22%] items-center justify-center rounded text-[11px] font-medium"
                          style={{
                            color: colorScheme.text,
                            backgroundColor:
                              dropEdge === "left"
                                ? `${colorScheme.accent}33`
                                : `${colorScheme.panel}cc`,
                            border: `1px solid ${
                              dropEdge === "left"
                                ? colorScheme.accent
                                : colorScheme.border
                            }`,
                          }}
                        >
                          Left
                        </div>
                        <div
                          className="absolute inset-y-1.5 right-1.5 flex w-[22%] items-center justify-center rounded text-[11px] font-medium"
                          style={{
                            color: colorScheme.text,
                            backgroundColor:
                              dropEdge === "right"
                                ? `${colorScheme.accent}33`
                                : `${colorScheme.panel}cc`,
                            border: `1px solid ${
                              dropEdge === "right"
                                ? colorScheme.accent
                                : colorScheme.border
                            }`,
                          }}
                        >
                          Right
                        </div>
                        <div
                          className="absolute inset-x-[24%] top-1.5 flex h-[22%] items-center justify-center rounded text-[11px] font-medium"
                          style={{
                            color: colorScheme.text,
                            backgroundColor:
                              dropEdge === "top"
                                ? `${colorScheme.accent}33`
                                : `${colorScheme.panel}cc`,
                            border: `1px solid ${
                              dropEdge === "top"
                                ? colorScheme.accent
                                : colorScheme.border
                            }`,
                          }}
                        >
                          Top
                        </div>
                        <div
                          className="absolute inset-x-[24%] bottom-1.5 flex h-[22%] items-center justify-center rounded text-[11px] font-medium"
                          style={{
                            color: colorScheme.text,
                            backgroundColor:
                              dropEdge === "bottom"
                                ? `${colorScheme.accent}33`
                                : `${colorScheme.panel}cc`,
                            border: `1px solid ${
                              dropEdge === "bottom"
                                ? colorScheme.accent
                                : colorScheme.border
                            }`,
                          }}
                        >
                          Bottom
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizablePanel className="h-full">
                <RegistersPanel />
              </ResizablePanel>
            </Resizable>
          </ResizablePanel>

          <ResizablePanel className="h-full">
            <MemoryPanel />
          </ResizablePanel>
        </Resizable>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden md:hidden">
        <div className="flex-1 overflow-hidden">
          <CodeEditor />
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-64 p-2 md:hidden"
              style={{ backgroundColor: colorScheme.background }}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobilePanelOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobilePanelOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 h-[70vh] rounded-t-xl p-3 md:hidden"
              style={{ backgroundColor: colorScheme.panel }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveMobilePanel("registers")}
                    className="rounded px-3 py-1.5 text-sm font-medium transition"
                    style={{
                      backgroundColor:
                        activeMobilePanel === "registers"
                          ? colorScheme.active
                          : "transparent",
                      color:
                        activeMobilePanel === "registers"
                          ? colorScheme.text
                          : colorScheme.textMuted,
                    }}
                  >
                    Registers
                  </button>
                  <button
                    onClick={() => setActiveMobilePanel("memory")}
                    className="rounded px-3 py-1.5 text-sm font-medium transition"
                    style={{
                      backgroundColor:
                        activeMobilePanel === "memory"
                          ? colorScheme.active
                          : "transparent",
                      color:
                        activeMobilePanel === "memory"
                          ? colorScheme.text
                          : colorScheme.textMuted,
                    }}
                  >
                    Memory
                  </button>
                </div>
                <button
                  onClick={() => setMobilePanelOpen(false)}
                  className="rounded p-1.5 transition-colors"
                  style={{ color: colorScheme.textMuted }}
                >
                  <VscClose size={18} />
                </button>
              </div>

              <div className="h-[calc(100%-48px)] overflow-hidden">
                {activeMobilePanel === "registers" && <RegistersPanel />}
                {activeMobilePanel === "memory" && <MemoryPanel />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div
        className="flex h-6 items-center justify-between border-t px-2 text-[11px]"
        style={{
          borderColor:
            layoutMode === "compact" ? colorScheme.border : "transparent",
          backgroundColor:
            layoutMode === "floating"
              ? colorScheme.background
              : colorScheme.sidebar,
          color: colorScheme.textMuted,
        }}
      >
        <a
          href="https://github.com/parv141206"
          target="_blank"
          rel="noreferrer"
          className="truncate"
          style={{ color: colorScheme.textMuted }}
        >
          Made with love by parv141206
        </a>
        <span className="hidden truncate md:block">
          Ctrl+Shift+F format • Ctrl+/ comment • Ctrl+D duplicate • Alt+↑/↓ move
          line • Ctrl+Space suggest • Ctrl/Cmd+Wheel editor zoom
        </span>
      </div>
    </div>
  );
}

export default Editor;
