import { describe, expect, it } from "vitest";
import { getSettingsPopoverPosition } from "../src/components/studio/useSettingsPopover";

describe("settings popover positioning",()=>{
  it("opens below its trigger with a small gap",()=>{
    expect(getSettingsPopoverPosition({left:50,top:10,bottom:40},400,300,1000,800)).toEqual({left:50,top:46,width:400,maxHeight:746});
  });
  it("keeps wide settings panels inside the right edge",()=>{
    const position=getSettingsPopoverPosition({left:950,top:10,bottom:40},660,700,1000,800);
    expect(position.left).toBe(332);expect(position.top).toBe(46);
    expect(position.left+position.width).toBeLessThanOrEqual(992);
  });
  it("limits width on small windows",()=>{
    const position=getSettingsPopoverPosition({left:100,top:10,bottom:40},660,700,360,640);
    expect(position.width).toBe(344);expect(position.left).toBe(8);
  });
  it("uses available space above a trigger near the bottom",()=>{
    const position=getSettingsPopoverPosition({left:50,top:700,bottom:730},400,300,1000,800);
    expect(position.top).toBe(394);expect(position.top+300).toBeLessThan(700);
  });
});
