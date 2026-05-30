"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { componentDefinitions } from "@/lib/circuit/definitions";
import { simulateCircuit, validateCircuit } from "@/lib/circuit/simulator";
import type {
  CircuitAttrs,
  CircuitComponent,
  CircuitComponentKind,
  CircuitDesign,
  CircuitMode,
  CircuitSimulationState,
  CircuitValidationIssue,
  CircuitViewport,
  PortSpec,
  WireEndpoint,
} from "@/lib/circuit/types";
import { clampWidth, toNumber, valueKey } from "@/lib/circuit/values";

const gridSize = 20;

const snap = (value: number) => Math.round(value / gridSize) * gridSize;

const sameIds = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);

const sameViewport = (left: CircuitViewport, right: CircuitViewport) =>
  Math.abs(left.x - right.x) < 0.01 &&
  Math.abs(left.y - right.y) < 0.01 &&
  Math.abs(left.zoom - right.zoom) < 0.0001;

const generateId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

type CircuitFreeWire = {
  id: string;
  points: Array<{ x: number; y: number }>;
};

type CircuitEditorSettings = {
  autoRouteMovedWires: boolean;
};

const defaultEditorSettings: CircuitEditorSettings = {
  autoRouteMovedWires: true,
};

const circuitStorage: PersistStorage<unknown> = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    try {
      const value = window.localStorage.getItem(name);
      return value ? (JSON.parse(value) as StorageValue<unknown>) : null;
    } catch {
      window.localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
    } catch {
      // Private browsing and restricted embeds may deny storage writes.
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Storage removal is best-effort in restricted browser contexts.
    }
  },
};

