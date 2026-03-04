"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

interface ContextMenuState {
  x: number;
  y: number;
  isOpen: boolean;
}

interface ContextMenuContextValue {
  state: ContextMenuState;
  open: (x: number, y: number) => void;
  close: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

interface ContextMenuProps {
  children: React.ReactNode;
}

export function ContextMenu({ children }: ContextMenuProps) {
  const [state, setState] = useState<ContextMenuState>({
    x: 0,
    y: 0,
    isOpen: false,
  });

  const open = useCallback((x: number, y: number) => {
    setState({ x, y, isOpen: true });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <ContextMenuContext.Provider value={{ state, open, close }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

interface ContextMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function ContextMenuTrigger({
  children,
  asChild,
}: ContextMenuTriggerProps) {
  const context = useContext(ContextMenuContext);
  if (!context)
    throw new Error("ContextMenuTrigger must be used within ContextMenu");

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      context.open(e.clientX, e.clientY);
    },
    [context],
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{
        onContextMenu?: React.MouseEventHandler;
      }>,
      {
        onContextMenu: handleContextMenu,
      },
    );
  }

  return <div onContextMenu={handleContextMenu}>{children}</div>;
}

interface ContextMenuContentProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function ContextMenuContent({
  children,
  style,
}: ContextMenuContentProps) {
  const context = useContext(ContextMenuContext);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!context?.state.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        context.close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") context.close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [context]);

  if (!context || !mounted) return null;

  const adjustedX = Math.min(context.state.x, window.innerWidth - 160);
  const adjustedY = Math.min(context.state.y, window.innerHeight - 120);

  return createPortal(
    <AnimatePresence>
      {context.state.isOpen && (
        <motion.div
          ref={menuRef}
          className="fixed z-[100] min-w-[140px] rounded-lg border py-1 shadow-xl"
          style={{ left: adjustedX, top: adjustedY, ...style }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ContextMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function ContextMenuItem({
  children,
  onClick,
  style,
}: ContextMenuItemProps) {
  const context = useContext(ContextMenuContext);

  const handleClick = () => {
    onClick?.();
    context?.close();
  };

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-white/10"
      style={style}
    >
      {children}
    </button>
  );
}
