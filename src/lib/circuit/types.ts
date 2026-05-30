export type Bit = 0 | 1 | "X" | "Z";

export interface LogicValue {
  bits: Bit[];
}

export type CircuitMode = "design" | "sim";
export type PortDirection = "input" | "output";
export type PortSide = "left" | "right" | "top" | "bottom";

export type CircuitCategory =
  | "Wiring"
  | "Gates"
  | "Plexers"
  | "Arithmetic"
  | "Memory"
  | "IO";

export type CircuitComponentKind =
  | "input-pin"
  | "output-pin"
  | "constant"
  | "power"
  | "ground"
  | "probe"
  | "clock"
  | "splitter"
  | "bit-extender"
  | "not"
  | "buffer"
  | "and"
  | "or"
  | "nand"
  | "nor"
  | "xor"
  | "xnor"
  | "odd-parity"
  | "even-parity"
  | "mux"
  | "demux"
  | "decoder"
  | "priority-encoder"
  | "bit-selector"
  | "adder"
  | "subtractor"
  | "multiplier"
  | "divider"
  | "negator"
  | "comparator"
  | "shifter"
  | "bit-adder"
  | "d-flip-flop"
  | "t-flip-flop"
  | "jk-flip-flop"
  | "sr-flip-flop"
  | "register"
  | "counter"
  | "shift-register"
  | "led"
  | "led-bar"
  | "seven-segment"
  | "hex-digit"
  | "button"
  | "switch"
  | "custom-circuit";

export type CircuitAttrs = Record<string, boolean | number | string>;

export interface PortSpec {
  id: string;
  label: string;
  direction: PortDirection;
  width: number;
  side: PortSide;
  required?: boolean;
}

export interface CircuitComponent {
  id: string;
  type: CircuitComponentKind;
  label: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  attrs: CircuitAttrs;
}

export interface WireEndpoint {
  componentId: string;
  portId: string;
}

export interface CircuitWire {
  id: string;
  source: WireEndpoint;
  target: WireEndpoint;
  waypoints?: Array<{ x: number; y: number }>;
}

export interface CircuitViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CircuitDesign {
  id: string;
  name: string;
  components: CircuitComponent[];
  wires: CircuitWire[];
  viewport: CircuitViewport;
  selectedIds: string[];
  simulation: {
    mode: CircuitMode;
    running: boolean;
    speedHz: number;
    tick: number;
  };
}

export interface CircuitValidationIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
  componentId?: string;
  wireId?: string;
  portId?: string;
}

export interface ComponentEvalContext {
  component: CircuitComponent;
  inputs: Record<string, LogicValue>;
  state: Record<string, unknown> | undefined;
  tick: number;
}

export interface ComponentEvalResult {
  outputs: Record<string, LogicValue>;
  state?: Record<string, unknown>;
}

export interface ComponentDefinition {
  type: CircuitComponentKind;
  label: string;
  category: CircuitCategory;
  description: string;
  defaultAttrs: CircuitAttrs;
  attributes: Array<{
    key: string;
    label: string;
    type: "number" | "boolean" | "select" | "text";
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  }>;
  getPorts: (attrs: CircuitAttrs) => PortSpec[];
  evaluate: (context: ComponentEvalContext) => ComponentEvalResult;
  tick?: (context: ComponentEvalContext) => ComponentEvalResult;
  isSequential?: boolean;
}

export interface CircuitSimulationState {
  values: Record<string, LogicValue>;
  componentState: Record<string, Record<string, unknown>>;
  issues: CircuitValidationIssue[];
  oscillating: boolean;
}
