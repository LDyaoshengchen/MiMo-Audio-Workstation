import { afterEach, expect, it, vi } from 'vitest';
import { createSynthesisActions, type SynthesisActionsContext } from '../src/studio/synthesisActions';
import { normalizeProviderOptions } from '../src/utils/providerConfig';
import { beginNodeTask, hasActiveNodeTasks, scopeNodeTask } from '../src/studio/taskScope';
import { createWorkspaceActions, type WorkspaceActionsContext } from '../src/studio/workspaceActions';
import type { StudioNode, WorkspacePayload } from '../src/types/studio';

afterEach(()=>vi.unstubAllGlobals());
const workspace=(id:string):WorkspacePayload=>({id,type:'board',name:id,createdAt:'',updatedAt:'',nodes:[],edges:[],stashItems:[]});
function context(nodes:StudioNode[]):SynthesisActionsContext {
  const ctx:SynthesisActionsContext={nodesRef:{current:nodes},edgesRef:{current:[]},activeWorkspace:workspace('A'),activeWorkspaceRef:{current:workspace('A')},providerOptionsRef:{current:normalizeProviderOptions({synthesisMode:'preset'})},isAnyApiKeyReady:()=>true,getApiHeaders:()=>({'X-API-Provider':'mimo'}),vocalAbortMapRef:{current:{}},setNodes:vi.fn(),setEdges:vi.fn(),saveWorkspace:vi.fn(async()=>{}),patchNode:vi.fn((id,patch)=>{ctx.nodesRef.current=ctx.nodesRef.current.map(node=>node.id===id?{...node,data:{...node.data,...patch}}:node);})};return ctx;
}
it.each(['voiceClone','voiceDesign'] as const)('%s ignores stale responses after a forced board switch, including reused node IDs',async(type)=>{
  const node:StudioNode={id:'source',type,position:{x:0,y:0},data:{title:'A',text:'Hello',instruction:'Deep'}};
  const ctx=context([node]);let entered!:()=>void,release!:(response:Response)=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;});const response=new Promise<Response>(resolve=>{release=resolve;});
  const fetch=vi.fn(()=>{entered();return response;});vi.stubGlobal('fetch',fetch);
  const actions=createSynthesisActions(()=>ctx),pending=type==='voiceClone'?actions.runVoiceClone('source',3):actions.runVoiceDesign('source',3);
  await started;expect(hasActiveNodeTasks('A')).toBe(true);const other:StudioNode={...node,data:{title:'B',text:'Unchanged'}};
  ctx.activeWorkspaceRef!.current=workspace('B');ctx.nodesRef.current=[other];ctx.edgesRef.current=[];
  vi.mocked(ctx.setNodes).mockClear();vi.mocked(ctx.setEdges).mockClear();
  release(Response.json({fileName:'qa.wav',audioDataUrl:'data:audio/wav;base64,AAAA',elapsedMs:1}));await pending;
  expect(ctx.nodesRef.current).toEqual([other]);expect(ctx.edgesRef.current).toEqual([]);
  expect(ctx.setNodes).not.toHaveBeenCalled();expect(ctx.setEdges).not.toHaveBeenCalled();expect(ctx.saveWorkspace).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(1);
  expect(hasActiveNodeTasks('A')).toBe(false);
});
it('does not resurrect a deleted generating node or append orphan artifacts',async()=>{
  const ctx=context([{id:'source',type:'voiceClone',position:{x:0,y:0},data:{text:'Hello'}}]);let release!:(response:Response)=>void,entered!:()=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;});vi.stubGlobal('fetch',vi.fn(()=>{entered();return new Promise<Response>(resolve=>{release=resolve;});}));
  const pending=createSynthesisActions(()=>ctx).runVoiceClone('source');await started;ctx.nodesRef.current=[];
  release(Response.json({fileName:'qa.wav',audioDataUrl:'data:audio/wav;base64,AAAA',elapsedMs:1}));await pending;
  expect(ctx.nodesRef.current).toEqual([]);expect(ctx.edgesRef.current).toEqual([]);expect(ctx.saveWorkspace).not.toHaveBeenCalled();
});
it.each(['single','batch'])('explicitly cleared references block %s generation instead of reusing role audio',async(kind)=>{
  const ctx=context([{id:'source',type:'integratedStudio',position:{x:0,y:0},data:{refAudioUrl:'data:audio/wav;base64,AAAA',voiceId:'old-id',batchRows:[{id:'row',title:'Row',text:'Hello',instruction:'',referenceMode:'none'}]}}]);
  ctx.providerOptionsRef.current=normalizeProviderOptions({synthesisMode:'reference'});const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const actions=createSynthesisActions(()=>ctx);await(kind==='single'?actions.runIntegratedSingleRow('source','row'):actions.runIntegratedBatch('source'));
  expect(fetch).not.toHaveBeenCalled();expect(ctx.nodesRef.current[0].data.error).toContain('缺少参考音频');
});
it('uses explicitly selected row audio instead of an old Voice ID, without mutating global options',async()=>{
  const ctx=context([{id:'source',type:'integratedStudio',position:{x:0,y:0},data:{voiceId:'old-id',assetProvider:'fishaudio',batchRows:[{id:'row',title:'Row',text:'Hello',instruction:'',refAudioUrl:'data:audio/wav;base64,AQID',refAudioName:'new.wav',referenceMode:'audio'}]}}]);
  let form:FormData|undefined;vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{form=init.body;return Response.json({fileName:'qa.wav',audioDataUrl:'data:audio/wav;base64,AAAA',elapsedMs:1});}));
  await createSynthesisActions(()=>ctx).runIntegratedSingleRow('source','row');
  expect(form?.get('synthesisMode')).toBe('reference');expect(form?.get('voiceId')).toBeNull();expect((form?.get('voice') as File).name).toBe('new.wav');expect(ctx.providerOptionsRef.current.synthesisMode).toBe('preset');
});

