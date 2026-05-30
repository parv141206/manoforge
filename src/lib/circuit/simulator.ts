import { componentDefinitions } from "./definitions";
import type {
  CircuitComponent,
  CircuitDesign,
  CircuitSimulationState,
  CircuitValidationIssue,
  CircuitWire,
  LogicValue,
  PortSpec,
} from "./types";
import {
  displayValue,
  highZValue,
  normalizeValue,
  toNumber,
  unknownValue,
  valueKey,
} from "./values";

const makeIssueId = (prefix: string, index: number) => `${prefix}-${index}`;

const portMapFor = (component: CircuitComponent) => {
  const definition = componentDefinitions[component.type];
  return new Map(
    definition.getPorts(component.attrs).map((port) => [port.id, port]),
  );
};

const getPort = (
  components: Map<string, CircuitComponent>,
  endpoint: { componentId: string; portId: string },
) => {
  const component = components.get(endpoint.componentId);
  if (!component) return null;
  const port = portMapFor(component).get(endpoint.portId);
  return port ? { component, port } : null;
};

export const validateCircuit = (
  design: CircuitDesign,
): CircuitValidationIssue[] => {
  const issues: CircuitValidationIssue[] = [];
  const components = new Map(
    design.components.map((component) => [component.id, component]),
  );
  const inputDrivers = new Map<string, CircuitWire[]>();
  let index = 0;

  for (const wire of design.wires) {
    const source = getPort(components, wire.source);
    const target = getPort(components, wire.target);

    if (!source || !target) {
      issues.push({
        id: makeIssueId("missing-port", index++),
        severity: "error",
        message: "Wire references a missing component or port.",
        wireId: wire.id,
      });
      continue;
    }

    if (
      source.port.direction !== "output" ||
      target.port.direction !== "input"
    ) {
      issues.push({
        id: makeIssueId("direction", index++),
        severity: "error",
        message: "Wire must connect an output port to an input port.",
        wireId: wire.id,
      });
    }

    if (source.port.width !== target.port.width) {
      issues.push({
        id: makeIssueId("width", index++),
        severity: "error",
        message: `${source.component.label}.${source.port.label} is ${source.port.width} bit(s), but ${target.component.label}.${target.port.label} is ${target.port.width} bit(s).`,
        wireId: wire.id,
        componentId: target.component.id,
        portId: target.port.id,
      });
    }

    const targetKey = valueKey(target.component.id, target.port.id);
    inputDrivers.set(targetKey, [...(inputDrivers.get(targetKey) ?? []), wire]);
  }

  for (const [targetKey, drivers] of inputDrivers) {
    if (drivers.length <= 1) continue;
    const [componentId, portId] = targetKey.split(".");
    issues.push({
      id: makeIssueId("multi-driver", index++),
      severity: "error",
      message: "Input port has multiple connected drivers.",
      componentId,
      portId,
      wireId: drivers[0]?.id,
    });
  }

  for (const component of design.components) {
    const ports = componentDefinitions[component.type].getPorts(
      component.attrs,
    );
    for (const port of ports) {
      if (port.direction !== "input" || !port.required) continue;
      const connected = inputDrivers.has(valueKey(component.id, port.id));
      if (!connected) {
        issues.push({
          id: makeIssueId("missing-input", index++),
          severity: "warning",
          message: `${component.label}.${port.label} is not connected.`,
          componentId: component.id,
          portId: port.id,
        });
      }
    }
  }

  const graph = new Map<string, Set<string>>();
  for (const component of design.components) graph.set(component.id, new Set());
  for (const wire of design.wires) {
    const source = getPort(components, wire.source);
    const target = getPort(components, wire.target);
    if (!source || !target) continue;
    if (componentDefinitions[source.component.type].isSequential) continue;
    graph.get(source.component.id)?.add(target.component.id);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of graph.get(id) ?? []) {
      if (hasCycle(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const component of design.components) {
    if (componentDefinitions[component.type].isSequential) continue;
    if (hasCycle(component.id)) {
      issues.push({
        id: makeIssueId("cycle", index++),
        severity: "error",
        message:
          "Combinational feedback loop detected. Add a clocked component to break the loop.",
        componentId: component.id,
      });
      break;
    }
  }

  return issues;
};

const customCircuitOutputs = (
  component: CircuitComponent,
  inputs: Record<string, LogicValue>,
  design: CircuitDesign,
  library: CircuitDesign[],
  stack: string[],
) => {
  const ports = getComponentPorts(component);
  const outputs = Object.fromEntries(
    ports
      .filter((port) => port.direction === "output")
      .map((port) => [port.id, unknownValue(port.width)]),
  );
  const circuitId =
    typeof component.attrs.circuitId === "string"
      ? component.attrs.circuitId
      : "";
  const child = library.find((candidate) => candidate.id === circuitId);
  if (!child || stack.includes(circuitId)) return outputs;

  const childDesign: CircuitDesign = {
    ...child,
    simulation: design.simulation,
    components: child.components.map((childComponent) => {
      if (childComponent.type !== "input-pin") return childComponent;
      const portId = `in:${childComponent.id}`;
      const value = toNumber(inputs[portId]) ?? 0;
      return {
        ...childComponent,
        attrs: {
          ...childComponent.attrs,
          value,
        },
      };
    }),
  };
  const childSimulation = simulateCircuit(
    childDesign,
    undefined,
    { reset: true },
    library,
    [...stack, circuitId],
  );

  for (const childComponent of child.components) {
    if (childComponent.type !== "output-pin") continue;
    const portId = `out:${childComponent.id}`;
    const port = ports.find((candidate) => candidate.id === portId);
    if (!port) continue;
    outputs[portId] = normalizeValue(
      childSimulation.values[valueKey(childComponent.id, "in")],
      port.width,
    );
  }
  return outputs;
};

const defaultPortValues = (design: CircuitDesign) => {
  const values: Record<string, LogicValue> = {};
  for (const component of design.components) {
    const ports = componentDefinitions[component.type].getPorts(
      component.attrs,
    );
    for (const port of ports) {
      values[valueKey(component.id, port.id)] =
        port.direction === "input"
          ? highZValue(port.width)
          : unknownValue(port.width);
    }
  }
  return values;
};

const resolveInputs = (
  design: CircuitDesign,
  values: Record<string, LogicValue>,
) => {
  const byComponent = new Map<string, Record<string, LogicValue>>();
  const components = new Map(
    design.components.map((component) => [component.id, component]),
  );

  for (const component of design.components) {
    const ports = componentDefinitions[component.type].getPorts(
      component.attrs,
    );
    const inputs: Record<string, LogicValue> = {};
    for (const port of ports.filter(
      (candidate) => candidate.direction === "input",
    )) {
      inputs[port.id] = highZValue(port.width);
    }
    byComponent.set(component.id, inputs);
  }

  for (const wire of design.wires) {
    const source = getPort(components, wire.source);
    const target = getPort(components, wire.target);
    if (!source || !target) continue;
    const sourceValue =
      values[valueKey(source.component.id, source.port.id)] ??
      unknownValue(source.port.width);
    const normalized = normalizeValue(sourceValue, target.port.width);
    const targetInputs = byComponent.get(target.component.id);
    if (targetInputs) targetInputs[target.port.id] = normalized;
    values[valueKey(target.component.id, target.port.id)] = normalized;
  }

  return byComponent;
};

const assignOutputs = (
  component: CircuitComponent,
  outputs: Record<string, LogicValue>,
  values: Record<string, LogicValue>,
) => {
  const ports = componentDefinitions[component.type].getPorts(component.attrs);
  for (const port of ports.filter(
    (candidate) => candidate.direction === "output",
  )) {
    values[valueKey(component.id, port.id)] = normalizeValue(
      outputs[port.id],
      port.width,
    );
  }
};

const valuesSnapshot = (values: Record<string, LogicValue>) =>
  Object.keys(values)
    .sort()
    .map((key) => `${key}:${displayValue(values[key])}`)
    .join("|");

export const simulateCircuit = (
  design: CircuitDesign,
  previous?: CircuitSimulationState,
  options: { tick?: boolean; reset?: boolean } = {},
  library: CircuitDesign[] = [design],
  stack: string[] = [design.id],
): CircuitSimulationState => {
  const issues = validateCircuit(design);
  const errorIssues = issues.filter((issue) => issue.severity === "error");
  const values = defaultPortValues(design);
  let componentState = options.reset
    ? {}
    : { ...(previous?.componentState ?? {}) };
  let oscillating = false;

  if (errorIssues.length > 0) {
    return { values, componentState, issues, oscillating };
  }

  const propagate = () => {
    let lastSnapshot = "";
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const inputs = resolveInputs(design, values);
      for (const component of design.components) {
        const definition = componentDefinitions[component.type];
        const componentInputs = inputs.get(component.id) ?? {};
        const result =
          component.type === "custom-circuit"
            ? {
                outputs: customCircuitOutputs(
                  component,
                  componentInputs,
                  design,
                  library,
                  stack,
                ),
              }
            : definition.evaluate({
                component,
                inputs: componentInputs,
                state: componentState[component.id],
                tick: design.simulation.tick,
              });
        if (result.state) {
          componentState = { ...componentState, [component.id]: result.state };
        }
        assignOutputs(component, result.outputs, values);
      }

      const snapshot = valuesSnapshot(values);
      if (snapshot === lastSnapshot) return true;
      lastSnapshot = snapshot;
    }
    return false;
  };

  if (!propagate()) oscillating = true;

  if (options.tick) {
    const inputs = resolveInputs(design, values);
    for (const component of design.components) {
      const definition = componentDefinitions[component.type];
      if (!definition.tick) continue;
      const result = definition.tick({
        component,
        inputs: inputs.get(component.id) ?? {},
        state: componentState[component.id],
        tick: design.simulation.tick,
      });
      componentState = {
        ...componentState,
        [component.id]: result.state ?? componentState[component.id] ?? {},
      };
      assignOutputs(component, result.outputs, values);
    }
    if (!propagate()) oscillating = true;
  }

  return {
    values,
    componentState,
    issues: oscillating
      ? [
          ...issues,
          {
            id: "oscillation",
            severity: "error",
            message:
              "Simulation did not stabilize after 32 propagation rounds.",
          },
        ]
      : issues,
    oscillating,
  };
};

export const getComponentPorts = (component: CircuitComponent): PortSpec[] =>
  componentDefinitions[component.type].getPorts(component.attrs);
