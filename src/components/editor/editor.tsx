"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { CodeEditor } from "./code-editor";
import { RegistersPanel } from "./registers-panel";
import { MemoryPanel } from "./memory-panel";
import { useThemeStore } from "@/stores/theme-store";
import { VscMenu, VscSymbolNumeric, VscClose } from "react-icons/vsc";
import { Resizable, ResizablePanel } from "@/components/ui/resizable";

type MobilePanel = "registers" | "memory" | null;

export function Editor() {
  const { colorScheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = React.useState(false);
  const [activeMobilePanel, setActiveMobilePanel] =
    React.useState<MobilePanel>(null);

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handlePanelToggle = () => {
    setMobilePanelOpen(!mobilePanelOpen);
    if (!mobilePanelOpen) {
      setActiveMobilePanel("registers");
    }
  };

  return (
    <div
      className="flex h-screen flex-col gap-2 p-2 md:p-3"
      style={{
        backgroundColor: colorScheme.background,
        color: colorScheme.text,
      }}
    >
      <div className="flex h-12 items-center gap-2 md:h-14">
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
                <CodeEditor />
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
    </div>
  );
}

export default Editor;
