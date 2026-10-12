// Isolated, hidden Electron renderer benchmark. No user profile/data or real API is accessed.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const dist = path.resolve(process.argv[2] || "dist");
const count = Number(process.argv[3] || 100);
const saveLayout = process.argv.includes("--save-layout");
const smoke = process.argv.includes("--studio-smoke");
const actionAudit = process.argv.includes("--action-audit");
const overlapSmoke = process.argv.includes("--overlap-smoke");
const themePreview = process.argv.includes("--theme-preview");
const desktopSmoke = process.argv.includes("--desktop-controls-smoke");
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
  if (themeGame) { workspace.nodes[1].type = "gameVocal"; workspace.nodes[1].data.title = "游戏语音"; }
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
const settings = { apiProvider: "mimo", apiEndpoint: "https://example.invalid/v1", hasApiKey: true, configured: true };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    const data = url.pathname === "/api/bootstrap" ? { settings, status: { ok: true, apiKeyConfigured: true }, workspaces: [workspace], activeWorkspace: workspace }
      : url.pathname === "/api/settings/storage-path" ? { dataDir: "isolated-test", workspaceFilePath: "isolated-test", isCustom: false }
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
    require("../electron/desktop-controls.cjs").setupDesktopControls(require("../package.json").version);
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
  if (desktopSmoke) {
    await window.webContents.executeJavaScript(`(async()=>{for(let i=0;i<100&&!document.querySelector('.studio-more-button');i++)await new Promise(r=>setTimeout(r,50)); await new Promise(r=>setTimeout(r,2200));})()`);
    window.webContents.send("desktop-menu-event", "about");
    const result = await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<50&&!document.querySelector('.studio-about-dialog');i++)await new Promise(r=>setTimeout(r,50));
      const dialog=document.querySelector('.studio-about-dialog'); if(!dialog)throw new Error('About did not open through IPC');
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
      const checkbox=document.querySelector('.studio-playback-option input');
      if(!checkbox||checkbox.checked)throw new Error('Incorrect default playback setting');
      checkbox.click();await new Promise(r=>setTimeout(r,50));
      if(!checkbox.checked||localStorage.getItem('mimo_playback_restart_from_beginning')!=='true')throw new Error('Playback setting was not saved');
    })()`);
    const playbackOutput=path.resolve('reports','desktop-playback-'+appearance+'.png');
    fs.writeFileSync(playbackOutput,(await window.webContents.capturePage()).toPNG());
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
            if(css.fontFamily!==referenceFont || css.fontSize!=='12px' || css.fontWeight!=='700' || css.letterSpacing!=='normal')
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
          if(getComputedStyle(game.querySelector('.game-vocal-run-btn')).boxShadow!=='none')
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
      if(failures.length)throw new Error('Action ink failures: '+JSON.stringify({total:failures.length,palettes:[...new Set(failures.map(f=>f.mode+'/'+f.palette))],samples:failures.slice(0,15)}));
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
