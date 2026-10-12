import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export function getSettingsPopoverPosition(anchor: { left:number; top:number; bottom:number }, width:number, height:number, viewportWidth:number, viewportHeight:number) {
  const gutter=8, gap=6;
  const panelWidth=Math.min(width, Math.max(0, viewportWidth-gutter*2));
  const left=Math.max(gutter, Math.min(anchor.left, viewportWidth-panelWidth-gutter));
  let top=anchor.bottom+gap;
  if(viewportHeight-top-gutter<160 && anchor.top>viewportHeight/2) top=Math.max(gutter,anchor.top-Math.min(height,anchor.top-gap-gutter)-gap);
  top=Math.max(gutter,Math.min(top,viewportHeight-gutter));
  return {left,top,width:panelWidth,maxHeight:Math.max(0,viewportHeight-top-gutter)};
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
