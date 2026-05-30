import type { PortSide } from "@/lib/circuit/types";

export type CircuitPoint = { x: number; y: number };

const GRID = 20;
const snap = (value: number) => Math.round(value / GRID) * GRID;

const pointsEqual = (left: CircuitPoint, right: CircuitPoint) =>
  left.x === right.x && left.y === right.y;

const collapseWaypoints = (
  points: CircuitPoint[],
  source: CircuitPoint,
  target: CircuitPoint,
) => {
  const collapsed: CircuitPoint[] = [];
  for (const point of [source, ...points, target]) {
    const previous = collapsed[collapsed.length - 1];
    const beforePrevious = collapsed[collapsed.length - 2];
    if (previous && pointsEqual(previous, point)) continue;
    if (
      previous &&
      beforePrevious &&
      ((beforePrevious.x === previous.x && previous.x === point.x) ||
        (beforePrevious.y === previous.y && previous.y === point.y))
    ) {
      collapsed[collapsed.length - 1] = point;
      continue;
    }
    collapsed.push(point);
  }
  return collapsed.slice(1, -1);
};

const horizontalFacing = (side: PortSide | null) =>
  side === "left" || side === "right";

const sideVector = (side: PortSide | null) => {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  if (side === "bottom") return { x: 0, y: 1 };
  return { x: 0, y: 0 };
};

const portStub = (point: CircuitPoint, side: PortSide | null) => {
  const vector = sideVector(side);
  return {
    x: point.x + vector.x * GRID * 2,
    y: point.y + vector.y * GRID * 2,
  };
};

const horizontalProgressesToward = (
  source: CircuitPoint,
  target: CircuitPoint,
  sourceSide: PortSide | null,
) => (sourceSide === "left" ? source.x >= target.x : source.x <= target.x);

const verticalProgressesToward = (
  source: CircuitPoint,
  target: CircuitPoint,
  sourceSide: PortSide | null,
) => (sourceSide === "top" ? source.y >= target.y : source.y <= target.y);

/**
 * Keep automatically updated wires predictable after moving a component.
 * Every terminal gets a short outward stub before the route turns. This keeps
 * wires outside component bodies and gives back-facing terminals a compact
 * orthogonal Z detour, including after component rotation.
 */
export const movedWireWaypoints = (
  source: CircuitPoint,
  target: CircuitPoint,
  sourceSide: PortSide | null,
  targetSide: PortSide | null,
) => {
  if (
    (source.x === target.x || source.y === target.y) &&
    ((sourceSide === "right" && targetSide === "left") ||
      (sourceSide === "left" && targetSide === "right") ||
      (sourceSide === "bottom" && targetSide === "top") ||
      (sourceSide === "top" && targetSide === "bottom"))
  ) {
    return [];
  }

  const sourceStub = portStub(source, sourceSide);
  const targetStub = portStub(target, targetSide);

  if (horizontalFacing(sourceSide) && horizontalFacing(targetSide)) {
    if (horizontalProgressesToward(sourceStub, targetStub, sourceSide)) {
      return collapseWaypoints(
        [sourceStub, { x: targetStub.x, y: sourceStub.y }, targetStub],
        source,
        target,
      );
    }
    const railY = snap((source.y + target.y) / 2);
    return collapseWaypoints(
      [
        sourceStub,
        { x: sourceStub.x, y: railY },
        { x: targetStub.x, y: railY },
        targetStub,
      ],
      source,
      target,
    );
  }

  if (!horizontalFacing(sourceSide) && !horizontalFacing(targetSide)) {
    if (verticalProgressesToward(sourceStub, targetStub, sourceSide)) {
      return collapseWaypoints(
        [sourceStub, { x: sourceStub.x, y: targetStub.y }, targetStub],
        source,
        target,
      );
    }
    const railX = snap((source.x + target.x) / 2);
    return collapseWaypoints(
      [
        sourceStub,
        { x: railX, y: sourceStub.y },
        { x: railX, y: targetStub.y },
        targetStub,
      ],
      source,
      target,
    );
  }

  const elbow = horizontalFacing(sourceSide)
    ? { x: targetStub.x, y: sourceStub.y }
    : { x: sourceStub.x, y: targetStub.y };
  return collapseWaypoints([sourceStub, elbow, targetStub], source, target);
};