const defaultDesign = (): CircuitDesign => ({
  id: "main-circuit",
  name: "main.circuit.json",
  components: [
    {
      id: "input-a",
      type: "input-pin",
      label: "A",
      x: 80,
      y: 140,
      rotation: 0,
      attrs: { width: 1, value: 0 },
    },
    {
      id: "input-b",
      type: "input-pin",
      label: "B",
      x: 80,
      y: 180,
      rotation: 0,
      attrs: { width: 1, value: 1 },
    },
    {
      id: "and-demo",
      type: "and",
      label: "AND",
      x: 340,
      y: 160,
      rotation: 0,
      attrs: { width: 1, inputs: 2 },
    },
    {
      id: "led-demo",
      type: "led",
      label: "LED",
      x: 600,
      y: 160,
      rotation: 0,
      attrs: { activeHigh: true },
    },
  ],
  wires: [
    {
      id: "wire-a",
      source: { componentId: "input-a", portId: "out" },
      target: { componentId: "and-demo", portId: "in0" },
    },
    {
      id: "wire-b",
      source: { componentId: "input-b", portId: "out" },
      target: { componentId: "and-demo", portId: "in1" },
    },
    {
      id: "wire-led",
      source: { componentId: "and-demo", portId: "out" },
      target: { componentId: "led-demo", portId: "in" },
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedIds: [],
  simulation: { mode: "design", running: false, speedHz: 2, tick: 0 },
});

interface CircuitStore {
  design: CircuitDesign;
  circuits: CircuitDesign[];
  activeCircuitId: string;
  freeWires: CircuitFreeWire[];
  freeWiresByCircuit: Record<string, CircuitFreeWire[]>;
  editorSettings: CircuitEditorSettings;
  simulation: CircuitSimulationState;
  issues: CircuitValidationIssue[];
  addCircuit: () => void;
  setActiveCircuit: (id: string) => void;
  deleteCircuit: (id: string) => void;
  setMode: (mode: CircuitMode) => void;
  setRunning: (running: boolean) => void;
  setSpeed: (speedHz: number) => void;
  setViewport: (viewport: CircuitViewport) => void;
  setSelectedIds: (ids: string[]) => void;
  setFreeWires: (
    value:
      | CircuitFreeWire[]
      | ((current: CircuitFreeWire[]) => CircuitFreeWire[]),
  ) => void;
  setAutoRouteMovedWires: (enabled: boolean) => void;
  addComponent: (type: CircuitComponentKind, x: number, y: number) => void;
  addCustomCircuitComponent: (circuitId: string, x: number, y: number) => void;
  addComponents: (
    components: CircuitComponent[],
    wires: Array<{
      source: WireEndpoint;
      target: WireEndpoint;
      waypoints?: Array<{ x: number; y: number }>;
    }>,
  ) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  moveComponent: (id: string, x: number, y: number) => void;
  moveComponents: (positions: Record<string, { x: number; y: number }>) => void;
  updateComponentAttrs: (id: string, attrs: CircuitAttrs) => void;
  updateComponentLabel: (id: string, label: string) => void;
  rotateComponent: (
    id: string,
    rotation?: CircuitComponent["rotation"],
  ) => void;
  addWire: (source: WireEndpoint, target: WireEndpoint) => void;
  addWireWithWaypoints: (
    source: WireEndpoint,
    target: WireEndpoint,
    waypoints: Array<{ x: number; y: number }>,
  ) => void;
  updateWire: (id: string, source: WireEndpoint, target: WireEndpoint) => void;
  updateWireWaypoints: (
    id: string,
    waypoints: Array<{ x: number; y: number }>,
  ) => void;
  deleteWire: (id: string) => void;
  toggleInput: (componentId: string) => void;
  tickClock: () => void;
  step: () => void;
  resetSimulation: () => void;
  importDesign: (design: CircuitDesign) => void;
}

const validateAndSimulate = (
  design: CircuitDesign,
  circuits: CircuitDesign[] = [design],
  previous?: CircuitSimulationState,
  options?: { tick?: boolean; reset?: boolean },
) => {
  const simulation = simulateCircuit(design, previous, options, circuits);
  return {
    simulation,
    issues:
      simulation.issues.length > 0
        ? simulation.issues
        : validateCircuit(design),
  };
};

export const useCircuitStore = create<CircuitStore>()(
  persist(
    (set, get) => {
      const initialDesign = defaultDesign();
      const initialCircuits = [initialDesign];
      const initial = validateAndSimulate(initialDesign, initialCircuits);

      const commit = (
        updater: (design: CircuitDesign) => CircuitDesign,
        options?: { tick?: boolean; reset?: boolean },
      ) => {
        set((state) => {
          const updatedDesign = updater(state.design);
          const syncedCircuits = syncCircuitReferences(
            replaceCircuit(
              state.circuits,
              state.activeCircuitId,
              updatedDesign,
            ),
          );
          const nextDesign =
            syncedCircuits.find(
              (circuit) => circuit.id === state.activeCircuitId,
            ) ?? updatedDesign;
          const next = validateAndSimulate(
            nextDesign,
            syncedCircuits,
            state.simulation,
            options,
          );
          return { design: nextDesign, circuits: syncedCircuits, ...next };
        });
      };

      return {
        design: initialDesign,
        circuits: initialCircuits,
        activeCircuitId: initialDesign.id,
        freeWires: [],
        freeWiresByCircuit: {},
        editorSettings: defaultEditorSettings,
        simulation: initial.simulation,
        issues: initial.issues,
        addCircuit: () =>
          set((state) => {
            const circuit = emptyCircuit(
              `Circuit ${state.circuits.length + 1}`,
            );
            const nextCircuits = [
              ...replaceCircuit(
                state.circuits,
                state.activeCircuitId,
                state.design,
              ),
              circuit,
            ];
            const next = validateAndSimulate(circuit, nextCircuits, undefined, {
              reset: true,
            });
            const freeWiresByCircuit = {
              ...state.freeWiresByCircuit,
              [state.activeCircuitId]: state.freeWires,
              [circuit.id]: [],
            };
            return {
              design: circuit,
              circuits: nextCircuits,
              activeCircuitId: circuit.id,
              freeWires: [],
              freeWiresByCircuit,
              ...next,
            };
          }),
        setActiveCircuit: (id) =>
          set((state) => {
            const currentCircuits = replaceCircuit(
              state.circuits,
              state.activeCircuitId,
              state.design,
            );
            const nextDesign =
              currentCircuits.find((circuit) => circuit.id === id) ??
              state.design;
            const next = validateAndSimulate(
              nextDesign,
              currentCircuits,
              undefined,
              { reset: true },
            );
            const freeWiresByCircuit = {
              ...state.freeWiresByCircuit,
              [state.activeCircuitId]: state.freeWires,
            };
            return {
              design: nextDesign,
              circuits: currentCircuits,
              activeCircuitId: nextDesign.id,
              freeWires: freeWiresByCircuit[nextDesign.id] ?? [],
              freeWiresByCircuit,
              ...next,
            };
          }),
        deleteCircuit: (id) =>
          set((state) => {
            if (id === "main-circuit" || state.circuits.length <= 1) {
              return state;
            }
            const nextCircuits = replaceCircuit(
              state.circuits,
              state.activeCircuitId,
              state.design,
            ).filter((circuit) => circuit.id !== id);
            const nextDesign =
              nextCircuits.find(
                (circuit) => circuit.id === state.activeCircuitId,
              ) ??
              nextCircuits[0] ??
              defaultDesign();
            const next = validateAndSimulate(
              nextDesign,
              nextCircuits,
              undefined,
              { reset: true },
            );
            const freeWiresByCircuit = {
              ...state.freeWiresByCircuit,
              [state.activeCircuitId]: state.freeWires,
            };
            delete freeWiresByCircuit[id];
            return {
              design: nextDesign,
              circuits: nextCircuits,
              activeCircuitId: nextDesign.id,
              freeWires: freeWiresByCircuit[nextDesign.id] ?? [],
              freeWiresByCircuit,
              ...next,
            };
          }),
        setMode: (mode) =>
          commit((design) => ({
            ...design,
            simulation: {
              ...design.simulation,
              mode,
              running: mode === "sim" ? design.simulation.running : false,
            },
          })),
        setRunning: (running) =>
          commit((design) => ({
            ...design,
            simulation: { ...design.simulation, running },
          })),
        setSpeed: (speedHz) =>
          commit((design) => ({
            ...design,
            simulation: {
              ...design.simulation,
              speedHz: Math.min(60, Math.max(0.25, speedHz)),
            },
          })),
        setViewport: (viewport) =>
          set((state) =>
            sameViewport(state.design.viewport, viewport)
              ? state
              : { design: { ...state.design, viewport } },
          ),
        setSelectedIds: (ids) =>
          set((state) =>
            sameIds(state.design.selectedIds, ids)
              ? state
              : { design: { ...state.design, selectedIds: ids } },
          ),
        setFreeWires: (value) =>
          set((state) => {
            const freeWires =
              typeof value === "function" ? value(state.freeWires) : value;
            return {
              freeWires,
              freeWiresByCircuit: {
                ...state.freeWiresByCircuit,
                [state.activeCircuitId]: freeWires,
              },
            };
          }),
        setAutoRouteMovedWires: (enabled) =>
          set((state) => ({
            editorSettings: {
              ...state.editorSettings,
              autoRouteMovedWires: enabled,
            },
          })),
        addComponent: (type, x, y) =>
          commit((design) => {
            const definition = componentDefinitions[type];
            const component: CircuitComponent = {
              id: generateId(type),
              type,
              label: definition.label,
              x: snap(x),
              y: snap(y),
              rotation: 0,
              attrs: { ...definition.defaultAttrs },
            };
            return {
              ...design,
              components: [...design.components, component],
              selectedIds: [component.id],
            };
          }),
        addCustomCircuitComponent: (circuitId, x, y) =>
          commit((design) => {
            const circuit = get().circuits.find(
              (candidate) => candidate.id === circuitId,
            );
            if (!circuit || circuit.id === design.id) return design;
            const component: CircuitComponent = {
              id: generateId("custom-circuit"),
              type: "custom-circuit",
              label: circuit.name.replace(/\.circuit\.json$/, ""),
              x: snap(x),
              y: snap(y),
              rotation: 0,
              attrs: {
                circuitId: circuit.id,
                ports: JSON.stringify(customCircuitPorts(circuit)),
              },
            };
            return {
              ...design,
              components: [...design.components, component],
              selectedIds: [component.id],
            };
          }),
        addComponents: (components, wires) =>
          commit((design) => {
            const idMap = new Map<string, string>();
            const nextComponents = components.map((component) => {
              const id = generateId(component.type);
              idMap.set(component.id, id);
              return {
                ...component,
                id,
                x: snap(component.x),
                y: snap(component.y),
              };
            });
            return {
              ...design,
              components: [...design.components, ...nextComponents],
              wires: [
                ...design.wires,
                ...wires.map((wire) => ({
                  id: generateId("wire"),
                  source: {
                    ...wire.source,
                    componentId:
                      idMap.get(wire.source.componentId) ??
                      wire.source.componentId,
                  },
                  target: {
                    ...wire.target,
                    componentId:
                      idMap.get(wire.target.componentId) ??
                      wire.target.componentId,
                  },
                  waypoints: wire.waypoints,
                })),
              ],
              selectedIds: nextComponents.map((component) => component.id),
            };
          }),
        duplicateSelected: () =>
          commit((design) => {
            const selectedComponents = design.components.filter((component) =>
              design.selectedIds.includes(component.id),
            );
            const idMap = new Map<string, string>();
            const copies = selectedComponents.map((component) => {
              const id = generateId(component.type);
              idMap.set(component.id, id);
              return {
                ...component,
                id,
                x: component.x + 40,
                y: component.y + 40,
              };
            });
            const selectedWires = design.wires
              .filter(
                (wire) =>
                  idMap.has(wire.source.componentId) &&
                  idMap.has(wire.target.componentId),
              )
              .map((wire) => ({
                ...wire,
                id: generateId("wire"),
                source: {
                  ...wire.source,
                  componentId:
                    idMap.get(wire.source.componentId) ??
                    wire.source.componentId,
                },
                target: {
                  ...wire.target,
                  componentId:
                    idMap.get(wire.target.componentId) ??
                    wire.target.componentId,
                },
              }));
            return {
              ...design,
              components: [...design.components, ...copies],
              wires: [...design.wires, ...selectedWires],
              selectedIds: copies.map((component) => component.id),
            };
          }),
        deleteSelected: () =>
          commit((design) => {
            const selected = new Set(design.selectedIds);
            return {
              ...design,
              components: design.components.filter(
                (component) => !selected.has(component.id),
              ),
              wires: design.wires.filter(
                (wire) =>
                  !selected.has(wire.id) &&
                  !selected.has(wire.source.componentId) &&
                  !selected.has(wire.target.componentId),
              ),
              selectedIds: [],
            };
          }),
        moveComponent: (id, x, y) =>
          commit((design) => ({
            ...design,
            components: design.components.map((component) =>
              component.id === id
                ? { ...component, x: snap(x), y: snap(y) }
                : component,
            ),
          })),
        moveComponents: (positions) =>
          set((state) => ({
            design: {
              ...state.design,
              components: state.design.components.map((component) => {
                const position = positions[component.id];
                return position
                  ? { ...component, x: snap(position.x), y: snap(position.y) }
                  : component;
              }),
            },
          })),
        updateComponentAttrs: (id, attrs) =>
          commit((design) => ({
            ...design,
            components: design.components.map((component) =>
              component.id === id
                ? {
                    ...component,
                    attrs: sanitizeAttrs(component.type, {
                      ...component.attrs,
                      ...attrs,
                    }),
                  }
                : component,
            ),
          })),
        updateComponentLabel: (id, label) =>
          commit((design) => ({
            ...design,
            components: design.components.map((component) =>
              component.id === id ? { ...component, label } : component,
            ),
          })),
        rotateComponent: (id, rotation) =>
          commit((design) => ({
            ...design,
            components: design.components.map((component) =>
              component.id === id
                ? {
                    ...component,
                    rotation:
                      rotation ??
                      (((component.rotation + 90) % 360) as 0 | 90 | 180 | 270),
                  }
                : component,
            ),
          })),
        addWire: (source, target) =>
          commit((design) => {
            const exists = design.wires.some(
              (wire) =>
                wire.source.componentId === source.componentId &&
                wire.source.portId === source.portId &&
                wire.target.componentId === target.componentId &&
                wire.target.portId === target.portId,
            );
            if (exists) return design;
            return {
              ...design,
              wires: [
                ...design.wires,
                { id: generateId("wire"), source, target },
              ],
            };
          }),
        addWireWithWaypoints: (source, target, waypoints) =>
          commit((design) => {
            const exists = design.wires.some(
              (wire) =>
                wire.source.componentId === source.componentId &&
                wire.source.portId === source.portId &&
                wire.target.componentId === target.componentId &&
                wire.target.portId === target.portId,
            );
            if (exists) return design;
            return {
              ...design,
              wires: [
                ...design.wires,
                {
                  id: generateId("wire"),
                  source,
                  target,
                  waypoints: waypoints.map((point) => ({
                    x: snap(point.x),
                    y: snap(point.y),
                  })),
                },
              ],
            };
          }),
        updateWire: (id, source, target) =>
          commit((design) => ({
            ...design,
            wires: design.wires.map((wire) =>
              wire.id === id ? { ...wire, source, target } : wire,
            ),
          })),
        updateWireWaypoints: (id, waypoints) =>
          commit((design) => ({
            ...design,
            wires: design.wires.map((wire) =>
              wire.id === id
                ? {
                    ...wire,
                    waypoints: waypoints.map((point) => ({
                      x: snap(point.x),
                      y: snap(point.y),
                    })),
                  }
                : wire,
            ),
          })),
        deleteWire: (id) =>
          commit((design) => ({
            ...design,
            wires: design.wires.filter((wire) => wire.id !== id),
            selectedIds: design.selectedIds.filter(
              (selectedId) => selectedId !== id,
            ),
          })),
        toggleInput: (componentId) => {
          const component = get().design.components.find(
            (candidate) => candidate.id === componentId,
          );
          if (!component) return;
          if (!["input-pin", "switch", "button"].includes(component.type))
            return;
          const width = clampWidth(component.attrs.width ?? 1);
          const current =
            typeof component.attrs.value === "number"
              ? component.attrs.value
              : 0;
          const max = width >= 31 ? 1 : (1 << width) - 1;
          const next =
            width === 1 ? (current === 1 ? 0 : 1) : (current + 1) & max;
          get().updateComponentAttrs(componentId, { value: next });
        },
        tickClock: () =>
          commit(
            (design) => ({
              ...design,
              simulation: {
                ...design.simulation,
                tick: design.simulation.tick + 1,
              },
            }),
            { tick: true },
          ),
        step: () => {
          const state = get();
          set({
            ...validateAndSimulate(
              state.design,
              state.circuits,
              state.simulation,
            ),
          });
        },
        resetSimulation: () =>
          commit(
            (design) => ({
              ...design,
              simulation: { ...design.simulation, running: false, tick: 0 },
            }),
            { reset: true },
          ),
        importDesign: (design) => {
          const normalized = normalizeDesign(design);
          const circuits = replaceCircuit(
            get().circuits,
            get().activeCircuitId,
            normalized,
          );
          set({
            design: normalized,
            circuits,
            freeWires: [],
            freeWiresByCircuit: {
              ...get().freeWiresByCircuit,
              [get().activeCircuitId]: [],
            },
            ...validateAndSimulate(normalized, circuits, undefined, {
              reset: true,
            }),
          });
        },
      };
    },
    {
      name: "mano-forge-circuits",
      version: 2,
      storage: circuitStorage,
      partialize: (state) => ({
        design: state.design,
        circuits: replaceCircuit(
          state.circuits,
          state.activeCircuitId,
          state.design,
        ),
        activeCircuitId: state.activeCircuitId,
        freeWires: state.freeWires,
        freeWiresByCircuit: {
          ...state.freeWiresByCircuit,
          [state.activeCircuitId]: state.freeWires,
        },
        editorSettings: state.editorSettings,
      }),
      merge: (persisted, current) => {
        const maybe = persisted as
          | {
              design?: CircuitDesign;
              circuits?: CircuitDesign[];
              activeCircuitId?: string;
              freeWires?: CircuitFreeWire[];
              freeWiresByCircuit?: Record<string, CircuitFreeWire[]>;
              editorSettings?: Partial<CircuitEditorSettings>;
            }
          | undefined;
        const circuits =
          Array.isArray(maybe?.circuits) && maybe.circuits.length > 0
            ? maybe.circuits.map(normalizeDesign)
            : [maybe?.design ? normalizeDesign(maybe.design) : current.design];
        const activeCircuitId = maybe?.activeCircuitId ?? circuits[0]?.id;
        const design =
          circuits.find((circuit) => circuit.id === activeCircuitId) ??
          circuits[0] ??
          current.design;
        const next = validateAndSimulate(design, circuits, undefined, {
          reset: true,
        });
        const freeWiresByCircuit = normalizeFreeWiresByCircuit(
          maybe?.freeWiresByCircuit,
        );
        const activeFreeWires = normalizeFreeWires(
          freeWiresByCircuit[design.id] ?? maybe?.freeWires,
        );
        return {
          ...current,
          design,
          circuits,
          activeCircuitId: design.id,
          freeWires: activeFreeWires,
          freeWiresByCircuit: {
            ...freeWiresByCircuit,
            [design.id]: activeFreeWires,
          },
          editorSettings: {
            ...defaultEditorSettings,
            ...maybe?.editorSettings,
          },
          ...next,
        };
      },
    },
  ),
);

const sanitizeAttrs = (type: CircuitComponentKind, attrs: CircuitAttrs) => {
  const definition = componentDefinitions[type];
  const next = { ...definition.defaultAttrs, ...attrs };
  for (const spec of definition.attributes) {
    const value = next[spec.key];
    if (spec.type === "number") {
      const numeric = typeof value === "number" ? value : Number(value);
      const min = spec.min ?? Number.NEGATIVE_INFINITY;
      const max = spec.max ?? Number.POSITIVE_INFINITY;
      next[spec.key] = Math.min(
        max,
        Math.max(min, Number.isFinite(numeric) ? numeric : min),
      );
    }
    if (spec.type === "boolean" && typeof value !== "boolean") {
      next[spec.key] = value === "true";
    }
    if (
      spec.type === "select" &&
      spec.options &&
      !spec.options.includes(String(value))
    ) {
      next[spec.key] = spec.options[0] ?? "";
    }
  }
  return next;
};

const replaceCircuit = (
  circuits: CircuitDesign[],
  id: string,
  design: CircuitDesign,
) =>
  circuits.some((circuit) => circuit.id === id)
    ? circuits.map((circuit) => (circuit.id === id ? design : circuit))
    : [...circuits, design];

const emptyCircuit = (name: string): CircuitDesign => ({
  id: generateId("circuit"),
  name: `${name.toLowerCase().replace(/\s+/g, "-")}.circuit.json`,
  components: [],
  wires: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedIds: [],
  simulation: { mode: "design", running: false, speedHz: 2, tick: 0 },
});

const customCircuitPorts = (circuit: CircuitDesign): PortSpec[] => {
  const inputPins = circuit.components.filter(
    (component) => component.type === "input-pin",
  );
  const outputPins = circuit.components.filter(
    (component) => component.type === "output-pin",
  );
  return [
    ...inputPins.map((component) => ({
      id: `in:${component.id}`,
      label: component.label,
      direction: "input" as const,
      width: clampWidth(component.attrs.width),
      side: "left" as const,
      required: true,
    })),
    ...outputPins.map((component) => ({
      id: `out:${component.id}`,
      label: component.label,
      direction: "output" as const,
      width: clampWidth(component.attrs.width),
      side: "right" as const,
    })),
  ];
};

const syncCircuitReferences = (circuits: CircuitDesign[]) =>
  circuits.map((circuit) => ({
    ...circuit,
    components: circuit.components.map((component) => {
      if (component.type !== "custom-circuit") return component;
      const circuitId =
        typeof component.attrs.circuitId === "string"
          ? component.attrs.circuitId
          : "";
      const referenced = circuits.find(
        (candidate) => candidate.id === circuitId,
      );
      if (!referenced) return component;
      return {
        ...component,
        label: referenced.name.replace(/\.circuit\.json$/, ""),
        attrs: {
          ...component.attrs,
          ports: JSON.stringify(customCircuitPorts(referenced)),
        },
      };
    }),
  }));

const normalizeDesign = (design: CircuitDesign): CircuitDesign => ({
  id: design.id || generateId("circuit"),
  name: design.name || "main.circuit.json",
  components: Array.isArray(design.components)
    ? design.components.map((component) => ({
        ...component,
        attrs: sanitizeAttrs(component.type, component.attrs ?? {}),
      }))
    : [],
  wires: Array.isArray(design.wires) ? design.wires : [],
  viewport: design.viewport ?? { x: 0, y: 0, zoom: 1 },
  selectedIds: [],
  simulation: {
    mode: design.simulation?.mode ?? "design",
    running: false,
    speedHz: design.simulation?.speedHz ?? 2,
    tick: design.simulation?.tick ?? 0,
  },
});

const normalizeFreeWires = (
  freeWires: CircuitFreeWire[] | undefined,
): CircuitFreeWire[] =>
  Array.isArray(freeWires)
    ? freeWires
        .filter(
          (wire) => typeof wire?.id === "string" && Array.isArray(wire.points),
        )
        .map((wire) => ({
          id: wire.id,
          points: wire.points
            .filter(
              (point) =>
                typeof point?.x === "number" && typeof point.y === "number",
            )
            .map((point) => ({ x: snap(point.x), y: snap(point.y) })),
        }))
        .filter((wire) => wire.points.length > 1)
    : [];

const normalizeFreeWiresByCircuit = (
  freeWiresByCircuit: Record<string, CircuitFreeWire[]> | undefined,
) =>
  freeWiresByCircuit && typeof freeWiresByCircuit === "object"
    ? Object.fromEntries(
        Object.entries(freeWiresByCircuit).map(([id, freeWires]) => [
          id,
          normalizeFreeWires(freeWires),
        ]),
      )
    : {};

export const getPortValue = (
  simulation: CircuitSimulationState,
  componentId: string,
  portId: string,
) => simulation.values[valueKey(componentId, portId)];

export const getNumericPortValue = (
  simulation: CircuitSimulationState,
  componentId: string,
  portId: string,
) => toNumber(getPortValue(simulation, componentId, portId));
