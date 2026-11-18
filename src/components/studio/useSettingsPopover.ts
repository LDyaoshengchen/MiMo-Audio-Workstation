import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export function getSettingsPopoverPosition(anchor: { left:number; top:number; bottom:number; right?:number }, width:number, height:number, viewportWidth:number, viewportHeight:number) {
  const gutter=8, gap=6;
  const panelWidth=Math.min(width, Math.max(0, viewportWidth-gutter*2));
  const anchorRight=anchor.right ?? anchor.left;
  const roomRight=viewportWidth-gutter-anchorRight-gap;
  const roomLeft=anchor.left-gap-gutter;
  const preferRight=(anchor.left+anchorRight)/2<viewportWidth/2;
  const openRight=preferRight ? roomRight>=panelWidth || roomRight>=roomLeft : roomRight>roomLeft;
  const desiredLeft=openRight ? anchorRight+gap : anchor.left-panelWidth-gap;
  const left=Math.max(gutter, Math.min(desiredLeft, viewportWidth-panelWidth-gutter));
  const roomBelow=Math.max(0,viewportHeight-anchor.bottom-gap-gutter);
  const roomAbove=Math.max(0,anchor.top-gap-gutter);
  const openAbove=roomBelow<height && roomAbove>roomBelow;
  const availableHeight=openAbove ? roomAbove : roomBelow;
  const visibleHeight=Math.min(height,availableHeight);
  const maxHeight=Math.max(0,availableHeight);
  const desiredTop=openAbove ? anchor.top-gap-visibleHeight : anchor.bottom+gap;
  const top=Math.max(gutter,Math.min(desiredTop,viewportHeight-gutter-visibleHeight));
  return {left,top,width:panelWidth,maxHeight};
}

export function useSettingsPopover(open:boolean, trigger:string | RefObject<HTMLElement | null>, panel:RefObject<HTMLElement | null>) {
  const [position,setPosition]=useState<ReturnType<typeof getSettingsPopoverPosition> | null>(null);
  useLayoutEffect(()=>{
    if(!open) {setPosition(null);return;}
    const anchor=typeof trigger==='string'?document.querySelector<HTMLElement>(trigger):trigger.current;
    if(!anchor || !panel.current) return;
    const update=()=>{
      if(!panel.current)return;
      const rect=anchor.getBoundingClientRect(),size=panel.current.getBoundingClientRect();
      const next=getSettingsPopoverPosition(rect,size.width,size.height,window.innerWidth,window.innerHeight);
      setPosition(previous=>previous&&Object.keys(next).every(key=>next[key as keyof typeof next]===previous[key as keyof typeof next])?previous:next);
    };
    update();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);observer?.observe(anchor);observer?.observe(panel.current);
    window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
    return ()=>{observer?.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
  },[open,trigger,panel]);
  const style:CSSProperties | undefined=position?{left:position.left,top:position.top,'--popover-width':`${position.width}px`,'--popover-max-height':`${position.maxHeight}px`} as CSSProperties:undefined;
  return {style,overlayClass:position?' settings-popover-overlay':'',panelClass:position?' settings-popover-panel':''};
}
