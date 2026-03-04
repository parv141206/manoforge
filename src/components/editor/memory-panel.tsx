"use client";

import { useState, useMemo, useEffect } from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import { VscSearch, VscChevronLeft, VscChevronRight } from "react-icons/vsc";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const ROWS_PER_PAGE = 16;

function MemoryPanelInner() {
  const { memory } = useFileStore();
  const { colorScheme } = useThemeStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [cols, setCols] = useState(16);

  // Responsive columns based on container width
  useEffect(() => {
    const updateCols = () => {
      // On mobile, use 8 columns; on desktop, use 16
      setCols(window.innerWidth < 640 ? 8 : 16);
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  const totalPages = Math.ceil(4096 / (ROWS_PER_PAGE * cols));

  const searchAddress = useMemo(() => {
    if (!search) return null;
    const addr = parseInt(search, 16);
    return isNaN(addr) ? null : addr;
  }, [search]);

  const displayPage = useMemo(() => {
    if (searchAddress !== null && searchAddress >= 0 && searchAddress < 4096) {
      return Math.floor(searchAddress / (ROWS_PER_PAGE * cols));
    }
    return page;
  }, [searchAddress, page, cols]);

  const startAddr = displayPage * ROWS_PER_PAGE * cols;

  const goToPage = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setPage(newPage);
      setSearch("");
    }
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ backgroundColor: colorScheme.panel }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-2 py-1.5"
        style={{ borderColor: colorScheme.border }}
      >
        <div
          className="flex max-w-[140px] flex-1 items-center gap-1 rounded px-2 py-1"
          style={{ backgroundColor: colorScheme.sidebar }}
        >
          <VscSearch size={12} style={{ color: colorScheme.textMuted }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Address (hex)"
            className="w-full bg-transparent font-mono text-xs outline-none"
            style={{ color: colorScheme.text }}
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(displayPage - 1)}
            disabled={displayPage === 0}
            className="rounded p-1 transition-colors disabled:opacity-30"
            style={{ color: colorScheme.textMuted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colorScheme.hover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <VscChevronLeft size={14} />
          </button>
          <span
            className="min-w-[60px] text-center font-mono text-[10px]"
            style={{ color: colorScheme.textMuted }}
          >
            {startAddr.toString(16).toUpperCase().padStart(3, "0")} -{" "}
            {Math.min(startAddr + ROWS_PER_PAGE * cols - 1, 4095)
              .toString(16)
              .toUpperCase()
              .padStart(3, "0")}
          </span>
          <button
            onClick={() => goToPage(displayPage + 1)}
            disabled={displayPage >= totalPages - 1}
            className="rounded p-1 transition-colors disabled:opacity-30"
            style={{ color: colorScheme.textMuted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colorScheme.hover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <VscChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-1">
        <table className="w-full border-collapse font-mono text-[10px]">
          <thead>
            <tr>
              <th
                className="sticky top-0 px-1 py-0.5 text-left"
                style={{
                  backgroundColor: colorScheme.panel,
                  color: colorScheme.textMuted,
                }}
              ></th>
              {Array.from({ length: cols }, (_, i) => (
                <th
                  key={i}
                  className="sticky top-0 px-0.5 py-0.5 text-center"
                  style={{
                    backgroundColor: colorScheme.panel,
                    color: colorScheme.textMuted,
                  }}
                >
                  {i.toString(16).toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS_PER_PAGE }, (_, row) => {
              const rowStart = startAddr + row * cols;
              if (rowStart >= 4096) return null;

              return (
                <tr key={row}>
                  <td
                    className="px-1 py-0.5"
                    style={{ color: colorScheme.accent }}
                  >
                    {rowStart.toString(16).toUpperCase().padStart(3, "0")}
                  </td>
                  {Array.from({ length: cols }, (_, col) => {
                    const addr = rowStart + col;
                    if (addr >= 4096) return <td key={col} />;

                    const value = memory[addr] ?? 0;
                    const isHighlighted = searchAddress === addr;
                    const isNonZero = value !== 0;

                    return (
                      <td
                        key={col}
                        className="px-0.5 py-0.5 text-center"
                        style={{
                          backgroundColor: isHighlighted
                            ? colorScheme.accent
                            : undefined,
                          color: isHighlighted
                            ? colorScheme.background
                            : isNonZero
                              ? colorScheme.text
                              : colorScheme.textMuted,
                        }}
                        title={`${addr.toString(16).toUpperCase()}: ${value}`}
                      >
                        {value.toString(16).toUpperCase().padStart(4, "0")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MemoryPanel() {
  return (
    <ErrorBoundary>
      <MemoryPanelInner />
    </ErrorBoundary>
  );
}
