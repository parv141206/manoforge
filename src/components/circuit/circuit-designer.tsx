"use client";

import React from "react";
import { VscCircuitBoard, VscSearch } from "react-icons/vsc";
import {
  CircuitList,
  CircuitToolbar,
  Inspector,
  IssuePanel,
  PaletteCategory,
} from "./circuit-designer-panels";
import { SegmentDisplay } from "./circuit-component-visuals";
import { movedWireWaypoints } from "./circuit-routing";
import {
  componentCategories,
  componentDefinitions,
} from "@/lib/circuit/definitions";
import { displayValue, toNumber, valueKey } from "@/lib/circuit/values";
import { useCircuitStore } from "@/stores/circuit-store";
import { useThemeStore } from "@/stores/theme-store";
import type {
  CircuitCategory,
  CircuitComponent,
  CircuitComponentKind,
  CircuitViewport,
  CircuitWire,
  PortSpec,
  WireEndpoint,
} from "@/lib/circuit/types";

const GRID = 20;
const MAJOR_GRID = GRID * 5;

type Point = { x: number; y: number };
type DragState = {
  ids: string[];
  start: Point;
  originals: Record<string, Point>;
};
type WireSegmentDrag = {
  wireId: string;
  index: number;
  orientation: "horizontal" | "vertical";
  start: Point;
  points: Point[];
};
type WirePointDrag = {
  wireId: string;
  index: number;
  start: Point;
  points: Point[];
};
type WireDraft = {
  source: WireEndpoint;
  points: Point[];
  cursor: Point;
  direction: DraftDirection;
};
type WireDragIntent = {
  source: WireEndpoint;
  start: Point;
  active: boolean;
};
type SelectionDrag = {
  start: Point;
  current: Point;
  additive: boolean;
};
type FreeWire = {
  id: string;
  points: Point[];
};
type FreeWireDraft = {
  points: Point[];
  cursor: Point;
  direction: DraftDirection;
};
type ExistingWirePointerIntent = {
  wireId: string;
  start: Point;
  origin: Point;
  cursor: Point;
  direction: DraftDirection;
  active: boolean;
};
type FreeWireSegmentDrag = {
  wireId: string;
  index: number;
  orientation: "horizontal" | "vertical";
  start: Point;
  points: Point[];
};
type FreeWirePointDrag = {
  wireId: string;
  index: number;
  start: Point;
  points: Point[];
};
type DraftDirection = "horizontal" | "vertical" | null;
type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const gateTypes = new Set<CircuitComponentKind>([
  "not",
  "buffer",
  "and",
  "or",
  "nand",
  "nor",
  "xor",
  "xnor",
  "odd-parity",
  "even-parity",
]);

const logisimGlyphTypes = new Set<CircuitComponentKind>([
  "splitter",
  "mux",
  "demux",
  "decoder",
  "priority-encoder",
  "d-flip-flop",
  "t-flip-flop",
  "jk-flip-flop",
  "sr-flip-flop",
  "register",
  "counter",
  "shift-register",
]);

const sequentialTypes = new Set<CircuitComponentKind>([
  "d-flip-flop",
  "t-flip-flop",
  "jk-flip-flop",
  "sr-flip-flop",
  "register",
  "counter",
  "shift-register",
]);

const snap = (value: number) => Math.round(value / GRID) * GRID;
const snapPoint = (point: Point): Point => ({
  x: snap(point.x),
  y: snap(point.y),
});

const gridUnitsForCenteredPorts = (count: number) => {
  const slots = count % 2 === 0 ? count + 2 : count + 1;
  return Math.max(4, slots);
};

const centeredGridOffset = (index: number, count: number) => {
  if (count <= 1) return 0;
  if (count % 2 === 1) return index - Math.floor(count / 2);
  return index < count / 2 ? index - count / 2 : index - count / 2 + 1;
};

const centeredPortCoordinate = (size: number, index: number, count: number) =>
  size / 2 + centeredGridOffset(index, count) * GRID;

const pointsEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const rectFromPoints = (a: Point, b: Point): Rect => ({
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  right: Math.max(a.x, b.x),
  bottom: Math.max(a.y, b.y),
});

const rectsIntersect = (a: Rect, b: Rect) =>
  a.left <= b.right &&
  a.right >= b.left &&
  a.top <= b.bottom &&
  a.bottom >= b.top;

const pointInRect = (point: Point, rect: Rect) =>
  point.x >= rect.left &&
  point.x <= rect.right &&
  point.y >= rect.top &&
  point.y <= rect.bottom;

const between = (value: number, first: number, second: number) =>
  value >= Math.min(first, second) && value <= Math.max(first, second);

const rangesOverlap = (
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) =>
  Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd)) <=
  Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd));

const pointOnSegment = (point: Point, start: Point, end: Point) => {
  if (start.x === end.x && point.x === start.x) {
    return between(point.y, start.y, end.y);
  }
  if (start.y === end.y && point.y === start.y) {
    return between(point.x, start.x, end.x);
  }
  return false;
};

const segmentsTouch = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  if (pointsEqual(firstStart, firstEnd)) {
    return pointOnSegment(firstStart, secondStart, secondEnd);
  }
  if (pointsEqual(secondStart, secondEnd)) {
    return pointOnSegment(secondStart, firstStart, firstEnd);
  }

  const firstHorizontal = firstStart.y === firstEnd.y;
  const secondHorizontal = secondStart.y === secondEnd.y;

  if (firstHorizontal && secondHorizontal) {
    return (
      firstStart.y === secondStart.y &&
      rangesOverlap(firstStart.x, firstEnd.x, secondStart.x, secondEnd.x)
    );
  }

  if (!firstHorizontal && !secondHorizontal) {
    return (
      firstStart.x === secondStart.x &&
      rangesOverlap(firstStart.y, firstEnd.y, secondStart.y, secondEnd.y)
    );
  }

  const horizontalStart = firstHorizontal ? firstStart : secondStart;
  const horizontalEnd = firstHorizontal ? firstEnd : secondEnd;
  const verticalStart = firstHorizontal ? secondStart : firstStart;
  const verticalEnd = firstHorizontal ? secondEnd : firstEnd;

  return (
    between(verticalStart.x, horizontalStart.x, horizontalEnd.x) &&
    between(horizontalStart.y, verticalStart.y, verticalEnd.y)
  );
};

const wireTouchesPoint = (points: Point[], point: Point) => {
  const routed = orthogonalPoints(points);
  if (routed.some((candidate) => pointsEqual(candidate, point))) return true;
  return routed.slice(0, -1).some((start, index) => {
    const end = routed[index + 1];
    return end ? pointOnSegment(point, start, end) : false;
  });
};

const segmentOverlapLength = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  const firstHorizontal = firstStart.y === firstEnd.y;
  const secondHorizontal = secondStart.y === secondEnd.y;
  if (firstHorizontal !== secondHorizontal) return 0;
  if (firstHorizontal) {
    if (firstStart.y !== secondStart.y) return 0;
    const left = Math.max(
      Math.min(firstStart.x, firstEnd.x),
      Math.min(secondStart.x, secondEnd.x),
    );
    const right = Math.min(
      Math.max(firstStart.x, firstEnd.x),
      Math.max(secondStart.x, secondEnd.x),
    );
    return Math.max(0, right - left);
  }
  if (firstStart.x !== secondStart.x) return 0;
  const top = Math.max(
    Math.min(firstStart.y, firstEnd.y),
    Math.min(secondStart.y, secondEnd.y),
  );
  const bottom = Math.min(
    Math.max(firstStart.y, firstEnd.y),
    Math.max(secondStart.y, secondEnd.y),
  );
  return Math.max(0, bottom - top);
};

const wiresConnect = (first: Point[], second: Point[]) => {
  const firstRouted = orthogonalPoints(first);
  const secondRouted = orthogonalPoints(second);
  const firstEndpoints = [firstRouted[0], firstRouted[firstRouted.length - 1]];
  const secondEndpoints = [
    secondRouted[0],
    secondRouted[secondRouted.length - 1],
  ];

  if (
    firstEndpoints.some(
      (point) => point && wireTouchesPoint(secondRouted, point),
    ) ||
    secondEndpoints.some(
      (point) => point && wireTouchesPoint(firstRouted, point),
    )
  ) {
    return true;
  }

  return firstRouted.slice(0, -1).some((firstStart, firstIndex) => {
    const firstEnd = firstRouted[firstIndex + 1];
    if (!firstEnd) return false;
    return secondRouted.slice(0, -1).some((secondStart, secondIndex) => {
      const secondEnd = secondRouted[secondIndex + 1];
      return secondEnd
        ? segmentOverlapLength(firstStart, firstEnd, secondStart, secondEnd) > 0
        : false;
    });
  });
};

const pointKey = (point: Point) => `${point.x},${point.y}`;

const segmentTouchPoints = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  if (!segmentsTouch(firstStart, firstEnd, secondStart, secondEnd)) {
    return [];
  }

  const firstHorizontal = firstStart.y === firstEnd.y;
  const secondHorizontal = secondStart.y === secondEnd.y;

  if (firstHorizontal && secondHorizontal) {
    const y = firstStart.y;
    const left = Math.max(
      Math.min(firstStart.x, firstEnd.x),
      Math.min(secondStart.x, secondEnd.x),
    );
    const right = Math.min(
      Math.max(firstStart.x, firstEnd.x),
      Math.max(secondStart.x, secondEnd.x),
    );
    return left === right
      ? [{ x: left, y }]
      : [
          { x: left, y },
          { x: right, y },
        ];
  }

  if (!firstHorizontal && !secondHorizontal) {
    const x = firstStart.x;
    const top = Math.max(
      Math.min(firstStart.y, firstEnd.y),
      Math.min(secondStart.y, secondEnd.y),
    );
    const bottom = Math.min(
      Math.max(firstStart.y, firstEnd.y),
      Math.max(secondStart.y, secondEnd.y),
    );
    return top === bottom
      ? [{ x, y: top }]
      : [
          { x, y: top },
          { x, y: bottom },
        ];
  }

  const horizontalStart = firstHorizontal ? firstStart : secondStart;
  const verticalStart = firstHorizontal ? secondStart : firstStart;
  return [{ x: verticalStart.x, y: horizontalStart.y }];
};

const traceWireNetwork = (paths: Point[][], source: Point, target: Point) => {
  const routedPaths = paths.map(orthogonalPoints);
  const nodes = new Map<string, Point>();
  const addNode = (point: Point) => nodes.set(pointKey(point), point);
  addNode(source);
  addNode(target);

  for (const path of routedPaths) {
    for (const point of path) addNode(point);
  }

  const segments = routedPaths.flatMap((path) =>
    path.slice(0, -1).flatMap((start, index) => {
      const end = path[index + 1];
      return end ? [{ start, end }] : [];
    }),
  );

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const first = segments[i];
      const second = segments[j];
      if (!first || !second) continue;
      for (const point of segmentTouchPoints(
        first.start,
        first.end,
        second.start,
        second.end,
      )) {
        addNode(point);
      }
    }
  }

  const graph = new Map<string, Map<string, number>>();
  const connect = (from: Point, to: Point) => {
    const fromKey = pointKey(from);
    const toKey = pointKey(to);
    if (fromKey === toKey) return;
    const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    graph.set(fromKey, graph.get(fromKey) ?? new Map<string, number>());
    graph.set(toKey, graph.get(toKey) ?? new Map<string, number>());
    graph.get(fromKey)?.set(toKey, distance);
    graph.get(toKey)?.set(fromKey, distance);
  };

  for (const segment of segments) {
    const segmentNodes = Array.from(nodes.values())
      .filter((point) => pointOnSegment(point, segment.start, segment.end))
      .sort((a, b) =>
        segment.start.x === segment.end.x ? a.y - b.y : a.x - b.x,
      );
    for (let i = 0; i < segmentNodes.length - 1; i += 1) {
      const from = segmentNodes[i];
      const to = segmentNodes[i + 1];
      if (from && to) connect(from, to);
    }
  }

  const sourceKey = pointKey(source);
  const targetKey = pointKey(target);
  const distances = new Map<string, number>([[sourceKey, 0]]);
  const previous = new Map<string, string>();
  const open = new Set([sourceKey]);

  while (open.size > 0) {
    const current = Array.from(open).sort(
      (a, b) =>
        (distances.get(a) ?? Number.POSITIVE_INFINITY) -
        (distances.get(b) ?? Number.POSITIVE_INFINITY),
    )[0];
    if (!current) break;
    open.delete(current);
    if (current === targetKey) break;

    for (const [next, distance] of graph.get(current) ?? []) {
      const nextDistance =
        (distances.get(current) ?? Number.POSITIVE_INFINITY) + distance;
      if (nextDistance < (distances.get(next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next, nextDistance);
        previous.set(next, current);
        open.add(next);
      }
    }
  }

  if (!distances.has(targetKey)) return null;
  const reversed: Point[] = [];
  let cursor: string | undefined = targetKey;
  while (cursor) {
    const point = nodes.get(cursor);
    if (point) reversed.push(point);
    cursor = cursor === sourceKey ? undefined : previous.get(cursor);
  }
  return reversed.reverse();
};

