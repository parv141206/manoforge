import type {
  CircuitAttrs,
  CircuitCategory,
  CircuitComponentKind,
  ComponentDefinition,
  ComponentEvalContext,
  LogicValue,
  PortSpec,
} from "./types";
import {
  andValue,
  clampWidth,
  fromNumber,
  highZValue,
  normalizeValue,
  notValue,
  oneValue,
  orValue,
  resizeValue,
  toNumber,
  unknownValue,
  valueToBoolean,
  xorValue,
  zeroValue,
} from "./values";

type AttrSpec = ComponentDefinition["attributes"][number];

const numberAttr = (
  key: string,
  label: string,
  min: number,
  max: number,
  step = 1,
): AttrSpec => ({ key, label, type: "number", min, max, step });

const booleanAttr = (key: string, label: string): AttrSpec => ({
  key,
  label,
  type: "boolean",
});

const selectAttr = (
  key: string,
  label: string,
  options: string[],
): AttrSpec => ({
  key,
  label,
  type: "select",
  options,
});

const n = (attrs: CircuitAttrs, key: string, fallback: number) =>
  typeof attrs[key] === "number" ? Number(attrs[key]) : fallback;

const s = (attrs: CircuitAttrs, key: string, fallback: string) =>
  typeof attrs[key] === "string" ? String(attrs[key]) : fallback;

const b = (attrs: CircuitAttrs, key: string, fallback = false) =>
  typeof attrs[key] === "boolean" ? Boolean(attrs[key]) : fallback;

const widthOf = (attrs: CircuitAttrs, fallback = 1) =>
  clampWidth(n(attrs, "width", fallback));

export const customPortsOf = (attrs: CircuitAttrs): PortSpec[] => {
  const raw = attrs.ports;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as PortSpec[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (port): port is PortSpec =>
        typeof port?.id === "string" &&
        typeof port.label === "string" &&
        (port.direction === "input" || port.direction === "output") &&
        typeof port.width === "number" &&
        ["left", "right", "top", "bottom"].includes(port.side),
    );
  } catch {
    return [];
  }
};

const inputCountOf = (attrs: CircuitAttrs) =>
  Math.min(16, Math.max(1, Math.trunc(n(attrs, "inputs", 2))));

