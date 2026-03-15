"use client";

import React from "react";
import { useThemeStore } from "@/stores/theme-store";
import { useUiStore } from "@/stores/ui-store";

interface ResizableProps {
  children: React.ReactNode;
  direction: "horizontal" | "vertical";
  defaultSizes?: number[];
  minSizes?: number[];
  maxSizes?: number[];
  onResize?: (sizes: number[]) => void;
  className?: string;
}

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ResizablePanel({
  children,
  className = "",
  style,
}: PanelProps) {
  return (
    <div className={`overflow-hidden ${className}`} style={style}>
      {children}
    </div>
  );
}

interface HandleProps {
  direction: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}

function ResizeHandle({ direction, onMouseDown }: HandleProps) {
  const { colorScheme } = useThemeStore();
  const { layoutMode } = useUiStore();
  const [isHovered, setIsHovered] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    onMouseDown(e);

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className={`relative shrink-0 ${
        direction === "horizontal"
          ? `${layoutMode === "compact" ? "w-px" : "w-px"} cursor-col-resize`
          : `${layoutMode === "compact" ? "h-px" : "h-px"} cursor-row-resize`
      }`}
      style={{
        backgroundColor: isDragging
          ? colorScheme.accent
          : isHovered
            ? `${colorScheme.accent}99`
            : colorScheme.border,
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
}

export function Resizable({
  children,
  direction,
  defaultSizes,
  minSizes = [],
  maxSizes = [],
  onResize,
  className = "",
}: ResizableProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = React.useState<number[]>(defaultSizes ?? []);
  const panelCount = React.Children.count(children);

  React.useEffect(() => {
    if (sizes.length === 0 && panelCount > 0) {
      const equalSize = 100 / panelCount;
      setSizes(Array(panelCount).fill(equalSize));
    }
  }, [panelCount, sizes.length]);

  const handleResize = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const startPos = direction === "horizontal" ? e.clientX : e.clientY;
    const containerSize =
      direction === "horizontal"
        ? container.offsetWidth
        : container.offsetHeight;

    const startSizes = [...sizes];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos =
        direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const deltaPercent = (delta / containerSize) * 100;

      const newSizes = [...startSizes];
      const leftIdx = index;
      const rightIdx = index + 1;

      let newLeftSize = startSizes[leftIdx]! + deltaPercent;
      let newRightSize = startSizes[rightIdx]! - deltaPercent;

      const minLeft = minSizes[leftIdx] ?? 5;
      const minRight = minSizes[rightIdx] ?? 5;
      const maxLeft = maxSizes[leftIdx] ?? 95;
      const maxRight = maxSizes[rightIdx] ?? 95;

      if (newLeftSize < minLeft) {
        newLeftSize = minLeft;
        newRightSize = startSizes[leftIdx]! + startSizes[rightIdx]! - minLeft;
      }
      if (newRightSize < minRight) {
        newRightSize = minRight;
        newLeftSize = startSizes[leftIdx]! + startSizes[rightIdx]! - minRight;
      }
      if (newLeftSize > maxLeft) {
        newLeftSize = maxLeft;
        newRightSize = startSizes[leftIdx]! + startSizes[rightIdx]! - maxLeft;
      }
      if (newRightSize > maxRight) {
        newRightSize = maxRight;
        newLeftSize = startSizes[leftIdx]! + startSizes[rightIdx]! - maxRight;
      }

      newSizes[leftIdx] = newLeftSize;
      newSizes[rightIdx] = newRightSize;

      setSizes(newSizes);
      onResize?.(newSizes);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor =
      direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const childArray = React.Children.toArray(children);

  return (
    <div
      ref={containerRef}
      className={`flex ${direction === "horizontal" ? "flex-row" : "flex-col"} ${className}`}
      style={{ width: "100%", height: "100%" }}
    >
      {childArray.map((child, i) => (
        <React.Fragment key={i}>
          <div
            style={{
              [direction === "horizontal" ? "width" : "height"]:
                `${sizes[i] ?? 100 / panelCount}%`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {child}
          </div>
          {i < childArray.length - 1 && (
            <ResizeHandle
              direction={direction}
              onMouseDown={(e) => handleResize(i, e)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
