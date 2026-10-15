import { expect, it } from "vitest";
import { getBezierPath, Position } from "@xyflow/react";
import { getBezierControlPoints } from "../src/studio/edgeGeometry";

it("uses the rendered curve for every handle direction, including close and backward edges", () => {
  for (const source of Object.values(Position)) for (const target of Object.values(Position)) {
    for (const [x,y] of [[300,200],[-200,-100],[5,3]]) {
      const points=getBezierControlPoints(0,0,source,x,y,target);
      const [path]=getBezierPath({sourceX:0,sourceY:0,targetX:x,targetY:y,sourcePosition:source,targetPosition:target});
      const coordinates=path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      expect(coordinates).toEqual([0,0,points.x1,points.y1,points.x2,points.y2,x,y]);
    }
  }
});
