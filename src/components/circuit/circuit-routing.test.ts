import { strict as assert } from "node:assert";
import { movedWireWaypoints } from "./circuit-routing";

const backwardHorizontal = movedWireWaypoints(
  { x: 360, y: 80 },
  { x: 80, y: 320 },
  "right",
  "left",
);

assert.deepEqual(backwardHorizontal, [
  { x: 400, y: 80 },
  { x: 400, y: 200 },
  { x: 40, y: 200 },
  { x: 40, y: 320 },
]);

const rotatedTarget = movedWireWaypoints(
  { x: 80, y: 140 },
  { x: 300, y: 60 },
  "right",
  "top",
);

assert.deepEqual(rotatedTarget, [{ x: 300, y: 140 }]);

const backwardVertical = movedWireWaypoints(
  { x: 260, y: 320 },
  { x: 700, y: 40 },
  "bottom",
  "top",
);

assert.deepEqual(backwardVertical, [
  { x: 260, y: 360 },
  { x: 480, y: 360 },
  { x: 480, y: 0 },
  { x: 700, y: 0 },
]);

const repeatedDirection = movedWireWaypoints(
  { x: 80, y: 140 },
  { x: 300, y: 140 },
  "right",
  "left",
);

assert.deepEqual(repeatedDirection, []);

console.log("Circuit routing tests passed");
