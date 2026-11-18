import { describe, expect, it } from "vitest";
import { getSettingsPopoverPosition } from "../src/components/studio/useSettingsPopover";

describe("settings popover positioning",()=>{
  it("opens to the right and below when that side has room",()=>{
    expect(getSettingsPopoverPosition({left:50,top:10,bottom:40,right:80},400,300,1000,800)).toEqual({left:86,top:46,width:400,maxHeight:746});
  });
  it("opens to the left when a wide panel is triggered near the right edge",()=>{
    const position=getSettingsPopoverPosition({left:950,top:10,bottom:40,right:990},660,700,1000,800);
    expect(position.left).toBe(284);expect(position.top).toBe(46);
    expect(position.left+position.width).toBeLessThanOrEqual(992);
  });
  it("limits width on small windows",()=>{
    const position=getSettingsPopoverPosition({left:100,top:10,bottom:40},660,700,360,640);
    expect(position.width).toBe(344);expect(position.left).toBe(8);
  });
  it("uses available space above a trigger near the bottom",()=>{
    const position=getSettingsPopoverPosition({left:50,top:700,bottom:730,right:80},400,300,1000,800);
    expect(position.top).toBe(394);expect(position.top+300).toBeLessThan(700);
  });
  it("keeps a low trigger's panel inside a short viewport",()=>{
    const position=getSettingsPopoverPosition({left:120,top:160,bottom:190,right:160},560,460,1072,507);
    expect(position.top).toBeGreaterThanOrEqual(8);
    expect(position.top+position.maxHeight).toBeLessThanOrEqual(499);
    expect(position.maxHeight).toBeLessThan(460);
  });
});
