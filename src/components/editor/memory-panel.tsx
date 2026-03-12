"use client";

import { useState, useMemo, useEffect } from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import { VscSearch, VscChevronLeft, VscChevronRight } from "react-icons/vsc";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const ROWS_PER_PAGE = 16;

function MemoryPanelInner() {
  const { memory, execution, registers } = useFileStore();
  const { colorScheme } = useThemeStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [cols, setCols] = useState(16);
  const [isMobile, setIsMobile] = useState(false);

  const addressInfo = execution.addressInfo;

  useEffect(() => {
    const updateLayout = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setCols(mobile ? 8 : 16);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
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

  const programAddresses = useMemo(() => {
    return Object.keys(addressInfo ?? {})
      .map(Number)
      .sort((a, b) => a - b);
  }, [addressInfo]);

  const GridView = () => (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between gap-2 border-b px-2 py-1"
        style={{ borderColor: colorScheme.border }}
      >
        <span
          className="text-[10px] font-medium uppercase"
          style={{ color: colorScheme.textMuted }}
        >
          Memory Grid
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(displayPage - 1)}
            disabled={displayPage === 0}
            className="rounded p-0.5 transition-colors disabled:opacity-30"
            style={{ color: colorScheme.textMuted }}
          >
            <VscChevronLeft size={12} />
          </button>
          <span
            className="min-w-[50px] text-center font-mono text-[9px]"
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
            className="rounded p-0.5 transition-colors disabled:opacity-30"
            style={{ color: colorScheme.textMuted }}
          >
            <VscChevronRight size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[10px]">
          <thead>
            <tr>
              <th
                className="sticky top-0 z-10 px-1 py-0.5 text-left"
                style={{
                  backgroundColor: colorScheme.panel,
                  color: colorScheme.textMuted,
                }}
              ></th>
              {Array.from({ length: cols }, (_, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-10 px-0.5 py-0.5 text-center"
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
                    const isPC = registers.PC === addr;
                    const isNonZero = value !== 0;
                    const info = addressInfo?.[addr];
                    const hasInfo = info?.label ?? info?.instruction;

                    return (
                      <td
                        key={col}
                        className="px-0.5 py-0.5 text-center"
                        style={{
                          backgroundColor: isPC
                            ? colorScheme.accent + "40"
                            : isHighlighted
                              ? colorScheme.accent
                              : hasInfo
                                ? colorScheme.accent + "15"
                                : undefined,
                          color: isHighlighted
                            ? colorScheme.background
                            : isNonZero
                              ? colorScheme.text
                              : colorScheme.textMuted,
                        }}
                        title={
                          hasInfo
                            ? `${addr.toString(16).toUpperCase()}: ${info?.label ? info.label + " - " : ""}${info?.instruction ?? ""}`
                            : `${addr.toString(16).toUpperCase()}: ${value.toString(16).toUpperCase().padStart(4, "0")}`
                        }
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

  const ListView = () => (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between gap-2 border-b px-2 py-1"
        style={{ borderColor: colorScheme.border }}
      >
        <span
          className="text-[10px] font-medium uppercase"
          style={{ color: colorScheme.textMuted }}
        >
          Program
        </span>
        <span
          className="font-mono text-[9px]"
          style={{ color: colorScheme.textMuted }}
        >
          {programAddresses.length} addr
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="font-mono text-[11px]">
          {programAddresses.length === 0 ? (
            <div
              className="p-4 text-center text-xs"
              style={{ color: colorScheme.textMuted }}
            >
              No program loaded
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ color: colorScheme.textMuted }}>
                  <th
                    className="sticky top-0 z-10 px-2 py-1 text-left text-[10px]"
                    style={{ backgroundColor: colorScheme.panel }}
                  >
                    Addr
                  </th>
                  <th
                    className="sticky top-0 z-10 px-2 py-1 text-left text-[10px]"
                    style={{ backgroundColor: colorScheme.panel }}
                  >
                    Code
                  </th>
                  <th
                    className="sticky top-0 z-10 px-2 py-1 text-left text-[10px]"
                    style={{ backgroundColor: colorScheme.panel }}
                  >
                    Label
                  </th>
                  <th
                    className="sticky top-0 z-10 px-2 py-1 text-left text-[10px]"
                    style={{ backgroundColor: colorScheme.panel }}
                  >
                    Instruction
                  </th>
                </tr>
              </thead>
              <tbody>
                {programAddresses.map((addr) => {
                  const value = memory[addr] ?? 0;
                  const info = addressInfo?.[addr];
                  const isPC = registers.PC === addr;
                  const isHighlighted = searchAddress === addr;

                  return (
                    <tr
                      key={addr}
                      style={{
                        backgroundColor: isPC
                          ? colorScheme.accent + "30"
                          : isHighlighted
                            ? colorScheme.accent + "20"
                            : undefined,
                      }}
                    >
                      <td
                        className="px-2 py-0.5"
                        style={{ color: colorScheme.accent }}
                      >
                        {isPC ? "▶ " : "  "}
                        {addr.toString(16).toUpperCase().padStart(3, "0")}
                      </td>
                      <td
                        className="px-2 py-0.5"
                        style={{ color: colorScheme.text }}
                      >
                        {value.toString(16).toUpperCase().padStart(4, "0")}
                      </td>
                      <td
                        className="px-2 py-0.5"
                        style={{ color: colorScheme.syntax.label }}
                      >
                        {info?.label ?? ""}
                      </td>
                      <td
                        className="px-2 py-0.5"
                        style={{ color: colorScheme.syntax.instruction }}
                      >
                        {info?.instruction ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ backgroundColor: colorScheme.panel }}
    >
      {/* Search bar */}
      <div
        className="flex items-center gap-2 border-b px-2 py-1.5"
        style={{ borderColor: colorScheme.border }}
      >
        <div
          className="flex flex-1 items-center gap-1 rounded px-2 py-1"
          style={{ backgroundColor: colorScheme.sidebar }}
        >
          <VscSearch size={12} style={{ color: colorScheme.textMuted }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address (hex)"
            className="w-full bg-transparent font-mono text-xs outline-none"
            style={{ color: colorScheme.text }}
          />
        </div>
      </div>

      {/* Split view or stacked on mobile */}
      <div
        className={`flex flex-1 overflow-hidden ${isMobile ? "flex-col" : "flex-row"}`}
      >
        {/* Grid view */}
        <div
          className={`overflow-hidden ${isMobile ? "h-1/2 border-b" : "w-1/2 border-r"}`}
          style={{ borderColor: colorScheme.border }}
        >
          <GridView />
        </div>

        {/* List view */}
        <div className={`overflow-hidden ${isMobile ? "h-1/2" : "w-1/2"}`}>
          <ListView />
        </div>
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