const inputPorts = (
  count: number,
  width: number,
  prefix = "in",
  labelPrefix = "",
): PortSpec[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${index}`,
    label: `${labelPrefix}${index}`,
    direction: "input",
    width,
    side: "left",
    required: true,
  }));

const outputPort = (width: number, id = "out", label = "out"): PortSpec => ({
  id,
  label,
  direction: "output",
  width,
  side: "right",
});

const reduceInputs = (
  context: ComponentEvalContext,
  reducer: (
    a: LogicValue | undefined,
    c: LogicValue | undefined,
    width: number,
  ) => LogicValue,
) => {
  const width = widthOf(context.component.attrs);
  const count = inputCountOf(context.component.attrs);
  let value = context.inputs.in0 ?? zeroValue(width);
  for (let i = 1; i < count; i += 1) {
    value = reducer(value, context.inputs[`in${i}`], width);
  }
  return value;
};

const numericInput = (
  inputs: Record<string, LogicValue>,
  port: string,
  width: number,
) => toNumber(normalizeValue(inputs[port], width));

const arithmeticResult = (value: number | null, width: number) =>
  value === null ? unknownValue(width) : fromNumber(value, width);

const mk = (
  type: CircuitComponentKind,
  label: string,
  category: CircuitCategory,
  description: string,
  defaultAttrs: CircuitAttrs,
  attributes: AttrSpec[],
  getPorts: ComponentDefinition["getPorts"],
  evaluate: ComponentDefinition["evaluate"],
  extra: Pick<ComponentDefinition, "tick" | "isSequential"> = {},
): ComponentDefinition => ({
  type,
  label,
  category,
  description,
  defaultAttrs,
  attributes,
  getPorts,
  evaluate,
  ...extra,
});

const gateAttrs = { width: 1, inputs: 2 };
const gateSpecs = [
  numberAttr("width", "Bit width", 1, 32),
  numberAttr("inputs", "Inputs", 2, 16),
];

const gatePorts = (attrs: CircuitAttrs) => [
  ...inputPorts(inputCountOf(attrs), widthOf(attrs)),
  outputPort(widthOf(attrs)),
];

const simpleSequentialPorts = (attrs: CircuitAttrs, dataPorts: PortSpec[]) => [
  ...dataPorts,
  {
    id: "clock",
    label: "clk",
    direction: "input",
    width: 1,
    side: "bottom",
    required: true,
  } as PortSpec,
  {
    id: "reset",
    label: "rst",
    direction: "input",
    width: 1,
    side: "top",
  } as PortSpec,
  outputPort(widthOf(attrs), "q", "q"),
];

const readStateValue = (context: ComponentEvalContext, key = "q") => {
  const width = widthOf(context.component.attrs);
  const raw = context.state?.[key];
  return typeof raw === "number" ? fromNumber(raw, width) : zeroValue(width);
};

const clockRose = (context: ComponentEvalContext) => {
  const clock = valueToBoolean(context.inputs.clock);
  const previous = context.state?.lastClock === true;
  return clock && !previous;
};

export const componentDefinitions: Record<
  CircuitComponentKind,
  ComponentDefinition
> = {
  "input-pin": mk(
    "input-pin",
    "Input Pin",
    "Wiring",
    "Clickable external input source.",
    { width: 1, value: 0 },
    [
      numberAttr("width", "Bit width", 1, 32),
      numberAttr("value", "Value", 0, 0xffffffff),
    ],
    (attrs) => [outputPort(widthOf(attrs))],
    ({ component }) => ({
      outputs: {
        out: fromNumber(
          n(component.attrs, "value", 0),
          widthOf(component.attrs),
        ),
      },
    }),
  ),
  "output-pin": mk(
    "output-pin",
    "Output Pin",
    "Wiring",
    "External circuit output.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs),
        side: "left",
        required: true,
      },
    ],
    () => ({ outputs: {} }),
  ),
  constant: mk(
    "constant",
    "Constant",
    "Wiring",
    "Fixed bus value.",
    { width: 1, value: 1 },
    [
      numberAttr("width", "Bit width", 1, 32),
      numberAttr("value", "Value", 0, 0xffffffff),
    ],
    (attrs) => [outputPort(widthOf(attrs))],
    ({ component }) => ({
      outputs: {
        out: fromNumber(
          n(component.attrs, "value", 0),
          widthOf(component.attrs),
        ),
      },
    }),
  ),
  power: mk(
    "power",
    "Power",
    "Wiring",
    "Constant logic one.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [outputPort(widthOf(attrs))],
    ({ component }) => ({
      outputs: { out: oneValue(widthOf(component.attrs)) },
    }),
  ),
  ground: mk(
    "ground",
    "Ground",
    "Wiring",
    "Constant zero.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [outputPort(widthOf(attrs))],
    ({ component }) => ({
      outputs: { out: zeroValue(widthOf(component.attrs)) },
    }),
  ),
  probe: mk(
    "probe",
    "Probe",
    "Wiring",
    "Shows the value of a bus.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs),
        side: "left",
        required: true,
      },
    ],
    () => ({ outputs: {} }),
  ),
  clock: mk(
    "clock",
    "Clock",
    "Wiring",
    "Manual or running clock source.",
    { level: 0 },
    [numberAttr("level", "Level", 0, 1)],
    () => [outputPort(1)],
    ({ state, component }) => ({
      outputs: {
        out: fromNumber(
          typeof state?.level === "number"
            ? Number(state.level)
            : n(component.attrs, "level", 0),
          1,
        ),
      },
    }),
    {
      tick: ({ state, component }) => {
        const next =
          typeof state?.level === "number"
            ? Number(state.level) === 1
              ? 0
              : 1
            : n(component.attrs, "level", 0) === 1
              ? 0
              : 1;
        return {
          outputs: { out: fromNumber(next, 1) },
          state: { ...state, level: next },
        };
      },
      isSequential: true,
    },
  ),
  splitter: mk(
    "splitter",
    "Splitter",
    "Wiring",
    "Splits a bus into chunks or combines chunks into a bus.",
    { width: 8, outputs: 2, mode: "split" },
    [
      numberAttr("width", "Input width", 1, 32),
      numberAttr("outputs", "Outputs", 2, 16),
      selectAttr("mode", "Direction", ["split", "combine"]),
    ],
    (attrs) => {
      const width = widthOf(attrs, 8);
      const count = Math.min(
        16,
        Math.max(1, Math.trunc(n(attrs, "outputs", 2))),
      );
      const chunk = Math.max(1, Math.ceil(width / count));
      const chunkPorts = Array.from({ length: count }, (_, index) => ({
        id: `${s(attrs, "mode", "split") === "combine" ? "in" : "out"}${index}`,
        label: `${index}`,
        direction:
          s(attrs, "mode", "split") === "combine"
            ? ("input" as const)
            : ("output" as const),
        width: Math.min(chunk, width - index * chunk || chunk),
        side:
          s(attrs, "mode", "split") === "combine"
            ? ("left" as const)
            : ("right" as const),
        required: s(attrs, "mode", "split") === "combine",
      }));
      if (s(attrs, "mode", "split") === "combine") {
        return [
          ...chunkPorts,
          {
            id: "out",
            label: "out",
            direction: "output" as const,
            width,
            side: "right" as const,
          },
        ];
      }
      return [
        {
          id: "in",
          label: "in",
          direction: "input",
          width,
          side: "left",
          required: true,
        },
        ...chunkPorts,
      ];
    },
    ({ component, inputs }) => {
      if (s(component.attrs, "mode", "split") === "combine") {
        const ports = componentDefinitions.splitter
          .getPorts(component.attrs)
          .filter((port) => port.direction === "input");
        return {
          outputs: {
            out: {
              bits: ports.flatMap((port) =>
                normalizeValue(inputs[port.id], port.width).bits.slice(
                  0,
                  port.width,
                ),
              ),
            },
          },
        };
      }
      const ports = componentDefinitions.splitter
        .getPorts(component.attrs)
        .filter((port) => port.direction === "output");
      const input = normalizeValue(inputs.in, widthOf(component.attrs, 8));
      return {
        outputs: Object.fromEntries(
          ports.map((port, index) => [
            port.id,
            {
              bits: input.bits.slice(
                index * port.width,
                index * port.width + port.width,
              ),
            },
          ]),
        ),
      };
    },
  ),
  "bit-extender": mk(
    "bit-extender",
    "Bit Extender",
    "Wiring",
    "Widens a bus by zero or sign extension.",
    { inputWidth: 4, width: 8, mode: "zero" },
    [
      numberAttr("inputWidth", "Input width", 1, 32),
      numberAttr("width", "Output width", 1, 32),
      selectAttr("mode", "Mode", ["zero", "sign"]),
    ],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: clampWidth(n(attrs, "inputWidth", 4)),
        side: "left",
        required: true,
      },
      outputPort(widthOf(attrs, 8)),
    ],
    ({ component, inputs }) => ({
      outputs: {
        out: resizeValue(
          inputs.in,
          widthOf(component.attrs, 8),
          s(component.attrs, "mode", "zero") === "sign" ? "sign" : "zero",
        ),
      },
    }),
  ),
  not: mk(
    "not",
    "NOT",
    "Gates",
    "Bitwise inverter.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs),
        side: "left",
        required: true,
      },
      outputPort(widthOf(attrs)),
    ],
    ({ component, inputs }) => ({
      outputs: { out: notValue(inputs.in, widthOf(component.attrs)) },
    }),
  ),
  buffer: mk(
    "buffer",
    "Buffer",
    "Gates",
    "Pass-through buffer.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs),
        side: "left",
        required: true,
      },
      outputPort(widthOf(attrs)),
    ],
    ({ component, inputs }) => ({
      outputs: { out: normalizeValue(inputs.in, widthOf(component.attrs)) },
    }),
  ),
  and: mk(
    "and",
    "AND",
    "Gates",
    "Configurable AND gate.",
    gateAttrs,
    gateSpecs,
    gatePorts,
    (ctx) => ({ outputs: { out: reduceInputs(ctx, andValue) } }),
  ),
  or: mk(
    "or",
    "OR",
    "Gates",
    "Configurable OR gate.",
    gateAttrs,
    gateSpecs,
    gatePorts,
    (ctx) => ({ outputs: { out: reduceInputs(ctx, orValue) } }),
  ),
  nand: mk(
    "nand",
    "NAND",
    "Gates",
    "Configurable NAND gate.",
    gateAttrs,
    gateSpecs,
    gatePorts,
    (ctx) => ({
      outputs: {
        out: notValue(
          reduceInputs(ctx, andValue),
          widthOf(ctx.component.attrs),
        ),
      },
    }),
  ),
  nor: mk(
    "nor",
    "NOR",
    "Gates",
    "Configurable NOR gate.",
    gateAttrs,
    gateSpecs,
    gatePorts,
    (ctx) => ({
      outputs: {
        out: notValue(reduceInputs(ctx, orValue), widthOf(ctx.component.attrs)),
      },
    }),
  ),
  xor: mk(
    "xor",
    "XOR",
    "Gates",
    "Configurable XOR gate.",
    gateAttrs,
    gateSpecs,
    gatePorts,
    (ctx) => ({ outputs: { out: reduceInputs(ctx, xorValue) } }),
  ),
  xnor: mk(
    "xnor",
    "XNOR",
    "Gates",
    "Configurable XNOR gate.",
    gateAttrs,
    gateSpecs,
    gatePorts,
    (ctx) => ({
      outputs: {
        out: notValue(
          reduceInputs(ctx, xorValue),
          widthOf(ctx.component.attrs),
        ),
      },
    }),
  ),
  "odd-parity": mk(
    "odd-parity",
    "Odd Parity",
    "Gates",
    "Outputs one when the input bus has odd parity.",
    { width: 8 },
    [numberAttr("width", "Input width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs, 8),
        side: "left",
        required: true,
      },
      outputPort(1),
    ],
    ({ inputs }) => {
      const bits = inputs.in?.bits;
      if (!bits || bits.some((bit) => bit !== 0 && bit !== 1))
        return { outputs: { out: unknownValue(1) } };
      return {
        outputs: { out: fromNumber(bits.filter(Boolean).length % 2, 1) },
      };
    },
  ),
  "even-parity": mk(
    "even-parity",
    "Even Parity",
    "Gates",
    "Outputs one when the input bus has even parity.",
    { width: 8 },
    [numberAttr("width", "Input width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs, 8),
        side: "left",
        required: true,
      },
      outputPort(1),
    ],
    ({ inputs }) => {
      const bits = inputs.in?.bits;
      if (!bits || bits.some((bit) => bit !== 0 && bit !== 1))
        return { outputs: { out: unknownValue(1) } };
      return {
        outputs: {
          out: fromNumber(bits.filter(Boolean).length % 2 === 0 ? 1 : 0, 1),
        },
      };
    },
  ),
  mux: mk(
    "mux",
    "Multiplexer",
    "Plexers",
    "Routes one selected input to output.",
    { width: 1, selectBits: 1, enable: false },
    [
      numberAttr("width", "Bit width", 1, 32),
      numberAttr("selectBits", "Select bits", 1, 5),
      booleanAttr("enable", "Enable input"),
    ],
    (attrs) => {
      const width = widthOf(attrs);
      const selectBits = clampWidth(n(attrs, "selectBits", 1));
      const count = 1 << Math.min(5, selectBits);
      return [
        ...inputPorts(count, width, "in", "D"),
        {
          id: "sel",
          label: "sel",
          direction: "input",
          width: selectBits,
          side: "bottom",
          required: true,
        } as PortSpec,
        ...(b(attrs, "enable")
          ? [
              {
                id: "enable",
                label: "en",
                direction: "input" as const,
                width: 1,
                side: "top" as const,
              },
            ]
          : []),
        outputPort(width),
      ];
    },
    ({ component, inputs }) => {
      const width = widthOf(component.attrs);
      if (b(component.attrs, "enable") && !valueToBoolean(inputs.enable))
        return { outputs: { out: zeroValue(width) } };
      const index = toNumber(inputs.sel);
      return {
        outputs: {
          out:
            index === null
              ? unknownValue(width)
              : normalizeValue(inputs[`in${index}`], width),
        },
      };
    },
  ),
  demux: mk(
    "demux",
    "Demultiplexer",
    "Plexers",
    "Routes input to one selected output.",
    { width: 1, selectBits: 1 },
    [
      numberAttr("width", "Bit width", 1, 32),
      numberAttr("selectBits", "Select bits", 1, 5),
    ],
    (attrs) => {
      const width = widthOf(attrs);
      const selectBits = clampWidth(n(attrs, "selectBits", 1));
      const count = 1 << Math.min(5, selectBits);
      return [
        {
          id: "in",
          label: "in",
          direction: "input",
          width,
          side: "left",
          required: true,
        },
        {
          id: "sel",
          label: "sel",
          direction: "input",
          width: selectBits,
          side: "bottom",
          required: true,
        } as PortSpec,
        ...Array.from({ length: count }, (_, index) =>
          outputPort(width, `out${index}`, `Y${index}`),
        ),
      ];
    },
    ({ component, inputs }) => {
      const width = widthOf(component.attrs);
      const count =
        1 << Math.min(5, clampWidth(n(component.attrs, "selectBits", 1)));
      const index = toNumber(inputs.sel);
      const data = normalizeValue(inputs.in, width);
      return {
        outputs: Object.fromEntries(
          Array.from({ length: count }, (_, i) => [
            `out${i}`,
            index === i ? data : zeroValue(width),
          ]),
        ),
      };
    },
  ),
  decoder: mk(
    "decoder",
    "Decoder",
    "Plexers",
    "Decodes selected line.",
    { selectBits: 2 },
    [numberAttr("selectBits", "Select bits", 1, 5)],
    (attrs) => {
      const selectBits = clampWidth(n(attrs, "selectBits", 2));
      return [
        {
          id: "sel",
          label: "sel",
          direction: "input",
          width: selectBits,
          side: "left",
          required: true,
        },
        ...Array.from({ length: 1 << Math.min(5, selectBits) }, (_, index) =>
          outputPort(1, `out${index}`, `${index}`),
        ),
      ];
    },
    ({ component, inputs }) => {
      const count =
        1 << Math.min(5, clampWidth(n(component.attrs, "selectBits", 2)));
      const index = toNumber(inputs.sel);
      return {
        outputs: Object.fromEntries(
          Array.from({ length: count }, (_, i) => [
            `out${i}`,
            fromNumber(index === i ? 1 : 0, 1),
          ]),
        ),
      };
    },
  ),
  "priority-encoder": mk(
    "priority-encoder",
    "Priority Encoder",
    "Plexers",
    "Encodes the highest asserted input.",
    { inputs: 4, width: 2 },
    [
      numberAttr("inputs", "Inputs", 2, 16),
      numberAttr("width", "Output width", 1, 5),
    ],
    (attrs) => [
      ...inputPorts(inputCountOf(attrs), 1),
      outputPort(widthOf(attrs, 2), "out", "idx"),
      outputPort(1, "valid", "v"),
    ],
    ({ component, inputs }) => {
      const count = inputCountOf(component.attrs);
      for (let i = count - 1; i >= 0; i -= 1) {
        if (valueToBoolean(inputs[`in${i}`]))
          return {
            outputs: {
              out: fromNumber(i, widthOf(component.attrs, 2)),
              valid: oneValue(1),
            },
          };
      }
      return {
        outputs: {
          out: zeroValue(widthOf(component.attrs, 2)),
          valid: zeroValue(1),
        },
      };
    },
  ),
  "bit-selector": mk(
    "bit-selector",
    "Bit Selector",
    "Plexers",
    "Selects a single bit from a bus.",
    { width: 8, selectBits: 3 },
    [
      numberAttr("width", "Input width", 1, 32),
      numberAttr("selectBits", "Select bits", 1, 5),
    ],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs, 8),
        side: "left",
        required: true,
      },
      {
        id: "sel",
        label: "sel",
        direction: "input",
        width: clampWidth(n(attrs, "selectBits", 3)),
        side: "bottom",
        required: true,
      },
      outputPort(1),
    ],
    ({ inputs }) => {
      const index = toNumber(inputs.sel);
      if (index === null || !inputs.in || index >= inputs.in.bits.length)
        return { outputs: { out: unknownValue(1) } };
      return { outputs: { out: { bits: [inputs.in.bits[index] ?? "X"] } } };
    },
  ),
  adder: mk(
    "adder",
    "Adder",
    "Arithmetic",
    "Unsigned adder.",
    { width: 4 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      ...inputPorts(2, widthOf(attrs), "in"),
      { id: "cin", label: "cin", direction: "input", width: 1, side: "bottom" },
      outputPort(widthOf(attrs)),
      outputPort(1, "carry", "c"),
    ],
    ({ component, inputs }) => {
      const width = widthOf(component.attrs, 4);
      const a = numericInput(inputs, "in0", width);
      const d = numericInput(inputs, "in1", width);
      const cin = toNumber(inputs.cin) ?? 0;
      const sum = a === null || d === null ? null : a + d + cin;
      return {
        outputs: {
          out: arithmeticResult(sum, width),
          carry: sum === null ? unknownValue(1) : fromNumber(sum >> width, 1),
        },
      };
    },
  ),
  subtractor: mk(
    "subtractor",
    "Subtractor",
    "Arithmetic",
    "Unsigned subtractor.",
    { width: 4 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      ...inputPorts(2, widthOf(attrs), "in"),
      outputPort(widthOf(attrs)),
      outputPort(1, "borrow", "b"),
    ],
    ({ component, inputs }) => {
      const width = widthOf(component.attrs, 4);
      const a = numericInput(inputs, "in0", width);
      const d = numericInput(inputs, "in1", width);
      const diff = a === null || d === null ? null : a - d;
      return {
        outputs: {
          out: arithmeticResult(diff, width),
          borrow:
            diff === null ? unknownValue(1) : fromNumber(diff < 0 ? 1 : 0, 1),
        },
      };
    },
  ),
  multiplier: mk(
    "multiplier",
    "Multiplier",
    "Arithmetic",
    "Unsigned multiplier.",
    { width: 4 },
    [numberAttr("width", "Bit width", 1, 16)],
    (attrs) => [
      ...inputPorts(2, widthOf(attrs, 4), "in"),
      outputPort(widthOf(attrs, 4) * 2),
    ],
    ({ component, inputs }) => {
      const width = widthOf(component.attrs, 4);
      const a = numericInput(inputs, "in0", width);
      const d = numericInput(inputs, "in1", width);
      return {
        outputs: {
          out: arithmeticResult(
            a === null || d === null ? null : a * d,
            width * 2,
          ),
        },
      };
    },
  ),
  divider: mk(
    "divider",
    "Divider",
    "Arithmetic",
    "Unsigned divider.",
    { width: 4 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      ...inputPorts(2, widthOf(attrs, 4), "in"),
      outputPort(widthOf(attrs, 4), "quotient", "q"),
      outputPort(widthOf(attrs, 4), "remainder", "r"),
    ],
    ({ component, inputs }) => {
      const width = widthOf(component.attrs, 4);
      const a = numericInput(inputs, "in0", width);
      const d = numericInput(inputs, "in1", width);
      if (a === null || d === null || d === 0)
        return {
          outputs: {
            quotient: unknownValue(width),
            remainder: unknownValue(width),
          },
        };
      return {
        outputs: {
          quotient: fromNumber(Math.trunc(a / d), width),
          remainder: fromNumber(a % d, width),
        },
      };
    },
  ),
  negator: mk(
    "negator",
    "Negator",
    "Arithmetic",
    "Two's complement negator.",
    { width: 4 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs, 4),
        side: "left",
        required: true,
      },
      outputPort(widthOf(attrs, 4)),
    ],
    ({ component, inputs }) => {
      const width = widthOf(component.attrs, 4);
      const value = numericInput(inputs, "in", width);
      return {
        outputs: {
          out: arithmeticResult(value === null ? null : -value, width),
        },
      };
    },
  ),
  comparator: mk(
    "comparator",
    "Comparator",
    "Arithmetic",
    "Compares two unsigned values.",
    { width: 4 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      ...inputPorts(2, widthOf(attrs, 4), "in"),
      outputPort(1, "lt", "<"),
      outputPort(1, "eq", "="),
      outputPort(1, "gt", ">"),
    ],
    ({ component, inputs }) => {
      const width = widthOf(component.attrs, 4);
      const a = numericInput(inputs, "in0", width);
      const d = numericInput(inputs, "in1", width);
      if (a === null || d === null)
        return {
          outputs: {
            lt: unknownValue(1),
            eq: unknownValue(1),
            gt: unknownValue(1),
          },
        };
      return {
        outputs: {
          lt: fromNumber(a < d ? 1 : 0, 1),
          eq: fromNumber(a === d ? 1 : 0, 1),
          gt: fromNumber(a > d ? 1 : 0, 1),
        },
      };
    },
  ),
  shifter: mk(
    "shifter",
    "Shifter",
    "Arithmetic",
    "Logical shifter.",
    { width: 8, direction: "left" },
    [
      numberAttr("width", "Bit width", 1, 32),
      selectAttr("direction", "Direction", ["left", "right"]),
    ],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs, 8),
        side: "left",
        required: true,
      },
      { id: "amt", label: "amt", direction: "input", width: 5, side: "bottom" },
      outputPort(widthOf(attrs, 8)),
    ],
    ({ component, inputs }) => {
      const width = widthOf(component.attrs, 8);
      const value = numericInput(inputs, "in", width);
      const amount = toNumber(inputs.amt) ?? 1;
      if (value === null) return { outputs: { out: unknownValue(width) } };
      return {
        outputs: {
          out: fromNumber(
            s(component.attrs, "direction", "left") === "left"
              ? value << amount
              : value >>> amount,
            width,
          ),
        },
      };
    },
  ),
  "bit-adder": mk(
    "bit-adder",
    "Bit Adder",
    "Arithmetic",
    "Counts asserted input bits.",
    { inputs: 4, width: 3 },
    [
      numberAttr("inputs", "Inputs", 1, 16),
      numberAttr("width", "Output width", 1, 5),
    ],
    (attrs) => [
      ...inputPorts(inputCountOf(attrs), 1),
      outputPort(widthOf(attrs, 3)),
    ],
    ({ component, inputs }) => {
      let total = 0;
      for (let i = 0; i < inputCountOf(component.attrs); i += 1) {
        const value = toNumber(inputs[`in${i}`]);
        if (value === null)
          return {
            outputs: { out: unknownValue(widthOf(component.attrs, 3)) },
          };
        total += value;
      }
      return {
        outputs: { out: fromNumber(total, widthOf(component.attrs, 3)) },
      };
    },
  ),
  "d-flip-flop": mk(
    "d-flip-flop",
    "D Flip-Flop",
    "Memory",
    "Edge-triggered D flip-flop.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) =>
      simpleSequentialPorts(attrs, [
        {
          id: "d",
          label: "d",
          direction: "input",
          width: widthOf(attrs),
          side: "left",
          required: true,
        },
      ]),
    (ctx) => ({ outputs: { q: readStateValue(ctx) } }),
    {
      isSequential: true,
      tick: (ctx) => ({
        outputs: { q: readStateValue(ctx) },
        state: {
          ...ctx.state,
          q: valueToBoolean(ctx.inputs.reset)
            ? 0
            : clockRose(ctx)
              ? (toNumber(
                  normalizeValue(ctx.inputs.d, widthOf(ctx.component.attrs)),
                ) ?? 0)
              : (toNumber(readStateValue(ctx)) ?? 0),
          lastClock: valueToBoolean(ctx.inputs.clock),
        },
      }),
    },
  ),
  "t-flip-flop": mk(
    "t-flip-flop",
    "T Flip-Flop",
    "Memory",
    "Edge-triggered T flip-flop.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) =>
      simpleSequentialPorts(attrs, [
        {
          id: "t",
          label: "t",
          direction: "input",
          width: 1,
          side: "left",
          required: true,
        },
      ]),
    (ctx) => ({ outputs: { q: readStateValue(ctx) } }),
    {
      isSequential: true,
      tick: (ctx) => {
        const width = widthOf(ctx.component.attrs);
        const current = toNumber(readStateValue(ctx)) ?? 0;
        const next = valueToBoolean(ctx.inputs.reset)
          ? 0
          : clockRose(ctx) && valueToBoolean(ctx.inputs.t)
            ? current ^ ((1 << width) - 1)
            : current;
        return {
          outputs: { q: fromNumber(next, width) },
          state: {
            ...ctx.state,
            q: next,
            lastClock: valueToBoolean(ctx.inputs.clock),
          },
        };
      },
    },
  ),
  "jk-flip-flop": mk(
    "jk-flip-flop",
    "JK Flip-Flop",
    "Memory",
    "Edge-triggered JK flip-flop.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) =>
      simpleSequentialPorts(attrs, [
        {
          id: "j",
          label: "j",
          direction: "input",
          width: 1,
          side: "left",
          required: true,
        },
        {
          id: "k",
          label: "k",
          direction: "input",
          width: 1,
          side: "left",
          required: true,
        },
      ]),
    (ctx) => ({ outputs: { q: readStateValue(ctx) } }),
    {
      isSequential: true,
      tick: (ctx) => {
        const current = toNumber(readStateValue(ctx)) ?? 0;
        const width = widthOf(ctx.component.attrs);
        let next = current;
        if (valueToBoolean(ctx.inputs.reset)) next = 0;
        else if (clockRose(ctx)) {
          const j = valueToBoolean(ctx.inputs.j);
          const k = valueToBoolean(ctx.inputs.k);
          if (j && k) next = current ^ ((1 << width) - 1);
          else if (j) next = (1 << width) - 1;
          else if (k) next = 0;
        }
        return {
          outputs: { q: fromNumber(next, width) },
          state: {
            ...ctx.state,
            q: next,
            lastClock: valueToBoolean(ctx.inputs.clock),
          },
        };
      },
    },
  ),
  "sr-flip-flop": mk(
    "sr-flip-flop",
    "SR Flip-Flop",
    "Memory",
    "Edge-triggered SR flip-flop.",
    { width: 1 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) =>
      simpleSequentialPorts(attrs, [
        {
          id: "s",
          label: "s",
          direction: "input",
          width: 1,
          side: "left",
          required: true,
        },
        {
          id: "r",
          label: "r",
          direction: "input",
          width: 1,
          side: "left",
          required: true,
        },
      ]),
    (ctx) => ({ outputs: { q: readStateValue(ctx) } }),
    {
      isSequential: true,
      tick: (ctx) => {
        let next = toNumber(readStateValue(ctx)) ?? 0;
        const width = widthOf(ctx.component.attrs);
        if (valueToBoolean(ctx.inputs.reset)) next = 0;
        else if (clockRose(ctx)) {
          if (valueToBoolean(ctx.inputs.s) && !valueToBoolean(ctx.inputs.r))
            next = (1 << width) - 1;
          if (valueToBoolean(ctx.inputs.r)) next = 0;
        }
        return {
          outputs: { q: fromNumber(next, width) },
          state: {
            ...ctx.state,
            q: next,
            lastClock: valueToBoolean(ctx.inputs.clock),
          },
        };
      },
    },
  ),
  register: mk(
    "register",
    "Register",
    "Memory",
    "Clocked register with enable.",
    { width: 8 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      ...simpleSequentialPorts(attrs, [
        {
          id: "d",
          label: "d",
          direction: "input",
          width: widthOf(attrs, 8),
          side: "left",
          required: true,
        },
      ]),
      { id: "enable", label: "en", direction: "input", width: 1, side: "top" },
    ],
    (ctx) => ({ outputs: { q: readStateValue(ctx) } }),
    {
      isSequential: true,
      tick: (ctx) => {
        const width = widthOf(ctx.component.attrs, 8);
        const current = toNumber(readStateValue(ctx)) ?? 0;
        const next = valueToBoolean(ctx.inputs.reset)
          ? 0
          : clockRose(ctx) && valueToBoolean(ctx.inputs.enable)
            ? (toNumber(normalizeValue(ctx.inputs.d, width)) ?? current)
            : current;
        return {
          outputs: { q: fromNumber(next, width) },
          state: {
            ...ctx.state,
            q: next,
            lastClock: valueToBoolean(ctx.inputs.clock),
          },
        };
      },
    },
  ),
  counter: mk(
    "counter",
    "Counter",
    "Memory",
    "Clocked up-counter.",
    { width: 8 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      {
        id: "clock",
        label: "clk",
        direction: "input",
        width: 1,
        side: "bottom",
        required: true,
      },
      { id: "reset", label: "rst", direction: "input", width: 1, side: "top" },
      { id: "enable", label: "en", direction: "input", width: 1, side: "left" },
      outputPort(widthOf(attrs, 8), "q", "q"),
    ],
    (ctx) => ({ outputs: { q: readStateValue(ctx) } }),
    {
      isSequential: true,
      tick: (ctx) => {
        const width = widthOf(ctx.component.attrs, 8);
        const current = toNumber(readStateValue(ctx)) ?? 0;
        const next = valueToBoolean(ctx.inputs.reset)
          ? 0
          : clockRose(ctx) && valueToBoolean(ctx.inputs.enable)
            ? current + 1
            : current;
        return {
          outputs: { q: fromNumber(next, width) },
          state: {
            ...ctx.state,
            q: next,
            lastClock: valueToBoolean(ctx.inputs.clock),
          },
        };
      },
    },
  ),
  "shift-register": mk(
    "shift-register",
    "Shift Register",
    "Memory",
    "Clocked left shift register.",
    { width: 8 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: 1,
        side: "left",
        required: true,
      },
      {
        id: "clock",
        label: "clk",
        direction: "input",
        width: 1,
        side: "bottom",
        required: true,
      },
      { id: "reset", label: "rst", direction: "input", width: 1, side: "top" },
      outputPort(widthOf(attrs, 8), "q", "q"),
    ],
    (ctx) => ({ outputs: { q: readStateValue(ctx) } }),
    {
      isSequential: true,
      tick: (ctx) => {
        const width = widthOf(ctx.component.attrs, 8);
        const current = toNumber(readStateValue(ctx)) ?? 0;
        const bit = valueToBoolean(ctx.inputs.in) ? 1 : 0;
        const next = valueToBoolean(ctx.inputs.reset)
          ? 0
          : clockRose(ctx)
            ? (current << 1) | bit
            : current;
        return {
          outputs: { q: fromNumber(next, width) },
          state: {
            ...ctx.state,
            q: next,
            lastClock: valueToBoolean(ctx.inputs.clock),
          },
        };
      },
    },
  ),
  led: mk(
    "led",
    "LED",
    "IO",
    "Single-bit indicator.",
    { activeHigh: true },
    [booleanAttr("activeHigh", "Active high")],
    () => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: 1,
        side: "left",
        required: true,
      },
    ],
    () => ({ outputs: {} }),
  ),
  "led-bar": mk(
    "led-bar",
    "LED Bar",
    "IO",
    "Multi-bit indicator.",
    { width: 8 },
    [numberAttr("width", "Bit width", 1, 32)],
    (attrs) => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: widthOf(attrs, 8),
        side: "left",
        required: true,
      },
    ],
    () => ({ outputs: {} }),
  ),
  "seven-segment": mk(
    "seven-segment",
    "Eight Segment",
    "IO",
    "Seven bars and a decimal-point LED display.",
    {},
    [],
    () => [
      {
        id: "segments",
        label: "seg",
        direction: "input",
        width: 8,
        side: "left",
        required: true,
      },
    ],
    () => ({ outputs: {} }),
  ),
  "hex-digit": mk(
    "hex-digit",
    "Hex Digit",
    "IO",
    "Hexadecimal display.",
    {},
    [],
    () => [
      {
        id: "in",
        label: "in",
        direction: "input",
        width: 4,
        side: "left",
        required: true,
      },
    ],
    () => ({ outputs: {} }),
  ),
  button: mk(
    "button",
    "Button",
    "IO",
    "Momentary input button.",
    { value: 0 },
    [numberAttr("value", "Value", 0, 1)],
    () => [outputPort(1)],
    ({ component }) => ({
      outputs: { out: fromNumber(n(component.attrs, "value", 0), 1) },
    }),
  ),
  switch: mk(
    "switch",
    "Switch",
    "IO",
    "Toggle or DIP switch source.",
    { width: 1, value: 0 },
    [
      numberAttr("width", "Bit width", 1, 32),
      numberAttr("value", "Value", 0, 0xffffffff),
    ],
    (attrs) => [outputPort(widthOf(attrs))],
    ({ component }) => ({
      outputs: {
        out: fromNumber(
          n(component.attrs, "value", 0),
          widthOf(component.attrs),
        ),
      },
    }),
  ),
  "custom-circuit": mk(
    "custom-circuit",
    "Custom Circuit",
    "Wiring",
    "Reusable circuit built from your own designs.",
    { circuitId: "", ports: "[]" },
    [],
    customPortsOf,
    () => ({ outputs: {} }),
  ),
};

export const componentLibrary = Object.values(componentDefinitions).filter(
  (definition) => definition.type !== "custom-circuit",
);

export const componentCategories: CircuitCategory[] = [
  "Wiring",
  "Gates",
  "Plexers",
  "Arithmetic",
  "Memory",
  "IO",
];
