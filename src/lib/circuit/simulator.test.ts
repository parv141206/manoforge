import { strict as assert } from "node:assert";
import type { CircuitComponent, CircuitDesign, CircuitWire } from "./types";
import { simulateCircuit } from "./simulator";
import { displayValue, toNumber } from "./values";

const component = (
  id: string,
  type: CircuitComponent["type"],
  x: number,
  y: number,
  attrs: CircuitComponent["attrs"] = {},
): CircuitComponent => ({
  id,
  type,
  label: id,
  x,
  y,
  rotation: 0,
  attrs,
});

const wire = (
  id: string,
  sourceComponent: string,
  sourcePort: string,
  targetComponent: string,
  targetPort: string,
): CircuitWire => ({
  id,
  source: { componentId: sourceComponent, portId: sourcePort },
  target: { componentId: targetComponent, portId: targetPort },
});

const design = (
  components: CircuitComponent[],
  wires: CircuitWire[],
): CircuitDesign => ({
  id: "test",
  name: "test",
  components,
  wires,
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedIds: [],
  simulation: { mode: "sim", running: false, speedHz: 1, tick: 0 },
});

const portNumber = (
  result: ReturnType<typeof simulateCircuit>,
  componentId: string,
  portId: string,
) => toNumber(result.values[`${componentId}.${portId}`]);

const runGateTest = () => {
  const result = simulateCircuit(
    design(
      [
        component("a", "input-pin", 0, 0, { width: 1, value: 1 }),
        component("b", "input-pin", 0, 80, { width: 1, value: 0 }),
        component("and", "and", 160, 40, { width: 1, inputs: 2 }),
      ],
      [
        wire("wa", "a", "out", "and", "in0"),
        wire("wb", "b", "out", "and", "in1"),
      ],
    ),
  );
  assert.equal(portNumber(result, "and", "out"), 0);
};

const runMuxDecoderTest = () => {
  const result = simulateCircuit(
    design(
      [
        component("d0", "constant", 0, 0, { width: 4, value: 3 }),
        component("d1", "constant", 0, 80, { width: 4, value: 9 }),
        component("sel", "constant", 0, 160, { width: 1, value: 1 }),
        component("mux", "mux", 180, 60, {
          width: 4,
          selectBits: 1,
          enable: false,
        }),
      ],
      [
        wire("w0", "d0", "out", "mux", "in0"),
        wire("w1", "d1", "out", "mux", "in1"),
        wire("ws", "sel", "out", "mux", "sel"),
      ],
    ),
  );
  assert.equal(portNumber(result, "mux", "out"), 9);
};

const runArithmeticTest = () => {
  const result = simulateCircuit(
    design(
      [
        component("a", "constant", 0, 0, { width: 4, value: 15 }),
        component("b", "constant", 0, 80, { width: 4, value: 1 }),
        component("add", "adder", 180, 40, { width: 4 }),
      ],
      [
        wire("wa", "a", "out", "add", "in0"),
        wire("wb", "b", "out", "add", "in1"),
      ],
    ),
  );
  assert.equal(portNumber(result, "add", "out"), 0);
  assert.equal(portNumber(result, "add", "carry"), 1);
};

const runSplitterExtenderTest = () => {
  const split = simulateCircuit(
    design(
      [
        component("c", "constant", 0, 0, { width: 8, value: 0xab }),
        component("s", "splitter", 180, 0, { width: 8, outputs: 2 }),
      ],
      [wire("wc", "c", "out", "s", "in")],
    ),
  );
  assert.equal(displayValue(split.values["s.out0"]), "0xB");
  assert.equal(displayValue(split.values["s.out1"]), "0xA");

  const combine = simulateCircuit(
    design(
      [
        component("low", "constant", 0, 0, { width: 4, value: 0xb }),
        component("high", "constant", 0, 80, { width: 4, value: 0xa }),
        component("join", "splitter", 180, 0, {
          width: 8,
          outputs: 2,
          mode: "combine",
        }),
      ],
      [
        wire("wl", "low", "out", "join", "in0"),
        wire("wh", "high", "out", "join", "in1"),
      ],
    ),
  );
  assert.equal(displayValue(combine.values["join.out"]), "0xAB");

  const extend = simulateCircuit(
    design(
      [
        component("c", "constant", 0, 0, { width: 4, value: 0xf }),
        component("e", "bit-extender", 180, 0, {
          inputWidth: 4,
          width: 8,
          mode: "sign",
        }),
      ],
      [wire("wc", "c", "out", "e", "in")],
    ),
  );
  assert.equal(portNumber(extend, "e", "out"), 255);
};

const runRegisterTest = () => {
  const base = design(
    [
      component("data", "constant", 0, 0, { width: 4, value: 12 }),
      component("clk", "input-pin", 0, 80, { width: 1, value: 0 }),
      component("en", "input-pin", 0, 160, { width: 1, value: 1 }),
      component("reg", "register", 200, 80, { width: 4 }),
    ],
    [
      wire("wd", "data", "out", "reg", "d"),
      wire("wc", "clk", "out", "reg", "clock"),
      wire("we", "en", "out", "reg", "enable"),
    ],
  );
  const low = simulateCircuit(base);
  const high = simulateCircuit(
    {
      ...base,
      components: base.components.map((item) =>
        item.id === "clk" ? { ...item, attrs: { width: 1, value: 1 } } : item,
      ),
      simulation: { ...base.simulation, tick: 1 },
    },
    low,
    { tick: true },
  );
  assert.equal(portNumber(high, "reg", "q"), 12);
};

const runValidationTest = () => {
  const result = simulateCircuit(
    design(
      [
        component("a", "constant", 0, 0, { width: 4, value: 1 }),
        component("b", "and", 180, 0, { width: 8, inputs: 2 }),
      ],
      [wire("bad", "a", "out", "b", "in0")],
    ),
  );
  assert.ok(result.issues.some((issue) => issue.message.includes("4 bit")));
};

runGateTest();
runMuxDecoderTest();
runArithmeticTest();
runSplitterExtenderTest();
runRegisterTest();
runValidationTest();

console.log("Circuit simulator tests passed");
