// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { RoleVoiceLibrary } from '../src/components/studio/RoleVoiceLibrary';

it('shows migration ETA on the right and refreshes assets and Unicode location when completed', async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();
  let running=true;
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>{
    if(url.endsWith('storage-migration'))return {ok:true,json:async()=>({running,phase:running?'copying':'completed',remainingSeconds:running?5:0,startedAt:100})};
    if(running)return {ok:false,status:503,json:async()=>({error:'数据正在迁移，请稍后重试。'})};
    return {ok:true,json:async()=>url.endsWith('/location')?{directory:'D:\\中文目录\\role-voice-library'}:[{id:'migrated',name:'迁移后的角色',description:'描述',naturalControl:'',voiceId:'',provider:'mimo'}]};
  }));
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<RoleVoiceLibrary/>));
    await act(async()=>host.querySelector('button')!.click());
    expect(document.querySelector('.voice-library-migration strong')?.textContent).toBe('预计 5 秒');
    expect(document.querySelector('.voice-library-error')).toBeNull();
    expect(document.querySelector<HTMLButtonElement>('.voice-library-save')!.disabled).toBe(true);
    running=false;await act(async()=>vi.advanceTimersByTimeAsync(800));
    expect(document.querySelector('.voice-library-migration')).toBeNull();
    expect(document.querySelector('.voice-library-error')).toBeNull();
    await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="展开分组 未分组"]')?.click());
    expect(document.querySelector('.voice-library-list')?.textContent).toContain('迁移后的角色');
    expect(document.querySelector('.voice-library-location')?.textContent).toContain('D:\\中文目录\\role-voice-library');
  }finally{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();}
});