it('tracks actual running tasks until all finish, with idempotent cleanup', () => {
  const finishFirst = beginNodeTask('parallel'), finishSecond = beginNodeTask('parallel');
  expect(hasActiveNodeTasks('parallel')).toBe(true);
  finishFirst(); finishFirst();
  expect(hasActiveNodeTasks('parallel')).toBe(true);
  finishSecond();
  expect(hasActiveNodeTasks('parallel')).toBe(false);
});

it('does not fall back to a stale render snapshot when the active workspace is cleared', () => {
  const ctx = context([{ id: 'source', type: 'voiceClone', position: { x: 0, y: 0 }, data: { text: 'Hello' } }]);
  const scoped = scopeNodeTask(() => ctx, 'source');
  ctx.activeWorkspaceRef!.current = null;
  scoped.patchNode('source', { text: 'stale' });
  expect(ctx.patchNode).not.toHaveBeenCalled();
  expect(() => scoped.getApiHeaders()).toThrow('画板或源节点已改变');
});

it('blocks deletion of running boards before any request, without a global navigation lock', async () => {
  const finish = beginNodeTask('locked'), fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const actions = createWorkspaceActions(() => ({ canDeleteWorkspaces: ids => !ids.some(id => hasActiveNodeTasks(id)) } as WorkspaceActionsContext));
  try {
    await actions.executeDeleteWorkspace('locked');
    await actions.executeBatchDeleteWorkspaces(['locked']);
    expect(fetch).not.toHaveBeenCalled();
  } finally { finish(); }
});

it('allows deleting a different idle board without clearing the running board or its save timer', async () => {
  const finish = beginNodeTask('A');
  const ctx = {
    canDeleteWorkspaces: (ids: string[]) => !ids.some(id => hasActiveNodeTasks(id)),
    activeWorkspaceRef: { current: workspace('A') }, saveTimerRef: { current: 123 }, maxSaveTimerRef: { current: 456 },
    setNodes: vi.fn(), setEdges: vi.fn(), setActiveWorkspace: vi.fn(), loadWorkspaceList: vi.fn(async () => {}), onWorkspacesDeleted: vi.fn(),
  } as unknown as WorkspaceActionsContext;
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })));
  try {
    await createWorkspaceActions(() => ctx).executeDeleteWorkspace('B');
    expect(ctx.setActiveWorkspace).not.toHaveBeenCalled(); expect(ctx.setNodes).not.toHaveBeenCalled();
    expect(ctx.saveTimerRef.current).toBe(123); expect(ctx.maxSaveTimerRef.current).toBe(456);
    expect(ctx.onWorkspacesDeleted).toHaveBeenCalledWith(['B']);
  } finally { finish(); }
});
