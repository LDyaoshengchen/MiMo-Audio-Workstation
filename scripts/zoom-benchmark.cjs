// Isolated, hidden Electron renderer benchmark. No user profile/data or real API is accessed.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { createHash } = require("node:crypto");
const dist = path.resolve(process.argv[2] || "dist");
const count = Number(process.argv[3] || 100);
const saveLayout = process.argv.includes("--save-layout");
const smoke = process.argv.includes("--studio-smoke");
const actionAudit = process.argv.includes("--action-audit");
const overlapSmoke = process.argv.includes("--overlap-smoke");
const themePreview = process.argv.includes("--theme-preview");
const desktopSmoke = process.argv.includes("--desktop-controls-smoke");
const contextMenuSmoke = process.argv.includes("--context-menu-smoke");
const storageMigrationSmoke = process.argv.includes("--storage-migration-smoke");
const taskOwnershipSmoke = process.argv.includes("--task-ownership-smoke");
const mergeFavoriteSmoke = process.argv.includes("--merge-favorite-smoke");
const mergeFavoriteAssets = [];
let mergeFavoriteProductAudio;
const favoriteDigest = dataUrl => 'sha256:' + createHash('sha256').update(Buffer.from(dataUrl.split(',')[1], 'base64')).digest('hex');
const taskRequests = [];
let releaseTaskResponse;
let releaseSecondTaskResponse;
let previewMigrationRunning = true;
const productionSmoke = process.argv.includes("--production-tools-smoke");
const themeSettings = process.argv.includes("--theme-settings");
const themeGame = process.argv.includes("--theme-game");
const themeCustom = process.argv.includes("--theme-custom");
const palette = process.argv.find(value => value.startsWith("--palette="))?.split("=")[1] || "default";
const appearance = process.argv.find(value => value.startsWith("--appearance="))?.split("=")[1] || "light";
const nodePalette = process.argv.find(value => value.startsWith("--node-palette="))?.split("=")[1] || "apple";
const nodePaletteSwitch = process.argv.find(value => value.startsWith("--node-palette-switch="))?.split("=")[1];
if (!/^[a-z]+$/.test(nodePalette) || (nodePaletteSwitch && !/^[a-z]+$/.test(nodePaletteSwitch))) throw new Error("Invalid node palette");
if (!/^[a-z]+$/.test(palette) || !["light", "dark"].includes(appearance)) throw new Error("Invalid preview palette/mode");
if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error("Node count must be 1..500");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "mimo-zoom-profile-")));
const now = new Date().toISOString();
const workspace = {
  id: "zoom-benchmark", type: "board", name: "缩放性能测试", createdAt: now, updatedAt: now, stashItems: [],
  nodes: Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`, type: "voiceClone", position: { x: (i % 10) * 450, y: Math.floor(i / 10) * 500 },
    data: { title: `VO_${i}`, instruction: "Warm, clear and expressive.", text: "Performance testing only. No generation or vendor requests." },
  })),
  edges: Array.from({ length: count - 1 }, (_, i) => ({ id: `edge-${i}`, source: `node-${i}`, target: `node-${i + 1}`, sourceHandle: "output", targetHandle: "instruction", type: "deletable" })),
};
if (smoke || actionAudit) {
  const types = ["referenceAudio", "audioMerge", "voiceStyle", "prompt", "voiceClone", "voiceDesign", "artifact", "batchVoiceClone", "batchVoiceDesign", "batchArtifact", "integratedStudio", "gameVocal", "comment"];
  workspace.nodes = types.map((type, index) => ({
    id: `node-${index}`, type, position: { x: (index % 4) * 1500, y: Math.floor(index / 4) * 1600 },
    data: { title: type, text: "Isolated smoke test", instruction: "Clear", batchRows: [], batchArtifacts: [] },
  }));
  workspace.edges = [];
}
if (overlapSmoke) {
  workspace.nodes = Array.from({ length: 3 }, (_, i) => ({ id: `node-${i}`, type: "prompt", position: { x: 100 + i * 10, y: 100 + i * 10 }, data: { title: `重叠 ${i + 1}`, text: "仅隔离测试" } }));
  workspace.edges = [];
}
if (themePreview && !smoke && !actionAudit) {
  const wav = Buffer.alloc(44 + 12000);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(12000, 40);
  workspace.name = "怪物 · 配色预览";
  workspace.nodes = [
    { id: "node-0", type: "voiceClone", position: { x: 0, y: 0 }, data: { title: "VO_00085", text: "Come here! Let me catch you!", instruction: "Warm, clear and expressive. A natural, friendly voice." } },
    { id: "node-1", type: "voiceDesign", position: { x: 490, y: 0 }, data: { title: "深海海盗", text: "You know nothing~", voiceDescription: "A deep, calm voice with a warm, slightly weathered tone.", naturalControl: "A quiet sea breeze. Slow and confident." } },
    { id: "node-2", type: "artifact", position: { x: 980, y: 0 }, data: { title: "VO_00085_01", artifact: { fileName: "output.wav", audioDataUrl: "data:audio/wav;base64," + wav.toString("base64"), sourceNodeName: "VO_00085_01", elapsedMs: 6971, createdAt: "2026-10-09T17:00:02" } } },
  ];
  workspace.edges = [{ id: "edge-0", source: "node-0", target: "node-2", sourceHandle: "output", targetHandle: "artifact", type: "deletable" }];
  if (themeGame) { workspace.nodes[1].type = "gameVocal"; workspace.nodes[1].data.title = "游戏语音"; workspace.nodes[1].data.selectedVocals = [{id:"qa-vocal",categoryId:"cat_1",categoryTitle:"攻击",subcategoryId:"qa-sub",subcategoryLabel:"普通攻击",text:"Ha!"}]; }
}
if (actionAudit) {
  const wav=Buffer.alloc(44+12000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(12000,40);
  const item={id:'audit-artifact',seqIndex:1,rowTitle:'audit',fileName:'audit.wav',audioDataUrl:'data:audio/wav;base64,'+wav.toString('base64'),elapsedMs:10,createdAt:now,sourceNodeName:'audit'};
  for(const node of workspace.nodes){
    if(node.type==='artifact')node.data.artifact={...item};
    if(node.type==='batchArtifact')node.data.batchArtifacts=[{...item}];
    if(['integratedStudio','batchVoiceClone','batchVoiceDesign'].includes(node.type))node.data.batchRows=[{id:'audit-row',title:'audit',instruction:'Clear',text:'Test only',refAudioUrl:item.audioDataUrl,refAudioName:'audit.wav',artifacts:[{...item}]}];
  }
}
if (productionSmoke) {
  workspace.nodes[0].data.generationProgress = { completed: 8, total: 20 }; workspace.nodes[0].data.isRunning = true;
  const previewArtifact = workspace.nodes.find(node => node.data.artifact)?.data.artifact;
  workspace.nodes.push({ id:"qa-reference", type:"referenceAudio", position:{x:0,y:530}, data:{title:"参考音频"} });
  workspace.nodes.push({ id:"qa-merge", type:"audioMerge", position:{x:490,y:740}, data:{title:"参考音频整合"} });
  workspace.nodes.push({id:"qa-integrated",type:"integratedStudio",position:{x:0,y:1000},data:{title:"综合工作台",batchRows:[]}});
  workspace.nodes.push({id:"qa-batch-design",type:"batchVoiceDesign",position:{x:1400,y:1000},data:{title:"批量音色创造",batchRows:[{id:"qa-clear-row",title:"测试行",text:"Test only",instruction:"Clear"}]}});
  if(previewArtifact)workspace.nodes.push({id:"qa-batch-artifact",type:"batchArtifact",position:{x:980,y:270},data:{title:"批量产物",batchArtifacts:[{...previewArtifact,id:"qa-output",seqIndex:1}]}});
}
if (taskOwnershipSmoke) {
  const wav = Buffer.alloc(12044);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(12000, 40);
  const dataUrl = 'data:audio/wav;base64,' + wav.toString('base64');
  workspace.nodes = [
    { id: 'qa-clone', type: 'voiceClone', position: { x: 0, y: 0 }, data: { title: '任务归属', text: 'Test only', voiceId: 'old-id', assetProvider: 'mimo' } },
    { id: 'qa-integrated', type: 'integratedStudio', position: { x: 490, y: 0 }, data: { title: '参考音频优先级', voiceId: 'old-id', assetProvider: 'mimo', refAudioUrl: dataUrl, refAudioName: 'old.wav', batchRows: [{ id: 'row', title: '测试行', text: 'Test only', instruction: 'Clear', refAudioUrl: dataUrl, refAudioName: 'old.wav', referenceMode: 'inherit' }] } },
    { id: 'qa-audio', type: 'artifact', position: { x: 0, y: 700 }, data: { artifact: { fileName: 'new-role.wav', audioDataUrl: dataUrl } } },
  ];
  workspace.edges = [];
}
if (mergeFavoriteSmoke) {
  const audioDataUrl = workspace.nodes.find(node => node.data.artifact)?.data.artifact.audioDataUrl;
  if (!audioDataUrl) throw new Error('Merge favorite smoke requires --theme-preview');
  const productBytes = Buffer.from(audioDataUrl.split(',')[1], 'base64'); productBytes[productBytes.length - 1] = 1;
  mergeFavoriteProductAudio = 'data:audio/wav;base64,' + productBytes.toString('base64');
  workspace.nodes = [
    { id: 'qa-merge-favorite', type: 'audioMerge', position: { x: 0, y: 0 }, data: { title: '整合参考音色', audio: { fileName: 'merged-reference-original-with-a-long-name.wav', mimeType: 'audio/wav', size: 12044, dataUrl: audioDataUrl } } },
    { id: 'qa-merge-target', type: 'referenceAudio', position: { x: 490, y: 0 }, data: { title: '参考音频' } },
    { id: 'qa-favorite-product', type: 'artifact', position: { x: 0, y: 390 }, data: { title: '产物收藏测试', artifact: { fileName: 'favorite-product.wav', audioDataUrl: '/api/audio-cache/favorite-product.wav', elapsedMs: 1, createdAt: now, sourceNodeName: '产物收藏测试' } } },
  ];
  workspace.edges = [];
}
const secondWorkspace = { ...workspace, id: 'qa-other-board', name: '另一个画板', nodes: [], edges: [] };
const taskBoards = new Map([workspace, secondWorkspace].map(board => [board.id, JSON.parse(JSON.stringify(board))]));
let taskSaveVersion = Date.now();
const settings = { apiProvider: "mimo", apiEndpoint: "https://example.invalid/v1", hasApiKey: true, configured: true };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    if (mergeFavoriteSmoke && url.pathname === '/api/audio-cache/favorite-product.wav') {
      res.setHeader('Content-Type','audio/wav');res.end(Buffer.from(mergeFavoriteProductAudio.split(',')[1],'base64'));return;
    }
    if (mergeFavoriteSmoke && url.pathname === '/api/voice-library/favorite-status') {
      const sources=JSON.parse(url.searchParams.get('sources'));
      const hashes=new Set(mergeFavoriteAssets.filter(asset=>asset.favorite).map(asset=>favoriteDigest(asset.audio.dataUrl)));
      res.end(JSON.stringify(sources.map(source=>hashes.has(source==='/api/audio-cache/favorite-product.wav'?favoriteDigest(mergeFavoriteProductAudio):source))));return;
    }
    if (mergeFavoriteSmoke && url.pathname === '/api/voice-library') {
      if (req.method === 'POST') {
        const chunks = []; req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          mergeFavoriteAssets.push({ ...JSON.parse(Buffer.concat(chunks).toString('utf8')), id: 'saved-merge-'+(mergeFavoriteAssets.length+1) });
          res.end(JSON.stringify(mergeFavoriteAssets));
        });
      } else res.end(JSON.stringify(mergeFavoriteAssets));
      return;
    }
    if (mergeFavoriteSmoke && url.pathname.startsWith('/api/voice-library/')) {
      const id=decodeURIComponent(url.pathname.slice('/api/voice-library/'.length)),index=mergeFavoriteAssets.findIndex(asset=>asset.id===id);
      if (index>=0 && req.method==='PATCH') {
        const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{mergeFavoriteAssets[index].favorite=JSON.parse(Buffer.concat(chunks).toString('utf8')).favorite;res.end(JSON.stringify(mergeFavoriteAssets));});return;
      }
      if (index>=0 && req.method==='DELETE') {mergeFavoriteAssets.splice(index,1);res.end(JSON.stringify(mergeFavoriteAssets));return;}
    }
    if (taskOwnershipSmoke && url.pathname === '/api/tts/voiceclone') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        taskRequests.push(Buffer.concat(chunks).toString('utf8'));
        const respond = () => res.end(JSON.stringify({ fileName: 'qa.wav', audioDataUrl: workspace.nodes[2].data.artifact.audioDataUrl, elapsedMs: 1 }));
        if (taskRequests.length === 1) releaseTaskResponse = respond;
        else if (taskRequests.length === 2) releaseSecondTaskResponse = respond;
        else respond();
      });
      return;
    }
    if (taskOwnershipSmoke && url.pathname.startsWith('/api/workspaces/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/workspaces/'.length));
      const existing = taskBoards.get(id);
      if (!existing) { res.statusCode = 404; res.end(JSON.stringify({error:'Board not found'})); return; }
      if (req.method === 'PUT') {
        const chunks = []; req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const latest = taskBoards.get(id);
          if (body.baseUpdatedAt && body.baseUpdatedAt !== latest.updatedAt) { res.statusCode = 409; res.end(JSON.stringify({error:'Stale board version'})); return; }
          const saved = {...latest,...body,updatedAt:new Date(++taskSaveVersion).toISOString()}; delete saved.baseUpdatedAt;
          taskBoards.set(id,saved);res.end(JSON.stringify(saved));
        });
      } else {
        // Deliberately return stale A data: reactivation must use the live task graph.
        res.end(JSON.stringify(id === workspace.id ? workspace : existing));
      }
      return;
    }
    if(storageMigrationSmoke && url.pathname==='/api/settings/storage-migration'){res.end(JSON.stringify({running:previewMigrationRunning,phase:previewMigrationRunning?'copying':'completed',remainingSeconds:previewMigrationRunning?8:0,startedAt:100}));return;}
    if(storageMigrationSmoke && url.pathname.startsWith('/api/voice-library')){
      if(previewMigrationRunning){res.statusCode=503;res.end(JSON.stringify({error:'数据正在迁移，请稍后重试。'}));return;}
      if(url.pathname.endsWith('/location')){res.end(JSON.stringify({directory:'D:\\音色资料\\role-voice-library'}));return;}
    }
    const data = url.pathname === "/api/bootstrap" ? { settings, status: { ok: true, apiKeyConfigured: true }, workspaces: taskOwnershipSmoke ? [workspace, secondWorkspace] : [workspace], activeWorkspace: workspace }
      : url.pathname === "/api/settings/storage-path" ? { dataDir: "isolated-test", workspaceFilePath: "isolated-test", isCustom: false }
      : url.pathname === "/api/voice-library" ? [{ id: "qa-role", name: "测试角色音色", description: "Deep and calm", naturalControl: "Confident", voiceId: "", provider: "mimo", audio: workspace.nodes.find(node => node.data.artifact)?.data.artifact ? { fileName: "qa.wav", mimeType: "audio/wav", size: 12044, dataUrl: workspace.nodes.find(node => node.data.artifact).data.artifact.audioDataUrl } : undefined }]
      : url.pathname === '/api/workspaces/qa-other-board' ? secondWorkspace
      : url.pathname.startsWith("/api/workspaces/") ? workspace : {};
    if (saveLayout && req.method === "PUT") setTimeout(() => res.end(JSON.stringify(data)), 1200);
    else res.end(JSON.stringify(data));
    return;
  }
  const file = path.resolve(dist, url.pathname === "/" ? "index.html" : "." + decodeURIComponent(url.pathname));
  if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
  if ((saveLayout || themePreview || desktopSmoke) && file.endsWith("index.html")) {
    const theme = { mode: (themePreview || desktopSmoke) ? appearance : "light", nodePalette, autoHideTopbar: false, lightTheme: { preset: palette }, darkTheme: { preset: palette } };
    const html = fs.readFileSync(file, "utf8").replace("<head>", `<head><script>localStorage.setItem("mimo_theme_settings",JSON.stringify(${JSON.stringify(theme)}));</script>`);
    res.end(html); return;
  }
  fs.createReadStream(file).pipe(res);
});
let window;
let fatalTimer;
async function main() {
  await app.whenReady();
  if (desktopSmoke) {
    // Stub public release lookup: this diagnostic never contacts GitHub or user APIs.
    global.fetch = async () => ({ ok: true, json: async () => ({ tag_name: "v9.9.9" }) });
    const metadata=require("../package.json");require("../electron/desktop-controls.cjs").setupDesktopControls(metadata.appVersion||metadata.version);
  }
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  window = new BrowserWindow({ show: false, width: 1600, height: 1000,
    webPreferences: { offscreen: true, backgroundThrottling: false, nodeIntegration: false, contextIsolation: true,
      ...(desktopSmoke ? { preload: path.resolve("electron/preload.cjs") } : {}) } });
  if (desktopSmoke) { window.removeMenu(); require("../electron/desktop-controls.cjs").attachWindowShortcuts(window); }
  window.webContents.on("console-message", details => {
    if (details.level === "error") console.error("renderer:", details.message);
  });
  // All navigation/resources remain loopback; even accidental vendor calls are blocked.
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith("http://127.0.0.1:") && !details.url.startsWith("data:") && !details.url.startsWith("blob:") });
  });
  await window.loadURL(`http://127.0.0.1:${server.address().port}`);
  if (mergeFavoriteSmoke) {
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<100&&!document.querySelector('.merge-result-row .favorite-icon-button');i++)await new Promise(r=>setTimeout(r,50));
      const row=document.querySelector('.merge-result-row'),button=row?.querySelector('.favorite-icon-button'),label=row?.querySelector('.merge-result');
      if(!button||!button.querySelector('svg'))throw new Error('Missing merge favorite icon');
      const bounds=row.getBoundingClientRect(),icon=button.getBoundingClientRect();
      if(icon.right>bounds.right+1||icon.left<label.getBoundingClientRect().right-1||label.scrollWidth<=label.clientWidth||label.getAttribute('title')!==${JSON.stringify(workspace.nodes[0].data.audio.fileName)})throw new Error('Merge result and icon must remain compact and unclipped');
      const node=button.closest('.react-flow__node'),zoom=new DOMMatrixReadOnly(getComputedStyle(node.parentElement).transform).a;
      node.style.top=((innerHeight-70-icon.top)/zoom)+'px';
      button.click();
      for(let i=0;i<100&&!document.querySelector('.voice-library-save');i++)await new Promise(r=>setTimeout(r,30));
      if(document.querySelector('.voice-library-form')||document.querySelector('.voice-library-list')||document.querySelector('[placeholder="输入角色名称"]').value!=='整合参考音色'||!document.querySelector('.voice-favorite-preview').textContent.includes(${JSON.stringify(workspace.nodes[0].data.audio.fileName)}))throw new Error('Quick favorite must show only naming and the actual audio');
      if(document.activeElement!==document.querySelector('.voice-favorite-name'))throw new Error('Name must receive keyboard focus');
      await new Promise(r=>setTimeout(r,180));
      const panel=document.querySelector('.voice-library-dialog'),rect=panel.getBoundingClientRect();
      if(rect.width<200||rect.height<160||rect.left<0||rect.right>innerWidth||rect.top<0||rect.bottom>innerHeight||!document.elementFromPoint(rect.left+rect.width/2,rect.top+30)?.closest('.voice-library-dialog'))throw new Error('Favorite dialog must be visible above the canvas and fit the window');
      const save=document.querySelector('.voice-library-save'),saveRect=save.getBoundingClientRect();
      if(rect.width>365||rect.height>340||Math.abs(rect.top+rect.height/2-innerHeight/2)>2||!document.elementFromPoint(saveRect.x+saveRect.width/2,saveRect.y+saveRect.height/2)?.closest('.voice-library-save'))throw new Error('Naming popup and save button must remain compact, centered and directly clickable for a bottom node');
    })()`);
    await new Promise(resolve=>setTimeout(resolve,500));
    window.webContents.invalidate();
    await new Promise(resolve=>setTimeout(resolve,100));
    fs.writeFileSync(path.resolve('reports','merge-favorite-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<50&&document.querySelector('.voice-library-save').disabled;i++)await new Promise(r=>setTimeout(r,30));
      document.querySelector('.voice-library-save').click();
      for(let i=0;i<100&&document.querySelector('.voice-favorite-dialog');i++)await new Promise(r=>setTimeout(r,30));
      if(document.querySelector('.voice-favorite-dialog'))throw new Error('Successful quick save must close the popup');
      document.querySelector('[data-id="qa-merge-favorite"]').style.top='';
      document.querySelector('.topbar-actions .role-library-button').click();
      for(let i=0;i<100&&!document.querySelector('.voice-library-list article');i++)await new Promise(r=>setTimeout(r,30));
      const card=document.querySelector('.voice-library-list article'),transfer=new DataTransfer();
      if(!card?.draggable||!card.querySelector('[aria-label="取消收藏"]'))throw new Error('Reloaded asset must be a draggable favorite');
      card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));await new Promise(r=>setTimeout(r,60));
      document.querySelector('[data-id="qa-merge-target"] .file-picker').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));await new Promise(r=>setTimeout(r,120));
      if(!document.querySelector('[data-id="qa-merge-target"] .reference-audio-card')?.textContent.includes(${JSON.stringify(workspace.nodes[0].data.audio.fileName)})||document.querySelector('.voice-library-dialog'))throw new Error('Saved merge audio must remain reusable by reference nodes');
      if(!document.querySelector('[data-id="qa-merge-favorite"] audio')||document.querySelectorAll('[data-id="qa-merge-favorite"] .run-button').length!==1)throw new Error('Favorite action changed original merge controls');
    })()`);
    if (mergeFavoriteAssets.length !== 1 || !mergeFavoriteAssets[0].favorite || JSON.stringify(mergeFavoriteAssets[0].audio) !== JSON.stringify(workspace.nodes[0].data.audio)) throw new Error('Favorite must preserve complete merge audio metadata and content');
    await new Promise(resolve=>setTimeout(resolve,500));
    fs.writeFileSync(path.resolve('reports','merge-favorite-node-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`(async()=>{
      window.assertStar=async(selector,filled)=>{
        for(let i=0;i<100&&document.querySelector(selector)?.getAttribute('aria-pressed')!==String(filled);i++)await new Promise(r=>setTimeout(r,30));
        const button=document.querySelector(selector),svg=button?.querySelector('svg');
        if(button?.getAttribute('aria-pressed')!==String(filled)||svg?.getAttribute('fill')!==(filled?'currentColor':'none'))throw new Error('Incorrect favorite star state: '+selector);
        if(filled&&getComputedStyle(svg).fill!==getComputedStyle(svg).color)throw new Error('Filled star must use its existing icon color');
      };
      await window.assertStar('[data-id="qa-merge-favorite"] .favorite-icon-button',true);
      await window.assertStar('[data-id="qa-favorite-product"] .favorite-icon-button',false);
      document.querySelector('[data-id="qa-favorite-product"] .favorite-icon-button').click();
      for(let i=0;i<100&&(!document.querySelector('.voice-library-save')||document.querySelector('.voice-library-save').disabled);i++)await new Promise(r=>setTimeout(r,30));
      document.querySelector('.voice-library-save').click();
      await window.assertStar('[data-id="qa-favorite-product"] .favorite-icon-button',true);
      if(document.querySelector('.voice-favorite-dialog'))throw new Error('Product quick save must close after success');
      document.querySelector('.topbar-actions .role-library-button').click();
      for(let i=0;i<100&&document.querySelectorAll('.voice-library-list article').length!==2;i++)await new Promise(r=>setTimeout(r,30));
      const product=[...document.querySelectorAll('.voice-library-list article')].find(card=>card.querySelector('strong')?.textContent==='产物收藏测试');
      if(!product)throw new Error('Saved cached product missing');
      window.confirm=()=>true;product.querySelector('[title="删除角色"]').click();
      await window.assertStar('[data-id="qa-favorite-product"] .favorite-icon-button',false);
      const merge=document.querySelector('.voice-library-list article');
      merge.querySelector('[aria-label="取消收藏"]').click();
      await window.assertStar('[data-id="qa-merge-favorite"] .favorite-icon-button',false);
      merge.querySelector('[aria-label="收藏角色"]').click();
      await window.assertStar('[data-id="qa-merge-favorite"] .favorite-icon-button',true);
      document.querySelector('[aria-label="关闭角色音色库"]').click();
    })()`);
    await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<150&&document.querySelector('[data-id="qa-merge-favorite"] .favorite-icon-button')?.getAttribute('aria-pressed')!=='true';i++)await new Promise(r=>setTimeout(r,30));
      const merge=document.querySelector('[data-id="qa-merge-favorite"] .favorite-icon-button'),product=document.querySelector('[data-id="qa-favorite-product"] .favorite-icon-button');
      if(merge?.getAttribute('aria-pressed')!=='true'||merge.querySelector('svg').getAttribute('fill')!=='currentColor'||product?.getAttribute('aria-pressed')!=='false')throw new Error('Favorite state must survive reload for both node types');
    })()`);
    window.webContents.invalidate();await new Promise(r=>setTimeout(r,150));
    fs.writeFileSync(path.resolve('reports','favorite-star-state-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
    // Multiple cards with long names, descriptions, and controls exercise the real responsive grid.
    for(let i=0;i<8;i++)mergeFavoriteAssets.push({...mergeFavoriteAssets[0],id:'grid-'+i,name:i===0?'很长的角色名称_完整文件名保留在悬浮提示_0123456789':'角色音色 '+(i+2),description:'低沉、清晰的男声，语速平稳。',naturalControl:'自信，温和。'});
    await window.webContents.executeJavaScript(`document.querySelector('.topbar-actions .role-library-button').click()`);
    for(const [width,height,columns] of [[1600,1000,3],[1024,680,3],[520,640,2],[360,480,1]]){
      window.setContentSize(width,height);await new Promise(r=>setTimeout(r,250));
      await window.webContents.executeJavaScript(`(async()=>{
        for(let i=0;i<100&&document.querySelectorAll('.voice-library-list article').length!==9;i++)await new Promise(r=>setTimeout(r,30));
        const panel=document.querySelector('.voice-library-dialog'),list=document.querySelector('.voice-library-list'),cards=[...list.querySelectorAll('article')],bounds=panel.getBoundingClientRect();
        if(getComputedStyle(list).gridTemplateColumns.split(' ').length!==${columns})throw new Error('Incorrect role library column count at '+innerWidth);
        if(bounds.left<0||bounds.right>innerWidth||bounds.top<0||bounds.bottom>innerHeight+1||panel.scrollWidth>panel.clientWidth+1)throw new Error('Role library must fit narrow windows without horizontal overflow');
        if(!document.querySelector('.voice-library-form').hidden)throw new Error('Full editor must remain collapsed');
        const card=cards[0],rect=card.getBoundingClientRect();
        if(rect.height>112||card.scrollWidth>card.clientWidth+1)throw new Error('Role card must remain compact without overflow');
        for(const control of card.querySelectorAll('button,input')){
          const r=control.getBoundingClientRect();if(r.left<rect.left||r.right>rect.right)throw new Error('Card controls must fit their column');
        }
        const range=card.querySelector('.player-range');if(range.getBoundingClientRect().height>6)throw new Error('Progress track must not inherit tall text-input styling');
        const description=card.querySelector('.voice-library-description-toggle');description.click();await new Promise(r=>setTimeout(r,30));
        if(card.querySelector('.voice-library-asset-details').hidden)throw new Error('Description must remain expandable');description.click();
        const last=cards.at(-1);last.scrollIntoView({block:'nearest'});await new Promise(r=>setTimeout(r,40));
        const lastRect=last.getBoundingClientRect();if(lastRect.bottom>innerHeight+1)throw new Error('Last grid row must be reachable by scrolling');
        document.querySelector('.voice-library-body').scrollTop=0;
        await new Promise(r=>setTimeout(r,100));
      })()`);
      if(width===1600||width===520)fs.writeFileSync(path.resolve('reports','role-library-grid-'+width+'-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
    }
    window.setContentSize(1600,1000);await new Promise(r=>setTimeout(r,200));
    await window.webContents.executeJavaScript(`(async()=>{
      document.querySelector('[aria-label="关闭角色音色库"]').click();
      for(let i=0;i<100&&!document.querySelector('[data-id="qa-merge-favorite"] .favorite-icon-button');i++)await new Promise(r=>setTimeout(r,30));
      document.querySelector('[data-id="qa-merge-favorite"] .favorite-icon-button').click();
      for(let i=0;i<100&&!document.querySelector('.voice-favorite-dialog');i++)await new Promise(r=>setTimeout(r,30));
    })()`);
    window.setContentSize(1024,520);
    await new Promise(r=>setTimeout(r,200));
    await window.webContents.executeJavaScript(`(()=>{
      const panel=document.querySelector('.voice-favorite-dialog'),rect=panel.getBoundingClientRect(),button=panel.querySelector('.voice-library-save'),b=button.getBoundingClientRect();
      if(rect.left<0||rect.right>innerWidth||rect.top<0||rect.bottom>innerHeight||!document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.voice-library-save'))throw new Error('Quick favorite save must stay accessible in a small window');
    })()`);
    fs.writeFileSync(path.resolve('reports','quick-favorite-small-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
    console.log(JSON.stringify({scenario:'merge-favorite-smoke',appearance,icon:true,compact:true,saved:true,reloaded:true,reusable:true,filled:true,productCached:true,unfavorite:true,deleted:true,restartRestored:true,quickNaming:true,bottomNode:true,gridColumns:[3,2,1],smallWindow:true}));
    clearTimeout(fatalTimer);window.destroy();server.close();app.exit(0);return;
  }
  if (taskOwnershipSmoke) {
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<100&&!document.querySelector('[data-id="qa-clone"] .run-button');i++)await new Promise(r=>setTimeout(r,50));
      document.querySelector('[data-id="qa-clone"] .batch-nine-btn').click();
    })()`);
    for (let i = 0; i < 100 && !releaseTaskResponse; i++) await new Promise(r => setTimeout(r, 30));
    if (!releaseTaskResponse) throw new Error('Generation did not start');
    await window.webContents.executeJavaScript(`(async()=>{
      document.querySelectorAll('.board-item')[1].click();
      for(let i=0;i<100&&!document.querySelector('.board-item.active')?.textContent.includes('另一个画板');i++)await new Promise(r=>setTimeout(r,30));
      if(!document.querySelector('.board-item.active')?.textContent.includes('另一个画板')||document.querySelector('.react-flow__node')||document.querySelector('.global-app-toast'))throw new Error('Running tasks must allow switching without any interception message');
      const pane=document.querySelector('.react-flow__pane'),bounds=pane.getBoundingClientRect();
      pane.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:bounds.left+80,clientY:bounds.top+80}));
      for(let i=0;i<50&&!document.querySelector('.context-menu');i++)await new Promise(r=>setTimeout(r,30));
      document.querySelector('.context-menu .tone-comment').click();await new Promise(r=>setTimeout(r,80));
      if(!document.querySelector('.react-flow__node-comment'))throw new Error('Other board must remain editable');
    })()`);
    releaseTaskResponse();
    for(let i=0;i<100&&!releaseSecondTaskResponse;i++)await new Promise(r=>setTimeout(r,30));
    if(!releaseSecondTaskResponse)throw new Error('Batch did not continue in background');
    const partial=taskBoards.get(workspace.id);
    if(partial.nodes.filter(node=>node.type==='artifact').length!==2)throw new Error('Partial result was not persisted to the original board');
    await window.webContents.executeJavaScript(`(async()=>{
      if(document.querySelectorAll('.react-flow__node').length!==1||document.querySelector('.react-flow__node-artifact'))throw new Error('Background result contaminated the other board');
      document.querySelectorAll('.board-item')[0].click();
      for(let i=0;i<100&&(!document.querySelector('[data-id="qa-clone"]')||document.querySelectorAll('.react-flow__node-artifact').length!==2);i++)await new Promise(r=>setTimeout(r,30));
      if(document.querySelectorAll('.react-flow__node-artifact').length!==2||!document.querySelector('[data-id="qa-clone"] .batch-nine-btn')?.textContent.includes('完成 1/9'))throw new Error('Returning mid-job must restore live progress despite stale GET data');
      document.querySelectorAll('.board-item')[1].click();
      for(let i=0;i<100&&!document.querySelector('.react-flow__node-comment');i++)await new Promise(r=>setTimeout(r,30));
      if(document.querySelectorAll('.react-flow__node').length!==1)throw new Error('Other board edits were lost');
    })()`);
    releaseSecondTaskResponse();
    for(let i=0;i<200&&(taskRequests.length<9||taskBoards.get(workspace.id).nodes[0].data.isRunning);i++)await new Promise(r=>setTimeout(r,30));
    const completed=taskBoards.get(workspace.id);
    if(taskRequests.length!==9||completed.nodes.filter(node=>node.type==='artifact').length!==10||completed.nodes[0].data.isRunning||completed.edges.length!==9)throw new Error('Full batch/final running flag was not saved on original board');
    await window.webContents.executeJavaScript(`(async()=>{
      if(!localStorage.getItem('mimo_last_active_id')?.includes('qa-other-board')||document.querySelector('.react-flow__node-artifact')||document.querySelector('.global-app-toast'))throw new Error('Background save must not change the active board or show an interception message');
      document.querySelectorAll('.board-item')[0].click();
      for(let i=0;i<100&&(!document.querySelector('[data-id="qa-clone"]')||document.querySelectorAll('.react-flow__node-artifact').length!==10||document.querySelector('[data-id="qa-clone"] .run-button')?.disabled);i++)await new Promise(r=>setTimeout(r,30));
      if(document.querySelectorAll('.react-flow__node-artifact').length!==10||document.querySelector('[data-id="qa-clone"] .run-button')?.disabled)throw new Error('Completed background batch was not restored');
      const node=document.querySelector('[data-id="qa-integrated"]');
      node.querySelector('[title="清除此行参考音频"]').click();await new Promise(r=>setTimeout(r,60));
      node.querySelector('.batch-row-single-clone-btn').click();await new Promise(r=>setTimeout(r,100));
      if(!node.querySelector('.node-error')?.textContent.includes('缺少参考音频')||node.querySelector('.cell-ref audio'))throw new Error('Explicit clear must block hidden audio fallback');
    })()`);
    if (taskRequests.length !== 9) throw new Error('Cleared row unexpectedly sent a synthesis request');
    await window.webContents.executeJavaScript(`(async()=>{
      document.querySelector('.topbar-actions .role-library-button').click();
      for(let i=0;i<100&&!document.querySelector('.voice-library-list article');i++)await new Promise(r=>setTimeout(r,30));
      const card=document.querySelector('.voice-library-list article'),transfer=new DataTransfer(),node=document.querySelector('[data-id="qa-integrated"]');
      card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));await new Promise(r=>setTimeout(r,60));
      node.querySelector('.cell-ref').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));await new Promise(r=>setTimeout(r,80));
      node.querySelector('.batch-row-single-clone-btn').click();
      for(let i=0;i<100&&!node.querySelector('.batch-artifact-item-card');i++)await new Promise(r=>setTimeout(r,30));
      if(!node.querySelector('.batch-artifact-item-card'))throw new Error('New reference generation did not produce a row artifact');
    })()`);
    if (taskRequests.length !== 10 || taskRequests[9].includes('name="voiceId"') || !taskRequests[9].includes('name="synthesisMode"\r\n\r\nreference') || !taskRequests[9].includes('filename="qa.wav"')) throw new Error('New role reference must override the old Voice ID');
    await window.webContents.executeJavaScript(`(async()=>{
      document.querySelectorAll('.board-item')[1].click();
      for(let i=0;i<100&&!document.querySelector('.board-item.active')?.textContent.includes('另一个画板');i++)await new Promise(r=>setTimeout(r,30));
      if(!document.querySelector('.board-item.active')?.textContent.includes('另一个画板')||document.querySelectorAll('.react-flow__node').length!==1||!document.querySelector('.react-flow__node-comment'))throw new Error('Switching back must preserve the other board without contamination');
    })()`);
    console.log(JSON.stringify({scenario:'task-ownership-smoke',appearance,backgroundContinue:true,noInterception:true,persistedBatch:9,liveProgress:true,otherBoardEditable:true,clearBlocksFallback:true,rowAudioOverridesVoiceId:true,requests:taskRequests.length}));
    clearTimeout(fatalTimer);window.destroy();server.close();app.exit(0);return;
  }
  if(storageMigrationSmoke){
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<100&&!document.querySelector('.topbar-actions .role-library-button');i++)await new Promise(r=>setTimeout(r,50));
      document.querySelector('.topbar-actions .role-library-button').click();
      for(let i=0;i<50&&!document.querySelector('.voice-library-migration');i++)await new Promise(r=>setTimeout(r,50));
      const banner=document.querySelector('.voice-library-migration'),eta=banner.querySelector('strong');
      const bounds=banner.getBoundingClientRect(),label=eta.getBoundingClientRect();
      if(eta.textContent!=='预计 8 秒'||label.left<bounds.left+bounds.width/2||label.right>bounds.right)throw new Error('Migration ETA must fit on right of banner');
      if(document.querySelector('.voice-library-error'))throw new Error('Migration should not display stale error');
    })()`);
    fs.writeFileSync(path.resolve('reports','storage-migration-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
    previewMigrationRunning=false;
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<80&&!document.querySelector('.voice-library-location')?.textContent.includes('音色资料');i++)await new Promise(r=>setTimeout(r,50));
      if(document.querySelector('.voice-library-migration')||document.querySelector('.voice-library-error')||!document.querySelector('.voice-library-location')?.textContent.includes('D:\\\\音色资料'))throw new Error('Migration completion must refresh Unicode location and clear banner');
    })()`);
    console.log(JSON.stringify({scenario:'storage-migration-smoke',appearance,etaRight:true,refresh:true,unicode:true}));
    clearTimeout(fatalTimer);window.destroy();server.close();app.exit(0);return;
  }
  if(contextMenuSmoke){
    const sample=await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<100&&!document.querySelector('.react-flow__pane');i++)await new Promise(r=>setTimeout(r,50));
      await new Promise(r=>setTimeout(r,600));
      const pane=document.querySelector('.react-flow__pane'),rect=pane.getBoundingClientRect();
      const point={x:rect.left+20,y:rect.top+20};
      pane.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:rect.left+250,clientY:rect.top+100}));
      await new Promise(r=>setTimeout(r,80));if(!document.querySelector('.context-menu'))throw new Error('Context menu did not open');
      return {...point,transform:document.querySelector('.react-flow__viewport').style.transform};
    })()`);
    window.webContents.debugger.attach('1.3');
    const mouse=async(type,x,y,buttons,button='right')=>window.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type,x,y,button,buttons,clickCount:type==='mouseMoved'?0:1});
    await mouse('mousePressed',sample.x,sample.y,2);
    for(let i=1;i<=5;i++)await mouse('mouseMoved',sample.x+i*12,sample.y+i*5,2);
    await new Promise(r=>setTimeout(r,80));
    await window.webContents.executeJavaScript(`(()=>{if(document.querySelector('.context-menu'))throw new Error('Right drag must dismiss open node menu');if(document.querySelector('.react-flow__viewport').style.transform===${JSON.stringify(sample.transform)})throw new Error('Right drag must still pan the canvas');})()`);
    await mouse('mouseReleased',sample.x+60,sample.y+25,0);
    await new Promise(r=>setTimeout(r,80));
    await window.webContents.executeJavaScript(`(()=>{if(document.querySelector('.context-menu'))throw new Error('Drag release must not reopen node menu');})()`);
    await mouse('mousePressed',sample.x,sample.y,2);await mouse('mouseReleased',sample.x,sample.y,0);
    await new Promise(r=>setTimeout(r,80));
    await window.webContents.executeJavaScript(`(async()=>{
      const menu=document.querySelector('.context-menu');if(!menu)throw new Error('Normal right click must still open node menu');
      const count=document.querySelectorAll('.react-flow__node').length;menu.querySelector('.tone-comment').click();await new Promise(r=>setTimeout(r,120));
      if(document.querySelector('.context-menu')||document.querySelectorAll('.react-flow__node').length!==count+1)throw new Error('Node creation must remain functional');
      const pane=document.querySelector('.react-flow__pane');pane.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:800,clientY:300}));await new Promise(r=>setTimeout(r,80));
      document.querySelector('.context-menu').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:2,buttons:2,clientX:810,clientY:310}));await new Promise(r=>setTimeout(r,80));
      if(document.querySelector('.context-menu'))throw new Error('Right press on menu must dismiss it');
    })()`);
    window.webContents.debugger.detach();
    console.log(JSON.stringify({scenario:'context-menu-pan-smoke',dismissOnDrag:true,panWorks:true,noReopen:true,rightClick:true,addNode:true,menuRightPress:true}));
    clearTimeout(fatalTimer);window.destroy();server.close();app.exit(0);return;
  }
  if (desktopSmoke) {
    await window.webContents.executeJavaScript(`(async()=>{for(let i=0;i<100&&!document.querySelector('.studio-more-button');i++)await new Promise(r=>setTimeout(r,50)); await new Promise(r=>setTimeout(r,2200));})()`);
    const topbarChecks = [];
    for (const width of [1024, 1008, 800, 640]) {
      window.setContentSize(width, 720);
      await new Promise(resolve => setTimeout(resolve, 180));
      topbarChecks.push(await window.webContents.executeJavaScript(`(()=>{
        const bar=document.querySelector('.studio-topbar'), buttons=[...bar.querySelectorAll('.topbar-actions > button')];
        if(buttons.length!==6)throw new Error('All six topbar settings must remain available');
        const assertVisible=()=>{const bounds=bar.getBoundingClientRect();for(const button of buttons){const rect=button.getBoundingClientRect();if(rect.left<0||rect.right>innerWidth||rect.top<bounds.top||rect.bottom>bounds.bottom||rect.width<button.scrollWidth-1)throw new Error('Clipped topbar setting at '+innerWidth+': '+button.textContent);}if(document.body.scrollWidth>innerWidth)throw new Error('Page exceeds small window width');};
        assertVisible();
        const brand=bar.querySelector('.brand-block'), original=brand.innerHTML;
        try {brand.innerHTML='<span class="brand-kicker">A VERY LONG CUSTOM AUDIO WORKSTATION TITLE WITH EXTRA WORDS</span><h1>这是一个非常长的自定义工作站标题测试文字不会挤掉顶部设置按钮</h1>';assertVisible();}
        finally {brand.innerHTML=original;}
        return {width:innerWidth,settings:buttons.map(button=>button.textContent.trim()),height:bar.offsetHeight};
      })()`));
      if(width===1024)fs.writeFileSync(path.resolve('reports','desktop-min-window-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
    }
    console.log(JSON.stringify({type:'minimum-window-topbar-smoke',appearance,checks:topbarChecks}));
    window.setContentSize(1600, 1000);
    await new Promise(resolve => setTimeout(resolve, 180));
    await window.webContents.executeJavaScript(`(async()=>{
      document.querySelector('.status-pill').click();await new Promise(r=>setTimeout(r,100));
      window.assertSettingsPopover=(dialog,trigger)=>{const panel=dialog.getBoundingClientRect(),anchor=trigger.getBoundingClientRect();if(!dialog.classList.contains('settings-popover-panel')||Math.abs(panel.top-anchor.bottom-6)>2||panel.left<7||panel.right>innerWidth-7||panel.bottom>innerHeight-7)throw new Error('Settings panel must appear below its trigger within the window');if(getComputedStyle(dialog.parentElement).backdropFilter!=='none')throw new Error('Anchored settings must not blur the canvas');};
      window.assertSettingsPopover(document.querySelector('.api-key-modal-content'),document.querySelector('.status-pill'));
      const reference=getComputedStyle(document.querySelector('.api-endpoint-section .api-field-label'));
      const labels=document.querySelectorAll('.api-key-modal-body .api-form-fields > label');
      if(labels.length<3)throw new Error('Missing provider option labels');
      for(const label of labels){const style=getComputedStyle(label);if(style.fontSize!==reference.fontSize||style.fontWeight!==reference.fontWeight||style.fontFamily!==reference.fontFamily)throw new Error('API option typography differs from endpoint label');}
      for(const input of document.querySelectorAll('.api-key-modal-body .api-form-fields .api-key-input')){const style=getComputedStyle(input);if(style.fontSize!=='13px'||style.fontWeight!=='400')throw new Error('API input typography differs');}
      const note=getComputedStyle(document.querySelector('.api-capability-note'));
      if(note.fontSize!=='12px'||note.fontWeight!=='400'||Math.abs(parseFloat(note.lineHeight)-19.2)>.1)throw new Error('API capability note must use compact auxiliary typography');
    })()`);
    fs.writeFileSync(path.resolve('reports','desktop-api-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`(async()=>{document.querySelector('.api-key-modal-close').click();await new Promise(r=>setTimeout(r,80));})()`);
    for(const kind of ['appearance','storage']){
      if(kind==='appearance'){window.setContentSize(1008,600);await new Promise(r=>setTimeout(r,100));}
      await window.webContents.executeJavaScript(`(async()=>{const trigger=document.querySelector('[data-settings-trigger="${kind}"]');trigger.click();await new Promise(r=>setTimeout(r,120));const panel=document.querySelector('.settings-popover-panel');window.assertSettingsPopover(panel,trigger);})()`);
      if(kind==='appearance')await window.webContents.executeJavaScript(`(async()=>{
        const group=document.querySelector('.appearance-workstation-settings'),summary=group.querySelector('summary'),input=group.querySelector('input');
        if(group.open||input.getBoundingClientRect().height)throw new Error('Workstation settings must default to collapsed');
        const value=input.value;summary.click();await new Promise(r=>setTimeout(r,80));
        if(!group.open||!input.getBoundingClientRect().height||!group.querySelector('[role="switch"]'))throw new Error('Workstation settings must expand with title fields and auto-hide');
        const mode=document.querySelector('.appearance-modal-content > .appearance-card'),main=mode.querySelector('.appearance-card-main'),bounds=mode.getBoundingClientRect();
        if(main.getBoundingClientRect().bottom>bounds.bottom+1||mode.offsetHeight<60)throw new Error('Expanded workstation settings must not compress appearance mode card');
        const content=document.querySelector('.appearance-modal-content');
        if(content.scrollHeight<=content.clientHeight)throw new Error('Short appearance panel must scroll rather than shrink cards');
        summary.click();await new Promise(r=>setTimeout(r,80));
        if(group.open||input.value!==value)throw new Error('Collapse must preserve title settings');
      })()`);
      fs.writeFileSync(path.resolve('reports','desktop-'+kind+'-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
      await window.webContents.executeJavaScript(`(async()=>{document.querySelector('.settings-popover-panel .settings-close-button').click();await new Promise(r=>setTimeout(r,80));})()`);
      if(kind==='appearance'){window.setContentSize(1600,1000);await new Promise(r=>setTimeout(r,100));}
    }
    window.webContents.send("desktop-menu-event", "about");
    const result = await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<50&&!document.querySelector('.studio-about-dialog');i++)await new Promise(r=>setTimeout(r,50));
      const dialog=document.querySelector('.studio-about-dialog'); if(!dialog)throw new Error('About did not open through IPC');
      window.assertSettingsClose=(dialog)=>{const close=dialog.querySelector('.settings-close-button');if(!close)throw new Error('Missing shared close button');const style=getComputedStyle(close);if(style.width!=='32px'||style.height!=='32px'||style.borderRadius!=='9px'||style.boxShadow==='none'||getComputedStyle(close.querySelector('svg')).width!=='18px')throw new Error('Close button style differs');};
      window.assertSettingsClose(dialog);
      window.assertSettingsPopover(dialog,document.querySelector('.studio-more-button'));
      if(document.documentElement.dataset.theme!==${JSON.stringify(appearance)})throw new Error('Incorrect preview theme');
      const info=await window.electronApi.getAppInfo();const update=await window.electronApi.checkForUpdates();
      const topbar=document.querySelector('.studio-topbar');const height=parseFloat(getComputedStyle(topbar).height);
      if(height>48)throw new Error('Topbar too tall: '+height);
      if(!document.querySelector('.studio-update-dot'))throw new Error('Missing update dot');
      if(!dialog.textContent.includes('v'+info.version)||update.status!=='available')throw new Error('Incorrect version/update');
      const updateButton=dialog.querySelector('.studio-about-actions button'),link=dialog.querySelector('.studio-repository-link');
      if(getComputedStyle(updateButton).fontSize!=='12px'||getComputedStyle(link).fontSize!=='12px')throw new Error('Inconsistent About button type');
      for(const button of [updateButton,link,document.querySelector('.studio-more-button'),document.querySelector('.run-button')].filter(Boolean)) {
        const style=getComputedStyle(button);
        if(style.transitionDuration!=='0.06s'||style.transitionDelay!=='0s')throw new Error('Slow button feedback: '+button.className+' '+style.transitionDuration);
      }
      return {scenario:'desktop-controls-smoke',version:info.version,updateStatus:update.status,topbarHeight:height,buttonFont:getComputedStyle(document.querySelector('.studio-more-button')).fontSize,dialogText:dialog.textContent};
    })()`);
    const output=path.resolve('reports', 'desktop-about-'+appearance+'.png'); fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,(await window.webContents.capturePage()).toPNG());
    const menuResult=await window.webContents.executeJavaScript(`(async()=>{
      document.querySelector('[aria-label="关闭关于"]').click();
      window.dispatchEvent(new MouseEvent('mousemove',{clientY:1}));await new Promise(r=>setTimeout(r,350));
      document.querySelector('.studio-more-button').click();await new Promise(r=>setTimeout(r,50));
      document.querySelector('.studio-compact-root button').click();await new Promise(r=>setTimeout(r,50));
      const button=document.querySelector('.studio-compact-submenu button');if(!button)throw new Error('Compact submenu missing');
      const style=getComputedStyle(button);if(style.fontSize!=='12px'||button.getBoundingClientRect().height>30)throw new Error('Submenu not compact');
      if(style.transitionDuration!=='0.06s'||style.transitionDelay!=='0s')throw new Error('Slow menu feedback');
      return {menuFont:style.fontSize,menuRowHeight:button.getBoundingClientRect().height};
    })()`);
    const menuOutput=path.resolve('reports','desktop-more-'+appearance+'.png');
    fs.writeFileSync(menuOutput,(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`(async()=>{
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      document.querySelector('[title="设置音频播放起点"]').click();await new Promise(r=>setTimeout(r,50));
      const options=document.querySelectorAll('.studio-playback-options button');
      if(options.length!==2||options[0].getAttribute('aria-pressed')!=='true'||options[1].getAttribute('aria-pressed')!=='false')throw new Error('Incorrect default playback setting');
      window.assertSettingsClose(document.querySelector('.studio-playback-dialog'));
      window.assertSettingsPopover(document.querySelector('.studio-playback-dialog'),document.querySelector('[title="设置音频播放起点"]'));
      options[1].click();await new Promise(r=>setTimeout(r,50));
      if(options[1].getAttribute('aria-pressed')!=='true'||options[0].getAttribute('aria-pressed')!=='false'||localStorage.getItem('mimo_playback_restart_from_beginning')!=='true')throw new Error('Playback setting was not saved');
      options[0].click();await new Promise(r=>setTimeout(r,50));
      if(options[0].getAttribute('aria-pressed')!=='true'||localStorage.getItem('mimo_playback_restart_from_beginning')!=='false')throw new Error('Resume playback setting was not saved');
    })()`);
    const playbackOutput=path.resolve('reports','desktop-playback-'+appearance+'.png');
    fs.writeFileSync(playbackOutput,(await window.webContents.capturePage()).toPNG());
    if (productionSmoke) {
      fs.writeFileSync(path.resolve('reports','role-toolbar-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
      await window.webContents.executeJavaScript(`(()=>{const row=document.querySelector('.reference-tools-row'),button=row.querySelector('.role-library-button');if(getComputedStyle(row).justifyContent!=='flex-end'||Math.abs(row.getBoundingClientRect().right-button.getBoundingClientRect().right)>1)throw new Error('Reference role library must align to right edge');})()`);
      await window.webContents.executeJavaScript(`(async()=>{
        document.querySelector('[aria-label="关闭播放设置"]').click();
        if(!document.querySelector('.node-clone .batch-nine-btn')?.textContent.includes('完成 8/20')||document.querySelector('.generation-progress'))throw new Error('Count must be inside generation button');
        if(Array.from(document.querySelectorAll('.topbar-actions button')).some(button=>button.textContent.includes('产物筛选')||button.textContent.includes('A/B')))throw new Error('Removed tools still visible');
        const toolbar=document.querySelector('.node-clone .clone-toolbar');
        if(!toolbar?.querySelector('select')||toolbar.lastElementChild?.textContent!=='角色音色库')throw new Error('Preset/library toolbar incorrect');
        const preset=toolbar.querySelector('select').getBoundingClientRect(),library=toolbar.querySelector('.role-library-button').getBoundingClientRect();
        if(Math.abs((preset.top+preset.height/2)-(library.top+library.height/2))>2)throw new Error('Preset and library must share a row');
        for(const toolbar of document.querySelectorAll('.node-clone .clone-toolbar,.node-design .design-toolbar')){
          const sizes=Array.from(toolbar.querySelectorAll('button,select')).map(element=>element.getBoundingClientRect().height);
          if(Math.max(...sizes)-Math.min(...sizes)>0.5)throw new Error('Toolbar controls have unequal heights');
          if(toolbar.querySelector('select').selectedOptions[0].textContent.match(/[.…]/))throw new Error('Preset label retains ellipsis');
          const select=toolbar.querySelector('select'),style=getComputedStyle(select),context=document.createElement('canvas').getContext('2d');
          context.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
          // Chromium's native dropdown arrow also consumes about 18px of inline space.
          if(context.measureText(select.selectedOptions[0].textContent).width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+18>select.clientWidth)throw new Error('Preset default label has insufficient space');
        }
        const modes=document.querySelector('.game-vocal-mode-tabs');
        if(modes){const heights=Array.from(modes.querySelectorAll('button')).map(element=>element.getBoundingClientRect().height);if(Math.max(...heights)-Math.min(...heights)>0.5)throw new Error('Game mode/library heights differ');}
        for(const button of document.querySelectorAll('.integrated-col-tools button')){
          if(getComputedStyle(button).whiteSpace!=='nowrap'||button.scrollWidth>button.clientWidth+1)throw new Error('Integrated tool text is clipped');
        }
        const refHeader=document.querySelector('.integrated-header-cell.col-1'),cloneHeader=document.querySelector('.integrated-header-cell.col-2');
        const refTitle=refHeader.querySelector(':scope > span').getBoundingClientRect(),cloneTitle=cloneHeader.querySelector(':scope > span').getBoundingClientRect();
        const upload=refHeader.querySelector('button').getBoundingClientRect(),cloneTool=cloneHeader.querySelector('button').getBoundingClientRect();
        if(Math.abs(refTitle.top-cloneTitle.top)>1||Math.abs(upload.top-cloneTool.top)>1||Math.abs(upload.height-cloneTool.height)>1||upload.top<refTitle.bottom)throw new Error('Reference and clone headers must use matching two-row layouts');
        const reference=document.querySelector('.node-audio');
        if(reference.querySelector('.role-library-button').getBoundingClientRect().top>=reference.querySelector('.file-picker').getBoundingClientRect().top)throw new Error('Reference library must be above upload');
        if(!document.querySelector('.node-artifact .artifact-actions .favorite-icon-button')||!document.querySelector('.node-batch-artifact .batch-artifact-item-actions .favorite-icon-button'))throw new Error('Favorites must be inline actions');
        if(document.querySelector('.favorite-icon-button')?.textContent.trim())throw new Error('Favorite must be icon only');
        const singleActions=Array.from(document.querySelector('.node-artifact .artifact-actions').children).map(element=>element.getBoundingClientRect());
        if(Math.max(...singleActions.map(rect=>rect.top+rect.height/2))-Math.min(...singleActions.map(rect=>rect.top+rect.height/2))>2)throw new Error('Single artifact actions wrapped');
        for(const control of document.querySelectorAll('.studio-node button,.studio-node a.download-link,.studio-node a.batch-artifact-item-btn')){
          const auxiliary=control.matches('.role-library-button,.batch-excel-paste-btn,.batch-clear-btn,.batch-col-clear-btn,.batch-row-remove-btn,.design-action-btn,.integrated-mini-tool,.game-vocal-mode-tab,.game-vocal-cat-btn,.game-vocal-sub-btn,.game-vocal-quick-btn,.game-vocal-duration-pill,.game-vocal-char-type-btn,.game-vocal-tag-chip,.game-vocal-item-chip,.game-vocal-pill-remove-btn');
          if((getComputedStyle(control).boxShadow==='none')!==auxiliary)throw new Error('Incorrect primary/auxiliary shadow: '+control.className);
        }
      })()`);
      fs.writeFileSync(path.resolve('reports','role-toolbar-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
      await window.webContents.executeJavaScript(`(async()=>{
        document.querySelector('.node-clone .role-library-button').click();await new Promise(r=>setTimeout(r,160));
        const currentEditor=document.querySelector('.voice-library-editor-toggle');
        if(currentEditor.textContent!=='保存当前角色'||currentEditor.getAttribute('aria-expanded')!=='false'||!document.querySelector('.voice-library-form').hidden)throw new Error('Save current role must start collapsed');
        if(!document.querySelector('.voice-library-drag-hint')?.textContent.includes('拖住含音频的角色卡片'))throw new Error('Missing visible role drag hint');
        currentEditor.click();await new Promise(r=>setTimeout(r,80));
        if(document.querySelector('.voice-library-form').hidden)throw new Error('Current role editor must still expand');
        document.querySelector('.voice-library-dialog .settings-close-button').click();await new Promise(r=>setTimeout(r,80));
        Array.from(document.querySelectorAll('.topbar-actions button')).find(button=>button.textContent==='角色音色库').click();await new Promise(r=>setTimeout(r,200));
        for(let attempt=0;attempt<50&&!document.querySelector('.voice-library-list')?.textContent.includes('测试角色音色');attempt++)await new Promise(r=>setTimeout(r,50));
        if(!document.querySelector('.voice-library-list')?.textContent.includes('测试角色音色'))throw new Error('Role library did not load');
        window.assertSettingsClose(document.querySelector('.voice-library-dialog'));
        window.assertSettingsPopover(document.querySelector('.voice-library-dialog'),document.querySelector('.topbar-actions .role-library-button'));
        const editor=document.querySelector('.voice-library-editor-toggle'),form=document.querySelector('.voice-library-form');
        if(editor.getAttribute('aria-expanded')!=='false'||getComputedStyle(form).display!=='none')throw new Error('Topbar library editor must start collapsed');
        if(getComputedStyle(editor).borderRadius!=='11px'||getComputedStyle(editor.parentElement).borderRadius!=='12px')throw new Error('Editor inner and outer corners must match');
        editor.click();await new Promise(r=>setTimeout(r,80));
        if(editor.getAttribute('aria-expanded')!=='true'||getComputedStyle(form).display==='none'||editor.getAttribute('aria-controls')!==form.id)throw new Error('Role editor did not expand');
        const picker=document.querySelector('.voice-library-native-file');
        if(getComputedStyle(picker).display!=='none'||!document.querySelector('.voice-library-upload-row button'))throw new Error('Native upload must have a styled trigger');
        const filter=document.querySelector('.voice-library-favorite-filter');
        if(!filter||filter.getAttribute('aria-pressed')!=='false'||document.querySelector('.voice-library-dialog input[type="checkbox"]'))throw new Error('Favorite filter must use a compact toggle');
        filter.click();await new Promise(r=>setTimeout(r,80));
        if(filter.getAttribute('aria-pressed')!=='true')throw new Error('Favorite toggle did not activate');
        filter.click();await new Promise(r=>setTimeout(r,80));
        const search=document.querySelector('.voice-library-search').getBoundingClientRect(),toggle=filter.getBoundingClientRect();
        if(Math.abs(search.top+search.height/2-toggle.top-toggle.height/2)>2)throw new Error('Search and favorite toggle must share a row');
        editor.click();await new Promise(r=>setTimeout(r,80));
        if(!form.hidden||getComputedStyle(form).display!=='none'||!document.querySelector('.voice-library-list article'))throw new Error('Collapsing editor must preserve the role list');
        const card=document.querySelector('.voice-library-list article'),description=card.querySelector('.voice-library-asset-details'),descriptionToggle=card.querySelector('.voice-library-description-toggle');
        if(!description.hidden||descriptionToggle.getAttribute('aria-expanded')!=='false'||card.offsetHeight>110)throw new Error('Role card must use a compact collapsed layout');
        descriptionToggle.click();await new Promise(r=>setTimeout(r,80));
        if(description.hidden||descriptionToggle.getAttribute('aria-expanded')!=='true'||!description.textContent.includes('Deep and calm'))throw new Error('Role description did not expand');
        descriptionToggle.click();await new Promise(r=>setTimeout(r,80));
        if(!description.hidden)throw new Error('Role description did not collapse');
      })()`);
      fs.writeFileSync(path.resolve('reports','production-role-library-'+appearance+'.png'),(await window.webContents.capturePage()).toPNG());
      // Force real CSS pseudo states without triggering user actions or vendor calls.
      window.webContents.debugger.attach('1.3');
      await window.webContents.debugger.sendCommand('DOM.enable');
      await window.webContents.debugger.sendCommand('CSS.enable');
      const {root:domRoot}=await window.webContents.debugger.sendCommand('DOM.getDocument');
      for(const selector of ['.node-clone .role-library-button','.node-clone select','.node-artifact a.download-link','.topbar-actions button','.voice-library-dialog .settings-close-button',...(themeGame?['.game-vocal-cat-btn']:[])]){
        const {nodeId}=await window.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:domRoot.nodeId,selector});
        if(!nodeId)throw new Error('Missing interaction sample: '+selector);
        for(const state of ['hover','active','focus-visible']){
          await window.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[state]});
          await new Promise(resolve=>setTimeout(resolve,100));
          const style=await window.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)}));return {filter:s.filter,transform:s.transform,duration:s.transitionDuration,outline:s.outlineStyle};})()`);
          if(state==='focus-visible' ? style.outline!=='solid' : style.filter==='none'||style.transform==='none'||style.duration!==(state==='active'?'0.04s':'0.06s'))throw new Error('Inconsistent '+state+' feedback: '+selector+' '+JSON.stringify(style));
        }
        await window.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
      }
      for(const selector of ['.node-artifact .player-button','.node-artifact .player-speed-btn']){
        const {nodeId}=await window.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:domRoot.nodeId,selector});
        if(!nodeId)throw new Error('Missing player circle: '+selector);
        for(const state of ['hover','active']){
          await window.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[state]});
          await new Promise(resolve=>setTimeout(resolve,170));
          const result=await window.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)})),m=new DOMMatrix(s.transform);return {scale:m.a,x:m.e,y:m.f,duration:s.transitionDuration};})()`);
          if(Math.abs(result.scale-(state==='hover'?1.0667:1.1))>.005||result.x!==0||result.y!==0||result.duration!=='0.12s')throw new Error('Incorrect player enlargement: '+JSON.stringify(result));
        }
        await window.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
      }
      for(const selector of ['.batch-col-clear-btn','.batch-clear-btn','.batch-row-remove-btn','.integrated-mini-tool.danger','.voice-library-editor-toggle',...(themeGame?['.game-vocal-clear-btn']:[])]){
        const {nodeId}=await window.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:domRoot.nodeId,selector});
        if(!nodeId)throw new Error('Missing clear button: '+selector);
        for(const state of ['hover','active']){
          await window.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[state]});
          await new Promise(resolve=>setTimeout(resolve,100));
          const style=await window.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)}));return {shadow:s.boxShadow,transform:s.transform,font:s.fontSize};})()`);
          if(style.shadow!=='none'||style.transform!=='none'||(selector!=='.batch-row-remove-btn'&&style.font!==(selector==='.batch-col-clear-btn'?'11px':'12px')))throw new Error('Auxiliary button must stay flat: '+selector+' '+JSON.stringify(style));
        }
        await window.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
      }
      window.webContents.debugger.detach();
      const edgeSample=await window.webContents.executeJavaScript(`(async()=>{
        const paths=[...document.querySelectorAll('.edge-hover-path')],before=paths.map(path=>path.getAttribute('d'));
        for(let i=0;i<5;i++){await new Promise(r=>setTimeout(r,100));if(paths.some((path,index)=>path.getAttribute('d')!==before[index]))throw new Error('Idle edge geometry must remain stable');}
        const path=paths.find(path=>{const point=path.getPointAtLength(path.getTotalLength()/2).matrixTransform(path.getScreenCTM());return point.x>20&&point.x<innerWidth-20&&point.y>60&&point.y<innerHeight-20;});
        if(!path)throw new Error('Missing visible edge test fixture');
        const point=path.getPointAtLength(path.getTotalLength()/2).matrixTransform(path.getScreenCTM());
        path.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:point.x,clientY:point.y}));await new Promise(r=>setTimeout(r,60));
        const button=document.querySelector('.edge-delete'),initial=button.getBoundingClientRect();
        const movedPoint=path.getPointAtLength(path.getTotalLength()*0.7).matrixTransform(path.getScreenCTM());
        path.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:movedPoint.x,clientY:movedPoint.y}));await new Promise(r=>setTimeout(r,80));
        const followed=button.getBoundingClientRect();
        if(Math.hypot(followed.x-initial.x,followed.y-initial.y)<3)throw new Error('Disconnect button must follow mouse movement along the edge');
        const bounds=button.getBoundingClientRect();
        return {x:bounds.x,y:bounds.y,edgeId:path.closest('.react-flow__edge').getAttribute('data-id'),count:paths.length};
      })()`);
      window.webContents.debugger.attach('1.3');
      await window.webContents.debugger.sendCommand('DOM.enable');await window.webContents.debugger.sendCommand('CSS.enable');
      const {root:edgeRoot}=await window.webContents.debugger.sendCommand('DOM.getDocument');
      const {nodeId:edgeButton}=await window.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:edgeRoot.nodeId,selector:'.edge-delete'});
      for(const state of ['hover','active']){
        await window.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId:edgeButton,forcedPseudoClasses:[state]});
        await new Promise(r=>setTimeout(r,90));
        const bounds=await window.webContents.executeJavaScript(`(()=>{const r=document.querySelector('.edge-delete').getBoundingClientRect();return {x:r.x,y:r.y};})()`);
        if(Math.abs(bounds.x-edgeSample.x)>1||Math.abs(bounds.y-edgeSample.y)>1)throw new Error('Disconnect button jumped on '+state);
      }
      await window.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId:edgeButton,forcedPseudoClasses:[]});
      await window.webContents.executeJavaScript(`document.querySelector('.edge-delete').click()`);
      await new Promise(r=>setTimeout(r,120));
      const remaining=await window.webContents.executeJavaScript(`(()=>({count:document.querySelectorAll('.edge-hover-path').length,deleted:!Array.from(document.querySelectorAll('.react-flow__edge')).some(edge=>edge.getAttribute('data-id')===${JSON.stringify(edgeSample.edgeId)})}))()`);
      if(remaining.count!==edgeSample.count-1||!remaining.deleted)throw new Error('Disconnect button must remove only its edge');
      window.webContents.debugger.detach();
      console.log(JSON.stringify({scenario:'edge-disconnect-smoke',appearance,stableGeometry:true,stationaryButton:true,deleted:true}));
      console.log(JSON.stringify(await window.webContents.executeJavaScript(`(async()=>{
        const node=document.querySelector('[data-id="qa-integrated"]');
        node.querySelector('[title="加一行"]').click();await new Promise(r=>setTimeout(r,100));
        node.querySelector('[title="加一行"]').click();await new Promise(r=>setTimeout(r,100));
        const card=document.querySelector('.voice-library-list article'),transfer=new DataTransfer();
        if(!card.draggable)throw new Error('Audio role card must be draggable');
        card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));await new Promise(r=>setTimeout(r,80));
        if(getComputedStyle(document.querySelector('.voice-library-dragging')).pointerEvents!=='none')throw new Error('Library overlay blocks drop targets');
        card.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));await new Promise(r=>setTimeout(r,80));
        if(!document.querySelector('.voice-library-dialog')||document.querySelector('.voice-library-dragging'))throw new Error('Cancelled drag must keep library open and restore overlay');
        const cells=[...node.querySelectorAll('.cell-ref')],before=[...node.querySelectorAll('.cell-clone textarea,.cell-clone input')].map(el=>el.value);
        const copy=new DataTransfer();card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:copy}));await new Promise(r=>setTimeout(r,80));
        const expected=JSON.parse(copy.getData('application/x-mimo-role-audio'));
        cells[0].dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:copy}));await new Promise(r=>setTimeout(r,80));
        if(!cells[0].classList.contains('dragging-over'))throw new Error('Missing row drop highlight');
        cells[0].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:copy}));await new Promise(r=>setTimeout(r,100));
        if(!cells[0].textContent.includes(expected.fileName)||!cells[0].querySelector('audio')?.src.startsWith(expected.dataUrl))throw new Error('Role audio was not applied to target row');
        if(cells[1].querySelector('audio')||JSON.stringify(before)!==JSON.stringify([...node.querySelectorAll('.cell-clone textarea,.cell-clone input')].map(el=>el.value)))throw new Error('Drop changed another row or text');
        card.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:copy}));await new Promise(r=>setTimeout(r,80));
        if(document.querySelector('.voice-library-dialog'))throw new Error('Successful drag must close library');
        const reference=document.querySelector('[data-id="qa-reference"]');
        for(let count=1;count<=2;count++){
          document.querySelector('.topbar-actions .role-library-button').click();
          for(let attempt=0;attempt<50&&!document.querySelector('.voice-library-list article');attempt++)await new Promise(r=>setTimeout(r,50));
          const source=document.querySelector('.voice-library-list article'),drag=new DataTransfer();
          source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:drag}));await new Promise(r=>setTimeout(r,80));
          const target=reference.querySelector('.file-picker');
          target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:drag}));await new Promise(r=>setTimeout(r,60));
          if(!target.classList.contains('dragging-over'))throw new Error('Reference drop highlight missing');
          target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:drag}));await new Promise(r=>setTimeout(r,120));
          if(reference.querySelectorAll('.reference-audio-card').length!==count||!reference.textContent.includes('qa.wav'))throw new Error('Reference node must append role audio without losing existing references');
          if(document.querySelector('.voice-library-dialog'))throw new Error('Reference drop must close library');
        }
        reference.querySelector('[title="移除此参考音频"]').click();await new Promise(r=>setTimeout(r,80));
        if(reference.querySelectorAll('.reference-audio-card').length!==1)throw new Error('Removing reference audio failed');
        return {scenario:'role-audio-drag-smoke',targetRowOnly:true,cancel:true,overlayPassThrough:true,referenceAppend:true,referenceRemove:true};
      })()`)));
      console.log(JSON.stringify({scenario:'interaction-feedback-smoke',appearance,hover:true,active:true,focus:true}));
      console.log(JSON.stringify({scenario:'production-tools-smoke',appearance,counts:true,removedTools:true,compactToolbar:true,roleLibrary:true}));
    }
    console.log(JSON.stringify({...result,...menuResult, nativeMenuVisible:window.isMenuBarVisible(), screenshot:output,menuScreenshot:menuOutput}));
    clearTimeout(fatalTimer);window.destroy();server.close();app.exit(0);return;
  }
  const result = await window.webContents.executeJavaScript(`(async () => {
    for (let i=0; i<100 && !document.querySelector('.react-flow__node'); i++) await new Promise(r=>setTimeout(r,100));
    await new Promise(r=>setTimeout(r,2000));
    const pane=document.querySelector('.react-flow__pane');
    const viewport=document.querySelector('.react-flow__viewport');
    if (!pane || !viewport) throw new Error('Canvas failed to mount');
    if (${overlapSmoke}) {
      const read=()=>[...document.querySelectorAll('.minimap-overlap-badge text')].map(el=>el.textContent);
      const triple=read();
      if(JSON.stringify(triple)!=='["3"]')throw new Error('Missing triple overlap: '+JSON.stringify(triple));
      const badge=document.querySelector('.minimap-overlap-badge');
      const badgeBounds=badge.getBoundingClientRect();
      if(badgeBounds.width<10 || badgeBounds.width>24)throw new Error('Badge is not a compact readable screen size: '+badgeBounds.width);
      document.querySelector('[data-id="node-2"] button[title="删除节点"]').click();
      await new Promise(r=>setTimeout(r,350));
      const pair=read();if(JSON.stringify(pair)!=='["2"]')throw new Error('Missing pair overlap: '+JSON.stringify(pair));
      document.querySelector('[data-id="node-1"] button[title="删除节点"]').click();
      await new Promise(r=>setTimeout(r,350));
      const single=read();if(single.length)throw new Error('Badge remained after overlap removed');
      return {scenario:'overlap-smoke',triple,pair,single,badgeScreenWidth:badgeBounds.width,mainCanvasHasNoBadges:!document.querySelector('.react-flow__viewport .minimap-overlap-badge')};
    }
    if (${actionAudit}) {
      // Audit settled palette colors; animation feedback is covered separately.
      const settledStyle=document.createElement('style');settledStyle.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.append(settledStyle);
      const types=[...document.querySelectorAll('.react-flow__node')].map(el=>el.dataset.id);
      if(types.length!==13)throw new Error('Expected all 13 node types');
      document.querySelector('button[title="调整外观色彩与主题"]').click();
      await new Promise(r=>setTimeout(r,250));
      const select=document.querySelector('#node-palette-select');
      const palettes=[...select.options].map(option=>option.value);
      const selector='.studio-node .run-button,.studio-node .game-vocal-run-btn,.studio-node .record-button,.studio-node a.download-link,.studio-node .player-button,.studio-node .batch-download-all-btn,.new-board';
      let checked=0,contrastChecks=0,nodeAccentChecks=0,typographyChecks=0,selectionMenuChecks=0;const failures=[];const coverage=new Set();
      const clearColors={};
      const luminance=color=>{
        const channels=color.match(/[0-9.]+/g)?.slice(0,3).map(Number);
        if(!channels || channels.length!==3)throw new Error('Unexpected fill '+color);
        return channels.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
      };
      for(const mode of ['light','dark']){
        document.querySelector('button[title="'+(mode==='light'?'浅色模式':'深色模式')+'"]').click();
        await new Promise(r=>setTimeout(r,500));
        for(const palette of palettes){
          select.value=palette;select.dispatchEvent(new Event('change',{bubbles:true}));
          await new Promise(r=>setTimeout(r,100));
          const referenceFont=getComputedStyle(document.querySelector('.node-design .run-button')).fontFamily;
          for(const title of document.querySelectorAll('.studio-node .node-title-wrap')){
            const css=getComputedStyle(title),input=title.querySelector('.node-title-input');
            if(css.columnGap!=='12px' || css.paddingLeft!=='12px' || (input && getComputedStyle(input).paddingLeft!=='4px'))
              failures.push({mode,palette,titleSpacing:[css.columnGap,css.paddingLeft,input && getComputedStyle(input).paddingLeft]});
          }
          for(const control of document.querySelectorAll('.studio-node button,.studio-node a.download-link')){
            const css=getComputedStyle(control);typographyChecks++;
            const flat=control.matches('.batch-clear-btn,.batch-col-clear-btn,.game-vocal-clear-btn,.integrated-mini-tool.danger');
            const expectedSize=control.matches('.batch-col-clear-btn')?'11px':'12px';
            if(css.fontFamily!==referenceFont || css.fontSize!==expectedSize || css.fontWeight!==(flat?'600':'700') || css.letterSpacing!=='normal')
              failures.push({mode,palette,control:control.className,font:[css.fontFamily,css.fontSize,css.fontWeight,css.letterSpacing]});
          }
          // Resolve palette variables through a probe so computed rgb values can be compared.
          const probe=document.createElement('i');
          const nodeWrappers=[...document.querySelectorAll('.react-flow__node')];
          const wasSelected=nodeWrappers.map(node=>node.classList.contains('selected'));
          nodeWrappers.forEach(node=>node.classList.add('selected'));
          pane.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:500,clientY:400}));
          await new Promise(r=>setTimeout(r,250));
          const menuItems=[...document.querySelectorAll('.context-menu-node-grid .context-menu-item')];
          if(menuItems.length!==11)throw new Error('Expected 11 palette-aware node menu entries');
          for(const wrapper of nodeWrappers){
            const node=wrapper.querySelector('.studio-node,.comment-node');
            node.append(probe);probe.style.color=node.matches('.comment-node')?'var(--tone-comment)':'var(--node-accent)';
            const accent=getComputedStyle(probe).color;
            selectionMenuChecks++;
            const shadowRgb=getComputedStyle(node).boxShadow.match(/[0-9.]+/g)?.slice(0,3).map(Number);
            const accentRgb=accent.match(/[0-9.]+/g)?.slice(0,3).map(Number);
            if(getComputedStyle(node).borderColor!==accent || JSON.stringify(shadowRgb)!==JSON.stringify(accentRgb))
              failures.push({mode,palette,selection:wrapper.dataset.id,border:getComputedStyle(node).borderColor,shadow:getComputedStyle(node).boxShadow,expected:accent});
          }
          for(const item of menuItems){
            const type=[...item.classList].find(value=>value.startsWith('tone-')).slice(5);
            const wrapper=document.querySelector('.react-flow__node-'+type);
            const node=wrapper.querySelector('.studio-node,.comment-node');
            node.append(probe);probe.style.color=node.matches('.comment-node')?'var(--tone-comment)':'var(--node-accent)';
            const accent=getComputedStyle(probe).color;
            selectionMenuChecks+=2;
            if(getComputedStyle(item.querySelector('span')).color!==accent || getComputedStyle(item,'::before').backgroundColor!==accent)
              failures.push({mode,palette,menu:type,color:getComputedStyle(item.querySelector('span')).color,dot:getComputedStyle(item,'::before').backgroundColor,expected:accent});
          }
          probe.remove();nodeWrappers.forEach((node,index)=>node.classList.toggle('selected',wasSelected[index]));
          for(const node of document.querySelectorAll('.studio-node')){
            node.append(probe);probe.style.color='var(--node-accent)';
            const accent=getComputedStyle(probe).color;
            const filled='.run-button,.game-vocal-run-btn,.record-button,.download-link,.download-btn,.product-download-button,.player-button,.batch-download-all-btn';
            for(const label of node.querySelectorAll('.node-type-label')){
              nodeAccentChecks++;
              if(getComputedStyle(label).color!==accent)failures.push({mode,palette,typeLabel:label.textContent,color:getComputedStyle(label).color,expected:accent});
            }
            for(const icon of node.querySelectorAll('svg')){
              if(icon.closest(filled) || icon.closest('.batch-clear-btn,.batch-col-clear-btn,.game-vocal-clear-btn'))continue;
              nodeAccentChecks++;
              if(getComputedStyle(icon).color!==accent)failures.push({mode,palette,icon:icon.parentElement.className,color:getComputedStyle(icon).color,expected:accent});
            }
          }
          probe.remove();
          for(const clear of document.querySelectorAll('.batch-col-clear-btn,.batch-clear-btn')){
            const css=getComputedStyle(clear),colors=[css.color,css.backgroundColor,css.borderColor];
            nodeAccentChecks++;
            if(!clearColors[mode])clearColors[mode]=JSON.stringify(colors);
            if(JSON.stringify(colors)!==clearColors[mode])failures.push({mode,palette,clear:clear.className,colors});
          }
          const game=document.querySelector('.node-game-vocal');
          game.append(probe);probe.style.color='var(--node-accent)';
          const gameBadge=game.querySelector('.game-vocal-precision-badge');
          nodeAccentChecks+=2;
          if(getComputedStyle(gameBadge).color!==getComputedStyle(probe).color)
            failures.push({mode,palette,precisionBadge:getComputedStyle(gameBadge).color,expected:getComputedStyle(probe).color});
          if(getComputedStyle(game.querySelector('.game-vocal-run-btn')).boxShadow==='none')
            failures.push({mode,palette,gameShadow:getComputedStyle(game.querySelector('.game-vocal-run-btn')).boxShadow});
          probe.remove();
          const chip=game.querySelector('.game-vocal-item-chip');
          const originalChip=chip.className;chip.classList.add('is-selected');
          game.append(probe);probe.style.color='var(--node-accent)';
          nodeAccentChecks++;
          if(getComputedStyle(chip).borderColor!==getComputedStyle(probe).color)failures.push({mode,palette,chipBorder:getComputedStyle(chip).borderColor,expected:getComputedStyle(probe).color});
          probe.remove();chip.className=originalChip;
          const expected=mode==='light'?'rgb(255, 255, 255)':'rgb(0, 0, 0)';
          const baseButtons=[...document.querySelectorAll(selector)];
          if(baseButtons.length<15)throw new Error('Missing action fixtures');
          for(const state of ['idle','running']){
            const buttons=state==='idle'?baseButtons:[...baseButtons,...document.querySelectorAll('.batch-row-single-clone-btn')];
            const original=buttons.map(button=>button.className);
            if(state==='running')buttons.filter(button=>button.matches('.run-button,.game-vocal-run-btn,.batch-row-single-clone-btn')).forEach(button=>button.classList.add('is-running','is-generating'));
            await new Promise(r=>setTimeout(r,120));
            for(const button of buttons){
              coverage.add(button.closest('.studio-node')?.className || 'global');
              const fill=getComputedStyle(button).backgroundColor;
              const lum=luminance(fill),contrast=mode==='light'?1.05/(lum+0.05):(lum+0.05)/0.05;
              contrastChecks++;
              if(contrast<4.5)failures.push({mode,palette,state,button:button.className,fill,contrast});
              for(const el of [button,...button.querySelectorAll('span,svg')]){
                checked++;const color=getComputedStyle(el).color;
                if(color!==expected)failures.push({mode,palette,state,button:button.className,element:el.tagName,color,expected});
                if(button.closest('.studio-node') && el.tagName!=='svg'){
                  const css=getComputedStyle(el);typographyChecks++;
                  if(css.fontSize!=='12px' || css.fontWeight!=='700' || css.fontFamily!==referenceFont)
                    failures.push({mode,palette,state,button:button.className,font:[css.fontSize,css.fontWeight,css.fontFamily]});
                }
              }
            }
            buttons.forEach((button,index)=>button.className=original[index]);
          }
        }
      }
      if(failures.length)throw new Error('Action ink failures: '+JSON.stringify({total:failures.length,kinds:[...new Set(failures.map(f=>Object.keys(f).join(',')))],palettes:[...new Set(failures.map(f=>f.mode+'/'+f.palette))],samples:failures.slice(0,15)}));
      return {scenario:'action-audit',paletteCount:palettes.length,modes:2,nodeTypes:types.length,checks:checked,contrastChecks,nodeAccentChecks,typographyChecks,selectionMenuChecks,coverage:[...coverage],failures:failures.length};
    }
    if (${themePreview}) {
      const themeProperties=['--bg-main','--bg-node','--bg-input','--text-main','--accent-color'];
      const readTheme=()=>Object.fromEntries(themeProperties.map(key=>[key,getComputedStyle(document.documentElement).getPropertyValue(key)]));
      const themeBefore=JSON.stringify(readTheme());
      const transformBefore=viewport.style.transform;
      if (${themeSettings}) {
        document.querySelector('button[title="调整外观色彩与主题"]').click();
        await new Promise(r=>setTimeout(r,600));
        const select=document.querySelector('#node-palette-select');
        if (${Boolean(nodePaletteSwitch)}) {
          select.value=${JSON.stringify(nodePaletteSwitch || "apple")};
          select.dispatchEvent(new Event('change',{bubbles:true}));
          await new Promise(r=>setTimeout(r,600));
        }
        document.querySelector('.node-palette-settings')?.scrollIntoView({block:'start'});
        if (${themeCustom}) {
          document.querySelectorAll('.appearance-theme-group .appearance-collapse-toggle-btn').forEach(button=>button.click());
          await new Promise(r=>setTimeout(r,300));
        }
        await new Promise(r=>setTimeout(r,300));
      }
      const read=selector=>{ const el=document.querySelector(selector);if(!el)return null;const style=getComputedStyle(el);return {background:style.backgroundColor,color:style.color,border:style.borderColor,shadow:style.boxShadow}; };
      return {scenario:'theme-preview',palette:${JSON.stringify(palette)},appearance:${JSON.stringify(appearance)},
        root:read('.studio-shell'),newBoard:read('.new-board'),clone:read('.node-clone .run-button'),design:read('.node-design .run-button'),
        artifact:read('a.download-link'),player:read('.player-button'),gameButton:read('.game-vocal-run-btn'),gameButtonLabel:read('.game-vocal-run-btn span'),gameButtonIcon:read('.game-vocal-run-btn svg'),previewSwatches:document.querySelectorAll('.theme-palette-chip').length,
        themeUnchanged:themeBefore===JSON.stringify(readTheme()),viewportUnchanged:transformBefore===viewport.style.transform,
        nodePaletteOptions:document.querySelector('#node-palette-select')?.options.length,
        nodePaletteHeight:document.querySelector('.node-palette-settings .appearance-card')?.getBoundingClientRect().height,
        nodePaletteChips:document.querySelectorAll('.node-palette-chip').length,
        themeCardHeights:[...document.querySelectorAll('.appearance-theme-group .appearance-card')].map(el=>el.getBoundingClientRect().height),
        customColorGroups:document.querySelectorAll('.appearance-custom-colors-wrap').length,
        customColorInputs:document.querySelectorAll('.appearance-custom-colors-wrap input[type="color"]').length,
        persistedNodePalette:JSON.parse(localStorage.getItem('mimo_theme_settings')||'{}').nodePalette,
        nodeStripe:getComputedStyle(document.querySelector('.studio-node'),'::before').content,
        cards:[...document.querySelectorAll('.studio-node')].map(el=>({type:el.className,background:getComputedStyle(el).backgroundColor,text:getComputedStyle(el).color}))};
    }
    if (${smoke}) {
      const mountedTypes=[...document.querySelectorAll('.react-flow__node')].map(node=>
        [...node.classList].find(value=>value.startsWith('react-flow__node-') && value!=='react-flow__node-default')?.slice('react-flow__node-'.length)).sort();
      if(mountedTypes.length!==13) throw new Error('Not all node types mounted: '+JSON.stringify(mountedTypes));
      const cases=[
        ['调整外观色彩与主题','.appearance-modal-card'],
        ['存储目录与单个产物下载命名设置','.download-naming-settings'],
      ];
      const opened=[];
      for(const [title,selector] of cases){
        document.querySelector('button[title="'+title+'"]').click();
        await new Promise(r=>setTimeout(r,100));
        if(!document.querySelector(selector)) throw new Error('Settings did not open: '+title);
        opened.push(title);
        document.querySelector('.api-key-modal-close').click();
        await new Promise(r=>setTimeout(r,100));
        if(document.querySelector('.api-key-modal')) throw new Error('Settings did not close: '+title);
      }
      document.querySelector('.status-pill').click();
      await new Promise(r=>setTimeout(r,100));
      const providerCount=document.querySelectorAll('.api-provider-card').length;
      if(providerCount!==7) throw new Error('Expected seven provider choices, got '+providerCount);
      if(!document.querySelector('.api-key-modal')) throw new Error('API settings did not open');
      document.querySelector('.api-key-modal-close').click();
      await new Promise(r=>setTimeout(r,100));
      return {scenario:'studio-smoke',mountedTypes,settingsOpened:opened,apiSettingsOpened:true,providerCount,canvasStillMounted:document.querySelector('.react-flow__viewport')===viewport};
    }
    if (${saveLayout}) {
      const canvas=document.querySelector('.flow-wrap');
      const read=()=>{ const r=canvas.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,transform:viewport.style.transform}; };
      const before=read();
      const name=document.querySelector('.canvas-titlebar-left input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(name,'保存布局测试');
      name.dispatchEvent(new Event('input',{bubbles:true}));
      for(let i=0;i<70 && !document.querySelector('.workspace-save-notice');i++) await new Promise(r=>setTimeout(r,100));
      const notice=document.querySelector('.workspace-save-notice');
      if(!notice) throw new Error('Save status did not appear; layout measurement invalid');
      const during=read(),position=getComputedStyle(notice).position;
      for(let i=0;i<100 && document.querySelector('.workspace-save-notice');i++) await new Promise(r=>setTimeout(r,100));
      if(document.querySelector('.workspace-save-notice')) throw new Error('Save did not settle');
      const after=read();
      return {scenario:'save-layout',before,during,after,noticePosition:position,
        geometryStable:JSON.stringify(before)===JSON.stringify(during) && JSON.stringify(before)===JSON.stringify(after)};
    }
    const bounds=pane.getBoundingClientRect();
    const before=viewport.style.transform;
    const geometryNode=document.querySelector('[data-id="node-55"]') || document.querySelector('.react-flow__node');
    const beforeHeight=geometryNode.offsetHeight;
    let transformUpdates=0;
    const observer=new MutationObserver(records=>{ transformUpdates+=records.filter(r=>r.attributeName==='style').length; });
    observer.observe(viewport,{attributes:true,attributeFilter:['style']});
    let frames=[],last=performance.now(),longTasks=[];
    const tasks=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration)));
    tasks.observe({entryTypes:['longtask']});
    await new Promise(resolve=>{
      let i=0;
      const tick=time=>{
        frames.push(time-last);last=time;
        // A high-rate wheel emits several deltas within a single screen frame.
        for(let burst=0;burst<6;burst++) pane.dispatchEvent(new WheelEvent('wheel',{
          deltaY:i%60<30 ? -2 : 2, clientX:bounds.left+bounds.width/2, clientY:bounds.top+bounds.height/2,
          bubbles:true,cancelable:true
        }));
        if(++i<90) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    await new Promise(r=>setTimeout(r,400));
    observer.disconnect();tasks.disconnect();
    frames=frames.slice(5);const sorted=[...frames].sort((a,b)=>a-b);
    const result={mountedNodes:document.querySelectorAll('.react-flow__node').length,
      hiddenEdgeButtons:document.querySelectorAll('.edge-delete:not(.visible)').length,
      viewportChanged:before!==viewport.style.transform,
      overview:document.querySelector('.flow-wrap')?.classList.contains('is-canvas-overview'),
      transformUpdates,frames:frames.length, meanFrameMs:frames.reduce((a,b)=>a+b,0)/frames.length,
      p95FrameMs:sorted[Math.floor(sorted.length*.95)], framesOver33ms:frames.filter(n=>n>33.4).length,
      longTasks:longTasks.length,longTaskMs:longTasks.reduce((a,b)=>a+b,0),
      geometryPreserved:geometryNode.isConnected && geometryNode.offsetHeight===beforeHeight,
      idleQualityRestored:!document.querySelector('.flow-wrap')?.classList.contains('is-viewport-moving')};
    pane.dispatchEvent(new WheelEvent('wheel',{deltaY:-900,bubbles:true,cancelable:true,clientX:bounds.left+bounds.width/2,clientY:bounds.top+bounds.height/2}));
    await new Promise(r=>setTimeout(r,500));
    result.detailRestored=!document.querySelector('.flow-wrap')?.classList.contains('is-canvas-overview');
    return result;
  })()`);
  if (themePreview && !actionAudit) {
    const output = path.resolve("reports", `theme-${appearance}-${palette}-nodes-${nodePaletteSwitch || nodePalette}${themeSettings ? "-settings" : ""}${themeCustom ? "-custom" : ""}${themeGame ? "-game" : ""}${smoke ? "-all-nodes" : ""}.png`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, (await window.webContents.capturePage()).toPNG());
    result.screenshot = output;
  }
  console.log(JSON.stringify({ nodeCount: workspace.nodes.length, electron: process.versions.electron, renderer: "hidden-offscreen", ...result }));
  clearTimeout(fatalTimer); window.destroy(); server.close(); app.exit(0);
}
fatalTimer = setTimeout(() => { console.error("Zoom benchmark timed out"); app.exit(1); }, 45000);
main().catch(error => { console.error(error); clearTimeout(fatalTimer); server.close(); app.exit(1); });