const wireIntersectsRect = (points: Point[], rect: Rect) => {
  const routed = orthogonalPoints(points);
  if (routed.some((point) => pointInRect(point, rect))) return true;
  return routed.slice(0, -1).some((start, index) => {
    const end = routed[index + 1];
    if (!end) return false;
    if (start.y === end.y) {
      return (
        between(start.y, rect.top, rect.bottom) &&
        rangesOverlap(start.x, end.x, rect.left, rect.right)
      );
    }
    return (
      between(start.x, rect.left, rect.right) &&
      rangesOverlap(start.y, end.y, rect.top, rect.bottom)
    );
  });
};

const displayBinary = (value: unknown, width = 1) => {
  const bits =
    value &&
    typeof value === "object" &&
    "bits" in value &&
    Array.isArray((value as { bits?: unknown }).bits)
      ? (value as { bits: Array<string | number> }).bits
      : null;
  if (!bits) return "X".repeat(width);
  return bits
    .slice(0, width)
    .reverse()
    .map((bit) => String(bit))
    .join("");
};

const isInvertingGate = (type: CircuitComponentKind) =>
  ["not", "nand", "nor", "xnor"].includes(type);

const isCurvedGate = (type: CircuitComponentKind) =>
  ["or", "nor", "xor", "xnor", "odd-parity", "even-parity"].includes(type);

const rotatedSide = (
  side: PortSpec["side"],
  rotation: CircuitComponent["rotation"],
): PortSpec["side"] => {
  const sides: PortSpec["side"][] = ["top", "right", "bottom", "left"];
  const index = sides.indexOf(side);
  return sides[(index + rotation / 90) % sides.length] ?? side;
};

const componentSideCounts = (component: CircuitComponent, rotated = true) => {
  const ports = componentDefinitions[component.type].getPorts(component.attrs);
  return ports.reduce(
    (acc, port) => {
      const side = rotated
        ? rotatedSide(port.side, component.rotation)
        : port.side;
      acc[side] += 1;
      return acc;
    },
    { left: 0, right: 0, top: 0, bottom: 0 } as Record<
      PortSpec["side"],
      number
    >,
  );
};

const componentBodyInsets = (component: CircuitComponent, rotated = true) => {
  const counts = componentSideCounts(component, rotated);
  return {
    left: GRID,
    right: GRID,
    top: counts.top > 0 ? GRID * 2 : 0,
    bottom: counts.bottom > 0 ? GRID * 2 : 0,
  };
};

const getComponentBaseSize = (component: CircuitComponent) => {
  const counts = componentSideCounts(component, false);
  const sideRows = Math.max(counts.left, counts.right, 2);
  const topCols = Math.max(counts.top, counts.bottom);
  const insets = componentBodyInsets(component, false);
  const height =
    insets.top + gridUnitsForCenteredPorts(sideRows) * GRID + insets.bottom;
  if (component.type === "input-pin" || component.type === "output-pin") {
    const bitWidth = Math.min(
      32,
      Math.max(1, Math.trunc(Number(component.attrs.width) || 1)),
    );
    return {
      width: Math.max(120, bitWidth * GRID + GRID * 2),
      height,
    };
  }
  if (gateTypes.has(component.type)) {
    return {
      width:
        component.type === "not" || component.type === "buffer" ? 120 : 140,
      height,
    };
  }
  if (logisimGlyphTypes.has(component.type)) {
    return {
      width: component.type === "splitter" ? 100 : 120,
      height,
    };
  }
  return {
    width: Math.max(160, gridUnitsForCenteredPorts(topCols) * GRID),
    height,
  };
};

const getComponentSize = (component: CircuitComponent) => {
  const size = getComponentBaseSize(component);
  return component.rotation === 90 || component.rotation === 270
    ? { width: size.height, height: size.width }
    : size;
};

const rotateLocalPoint = (
  point: Point,
  size: { width: number; height: number },
  rotation: CircuitComponent["rotation"],
): Point => {
  if (rotation === 90) return { x: size.height - point.y, y: point.x };
  if (rotation === 180)
    return { x: size.width - point.x, y: size.height - point.y };
  if (rotation === 270) return { x: point.y, y: size.width - point.x };
  return point;
};

const getBasePortsWithLocalPositions = (component: CircuitComponent) => {
  const ports = componentDefinitions[component.type].getPorts(component.attrs);
  const size = getComponentBaseSize(component);
  const bodyInsets = componentBodyInsets(component, false);
  const bodyWidth = size.width - bodyInsets.left - bodyInsets.right;
  const bodyHeight = size.height - bodyInsets.top - bodyInsets.bottom;
  const isCompactIO =
    component.type === "input-pin" || component.type === "output-pin";
  const sideGroups = {
    left: ports.filter((port) => port.side === "left"),
    right: ports.filter((port) => port.side === "right"),
    top: ports.filter((port) => port.side === "top"),
    bottom: ports.filter((port) => port.side === "bottom"),
  };

  const positionFor = (port: PortSpec): Point => {
    const side = port.side;
    const group = sideGroups[side];
    const index = group.findIndex((candidate) => candidate.id === port.id);
    if (side === "left") {
      return {
        x: 0,
        y: isCompactIO
          ? GRID
          : bodyInsets.top +
            centeredPortCoordinate(bodyHeight, index, group.length),
      };
    }
    if (side === "right") {
      return {
        x: size.width,
        y: isCompactIO
          ? GRID
          : bodyInsets.top +
            centeredPortCoordinate(bodyHeight, index, group.length),
      };
    }
    if (side === "top")
      return {
        x:
          bodyInsets.left +
          centeredPortCoordinate(bodyWidth, index, group.length),
        y: 0,
      };
    return {
      x:
        bodyInsets.left +
        centeredPortCoordinate(bodyWidth, index, group.length),
      y: size.height,
    };
  };

  return ports.map((port) => ({ port, position: positionFor(port) }));
};

const getPortsWithPositions = (component: CircuitComponent) => {
  const origin = snapPoint(component);
  const baseSize = getComponentBaseSize(component);
  return getBasePortsWithLocalPositions(component).map(({ port, position }) => {
    const rotated = rotateLocalPoint(position, baseSize, component.rotation);
    return {
      port,
      position: { x: origin.x + rotated.x, y: origin.y + rotated.y },
    };
  });
};

const cleanWaypoints = (waypoints: Point[], source: Point, target: Point) => {
  const withoutEnds = waypoints.filter(
    (point) => !pointsEqual(point, source) && !pointsEqual(point, target),
  );
  const deduped: Point[] = [];
  for (const point of withoutEnds) {
    if (!deduped.some((existing) => pointsEqual(existing, point))) {
      deduped.push(point);
    }
  }

  const withEnds = [source, ...deduped, target];
  const collapsed: Point[] = [];
  for (let i = 0; i < withEnds.length; i += 1) {
    const prev = collapsed[collapsed.length - 1];
    const current = withEnds[i];
    const next = withEnds[i + 1];
    if (!current) continue;
    if (prev && next) {
      const collinear =
        (prev.x === current.x && current.x === next.x) ||
        (prev.y === current.y && current.y === next.y);
      if (collinear) continue;
    }
    if (!prev || !pointsEqual(prev, current)) {
      collapsed.push(current);
    }
  }
  return collapsed.slice(1, -1);
};

const gateLegInset = (
  component: CircuitComponent,
  side: PortSpec["side"],
  size: { width: number; height: number },
) => {
  if (!gateTypes.has(component.type)) return null;
  const bodyX = GRID;
  const bodyWidth = size.width - GRID * 2;
  const bubble = isInvertingGate(component.type);

  if (side === "left") {
    if (component.type === "not" || component.type === "buffer")
      return bodyX + 14;
    if (isCurvedGate(component.type)) return bodyX + 18;
    return bodyX + 12;
  }

  if (side === "right") {
    if (component.type === "not" || component.type === "buffer") {
      return bodyX + bodyWidth - (bubble ? 20 : 8);
    }
    if (isCurvedGate(component.type)) {
      return bodyX + bodyWidth - (bubble ? 18 : 6);
    }
    return bodyX + bodyWidth - 20;
  }

  return null;
};

const getPortInnerPosition = (component: CircuitComponent, port: PortSpec) => {
  const origin = snapPoint(component);
  const baseSize = getComponentBaseSize(component);
  const insets = componentBodyInsets(component, false);
  const outer = getBasePortsWithLocalPositions(component).find(
    (candidate) => candidate.port.id === port.id,
  )?.position;
  if (!outer) return origin;
  const gateInset = gateLegInset(component, port.side, baseSize);
  const inner =
    port.side === "left"
      ? { x: gateInset ?? insets.left, y: outer.y }
      : port.side === "right"
        ? { x: gateInset ?? baseSize.width - insets.right, y: outer.y }
        : port.side === "top"
          ? { x: outer.x, y: insets.top }
          : { x: outer.x, y: baseSize.height - insets.bottom };
  const rotated = rotateLocalPoint(inner, baseSize, component.rotation);
  return { x: origin.x + rotated.x, y: origin.y + rotated.y };
};

const endpointPosition = (
  components: CircuitComponent[],
  endpoint: WireEndpoint,
) => {
  const component = components.find(
    (candidate) => candidate.id === endpoint.componentId,
  );
  if (!component) return null;
  return (
    getPortsWithPositions(component).find(
      ({ port }) => port.id === endpoint.portId,
    )?.position ?? null
  );
};

const endpointSide = (
  components: CircuitComponent[],
  endpoint: WireEndpoint,
) => {
  const component = components.find(
    (candidate) => candidate.id === endpoint.componentId,
  );
  if (!component) return null;
  const port = componentDefinitions[component.type]
    .getPorts(component.attrs)
    .find((candidate) => candidate.id === endpoint.portId);
  return port ? rotatedSide(port.side, component.rotation) : null;
};

const orthogonalPoints = (points: Point[]) => {
  const snapped = points.map(snapPoint);
  const result: Point[] = [];
  for (const point of snapped) {
    const previous = result[result.length - 1];
    if (previous && previous.x !== point.x && previous.y !== point.y) {
      result.push({ x: point.x, y: previous.y });
    }
    if (previous?.x !== point.x || previous.y !== point.y) {
      result.push(point);
    }
  }
  return result;
};

const nextDraftDirection = (
  current: DraftDirection,
  start: Point,
  cursor: Point,
): DraftDirection => {
  if (pointsEqual(start, cursor)) return current;
  if (!current) {
    const dx = Math.abs(cursor.x - start.x);
    const dy = Math.abs(cursor.y - start.y);
    if (dx === 0 && dy > 0) return "vertical";
    if (dy === 0 && dx > 0) return "horizontal";
    if (dx > 0 || dy > 0) return dx >= dy ? "horizontal" : "vertical";
    return null;
  }
  if (current === "horizontal" && cursor.x === start.x) {
    return cursor.y === start.y ? null : "vertical";
  }
  if (current === "vertical" && cursor.y === start.y) {
    return cursor.x === start.x ? null : "horizontal";
  }
  return current;
};

const draftPolyline = (
  start: Point,
  waypoints: Point[],
  cursor: Point,
  direction: DraftDirection,
) => {
  const fixed = [start, ...waypoints].map(snapPoint);
  const anchor = fixed[fixed.length - 1];
  const snappedCursor = snapPoint(cursor);
  if (!anchor || pointsEqual(anchor, snappedCursor)) return fixed;
  if (anchor.x === snappedCursor.x || anchor.y === snappedCursor.y) {
    return [...fixed, snappedCursor];
  }
  const elbow =
    direction === "vertical"
      ? { x: anchor.x, y: snappedCursor.y }
      : { x: snappedCursor.x, y: anchor.y };
  return [...fixed, elbow, snappedCursor];
};

