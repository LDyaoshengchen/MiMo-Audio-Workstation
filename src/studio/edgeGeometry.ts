import { Position } from "@xyflow/react";

export function getBezierControlPoints(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position = Position.Right,
  targetX: number,
  targetY: number,
  targetPosition: Position = Position.Left
): { x1: number; y1: number; x2: number; y2: number } {
  // Match React Flow's default Bezier curvature, including backwards handles.
  const offset = (distance: number) => distance >= 0 ? distance * 0.5 : 0.25 * 25 * Math.sqrt(-distance);
  const control = (x: number, y: number, otherX: number, otherY: number, position: Position) => {
    switch (position) {
      case Position.Left: return { x: x - offset(x - otherX), y };
      case Position.Right: return { x: x + offset(otherX - x), y };
      case Position.Top: return { x, y: y - offset(y - otherY) };
      case Position.Bottom: return { x, y: y + offset(otherY - y) };
    }
  };
  const first = control(sourceX, sourceY, targetX, targetY, sourcePosition);
  const second = control(targetX, targetY, sourceX, sourceY, targetPosition);
  return { x1: first.x, y1: first.y, x2: second.x, y2: second.y };
}

export function getClosestPointOnBezier(
  mx: number,
  my: number,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position = Position.Right,
  targetPosition: Position = Position.Left
): { x: number; y: number } {
  const { x1, y1, x2, y2 } = getBezierControlPoints(
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  );

  const x0 = sourceX, y0 = sourceY;
  const x3 = targetX, y3 = targetY;

  function sample(t: number) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
    return { x, y };
  }

  let bestT = 0.5;
  let minDistanceSq = Infinity;

  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const pt = sample(t);
    const distSq = (pt.x - mx) ** 2 + (pt.y - my) ** 2;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestT = t;
    }
  }

  let step = 1 / 120;
  for (let i = 0; i < 8; i++) {
    const tLeft = Math.max(0, bestT - step);
    const tRight = Math.min(1, bestT + step);
    const ptL = sample(tLeft);
    const ptR = sample(tRight);
    const distL = (ptL.x - mx) ** 2 + (ptL.y - my) ** 2;
    const distR = (ptR.x - mx) ** 2 + (ptR.y - my) ** 2;
    if (distL < minDistanceSq) {
      minDistanceSq = distL;
      bestT = tLeft;
    } else if (distR < minDistanceSq) {
      minDistanceSq = distR;
      bestT = tRight;
    }
    step /= 2;
  }

  return sample(bestT);
}
