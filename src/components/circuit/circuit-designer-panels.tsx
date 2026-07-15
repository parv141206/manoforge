import React from "react";
import {
  VscChevronDown,
  VscChevronRight,
  VscDebugPause,
  VscDebugRestart,
  VscDebugStart,
  VscDebugStepOver,
  VscEdit,
  VscJson,
  VscGitMerge,
  VscRefresh,
  VscTrash,
  VscWand,
} from "react-icons/vsc";
import {
  componentDefinitions,
  componentLibrary,
} from "@/lib/circuit/definitions";
import { ComponentSymbol } from "./circuit-component-visuals";
import { useThemeStore } from "@/stores/theme-store";
import type {
  CircuitCategory,
  CircuitComponent,
  CircuitComponentKind,
  CircuitDesign,
  CircuitValidationIssue,
  CircuitWire,
} from "@/lib/circuit/types";

type Point = { x: number; y: number };

const GRID = 20;

const quickPartTypes: CircuitComponentKind[] = [
  "input-pin",
  "output-pin",
  "clock",
  "and",
  "or",
  "not",
  "xor",
  "led",
];

export function PaletteCategory({
  category,
  query,
  collapsed,
  selectedTool,
  onToggle,
  onSelectTool,
}: {
  category: CircuitCategory;
  query: string;
  collapsed: boolean;
  selectedTool: CircuitComponentKind | null;
  onToggle: () => void;
  onSelectTool: (type: CircuitComponentKind) => void;
}) {
  const { colorScheme } = useThemeStore();
  const parts = componentLibrary.filter(
    (definition) =>
      definition.category === category &&
      `${definition.label} ${definition.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (parts.length === 0) return null;
  return (
    <section className="mb-3">
      <button
        onClick={onToggle}
        className="mb-1 flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[10px] font-semibold tracking-wide uppercase"
        style={{ color: colorScheme.textMuted }}
      >
        {collapsed ? (
          <VscChevronRight size={12} />
        ) : (
          <VscChevronDown size={12} />
        )}
        {category}
        <span className="ml-auto font-mono">{parts.length}</span>
      </button>
      {!collapsed && (
        <div className="grid gap-1">
          {parts.map((part) => (
            <button
              key={part.type}
              onClick={() => onSelectTool(part.type)}
              className="rounded border px-2 py-1.5 text-left transition"
              style={{
                backgroundColor:
                  selectedTool === part.type
                    ? colorScheme.active
                    : colorScheme.panel,
                borderColor:
                  selectedTool === part.type
                    ? colorScheme.accent
                    : colorScheme.border,
                color: colorScheme.text,
              }}
              title={part.description}
            >
              <div className="flex items-center gap-2">
                <ComponentSymbol size={22} type={part.type} />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">
                    {part.label}
                  </div>
                  <div
                    className="truncate text-[10px]"
                    style={{ color: colorScheme.textMuted }}
                  >
                    {part.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function CircuitList({
  circuits,
  activeCircuitId,
  selectedCustomCircuitId,
  onAddCircuit,
  onSelectCircuit,
  onDeleteCircuit,
  onUseCircuit,
}: {
  circuits: CircuitDesign[];
  activeCircuitId: string;
  selectedCustomCircuitId: string | null;
  onAddCircuit: () => void;
  onSelectCircuit: (id: string) => void;
  onDeleteCircuit: (id: string) => void;
  onUseCircuit: (id: string) => void;
}) {
  const { colorScheme } = useThemeStore();
  return (
    <section
      className="flex min-h-0 flex-[2] flex-col border-t"
      style={{ borderColor: colorScheme.border }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div
          className="text-[10px] font-semibold tracking-wide uppercase"
          style={{ color: colorScheme.textMuted }}
        >
          Your Circuits
        </div>
        <button
          onClick={onAddCircuit}
          className="rounded px-2 py-1 text-xs"
          style={{
            backgroundColor: colorScheme.hover,
            color: colorScheme.text,
          }}
        >
          New
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {circuits.map((circuit) => {
          const isActive = circuit.id === activeCircuitId;
          const canUse = !isActive;
          const displayName = circuit.name.replace(/\.circuit\.json$/, "");
          return (
            <div
              key={circuit.id}
              className="rounded border p-2"
              style={{
                backgroundColor: isActive
                  ? colorScheme.active
                  : colorScheme.panel,
                borderColor:
                  selectedCustomCircuitId === circuit.id
                    ? colorScheme.accent
                    : colorScheme.border,
              }}
            >
              <button
                onClick={() => onSelectCircuit(circuit.id)}
                className="block w-full truncate text-left text-xs font-semibold"
                style={{ color: colorScheme.text }}
                title={displayName}
              >
                {displayName}
              </button>
              <div
                className="mt-1 text-[10px]"
                style={{ color: colorScheme.textMuted }}
              >
                {circuit.components.length} parts · {circuit.wires.length} wires
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  disabled={!canUse}
                  onClick={() => onUseCircuit(circuit.id)}
                  className="rounded px-2 py-1 text-[10px] disabled:opacity-40"
                  style={{
                    backgroundColor:
                      selectedCustomCircuitId === circuit.id
                        ? colorScheme.accent
                        : colorScheme.hover,
                    color:
                      selectedCustomCircuitId === circuit.id
                        ? colorScheme.background
                        : colorScheme.text,
                  }}
                >
                  Use
                </button>
                <button
                  disabled={circuit.id === "main-circuit"}
                  onClick={() => onDeleteCircuit(circuit.id)}
                  className="rounded px-2 py-1 text-[10px] disabled:opacity-40"
                  style={{
                    backgroundColor: "transparent",
                    color: colorScheme.textMuted,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CircuitToolbar({
  selectedTool,
  clearSelectedTool,
  selectTool,
  wireMode,
  toggleWireMode,
  mode,
  running,
  speedHz,
  tick,
  setMode,
  setRunning,
  setSpeed,
  step,
  tickClock,
  resetSimulation,
  autoRouteMovedWires,
  setAutoRouteMovedWires,
  exportDesign,
  openImport,
}: {
  selectedTool: CircuitComponentKind | null;
  clearSelectedTool: () => void;
  selectTool: (type: CircuitComponentKind) => void;
  wireMode: boolean;
  toggleWireMode: () => void;
  mode: "design" | "sim";
  running: boolean;
  speedHz: number;
  tick: number;
  setMode: (mode: "design" | "sim") => void;
  setRunning: (running: boolean) => void;
  setSpeed: (speedHz: number) => void;
  step: () => void;
  tickClock: () => void;
  resetSimulation: () => void;
  autoRouteMovedWires: boolean;
  setAutoRouteMovedWires: (enabled: boolean) => void;
  exportDesign: () => void;
  openImport: () => void;
}) {
  const { colorScheme } = useThemeStore();
  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded border p-1 shadow-xl"
      style={{
        backgroundColor: colorScheme.panel,
        borderColor: colorScheme.border,
      }}
    >
      <button
        onClick={() => setMode("design")}
        className="rounded px-2 py-1 text-xs"
        style={{
          backgroundColor:
            mode === "design" ? colorScheme.active : "transparent",
          color: colorScheme.text,
        }}
      >
        Design
      </button>
      <button
        onClick={() => setMode("sim")}
        className="rounded px-2 py-1 text-xs"
        style={{
          backgroundColor: mode === "sim" ? colorScheme.active : "transparent",
          color: colorScheme.text,
        }}
      >
        Sim
      </button>
      <div
        className="mx-1 h-5 w-px"
        style={{ backgroundColor: colorScheme.border }}
      />
      {quickPartTypes.map((type) => (
        <button
          key={type}
          onClick={() => selectTool(type)}
          className="rounded px-2 py-1 text-xs"
          style={{
            backgroundColor:
              selectedTool === type ? colorScheme.active : "transparent",
            color:
              selectedTool === type ? colorScheme.text : colorScheme.textMuted,
          }}
          title={componentDefinitions[type].label}
        >
          {componentDefinitions[type].label.replace(" Pin", "")}
        </button>
      ))}
      <div
        className="mx-1 h-5 w-px"
        style={{ backgroundColor: colorScheme.border }}
      />
      {selectedTool && (
        <button
          onClick={clearSelectedTool}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs"
          style={{
            backgroundColor: colorScheme.hover,
            color: colorScheme.text,
          }}
        >
          <VscWand size={14} />
          {componentDefinitions[selectedTool].label}
        </button>
      )}
      <button
        onClick={toggleWireMode}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs"
        style={{
          backgroundColor: wireMode ? colorScheme.active : "transparent",
          color: wireMode ? colorScheme.text : colorScheme.textMuted,
        }}
      >
        <VscWand size={14} />
        Wire
      </button>
      <ToolbarButton
        label={running ? "Pause" : "Run"}
        onClick={() => setRunning(!running)}
        disabled={mode !== "sim"}
      >
        {running ? <VscDebugPause size={15} /> : <VscDebugStart size={15} />}
      </ToolbarButton>
      <ToolbarButton label="Step propagation" onClick={step}>
        <VscDebugStepOver size={15} />
      </ToolbarButton>
      <ToolbarButton
        label="Tick clock"
        onClick={tickClock}
        disabled={mode !== "sim"}
      >
        <VscRefresh size={15} />
      </ToolbarButton>
      <ToolbarButton label="Reset simulation" onClick={resetSimulation}>
        <VscDebugRestart size={15} />
      </ToolbarButton>
      <button
        onClick={() => setAutoRouteMovedWires(!autoRouteMovedWires)}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs"
        style={{
          backgroundColor: autoRouteMovedWires
            ? colorScheme.active
            : "transparent",
          color: autoRouteMovedWires ? colorScheme.text : colorScheme.textMuted,
        }}
        title="Preview and apply compact orthogonal routes while moving components"
      >
        <VscGitMerge size={14} />
        Auto route
      </button>
      <span
        className="px-1 font-mono text-[10px]"
        style={{ color: colorScheme.textMuted }}
      >
        T{tick}
      </span>
      <input
        type="range"
        min="0.25"
        max="20"
        step="0.25"
        value={speedHz}
        onChange={(event) => setSpeed(Number(event.target.value))}
        className="w-24"
        style={{ accentColor: colorScheme.accent }}
      />
      <span
        className="w-10 text-right text-[10px]"
        style={{ color: colorScheme.textMuted }}
      >
        {speedHz.toFixed(1)}Hz
      </span>
      <ToolbarButton label="Import circuit JSON" onClick={openImport}>
        <VscJson size={15} />
      </ToolbarButton>
      <ToolbarButton label="Export circuit JSON" onClick={exportDesign}>
        <VscEdit size={15} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { colorScheme } = useThemeStore();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1.5 transition disabled:cursor-not-allowed disabled:opacity-40"
      style={{ color: colorScheme.textMuted }}
      title={label}
    >
      {children}
    </button>
  );
}

export function IssuePanel({ issues }: { issues: CircuitValidationIssue[] }) {
  const { colorScheme } = useThemeStore();
  const errors = issues.filter((issue) => issue.severity === "error");
  return (
    <div
      className="max-h-40 w-96 overflow-y-auto rounded border p-2 text-xs shadow-xl"
      style={{
        backgroundColor: colorScheme.panel,
        borderColor: colorScheme.border,
        color: colorScheme.text,
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold">Validation</span>
        <span
          style={{
            color: errors.length > 0 ? "#fca5a5" : colorScheme.textMuted,
          }}
        >
          {errors.length} error{errors.length === 1 ? "" : "s"}
        </span>
      </div>
      {issues.length === 0 ? (
        <div style={{ color: colorScheme.textMuted }}>
          Circuit is stable and ready.
        </div>
      ) : (
        <div className="space-y-1">
          {issues.slice(0, 6).map((issue) => (
            <div
              key={issue.id}
              style={{
                color:
                  issue.severity === "error"
                    ? "#fecaca"
                    : colorScheme.textMuted,
              }}
            >
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Inspector({
  component,
  wire,
  freeWireSelected,
  issues,
  updateComponentAttrs,
  updateComponentLabel,
  rotateComponent,
  duplicateSelected,
  deleteSelected,
  deleteFreeWire,
  updateWireWaypoints,
  deleteWire,
}: {
  component: CircuitComponent | undefined;
  wire: CircuitWire | undefined;
  freeWireSelected: boolean;
  issues: CircuitValidationIssue[];
  updateComponentAttrs: (
    id: string,
    attrs: Record<string, boolean | number | string>,
  ) => void;
  updateComponentLabel: (id: string, label: string) => void;
  rotateComponent: (id: string) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  deleteFreeWire: () => void;
  updateWireWaypoints: (id: string, waypoints: Point[]) => void;
  deleteWire: (id: string) => void;
}) {
  const { colorScheme } = useThemeStore();
  if (!component && !wire && freeWireSelected) {
    return (
      <div className="p-3">
        <div
          className="mb-3 text-sm font-semibold"
          style={{ color: colorScheme.text }}
        >
          Free wire
        </div>
        <button
          onClick={deleteFreeWire}
          className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
          style={{
            color: "#fecaca",
            borderColor: "#ef4444",
            backgroundColor: "#ef444422",
          }}
        >
          <VscTrash size={14} />
          Delete free wire
        </button>
      </div>
    );
  }

  if (!component && !wire)
    return (
      <div className="p-4 text-sm" style={{ color: colorScheme.textMuted }}>
        Select a component or wire to edit it.
      </div>
    );

  if (wire) {
    const waypoints = wire.waypoints ?? [];
    return (
      <div className="p-3">
        <div
          className="mb-3 text-sm font-semibold"
          style={{ color: colorScheme.text }}
        >
          Wire
        </div>
        <div className="mb-3 space-y-2">
          <button
            onClick={() =>
              updateWireWaypoints(wire.id, [
                ...waypoints,
                { x: 200 + waypoints.length * GRID, y: 200 },
              ])
            }
            className="w-full rounded border px-3 py-2 text-left text-xs"
            style={{ borderColor: colorScheme.border, color: colorScheme.text }}
          >
            Add bend point
          </button>
          <button
            onClick={() => updateWireWaypoints(wire.id, [])}
            className="w-full rounded border px-3 py-2 text-left text-xs"
            style={{ borderColor: colorScheme.border, color: colorScheme.text }}
          >
            Clear bends
          </button>
          {waypoints.map((point, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="number"
                value={point.x}
                onChange={(event) => {
                  const next = [...waypoints];
                  next[index] = { ...point, x: Number(event.target.value) };
                  updateWireWaypoints(wire.id, next);
                }}
                className="rounded border bg-transparent px-2 py-1 text-xs"
                style={{
                  borderColor: colorScheme.border,
                  color: colorScheme.text,
                }}
              />
              <input
                type="number"
                value={point.y}
                onChange={(event) => {
                  const next = [...waypoints];
                  next[index] = { ...point, y: Number(event.target.value) };
                  updateWireWaypoints(wire.id, next);
                }}
                className="rounded border bg-transparent px-2 py-1 text-xs"
                style={{
                  borderColor: colorScheme.border,
                  color: colorScheme.text,
                }}
              />
              <button
                onClick={() =>
                  updateWireWaypoints(
                    wire.id,
                    waypoints.filter((_, i) => i !== index),
                  )
                }
                className="rounded border px-2 text-xs"
                style={{ borderColor: "#ef4444", color: "#fecaca" }}
              >
                x
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => deleteWire(wire.id)}
          className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
          style={{
            color: "#fecaca",
            borderColor: "#ef4444",
            backgroundColor: "#ef444422",
          }}
        >
          <VscTrash size={14} />
          Delete wire
        </button>
      </div>
    );
  }

  if (!component) return null;
  const definition = componentDefinitions[component.type];
  const componentIssues = issues.filter(
    (issue) => issue.componentId === component.id,
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b p-3" style={{ borderColor: colorScheme.border }}>
        <div
          className="mb-1 text-sm font-semibold"
          style={{ color: colorScheme.text }}
        >
          Inspector
        </div>
        <div className="text-xs" style={{ color: colorScheme.textMuted }}>
          {definition.category} / {definition.label}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <label className="mb-3 block">
          <span
            className="mb-1 block text-[10px] uppercase"
            style={{ color: colorScheme.textMuted }}
          >
            Label
          </span>
          <input
            value={component.label}
            onChange={(event) =>
              updateComponentLabel(component.id, event.target.value)
            }
            className="w-full rounded border bg-transparent px-2 py-1.5 text-sm outline-none"
            style={{ borderColor: colorScheme.border, color: colorScheme.text }}
          />
        </label>
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => rotateComponent(component.id)}
            className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: colorScheme.border, color: colorScheme.text }}
          >
            Rotate
          </button>
          <button
            onClick={duplicateSelected}
            className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: colorScheme.border, color: colorScheme.text }}
          >
            Duplicate
          </button>
          <button
            onClick={deleteSelected}
            className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: "#ef4444", color: "#fecaca" }}
          >
            Delete
          </button>
        </div>
        <div className="space-y-3">
          {definition.attributes.map((attribute) => (
            <AttributeControl
              key={attribute.key}
              component={component}
              attribute={attribute}
              updateComponentAttrs={updateComponentAttrs}
            />
          ))}
        </div>
        {componentIssues.length > 0 && (
          <div
            className="mt-4 rounded border p-2 text-xs"
            style={{ borderColor: "#ef4444", backgroundColor: "#ef444422" }}
          >
            <div className="mb-1 font-semibold" style={{ color: "#fecaca" }}>
              Issues
            </div>
            {componentIssues.map((issue) => (
              <div
                key={issue.id}
                style={{
                  color:
                    issue.severity === "error"
                      ? "#fecaca"
                      : colorScheme.textMuted,
                }}
              >
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttributeControl({
  component,
  attribute,
  updateComponentAttrs,
}: {
  component: CircuitComponent;
  attribute: (typeof componentDefinitions)[CircuitComponentKind]["attributes"][number];
  updateComponentAttrs: (
    id: string,
    attrs: Record<string, boolean | number | string>,
  ) => void;
}) {
  const { colorScheme } = useThemeStore();
  const value = component.attrs[attribute.key];
  return (
    <label className="block">
      <span
        className="mb-1 block text-[10px] uppercase"
        style={{ color: colorScheme.textMuted }}
      >
        {attribute.label}
      </span>
      {attribute.type === "boolean" ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) =>
            updateComponentAttrs(component.id, {
              [attribute.key]: event.target.checked,
            })
          }
          style={{ accentColor: colorScheme.accent }}
        />
      ) : attribute.type === "select" ? (
        <select
          value={String(value)}
          onChange={(event) =>
            updateComponentAttrs(component.id, {
              [attribute.key]: event.target.value,
            })
          }
          className="w-full rounded border bg-transparent px-2 py-1.5 text-sm outline-none"
          style={{ borderColor: colorScheme.border, color: colorScheme.text }}
        >
          {(attribute.options ?? []).map((option) => (
            <option
              key={option}
              value={option}
              style={{ backgroundColor: colorScheme.panel }}
            >
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={attribute.type === "number" ? "number" : "text"}
          min={attribute.min}
          max={attribute.max}
          step={attribute.step}
          value={String(value ?? "")}
          onChange={(event) =>
            updateComponentAttrs(component.id, {
              [attribute.key]:
                attribute.type === "number"
                  ? Number(event.target.value)
                  : event.target.value,
            })
          }
          className="w-full rounded border bg-transparent px-2 py-1.5 text-sm outline-none"
          style={{ borderColor: colorScheme.border, color: colorScheme.text }}
        />
      )}
    </label>
  );
}