const draftWaypoints = (
  start: Point,
  waypoints: Point[],
  cursor: Point,
  direction: DraftDirection,
) =>
  cleanWaypoints(
    draftPolyline(start, waypoints, cursor, direction).slice(1, -1),
    start,
    cursor,
  );

const draftDirectionForSide = (
  side: PortSpec["side"] | null,
): DraftDirection =>
  side === "top" || side === "bottom" ? "vertical" : "horizontal";

const wirePath = (points: Point[]) =>
  orthogonalPoints(points)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

const basicWirePath = (
  wire: CircuitWire,
  components: CircuitComponent[],
): Point[] | null => {
  const source = endpointPosition(components, wire.source);
  const target = endpointPosition(components, wire.target);
  if (!source || !target) return null;
  const waypoints = wire.waypoints ?? [];
  return orthogonalPoints([source, ...waypoints, target]);
};

const componentCollides = (
  _component: CircuitComponent,
  _components: CircuitComponent[],
  _ignoredComponentIds: Set<string>,
) => {
  return false;
};

const findOpenComponentPosition = (
  component: CircuitComponent,
  components: CircuitComponent[],
  _wires: CircuitWire[],
  _freeWires: FreeWire[],
  ignoredComponentIds = new Set<string>(),
) => {
  const start = snapPoint(component);
  const test = (point: Point) =>
    !componentCollides(
      { ...component, x: point.x, y: point.y },
      components,
      ignoredComponentIds,
    );

  if (test(start)) return start;

  for (let radius = 1; radius <= 10; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const point = {
          x: start.x + dx * GRID,
          y: start.y + dy * GRID,
        };
        if (test(point)) return point;
      }
    }
  }

  return start;
};

const moveWireSegment = (
  points: Point[],
  index: number,
  orientation: "horizontal" | "vertical",
  delta: number,
) => {
  const first = points[index];
  const second = points[index + 1];
  const source = points[0];
  const target = points[points.length - 1];
  if (!first || !second || !source || !target) return points.slice(1, -1);
  const movedA =
    orientation === "horizontal"
      ? { ...first, y: first.y + delta }
      : { ...first, x: first.x + delta };
  const movedB =
    orientation === "horizontal"
      ? { ...second, y: second.y + delta }
      : { ...second, x: second.x + delta };
  const next = points.slice();
  if (index === 0) {
    next.splice(1, 0, movedA);
    next[2] = movedB;
  } else if (index + 1 === points.length - 1) {
    next[index] = movedA;
    next.splice(index + 1, 0, movedB);
  } else {
    next[index] = movedA;
    next[index + 1] = movedB;
  }
  return cleanWaypoints(next.slice(1, -1), source, target);
};

const moveFreeWireSegment = (
  points: Point[],
  index: number,
  orientation: "horizontal" | "vertical",
  delta: number,
) => {
  const first = points[index];
  const second = points[index + 1];
  if (!first || !second) return points;
  const next = points.slice();
  next[index] =
    orientation === "horizontal"
      ? { ...first, y: first.y + delta }
      : { ...first, x: first.x + delta };
  next[index + 1] =
    orientation === "horizontal"
      ? { ...second, y: second.y + delta }
      : { ...second, x: second.x + delta };
  return orthogonalPoints(next);
};

const screenToWorld = (
  point: Point,
  rect: DOMRect,
  viewport: CircuitViewport,
) => ({
  x: (point.x - rect.left - viewport.x) / viewport.zoom,
  y: (point.y - rect.top - viewport.y) / viewport.zoom,
});

function GateGlyph({
  component,
  selected,
  hasError,
}: {
  component: CircuitComponent;
  selected: boolean;
  hasError: boolean;
}) {
  const { colorScheme } = useThemeStore();
  const size = getComponentBaseSize(component);
  const bodyX = GRID;
  const bodyWidth = size.width - GRID * 2;
  const stroke = hasError
    ? "#ef4444"
    : selected
      ? colorScheme.accent
      : colorScheme.text;
  const fill = colorScheme.panel;
  const bubble = isInvertingGate(component.type);

  if (component.type === "not" || component.type === "buffer") {
    return (
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
      >
        <path
          d={`M ${bodyX + 22} 8 L ${bodyX + bodyWidth - (bubble ? 28 : 10)} ${size.height / 2} L ${bodyX + 22} ${size.height - 8} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
        />
        {bubble && (
          <circle
            cx={bodyX + bodyWidth - 16}
            cy={size.height / 2}
            r="6"
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
          />
        )}
      </svg>
    );
  }

  if (isCurvedGate(component.type)) {
    return (
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
      >
        {(component.type === "xor" || component.type === "xnor") && (
          <path
            d={`M ${bodyX + 8} 8 C ${bodyX + 24} ${size.height / 2}, ${bodyX + 24} ${size.height / 2}, ${bodyX + 8} ${size.height - 8}`}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
          />
        )}
        <path
          d={`M ${bodyX + 18} 8 C ${bodyX + bodyWidth * 0.55} 8, ${bodyX + bodyWidth - 24} ${size.height * 0.25}, ${bodyX + bodyWidth - (bubble ? 18 : 6)} ${size.height / 2} C ${bodyX + bodyWidth - 24} ${size.height * 0.75}, ${bodyX + bodyWidth * 0.55} ${size.height - 8}, ${bodyX + 18} ${size.height - 8} C ${bodyX + 32} ${size.height / 2}, ${bodyX + 32} ${size.height / 2}, ${bodyX + 18} 8 Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
        />
        {bubble && (
          <circle
            cx={bodyX + bodyWidth - 9}
            cy={size.height / 2}
            r="7"
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
          />
        )}
      </svg>
    );
  }

  return (
    <svg
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
    >
      <path
        d={`M ${bodyX + 12} 8 L ${bodyX + bodyWidth * 0.58} 8 C ${bodyX + bodyWidth - 14} 8, ${bodyX + bodyWidth - 14} ${size.height - 8}, ${bodyX + bodyWidth * 0.58} ${size.height - 8} L ${bodyX + 12} ${size.height - 8} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      {bubble && (
        <circle
          cx={bodyX + bodyWidth - 8}
          cy={size.height / 2}
          r="7"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

function LogisimGlyph({
  component,
  selected,
  hasError,
}: {
  component: CircuitComponent;
  selected: boolean;
  hasError: boolean;
}) {
  const { colorScheme } = useThemeStore();
  const size = getComponentBaseSize(component);
  const insets = componentBodyInsets(component, false);
  const x = insets.left;
  const top = insets.top;
  const width = size.width - insets.left - insets.right;
  const height = size.height - insets.top - insets.bottom;
  const bottom = top + height;
  const right = x + width;
  const stroke = hasError
    ? "#ef4444"
    : selected
      ? colorScheme.accent
      : colorScheme.text;
  const muted = colorScheme.textMuted;
  const fill = colorScheme.panel;
  const ports = getPortsWithPositions({ ...component, rotation: 0 }).map(
    ({ port, position }) => ({
      port,
      x: position.x - component.x,
      y: position.y - component.y,
    }),
  );

  if (component.type === "splitter") {
    const trunkX = x + width / 2;
    const inputs = ports.filter(({ port }) => port.direction === "input");
    const outputs = ports.filter(({ port }) => port.direction === "output");
    return (
      <svg width={size.width} height={size.height}>
        <path
          d={[
            ...inputs.map(({ x: portX, y }) => `M ${portX} ${y} H ${trunkX}`),
            ...outputs.map(({ x: portX, y }) => `M ${trunkX} ${y} H ${portX}`),
            `M ${trunkX} ${Math.min(...ports.map(({ y }) => y))} V ${Math.max(...ports.map(({ y }) => y))}`,
          ].join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (
    component.type === "mux" ||
    component.type === "demux" ||
    component.type === "decoder" ||
    component.type === "priority-encoder"
  ) {
    const narrowLeft = component.type === "mux";
    const name =
      component.type === "mux"
        ? "MUX"
        : component.type === "demux"
          ? "DMX"
          : component.type === "decoder"
            ? "Decd"
            : "PEnc";
    const path = narrowLeft
      ? `M ${x} ${top + 6} L ${right} ${top + height * 0.28} L ${right} ${bottom - height * 0.28} L ${x} ${bottom - 6} Z`
      : `M ${x} ${top + height * 0.28} L ${right} ${top + 6} L ${right} ${bottom - 6} L ${x} ${bottom - height * 0.28} Z`;
    return (
      <svg width={size.width} height={size.height}>
        <path d={path} fill={fill} stroke={stroke} strokeWidth="2" />
        <text
          fill={stroke}
          fontSize="13"
          textAnchor="middle"
          x={size.width / 2}
          y={top + height / 2 + 5}
        >
          {name}
        </text>
      </svg>
    );
  }

  if (sequentialTypes.has(component.type)) {
    const short =
      component.type === "d-flip-flop"
        ? "D"
        : component.type === "t-flip-flop"
          ? "T"
          : component.type === "jk-flip-flop"
            ? "JK"
            : component.type === "sr-flip-flop"
              ? "SR"
              : component.type === "shift-register"
                ? "Shift"
                : component.type === "counter"
                  ? "Ctr"
                  : "Reg";
    const clock = ports.find(({ port }) => port.id === "clock");
    return (
      <svg width={size.width} height={size.height}>
        <rect
          fill={fill}
          height={height}
          stroke={stroke}
          strokeWidth="2"
          width={width}
          x={x}
          y={top}
        />
        <text fill={stroke} fontSize="14" x={x + 10} y={top + 22}>
          {short}
        </text>
        <text
          fill={stroke}
          fontSize="14"
          textAnchor="end"
          x={right - 8}
          y={top + 22}
        >
          Q
        </text>
        {clock && (
          <path
            d={`M ${clock.x - 8} ${clock.y - 8} L ${clock.x} ${clock.y} L ${clock.x + 8} ${clock.y - 8}`}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
          />
        )}
        <text
          fill={muted}
          fontSize="11"
          textAnchor="middle"
          x={size.width / 2}
          y={bottom - 10}
        >
          {component.label}
        </text>
      </svg>
    );
  }

  return null;
}

function ComponentView({
  component,
  selected,
  hasError,
  onSelect,
  onStartDrag,
  onPortPointerDown,
  onPortPointerUp,
  onToggleValue,
}: {
  component: CircuitComponent;
  selected: boolean;
  hasError: boolean;
  onSelect: (event: React.PointerEvent) => void;
  onStartDrag: (event: React.PointerEvent) => void;
  onPortPointerDown: (event: React.PointerEvent, port: PortSpec) => void;
  onPortPointerUp: (event: React.PointerEvent, port: PortSpec) => void;
  onToggleValue: (event: React.PointerEvent) => void;
}) {
  const { colorScheme } = useThemeStore();
  const { design, simulation, updateComponentAttrs } = useCircuitStore();
  const definition = componentDefinitions[component.type];
  const size = getComponentSize(component);
  const baseSize = getComponentBaseSize(component);
  const origin = snapPoint(component);
  const ports = getPortsWithPositions(component);
  const isGate = gateTypes.has(component.type);
  const isLogisimGlyph = logisimGlyphTypes.has(component.type);
  const isCompactIO =
    component.type === "input-pin" || component.type === "output-pin";
  const canToggle =
    design.simulation.mode === "sim" &&
    ["input-pin", "switch", "button"].includes(component.type);
  const primaryValue =
    simulation.values[`${component.id}.out`] ??
    simulation.values[`${component.id}.q`] ??
    simulation.values[`${component.id}.in`] ??
    simulation.values[`${component.id}.segments`];
  const lit =
    ["led", "led-bar", "seven-segment", "hex-digit"].includes(component.type) &&
    (toNumber(primaryValue) ?? 0) > 0;
  const rotatedSurface =
    component.rotation === 0
      ? undefined
      : ({
          left: (size.width - baseSize.width) / 2,
          top: (size.height - baseSize.height) / 2,
          width: baseSize.width,
          height: baseSize.height,
          transform: `rotate(${component.rotation}deg)`,
        } satisfies React.CSSProperties);
  const valueText = displayBinary(
    primaryValue,
    Number(component.attrs.width) || 1,
  );
  const localBodyInsets = componentBodyInsets(component, false);
  const compactKind = component.type === "input-pin" ? "Input" : "Output";
  const compactBitCount = Math.min(
    32,
    Math.max(1, Math.trunc(Number(component.attrs.width) || 1)),
  );
  const compactBits = valueText.padStart(compactBitCount, "X").split("");

  return (
    <div
      className="absolute cursor-default select-none"
      style={{
        left: origin.x,
        top: origin.y,
        width: size.width,
        height: size.height,
      }}
      onPointerDown={(event) => {
        onSelect(event);
        onStartDrag(event);
      }}
    >
      {isGate ? (
        <div
          className="absolute"
          style={{
            left: rotatedSurface?.left ?? 0,
            top: rotatedSurface?.top ?? 0,
            width: baseSize.width,
            height: baseSize.height,
            transform: rotatedSurface?.transform,
            transformOrigin: "center",
          }}
        >
          <GateGlyph
            component={component}
            selected={selected}
            hasError={hasError}
          />
          <div className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 justify-center">
            <span
              className="px-2 py-0.5 text-[12px] font-semibold tracking-wide"
              style={{
                color: colorScheme.text,
                backgroundColor: "transparent",
                textShadow: "0 1px 6px rgba(0,0,0,0.7)",
              }}
            >
              {component.label}
            </span>
          </div>
        </div>
      ) : isLogisimGlyph ? (
        <div
          className="absolute"
          style={{
            left: rotatedSurface?.left ?? 0,
            top: rotatedSurface?.top ?? 0,
            width: baseSize.width,
            height: baseSize.height,
            transform: rotatedSurface?.transform,
            transformOrigin: "center",
          }}
        >
          <LogisimGlyph
            component={component}
            selected={selected}
            hasError={hasError}
          />
        </div>
      ) : isCompactIO ? (
        <div
          className="absolute flex flex-col items-center justify-start"
          style={{
            left: (rotatedSurface?.left ?? 0) + localBodyInsets.left,
            top: (rotatedSurface?.top ?? 0) + localBodyInsets.top + GRID - 14,
            width:
              baseSize.width - localBodyInsets.left - localBodyInsets.right,
            height:
              baseSize.height - localBodyInsets.top - localBodyInsets.bottom,
            transform: rotatedSurface?.transform,
            transformOrigin: "center",
            color: colorScheme.text,
          }}
        >
          <div
            className="grid h-7 w-full overflow-hidden rounded-sm border"
            style={{
              gridTemplateColumns: `repeat(${compactBitCount}, minmax(0, 1fr))`,
              backgroundColor: colorScheme.panel,
              borderColor: hasError
                ? "#ef4444"
                : selected
                  ? colorScheme.accent
                  : colorScheme.border,
              boxShadow: selected
                ? `0 0 0 1px ${colorScheme.accent}`
                : undefined,
            }}
          >
            {compactBits.map((bit, index) => (
              <button
                key={index}
                className="flex min-w-0 items-center justify-center border-r px-1 font-mono text-xs font-semibold last:border-r-0"
                onPointerDown={(event) => {
                  if (!canToggle) return;
                  event.stopPropagation();
                  const bitIndex = compactBitCount - index - 1;
                  const current =
                    typeof component.attrs.value === "number"
                      ? component.attrs.value
                      : 0;
                  updateComponentAttrs(component.id, {
                    value: current ^ (1 << bitIndex),
                  });
                }}
                style={{
                  borderColor: colorScheme.border,
                  color: bit === "1" ? colorScheme.accent : colorScheme.text,
                  backgroundColor:
                    bit === "1" ? `${colorScheme.accent}22` : "transparent",
                  cursor: canToggle ? "pointer" : "default",
                }}
              >
                {bit}
              </button>
            ))}
          </div>
          <div
            className="mt-2 max-w-full truncate text-center text-sm font-semibold"
            style={{ color: colorScheme.text }}
          >
            {component.label || compactKind}
          </div>
        </div>
      ) : (
        <div
          className="absolute rounded border px-3 py-2 text-xs shadow-xl"
          style={{
            left: (rotatedSurface?.left ?? 0) + localBodyInsets.left,
            top: (rotatedSurface?.top ?? 0) + localBodyInsets.top,
            width:
              baseSize.width - localBodyInsets.left - localBodyInsets.right,
            height:
              baseSize.height - localBodyInsets.top - localBodyInsets.bottom,
            transform: rotatedSurface?.transform,
            transformOrigin: "center",
            backgroundColor: colorScheme.panel,
            borderColor: hasError
              ? "#ef4444"
              : selected
                ? colorScheme.accent
                : colorScheme.border,
            color: colorScheme.text,
            boxShadow: selected ? `0 0 0 1px ${colorScheme.accent}` : undefined,
          }}
        >
          <div className="flex h-full min-w-0 flex-col">
            <div className="min-w-0 pr-8">
              <div className="truncate text-sm font-semibold">
                {component.label}
              </div>
              <div
                className="truncate text-[10px]"
                style={{ color: colorScheme.textMuted }}
              >
                {definition.label}
              </div>
            </div>
            {component.type === "seven-segment" ? (
              <SegmentDisplay
                activeColor={colorScheme.accent}
                inactiveColor={`${colorScheme.textMuted}44`}
                value={primaryValue}
              />
            ) : (
              <button
                className="mt-auto max-w-full self-start rounded px-1.5 py-0.5 font-mono text-[10px] whitespace-normal"
                onPointerDown={(event) => {
                  if (!canToggle) return;
                  event.stopPropagation();
                  onToggleValue(event);
                }}
                style={{
                  backgroundColor: lit ? colorScheme.accent : colorScheme.hover,
                  color: lit ? colorScheme.background : colorScheme.textMuted,
                  cursor: canToggle ? "pointer" : "default",
                }}
              >
                {canToggle && valueText.length > 1
                  ? valueText.split("").map((bit, index) => (
                      <span
                        key={index}
                        className="inline-block px-0.5"
                        onPointerDown={(event) => {
                          if (!canToggle) return;
                          event.stopPropagation();
                          const width = Number(component.attrs.width) || 1;
                          const bitIndex = width - index - 1;
                          const current =
                            typeof component.attrs.value === "number"
                              ? component.attrs.value
                              : 0;
                          updateComponentAttrs(component.id, {
                            value: current ^ (1 << bitIndex),
                          });
                        }}
                      >
                        {bit}
                      </span>
                    ))
                  : valueText}
              </button>
            )}
          </div>
        </div>
      )}

      <svg
        className="pointer-events-none absolute inset-0"
        width={size.width}
        height={size.height}
      >
        {ports.map(({ port, position }) => {
          const x = position.x - origin.x;
          const y = position.y - origin.y;
          const innerPosition = getPortInnerPosition(component, port);
          const inner = {
            x: innerPosition.x - origin.x,
            y: innerPosition.y - origin.y,
          };
          return (
            <line
              key={port.id}
              x1={x}
              y1={y}
              x2={inner.x}
              y2={inner.y}
              stroke={colorScheme.accent}
              strokeWidth={2}
            />
          );
        })}
      </svg>

      {ports.map(({ port, position }) => {
        const localX = position.x - origin.x;
        const localY = position.y - origin.y;
        const side = rotatedSide(port.side, component.rotation);
        return (
          <React.Fragment key={port.id}>
            {!isCompactIO && (
              <span
                className="pointer-events-none absolute z-10 max-w-16 truncate rounded-sm px-0.5 font-mono text-[9px] leading-tight"
                style={{
                  left:
                    side === "left"
                      ? localX + 12
                      : side === "right"
                        ? localX - 12
                        : localX,
                  top:
                    side === "top"
                      ? localY + 11
                      : side === "bottom"
                        ? localY - 20
                        : localY - 5,
                  transform:
                    side === "left"
                      ? "none"
                      : side === "right"
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                  color: colorScheme.textMuted,
                  backgroundColor: `${colorScheme.background}ee`,
                  textShadow: `0 0 4px ${colorScheme.background}`,
                }}
              >
                {port.label}
              </span>
            )}
            <button
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              onPointerDown={(event) => onPortPointerDown(event, port)}
              onPointerUp={(event) => onPortPointerUp(event, port)}
              title={`${port.label} (${port.width} bit): ${displayValue(simulation.values[`${component.id}.${port.id}`])}`}
              style={{
                left: localX,
                top: localY,
                backgroundColor: colorScheme.panel,
                borderColor: colorScheme.accent,
                cursor:
                  design.simulation.mode === "design" ? "crosshair" : "default",
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CircuitDesignerInner() {
  const { colorScheme } = useThemeStore();
  const {
    design,
    circuits,
    activeCircuitId,
    freeWires,
    editorSettings,
    simulation,
    issues,
    addCircuit,
    setActiveCircuit,
    deleteCircuit,
    setMode,
    setRunning,
    setSpeed,
    setViewport,
    setSelectedIds,
    setFreeWires,
    setAutoRouteMovedWires,
    addComponent,
    addCustomCircuitComponent,
    addComponents,
    duplicateSelected,
    deleteSelected,
    moveComponents,
    updateComponentAttrs,
    updateComponentLabel,
    rotateComponent,
    addWireWithWaypoints,
    updateWireWaypoints,
    deleteWire,
    toggleInput,
    tickClock,
    step,
    resetSimulation,
    importDesign,
  } = useCircuitStore();

  const canvasRef = React.useRef<HTMLDivElement>(null);
  const clipboardRef = React.useRef<{
    components: CircuitComponent[];
    wires: CircuitWire[];
  } | null>(null);
  const spacePressedRef = React.useRef(false);
  const viewportRef = React.useRef<CircuitViewport>(design.viewport);
  const viewportFrameRef = React.useRef<number | null>(null);
  const wheelGestureRef = React.useRef<{
    mode: "canvas" | "interactive";
    lastEventAt: number;
  } | null>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [selectedTool, setSelectedTool] =
    React.useState<CircuitComponentKind | null>(null);
  const [selectedCustomCircuitId, setSelectedCustomCircuitId] = React.useState<
    string | null
  >(null);
  const [wireMode, setWireMode] = React.useState(false);
  const [wireDraft, setWireDraft] = React.useState<WireDraft | null>(null);
  const wireDragIntentRef = React.useRef<WireDragIntent | null>(null);
  const freeWireDragSourceRef = React.useRef<"canvas" | "wire" | null>(null);
  const existingWirePointerIntentRef =
    React.useRef<ExistingWirePointerIntent | null>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const componentDragActiveRef = React.useRef(false);
  const [wireSegmentDrag, setWireSegmentDrag] =
    React.useState<WireSegmentDrag | null>(null);
  const [wirePointDrag, setWirePointDrag] =
    React.useState<WirePointDrag | null>(null);
  const [freeWireSegmentDrag, setFreeWireSegmentDrag] =
    React.useState<FreeWireSegmentDrag | null>(null);
  const [freeWirePointDrag, setFreeWirePointDrag] =
    React.useState<FreeWirePointDrag | null>(null);
  const [selectionDrag, setSelectionDrag] =
    React.useState<SelectionDrag | null>(null);
  const [selectedFreeWireId, setSelectedFreeWireId] = React.useState<
    string | null
  >(null);
  const [freeWireDraft, setFreeWireDraft] =
    React.useState<FreeWireDraft | null>(null);
  const [panStart, setPanStart] = React.useState<{
    pointer: Point;
    viewport: CircuitViewport;
  } | null>(null);
  const [cursorWorld, setCursorWorld] = React.useState<Point | null>(null);
  const [collapsedCategories, setCollapsedCategories] = React.useState<
    Record<CircuitCategory, boolean>
  >({
    Wiring: false,
    Gates: false,
    Plexers: true,
    Arithmetic: true,
    Memory: true,
    IO: true,
  });

  React.useEffect(() => {
    viewportRef.current = design.viewport;
  }, [design.viewport]);

  const scheduleViewport = React.useCallback(
    (
      updater:
        | CircuitViewport
        | ((current: CircuitViewport) => CircuitViewport),
    ) => {
      const next =
        typeof updater === "function" ? updater(viewportRef.current) : updater;
      viewportRef.current = next;
      if (viewportFrameRef.current !== null) return;
      viewportFrameRef.current = window.requestAnimationFrame(() => {
        viewportFrameRef.current = null;
        setViewport(viewportRef.current);
      });
    },
    [setViewport],
  );

  React.useEffect(
    () => () => {
      if (viewportFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportFrameRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!design.simulation.running || design.simulation.mode !== "sim") return;
    const interval = window.setInterval(
      () => tickClock(),
      Math.max(16, 1000 / design.simulation.speedHz),
    );
    return () => window.clearInterval(interval);
  }, [
    design.simulation.mode,
    design.simulation.running,
    design.simulation.speedHz,
    tickClock,
  ]);

  const getWorldPoint = React.useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return snapPoint(
        screenToWorld(
          { x: event.clientX, y: event.clientY },
          rect,
          viewportRef.current,
        ),
      );
    },
    [],
  );

  const setFreeWirePoints = React.useCallback(
    (wireId: string, points: Point[]) => {
      setFreeWires((current) =>
        current.map((wire) =>
          wire.id === wireId
            ? { ...wire, points: orthogonalPoints(points) }
            : wire,
        ),
      );
    },
    [setFreeWires],
  );

  const beginExistingWirePointerIntent = React.useCallback(
    (event: React.PointerEvent, wireId: string) => {
      const world = getWorldPoint(event);
      existingWirePointerIntentRef.current = {
        wireId,
        start: { x: event.clientX, y: event.clientY },
        origin: world,
        cursor: world,
        direction: null,
        active: false,
      };
    },
    [getWorldPoint],
  );

  const materializeFreeWire = React.useCallback(
    (points: Point[]) => {
      const basePath = orthogonalPoints(points);
      if (basePath.length < 2) return false;

      const connectedFreeWires = freeWires.filter((wire) =>
        wiresConnect(basePath, wire.points),
      );
      const connectedFreeWireIds = new Set(
        connectedFreeWires.map((wire) => wire.id),
      );
      const paths = [
        basePath,
        ...connectedFreeWires.map((wire) => orthogonalPoints(wire.points)),
      ];
      const tracePaths = [...paths];
      const endpointKey = (endpoint: WireEndpoint) =>
        `${endpoint.componentId}.${endpoint.portId}`;
      const touchesAnyPath = (point: Point) =>
        paths.some((path) => wireTouchesPoint(path, point));
      const pathTouchesAnyPath = (path: Point[]) =>
        paths.some((candidate) => wiresConnect(candidate, path));
      const terminals = design.components.flatMap((component) =>
        getPortsWithPositions(component).map(({ port, position }) => ({
          component,
          endpoint: { componentId: component.id, portId: port.id },
          port,
          position,
        })),
      );
      const terminalHits = terminals.filter(({ position }) =>
        touchesAnyPath(position),
      );
      type ConnectableEndpoint = {
        endpoint: WireEndpoint;
        position: Point;
        traceable: boolean;
      };
      const outputEndpoints = new Map<string, ConnectableEndpoint>();
      const inputEndpoints = new Map<string, ConnectableEndpoint>();

      for (const hit of terminalHits) {
        const key = endpointKey(hit.endpoint);
        const value = {
          endpoint: hit.endpoint,
          position: hit.position,
          traceable: true,
        };
        if (hit.port.direction === "output") {
          outputEndpoints.set(key, value);
        } else {
          inputEndpoints.set(key, value);
        }
      }

      for (const wire of design.wires) {
        const source = endpointPosition(design.components, wire.source);
        const target = endpointPosition(design.components, wire.target);
        if (!source || !target) continue;
        const waypoints = wire.waypoints ?? [];
        const key = endpointKey(wire.source);
        const realWirePath = orthogonalPoints([source, ...waypoints, target]);
        if (pathTouchesAnyPath(realWirePath)) {
          tracePaths.push(realWirePath);
          inputEndpoints.set(endpointKey(wire.target), {
            endpoint: wire.target,
            position: target,
            traceable: true,
          });
          outputEndpoints.set(
            key,
            outputEndpoints.get(key) ?? {
              endpoint: wire.source,
              position: source,
              traceable: true,
            },
          );
        }
      }

      if (outputEndpoints.size !== 1 || inputEndpoints.size === 0) {
        return false;
      }

      const source = Array.from(outputEndpoints.values())[0];
      if (!source) return false;
      let connected = false;
      for (const target of inputEndpoints.values()) {
        if (endpointKey(source.endpoint) === endpointKey(target.endpoint)) {
          continue;
        }
        const traced = source.traceable
          ? traceWireNetwork(tracePaths, source.position, target.position)
          : null;
        addWireWithWaypoints(
          source.endpoint,
          target.endpoint,
          traced
            ? cleanWaypoints(
                traced.slice(1, -1),
                source.position,
                target.position,
              )
            : [],
        );
        connected = true;
      }
      if (!connected) return false;

      if (connectedFreeWireIds.size > 0) {
        setFreeWires((current) =>
          current.filter((wire) => !connectedFreeWireIds.has(wire.id)),
        );
      }
      setSelectedFreeWireId(null);
      return true;
    },
    [
      addWireWithWaypoints,
      design.components,
      design.wires,
      freeWires,
      setFreeWires,
    ],
  );

  const commitFreeWire = React.useCallback(
    (points: Point[]) => {
      const routed = orthogonalPoints(points);
      if (routed.length < 2) return;
      if (materializeFreeWire(routed)) return;
      const id = `free-wire-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      setFreeWires((current) => [...current, { id, points: routed }]);
      setSelectedIds([]);
      setSelectedFreeWireId(id);
    },
    [materializeFreeWire, setFreeWires, setSelectedIds],
  );

  const rerouteWiresForComponents = React.useCallback(
    (componentIds: string[]) => {
      if (componentIds.length === 0) return;
      const latest = useCircuitStore.getState().design;
      const movedIds = new Set(componentIds);

      for (const wire of latest.wires) {
        const source = endpointPosition(latest.components, wire.source);
        const target = endpointPosition(latest.components, wire.target);
        if (!source || !target) continue;
        const connectedToMoved =
          movedIds.has(wire.source.componentId) ||
          movedIds.has(wire.target.componentId);
        if (connectedToMoved) {
          updateWireWaypoints(
            wire.id,
            movedWireWaypoints(
              source,
              target,
              endpointSide(latest.components, wire.source),
              endpointSide(latest.components, wire.target),
            ),
          );
        }
      }
    },
    [updateWireWaypoints],
  );

  const reconcileDroppedComponentConnections = React.useCallback(
    (componentIds: string[]) => {
      if (componentIds.length === 0) return;
      const latest = useCircuitStore.getState().design;
      const movedIds = new Set(componentIds);
      const terminals = latest.components.flatMap((component) =>
        getPortsWithPositions(component).map(({ port, position }) => ({
          component,
          endpoint: { componentId: component.id, portId: port.id },
          port,
          position,
        })),
      );
      const existing = new Set(
        latest.wires.map(
          (wire) =>
            `${wire.source.componentId}.${wire.source.portId}->${wire.target.componentId}.${wire.target.portId}`,
        ),
      );
      const additions: Array<{
        source: WireEndpoint;
        target: WireEndpoint;
        waypoints: Point[];
      }> = [];
      const add = (
        source: WireEndpoint,
        target: WireEndpoint,
        waypoints: Point[],
      ) => {
        const key = `${source.componentId}.${source.portId}->${target.componentId}.${target.portId}`;
        if (existing.has(key)) return;
        existing.add(key);
        additions.push({ source, target, waypoints });
      };

      for (const terminal of terminals) {
        if (!movedIds.has(terminal.component.id)) continue;

        for (const stationary of terminals) {
          if (
            movedIds.has(stationary.component.id) ||
            stationary.component.id === terminal.component.id ||
            stationary.port.direction === terminal.port.direction ||
            !pointsEqual(stationary.position, terminal.position)
          ) {
            continue;
          }
          const output =
            terminal.port.direction === "output" ? terminal : stationary;
          const input =
            terminal.port.direction === "input" ? terminal : stationary;
          add(output.endpoint, input.endpoint, []);
        }

        if (terminal.port.direction !== "input") continue;
        for (const wire of latest.wires) {
          if (
            movedIds.has(wire.source.componentId) ||
            movedIds.has(wire.target.componentId)
          ) {
            continue;
          }
          const path = basicWirePath(wire, latest.components);
          const source = endpointPosition(latest.components, wire.source);
          if (!path || !source || !wireTouchesPoint(path, terminal.position)) {
            continue;
          }
          const traced = traceWireNetwork([path], source, terminal.position);
          add(
            wire.source,
            terminal.endpoint,
            traced
              ? cleanWaypoints(traced.slice(1, -1), source, terminal.position)
              : [],
          );
        }
      }

      for (const addition of additions) {
        addWireWithWaypoints(
          addition.source,
          addition.target,
          addition.waypoints,
        );
      }
    },
    [addWireWithWaypoints],
  );

  React.useEffect(() => {
    if (
      design.simulation.mode !== "design" ||
      componentDragActiveRef.current ||
      drag ||
      freeWires.length === 0
    ) {
      return;
    }
    for (const wire of freeWires) {
      if (materializeFreeWire(wire.points)) break;
    }
  }, [
    drag,
    design.components,
    design.simulation.mode,
    freeWires,
    materializeFreeWire,
  ]);

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = snapPoint(
        screenToWorld(
          { x: event.clientX, y: event.clientY },
          rect,
          viewportRef.current,
        ),
      );
      setCursorWorld(world);

      if (panStart) {
        scheduleViewport({
          ...panStart.viewport,
          x: panStart.viewport.x + event.clientX - panStart.pointer.x,
          y: panStart.viewport.y + event.clientY - panStart.pointer.y,
        });
      }

      if (selectionDrag) {
        setSelectionDrag((current) =>
          current ? { ...current, current: world } : current,
        );
      }

      if (drag) {
        const dx = snap(
          (event.clientX - drag.start.x) / viewportRef.current.zoom,
        );
        const dy = snap(
          (event.clientY - drag.start.y) / viewportRef.current.zoom,
        );
        const positions = Object.fromEntries(
          drag.ids.map((id) => {
            const original = drag.originals[id] ?? { x: 0, y: 0 };
            return [id, { x: original.x + dx, y: original.y + dy }];
          }),
        );
        const movingIds = new Set(drag.ids);
        const nextComponents = design.components.map((component) => {
          const position = positions[component.id];
          return position
            ? { ...component, x: position.x, y: position.y }
            : component;
        });
        const blocked = nextComponents.some(
          (component) =>
            movingIds.has(component.id) &&
            componentCollides(component, nextComponents, movingIds),
        );
        if (!blocked) {
          moveComponents(positions);
        }
      }

      if (wireDraft) {
        const intent = wireDragIntentRef.current;
        if (intent && !intent.active) {
          const distance = Math.hypot(
            event.clientX - intent.start.x,
            event.clientY - intent.start.y,
          );
          if (distance > 4) {
            wireDragIntentRef.current = { ...intent, active: true };
          }
        }
        setWireDraft((current) => {
          if (!current) return current;
          const source =
            endpointPosition(design.components, current.source) ??
            current.cursor;
          const anchor = current.points[current.points.length - 1] ?? source;
          return {
            ...current,
            cursor: world,
            direction: nextDraftDirection(current.direction, anchor, world),
          };
        });
      }

      const existingWireIntent = existingWirePointerIntentRef.current;
      if (existingWireIntent) {
        const distance = Math.hypot(
          event.clientX - existingWireIntent.start.x,
          event.clientY - existingWireIntent.start.y,
        );
        const active = existingWireIntent.active || distance > 4;
        const direction = nextDraftDirection(
          existingWireIntent.direction,
          existingWireIntent.origin,
          world,
        );
        existingWirePointerIntentRef.current = {
          ...existingWireIntent,
          active,
          cursor: world,
          direction,
        };
        if (active) {
          setSelectedIds([]);
          setSelectedFreeWireId(null);
          setWireMode(true);
          freeWireDragSourceRef.current = "wire";
          setFreeWireDraft({
            points: [existingWireIntent.origin],
            cursor: world,
            direction,
          });
        }
      }

      if (freeWireDraft) {
        setFreeWireDraft((current) => {
          if (!current) return current;
          const anchor =
            current.points[current.points.length - 1] ?? current.cursor;
          return {
            ...current,
            cursor: world,
            direction: nextDraftDirection(current.direction, anchor, world),
          };
        });
      }

      if (freeWireSegmentDrag) {
        const dx = snap(
          (event.clientX - freeWireSegmentDrag.start.x) /
            viewportRef.current.zoom,
        );
        const dy = snap(
          (event.clientY - freeWireSegmentDrag.start.y) /
            viewportRef.current.zoom,
        );
        setFreeWirePoints(
          freeWireSegmentDrag.wireId,
          moveFreeWireSegment(
            freeWireSegmentDrag.points,
            freeWireSegmentDrag.index,
            freeWireSegmentDrag.orientation,
            freeWireSegmentDrag.orientation === "horizontal" ? dy : dx,
          ),
        );
      }

      if (freeWirePointDrag) {
        const dx = snap(
          (event.clientX - freeWirePointDrag.start.x) /
            viewportRef.current.zoom,
        );
        const dy = snap(
          (event.clientY - freeWirePointDrag.start.y) /
            viewportRef.current.zoom,
        );
        setFreeWirePoints(
          freeWirePointDrag.wireId,
          freeWirePointDrag.points.map((point, index) =>
            index === freeWirePointDrag.index
              ? { x: point.x + dx, y: point.y + dy }
              : point,
          ),
        );
      }

      if (wireSegmentDrag) {
        const dx = snap(
          (event.clientX - wireSegmentDrag.start.x) / viewportRef.current.zoom,
        );
        const dy = snap(
          (event.clientY - wireSegmentDrag.start.y) / viewportRef.current.zoom,
        );
        updateWireWaypoints(
          wireSegmentDrag.wireId,
          moveWireSegment(
            wireSegmentDrag.points,
            wireSegmentDrag.index,
            wireSegmentDrag.orientation,
            wireSegmentDrag.orientation === "horizontal" ? dy : dx,
          ),
        );
      }

      if (wirePointDrag) {
        const dx = snap(
          (event.clientX - wirePointDrag.start.x) / viewportRef.current.zoom,
        );
        const dy = snap(
          (event.clientY - wirePointDrag.start.y) / viewportRef.current.zoom,
        );
        const next = wirePointDrag.points.map((point, index) =>
          index === wirePointDrag.index
            ? { x: point.x + dx, y: point.y + dy }
            : point,
        );
        updateWireWaypoints(wirePointDrag.wireId, next);
      }
    };

    const handlePointerUp = () => {
      const finishedDrag = drag;
      const existingWireIntent = existingWirePointerIntentRef.current;
      const finishedExistingWireBranch = Boolean(existingWireIntent?.active);
      componentDragActiveRef.current = false;
      setDrag(null);
      setPanStart(null);

      if (selectionDrag) {
        const rect = rectFromPoints(selectionDrag.start, selectionDrag.current);
        const componentIds = design.components
          .filter((component) => {
            const origin = snapPoint(component);
            const size = getComponentSize(component);
            return rectsIntersect(rect, {
              left: origin.x,
              top: origin.y,
              right: origin.x + size.width,
              bottom: origin.y + size.height,
            });
          })
          .map((component) => component.id);
        const wireIds = design.wires
          .filter((wire) => {
            const source = endpointPosition(design.components, wire.source);
            const target = endpointPosition(design.components, wire.target);
            if (!source || !target) return false;
            return orthogonalPoints([
              source,
              ...(wire.waypoints ?? []),
              target,
            ]).some((point) => pointInRect(point, rect));
          })
          .map((wire) => wire.id);
        const freeWireIds = freeWires
          .filter((wire) => wireIntersectsRect(wire.points, rect))
          .map((wire) => wire.id);
        setSelectedIds(
          selectionDrag.additive
            ? Array.from(
                new Set([...design.selectedIds, ...componentIds, ...wireIds]),
              )
            : [...componentIds, ...wireIds],
        );
        setSelectedFreeWireId(
          freeWireIds[0] ??
            (selectionDrag.additive ? selectedFreeWireId : null),
        );
        setSelectionDrag(null);
      }

      if (wireDragIntentRef.current?.active) {
        if (wireDraft) {
          const source = endpointPosition(design.components, wireDraft.source);
          if (source && !pointsEqual(source, wireDraft.cursor)) {
            commitFreeWire(
              draftPolyline(
                source,
                wireDraft.points,
                wireDraft.cursor,
                wireDraft.direction,
              ),
            );
          }
        }
        setWireDraft(null);
      }
      wireDragIntentRef.current = null;

      if (existingWireIntent) {
        if (existingWireIntent.active) {
          const path = draftPolyline(
            existingWireIntent.origin,
            [],
            existingWireIntent.cursor,
            existingWireIntent.direction,
          );
          const end = path[path.length - 1];
          if (end && !pointsEqual(existingWireIntent.origin, end)) {
            commitFreeWire(path);
          }
          setWireMode(false);
        } else if (
          freeWires.some((wire) => wire.id === existingWireIntent.wireId)
        ) {
          setSelectedIds([]);
          setSelectedFreeWireId(existingWireIntent.wireId);
        } else {
          setSelectedIds([existingWireIntent.wireId]);
          setSelectedFreeWireId(null);
        }
        setFreeWireDraft(null);
      }
      existingWirePointerIntentRef.current = null;

      if (freeWireDraft && !finishedExistingWireBranch) {
        const start = freeWireDraft.points[0];
        if (freeWireDraft.points.length === 1 && start) {
          const startedFromWire = freeWireDragSourceRef.current === "wire";
          const path = draftPolyline(
            start,
            freeWireDraft.points.slice(1),
            freeWireDraft.cursor,
            freeWireDraft.direction,
          );
          const end = path[path.length - 1];
          if (end && !pointsEqual(start, end)) {
            commitFreeWire(path);
            setFreeWireDraft(null);
            if (startedFromWire) setWireMode(false);
          } else if (startedFromWire) {
            setFreeWireDraft(null);
            setWireMode(false);
          }
        }
      }
      freeWireDragSourceRef.current = null;

      if (wireSegmentDrag) {
        const wire = design.wires.find(
          (candidate) => candidate.id === wireSegmentDrag.wireId,
        );
        const source = wire && endpointPosition(design.components, wire.source);
        const target = wire && endpointPosition(design.components, wire.target);
        if (wire && source && target) {
          const cleaned = cleanWaypoints(wire.waypoints ?? [], source, target);
          updateWireWaypoints(wire.id, cleaned);
        }
      }

      if (wirePointDrag) {
        const wire = design.wires.find(
          (candidate) => candidate.id === wirePointDrag.wireId,
        );
        const source = wire && endpointPosition(design.components, wire.source);
        const target = wire && endpointPosition(design.components, wire.target);
        if (wire && source && target) {
          const cleaned = cleanWaypoints(wire.waypoints ?? [], source, target);
          updateWireWaypoints(wire.id, cleaned);
        }
      }

      const dragMoved =
        finishedDrag &&
        useCircuitStore.getState().design.components.some((component) => {
          const original = finishedDrag.originals[component.id];
          return (
            original &&
            (component.x !== original.x || component.y !== original.y)
          );
        });
      if (finishedDrag && dragMoved) {
        if (editorSettings.autoRouteMovedWires) {
          rerouteWiresForComponents(finishedDrag.ids);
        }
        reconcileDroppedComponentConnections(finishedDrag.ids);
      }

      setWireSegmentDrag(null);
      setWirePointDrag(null);
      setFreeWireSegmentDrag(null);
      setFreeWirePointDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    drag,
    commitFreeWire,
    design.components,
    design.selectedIds,
    design.wires,
    editorSettings.autoRouteMovedWires,
    freeWires,
    freeWireDraft,
    freeWirePointDrag,
    freeWireSegmentDrag,
    moveComponents,
    panStart,
    rerouteWiresForComponents,
    reconcileDroppedComponentConnections,
    scheduleViewport,
    selectedFreeWireId,
    setFreeWires,
    setFreeWirePoints,
    selectionDrag,
    setSelectedIds,
    updateWireWaypoints,
    wireDraft,
    wireSegmentDrag,
    wirePointDrag,
  ]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      )
        return;

      if (event.code === "Space") {
        event.preventDefault();
        spacePressedRef.current = true;
        return;
      }

      if ((event.key === "Backspace" || event.key === "Delete") && wireDraft) {
        event.preventDefault();
        setWireDraft((current) => {
          if (!current) return current;
          if (current.points.length === 0) return null;
          return {
            ...current,
            points: current.points.slice(0, -1),
          };
        });
        return;
      }
      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        freeWireDraft
      ) {
        event.preventDefault();
        setFreeWireDraft((current) => {
          if (!current) return current;
          if (current.points.length <= 1) return null;
          return {
            ...current,
            points: current.points.slice(0, -1),
          };
        });
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        (design.selectedIds.length > 0 || selectedFreeWireId)
      ) {
        event.preventDefault();
        if (selectedFreeWireId) {
          setFreeWires((current) =>
            current.filter((wire) => wire.id !== selectedFreeWireId),
          );
          setSelectedFreeWireId(null);
        }
        if (design.selectedIds.length > 0) {
          deleteSelected();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedFreeWireId(null);
        setSelectedIds([
          ...design.components.map((component) => component.id),
          ...design.wires.map((wire) => wire.id),
        ]);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        const selected = new Set(design.selectedIds);
        const components = design.components.filter((component) =>
          selected.has(component.id),
        );
        const componentIds = new Set(
          components.map((component) => component.id),
        );
        clipboardRef.current = {
          components,
          wires: design.wires.filter(
            (wire) =>
              componentIds.has(wire.source.componentId) &&
              componentIds.has(wire.target.componentId),
          ),
        };
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        const clipboard = clipboardRef.current;
        if (!clipboard) {
          duplicateSelected();
          return;
        }
        addComponents(
          clipboard.components.map((component) => ({
            ...component,
            x: component.x + GRID * 2,
            y: component.y + GRID * 2,
          })),
          clipboard.wires,
        );
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      }
      if (event.key === "Escape") {
        setSelectedTool(null);
        setSelectedCustomCircuitId(null);
        setWireDraft(null);
        setFreeWireDraft(null);
        setSelectedFreeWireId(null);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spacePressedRef.current = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    addComponents,
    deleteSelected,
    design,
    duplicateSelected,
    freeWireDraft,
    selectedFreeWireId,
    setFreeWires,
    setSelectedIds,
    wireDraft,
  ]);

  const startDrag = (
    event: React.PointerEvent,
    component: CircuitComponent,
  ) => {
    if (design.simulation.mode !== "design") return;
    if (spacePressedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      setPanStart({
        pointer: { x: event.clientX, y: event.clientY },
        viewport: design.viewport,
      });
      return;
    }
    event.stopPropagation();
    const selected = design.selectedIds.includes(component.id)
      ? design.components.filter((candidate) =>
          design.selectedIds.includes(candidate.id),
        )
      : [component];
    componentDragActiveRef.current = true;
    setDrag({
      ids: selected.map((candidate) => candidate.id),
      start: { x: event.clientX, y: event.clientY },
      originals: Object.fromEntries(
        selected.map((candidate) => [
          candidate.id,
          { x: candidate.x, y: candidate.y },
        ]),
      ),
    });
  };

  const handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (spacePressedRef.current && event.button === 0) {
      setPanStart({
        pointer: { x: event.clientX, y: event.clientY },
        viewport: design.viewport,
      });
      return;
    }
    if (event.button === 1 || event.shiftKey || event.altKey) {
      setPanStart({
        pointer: { x: event.clientX, y: event.clientY },
        viewport: design.viewport,
      });
      return;
    }
    const world = getWorldPoint(event);
    if (wireDraft) {
      const source = endpointPosition(design.components, wireDraft.source);
      const last = wireDraft.points[wireDraft.points.length - 1];
      if (last && pointsEqual(last, world)) {
        setWireDraft({
          ...wireDraft,
          points: wireDraft.points.slice(0, -1),
          cursor: world,
          direction: null,
        });
      } else {
        const nextPoints = source
          ? draftPolyline(
              source,
              wireDraft.points,
              world,
              wireDraft.direction,
            ).slice(1)
          : [...wireDraft.points, world];
        setWireDraft({
          ...wireDraft,
          points: nextPoints,
          cursor: world,
          direction: null,
        });
      }
      return;
    }
    if (selectedTool && design.simulation.mode === "design") {
      const definition = componentDefinitions[selectedTool];
      const placement = findOpenComponentPosition(
        {
          id: "preview",
          type: selectedTool,
          label: definition.label,
          x: world.x,
          y: world.y,
          rotation: 0,
          attrs: { ...definition.defaultAttrs },
        },
        design.components,
        design.wires,
        freeWires,
      );
      addComponent(selectedTool, placement.x, placement.y);
      setSelectedFreeWireId(null);
      setSelectedTool(null);
      return;
    }
    if (selectedCustomCircuitId && design.simulation.mode === "design") {
      const circuit = circuits.find(
        (candidate) => candidate.id === selectedCustomCircuitId,
      );
      const ports: PortSpec[] = circuit
        ? [
            ...circuit.components
              .filter((component) => component.type === "input-pin")
              .map((component) => ({
                id: `in:${component.id}`,
                label: component.label,
                direction: "input" as const,
                width: Math.max(1, Number(component.attrs.width) || 1),
                side: "left" as const,
                required: true,
              })),
            ...circuit.components
              .filter((component) => component.type === "output-pin")
              .map((component) => ({
                id: `out:${component.id}`,
                label: component.label,
                direction: "output" as const,
                width: Math.max(1, Number(component.attrs.width) || 1),
                side: "right" as const,
              })),
          ]
        : [];
      const placement = findOpenComponentPosition(
        {
          id: "preview",
          type: "custom-circuit",
          label: circuit?.name.replace(/\.circuit\.json$/, "") ?? "Circuit",
          x: world.x,
          y: world.y,
          rotation: 0,
          attrs: {
            circuitId: selectedCustomCircuitId,
            ports: JSON.stringify(ports),
          },
        },
        design.components,
        design.wires,
        freeWires,
      );
      addCustomCircuitComponent(
        selectedCustomCircuitId,
        placement.x,
        placement.y,
      );
      setSelectedFreeWireId(null);
      setSelectedCustomCircuitId(null);
      return;
    }
    if (freeWireDraft && design.simulation.mode === "design") {
      const start = freeWireDraft.points[0];
      const last = freeWireDraft.points[freeWireDraft.points.length - 1];
      const nextPoints =
        last && pointsEqual(last, world)
          ? freeWireDraft.points
          : start
            ? draftPolyline(
                start,
                freeWireDraft.points.slice(1),
                world,
                freeWireDraft.direction,
              )
            : [...freeWireDraft.points, world];
      if (last && pointsEqual(last, world) && nextPoints.length > 1) {
        commitFreeWire(nextPoints);
        setFreeWireDraft(null);
        return;
      }
      setFreeWireDraft({ points: nextPoints, cursor: world, direction: null });
      return;
    }
    if (design.simulation.mode === "design") {
      setSelectionDrag({
        start: world,
        current: world,
        additive: event.shiftKey || event.metaKey || event.ctrlKey,
      });
      if (!(event.shiftKey || event.metaKey || event.ctrlKey)) {
        setSelectedIds([]);
        setSelectedFreeWireId(null);
      }
      return;
    }
    setSelectedIds([]);
    setSelectedFreeWireId(null);
  };

  React.useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      const now = performance.now();
      const target = event.target as HTMLElement;
      const currentGesture =
        wheelGestureRef.current &&
        now - wheelGestureRef.current.lastEventAt < 180
          ? wheelGestureRef.current
          : null;
      const gesture =
        currentGesture ??
        ({
          mode: target.closest("[data-canvas-interactive='true']")
            ? "interactive"
            : "canvas",
          lastEventAt: now,
        } as const);
      wheelGestureRef.current = { ...gesture, lastEventAt: now };
      if (gesture.mode === "interactive") return;

      event.preventDefault();
      const rect = element.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        scheduleViewport((current) => {
          const nextZoom = Math.min(
            3,
            Math.max(0.15, current.zoom * Math.exp(-event.deltaY * 0.008)),
          );
          const localX = event.clientX - rect.left;
          const localY = event.clientY - rect.top;
          const worldX = (localX - current.x) / current.zoom;
          const worldY = (localY - current.y) / current.zoom;
          return {
            zoom: nextZoom,
            x: localX - worldX * nextZoom,
            y: localY - worldY * nextZoom,
          };
        });
        return;
      }

      scheduleViewport((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [scheduleViewport]);

  const handlePortPointerDown = (
    event: React.PointerEvent,
    component: CircuitComponent,
    port: PortSpec,
  ) => {
    event.stopPropagation();
    if (design.simulation.mode !== "design") return;
    const position = endpointPosition(design.components, {
      componentId: component.id,
      portId: port.id,
    }) ?? { x: component.x, y: component.y };

    if (freeWireDraft) {
      const start = freeWireDraft.points[0];
      commitFreeWire(
        start
          ? draftPolyline(
              start,
              freeWireDraft.points.slice(1),
              position,
              freeWireDraft.direction,
            )
          : [...freeWireDraft.points, position],
      );
      setFreeWireDraft(null);
      return;
    }

    if (!wireDraft) {
      const connectedWire = design.wires.find(
        (wire) =>
          (wire.source.componentId === component.id &&
            wire.source.portId === port.id) ||
          (wire.target.componentId === component.id &&
            wire.target.portId === port.id),
      );
      if (connectedWire) {
        const isSource =
          connectedWire.source.componentId === component.id &&
          connectedWire.source.portId === port.id;
        deleteWire(connectedWire.id);
        setSelectedFreeWireId(null);
        setWireMode(true);
        setWireDraft({
          source: connectedWire.source,
          points: isSource ? [] : (connectedWire.waypoints ?? []),
          cursor: position,
          direction: null,
        });
        wireDragIntentRef.current = {
          source: connectedWire.source,
          start: { x: event.clientX, y: event.clientY },
          active: false,
        };
        return;
      }
    }

    if (!wireDraft) {
      const source = { componentId: component.id, portId: port.id };
      setSelectedFreeWireId(null);
      setWireMode(true);
      setWireDraft({
        source,
        points: [],
        cursor: position,
        direction: null,
      });
      wireDragIntentRef.current = {
        source,
        start: { x: event.clientX, y: event.clientY },
        active: false,
      };
      return;
    }
    wireDragIntentRef.current = null;
    connectWireDraftToPort(component, port);
  };

  const connectWireDraftToPort = (
    component: CircuitComponent,
    port: PortSpec,
  ) => {
    if (!wireDraft) return false;
    const target = { componentId: component.id, portId: port.id };
    if (
      target.componentId === wireDraft.source.componentId &&
      target.portId === wireDraft.source.portId
    ) {
      return false;
    }
    const sourceComponent = design.components.find(
      (candidate) => candidate.id === wireDraft.source.componentId,
    );
    const sourcePosition = endpointPosition(
      design.components,
      wireDraft.source,
    );
    const targetPosition = endpointPosition(design.components, target);
    const sourcePort = sourceComponent
      ? componentDefinitions[sourceComponent.type]
          .getPorts(sourceComponent.attrs)
          .find((candidate) => candidate.id === wireDraft.source.portId)
      : null;
    if (!sourcePort || sourcePort.direction === port.direction) return false;
    const sourceSide = endpointSide(design.components, wireDraft.source);
    const manualWaypoints =
      sourcePosition && targetPosition
        ? draftWaypoints(
            sourcePosition,
            wireDraft.points,
            targetPosition,
            wireDraft.direction ?? draftDirectionForSide(sourceSide),
          )
        : wireDraft.points;
    if (sourcePort.direction === "output") {
      addWireWithWaypoints(wireDraft.source, target, manualWaypoints);
    } else {
      addWireWithWaypoints(
        target,
        wireDraft.source,
        manualWaypoints.slice().reverse(),
      );
    }
    setWireDraft(null);
    wireDragIntentRef.current = null;
    return true;
  };

  const handlePortPointerUp = (
    event: React.PointerEvent,
    component: CircuitComponent,
    port: PortSpec,
  ) => {
    const intent = wireDragIntentRef.current;
    if (!intent?.active || design.simulation.mode !== "design") return;
    event.stopPropagation();
    const connected = connectWireDraftToPort(component, port);
    if (!connected) {
      setWireDraft(null);
      wireDragIntentRef.current = null;
    }
  };

  const exportDesign = () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = design.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importDesign(
        JSON.parse(await file.text()) as Parameters<typeof importDesign>[0],
      );
    } finally {
      event.target.value = "";
    }
  };

  const selectedComponent = design.components.find((component) =>
    design.selectedIds.includes(component.id),
  );
  const selectedWire = design.wires.find((wire) =>
    design.selectedIds.includes(wire.id),
  );
  const rotateComponentKeepingCenter = React.useCallback(
    (id: string, rotation?: CircuitComponent["rotation"]) => {
      const component = design.components.find(
        (candidate) => candidate.id === id,
      );
      if (!component) return;
      const before = getComponentSize(component);
      const nextRotation =
        rotation ??
        (((component.rotation + 90) % 360) as CircuitComponent["rotation"]);
      if (component.rotation === nextRotation) return;
      const after = getComponentSize({ ...component, rotation: nextRotation });
      rotateComponent(id, nextRotation);
      moveComponents({
        [id]: {
          x: component.x + (before.width - after.width) / 2,
          y: component.y + (before.height - after.height) / 2,
        },
      });
      if (editorSettings.autoRouteMovedWires) {
        window.queueMicrotask(() => rerouteWiresForComponents([id]));
      }
    },
    [
      design.components,
      editorSettings.autoRouteMovedWires,
      moveComponents,
      rerouteWiresForComponents,
      rotateComponent,
    ],
  );

  React.useEffect(() => {
    const handleArrowRotation = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        return;
      }
      const componentIds = design.components
        .filter((component) => design.selectedIds.includes(component.id))
        .map((component) => component.id);
      if (componentIds.length === 0) return;
      event.preventDefault();
      const rotationByArrow = {
        ArrowRight: 0,
        ArrowDown: 90,
        ArrowLeft: 180,
        ArrowUp: 270,
      } as const;
      const rotation =
        rotationByArrow[event.key as keyof typeof rotationByArrow];
      for (const id of componentIds) rotateComponentKeepingCenter(id, rotation);
    };
    window.addEventListener("keydown", handleArrowRotation);
    return () => window.removeEventListener("keydown", handleArrowRotation);
  }, [design.components, design.selectedIds, rotateComponentKeepingCenter]);
  const draftPath =
    wireDraft &&
    wirePath(
      draftPolyline(
        endpointPosition(design.components, wireDraft.source) ??
          wireDraft.cursor,
        wireDraft.points,
        wireDraft.cursor,
        wireDraft.direction,
      ),
    );

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden rounded-lg border"
      style={{
        backgroundColor: colorScheme.background,
        borderColor: colorScheme.border,
      }}
    >
      <aside
        className="flex w-64 shrink-0 flex-col border-r"
        style={{
          backgroundColor: colorScheme.sidebar,
          borderColor: colorScheme.border,
        }}
      >
        <div
          className="border-b p-3"
          style={{ borderColor: colorScheme.border }}
        >
          <div
            className="mb-2 flex items-center gap-2 text-sm font-semibold"
            style={{ color: colorScheme.text }}
          >
            <VscCircuitBoard size={16} />
            Circuit Library
          </div>
          <div
            className="flex items-center gap-2 rounded border px-2 py-1.5"
            style={{ borderColor: colorScheme.border }}
          >
            <VscSearch size={14} style={{ color: colorScheme.textMuted }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              style={{ color: colorScheme.text }}
              placeholder="Search parts"
            />
          </div>
        </div>
        <div className="min-h-0 flex-[3] overflow-y-auto p-2">
          {componentCategories.map((category) => (
            <PaletteCategory
              key={category}
              category={category}
              query={query}
              collapsed={collapsedCategories[category]}
              selectedTool={selectedTool}
              onToggle={() =>
                setCollapsedCategories((current) => ({
                  ...current,
                  [category]: !current[category],
                }))
              }
              onSelectTool={(type) => {
                setWireDraft(null);
                setFreeWireDraft(null);
                setSelectedFreeWireId(null);
                setSelectedCustomCircuitId(null);
                setWireMode(false);
                setSelectedTool((current) => (current === type ? null : type));
              }}
            />
          ))}
        </div>
        <CircuitList
          circuits={circuits}
          activeCircuitId={activeCircuitId}
          selectedCustomCircuitId={selectedCustomCircuitId}
          onAddCircuit={addCircuit}
          onSelectCircuit={setActiveCircuit}
          onDeleteCircuit={deleteCircuit}
          onUseCircuit={(id) => {
            setWireDraft(null);
            setFreeWireDraft(null);
            setSelectedFreeWireId(null);
            setWireMode(false);
            setSelectedTool(null);
            setSelectedCustomCircuitId((current) =>
              current === id ? null : id,
            );
          }}
        />
      </aside>

      <main
        ref={canvasRef}
        className="relative min-w-0 flex-1 overflow-hidden"
        onPointerDown={handleCanvasPointerDown}
        style={{ touchAction: "none", overscrollBehavior: "none" }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: colorScheme.background,
            backgroundImage: `
              linear-gradient(${colorScheme.border}55 1px, transparent 1px),
              linear-gradient(90deg, ${colorScheme.border}55 1px, transparent 1px),
              linear-gradient(${colorScheme.border}99 1px, transparent 1px),
              linear-gradient(90deg, ${colorScheme.border}99 1px, transparent 1px)
            `,
            backgroundSize: `${GRID * design.viewport.zoom}px ${GRID * design.viewport.zoom}px, ${GRID * design.viewport.zoom}px ${GRID * design.viewport.zoom}px, ${MAJOR_GRID * design.viewport.zoom}px ${MAJOR_GRID * design.viewport.zoom}px, ${MAJOR_GRID * design.viewport.zoom}px ${MAJOR_GRID * design.viewport.zoom}px`,
            backgroundPosition: `${design.viewport.x}px ${design.viewport.y}px`,
          }}
        />

        <div className="absolute top-3 left-3 z-30">
          <CircuitToolbar
            selectedTool={selectedTool}
            clearSelectedTool={() => setSelectedTool(null)}
            selectTool={(type) => {
              setWireDraft(null);
              setFreeWireDraft(null);
              setSelectedFreeWireId(null);
              setWireMode(false);
              setSelectedTool(type);
            }}
            wireMode={wireMode}
            toggleWireMode={() => {
              setWireMode((current) => !current);
              setWireDraft(null);
              setFreeWireDraft(null);
              setSelectedFreeWireId(null);
            }}
            mode={design.simulation.mode}
            running={design.simulation.running}
            speedHz={design.simulation.speedHz}
            tick={design.simulation.tick}
            setMode={setMode}
            setRunning={setRunning}
            setSpeed={setSpeed}
            step={step}
            tickClock={tickClock}
            resetSimulation={resetSimulation}
            autoRouteMovedWires={editorSettings.autoRouteMovedWires}
            setAutoRouteMovedWires={setAutoRouteMovedWires}
            exportDesign={exportDesign}
            openImport={() => importInputRef.current?.click()}
          />
        </div>

        <div className="absolute bottom-3 left-3 z-30 flex flex-col gap-2">
          <IssuePanel issues={issues} />
          {design.simulation.mode === "design" && (
            <div
              className="w-fit rounded border px-2 py-1 text-[10px] font-medium tracking-wide"
              style={{
                backgroundColor: colorScheme.panel,
                borderColor: colorScheme.border,
                color: colorScheme.text,
              }}
            >
              Space + drag to pan
            </div>
          )}
        </div>

        {(selectedTool ?? selectedCustomCircuitId ?? wireDraft) &&
          cursorWorld && (
            <div
              className="pointer-events-none absolute z-40 rounded border px-2 py-1 text-xs"
              style={{
                left:
                  cursorWorld.x * design.viewport.zoom + design.viewport.x + 14,
                top:
                  cursorWorld.y * design.viewport.zoom + design.viewport.y + 14,
                backgroundColor: colorScheme.panel,
                borderColor: colorScheme.accent,
                color: colorScheme.text,
              }}
            >
              {wireDraft
                ? "Click grid to add bend, click same point or press Backspace to undo"
                : selectedTool
                  ? `Click to place ${componentDefinitions[selectedTool].label}`
                  : selectedCustomCircuitId
                    ? `Click to place ${
                        circuits
                          .find(
                            (circuit) => circuit.id === selectedCustomCircuitId,
                          )
                          ?.name.replace(/\.circuit\.json$/, "") ?? "circuit"
                      }`
                    : ""}
            </div>
          )}

        {selectionDrag && (
          <div
            className="pointer-events-none absolute z-40 border"
            style={{
              left:
                Math.min(selectionDrag.start.x, selectionDrag.current.x) *
                  design.viewport.zoom +
                design.viewport.x,
              top:
                Math.min(selectionDrag.start.y, selectionDrag.current.y) *
                  design.viewport.zoom +
                design.viewport.y,
              width:
                Math.abs(selectionDrag.current.x - selectionDrag.start.x) *
                design.viewport.zoom,
              height:
                Math.abs(selectionDrag.current.y - selectionDrag.start.y) *
                design.viewport.zoom,
              backgroundColor: `${colorScheme.accent}22`,
              borderColor: colorScheme.accent,
            }}
          />
        )}

        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            transform: `translate(${design.viewport.x}px, ${design.viewport.y}px) scale(${design.viewport.zoom})`,
            width: 1,
            height: 1,
          }}
        >
          <svg className="absolute overflow-visible" width={1} height={1}>
            {freeWires.map((wire) => {
              const points = orthogonalPoints(wire.points);
              const selected = selectedFreeWireId === wire.id;
              return (
                <g key={wire.id}>
                  {points.slice(0, -1).map((point, index) => {
                    const next = points[index + 1];
                    if (!next) return null;
                    return (
                      <line
                        key={`${wire.id}-${index}`}
                        x1={point.x}
                        y1={point.y}
                        x2={next.x}
                        y2={next.y}
                        stroke="transparent"
                        strokeWidth={14}
                        pointerEvents="stroke"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (design.simulation.mode !== "design") {
                            setSelectedIds([]);
                            setSelectedFreeWireId(wire.id);
                            return;
                          }
                          if (selected) {
                            const orientation =
                              point.y === next.y ? "horizontal" : "vertical";
                            setFreeWireSegmentDrag({
                              wireId: wire.id,
                              index,
                              orientation,
                              start: { x: event.clientX, y: event.clientY },
                              points,
                            });
                            return;
                          }
                          beginExistingWirePointerIntent(event, wire.id);
                        }}
                      />
                    );
                  })}
                  <path
                    d={wirePath(points)}
                    fill="none"
                    stroke={
                      selected ? colorScheme.accent : `${colorScheme.accent}cc`
                    }
                    strokeWidth={selected ? 4 : 2}
                    strokeLinecap="square"
                    pointerEvents="none"
                  />
                  {design.simulation.mode === "design" &&
                    selected &&
                    points.map((point, index) => (
                      <circle
                        key={`${wire.id}-free-point-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={5}
                        fill={colorScheme.panel}
                        stroke={colorScheme.accent}
                        strokeWidth={2}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          setFreeWirePointDrag({
                            wireId: wire.id,
                            index,
                            start: { x: event.clientX, y: event.clientY },
                            points,
                          });
                        }}
                      />
                    ))}
                </g>
              );
            })}
            {freeWireDraft && (
              <path
                d={wirePath(
                  freeWireDraft.points[0]
                    ? draftPolyline(
                        freeWireDraft.points[0],
                        freeWireDraft.points.slice(1),
                        freeWireDraft.cursor,
                        freeWireDraft.direction,
                      )
                    : [freeWireDraft.cursor],
                )}
                fill="none"
                stroke={colorScheme.accent}
                strokeDasharray="3 4"
                strokeWidth={2}
              />
            )}
            {design.wires.map((wire) => {
              const source = endpointPosition(design.components, wire.source);
              const target = endpointPosition(design.components, wire.target);
              if (!source || !target) return null;
              const hasError = issues.some(
                (issue) =>
                  issue.wireId === wire.id && issue.severity === "error",
              );
              const selected = design.selectedIds.includes(wire.id);
              const connectedToMovingComponent =
                drag &&
                (drag.ids.includes(wire.source.componentId) ||
                  drag.ids.includes(wire.target.componentId));
              const previewWaypoints =
                connectedToMovingComponent && editorSettings.autoRouteMovedWires
                  ? movedWireWaypoints(
                      source,
                      target,
                      endpointSide(design.components, wire.source),
                      endpointSide(design.components, wire.target),
                    )
                  : null;
              const waypoints = previewWaypoints ?? wire.waypoints ?? [];
              const points = orthogonalPoints([source, ...waypoints, target]);
              const sourceValue =
                simulation.values[
                  valueKey(wire.source.componentId, wire.source.portId)
                ];
              const isHigh =
                design.simulation.mode === "sim" && toNumber(sourceValue) === 1;
              const strokeColor = hasError
                ? "#ef4444"
                : isHigh
                  ? colorScheme.accent
                  : design.simulation.mode === "sim"
                    ? `${colorScheme.textMuted}88`
                    : colorScheme.accent;
              const path = points
                .map(
                  (point, index) =>
                    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
                )
                .join(" ");
              return (
                <g key={wire.id}>
                  {points.slice(0, -1).map((point, index) => {
                    const next = points[index + 1];
                    if (!next) return null;
                    const orientation =
                      point.y === next.y ? "horizontal" : "vertical";
                    return (
                      <line
                        key={`${wire.id}-${index}`}
                        x1={point.x}
                        y1={point.y}
                        x2={next.x}
                        y2={next.y}
                        stroke="transparent"
                        strokeWidth={14}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (design.simulation.mode !== "design") {
                            setSelectedIds([wire.id]);
                            setSelectedFreeWireId(null);
                            return;
                          }
                          if (!selected && !event.shiftKey) {
                            beginExistingWirePointerIntent(event, wire.id);
                            return;
                          }
                          setSelectedIds([wire.id]);
                          setSelectedFreeWireId(null);
                          setWireSegmentDrag({
                            wireId: wire.id,
                            index,
                            orientation,
                            start: { x: event.clientX, y: event.clientY },
                            points,
                          });
                        }}
                      />
                    );
                  })}
                  <path
                    d={path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={selected || isHigh ? 4 : 2}
                    strokeLinecap="square"
                    pointerEvents="none"
                    style={{
                      filter: isHigh
                        ? `drop-shadow(0 0 6px ${colorScheme.accent})`
                        : undefined,
                    }}
                  />
                  {design.simulation.mode === "design" &&
                    selected &&
                    (wire.waypoints ?? []).map((point, index) => (
                      <circle
                        key={`${wire.id}-wp-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={6}
                        fill={colorScheme.panel}
                        stroke={colorScheme.accent}
                        strokeWidth={2}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          setSelectedIds([wire.id]);
                          setSelectedFreeWireId(null);
                          setWirePointDrag({
                            wireId: wire.id,
                            index,
                            start: { x: event.clientX, y: event.clientY },
                            points: wire.waypoints ?? [],
                          });
                        }}
                      />
                    ))}
                </g>
              );
            })}
            {draftPath && (
              <path
                d={draftPath}
                fill="none"
                stroke={colorScheme.accent}
                strokeDasharray="6 4"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}
          </svg>

          {design.components.map((component) => (
            <ComponentView
              key={component.id}
              component={component}
              selected={design.selectedIds.includes(component.id)}
              hasError={issues.some(
                (issue) =>
                  issue.componentId === component.id &&
                  issue.severity === "error",
              )}
              onSelect={(event) => {
                event.stopPropagation();
                setSelectedFreeWireId(null);
                if (event.shiftKey || event.metaKey || event.ctrlKey) {
                  setSelectedIds(
                    design.selectedIds.includes(component.id)
                      ? design.selectedIds.filter((id) => id !== component.id)
                      : [...design.selectedIds, component.id],
                  );
                } else {
                  setSelectedIds([component.id]);
                }
              }}
              onStartDrag={(event) => startDrag(event, component)}
              onPortPointerDown={(event, port) =>
                handlePortPointerDown(event, component, port)
              }
              onPortPointerUp={(event, port) =>
                handlePortPointerUp(event, component, port)
              }
              onToggleValue={(event) => {
                event.stopPropagation();
                toggleInput(component.id);
              }}
            />
          ))}
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void importJson(event)}
        />
      </main>

      <aside
        className="flex w-72 shrink-0 flex-col border-l"
        style={{
          backgroundColor: colorScheme.sidebar,
          borderColor: colorScheme.border,
        }}
      >
        <Inspector
          component={selectedComponent}
          wire={selectedWire}
          freeWireSelected={Boolean(selectedFreeWireId)}
          issues={issues}
          updateComponentAttrs={updateComponentAttrs}
          updateComponentLabel={updateComponentLabel}
          rotateComponent={rotateComponentKeepingCenter}
          duplicateSelected={duplicateSelected}
          deleteSelected={deleteSelected}
          deleteFreeWire={() => {
            if (!selectedFreeWireId) return;
            setFreeWires((current) =>
              current.filter((wire) => wire.id !== selectedFreeWireId),
            );
            setSelectedFreeWireId(null);
          }}
          updateWireWaypoints={updateWireWaypoints}
          deleteWire={deleteWire}
        />
      </aside>
    </div>
  );
}

export function CircuitDesigner() {
  return <CircuitDesignerInner />;
}
